import {randomUUID} from 'node:crypto';
import geometry from '../shared/interactions.json' with {type:'json'};
import {habits} from './personas.mjs';

// Look-back / memorable-activity clock per mvp-spec §6.3.
// N = online humans with an active control connection (0–8).
// T(N) = 900 / (1 + 0.5 * N) seconds, ±20% jitter. N=8 stops autonomous AI events.
export function storyInterval(onlineCount=0,random=Math.random){
  const n=Math.max(0,Math.min(8,Number(onlineCount)||0));
  if(n>=8)return null;
  return Math.round((900000/(1+0.5*n))*(0.8+random()*0.4));
}

// Solo share of the opportunity pool: quieter empty world, slightly more shared stories when people are watching.
export function soloBias(onlineCount=0){
  const n=Math.max(0,Math.min(7,Number(onlineCount)||0));
  return Math.max(0.35,0.6-n*0.03);
}

export function createDirector(store,life,autonomy,world,llm,{publish=()=>{},now=Date.now}={}){
 const db=store.db;
 db.exec(`CREATE TABLE IF NOT EXISTS activity_clock(id INTEGER PRIMARY KEY CHECK(id=1),next_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS activities(id TEXT PRIMARY KEY,kind TEXT NOT NULL,status TEXT NOT NULL,state TEXT NOT NULL,started INTEGER NOT NULL,ended INTEGER);
 CREATE INDEX IF NOT EXISTS activities_time ON activities(started);`);
 db.prepare('INSERT OR IGNORE INTO activity_clock VALUES(1,?)').run(now()+(storyInterval(0)??900000));
 // A stopped process cannot truthfully finish an old animation or handover.
 for(const row of db.prepare("SELECT * FROM activities WHERE status='running'").all()){
  const state=JSON.parse(row.state);if(state.offer){const o=db.prepare('SELECT * FROM offers WHERE id=?').get(state.offer);if(o&&['pending','accepted'].includes(o.status))life.respond(o.sender,o.id,'cancel');}
  db.prepare("UPDATE activities SET status='interrupted',ended=? WHERE id=?").run(now(),row.id);
 }
 let active=null,pending=false,closed=false;
 const save=()=>{if(active)db.prepare('UPDATE activities SET state=? WHERE id=?').run(JSON.stringify(active),active.id);};
 const onlineCount=()=>typeof autonomy.onlineCount==='function'?autonomy.onlineCount():Math.max(0,autonomy.all().length-autonomy.doubles.size);
 const onlineScenes=()=>typeof autonomy.onlineScenes==='function'?autonomy.onlineScenes():[];
 const schedule=(at,count=onlineCount())=>{
  const gap=storyInterval(count);
  db.prepare('UPDATE activity_clock SET next_at=? WHERE id=1').run(at+(gap??60000));
 };
 const free=p=>p&&!p.task?.storyId&&!life.offers(p.id).length&&!p.moving;
 const canStow=p=>!store.byId(p.id).hand||life.bag(p.id).some(s=>s===null||s.name===store.byId(p.id).hand&&s.count<5&&JSON.stringify(s.seasoning)===store.byId(p.id).seasoning);
 function candidates(at){
  const actors=[...autonomy.doubles.values()].filter(p=>free(p)&&canStow(p)),history=db.prepare('SELECT kind,state,started FROM activities WHERE started>?').all(at-86400000);
  const counts=new Map();for(const entry of history)for(const id of JSON.parse(entry.state).people)counts.set(id,(counts.get(id)||0)+1);
  const occupied=new Set(onlineScenes());
  const list=[];
  for(const p of actors){const profile=JSON.parse(store.byId(p.id).profile),facts=profile.confirmed?profile.habits:habits[p.role];
   const near=occupied.size?(occupied.has(p.scene)?1.6:0.85):1;
   list.push({id:'gacha:'+p.id,kind:'gacha',people:[p.id],roles:[p.role],weight:near*(/POP|盲盒/.test(facts)?4:1)/(1+(counts.get(p.id)||0))});
   for(const q of actors){if(q.id===p.id)continue;const pair=[p.id,q.id].sort();
    if(history.some(h=>h.started>at-2*3600000&&JSON.parse(h.state).people.length===2&&pair.every(id=>JSON.parse(h.state).people.includes(id))))continue;
    const affinity=(p.role==='amber'&&q.role==='cora'||p.role==='cora'&&q.role==='amber'||p.role==='kay'&&q.role==='sid')?3:1;
    const socialNear=occupied.size?(occupied.has(p.scene)||occupied.has(q.scene)?1.7:0.8):1;
    for(const kind of ['meet','gift'])list.push({id:kind+':'+p.id+':'+q.id,kind,people:[p.id,q.id],roles:[p.role,q.role],weight:socialNear*affinity/(1+(counts.get(p.id)||0)+(counts.get(q.id)||0))});
   }
  }
  return list;
 }
 const weighted=list=>{let pick=Math.random()*list.reduce((sum,c)=>sum+c.weight,0);return list.find(c=>(pick-=c.weight)<0)??list.at(-1);};
 function prepareHand(p,at){const a=store.byId(p.id);if(a.hand)life.inventory(p.id,{action:'stow',revision:a.revision,requestId:'story-pack:'+active.id+':'+p.id},p.scene);}
 function finish(status,at){
  if(!active)return;const ended=active;db.prepare('UPDATE activities SET status=?,state=?,ended=? WHERE id=?').run(status,JSON.stringify(ended),at,ended.id);
  for(const id of ended.people){const p=autonomy.get(id);if(p?.task?.storyId===ended.id)autonomy.releaseStory(p,at);}
  active=null;
  if(status==='completed'&&llm.configured){const p=autonomy.get(ended.people[0]);if(p){const scene=p.scene,roles=ended.people.map(id=>store.byId(id).role);void llm.dialogue(p.role,roles,ended.result??ended.kind,scene).then(text=>{if(closed||!text||!autonomy.get(p.id)||autonomy.get(p.id).scene!==scene)return;publish(store.message(p.role,null,scene,text,'story:'+ended.id,true));}).catch(()=>{});}}
 }
 function start(candidate,at){
  if(active||closed||onlineCount()>=8||candidate.people.some(id=>!free(autonomy.get(id))||!canStow(autonomy.get(id))))return false;
  active={id:randomUUID(),kind:candidate.kind,people:candidate.people,stage:'travel',started:at,deadline:at+3*60000};
  db.prepare("INSERT INTO activities VALUES(?,?,'running',?,?,NULL)").run(active.id,active.kind,JSON.stringify(active),at);schedule(at);
  const [p,q]=active.people.map(id=>autonomy.get(id));
  try{
   prepareHand(p,at);
   if(active.kind==='gacha')autonomy.travel(p,'pop',[438,162],active.id,at);
   else if(active.kind==='meet'){
    const o=life.send(p.id,q.role,'meet','story:'+active.id,p.scene);active.offer=o.id;
    autonomy.holdStory(p,active.id);autonomy.holdStory(q,active.id);save();
   }else{
    prepareHand(q,at);autonomy.holdStory(q,active.id);autonomy.travel(p,'rest',[314,156],active.id,at);
   }
  }catch{cancel('failed',at);return false;}
  return true;
 }
 function cancel(status,at){if(!active)return;if(active.offer){const o=db.prepare('SELECT * FROM offers WHERE id=?').get(active.offer);if(o&&['pending','accepted'].includes(o.status)){try{life.respond(o.sender,o.id,'cancel');}catch{}}}finish(status,at);}
 function arrived(p,task,at){
  if(!active||task.storyId!==active.id){autonomy.releaseStory(p,at);return;}
  autonomy.holdStory(p,active.id);
  if(task.restSeat){const seat=geometry.rest.seats[task.restSeat];[p.x,p.y]=seat.at;p.seat=task.restSeat;p.facing=0;p.activity='sit';if(active.people.every(id=>autonomy.get(id)?.seat)){active.until=at+6000;save();}return;}
  try{
   if(active.kind==='gacha'){
    const result=world.interact(store.publicAccount(store.byId(p.id)),p,{object:'pop:classic',action:'gacha',revision:store.byId(p.id).revision,requestId:'story:'+active.id},new Map(autonomy.all().map(p=>[p.id,p])),{skipRecord:true});
    active.result=`${p.role} 在扭蛋机抽到了${result.self.hand}。`;life.recordGroup(active.people,'gacha',active.result,p.scene,at,active.id);finish('completed',at);
   }else if(active.kind==='gift'&&active.stage==='travel'){active.stage='brew';active.until=at+3000;save();}
   else if(active.kind==='gift'&&active.stage==='deliver'){
    const q=autonomy.get(active.people[1]);if(!q||q.scene!==p.scene||Math.hypot(q.x-p.x,q.y-p.y)>55){cancel('failed',at);return;}
    const o=life.send(p.id,q.role,'gift','story:'+active.id,p.scene,store.byId(p.id).revision);active.offer=o.id;active.stage='response';save();
   }
  }catch{cancel('failed',at);}
 }
 function tick(at){
  if(closed)return false;
  if(active){
   if(active.people.some(id=>!autonomy.get(id))){cancel('interrupted',at);return true;}
   if(at>active.deadline){cancel('expired',at);return true;}
   if(active.kind==='gift'&&active.stage==='brew'&&at>=active.until){
    const p=autonomy.get(active.people[0]),q=autonomy.get(active.people[1]);
    try{world.interact(store.publicAccount(store.byId(p.id)),p,{object:'rest:coffee',action:'supply',item:'咖啡',revision:store.byId(p.id).revision,requestId:'story-coffee:'+active.id},new Map(),{skipRecord:true});
     active.stage='deliver';active.deadline=at+3*60000;const target=q.seat?geometry[q.scene].seats[q.seat].approach:[q.x+24,q.y];autonomy.travel(p,q.scene,target,active.id,at);save();return true;
    }catch{cancel('failed',at);return true;}
   }
   if(active.offer){const o=db.prepare('SELECT * FROM offers WHERE id=?').get(active.offer);
    if(o?.status==='accepted'&&active.kind==='meet'&&active.stage==='travel'){
     active.stage='meeting';const [p,q]=active.people.map(id=>autonomy.get(id));autonomy.travel(p,'rest',[300,190],active.id,at);autonomy.travel(q,'rest',[340,190],active.id,at);save();return true;
    }
    if(o?.status==='completed'){
     if(active.kind==='meet'&&active.stage!=='resting'){
      const available=Object.entries(geometry.rest.seats).filter(([seat])=>!autonomy.all().some(p=>p.scene==='rest'&&p.seat===seat));
      if(available.length<2){active.result='在休息室碰面了';finish('completed',at);return true;}
      const seats=available.slice(0,2);active.stage='resting';active.until=null;
      active.people.forEach((id,i)=>{const p=autonomy.get(id);autonomy.travel(p,'rest',seats[i][1].approach,active.id,at);p.task.restSeat=seats[i][0];});save();return true;
     }
     if(active.kind==='gift'){active.result=`${store.byId(o.recipient).role} 收下了 ${store.byId(o.sender).role} 的${o.item}`;finish('completed',at);return true;}
    }else if(o&&['rejected','cancelled','expired'].includes(o.status)){finish(o.status,at);return true;}
   }
   if(active?.stage==='resting'&&active.until!==null&&at>=active.until&&active.people.every(id=>autonomy.get(id)?.seat)){
    active.result=`${active.people.map(id=>store.byId(id).role).join(' 和 ')} 在休息室一起坐着休息。`;life.recordGroup(active.people,'rest',active.result,'rest',at,active.id);finish('completed',at);return true;
   }
   return false;
  }
  if(!pending&&at>=db.prepare('SELECT next_at FROM activity_clock WHERE id=1').get().next_at){
   const count=onlineCount();
   // All eight humans online: no offline doubles to drive; park the clock and skip look-back stories.
   if(count>=8){schedule(at,count);return false;}
   const list=candidates(at);if(!list.length){schedule(at,count);return false;}
   const bias=soloBias(count),solo=list.filter(c=>c.kind==='gacha'),group=list.filter(c=>c.kind!=='gacha');
   const pool=Math.random()<bias||!group.length?solo:group,fallback=weighted(pool.length?pool:list);
   if(llm.configured){pending=true;const choices=[fallback,...list.filter(c=>c.id!==fallback.id).sort((a,b)=>b.weight-a.weight).slice(0,7)];void llm.choose(choices).then(selected=>{if(!closed){if(!start(selected??fallback,now()))schedule(now());}}).catch(()=>{if(!closed)schedule(now());}).finally(()=>{pending=false;});}
   else start(fallback,at);
   return true;
  }
  return false;
 }
 return{tick,arrived,candidates,start,storyInterval,soloBias,cancelFor(id){if(active?.people.includes(id))cancel('interrupted',now());},status(){return{active:active?{...active}:null,nextAt:db.prepare('SELECT next_at FROM activity_clock WHERE id=1').get().next_at,pending,online:onlineCount()};},close(){closed=true;}};
}
