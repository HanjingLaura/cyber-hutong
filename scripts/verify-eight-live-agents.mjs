import {liveBudget} from './fixtures/live-budget.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {loadLocalEnvironment} from '../server/local-env.mjs';
import {createMvpServer} from '../server/app.mjs';
import {roles} from '../server/personas.mjs';

loadLocalEnvironment();const directory='output/eight-live-agents-'+Date.now();await mkdir(directory,{recursive:true});
const app=createMvpServer({dbPath:directory+'/game.sqlite',llmOptions:{...liveBudget(15)}}),accounts={};await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${app.server.address().port}/api/`;
async function api(role,path,input){const response=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{cookie:accounts[role].cookie,'Content-Type':'application/json'},body:input===undefined?undefined:JSON.stringify(input),signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);return response.json();}
try{
 assert.equal(app.llm.configured,true);
 for(const role of roles){const account=await app.store.register('eight_trial_'+role,'isolated-eight-password',role);accounts[role]={cookie:'hutong_session='+account.token,id:account.user.id};app.presence.connect(account.user.id,'isolated-offline','fixture');app.store.db.prepare('UPDATE browser_presence SET at=?,closed_at=? WHERE account=?').run(Date.now()-360001,Date.now()-360001,account.user.id);}
 const first={channel:'lobby',text:'大家好，按各自口吻打个简短招呼吧。',mentions:roles.filter(role=>role!=='sid'),requestId:'eight-public'};
 await api('sid','chat',first);await app.replies.drain();
 const inputs=roles.map((role,index)=>({sender:roles[(index+1)%roles.length],input:{channel:'dm',peer:role,text:'你好，来句简短招呼吧。',requestId:'eight-private-'+role}}));
 // Send concurrently through the bounded queue. All targets remain offline;
 // only this test fixture places peers in different scenes, without driving them.
 for(const [index,role]of roles.entries()){const p=app.players.get(accounts[role].id);if(p)p.scene=index%2?'rest':'hutong';}
 await Promise.all(inputs.map(({sender,input})=>api(sender,'chat',input)));await app.replies.drain();
 const publicMessages=(await api('sid','history?channel=lobby')).messages.filter(message=>message.npc),privateMessages=[];
 for(const {sender,input}of inputs){
  const messages=(await api(sender,'history?channel=dm&peer='+input.peer)).messages.filter(message=>message.npc&&message.sender===input.peer);
  assert.equal(messages.length,1,'one saved private reply for '+input.peer);privateMessages.push(...messages);
  const outsider=roles.find(role=>role!==sender&&role!==input.peer);
  assert.equal((await api(outsider,'history?channel=dm&peer='+input.peer)).messages.some(m=>m.id===messages[0].id),false,'private reply leaked');
 }
 assert.equal(publicMessages.length,7);assert.equal(privateMessages.length,8);assert.deepEqual([...new Set(privateMessages.map(message=>message.sender))].sort(),[...roles].sort());assert.ok([...publicMessages,...privateMessages].every(message=>message.body.trim()));
 await api('sid','chat',first);await Promise.all(inputs.map(({sender,input})=>api(sender,'chat',input)));await app.replies.drain();assert.equal(app.llm.status().budget.calls,15);assert.ok(app.llm.status().budget.chargedTokens<=20000);
 const report={passed:true,realModel:true,scope:'eight isolated local identities; real provider; file SQLite; expired presence and cross-scene fixtures',agents:roles,publicReplies:7,privateReplies:8,concurrentPrivateQuestions:true,retryExactlyOnce:true,privateHistoryIsolated:true,provider:app.llm.status()};await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({directory,...report}));
}catch(error){const report={passed:false,provider:app.llm.status(),error:error.message};await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.error(JSON.stringify({directory,...report}));process.exitCode=1;}
finally{app.close();app.server.closeAllConnections();}
