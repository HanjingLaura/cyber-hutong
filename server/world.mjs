import {randomInt} from 'node:crypto';
import {fail} from './store.mjs';

export const supplies={
 'rest:vending':{at:[119,150],items:['可乐','气泡水','薯片','面包','火腿肠','辣条']},
 'rest:coffee':{at:[314,146],items:['咖啡']},
 'noodle:drinks':{at:[104,181],items:['可乐','冰红茶']},
 'noodle:utensils':{at:[156,181],items:['碗筷']},
 'noodle:noodles':{at:[280,181],items:['米线'],requires:'碗筷'},
 'noodle:chicken':{at:[476,181],items:['鸡柳','炸鸡']},
 'gym:water':{at:[46,307],items:['水']},
};
export const objects={
 'rest:fridge':{at:[180,150],slots:['面包','马卡龙','蛋糕',null,null,null,null,null,null]},
 ...Object.fromEntries([200,360,520].map((x,i)=>[`rest:table-${i}`,{at:[x,245],slots:Array(6).fill(null)}])),
 ...Object.fromEntries([213,439].map((x,i)=>[`noodle:table-${i}`,{at:[x,285],slots:Array(6).fill(null)}])),
 'gym:stash':{at:[91,304],slots:Array(6).fill(null)},
 'dance:stash':{at:[565,178],slots:[null]},
 'perler:stash':{at:[91,319],slots:[null]},
 'hawaii:curtain':{at:[78,184],open:false},
 'rest:fridge-door':{at:[180,150],open:false},
 ...Object.fromEntries([88,173,259,344].map((x,i)=>[`bathroom:door-${i}`,{at:[x,226],open:false}])),
 ...Object.fromEntries([0,1].map(i=>[`elevator:door-${i}`,{at:[i?471:250,253],open:false}])),
 'subway:doors':{at:[320,242],open:false},
 ...Object.fromEntries(['story','classic','bikini'].map(theme=>[`pop:${theme}`,{at:[320,300],stock:Array(18).fill(true)}])),
};
export function createWorld(store,life){
 const db=store.db;
 db.exec(`CREATE TABLE IF NOT EXISTS room_objects(id TEXT PRIMARY KEY,version INTEGER NOT NULL,state TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS achievements(account TEXT NOT NULL REFERENCES accounts(id),kind TEXT NOT NULL,key TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(account,kind,key));`);
 const load=id=>{const spec=objects[id];if(!spec)fail(400,'物件无效');let row=db.prepare('SELECT * FROM room_objects WHERE id=?').get(id);if(!row){db.prepare('INSERT INTO room_objects VALUES(?,0,?)').run(id,JSON.stringify(spec));row=db.prepare('SELECT * FROM room_objects WHERE id=?').get(id);}return{id,version:row.version,...JSON.parse(row.state)};};
 const save=o=>{o.version++;const {id,version,...state}=o;db.prepare('UPDATE room_objects SET version=?,state=? WHERE id=?').run(version,JSON.stringify(state),id);};
 const progressCache=new Map();
 const progress=account=>{if(!progressCache.has(account))progressCache.set(account,db.prepare('SELECT kind,key,data FROM achievements WHERE account=? ORDER BY rowid').all(account).map(r=>({...r,data:JSON.parse(r.data)})));return progressCache.get(account);};
 const write=(account,kind,key,data)=>{const value=JSON.stringify(data);if(db.prepare('SELECT data FROM achievements WHERE account=? AND kind=? AND key=?').get(account,kind,key)?.data===value)return;db.prepare('INSERT INTO achievements VALUES(?,?,?,?) ON CONFLICT(account,kind,key) DO UPDATE SET data=excluded.data').run(account,kind,key,value);db.prepare('UPDATE accounts SET progress_revision=progress_revision+1 WHERE id=?').run(account);progressCache.delete(account);};
 const snapshot=scene=>Object.keys(objects).filter(id=>id.startsWith(scene+':')).map(load);
 const checkNear=(p,id,action)=>{const spec=objects[id]||supplies[id];if(!spec||!id.startsWith(p.scene+':'))fail(400,'物件不在当前房间');let points=[spec.at],radius=65;if(id.startsWith('pop:')){points=[action==='gacha'?[438,162]:[320,290]];radius=45;}if(id==='subway:doors'){points=[[113.5,242],[320,242],[525.5,242]];radius=42;}if(!points.some(([x,y])=>Math.hypot(p.x-x,p.y-y)<=radius))fail(409,'请走到物件附近');};
 function interact(user,p,input,players,options={}){
  if(typeof input.requestId!=='string'||input.requestId.length>120)fail(400,'操作编号无效');
  const replay=db.prepare('SELECT result FROM operations WHERE account=? AND id=?').get(user.id,input.requestId);if(replay)return JSON.parse(replay.result);
  checkNear(p,input.object,input.action);if(['supply','put','take','consume','gacha'].includes(input.action))life?.unlocked(user.id);
  // Older node:sqlite may lack isTransaction; avoid nested BEGIN when already transactional.
  let ownedTx=true;try{if(typeof db.isTransaction==='boolean'?db.isTransaction:false)ownedTx=false;else db.exec('BEGIN IMMEDIATE');}catch(e){if(String(e?.message||e).includes('within a transaction'))ownedTx=false;else throw e;}
  try{
   const account=store.byId(user.id);if(account.revision!==input.revision)fail(409,'手中物品已改变，请重试');
   let hand=account.hand,seasoning=JSON.parse(account.seasoning||'[]');const spec=supplies[input.object];let o=spec?null:load(input.object);const slot=input.slot;
   if(input.action==='supply'){
    if(!spec||!spec.items.includes(input.item))fail(400,'不能领取此物品');
    if(spec.requires?hand!==spec.requires:hand!==null)fail(409,spec.requires?'先拿碗筷':'手中已有物品');hand=input.item;seasoning=[];
   }else if(input.action==='put'||input.action==='take'||input.action==='consume'||input.action==='season'){
    if(!o?.slots)fail(400,'不是储物物件');
    if(!Number.isInteger(slot)||slot<0||slot>=o.slots.length)fail(400,'物品位置无效');
    if(input.action==='put'){if(!hand||o.slots[slot])fail(409,'空手或位置已被占用');o.slots[slot]={name:hand,seasoning};hand=null;seasoning=[];}
    if(input.action==='take'){if(hand||!o.slots[slot])fail(409,'物品已被拿走或手中已有物品');hand=typeof o.slots[slot]==='string'?o.slots[slot]:o.slots[slot].name;seasoning=o.slots[slot].seasoning??[];o.slots[slot]=null;}
    if(input.action==='consume'){if(!p.seat||!input.object.startsWith('noodle:'))fail(409,'先坐下用餐');if(input.fromHand){if(!['米线','鸡柳','炸鸡'].includes(hand))fail(400,'不能食用');hand=null;}else{const dish=o.slots[slot];if(!dish||!['米线','鸡柳','炸鸡'].includes(dish.name??dish))fail(409,'食物已被拿走');o.slots[slot]=null;}}
    if(input.action==='season'){const dish=o.slots[slot];if(!dish||dish.name!=='米线'||!['醋','麻油'].includes(input.item))fail(400,'先放米线再加调料');if(!dish.seasoning.includes(input.item))dish.seasoning.push(input.item);}
    save(o);
   }else if(input.action==='toggle'){
    if(!o||typeof o.open!=='boolean')fail(400,'不能开关');
    if(input.object.startsWith('bathroom:')){const n=input.object.split('-')[1];if([...players.values()].some(other=>other.id!==user.id&&other.scene==='bathroom'&&other.seat===n))fail(409,'隔间有人使用');}
    o.open=!o.open;save(o);
   }else if(input.action==='draw'){
    if(!o?.stock||!Number.isInteger(slot)||slot<0||slot>=18||!o.stock[slot])fail(409,'这盒已被取走');
    o.stock[slot]=false;save(o);const theme=input.object.split(':')[1],pool={story:[0,1,2],classic:[6,7,8,9],bikini:[3,4,5]}[theme];
    const record={toy:pool[randomInt(pool.length)],theme,source:'shelf',slot,at:Date.now(),id:input.requestId};write(user.id,'toy',input.requestId,record);
   }else if(input.action==='gacha'){
    if(input.object!=='pop:classic')fail(400,'机器无效');if(hand)fail(409,'先把手里的物品放下');const toy=randomInt(6);hand=['扭蛋·粉色小熊','扭蛋·薄荷兔子','扭蛋·蓝色机器人','扭蛋·橘猫','扭蛋·紫色小巫师','扭蛋·皇冠小熊'][toy];write(user.id,'gacha',input.requestId,{toy,at:Date.now()});
   }else if(input.action==='refill'){
    if(!o?.stock)fail(400,'不能补货');if(o.stock.some(Boolean))fail(409,'先取完这排盲盒再补货');o.stock.fill(true);save(o);
   }else fail(400,'操作无效');
   if(hand!==account.hand)db.prepare('UPDATE accounts SET hand=?,seasoning=?,revision=revision+1 WHERE id=?').run(hand,JSON.stringify(hand?seasoning:[]),user.id);
   if(!options.skipRecord&&['supply','put','take','consume','draw','gacha'].includes(input.action))life?.record(user.id,'object',({supply:'领取了'+input.item,put:'放下了'+account.hand,take:'从储物处拿起了'+hand,consume:'享用了食物',draw:'打开了一盒盲盒',gacha:'抽到了'+hand}[input.action])+'。',p.scene);
   const result={self:store.publicAccount(store.byId(user.id)),objects:snapshot(p.scene),progress:progress(user.id)};
   db.prepare('INSERT INTO operations VALUES(?,?,?)').run(input.requestId,user.id,JSON.stringify(result));if(ownedTx)db.exec('COMMIT');return result;
  }catch(e){if(ownedTx)db.exec('ROLLBACK');progressCache.delete(user.id);throw e;}
 }
 return{snapshot,progress,interact,write,invalidate:id=>progressCache.delete(id)};
}
