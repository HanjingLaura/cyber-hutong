import {randomUUID} from 'node:crypto';
import {fail} from './store.mjs';

export const plushNames=['粉色小熊','蓝色小熊','金色小熊','紫色小熊','绿色小熊'];
const prizeXs=[140,220,300,380,460,530];
export function createRewards(store,life,world,leases){
 const db=store.db;
 db.exec(`CREATE TABLE IF NOT EXISTS collectible_art(name TEXT PRIMARY KEY,account TEXT NOT NULL,source TEXT NOT NULL,data TEXT NOT NULL,UNIQUE(account,source));
 CREATE TABLE IF NOT EXISTS claw_rounds(id TEXT PRIMARY KEY,account TEXT NOT NULL,at INTEGER NOT NULL,prize INTEGER,status TEXT NOT NULL);`);
 const art=name=>{const row=db.prepare('SELECT data FROM collectible_art WHERE name=?').get(name);return row?JSON.parse(row.data):null;};
 const state=id=>world.progress(id).find(p=>p.kind==='claw'&&p.key==='machine')?.data??{remaining:[0,1,2,3,4,5],wins:0};
 const interact=(user,p,input)=>{
  if(typeof input.requestId!=='string'||!input.requestId||input.requestId.length>120)fail(400,'操作编号无效');
  const old=db.prepare('SELECT result FROM operations WHERE account=? AND id=?').get(user.id,input.requestId);if(old)return JSON.parse(old.result);
  db.exec('BEGIN IMMEDIATE');
  try{
   const a=store.byId(user.id);if(a.revision!==input.revision)fail(409,'物品已改变，请重试');life.unlocked(a.id);
   let item=null,result={};
   if(input.action==='perler'){
    if(p.scene!=='perler')fail(409,'请到拼豆室取作品');
    const key=input.key;if(typeof key!=='string'||key.length>80)fail(400,'作品编号无效');
    const work=world.progress(a.id).find(w=>w.kind==='bead'&&w.key===key)?.data;
    if(!work||!Array.isArray(work.cells)||!work.cells.some(c=>c>=0))fail(404,'没有这件已熨烫的作品');
    if(db.prepare('SELECT 1 FROM collectible_art WHERE account=? AND source=?').get(a.id,'bead:'+key))fail(409,'这件作品已经带走或收藏了');
    item='拼豆·'+randomUUID();db.prepare('INSERT INTO collectible_art VALUES(?,?,?,?)').run(item,a.id,'bead:'+key,JSON.stringify({cells:work.cells,pattern:String(work.pattern??'自由').slice(0,40)}));
    world.write(a.id,'reward','bead:'+key,{item});
   }else if(input.action==='claw-cancel'){
    db.prepare("UPDATE claw_rounds SET status='cancelled' WHERE id=? AND account=? AND status='pending'").run(input.round,a.id);
   }else if(input.action==='claw-start'||input.action==='claw-finish'){
    if(p.scene!=='arcade'||Math.hypot(p.x-269,p.y-205)>40||leases.get('arcade:claw')?.account!==a.id)fail(409,'请在娃娃机旁开始游戏');
    if(input.action==='claw-start'){
     if(!Number.isFinite(input.aim)||input.aim<110||input.aim>550)fail(400,'抓取位置无效');
     const pending=db.prepare("SELECT at FROM claw_rounds WHERE account=? AND status='pending'").get(a.id);if(pending&&Date.now()-pending.at<10000)fail(409,'这一轮尚未完成');
     db.prepare("UPDATE claw_rounds SET status='cancelled' WHERE account=? AND status='pending'").run(a.id);
     const s=state(a.id);if(!s.remaining.length){s.remaining=[0,1,2,3,4,5];world.write(a.id,'claw','machine',s);}
     const prize=s.remaining.find(i=>Math.abs(prizeXs[i]-input.aim)<19)??null,round=randomUUID();
     db.prepare("INSERT INTO claw_rounds VALUES(?,?,?,?,'pending')").run(round,a.id,Date.now(),prize);
     result={round,prize,remaining:s.remaining};
    }else{
     const round=db.prepare('SELECT * FROM claw_rounds WHERE id=? AND account=?').get(input.round,a.id);if(!round||round.status!=='pending')fail(409,'这一轮已结束');
     if(Date.now()-round.at<2300)fail(409,'爪子还没有回到出口');if(Date.now()-round.at>60000)fail(409,'这一轮已过期');
     db.prepare("UPDATE claw_rounds SET status='completed' WHERE id=?").run(round.id);
     const s=state(a.id);if(round.prize!==null){if(!s.remaining.includes(round.prize))fail(409,'娃娃已经被取走');s.remaining=s.remaining.filter(i=>i!==round.prize);s.wins++;item='娃娃·'+plushNames[round.prize%5];world.write(a.id,'claw','machine',s);world.write(a.id,'score','claw',{value:s.wins});}
     result={won:!!item,remaining:s.remaining,wins:s.wins};
    }
   }else fail(400,'奖励操作无效');
   if(item){
    const collected=input.collect===true||!!a.hand;
    if(collected)life.addCollected(a.id,item);else db.prepare("UPDATE accounts SET hand=?,seasoning='[]' WHERE id=?").run(item,a.id);
    db.prepare('UPDATE accounts SET revision=revision+1 WHERE id=?').run(a.id);
    life.record(a.id,'reward',`${input.action==='perler'?'完成的拼豆作品':'抓到的'+item.slice(3)}${collected?'收进了收藏':'拿在了手里'}。`,p.scene);
    result={...result,item,collected};
   }
   result={...result,self:store.publicAccount(store.byId(a.id)),bag:life.bag(a.id),collection:life.collection(a.id),progress:world.progress(a.id),progressVersion:store.byId(a.id).progress_revision};
   db.prepare('INSERT INTO operations VALUES(?,?,?)').run(input.requestId,a.id,JSON.stringify(result));db.exec('COMMIT');return result;
  }catch(e){db.exec('ROLLBACK');world.invalidate?.(user.id);throw e;}
 };
 return{art,state,interact};
}
