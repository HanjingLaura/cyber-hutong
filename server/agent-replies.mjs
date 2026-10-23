import {channelOf} from './chat-channel.mjs';
import {scopedAgentProfile} from './agent-profile.mjs';
import {digest} from './store.mjs';

export function createAgentReplies(store,{profiles,llm,canDrive,humanLive,mutate,publish,publishStatus,backgroundTask=()=>{}}){
 const db=store.db;db.exec(`CREATE TABLE IF NOT EXISTS agent_reply_jobs(
 id TEXT PRIMARY KEY,source TEXT UNIQUE NOT NULL,requester TEXT NOT NULL,account TEXT NOT NULL,
 channel TEXT NOT NULL,scene TEXT NOT NULL,profile_revision INTEGER NOT NULL,status TEXT NOT NULL,
 reason TEXT NOT NULL DEFAULT '',attempts INTEGER NOT NULL DEFAULT 0,lease_until INTEGER NOT NULL DEFAULT 0,at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS agent_reply_pending ON agent_reply_jobs(status,lease_until);`);
 const active=new Map(),controllers=new Map(),retryAt=new Map();let closed=false,retryTimer=null,retryResolve=null,retryDue=Infinity;
 const roleOf=row=>store.byId(row.account)?.role;
 const view=row=>({id:row.id,role:roleOf(row),sender:roleOf(row),recipient:row.channel==='dm'?row.requester:null,channel:row.channel,scene:row.scene,status:row.status,reason:row.reason,at:row.at});
 const eligible=row=>{const profile=profiles.get(row.account);return !humanLive(row.account)&&canDrive(row.account)&&profile?.confirmed&&profile.enabled&&profile.revision===row.profile_revision;};
 const setStatus=(row,status,reason='')=>{db.prepare('UPDATE agent_reply_jobs SET status=?,reason=?,lease_until=0,at=? WHERE id=?').run(status,reason,Date.now(),row.id);publishStatus(view({...row,status,reason,at:Date.now()}));};
 async function run(id){
  retryAt.delete(id);
  const job=await mutate(()=>{
   const row=db.prepare('SELECT * FROM agent_reply_jobs WHERE id=?').get(id);if(!row||!['queued','generating'].includes(row.status)||row.status==='generating'&&row.lease_until>Date.now())return null;
   if(Date.now()-row.at>600000){setStatus(row,'failed','queue_expired');return null;}
   if(!eligible(row)){setStatus(row,'canceled','owner_or_profile_changed');return null;}
   if(db.prepare("SELECT COUNT(*) n FROM agent_reply_jobs WHERE status='generating' AND lease_until>?").get(Date.now()).n>=2){retryAt.set(id,Date.now()+1000);return null;}
   db.prepare("UPDATE agent_reply_jobs SET status='generating',attempts=attempts+1,lease_until=?,at=? WHERE id=?").run(Date.now()+45000,Date.now(),id);publishStatus(view({...row,status:'generating'}));return {...row,attempts:row.attempts+1};
  });
  if(!job||closed)return;
  const current=db.prepare('SELECT * FROM agent_reply_jobs WHERE id=?').get(id);
  if(current?.status!=='generating'||current.attempts!==job.attempts)return;
  if(!eligible(job)){
   await mutate(()=>{const row=db.prepare('SELECT * FROM agent_reply_jobs WHERE id=?').get(id);if(row?.status==='generating'&&row.attempts===job.attempts)setStatus(row,'canceled','owner_or_profile_changed');});return;
  }
  // Legacy Laura source IDs remain unchanged. Other targets use a namespace
  // impossible for human message IDs (which always begin with a role).
  const source=job.source.startsWith('#')?job.source.slice(job.source.indexOf(':')+1):job.source;
  const message=db.prepare('SELECT * FROM messages WHERE id=?').get(source),profile=profiles.get(job.account),role=roleOf(job);
  const controller=new AbortController();controllers.set(id,controller);
  const canGenerate=()=>{const row=db.prepare('SELECT * FROM agent_reply_jobs WHERE id=?').get(id);return !closed&&row?.status==='generating'&&row.attempts===job.attempts&&eligible(row);};
  let reply;try{reply=await llm.reply(role,message.body,job.requester,job.scene,{channel:job.channel,strict:true,signal:controller.signal,canGenerate,profile:scopedAgentProfile(profile,job.channel,job.requester,role)});}finally{controllers.delete(id);}
  if(closed)return;
  await mutate(()=>{
   const current=db.prepare('SELECT * FROM agent_reply_jobs WHERE id=?').get(id);if(current?.status!=='generating'||current.attempts!==job.attempts)return;
   if(!eligible(job)){setStatus(job,'canceled','owner_or_profile_changed');return;}
   if(!reply){const state=llm.status(),reason=state.reason==='account_arrearage'?'account_arrearage':state.reason==='upstream_429'?'provider_rate_limit':state.status;setStatus(job,'failed',reason==='ready'?'empty_reply':reason);return;}
   const response=store.message(role,job.channel==='dm'?job.requester:null,job.scene,reply,'agent:'+digest(job.source),true,job.channel);
   setStatus(job,'sent');publish(response);
  });
 }
 function pump(){
  if(closed)return;
  let next=Infinity;
  for(const row of db.prepare("SELECT * FROM agent_reply_jobs WHERE status IN ('queued','generating') ORDER BY at LIMIT 64").all()){
   if(active.has(row.id))continue;
   const due=Math.max(row.status==='generating'?row.lease_until:0,retryAt.get(row.id)??0);
   if(due>Date.now()){next=Math.min(next,due);continue;}
   if(active.size>=2)continue;
   const task=run(row.id).catch(()=>{if(!closed){retryAt.set(row.id,Date.now()+5000);console.error('agent reply persistence failed; retained job for recovery');}}).finally(()=>{active.delete(row.id);pump();});
   active.set(row.id,task);backgroundTask(task);
  }
  if(next<Infinity&&(!retryTimer||next<retryDue)){
   clearTimeout(retryTimer);retryResolve?.();retryDue=next;
   const waiting=new Promise(resolve=>{retryResolve=resolve;retryTimer=setTimeout(()=>{retryTimer=null;retryDue=Infinity;retryResolve=null;resolve();pump();},Math.max(1,next-Date.now()));retryTimer.unref?.();});
   backgroundTask(waiting);
  }
 }
 return{
  cancel(account){
   for(const row of db.prepare("SELECT * FROM agent_reply_jobs WHERE account=? AND status IN ('queued','generating')").all(account)){
    setStatus(row,'canceled','owner_or_profile_changed');retryAt.delete(row.id);controllers.get(row.id)?.abort();
   }
  },
  enqueue(message){
   if(message.npc)return[];const channel=channelOf(message);
   const targets=[...new Set(channel==='dm'?[message.recipient]:(message.mentions??[]))].filter(role=>role&&role!==message.sender);
   return targets.flatMap(role=>{
   const owner=store.byRole(role);if(!owner)return[];
   const profile=profiles.get(owner.id),base={role,sender:role,recipient:channel==='dm'?message.sender:null,channel,scene:message.scene,at:Date.now()};
   const id=role+':'+message.id,existing=db.prepare('SELECT * FROM agent_reply_jobs WHERE id=?').get(id);if(existing)return[view(existing)];
   if(humanLive(owner.id))return[{...base,status:'human'}];
   if(!profile?.confirmed||!profile.enabled)return[{...base,status:'disabled'}];
   if(!canDrive(owner.id))return[{...base,status:'waiting'}];
   const counts=db.prepare("SELECT COUNT(*) total,SUM(account=?) owner FROM agent_reply_jobs WHERE status IN ('queued','generating')").get(owner.id);
   const full=counts.total>=64||counts.owner>=8,source=role==='laura'?message.id:'#'+role+':'+message.id;
   db.prepare("INSERT OR IGNORE INTO agent_reply_jobs(id,source,requester,account,channel,scene,profile_revision,status,reason,at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(id,source,message.sender,owner.id,channel,message.scene,profile.revision,full?'failed':'queued',full?'queue_full':'',Date.now());
   return[view(db.prepare('SELECT * FROM agent_reply_jobs WHERE id=?').get(id))];
   });
  },pump,
  history(role,peer,scene,channel){
   const scope=channel==='dm'?' AND ((a.role=? AND j.requester=?) OR (a.role=? AND j.requester=?))':channel==='lobby'?'':' AND j.scene=?';
   const args=channel==='dm'?[role,peer,peer,role]:channel==='lobby'?[]:[scene];
   return db.prepare('SELECT j.* FROM agent_reply_jobs j JOIN accounts a ON a.id=j.account WHERE j.channel=?'+scope+' ORDER BY j.at DESC LIMIT 20').all(channel,...args).map(view).reverse();
  },
  async drain(){pump();while(active.size)await Promise.all([...active.values()]);},
  close(){closed=true;for(const controller of controllers.values())controller.abort();clearTimeout(retryTimer);retryTimer=null;retryResolve?.();retryResolve=null;},
 };
}
