import {liveBudget} from './fixtures/live-budget.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {loadLocalEnvironment} from '../server/local-env.mjs';
import {loadPlaywright} from './playwright.mjs';
import {prepareAgentPersonas} from './fixtures/agent-personas.mjs';

loadLocalEnvironment();process.env.HUTONG_INVITE='isolated-browser-live-agent';
const directory='output/live-agent-browser-'+Date.now();await mkdir(directory,{recursive:true});
const agentPersonaDirectory=await prepareAgentPersonas(directory,{laura:{source:'synthetic browser fixture',voice:'简短自然的中文。',facts:[{scope:'public',text:'喜欢像素游戏。'},{scope:'private',peer:'sid',text:'PRIVATE_BROWSER_SENTINEL_7248'}],confirmed:true,enabled:true}});
const contexts=[],errors=[],checks={};let modelCalls=0;
const app=createMvpServer({agentPersonaDirectory,dbPath:directory+'/game.sqlite',llmOptions:{...liveBudget(4),timeout:20000,fetchImpl:async(...args)=>{modelCalls++;return fetch(...args);}}});
await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const backend=`http://127.0.0.1:${app.server.address().port}`;
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:backend,changeOrigin:false}}}});await vite.listen();
const origin=`http://127.0.0.1:${vite.httpServer.address().port}`,browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function account(role){const context=await browser.newContext({viewport:{width:1280,height:800}});contexts.push(context);const response=await context.request.post(origin+'/api/register/',{data:{username:'browser_live_'+role,password:'isolated-browser-password',role,invite:process.env.HUTONG_INVITE}});assert.equal(response.status(),200);return{context,user:(await response.json()).user};}
async function savedReply(context,channel){for(let n=0;n<150;n++){const response=await context.request.get(origin+'/api/history/?channel='+channel+(channel==='dm'?'&peer=laura':''));assert.equal(response.status(),200);const reply=(await response.json()).messages.find(message=>message.npc&&message.sender==='laura');if(reply)return reply;await sleep(200);}throw Error('No saved real '+channel+' reply');}
try{
 assert.equal(app.llm.configured,true,'existing real key required');
 const laura=await account('laura'),sid=await account('sid'),jilly=await account('jilly');
 // The lifecycle script separately waits the real six minutes; only this UI
 // fixture ages presence so the UI checks do not repeat that elapsed-time test.
 app.presence.connect(laura.user.id,'fixture','fixture');app.store.db.prepare('UPDATE browser_presence SET at=?,closed_at=? WHERE account=?').run(Date.now()-360001,Date.now()-300001,laura.user.id);
 const page=await sid.context.newPage(),personaRequests=[];page.on('request',request=>{if(request.url().includes('/api/agent-profile'))personaRequests.push(request.url());});page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+'/');await page.waitForFunction(()=>window.__socialPreview?.bridge.connected&&!window.__socialPreview.bridge.pendingSpawn);
 assert.equal(await page.locator('#laura-profile-open, #laura-profile, [data-profile]').count(),0);checks.noPersonaEditor=true;
 await page.locator('#chat-open').click();await page.locator('#chat-lobby').click();await page.locator('#chat-mention').selectOption('laura');const mention=await page.locator('#chat-input').inputValue();assert.ok(mention.includes('@Laura'));await page.locator('#chat-input').fill(mention+'你好，跟大家打个招呼吧。');await page.locator('#chat-form button').click();
 const lobby=await savedReply(sid.context,'lobby');await page.locator('#chat-history').filter({hasText:lobby.body}).waitFor();assert.ok((await page.locator('#chat-history').innerText()).includes('Laura · 分身'));assert.ok(!lobby.body.includes('PRIVATE_BROWSER_SENTINEL'));checks.publicMentionRealReplyVisible=true;
 await page.locator('#people-open').click();await page.locator('.person-row').filter({hasText:'Laura'}).getByRole('button',{name:/^私聊/}).click();await page.locator('#chat-input').fill('你好，你喜欢什么游戏？');await page.locator('#chat-form button').click();
 const dm=await savedReply(sid.context,'dm');await page.locator('#chat-history').filter({hasText:dm.body}).waitFor();checks.dmRealReplyVisible=true;
 const outsider=await jilly.context.request.get(origin+'/api/history/?channel=dm&peer=laura');assert.equal((await outsider.json()).messages.length,0);checks.privateHistoryIsolated=true;
 await sid.context.setOffline(true);await sleep(1800);await sid.context.setOffline(false);await page.waitForFunction(()=>window.__socialPreview?.bridge.connected);await page.locator('#chat-history').filter({hasText:dm.body}).waitFor();checks.networkRecoveryHistory=true;
 await page.reload();await page.waitForFunction(()=>window.__socialPreview?.bridge.connected&&!window.__socialPreview.bridge.pendingSpawn);await page.locator('#people-open').click();await page.locator('.person-row').filter({hasText:'Laura'}).getByRole('button',{name:/^私聊/}).click();await page.locator('#chat-history').filter({hasText:dm.body}).waitFor();checks.reloadDmHistory=true;
 await page.locator('#chat-lobby').click();await page.locator('#chat-history').filter({hasText:lobby.body}).waitFor();checks.reloadPublicHistory=true;
 await page.screenshot({path:directory+'/lobby.png'});assert.equal(modelCalls,2);assert.deepEqual(errors,[]);assert.equal(personaRequests.length,0);checks.noPersonaRequests=true;
 const report={passed:true,realModel:true,provider:app.llm.status(),modelCalls,checks,errors,offlineTimeFixture:true};await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({directory,...report}));
}catch(error){const report={passed:false,provider:app.llm.status(),modelCalls,checks,errors,error:error.message};await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.error(JSON.stringify({directory,...report}));process.exitCode=1;}
finally{for(const context of contexts)await context.close().catch(()=>{});await browser.close();await vite.close();app.close();app.server.closeAllConnections();}
