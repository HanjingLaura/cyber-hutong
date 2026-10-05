import {randomUUID} from 'node:crypto';
import {fail} from './store.mjs';

export const consumables=['咖啡','可乐','气泡水','薯片','面包','火腿肠','辣条','马卡龙','蛋糕','冰红茶','米线','鸡柳','炸鸡','水'];
export const memoryPolicy={routineCooldown:30*60000,encounterCooldown:60*60000};
export function createLife(store){
 const db=store.db;
 db.exec(`CREATE TABLE IF NOT EXISTS positions(account TEXT PRIMARY KEY REFERENCES accounts(id),state TEXT NOT NULL,at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS experiences(seq INTEGER PRIMARY KEY AUTOINCREMENT,account TEXT NOT NULL REFERENCES accounts(id),kind TEXT NOT NULL,body TEXT NOT NULL,scene TEXT NOT NULL,at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS experiences_owner ON experiences(account,seq);
 CREATE TABLE IF NOT EXISTS bags(account TEXT PRIMARY KEY REFERENCES accounts(id),state TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS collections(account TEXT PRIMARY KEY REFERENCES accounts(id),state TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS offers(id TEXT PRIMARY KEY,sender TEXT NOT NULL REFERENCES accounts(id),recipient TEXT NOT NULL REFERENCES accounts(id),kind TEXT NOT NULL,item TEXT,status TEXT NOT NULL,scene TEXT NOT NULL,expires INTEGER NOT NULL,request_id TEXT NOT NULL,UNIQUE(sender,request_id));`);
 if(!db.prepare('PRAGMA table_info(experiences)').all().some(c=>c.name==='data'))db.exec("ALTER TABLE experiences ADD COLUMN data TEXT NOT NULL DEFAULT '{}'");
 const columns=db.prepare('PRAGMA table_info(experiences)').all();
 if(!columns.some(c=>c.name==='routine'))db.exec('ALTER TABLE experiences ADD COLUMN routine INTEGER NOT NULL DEFAULT 0');
 if(!columns.some(c=>c.name==='event_key'))db.exec("ALTER TABLE experiences ADD COLUMN event_key TEXT NOT NULL DEFAULT ''");
 if(!columns.some(c=>c.name==='event_id'))db.exec("ALTER TABLE experiences ADD COLUMN event_id TEXT NOT NULL DEFAULT ''");
 db.exec("CREATE UNIQUE INDEX IF NOT EXISTS experiences_shared ON experiences(account,event_id) WHERE event_id<>''");
 db.exec('CREATE INDEX IF NOT EXISTS experiences_cooldown ON experiences(account,event_key,at); CREATE INDEX IF NOT EXISTS experiences_daily ON experiences(account,routine,at)');
 let sceneProvider=()=>null,actorProvider=()=>null;
 const setSceneProvider=(provider,actors=()=>null)=>{sceneProvider=provider;actorProvider=actors;};
 const record=(account,kind,body,scene,at=Date.now(),options={})=>{
  const routine=options.routine===true,key=options.key??`${kind}:${scene}:${body}`,cooldown=options.cooldown??(routine?memoryPolicy.routineCooldown:0);
  if(cooldown&&db.prepare('SELECT 1 FROM experiences WHERE account=? AND event_key=? AND at>? LIMIT 1').get(account,key,at-cooldown))return{changes:0};
  return db.prepare('INSERT INTO experiences(account,kind,body,scene,at,data,routine,event_key) VALUES(?,?,?,?,?,?,?,?)').run(account,kind,body,scene,at,JSON.stringify(sceneProvider(scene)??{}),Number(routine),key);
 };
 const recordGroup=(accounts,kind,body,scene,at=Date.now(),eventId=randomUUID())=>{
  const ids=[...new Set(accounts)].filter(id=>store.byId(id));
  const data=JSON.stringify({...sceneProvider(scene),participants:ids.map(id=>store.byId(id).role),participantStates:ids.map(actorProvider).filter(Boolean),eventId});
  // Callers already inside a transaction retain their atomic state change.
  // node:sqlite may omit isTransaction; fall back to detecting nested BEGIN.
  const insert=()=>{for(const id of ids)db.prepare("INSERT OR IGNORE INTO experiences(account,kind,body,scene,at,data,routine,event_key,event_id) VALUES(?,?,?,?,?,?,0,'',?)").run(id,kind,body,scene,at,data,eventId);};
  if(db.isTransaction===true){insert();return eventId;}
  try{db.exec('BEGIN IMMEDIATE');}catch(e){if(String(e.message||e).includes('within a transaction')){insert();return eventId;}throw e;}
  try{insert();db.exec('COMMIT');return eventId;}catch(e){try{db.exec('ROLLBACK');}catch{/* keep original */}throw e;}
 };
 const journal=(account,before=Number.MAX_SAFE_INTEGER)=>db.prepare('SELECT seq,kind,body,scene,at,event_id AS eventId,data FROM experiences WHERE account=? AND seq<? AND routine=0 ORDER BY seq DESC LIMIT 50').all(account,before).map(e=>({...e,data:JSON.parse(e.data)}));
 const recent=account=>db.prepare('SELECT seq,kind,body,scene,at FROM experiences WHERE account=? AND routine=0 ORDER BY seq DESC LIMIT 5').all(account);
 const savePosition=p=>db.prepare('INSERT INTO positions VALUES(?,?,?) ON CONFLICT(account) DO UPDATE SET state=excluded.state,at=excluded.at').run(p.id,JSON.stringify({scene:p.scene,x:p.x,y:p.y,facing:p.facing,seat:p.seat,activity:p.activity}),Date.now());
 const position=id=>{const row=db.prepare('SELECT state FROM positions WHERE account=?').get(id);return row?JSON.parse(row.state):null;};
 const bag=id=>JSON.parse(db.prepare('SELECT state FROM bags WHERE account=?').get(id)?.state??'[null,null,null,null]');
 const writeBag=(id,slots)=>db.prepare('INSERT INTO bags VALUES(?,?) ON CONFLICT(account) DO UPDATE SET state=excluded.state').run(id,JSON.stringify(slots));
 const collection=id=>JSON.parse(db.prepare('SELECT state FROM collections WHERE account=?').get(id)?.state??'[]');
 const writeCollection=(id,entries)=>db.prepare('INSERT INTO collections VALUES(?,?) ON CONFLICT(account) DO UPDATE SET state=excluded.state').run(id,JSON.stringify(entries));
 // Used inside the caller's transaction; collection changes and rewards commit together.
 const addCollected=(id,name,seasoning=[])=>{const entries=collection(id);const entry=entries.find(e=>e.name===name&&JSON.stringify(e.seasoning)===JSON.stringify(seasoning));if(entry)entry.count++;else{if(entries.length>=1000)fail(409,'收藏空间已满');entries.push({name,count:1,seasoning});}writeCollection(id,entries);};
 const atomic=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
 const replay=(id,key)=>{if(typeof key!=='string'||!key||key.length>120)fail(400,'操作编号无效');const r=db.prepare('SELECT result FROM operations WHERE account=? AND id=?').get(id,key);return r?JSON.parse(r.result):null;};
 const remember=(id,key,result)=>{db.prepare('INSERT INTO operations VALUES(?,?,?)').run(key,id,JSON.stringify(result));return result;};
 const expire=(now=Date.now())=>{for(const o of db.prepare("SELECT * FROM offers WHERE status IN ('pending','accepted') AND expires<=?").all(now)){db.prepare("UPDATE offers SET status='expired' WHERE id=?").run(o.id);record(o.sender,o.kind,o.kind==='gift'?'赠送等待超时，物品仍在手中。':'一起休息的约定超时。',o.scene,now);record(o.recipient,o.kind,'这次邀请已超时。',o.scene,now);}};
 const unlocked=id=>{expire();if(db.prepare("SELECT id FROM offers WHERE sender=? AND kind='gift' AND status='pending'").get(id))fail(409,'这件物品正在等待对方回应，请先取消赠送');};
 const inventory=(id,input,scene,recordOptions={})=>{const old=replay(id,input.requestId);if(old)return old;return atomic(()=>{
  unlocked(id);const a=store.byId(id),slots=bag(id);if(a.revision!==input.revision)fail(409,'物品已改变，请重试');let hand=a.hand,seasoning=JSON.parse(a.seasoning||'[]');
  if(input.action==='stow'){if(!hand)fail(409,'手中没有物品');let slot=slots.findIndex(s=>s?.name===hand&&s.count<5&&JSON.stringify(s.seasoning)===JSON.stringify(seasoning));if(slot<0)slot=slots.indexOf(null);if(slot<0)fail(409,'背包已满');if(slots[slot])slots[slot].count++;else slots[slot]={name:hand,count:1,seasoning};hand=null;seasoning=[];}
  else if(input.action==='equip'){if(!Number.isInteger(input.slot)||input.slot<0||input.slot>3)fail(400,'背包格子无效');const entry=slots[input.slot];if(!entry)fail(409,'这个格子是空的');if(hand)fail(409,'先收起手中物品');hand=entry.name;seasoning=entry.seasoning;if(--entry.count===0)slots[input.slot]=null;}
  else if(input.action==='consume'){if(!consumables.includes(hand))fail(409,'这个物品不能食用');if(!recordOptions.silent)record(id,'consume',`享用了${hand}。`,scene,Date.now(),recordOptions);hand=null;seasoning=[];}
  else if(input.action==='collect'){if(!hand||consumables.includes(hand)||hand==='碗筷')fail(409,'手中的物品不能收藏');const item=hand;addCollected(id,item,seasoning);hand=null;seasoning=[];if(!recordOptions.silent)record(id,'collect',`把${item.startsWith('拼豆·')?'拼豆作品':item}收进了收藏。`,scene);}
  else if(input.action==='retrieve'){if(hand)fail(409,'先收起手中物品');const entries=collection(id);if(!Number.isInteger(input.slot)||input.slot<0||input.slot>=entries.length)fail(400,'收藏位置无效');const entry=entries[input.slot];hand=entry.name;seasoning=entry.seasoning;if(--entry.count===0)entries.splice(input.slot,1);writeCollection(id,entries);}
  else fail(400,'背包操作无效');
  writeBag(id,slots);db.prepare('UPDATE accounts SET hand=?,seasoning=?,revision=revision+1 WHERE id=?').run(hand,JSON.stringify(seasoning),id);
  return remember(id,input.requestId,{self:store.publicAccount(store.byId(id)),bag:slots,collection:collection(id)});
 });};
 const send=(id,peer,kind,requestId,scene,revision)=>{
  if(!['gift','meet'].includes(kind))fail(400,'邀请无效');if(typeof requestId!=='string'||!requestId||requestId.length>120)fail(400,'操作编号无效');expire();
  const old=db.prepare('SELECT * FROM offers WHERE sender=? AND request_id=?').get(id,requestId);if(old)return old;
  return atomic(()=>{const a=store.byId(id),b=store.byRole(peer);if(!b||b.id===id)fail(400,'对方尚未领取角色');if(db.prepare("SELECT id FROM offers WHERE (sender=? OR recipient=?) AND kind=? AND status IN ('pending','accepted')").get(id,id,kind))fail(409,'先结束当前邀请');
   if(kind==='gift'){if(revision!==undefined&&a.revision!==revision)fail(409,'手中物品已改变，请重试');unlocked(id);if(!a.hand)fail(409,'手中没有物品');}
   const offer={id:randomUUID(),sender:id,recipient:b.id,kind,item:kind==='gift'?a.hand:null,status:'pending',scene,expires:Date.now()+(kind==='gift'?30000:90000),request_id:requestId};
   db.prepare('INSERT INTO offers VALUES(?,?,?,?,?,?,?,?,?)').run(...Object.values(offer));record(id,kind,kind==='gift'?`想把${a.hand}送给 ${b.role}，正在等待回应。`:`邀请 ${b.role} 一起去休息室。`,scene);return offer;
  });
 };
 const respond=(id,offerId,answer)=>{expire();return atomic(()=>{
  const o=db.prepare('SELECT * FROM offers WHERE id=?').get(offerId);if(!o||![o.sender,o.recipient].includes(id))fail(404,'没有这次邀请');
  if(!['accept','reject','cancel'].includes(answer))fail(400,'回应无效');if(answer!=='cancel'&&id!==o.recipient)fail(403,'等待对方回应');if(!['pending','accepted'].includes(o.status))return o;
  if(o.status==='accepted'&&answer!=='cancel')return o;
  if(answer==='accept'&&o.kind==='gift'){const a=store.byId(o.sender),b=store.byId(o.recipient);if(a.hand!==o.item)fail(409,'赠送的物品已改变');if(b.hand)fail(409,'先收起手中的物品');db.prepare("UPDATE accounts SET hand=NULL,seasoning='[]',revision=revision+1 WHERE id=?").run(a.id);db.prepare('UPDATE accounts SET hand=?,seasoning=?,revision=revision+1 WHERE id=?').run(a.hand,a.seasoning,b.id);}
  const status=answer==='accept'?(o.kind==='gift'?'completed':'accepted'):answer==='reject'?'rejected':'cancelled';db.prepare('UPDATE offers SET status=? WHERE id=?').run(status,o.id);
  const a=store.byId(o.sender),b=store.byId(o.recipient),text=o.kind==='gift'?`${b.role} ${status==='completed'?'收下了':'没有收下'} ${a.role} 赠送的${o.item}。`:`${a.role} 与 ${b.role} 的休息邀请${status==='accepted'?'已接受':status==='rejected'?'被婉拒':'已取消'}。`;
  const scene=actorProvider(a.id)?.scene??o.scene;
  recordGroup([a.id,b.id],o.kind,text,scene,Date.now(),o.id+':'+status);return{...o,status};
 });};
 const offers=id=>{expire();return db.prepare("SELECT o.*,a.role AS fromRole,b.role AS toRole FROM offers o JOIN accounts a ON o.sender=a.id JOIN accounts b ON o.recipient=b.id WHERE (sender=? OR recipient=?) AND status IN ('pending','accepted') ORDER BY expires").all(id,id);};
 const meeting=(id)=>db.prepare("SELECT * FROM offers WHERE kind='meet' AND status='accepted' AND (sender=? OR recipient=?) ORDER BY expires LIMIT 1").get(id,id);
 const finishMeetings=positions=>{expire();for(const o of db.prepare("SELECT * FROM offers WHERE kind='meet' AND status='accepted'").all()){const a=positions.find(p=>p.id===o.sender),b=positions.find(p=>p.id===o.recipient);if(a?.scene==='rest'&&b?.scene==='rest'&&Math.hypot(a.x-b.x,a.y-b.y)<60){db.prepare("UPDATE offers SET status='completed' WHERE id=?").run(o.id);const text=`${a.role} 和 ${b.role} 在休息室碰面了。`;recordGroup([a.id,b.id],'meet',text,'rest',Date.now(),o.id+':completed');}}};
 return{record,recordGroup,journal,recent,setSceneProvider,savePosition,position,bag,collection,addCollected,inventory,unlocked,send,respond,offers,meeting,finishMeetings,expire};
}
