import {randomUUID} from 'node:crypto';
import {fail} from './store.mjs';
import {coffeeWindow,nearCoffee} from '../shared/coffee.mjs';
export function createCoffeeOrders(store,life){
 const db=store.db;
 db.exec(`CREATE TABLE IF NOT EXISTS coffee_orders(id TEXT PRIMARY KEY,account TEXT NOT NULL REFERENCES accounts(id),status TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
 CREATE UNIQUE INDEX IF NOT EXISTS coffee_one_pending ON coffee_orders(account) WHERE status='pending';
 CREATE TABLE IF NOT EXISTS coffee_order_heads(account TEXT PRIMARY KEY REFERENCES accounts(id),order_id TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS coffee_receipts(account TEXT NOT NULL REFERENCES accounts(id),request_id TEXT NOT NULL,input TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(account,request_id));`);
 const view=r=>r?{id:r.id,status:r.status,version:r.version,createdAt:r.created_at}:null;
 const self=id=>({order:view(db.prepare('SELECT * FROM coffee_orders WHERE account=? ORDER BY created_at DESC,rowid DESC LIMIT 1').get(id)),self:store.publicAccount(store.byId(id))});
 const atomic=fn=>{let owned=false;try{if(!db.isTransaction){try{db.exec('BEGIN IMMEDIATE');owned=true;}catch(e){if(!String(e.message).includes('within a transaction'))throw e;}}const result=fn();if(owned)db.exec('COMMIT');return result;}catch(e){if(owned)db.exec('ROLLBACK');throw e;}};
 const interact=(user,player,input)=>{
  if(!user?.role||!player||player.scene!==coffeeWindow.scene)fail(409,'请先走进 MANNER 门店');
  if(!['order','take','cancel'].includes(input.action))fail(400,'咖啡操作无效');
  if(typeof input.requestId!=='string'||!input.requestId||input.requestId.length>120)fail(400,'操作编号无效');
  if(!nearCoffee(player.x,player.y,input.action==='cancel'?'take':input.action))fail(409,input.action==='order'?'请走到点单台附近':'请走到取杯台附近');
  const signature=JSON.stringify([input.action,input.orderId??null,input.revision,input.expectedOrderVersion??null]);
  return atomic(()=>{
   const old=db.prepare('SELECT * FROM coffee_receipts WHERE account=? AND request_id=?').get(user.id,input.requestId);
   if(old){if(old.input!==signature)fail(409,'操作编号已用于其他请求');return JSON.parse(old.result);}
   const a=store.byId(user.id);if(a.revision!==input.revision)fail(409,'手中物品已改变，请重试');
   let order;
   if(input.action==='order'){
    if(a.hand)fail(409,'先收好手里的物品');if(db.prepare("SELECT 1 FROM coffee_orders WHERE account=? AND status='pending'").get(a.id))fail(409,'已有待取咖啡，请先取杯或取消');
    const id=randomUUID();db.prepare("INSERT INTO coffee_orders VALUES(?,?,'pending',0,?)").run(id,a.id,Date.now());
    // A stable per-account write key also makes concurrent replica orders conflict.
    db.prepare('INSERT INTO coffee_order_heads VALUES(?,?) ON CONFLICT(account) DO UPDATE SET order_id=excluded.order_id').run(a.id,id);order=db.prepare('SELECT * FROM coffee_orders WHERE id=?').get(id);
   }else{
    order=db.prepare('SELECT * FROM coffee_orders WHERE id=? AND account=?').get(input.orderId??'',a.id);if(!order)fail(404,'订单不存在');
    if(order.status!=='pending')fail(409,order.status==='taken'?'这杯咖啡已取走':'订单已取消');
    if(order.version!==input.expectedOrderVersion)fail(409,'订单已改变，请刷新');
    if(input.action==='take'){
     if(a.hand)fail(409,'先收好手里的物品');
     db.prepare("UPDATE accounts SET hand='咖啡',seasoning='[]',revision=revision+1 WHERE id=?").run(a.id);
     db.prepare("INSERT INTO hand_origins VALUES(?,'咖啡','manner',?) ON CONFLICT(account) DO UPDATE SET item=excluded.item,scene=excluded.scene,at=excluded.at").run(a.id,Date.now());
    }
    db.prepare('UPDATE coffee_orders SET status=?,version=version+1 WHERE id=?').run(input.action==='take'?'taken':'cancelled',order.id);order=db.prepare('SELECT * FROM coffee_orders WHERE id=?').get(order.id);
   }
   const result={order:view(order),self:store.publicAccount(store.byId(a.id))};db.prepare('INSERT INTO coffee_receipts VALUES(?,?,?,?)').run(a.id,input.requestId,signature,JSON.stringify(result));return result;
  });
 };
 return{self,interact};
}
