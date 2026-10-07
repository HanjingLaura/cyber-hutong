import rooms from '../shared/rooms.json' with {type:'json'};
import geometry from '../shared/interactions.json' with {type:'json'};
import desks from '../shared/workstations.json' with {type:'json'};
import {habits} from './personas.mjs';
import {meetPlaces} from './life.mjs';
export const activityPause=(kind='rest')=>(kind==='work'?30*60000:10*60000)+Math.random()*(kind==='work'?60*60000:15*60000);

export function walkable(scene,x,y){
 const seats=Object.values(geometry[scene].seats);
 if(scene==='hutong'||scene==='hawaii')return (x>=69&&x<=603&&y>=166&&y<=221)||(x>=586&&x<=608&&y>=130&&y<=260);
 if(scene==='rest')return x>=52&&x<=590&&y>=140&&y<=278&&!['200','360','520'].some(cx=>((x-Number(cx))/44)**2+((y-267)/24.2)**2<1)&&!seats.some(s=>Math.abs(x-s.at[0])<19&&y>s.at[1]-14&&y<s.at[1]+3);
 if(scene==='noodle')return x>=38&&x<=602&&y>=174&&y<=346&&![213,439].some(cx=>Math.abs(x-cx)<74&&y>257&&y<292)&&!seats.some(s=>Math.abs(x-s.at[0])<14&&Math.abs(y-s.at[1])<10);
 if(scene==='pop')return x>=55&&x<=585&&y>=155&&y<=338&&!(x>240&&x<400&&y>171&&y<283);
 if(scene==='concert')return x>=55&&x<=585&&y>=159&&y<=349&&!seats.some(s=>Math.abs(x-s.at[0])<18&&y>s.at[1]-14&&y<s.at[1]+13);
 if(scene==='gym'){const inset=32+(350-y)*.09;return x>=inset&&x<=640-inset&&y>=90&&y<=338&&![225,320,415].some(cx=>Math.abs(x-cx)<31&&y<143)&&!(x<90&&y<178)&&!(x>490&&y<185)&&!(x>74&&x<143&&y>140&&y<211)&&!(x<90&&y>218&&y<305)&&!(x>565&&y>210&&y<266);}
 return x>=55&&x<=585&&y>=192&&y<=338;
}
// Grid routing is constrained by furniture; do not interpolate straight through desks.
export function route(scene,from,to,occupied=[]){
 const step=6,key=(x,y)=>`${x},${y}`,snap=([x,y])=>[Math.round(x/step)*step,Math.round(y/step)*step];
 const nearest=p=>{const [x,y]=snap(p);for(let r=0;r<8;r++)for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++)if(walkable(scene,x+dx*step,y+dy*step))return[x+dx*step,y+dy*step];return null;};
 const a=nearest(from),b=nearest(to);if(!a||!b)return[];const queue=[a],seen=new Map([[key(...a),null]]);let target=null;
 for(let i=0;i<queue.length&&i<7000;i++){const p=queue[i];if(p[0]===b[0]&&p[1]===b[1]){target=p;break;}for(const [dx,dy]of [[6,0],[-6,0],[0,6],[0,-6]]){const n=[p[0]+dx,p[1]+dy],k=key(...n);if(!seen.has(k)&&walkable(scene,...n)&&!occupied.some(o=>Math.hypot(o.x-n[0],o.y-n[1])<19&&Math.hypot(o.x-n[0],o.y-n[1])<=Math.hypot(o.x-p[0],o.y-p[1]))){seen.set(k,p);queue.push(n);}}}
 if(!target)return[];const path=[];for(let p=target;p;p=seen.get(key(...p)))path.unshift(p);path.shift();if(walkable(scene,...to))path.push(to);return path;
}
export function createAutonomy(store,life,players,leases=new Map(),seenLive=()=>false){
 const doubles=new Map();let nextRefresh=0,coffeeOwner=null,director=null;
 const save=p=>life.savePosition(p);
 const releaseSeat=p=>{if(p.seat){const seat=geometry[p.scene].seats[p.seat];if(seat)[p.x,p.y]=seat.approach;p.seat=null;}const old=geometry[p.scene].activities[p.activity]?.find(a=>Math.hypot(p.x-a.at[0],p.y-a.at[1])<8);if(old)[p.x,p.y]=old.approach;for(const [id,l]of leases)if(l.account===p.id)leases.delete(id);p.activity='walk';};
 const place=(account)=>{const old=life.position(account.id),role=account.role,seat=geometry.hutong.seats[desks.hutong[role]];
  const p={id:account.id,role,scene:'hutong',x:seat.approach[0],y:seat.approach[1],facing:0,moving:false,seat:null,activity:'walk',...old};releaseSeat(p);return{...p,next:Date.now()+10000+Math.random()*20000,path:[],task:null};};
 const get=id=>doubles.get(id);
 const reclaim=id=>{director?.cancelFor(id);const p=doubles.get(id);if(p){releaseSeat(p);save(p);doubles.delete(id);if(coffeeOwner===id)coffeeOwner=null;}return p;};
 const all=()=>[...players.values(),...doubles.values()];
 const onlinePeople=()=>[...players.values()].filter(p=>!p.disconnectedAt);
 const onlineCount=()=>onlinePeople().length;
 const onlineScenes=()=>[...new Set(onlinePeople().map(p=>p.scene))];
 function deliveryCandidate(p,now){const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hourCycle:'h23'}).format(new Date(now))),day=Math.floor((now+28800000)/86400000)*86400000-28800000;return p.role==='kay'&&hour>=6&&hour<12&&store.byId(p.id).hand==='咖啡'&&!store.db.prepare("SELECT seq FROM experiences WHERE account=? AND kind='delivery' AND at>=?").get(p.id,day)&&all().find(o=>o.role==='sid');}
 function plan(p,now){
  releaseSeat(p);const meeting=life.meeting(p.id),profile=JSON.parse(store.byId(p.id).profile),fact=profile.confirmed?profile.habits:habits[p.role];
  const favorites=/米线/.test(fact)?['noodle']:/健身/.test(fact)?['gym']:/演唱会/.test(fact)?['concert']:/POP|下楼/.test(fact)?['pop','rest']:['rest'];
  const roll=Math.random(),pair=p.role==='amber'?'cora':p.role==='cora'?'amber':p.role==='laura'?'amber':null,friend=all().find(o=>o.role===pair);
  const occupied=onlineScenes();
  const meetPlace=meeting&&meetPlaces[meeting.item]?meeting.item:'rest';
  // When humans are online, prefer their rooms so offline doubles stay visible rather than vanishing into empty scenes.
  let destination=meeting?meetPlace:roll<.45?'hutong':roll<.65?'rest':roll<.8?p.scene:friend&&roll>.95?friend.scene:favorites[Math.floor(Math.random()*favorites.length)];
  if(!meeting&&occupied.length&&roll>=.35&&roll<.8)destination=occupied[Math.floor(Math.random()*occupied.length)];
  const recipient=deliveryCandidate(p,now);
  const task={scene:recipient&&!meeting?recipient.scene:destination,kind:meeting?'meet':roll>=.65&&roll<.8?'walk':destination==='hutong'?'work':destination==='rest'?'coffee':destination==='noodle'?'noodle':destination==='gym'?'exercise':'visit',phase:'exit'};
  if(recipient&&!meeting){task.kind='deliver';task.peer=recipient.role;}
  if(task.kind==='exercise'){const device=[0,1,2].find(i=>!leases.has('gym:run-'+i));if(device===undefined){task.kind='walk';}else task.device='run-'+device;}
  if(p.scene===task.scene)task.phase='arrive';p.task=task;p.path=route(p.scene,[p.x,p.y],task.phase==='exit'?rooms[p.scene].exit:target(p,task));if(!p.path.length&&Math.hypot(p.x-target(p,task)[0],p.y-target(p,task)[1])>12){p.task=null;p.next=now+60000;}
 }
 function target(p,task){if(task.storyId)return task.point;if(task.kind==='deliver'){const peer=all().find(o=>o.role===task.peer);if(peer?.seat)return geometry[peer.scene].seats[peer.seat].approach;if(peer){const candidates=[[peer.x-24,peer.y],[peer.x+24,peer.y],[peer.x,peer.y-24],[peer.x,peer.y+24]];return candidates.find(([x,y])=>walkable(peer.scene,x,y))??rooms[task.scene].exit;}return rooms[task.scene].exit;}if(task.kind==='walk'){task.point??=(p.scene==='hutong'||p.scene==='hawaii'?[100+Math.random()*450,194]:[150+Math.random()*380,190]);return task.point;}if(task.kind==='exercise')return geometry.gym.devices[task.device];if(task.kind==='work')return geometry.hutong.seats[desks.hutong[p.role]].approach;
  if(task.kind==='coffee')return[314,156];if(task.kind==='meet')return({rest:[320,190],arcade:[320,220],dance:[320,280],gym:[320,230]})[task.scene]||[320,190];if(task.kind==='noodle')return[280,190];
  return task.scene==='pop'?[438,162]:task.scene==='gym'?[320,230]:[320,320];}
 function arrived(p,now){const task=p.task;if(task.phase==='exit'){p.scene=task.scene;[p.x,p.y]=rooms[p.scene].exit;task.phase='arrive';p.path=route(p.scene,[p.x,p.y],target(p,task));if(!p.path.length){p.task=null;p.next=now+60000;}return;}
  if(task.storyId){director?.arrived(p,task,now);return;}
  if(task.kind==='work'){const seatId=desks.hutong[p.role],seat=geometry.hutong.seats[seatId];if(!all().some(o=>o.id!==p.id&&o.scene===p.scene&&o.seat===seatId)){[p.x,p.y]=seat.at;p.seat=seatId;p.facing=seatId[0]==='R'?2:0;p.activity='working';}}
  else if(task.kind==='coffee'){p.activity='walk';p.task={...task,phase:'brew',until:now+3000};return;}
  else if(task.kind==='deliver'){const peer=all().find(o=>o.role===task.peer);if(peer?.scene===p.scene&&Math.hypot(peer.x-p.x,peer.y-p.y)<55){life.send(p.id,peer.role,'gift','morning-coffee:'+Math.floor((now+28800000)/86400000),p.scene,store.byId(p.id).revision);life.record(p.id,'delivery','给 Sid 带了咖啡，正在等待他收下。',p.scene,now);}}
  else if(task.kind==='exercise'){const anchor=geometry.gym.activities.run.find(a=>a.device===task.device);if(!leases.has('gym:'+task.device)){leases.set('gym:'+task.device,{account:p.id,role:p.role,at:now});[p.x,p.y]=anchor.at;p.facing=2;p.activity='run';}}
  p.task=null;p.next=now+activityPause(task.kind);save(p);
 }
 function tick(now=Date.now(),delta=100){let changed=false;
  // Hard rule: a user who is online (any tab, even mid-reconnect) is never driven by autonomy/LLM.
  for(const id of [...doubles.keys()])if(players.has(id)||seenLive(id)){/* drop without saving: the human's pose is newer */director?.cancelFor(id);doubles.delete(id);if(coffeeOwner===id)coffeeOwner=null;for(const [lid,l]of leases)if(l.account===id)leases.delete(lid);changed=true;}
  if(now>=nextRefresh){nextRefresh=now+5000;for(const a of store.db.prepare('SELECT * FROM accounts WHERE role IS NOT NULL').all()){if(players.has(a.id)||seenLive(a.id)){if(doubles.has(a.id))doubles.delete(a.id);}else if(!doubles.has(a.id)){doubles.set(a.id,place(a));changed=true;}}}
  if(director?.tick(now))changed=true;
  life.expire(now);
  for(const p of doubles.values()){
   const offer=life.offers(p.id).find(o=>o.recipient===p.id&&o.status==='pending');if(offer){try{life.respond(p.id,offer.id,offer.kind==='gift'&&store.byId(p.id).hand?'reject':'accept');if(!p.task?.storyId){p.task=null;p.path=[];p.next=now;}changed=true;}catch{}}
   if(p.task?.kind==='meet'&&!life.meeting(p.id)){p.task=null;p.path=[];p.next=now+30000;}
   for(const l of leases.values())if(l.account===p.id)l.at=now;
   if(p.task?.phase==='brew'){if(coffeeOwner&&coffeeOwner!==p.id){p.task=null;p.next=now+30000;continue;}coffeeOwner=p.id;if(now<p.task.until)continue;
    if(!store.byId(p.id).hand){store.hand(p.id,'咖啡',store.byId(p.id).revision);}coffeeOwner=null;p.task=null;p.next=now+activityPause();save(p);changed=true;continue;
   }
   if(!p.task&&now>=p.next){if(life.offers(p.id).some(o=>o.kind==='gift'&&o.sender===p.id)){p.next=now+5000;continue;}if(store.byId(p.id).hand==='咖啡'&&!deliveryCandidate(p,now)){life.inventory(p.id,{action:'consume',revision:store.byId(p.id).revision,requestId:'npc:'+now},p.scene,{silent:true});}plan(p,now);changed=true;}
   if(p.path.length){const [x,y]=p.path[0],dx=x-p.x,dy=y-p.y,d=Math.hypot(dx,dy),step=72*Math.min(delta,250)/1000;
    const nx=d<=step?x:p.x+dx/d*step,ny=d<=step?y:p.y+dy/d*step;
    if(all().some(o=>o.id!==p.id&&o.scene===p.scene&&Math.hypot(o.x-nx,o.y-ny)<18&&Math.hypot(o.x-nx,o.y-ny)<=Math.hypot(o.x-p.x,o.y-p.y))){p.moving=false;p.blockedAt??=now;if(now-p.blockedAt>2000){const others=all().filter(o=>o.id!==p.id&&o.scene===p.scene),end=p.path.at(-1);const alternate=route(p.scene,[p.x,p.y],end,others);if(alternate.length)p.path=alternate;p.blockedAt=now;}continue;}
    delete p.blockedAt;
    p.x=nx;p.y=ny;p.facing=Math.abs(dx)>Math.abs(dy)?dx>0?1:3:dy>0?0:2;p.moving=true;if(d<=step)p.path.shift();changed=true;
   }else if(p.task&&!['brew','hold'].includes(p.task.phase)){p.moving=false;arrived(p,now);changed=true;}
   if(p.moving&&now-(p.savedAt||0)>5000){save(p);p.savedAt=now;}
  }
  const people=all();
  life.finishMeetings(people);return changed;
 }
 return{isDriven:id=>doubles.has(id)&&!players.has(id)&&!seenLive(id),tick,get,reclaim,doubles,all,onlineCount,onlineScenes,setDirector(value){director=value;},travel(p,scene,point,storyId,now){releaseSeat(p);p.task={kind:'story',storyId,scene,point,phase:p.scene===scene?'arrive':'exit'};p.path=route(p.scene,[p.x,p.y],p.task.phase==='exit'?rooms[p.scene].exit:point);p.next=now+180000;},holdStory(p,storyId){releaseSeat(p);p.path=[];p.task={kind:'story',storyId,phase:'hold'};p.moving=false;},releaseStory(p,now){p.task=null;p.path=[];p.moving=false;p.next=now+activityPause(p.activity==='working'?'work':'rest');save(p);},saveAll(){for(const p of all())save(p);}};
}
