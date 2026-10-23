// One durable budget across all eight real agents. No provider retry or budget reset.
import './fixtures/live-provider-guard.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createServer as portProbe} from 'node:net';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {loadLocalEnvironment} from '../server/local-env.mjs';
import {roles} from '../server/personas.mjs';
import {loadPlaywright} from './playwright.mjs';
import {liveBudget} from './fixtures/live-budget.mjs';

const synthetic=process.argv.includes('--synthetic');if(!synthetic)loadLocalEnvironment();process.env.HUTONG_LIVE_BUDGET_DAY=new Date(Date.now()+28800000).toISOString().slice(0,10);
const resume=process.argv.indexOf('--resume'),directory=resume>=0?process.argv[resume+1]:'output/eight-agent-acceptance-'+Date.now();assert.ok(/^output\/eight-agent-acceptance-\d+$/.test(directory));await mkdir(directory,{recursive:true});
const prior=resume>=0?JSON.parse(await readFile(directory+'/verification.json','utf8')):null;if(prior)assert.equal(prior.provider.budget.day,process.env.HUTONG_LIVE_BUDGET_DAY,'do not reset allowance across accounting days');
const report={passed:false,realModel:!synthetic,scope:'eight isolated accounts / file SQLite / Chrome / no production writes',limits:{calls:24,tokens:20000},offlineClockFixture:true,checks:[],roles:{},errors:[]},accounts={},privateReplies={},publicReplies={},waiting=new Map(),completed=new Map();
if(prior){await writeFile(directory+'/initial-attempt.json',JSON.stringify(prior,null,2));report.continuation={priorCalls:prior.providerCalls,reason:'original cyclic sender fixture caused correct owner cancellation; retain replies and complete only missing coverage'};}
let app,base,vite,browser,providerCalls=prior?.providerCalls??0,holdRole=null,provider;const dmRequestIds={},alreadyCanceled=new Set();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,timeout=25000){const end=Date.now()+timeout;do{if(await fn())return;await sleep(60);}while(Date.now()<end);throw Error('Timed out: '+label);}
async function save(){await writeFile(directory+'/verification.json',JSON.stringify({...report,provider:provider??app?.llm.status(),providerCalls},null,2));}
async function start(real){
 app=createMvpServer({dbPath:directory+'/game.sqlite',llmOptions:{...liveBudget(24),...(real?(synthetic?{key:'synthetic'}:{}):{key:''}),timeout:20000,fetchImpl:async(url,input)=>{
  providerCalls++;assert.ok(providerCalls<=24,'hard provider-call ceiling');
  const context=JSON.parse(JSON.parse(input.body).messages[1].content),role=context.character.role,response=synthetic?Response.json({choices:[{message:{content:JSON.stringify({text:'isolated-'+role})}}],usage:{total_tokens:16}}):await fetch(url,input),data=await response.json();
  if(holdRole===role){assert.equal(response.ok,true,'provider cancellation fixture response');assert.equal(typeof data.choices?.[0]?.message?.content,'string');completed.set(role,true);await new Promise(r=>waiting.set(role,r));}
  return Response.json(data,{status:response.status});
 }}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}/api/`;
}
async function api(role,path,input){const response=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{cookie:accounts[role]?.cookie??'','Content-Type':'application/json'},body:input===undefined?undefined:JSON.stringify(input),signal:AbortSignal.timeout(20000)});assert.equal(response.status,200,path+' '+response.status);return response.json();}
function offline(role){const id=accounts[role].id;app.presence.connect(id,'isolated-clock','fixture');app.store.db.prepare('UPDATE browser_presence SET at=?,closed_at=? WHERE account=?').run(Date.now()-360001,Date.now()-360001,id);assert.ok(app.presence.canDrive(id));}
function check(name){report.checks.push(name);console.log(JSON.stringify({stage:name,calls:providerCalls,tokens:app.llm.status().budget.chargedTokens}));}
const senderFor=role=>roles[(roles.indexOf(role)+1)%roles.length];
const dmInput=role=>({channel:'dm',peer:role,text:'你好，按你的口吻简短打个招呼。',requestId:dmRequestIds[role]??'accept-dm-'+role});
const publicInput=role=>({channel:'lobby',text:'@'+role+' 你好，跟大家简短打个招呼。',requestId:'accept-public-'+role});
const dmHistory=(role,peer)=>api(role,'history?channel=dm&peer='+peer);
async function openDM(page,peer){await page.locator('#people-open').click();if(await page.locator('#take-control').isVisible()){await page.locator('#take-control').click();await page.waitForFunction(()=>window.__socialPreview.bridge.controller);}await page.locator('.person-row').filter({hasText:new RegExp(peer,'i')}).getByRole('button',{name:/^私聊/}).click();}
try{
 await start(true);assert.equal(app.llm.configured,true,'existing real provider key required');
 for(const [i,role]of roles.entries()){const session=prior?await app.store.login('agent_accept_'+role,'isolated-agent-password'):await app.store.register('agent_accept_'+role,'isolated-agent-password',role);accounts[role]={cookie:'hutong_session='+session.token,token:session.token,id:session.user.id};const profile=app.agentProfiles.get(session.user.id);assert.ok(profile.confirmed&&profile.enabled,role+' backend persona enabled');offline(role);const p={id:session.user.id,role,scene:i%2?'rest':'hutong',x:320,y:330,seat:null,activity:'walk',moving:false,at:Date.now()-360001};app.players.set(p.id,p);app.life.savePosition(p);report.roles[role]={};}
 const beforePrivate=providerCalls,missing=[];
 for(const role of roles){const existing=(await dmHistory(senderFor(role),role)).messages.filter(m=>m.npc&&m.sender===role);if(!existing.length){missing.push(role);if(prior){assert.equal(app.store.db.prepare('SELECT status FROM agent_reply_jobs WHERE id=?').get(role+':'+senderFor(role)+':accept-dm-'+role)?.status,'canceled');alreadyCanceled.add(role);dmRequestIds[role]='accept-dm-'+role+'-continuation';report.roles[role].cancellationEvidence='authenticated owner message canceled initial in-flight generation';}}}
 // A cyclic group cannot all be offline while each is sending as a human.
 // Finish each target before its owner becomes the next authenticated sender.
 for(const role of missing){offline(role);await api(senderFor(role),'chat',dmInput(role));await app.replies.drain();}
 for(const role of roles){const messages=(await dmHistory(senderFor(role),role)).messages.filter(m=>m.npc&&m.sender===role);assert.equal(messages.length,1,'one private reply '+role);assert.ok(messages[0].body.trim());privateReplies[role]=messages[0];report.roles[role].dm=true;}
 assert.equal(providerCalls,beforePrivate+missing.length);const afterPrivate=providerCalls;check('all eight private replies generated and saved, retaining prior successful replies');await save();
 // Every canonical role, including Sid, gets a direct typed public @ test.
 for(const role of roles){offline(role);await api(senderFor(role),'chat',publicInput(role));await app.replies.drain();}
 const lobby=(await api('sid','history?channel=lobby')).messages.filter(m=>m.npc);assert.equal(lobby.length,8);
 for(const role of roles){publicReplies[role]=lobby.find(m=>m.sender===role);assert.ok(publicReplies[role]?.body.trim());report.roles[role].publicMention=true;}
 assert.equal(providerCalls,afterPrivate+8);const beforeCancellation=providerCalls;check('all eight typed public mentions generated exactly once');await save();
 for(const role of roles){const sender=senderFor(role),outsider=roles.find(r=>r!==sender&&r!==role);assert.ok(!(await dmHistory(outsider,role)).messages.some(m=>m.id===privateReplies[role].id));await api(sender,'chat',dmInput(role));await api(sender,'chat',publicInput(role));await api(sender,'chat',{channel:'lobby',text:role+' 只是普通名字，不是提及。',requestId:'accept-plain-'+role});}
 await app.replies.drain();assert.equal(providerCalls,beforeCancellation);check('duplicate requests, ordinary names and unrelated private histories use no extra model calls');
 for(const role of roles){
  if(alreadyCanceled.has(role)){await api(role,'heartbeat',{client:'owner-return-'+role});const result=await api(senderFor(role),'chat',{channel:'dm',peer:role,text:'在线时请本人回复。',requestId:'accept-online-'+role});assert.equal(result.agents[0].status,'human');report.roles[role].ownerTakeover=true;report.roles[role].canceledPendingReply=true;continue;}
  offline(role);holdRole=role;const sender=senderFor(role),requestId='accept-cancel-'+role;
  await api(sender,'chat',{channel:'dm',peer:role,text:'再简短说一句就好。',requestId});await until(()=>completed.has(role),'completed real response '+role);
  await api(role,'heartbeat',{client:'owner-return-'+role});const control=await api(role,'control',{client:'owner-return-'+role});assert.equal(control.player.role,role);
  const status=await api(sender,'agent-replies?channel=dm&peer='+role);assert.equal(status.jobs.find(j=>j.id===role+':'+sender+':'+requestId)?.status,'canceled');
  waiting.get(role)();waiting.delete(role);holdRole=null;await app.replies.drain();assert.equal((await dmHistory(sender,role)).messages.filter(m=>m.npc&&m.sender===role).length,1);
  const human=await api(sender,'chat',{channel:'dm',peer:role,text:'在线时请本人回复。',requestId:'accept-online-'+role});assert.equal(human.agents[0].status,'human');report.roles[role].ownerTakeover=true;report.roles[role].canceledPendingReply=true;
  await save();
 }
 assert.equal(providerCalls,beforeCancellation+roles.length-alreadyCanceled.size);assert.ok(providerCalls<=24);check('each returning owner cancels real pending generation; online messages do not impersonate');
 const probe=portProbe();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{host:'127.0.0.1',port,strictPort:true,watch:null,hmr:false,proxy:{'/api':{target:base.replace(/\/api\/$/,'')}}}});await vite.listen();const origin=`http://127.0.0.1:${port}`;
 browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
 for(const target of roles){const sender=senderFor(target),context=await browser.newContext({viewport:{width:1280,height:800}});try{
  await context.addCookies([{name:'hutong_session',value:accounts[sender].token,url:origin}]);const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));await page.goto(origin,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>window.__socialPreview?.bridge.connected&&window.__socialPreview.bridge.state()&&!window.__socialPreview.bridge.pendingSpawn);
  await openDM(page,target);await page.locator('#chat-history').filter({hasText:privateReplies[target].body}).waitFor();
  await context.setOffline(true);await until(()=>page.evaluate(()=>!window.__socialPreview.bridge.connected),'browser offline');const started=Date.now();await context.setOffline(false);await page.waitForFunction(()=>window.__socialPreview.bridge.connected);await page.locator('#chat-history').filter({hasText:privateReplies[target].body}).waitFor();const elapsed=Date.now()-started;assert.ok(elapsed<=10000);report.roles[target].reconnectMs=elapsed;
  await page.reload({waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>window.__socialPreview?.bridge.connected&&window.__socialPreview.bridge.state()&&!window.__socialPreview.bridge.pendingSpawn);await openDM(page,target);await page.locator('#chat-history').filter({hasText:privateReplies[target].body}).waitFor();await page.locator('#chat-lobby').click();await page.locator('#chat-history').filter({hasText:publicReplies[target].body}).waitFor();report.roles[target].browserReloadHistory=true;
 }finally{await context.close();}}
 assert.deepEqual(report.errors,[]);assert.ok(providerCalls<=24);check('all eight Chrome private histories survive offline reconnect and reload; public history restored');
 provider=app.llm.status();assert.ok(provider.budget.chargedTokens<=20000);assert.equal(provider.backgroundCalls,false);await browser.close();browser=null;await vite.close();vite=null;app.close();app.server.closeAllConnections();await start(false);
 for(const role of roles){const sender=senderFor(role),history=(await dmHistory(sender,role)).messages;assert.ok(history.some(m=>m.id===privateReplies[role].id&&m.body===privateReplies[role].body));assert.ok((await api(sender,'history?channel=lobby')).messages.some(m=>m.id===publicReplies[role].id));await api(sender,'chat',dmInput(role));report.roles[role].serverRestartHistory=true;}
 await app.replies.drain();assert.equal(providerCalls,provider.budget.calls);report.passed=true;check('file database restart preserves every reply; replay makes zero provider calls');await save();
}catch(error){report.error=error.message;provider=app?.llm.status();await save();process.exitCode=1;}
finally{for(const release of waiting.values())release();await browser?.close().catch(()=>{});await vite?.close().catch(()=>{});if(app){app.close();app.server.closeAllConnections();}console.log(JSON.stringify({directory,...report,provider,providerCalls}));}
