import {liveBudget} from './fixtures/live-budget.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createMvpServer} from '../server/app.mjs';
import {loadLocalEnvironment} from '../server/local-env.mjs';
import {roles} from '../server/personas.mjs';

loadLocalEnvironment();
const previous=process.env.HUTONG_EIGHT_RESULT_DIRECTORY;assert.ok(previous,'Run through verify-agent-preflight.mjs');
const directory='output/agent-history-'+Date.now();await mkdir(directory,{recursive:true});
let app;const checks={},report={passed:false,scope:'isolated real-model histories reopened over HTTP; one additional public reply',checks};
async function start(options){app=createMvpServer(options);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));}
function stop(){if(app){app.close();app.server.closeAllConnections();app=undefined;}}
async function request(cookie,path,input){const response=await fetch(`http://127.0.0.1:${app.server.address().port}/api/`+path,{method:input?'POST':'GET',headers:{cookie,'Content-Type':'application/json'},body:input?JSON.stringify(input):undefined});assert.equal(response.status,200,path);return{data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
try{
 await start({dbPath:previous+'/game.sqlite',llmOptions:{key:''}});
 // Fresh process/server and fresh login: all eight private histories survive.
 for(const [index,role]of roles.entries()){
  const sender=roles[(index+1)%roles.length],login=await request('','login',{username:'eight_trial_'+sender,password:'isolated-eight-password'});
  const history=(await request(login.cookie,'history?channel=dm&peer='+role)).data.messages;
  assert.equal(history.filter(m=>m.npc&&m.sender===role).length,1,'persisted reply '+role);
  const lobby=(await request(login.cookie,'history?channel=lobby')).data.messages;assert.equal(lobby.filter(m=>m.npc).length,7);
 }
 checks.allEightPrivateHistoriesAfterRestart=true;checks.publicHistoryAfterRestart=true;stop();
 await start({dbPath:directory+'/game.sqlite',llmOptions:liveBudget(1)});
 const accounts={};for(const role of ['laura','sid']){const a=await app.store.register('public_eighth_'+role,'isolated-history-password',role);accounts[role]={cookie:'hutong_session='+a.token,id:a.user.id};app.presence.connect(a.user.id,'offline','fixture');app.store.db.prepare('UPDATE browser_presence SET at=?,closed_at=? WHERE account=?').run(Date.now()-360001,Date.now()-360001,a.user.id);}
 await request(accounts.laura.cookie,'chat',{channel:'lobby',mentions:['sid'],text:'@Sid 你好，打个简短招呼吧。',requestId:'eighth-public'});await app.replies.drain();
 const messages=(await request(accounts.laura.cookie,'history?channel=lobby')).data.messages;assert.equal(messages.filter(m=>m.npc&&m.sender==='sid'&&m.body.trim()).length,1);
 checks.eighthAgentPublicMention=true;assert.equal(app.llm.status().budget.calls,1);report.passed=true;
}catch(error){report.error=error.message;process.exitCode=1;}
report.provider=app?.llm.status();await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({directory,...report}));stop();
