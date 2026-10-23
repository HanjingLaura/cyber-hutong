// Isolated HTTP + SSE + real local PartyKit + file-backed SQLite acceptance.
// HUTONG_INTEGRATION_SECONDS defaults to the agreed 60 minutes.
import assert from 'node:assert/strict';
import {mkdir,writeFile,open} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer as netServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {monitorEventLoopDelay,performance} from 'node:perf_hooks';
import {createMvpServer} from '../server/app.mjs';
import {openStore} from '../server/store.mjs';
import geometry from '../shared/interactions.json' with {type:'json'};

const seconds=Number(process.env.HUTONG_INTEGRATION_SECONDS??3600);
assert.ok(Number.isFinite(seconds)&&seconds>0);
const directory=resolve('output/integration-'+Date.now());await mkdir(directory,{recursive:true});
const secret=randomUUID();process.env.PARTY_AUTH_SECRET=secret;process.env.HUTONG_INVITE='isolated-soak';
const port=await new Promise(r=>{const s=netServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const log=await open(directory+'/partykit.log','w');
const worker=spawn(process.execPath,['node_modules/partykit/dist/bin.mjs','dev','party/hutong.ts','--port',String(port),'--var','PARTY_AUTH_SECRET='+secret,'--persist',directory+'/party','--no-hotkeys'],{stdio:['ignore',log.fd,log.fd],windowsHide:true});
const dbPath=directory+'/game.sqlite',app=createMvpServer({dbPath,llmOptions:{key:''}});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${app.server.address().port}/api/`,accounts=[],errors=[],latency=[],samples=[],counts={requests:0,failed:0,world:0,pose:0,party:0,chats:0,interactions:0,transitions:0,reconnects:0,rides:0,duplicates:0};
const loop=monitorEventLoopDelay({resolution:20});let stopped=false,round=0,requestSequence=0;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const percentile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))]:0;
async function api(account,path,input){
 const begin=performance.now();counts.requests++;
 try{const res=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{cookie:account?.cookie??'','Content-Type':'application/json'},body:input===undefined?undefined:JSON.stringify(input),signal:AbortSignal.timeout(15000)});const data=await res.json();assert.equal(res.status,200,path+': '+res.status+' '+(data.error??''));latency.push(performance.now()-begin);return{data,cookie:res.headers.get('set-cookie')?.split(';')[0]};}
 catch(error){counts.failed++;throw error;}
}
async function stream(account,tab){
 const abort=new AbortController(),res=await fetch(base+'events?client='+account.index+'-'+tab,{headers:{cookie:account.cookie},signal:abort.signal});assert.equal(res.status,200);
 const channel={abort};account.channels[tab]=channel;
 channel.reading=(async()=>{const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='';try{while(!stopped){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);const event=/^event: ([\w-]+)/m.exec(frame)?.[1],raw=/^data: (.+)$/m.exec(frame)?.[1];if(!raw)continue;const data=JSON.parse(raw);if(data.self)assert.equal(data.self.id,account.user.id,'private state crossed accounts');if(event==='world')counts.world++;if(event==='pose'){counts.pose++;assert.ok(!('bag' in data));}if(event==='message'&&data.recipient)assert.ok([data.sender,data.recipient].includes(account.role),'private chat leaked');}}}catch(error){if(!abort.signal.aborted&&!stopped)errors.push(error.message);}})();
}
async function socket(account){
 account.socket?.close();const ticket=(await api(account,'party-ticket',{client:account.index+'-0'})).data;
 const ws=new WebSocket(`ws://127.0.0.1:${port}/parties/main/${ticket.room}?_pk=${account.index}-0`);account.socket=ws;
 await new Promise((yes,no)=>{const timer=setTimeout(()=>no(Error('PartyKit handshake timeout')),15000);ws.addEventListener('open',()=>ws.send(JSON.stringify({type:'hello',ticket:ticket.ticket,character:account.pose})));ws.addEventListener('message',event=>{try{const data=JSON.parse(String(event.data));if(data.type==='reject')throw Error('PartyKit rejected handshake');if(data.type==='state'){assert.equal(data.you.controller,true);clearTimeout(timer);yes();}if(data.type==='state'||data.type==='presence')counts.party++;}catch(error){clearTimeout(timer);no(error);if(!stopped)errors.push(error.message);}});ws.addEventListener('error',()=>{clearTimeout(timer);no(Error('PartyKit connection error'));},{once:true});});
}
async function presence(account,pose){
 account.pose={...account.pose,...pose};
 const result=await api(account,'presence',{...account.pose,hand:account.user.hand??null,client:account.index+'-0',revision:account.user.revision});
 account.user=result.data.self;account.pose={...result.data.player};
 if(account.socket?.readyState===WebSocket.OPEN)account.socket.send(JSON.stringify({type:'move',...account.pose}));
}
async function transition(account,target){const result=await api(account,'transition',{target,quick:true,client:account.index+'-0'});account.pose=result.data.player;account.user=result.data.self;counts.transitions++;}
async function walker(account,x,y){
 const d=Math.hypot(x-account.pose.x,y-account.pose.y);if(d<1)return;
 const step=Math.min(d,8);await presence(account,{x:account.pose.x+(x-account.pose.x)/d*step,y:account.pose.y+(y-account.pose.y)/d*step,seat:null,activity:'walk',moving:true});await wait(100);
}
async function traveler(account){
 await transition(account,'street');
 while(Math.hypot(account.pose.x-320,account.pose.y-310)>1&&!stopped)await walker(account,320,310);
 await api(account,'ride',{client:account.index+'-0',action:'join',slot:'driver'});
 for(let n=0;n<6;n++){await wait(120);const result=await api(account,'ride',{client:account.index+'-0',action:'drive',x:320+n*4,y:285,facing:1});counts.rides++;const seat=result.data.ride.seats.driver;account.pose={...account.pose,...seat,activity:'scooter'};}
 await api(account,'ride',{client:account.index+'-0',action:'leave'});account.pose={...app.players.get(account.user.id)};
 await transition(account,'google');await transition(account,'rest');
}
try{
 // CLI cold start may take a few seconds; do not contact a deployed Worker.
 const deadline=Date.now()+60000;while(true){try{await fetch(`http://127.0.0.1:${port}/`,{signal:AbortSignal.timeout(500)});break;}catch{if(worker.exitCode!==null||Date.now()>deadline)throw Error('local PartyKit startup failed; inspect isolated partykit.log');await wait(500);}}
 const roles=['suki','sid','jilly','laura','kay','franco','cora','amber'];
 for(const [index,role]of roles.entries()){
  const result=await api(null,'register',{username:'soak_'+role,password:'isolated-soak-password',role,invite:'isolated-soak'});
  const account={index,role,user:result.data.user,cookie:result.cookie,channels:[]};accounts.push(account);
  for(let tab=0;tab<4;tab++)await stream(account,tab);
  await api(account,'control',{client:index+'-0'});
  const point=index<6?geometry.rest.seats[index].approach:index===6?[180,190]:[554,184];
  const p=app.players.get(account.user.id);Object.assign(p,{scene:'rest',x:point[0],y:point[1],facing:0,moving:false,seat:null,activity:'walk',at:Date.now()-3000});
  account.origin={x:point[0],y:point[1]};account.pose={...p};await presence(account,account.pose);await socket(account);
 }
 console.log(JSON.stringify({started:true,directory,seconds,players:8,streams:32,realLocalPartyKit:true,persistentSQLite:true,realModel:false}));
 loop.enable();const started=performance.now();let nextSample=10000,nextChat=3000,nextInteraction=2000,nextReconnect=30000,nextTravel=15000,nextHeartbeat=0;
 while(performance.now()-started<seconds*1000){
  const elapsed=performance.now()-started;round++;
  if(elapsed>=nextHeartbeat){nextHeartbeat+=15000;await Promise.all(accounts.map(account=>api(account,'heartbeat',{client:account.index+'-0'})));}
  const results=await Promise.allSettled(accounts.map(async account=>{
   if(account.traveling)return;
   if(account.pose.seat){await presence(account,{...account.origin,seat:null,activity:'walk',moving:false});return;}
   await presence(account,{x:account.origin.x+round%2,y:account.origin.y,seat:null,activity:'walk',moving:true,facing:round%4});
  }));for(const r of results)if(r.status==='rejected')errors.push(r.reason.message);
  if(elapsed>nextInteraction){nextInteraction+=5000;
   for(const account of accounts.slice(0,6)){const at=geometry.rest.seats[account.index].at;await presence(account,{x:at[0],y:at[1],seat:String(account.index),activity:'sit',moving:false});counts.interactions++;}
   const account=accounts[6],requestId='toggle-'+requestSequence++,before=app.store.db.prepare("SELECT version FROM room_objects WHERE id='rest:fridge-door'").get()?.version??0;
   const input={object:'rest:fridge-door',action:'toggle',client:'6-0',revision:account.user.revision,requestId};await api(account,'object',input);await api(account,'object',input);counts.duplicates++;counts.interactions++;
   assert.equal(app.store.db.prepare("SELECT version FROM room_objects WHERE id='rest:fridge-door'").get().version,before+1,'lost response retry duplicated a mutation');
  }
  if(elapsed>nextChat){nextChat+=10000;await Promise.all(accounts.map(async(account,i)=>{await api(account,'chat',{channel:'lobby',text:'isolated load '+round,requestId:'lobby-'+round});await api(account,'chat',{channel:'dm',peer:accounts[(i+1)%8].role,text:'isolated private load '+round,requestId:'dm-'+round});counts.chats+=2;}));}
  if(elapsed>nextReconnect){nextReconnect+=30000;const account=accounts[round%7];account.channels[0].abort.abort();const deadline=Date.now()+5000;while([...app.streams].filter(s=>s.user===account.user.id).length>=4&&Date.now()<deadline)await wait(50);await stream(account,0);await api(account,'control',{client:account.index+'-1'});await api(account,'control',{client:account.index+'-0'});await socket(account);counts.reconnects++;}
  if(elapsed>nextTravel&&!accounts[7].traveling){nextTravel+=60000;const account=accounts[7];account.traveling=traveler(account).catch(error=>errors.push(error.message)).finally(()=>{account.traveling=null;});}
  if(elapsed>nextSample){nextSample+=10000;const sample={seconds:Math.round(elapsed/1000),rss:process.memoryUsage().rss,heap:process.memoryUsage().heapUsed,players:app.players.size,streams:app.streams.size,failures:counts.failed,errors:errors.length};samples.push(sample);await writeFile(directory+'/progress.json',JSON.stringify({...sample,counts},null,2));console.log(JSON.stringify(sample));}
  if(errors.length)throw Error(errors[0]);await wait(100);
 }
 await Promise.all(accounts.map(a=>a.traveling));
 for(const account of accounts)await api(account,'heartbeat',{client:account.index+'-0'});
 const duration=(performance.now()-started)/1000;
 // Reopen the file independently and verify durable inventory/chat state.
 const reopened=openStore(dbPath);assert.equal(reopened.db.prepare('SELECT COUNT(*) n FROM accounts').get().n,8);assert.ok(reopened.db.prepare('SELECT COUNT(*) n FROM messages').get().n>0);reopened.close();
 const report={passed:errors.length===0,durationSeconds:duration,directory,environment:'isolated local PartyKit + file SQLite',realModel:false,counts,errors,requestMs:{p95:percentile(latency,.95),p99:percentile(latency,.99),max:latency.reduce((max,value)=>Math.max(max,value),0)},eventLoopMs:{p99:loop.percentile(99)/1e6,max:loop.max/1e6},samples};
 await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,samples:report.samples.length}));
}catch(error){await writeFile(directory+'/verification.json',JSON.stringify({passed:false,counts,errors:[...errors,error.message],samples},null,2));throw error;}
finally{stopped=true;loop.disable();for(const a of accounts){for(const c of a.channels)c.abort.abort();a.socket?.close();}app.close();app.server.closeAllConnections();worker.kill();await log.close();}
