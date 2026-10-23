import {randomUUID} from 'node:crypto';
import {fail} from './store.mjs';
const DAY=86400000;
export function createNoodleOrders(store,life,world){
 const db=store.db;
 db.exec(`CREATE TABLE IF NOT EXISTS noodle_orders(id TEXT PRIMARY KEY,account TEXT NOT NULL REFERENCES accounts(id),role TEXT,table_id INTEGER NOT NULL,revision INTEGER NOT NULL,status TEXT NOT NULL,items TEXT NOT NULL,created_at INTEGER NOT NULL,dismissed INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS noodle_order_heads(account TEXT PRIMARY KEY REFERENCES accounts(id),order_id TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS noodle_order_meta(id TEXT PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 0);
 INSERT OR IGNORE INTO noodle_order_meta VALUES('noodle',0);
 CREATE TABLE IF NOT EXISTS noodle_order_receipts(account TEXT NOT NULL REFERENCES accounts(id),request_id TEXT NOT NULL,input TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(account,request_id));
 CREATE UNIQUE INDEX IF NOT EXISTS noodle_order_active ON noodle_orders(account) WHERE status='active';`);
 const decode=r=>r&&({id:r.id,account:r.account,role:r.role,table:r.table_id,revision:r.revision,status:r.status,items:JSON.parse(r.items),createdAt:r.created_at});
 const expire=now=>db.prepare("UPDATE noodle_orders SET status='expired',revision=revision+1 WHERE status='active' AND created_at<=?").run(now-DAY);
 const list=(scene,now=Date.now())=>{if(scene!=='noodle')return[];return db.prepare('SELECT * FROM noodle_orders WHERE dismissed=0 ORDER BY created_at,id').all().map(decode).map(o=>o.status==='active'&&o.createdAt<=now-DAY?{...o,status:'expired',revision:o.revision+1}:o);};
 const write=o=>db.prepare('UPDATE noodle_orders SET table_id=?,revision=?,status=?,items=? WHERE id=?').run(o.table,o.revision,o.status,JSON.stringify(o.items),o.id);
 function interact(user,p,input){
  if(!p||p.scene!=='noodle')fail(409,'请先进入米线店');
  if(typeof input.requestId!=='string'||!input.requestId.length||input.requestId.length>120)fail(400,'操作编号无效');
  const signature=JSON.stringify([input.action,input.orderId??null,input.orderRevision??null,input.table??null,input.slot??null,input.item??null,input.items??null,input.expectedObjectVersion??null,input.revision]);
  const replay=db.prepare('SELECT input,result FROM noodle_order_receipts WHERE account=? AND request_id=?').get(user.id,input.requestId);if(replay){if(replay.input!==signature)fail(409,'操作编号已用于其他请求');return JSON.parse(replay.result);}
  db.exec('SAVEPOINT noodle_order_action');
  try{
   expire(Date.now());const account=store.byId(user.id);if(account.revision!==input.revision)fail(409,'手中物品已改变，请重试');
   const action=input.action;let o;
   if(action==='save'){
    const names=input.items;
    if(![0,1].includes(input.table)||!Array.isArray(names)||names[0]!=='米线'||names.length>3||new Set(names).size!==names.length||names.some(n=>!['米线','鸡柳','炸鸡','可乐','冰红茶'].includes(n))||names.filter(n=>['鸡柳','炸鸡'].includes(n)).length>1||names.filter(n=>['可乐','冰红茶'].includes(n)).length>1)fail(400,'请选择一份米线，可选一份小食和饮料');
    const existing=db.prepare("SELECT * FROM noodle_orders WHERE account=? AND status='active'").get(user.id);
    if(existing){o=decode(existing);if(input.orderId!==o.id||input.orderRevision!==o.revision)fail(409,'已有点餐单，请刷新后修改');if(o.items.some(i=>i.status!=='pending'&&!names.includes(i.name)))fail(409,'已取的食品不能修改，请先放弃帮取');if(o.table!==input.table&&o.items.some(i=>i.status!=='pending'))fail(409,'已开始取餐，不能换桌');o.items=names.map(name=>o.items.find(i=>i.name===name)??{name,status:'pending',picker:null,pickerRole:null});o.table=input.table;o.revision++;write(o);}
    else{if(input.orderId)fail(409,'点餐单已结束，请重新点餐');o={id:randomUUID(),account:user.id,role:account.role,table:input.table,revision:0,status:'active',items:names.map(name=>({name,status:'pending',picker:null,pickerRole:null})),createdAt:Date.now()};db.prepare('INSERT INTO noodle_orders(id,account,role,table_id,revision,status,items,created_at) VALUES(?,?,?,?,?,?,?,?)').run(o.id,o.account,o.role,o.table,o.revision,o.status,JSON.stringify(o.items),o.createdAt);db.prepare('INSERT INTO noodle_order_heads(account,order_id) VALUES(?,?) ON CONFLICT(account) DO UPDATE SET order_id=excluded.order_id').run(user.id,o.id);}
   }else{
    o=decode(db.prepare('SELECT * FROM noodle_orders WHERE id=? AND dismissed=0').get(input.orderId));if(!o)fail(404,'点餐单不存在');
    if(['cancel','dismiss'].includes(action)&&o.account!==user.id)fail(403,'只能修改自己的点餐单');
    if(input.orderRevision!==o.revision)fail(409,'点餐单已改变，请刷新');
    if(action==='dismiss'){if(o.status==='active')fail(409,'请先撤单');db.prepare('UPDATE noodle_orders SET dismissed=1,revision=revision+1 WHERE id=?').run(o.id);}
    else if(action==='cancel'){if(o.status!=='active')fail(409,'点餐单已结束');o.status='cancelled';o.revision++;write(o);}
    else{
     if(o.status!=='active')fail(409,'点餐单已结束');const item=o.items[input.item];if(!Number.isInteger(input.item)||!item)fail(400,'餐品无效');
     if(action==='pickup'){
      if(item.status!=='pending')fail(409,'这份餐品已被领取');
      const source=item.name==='米线'?'noodles':['可乐','冰红茶'].includes(item.name)?'drinks':'chicken';
      const id='noodle-order-'+randomUUID();
      world.interact(user,p,{object:'noodle:'+source,action:'supply',item:item.name,revision:input.revision,requestId:id},new Map());
      item.status='picked';item.picker=user.id;item.pickerRole=account.role;
     }else if(action==='serve'){
      if(item.status!=='picked'||item.picker!==user.id)fail(409,'请先领取这份餐品');if(account.hand!==item.name)fail(409,'手中餐品已改变，可放弃帮取');if(input.table!==o.table)fail(409,'请放到点餐单指定的桌子');
      const id='noodle-order-'+randomUUID();
      world.interact(user,p,{object:'noodle:table-'+o.table,action:'put',slot:input.slot,expectedObjectVersion:input.expectedObjectVersion,revision:input.revision,requestId:id},new Map());item.status='served';item.slot=input.slot;
      if(o.items.every(i=>i.status==='served'))o.status='completed';
     }else if(action==='release'){
      if(item.status!=='picked'||item.picker!==user.id)fail(403,'只能放弃自己帮取的餐品');item.status='pending';item.picker=null;item.pickerRole=null;
     }else fail(400,'点餐操作无效');
     o.revision++;write(o);
    }
   }
   db.prepare("UPDATE noodle_order_meta SET revision=revision+1 WHERE id='noodle'").run();
   const result={noodleOrdersRevision:db.prepare("SELECT revision FROM noodle_order_meta WHERE id='noodle'").get().revision,self:store.publicAccount(store.byId(user.id)),objects:world.snapshot('noodle'),progress:world.progress(user.id),noodleOrders:list('noodle')};
   db.prepare('INSERT INTO noodle_order_receipts VALUES(?,?,?,?)').run(user.id,input.requestId,signature,JSON.stringify(result));db.exec('RELEASE noodle_order_action');return result;
  }catch(error){db.exec('ROLLBACK TO noodle_order_action; RELEASE noodle_order_action');world.invalidate(user.id);throw error;}
 }
 return{list,interact,get revision(){return db.prepare("SELECT revision FROM noodle_order_meta WHERE id='noodle'").get().revision;}};
}
