import {liveBudget} from './fixtures/live-budget.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {loadLocalEnvironment} from '../server/local-env.mjs';
import {createMvpServer} from '../server/app.mjs';
import {AGENT_DELAY_MS,BROWSER_TIMEOUT_MS} from '../server/agent-presence.mjs';
import {prepareAgentPersonas} from './fixtures/agent-personas.mjs';

// Real provider, isolated identities, file SQLite and real elapsed offline time.
// No response text, cookies, profile content or credentials enter the report.
loadLocalEnvironment();
process.env.HUTONG_INVITE='isolated-live-agent';
const directory=join('output','live-agent-lifecycle-'+Date.now());await mkdir(directory,{recursive:true});
const agentPersonaDirectory=await prepareAgentPersonas(directory,{laura:{source:'isolated fixture, not real owner approval',voice:'简短自然的中文。只依据合成资料回答。',facts:[{scope:'public',text:'这是隔离测试账号，喜欢像素游戏。'},{scope:'private',peer:'sid',text:'DM_ONLY_SENTINEL_7348'},{scope:'private',peer:'jilly',text:'OTHER_PEER_SENTINEL_9384'}],examples:[],confirmed:true,enabled:true}});
const key=process.env.DASHSCOPE_API_KEY||process.env.BAILIAN_API_KEY;
const checks={},streams=new Set(),started=Date.now();let app,base,held=false,releaseHeld,providerReached;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,label,timeout=25000){const deadline=Date.now()+timeout;do{const value=await predicate();if(value)return value;await sleep(100);}while(Date.now()<deadline);throw Error('Timed out: '+label);}
async function api(path,input,account){
 const response=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{cookie:account?.cookie??'','Content-Type':'application/json'},body:input===undefined?undefined:JSON.stringify(input),signal:AbortSignal.timeout(20000)});
 const data=await response.json();assert.equal(response.status,200,path+': '+response.status);
 return{data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function start(){
 app=createMvpServer({agentPersonaDirectory,dbPath:join(directory,'game.sqlite'),llmOptions:{key,...liveBudget(8),timeout:20000,fetchImpl:async(...args)=>{
  const response=await fetch(...args);
  if(held){const data=await response.json();held=false;providerReached({ok:response.ok,hasReply:typeof data.choices?.[0]?.message?.content==='string'});await new Promise(resolve=>releaseHeld=resolve);return Response.json(data,{status:response.status});}
  return response;
 }}});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${app.server.address().port}/api/`;
}
async function connect(account,client){
 const controller=new AbortController(),events=[];
 const response=await fetch(base+'events?client='+client,{headers:{cookie:account.cookie},signal:controller.signal});assert.equal(response.status,200);
 const stream={events,async close(){clearInterval(timer);controller.abort();await reading;streams.delete(stream);}};streams.add(stream);
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
 const reading=(async()=>{try{for(;;){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let boundary;while((boundary=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);const type=frame.match(/^event: (.+)$/m)?.[1],data=frame.match(/^data: (.+)$/m)?.[1];if(data&&['message','agent-status','world'].includes(type)){events.push({type,data:JSON.parse(data)});if(events.length>1000)events.shift();}}}}catch(error){if(!controller.signal.aborted)throw error;}})();
 const timer=setInterval(()=>{void api('heartbeat',{client},account).catch(()=>{});},15000);
 await until(()=>events.some(event=>event.type==='world'),'SSE initial snapshot');return stream;
}
const history=async(account,channel)=>(await api('history?channel='+channel+(channel==='dm'?'&peer=laura':''),undefined,account)).data.messages;
const replyIn=async(account,channel,count=1)=>until(async()=>{const messages=await history(account,channel),replies=messages.filter(message=>message.npc&&message.sender==='laura');const job=(await api('agent-replies?channel='+channel+(channel==='dm'?'&peer=laura':''),undefined,account)).data.jobs.at(-1);if(job?.status==='failed')throw Error('Real reply failed: '+job.reason);return replies.length===count&&replies.every(reply=>reply.body.trim())?replies:false;},'real '+channel+' reply');
async function stop(){for(const stream of [...streams])await stream.close();if(app){const old=app;app=undefined;old.close();old.server.closeAllConnections();}}
try{
 assert.ok(key,'Existing Bailian key is required');await start();
 const accounts={};for(const role of ['laura','sid','jilly']){const result=await api('register',{username:'live_trial_'+role,password:'isolated-test-password',role,invite:process.env.HUTONG_INVITE});accounts[role]={cookie:result.cookie,id:result.data.user.id};}
 const {laura,sid,jilly}=accounts;
 let ownerStream=await connect(laura,'owner-original');let senderStream=await connect(sid,'sender-original');const observerStream=await connect(jilly,'observer');
 const online=await api('chat',{channel:'dm',peer:'laura',text:'你好，在线时由本人回答。',requestId:'owner-online'},sid);assert.equal(online.data.agents[0].status,'human');checks.onlineOwnerNotImpersonated=true;
 await ownerStream.close();
 // SSE loss alone is not a browser logout; liveness first expires after 60s.
 const due=app.presence.takeoverAt(laura.id);assert.ok(due-Date.now()>=AGENT_DELAY_MS-1000);assert.equal(app.presence.canDrive(laura.id),false);
 const waiting=await api('chat',{channel:'dm',peer:'laura',text:'离线等待阶段测试。',requestId:'owner-waiting'},sid);assert.ok(['human','waiting'].includes(waiting.data.agents[0].status));
 console.log(JSON.stringify({stage:'waiting_real_offline_takeover',waitSeconds:Math.ceil((due-Date.now())/1000),directory}));
 await until(()=>app.presence.canDrive(laura.id),'actual offline takeover',AGENT_DELAY_MS+BROWSER_TIMEOUT_MS+5000);checks.actualOfflineWaitMs=Date.now()-(due-AGENT_DELAY_MS-BROWSER_TIMEOUT_MS);checks.offlineTakeover=true;
 const input={channel:'dm',peer:'laura',text:'你好，你喜欢什么游戏？',requestId:'live-dm'};
 await api('chat',input,sid);const dm=(await replyIn(sid,'dm'))[0];
 await until(()=>senderStream.events.some(event=>event.type==='message'&&event.data.id===dm.id),'DM SSE delivery');checks.dmGeneratedPersistedAndPushed=true;
 assert.ok(!JSON.stringify(await history(sid,'dm')).includes('OTHER_PEER_SENTINEL'));assert.equal((await history(jilly,'dm')).length,0);assert.ok(!observerStream.events.some(event=>event.type==='message'&&event.data.id===dm.id));checks.dmVisibility=true;
 const before=app.store.db.prepare('SELECT SUM(calls) n FROM llm_usage').get().n;
 await api('chat',input,sid);await sleep(250);assert.equal(app.store.db.prepare('SELECT SUM(calls) n FROM llm_usage').get().n,before);assert.equal((await history(sid,'dm')).filter(message=>message.npc).length,1);checks.retryExactlyOnce=true;
 await api('chat',{channel:'lobby',text:'Laura，普通公共消息测试。',requestId:'public-no-mention'},sid);await sleep(250);assert.equal(app.store.db.prepare('SELECT SUM(calls) n FROM llm_usage').get().n,before);checks.publicRequiresExplicitMention=true;
 await api('chat',{channel:'lobby',text:'@Laura 你好，和大家打个招呼吧。',mentions:['laura'],requestId:'live-public'},sid);const lobby=(await replyIn(sid,'lobby'))[0];
 for(const stream of [senderStream,observerStream])await until(()=>stream.events.some(event=>event.type==='message'&&event.data.id===lobby.id),'public SSE delivery');
 assert.ok(!JSON.stringify(await history(jilly,'lobby')).includes('SENTINEL'));checks.publicGeneratedPersistedAndPushed=true;checks.publicPrivateFactsAbsent=true;
 await senderStream.close();senderStream=await connect(sid,'sender-reconnected');assert.ok((await history(sid,'dm')).some(message=>message.id===dm.id));assert.ok((await history(sid,'lobby')).some(message=>message.id===lobby.id));checks.reconnectedHistory=true;
 // Hold a real completed response until the owner returns. No fake content.
 const providerReady=new Promise(resolve=>providerReached=resolve);held=true;
 await api('chat',{channel:'dm',peer:'laura',text:'再推荐一个像素游戏吧。',requestId:'live-cancel'},sid);
 const generated=await Promise.race([providerReady,sleep(22000).then(()=>{throw Error('No provider response for cancellation');})]);assert.equal(generated.ok,true);assert.equal(generated.hasReply,true);
 ownerStream=await connect(laura,'owner-returned');releaseHeld();
 await until(async()=>(await api('agent-replies?channel=dm&peer=laura',undefined,sid)).data.jobs.some(job=>job.id==='laura:sid:live-cancel'&&job.status==='canceled'),'owner cancels generated reply');assert.equal((await history(sid,'dm')).filter(message=>message.npc).length,1);checks.realGeneratedReplyCanceledOnOwnerReturn=true;
 const calls=app.store.db.prepare('SELECT SUM(calls) n FROM llm_usage').get().n,provider=app.llm.status();await stop();
 await start();const login=await api('login',{username:'live_trial_sid',password:'isolated-test-password'});sid.cookie=login.cookie;senderStream=await connect(sid,'sender-after-server-restart');
 assert.ok((await history(sid,'dm')).some(message=>message.id===dm.id&&message.body===dm.body));assert.ok((await history(sid,'lobby')).some(message=>message.id===lobby.id&&message.body===lobby.body));assert.equal((await api('agent-replies?channel=dm&peer=laura',undefined,sid)).data.jobs.filter(job=>job.status==='sent').length,1);checks.fileDatabaseRestartHistory=true;
 await api('chat',input,sid);await sleep(250);assert.equal(app.store.db.prepare('SELECT SUM(calls) n FROM llm_usage').get().n,calls);checks.retryAfterRestartExactlyOnce=true;
 const report={passed:true,realModel:true,scope:'isolated local accounts; real provider, HTTP/SSE, file SQLite',isolatedSyntheticProfiles:true,provider,calls,durationMs:Date.now()-started,checks};await writeFile(join(directory,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({directory,...report}));
}catch(error){const report={passed:false,realModelAttempted:!!key,provider:app?.llm.status(),checks,durationMs:Date.now()-started,error:error.message};await writeFile(join(directory,'verification.json'),JSON.stringify(report,null,2));console.error(JSON.stringify({directory,...report}));process.exitCode=1;}
finally{releaseHeld?.();await stop();}
