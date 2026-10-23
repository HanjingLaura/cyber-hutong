import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {loadLocalEnvironment} from '../server/local-env.mjs';
import {createMvpServer} from '../server/app.mjs';

loadLocalEnvironment();
process.env.HUTONG_INVITE='isolated-live-agent';
const directory='output/live-agent-2026-10-19';await mkdir(directory,{recursive:true});
const key=process.env.DASHSCOPE_API_KEY||process.env.BAILIAN_API_KEY;
if(!key){await writeFile(directory+'/verification.json',JSON.stringify({passed:false,blocked:'missing_existing_bailian_key',realModel:false},null,2));console.log('Real model validation unavailable: no existing Bailian key.');process.exitCode=2;}
else{
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key,dailyLimit:8}});
 const saveReport=async report=>{const serialized=JSON.stringify({...report,at:new Date().toISOString(),model:app.llm.status().model},null,2);await writeFile(directory+'/verification.json',serialized);await writeFile(directory+'/verification-'+app.llm.status().model.replace(/[^a-zA-Z0-9_-]/g,'_')+'.json',serialized);};
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${app.server.address().port}/api/`;
 const api=async(path,input,cookie='')=>{const res=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{cookie,'Content-Type':'application/json'},body:input===undefined?undefined:JSON.stringify(input),signal:AbortSignal.timeout(20000)});const data=await res.json();assert.equal(res.status,200,`${path}: ${res.status}`);return{data,cookie:res.headers.get('set-cookie')?.split(';')[0]};};
 try{
  const owner=await api('register',{username:'live_trial_laura',password:'isolated-test-password',role:'laura',invite:process.env.HUTONG_INVITE}),sender=await api('register',{username:'live_trial_sid',password:'isolated-test-password',role:'sid',invite:process.env.HUTONG_INVITE});
  app.presence.connect(owner.data.user.id,'isolated-offline','fixture');
  app.store.db.prepare('UPDATE browser_presence SET at=?,closed_at=? WHERE account=?').run(Date.now()-360001,Date.now()-360001,owner.data.user.id);
  const input={channel:'dm',peer:'laura',text:'你好，今天怎么样？',requestId:'live-trial-dm'};
  await api('chat',input,sender.cookie);await app.replies.drain();
  const dm=(await api('history?channel=dm&peer=laura',undefined,sender.cookie)).data.messages;
  assert.equal(dm.filter(m=>m.npc).length,1,'a real model reply must be persisted');assert.ok(!JSON.stringify(dm).includes('PRIVATE_SENTINEL'));
  await api('chat',input,sender.cookie);await app.replies.drain();assert.equal((await api('history?channel=dm&peer=laura',undefined,sender.cookie)).data.messages.filter(m=>m.npc).length,1);
  await api('chat',{channel:'lobby',text:'你好，打个招呼吧。',mentions:['laura'],requestId:'live-trial-lobby'},sender.cookie);await app.replies.drain();
  const lobby=(await api('history?channel=lobby',undefined,sender.cookie)).data.messages;assert.equal(lobby.filter(m=>m.npc).length,1);assert.ok(!JSON.stringify(lobby).includes('PRIVATE_SENTINEL'));
  const report={passed:true,realModel:true,provider:app.llm.status().provider,model:app.llm.status().model,isolatedAccounts:true,backendPersonaDirectory:true,dmPersisted:true,lobbyPersisted:true,retryExactlyOnce:true,privateSentinelAbsent:true,calls:app.store.db.prepare('SELECT SUM(calls) n FROM llm_usage').get().n};
  await saveReport(report);console.log(JSON.stringify(report));
 }catch(error){const provider=app.llm.status(),report={passed:false,realModelAttempted:true,realModel:false,providerStatus:provider.status,reason:provider.reason,provider,blocked:provider.reason==='account_arrearage'?'provider_account_arrearage':provider.reason==='upstream_429'?'provider_rate_limit':undefined,agentJobs:app.replies.history('sid','laura','hutong','dm'),humanMessagePersisted:app.store.history('sid','laura','hutong','dm').some(message=>!message.npc),error:error.message};await saveReport(report);console.log(JSON.stringify(report));process.exitCode=1;}
 finally{app.close();app.server.closeAllConnections();}
}
