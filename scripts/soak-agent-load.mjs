// Deterministic model transport: validates scheduling under load, not real-model quality.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createMvpServer} from '../server/app.mjs';
const seconds=Number(process.env.HUTONG_AGENT_LOAD_SECONDS??180);assert.ok(Number.isFinite(seconds)&&seconds>0);
const directory='output/agent-load-'+Date.now();await mkdir(directory,{recursive:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));let inFlight=0,peak=0,calls=0;
process.env.HUTONG_INVITE='isolated-agent-load';
const app=createMvpServer({agentPersonaDirectory:null,dbPath:directory+'/game.sqlite',llmOptions:{key:'synthetic-only',dailyLimit:10000,dailyTokenLimit:100000000,fetchImpl:async(_url,input)=>{
 inFlight++;peak=Math.max(peak,inFlight);assert.ok(inFlight<=2);calls++;try{const context=JSON.parse(JSON.parse(input.body).messages[1].content);assert.ok(!JSON.stringify(context).includes('PRIVATE_SENTINEL'));await wait(100);return Response.json({choices:[{message:{content:JSON.stringify({text:'isolated reply from '+context.character?.role})}}]});}finally{inFlight--;}
}}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${app.server.address().port}/api/`,humans=[],channels=[],latency=[];let messages=0,failures=0;
async function api(account,path,input){const start=performance.now();const res=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{cookie:account?.cookie??'','Content-Type':'application/json'},body:input===undefined?undefined:JSON.stringify(input),signal:AbortSignal.timeout(10000)});latency.push(performance.now()-start);const data=await res.json();assert.equal(res.status,200,path+': '+res.status);return{data,cookie:res.headers.get('set-cookie')?.split(';')[0]};}
try{
 for(const role of ['laura','jilly']){const result=await api(null,'register',{username:'load_'+role,password:'isolated-password',role,invite:'isolated-agent-load'});app.agentProfiles.save(result.data.user.id,{source:'isolated fixture, not owner approval',voice:'brief',facts:[{text:'public fixture '+role,scope:'public'},{text:'PRIVATE_SENTINEL_'+role,scope:'private',peer:'sid'}],confirmed:true,enabled:true});app.presence.connect(result.data.user.id,'offline-fixture','fixture');app.store.db.prepare('UPDATE browser_presence SET at=?,closed_at=? WHERE account=?').run(Date.now()-360001,Date.now()-360001,result.data.user.id);}
 for(const [index,role]of ['suki','sid','kay','franco','cora','amber'].entries()){
  const result=await api(null,'register',{username:'load_'+role,password:'isolated-password',role,invite:'isolated-agent-load'}),account={...result,index,role,client:'load-'+index,user:result.data.user};humans.push(account);
  const abort=new AbortController(),stream=await fetch(base+'events?client='+account.client,{headers:{cookie:account.cookie},signal:abort.signal});assert.equal(stream.status,200);const reader=stream.body.getReader();channels.push({abort,reading:(async()=>{try{while(!(await reader.read()).done){}}catch(error){if(!abort.signal.aborted)throw error;}})()});
  Object.assign(app.players.get(account.user.id),{scene:'rest',x:90+index*75,y:240,at:Date.now()-3000,seat:null,activity:'walk'});
 }
 const start=Date.now();let round=0,nextChat=0,nextPulse=0;
 while(Date.now()-start<seconds*1000){
  round++;if(Date.now()-start>=nextPulse){nextPulse+=15000;await Promise.all(humans.map(a=>api(a,'heartbeat',{client:a.client})));}
  await Promise.all(humans.map(a=>api(a,'presence',{client:a.client,scene:'rest',x:90+a.index*75+round%2,y:240,hand:null,revision:0,facing:0,moving:true,seat:null,activity:'walk'})));
  if(Date.now()-start>=nextChat){nextChat+=2000;await Promise.all(humans.map(a=>api(a,'chat',{channel:'lobby',text:'isolated concurrent agents '+round,mentions:['laura','jilly'],requestId:'agent-load-'+round})));messages+=humans.length;}
  await wait(100);
 }
 await app.replies.drain();
 const jobs=app.store.db.prepare('SELECT status,COUNT(*) n FROM agent_reply_jobs GROUP BY status').all(),sent=jobs.find(j=>j.status==='sent')?.n??0;
 assert.equal(sent,messages*2,'every human mention gets one reply from each target');assert.equal(peak,2);assert.equal(inFlight,0);
 const p95=[...latency].sort((a,b)=>a-b)[Math.floor(latency.length*.95)];
 const report={passed:true,seconds:(Date.now()-start)/1000,realModel:false,environment:'file SQLite + HTTP/SSE + synthetic model transport; no PartyKit',humans:6,agents:2,messages,modelCalls:calls,peakModelConcurrency:peak,sent,jobs,requestP95Ms:p95,failures};await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){await writeFile(directory+'/verification.json',JSON.stringify({passed:false,realModel:false,calls,peak,error:error.message},null,2));throw error;}
finally{for(const channel of channels)channel.abort.abort();app.close();app.server.closeAllConnections();await Promise.allSettled(channels.map(c=>c.reading));}
