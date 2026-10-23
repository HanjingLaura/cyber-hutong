import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {loadPlaywright} from './playwright.mjs';
import {prepareAgentPersonas} from './fixtures/agent-personas.mjs';

const directory='output/follow-up-ui-'+Date.now();await mkdir(directory,{recursive:true});
const contexts=[],modelContexts=[],errors=[],checks={};
const profile=role=>({source:'synthetic backend fixture',voice:'简短测试',facts:[{scope:'public',text:role+' 公开合成事实'},{scope:'private',peer:'sid',text:'PRIVATE_UI_SCOPE_'+role}],confirmed:true,enabled:true});
const agentPersonaDirectory=await prepareAgentPersonas(directory,{laura:profile('laura'),jilly:profile('jilly')});
process.env.HUTONG_INVITE='isolated-ui';
const app=createMvpServer({agentPersonaDirectory,dbPath:directory+'/game.sqlite',llmOptions:{key:'synthetic-browser-test',fetchImpl:async(_url,input)=>{const context=JSON.parse(JSON.parse(input.body).messages[1].content);modelContexts.push(context);return Response.json({choices:[{message:{content:JSON.stringify({text:context.character.role+' 合成测试回复。'})}}]});}}});
await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const backend=`http://127.0.0.1:${app.server.address().port}`;
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:backend,changeOrigin:false}}}});await vite.listen();
const origin=`http://127.0.0.1:${vite.httpServer.address().port}`,browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
async function account(role){const context=await browser.newContext({viewport:{width:1280,height:800}});contexts.push(context);const response=await context.request.post(origin+'/api/register/',{data:{username:'ui_trial_'+role,password:'synthetic-ui-password',role,invite:process.env.HUTONG_INVITE}});assert.equal(response.status(),200);return{context,user:(await response.json()).user};}
try{
 const laura=await account('laura'),sid=await account('sid'),jilly=await account('jilly');
 for(const owner of [laura,jilly]){app.presence.connect(owner.user.id,'fixture','fixture');app.store.db.prepare('UPDATE browser_presence SET at=?,closed_at=? WHERE account=?').run(Date.now()-360001,Date.now()-300001,owner.user.id);}
 const page=await sid.context.newPage(),requests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('agent-profile'))requests.push(request.url());});await page.goto(origin+'/');await page.waitForFunction(()=>window.__socialPreview?.bridge.connected&&!window.__socialPreview.bridge.pendingSpawn);
 await page.locator('#more-tools summary').click();await page.locator('#settings-open').click();assert.equal(await page.locator('#laura-profile-open, #laura-profile, [data-profile]').count(),0);await page.locator('[data-close="settings-dialog"]').click();checks.personaEditorAbsent=true;
 await page.locator('#chat-open').click();await page.locator('#chat-lobby').click();for(const role of ['laura','jilly'])await page.locator('#chat-mention').selectOption(role);const mentions=await page.locator('#chat-input').inputValue();await page.locator('#chat-input').fill(mentions+'QA public');await page.locator('#chat-form button').click();
 for(const role of ['laura','jilly'])await page.locator('#chat-history').filter({hasText:role+' 合成测试回复。'}).waitFor();assert.equal(modelContexts.length,2);assert.ok(modelContexts.every(context=>!JSON.stringify(context).includes('PRIVATE_UI_SCOPE')));checks.multiAgentMention=true;
 await page.locator('#people-open').click();await page.locator('.person-row').filter({hasText:'Laura'}).getByRole('button',{name:/^私聊/}).click();await page.locator('#chat-input').fill('QA private');await page.locator('#chat-form button').click();await page.locator('#chat-history').filter({hasText:'laura 合成测试回复。'}).waitFor();assert.equal(modelContexts.length,3);assert.ok(JSON.stringify(modelContexts[2]).includes('PRIVATE_UI_SCOPE_laura'));assert.ok(!JSON.stringify(modelContexts[2]).includes('PRIVATE_UI_SCOPE_jilly'));checks.privateContextScoped=true;
 assert.equal((await(await jilly.context.request.get(origin+'/api/history/?channel=dm&peer=laura')).json()).messages.length,0);assert.equal((await sid.context.request.get(origin+'/api/agent-profile/')).status(),404);checks.privateHistoryIsolated=true;checks.personaApiUnavailable=true;
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:directory+'/mobile.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(requests.length,0);assert.deepEqual(errors,[]);checks.noPersonaRequests=true;
 const report={passed:true,realModel:false,backendPersonaFiles:true,checks,syntheticReplies:3,errors};await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({directory,...report}));
}catch(error){await writeFile(directory+'/verification.json',JSON.stringify({passed:false,checks,errors,error:error.message},null,2));throw error;}
finally{for(const context of contexts)await context.close().catch(()=>{});await browser.close();await vite.close();app.close();app.server.closeAllConnections();}
