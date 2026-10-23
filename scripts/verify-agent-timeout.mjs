import {liveBudget} from './fixtures/live-budget.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createMvpServer} from '../server/app.mjs';
import {loadLocalEnvironment} from '../server/local-env.mjs';

loadLocalEnvironment();const savedDirectory=process.argv[2]==='--verify-saved'?process.argv[3]:undefined;
const directory=savedDirectory??'output/agent-timeout-'+Date.now();await mkdir(directory,{recursive:true});
const saved=savedDirectory?JSON.parse(await readFile(directory+'/verification.json','utf8')):null;
if(saved){assert.equal(saved.providerResponded,true);assert.equal(saved.provider.reason,'timeout');assert.equal(saved.provider.budget.calls,1);}
let providerResponded=saved?.providerResponded??false;const checks={},app=createMvpServer({dbPath:directory+'/game.sqlite',llmOptions:{...liveBudget(1),...(saved?{key:''}:{}),timeout:10000,fetchImpl:async(...args)=>{
 const response=await fetch(...args);assert.equal(response.status,200);await response.json();providerResponded=true;
 // One real completed provider call, then a deliberately delayed transport
 // acknowledgement. No provider text enters the report and no retry is made.
 const signal=args[1].signal;return new Promise((_,reject)=>{const fail=()=>reject(Error('isolated delayed response'));if(signal.aborted)fail();else signal.addEventListener('abort',fail,{once:true});});
}}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const accounts={},report={passed:false,scope:'isolated identities / real provider / delayed transport timeout fixture',checks};
async function api(role,path,input){const r=await fetch(`http://127.0.0.1:${app.server.address().port}/api/`+path,{method:input?'POST':'GET',headers:{cookie:accounts[role].cookie,'Content-Type':'application/json'},body:input?JSON.stringify(input):undefined});assert.equal(r.status,200,path);return r.json();}
try{
 for(const role of ['laura','sid']){const a=saved?await app.store.login('timeout_trial_'+role,'isolated-timeout-password'):await app.store.register('timeout_trial_'+role,'isolated-timeout-password',role);accounts[role]={id:a.user.id,cookie:'hutong_session='+a.token};app.presence.connect(a.user.id,'offline','fixture');app.store.db.prepare('UPDATE browser_presence SET at=?,closed_at=? WHERE account=?').run(Date.now()-360001,Date.now()-360001,a.user.id);}
 const input={channel:'dm',peer:'laura',text:'你好，简短打个招呼吧。',requestId:'real-timeout'};await api('sid','chat',input);await app.replies.drain();
 assert.equal(providerResponded,true);assert.equal((saved?.provider??app.llm.status()).reason,'timeout');assert.equal(app.replies.history('sid','laura','hutong','dm').at(-1).status,'failed');assert.equal((await api('sid','history?channel=dm&peer=laura')).messages.filter(m=>m.npc).length,0);checks.timeoutFailedWithoutFakeReply=true;
 await api('sid','chat',input);await app.replies.drain();assert.equal(app.llm.status().budget.calls,1);checks.failedRequestNotRetried=true;
 await api('sid','chat',{channel:'lobby',text:'isolated human chat continues',requestId:'human-after-timeout'});assert.equal((await api('sid','history?channel=lobby')).messages.filter(m=>!m.npc).length,1);checks.humanChatContinues=true;
 await api('sid','control',{client:'timeout-controller'});Object.assign(app.players.get(accounts.sid.id),{scene:'rest',x:180,y:190,seat:null,activity:'walk',at:Date.now()-1000});await api('sid','object',{client:'timeout-controller',object:'rest:fridge-door',action:'toggle',revision:0,requestId:'object-after-timeout'});checks.gameInteractionContinues=true;
 report.passed=true;
}catch(error){report.error=error.message;process.exitCode=1;}
report.providerResponded=providerResponded;report.provider=saved?.provider??app.llm.status();if(saved)report.savedTimeoutVerificationWithoutNewModelRequest=true;report.usageNote='timeout retains conservative token reservation rather than reporting unknown consumption as zero';await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({directory,...report}));app.close();app.server.closeAllConnections();
