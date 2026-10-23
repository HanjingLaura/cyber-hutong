import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {loadPlaywright} from './playwright.mjs';
const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}}),errors=[],responses=[];
await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{host:'127.0.0.1',port:5195,strictPort:true,proxy:{'/api':{target:`http://127.0.0.1:${app.server.address().port}`,changeOrigin:false}}}});await vite.listen();
const browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']}),context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),origin='http://127.0.0.1:5195';
page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(/\/api\/(presence|transition)\//.test(response.url()))responses.push({url:response.url(),status:response.status()});});
const directory='output/stability-2026-10-13';await mkdir(directory,{recursive:true});
const ready=()=>page.waitForFunction(()=>window.__socialPreview?.bridge.connected&&window.__socialPreview.bridge.state()&&!window.__socialPreview.bridge.pendingSpawn);
async function travel(target){await page.locator('#room-open').click();const button=page.locator(`[data-place="${target}"]`);await button.click();await button.click();await page.waitForFunction(target=>window.__socialPreview.bridge.state()?.scene===target&&!window.__socialPreview.bridge.transitioning&&!document.querySelector('#location-map').open,target);}
try{
 await page.goto(origin+'/');await page.locator('#account-dialog[open]').waitFor();
 for(const mode of ['login','register']){await page.locator('#account-'+mode).click();await page.locator('#account-name').fill('');await page.locator('#account-name').pressSequentially('asdwASDW');assert.equal(await page.locator('#account-name').inputValue(),'asdwASDW');}
 // Reproduce the scene-lifetime gap that previously left Phaser capture enabled.
 await page.evaluate(()=>{const b=window.__socialPreview.bridge;for(const s of b.game.scene.getScenes(true))b.game.scene.sleep(s.sys.settings.key);b.game.input.keyboard.addCapture('W,A,S,D');});
 await page.locator('#account-name').fill('');await page.locator('#account-name').pressSequentially('wasd');assert.equal(await page.locator('#account-name').inputValue(),'wasd');
 await page.evaluate(()=>window.__socialPreview.bridge.game.scene.wake('hutong'));
 await page.locator('#account-name').fill('');await page.locator('#account-name').pressSequentially('Sid');await page.locator('#account-invite').fill('synthetic-stability-test');await page.locator('#account-password').pressSequentially('asdwASDW1234');await page.locator('#account-confirm').pressSequentially('asdwASDW1234');assert.equal((await page.locator('#account-password').inputValue()).length,12);
 await page.screenshot({path:directory+'/registration-desktop.png'});await page.locator('#account-submit').click();await ready();
 await page.locator('#more-tools summary').click();await page.locator('#settings-open').click();await page.locator('#quick-travel').check();await page.locator('#settings-dialog [data-close]').click();
 await travel('rest');
 const collisionEntry=await page.evaluate(()=>{const b=window.__socialPreview.bridge,p=b.state();b.previous.set('rest',{x:200,y:215});b.players.push({...p,role:'cora',name:'Cora'});b.apply(p);b.draw(16);const next=b.state();b.players=b.players.filter(p=>p.role!=='cora');return{x:next.x,y:next.y};});assert.deepEqual(collisionEntry,{x:554,y:184});
 await travel('hutong');
 await page.evaluate(()=>{const g=window.__socialPreview.bridge.game;g.scene.wake('rest');g.scene.pause('rest');});await travel('rest');await travel('hutong');
 // Fail a required texture, then retry without reloading the game.
 await page.route('**/assets/drafts/gym-room-v1.png',route=>route.abort('failed'));
 await page.locator('#room-open').click();await page.locator('[data-place="gym"]').click();await page.locator('[data-place="gym"]').click();await page.waitForFunction(()=>!window.__socialPreview.bridge.transitioning&&/失败/.test(document.querySelector('#location-map [data-error]').textContent));
 assert.equal(await page.evaluate(()=>window.__socialPreview.bridge.state().scene),'hutong');await page.unroute('**/assets/drafts/gym-room-v1.png');await page.locator('#location-map [data-cancel]').click();await travel('gym');await travel('hutong');
 for(let n=0;n<60;n++)await travel(['rest','hutong','hawaii','hutong'][n%4]);
 await travel('rest');await page.evaluate(()=>document.querySelector('.world').focus());
 await page.keyboard.down('ArrowLeft');await page.waitForFunction(()=>window.__socialPreview.bridge.state().x<=353);await page.keyboard.up('ArrowLeft');
 await page.keyboard.down('ArrowDown');await page.waitForFunction(()=>window.__socialPreview.bridge.state().y>=214);await page.keyboard.up('ArrowDown');await page.keyboard.press('e');
 await page.waitForFunction(()=>window.__socialPreview.bridge.state().seat!==null);const seated=await page.evaluate(()=>window.__socialPreview.bridge.state().seat);await page.waitForTimeout(2000);assert.equal(await page.evaluate(()=>window.__socialPreview.bridge.state().seat),seated);
 // A short SSE reconnect must preserve the chair and restore control.
 for(const stream of app.streams)stream.res.end();await page.waitForTimeout(2500);await ready();assert.equal(await page.evaluate(()=>window.__socialPreview.bridge.state().seat),seated);
 await page.keyboard.press('e');await page.waitForFunction(()=>window.__socialPreview.bridge.state().seat===null);await travel('hutong');
 const viewer=await context.newPage();await viewer.goto(origin+'/');await viewer.waitForFunction(()=>window.__socialPreview?.bridge.connected&&!window.__socialPreview.bridge.controller);await viewer.locator('#take-control').click();await viewer.waitForFunction(()=>window.__socialPreview.bridge.controller);await page.waitForFunction(()=>!window.__socialPreview.bridge.controller);await viewer.close();await page.waitForFunction(()=>window.__socialPreview.bridge.controller);
 await page.evaluate(()=>document.querySelector('.world').focus());const before=await page.evaluate(()=>window.__socialPreview.bridge.state().x);await page.keyboard.down('ArrowLeft');await page.waitForTimeout(200);await page.keyboard.up('ArrowLeft');assert.ok(await page.evaluate(()=>window.__socialPreview.bridge.state().x)<before);
 await page.locator('#chat-open').click();const alignment=await page.evaluate(()=>{const fields=['#chat-input','#chat-form button'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};});return {fields,overflow:document.documentElement.scrollWidth>innerWidth};});
 await page.screenshot({path:directory+'/chat-desktop.png'});await page.setViewportSize({width:390,height:844});
 const mobileAlignment=await page.evaluate(()=>{const panel=document.querySelector('#chat-panel').getBoundingClientRect(),mark=document.querySelector('#scene-mark').getBoundingClientRect(),view=document.querySelector('#view').getBoundingClientRect();return{left:panel.left,right:innerWidth-panel.right,sceneTop:mark.top,viewTop:view.top};});assert.ok(Math.abs(mobileAlignment.left-mobileAlignment.right)<=1);assert.ok(Math.abs(mobileAlignment.sceneTop-mobileAlignment.viewTop)<=1);
 await page.screenshot({path:directory+'/chat-mobile.png'});await page.setViewportSize({width:320,height:700});await page.screenshot({path:directory+'/chat-320px.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.setViewportSize({width:390,height:844});
 await page.locator('#chat-panel [data-close]').click();await page.locator('#more-tools summary').click();await page.locator('#settings-open').click();await page.locator('#account-open').click();await page.locator('#logout').click();await page.locator('#account-name').fill('');await page.locator('#account-name').pressSequentially('wasd');assert.equal(await page.locator('#account-name').inputValue(),'wasd');await page.screenshot({path:directory+'/login-after-travel-mobile.png'});
 assert.deepEqual(errors,[]);assert.equal(responses.filter(r=>r.status>=400).length,0,JSON.stringify(responses.filter(r=>r.status>=400)));
 const report={loginAndRegistrationWASD:true,noSceneTyping:true,pausedRevisit:true,failedTextureRetry:true,repeatedTravel:60,revisitCollisionStable:true,seatStable:true,reconnectPreservesSeat:true,twoTabControlRecovers:true,typingAfterLogout:true,alignment,mobileAlignment,errors};await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){console.error(JSON.stringify({errors,failedResponses:responses.filter(r=>r.status>=400),state:await page.evaluate(()=>window.__socialPreview?.getState()),notice:await page.locator('#game-notice').textContent()}));throw error;}
finally{await browser.close();await vite.close();app.close();app.server.closeAllConnections();}
