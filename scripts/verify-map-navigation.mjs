import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import rooms from '../shared/rooms.json' with {type:'json'};
import {loadPlaywright} from './playwright.mjs';

const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}}),errors=[],transitions=[];
await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{host:'127.0.0.1',port:5193,strictPort:true,proxy:{'/api':{target:`http://127.0.0.1:${app.server.address().port}`,changeOrigin:false}}}});await vite.listen();
const browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),origin='http://127.0.0.1:5193';
page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('/api/transition'))transitions.push(request.postDataJSON());});
const directory='output/map-navigation';await mkdir(directory,{recursive:true});
try{
 const response=await context.request.post(origin+'/api/register/',{data:{username:'map_trial_suki',password:'synthetic-map-password',role:'suki'}});assert.equal(response.status(),200);const {user}=await response.json();
 await page.goto(origin+'/');try{await page.waitForFunction(()=>window.__socialPreview?.bridge.connected&&!window.__socialPreview.bridge.pendingSpawn&&window.__socialPreview.bridge.state());}catch(error){console.error(JSON.stringify({errors,diagnostic:await page.evaluate(()=>({state:window.__socialPreview?.getState(),body:document.body.innerText.slice(-1000)}))}));throw error;}
 // Match client/server at the initial exit without testing movement speed here.
 const player=app.players.get(user.id);Object.assign(player,{x:596,y:194,fresh:true});
 await page.evaluate(()=>{const b=window.__socialPreview.bridge;b.apply({...b.state(),x:596,y:194});b.game.canvas.tabIndex=0;b.game.canvas.focus();});
 await page.keyboard.press('e');await page.waitForFunction(()=>document.querySelector('#location-map').open);
 const rest=page.locator('[data-place="rest"]');await rest.click();
 assert.equal(await rest.locator('.place-enter').isVisible(),true);assert.match(await rest.locator('img').evaluate(img=>getComputedStyle(img).filter),/blur/);
 assert.equal(await page.evaluate(()=>window.__socialPreview.bridge.state().scene),'hutong');assert.equal(transitions.length,0);
 await page.screenshot({path:directory+'/selected-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:directory+'/selected-mobile.png'});assert.equal(await page.locator('[data-enter]').count(),0);
 await rest.click();await page.waitForFunction(()=>window.__socialPreview.bridge.state().scene==='rest'&&!window.__socialPreview.bridge.transitioning&&!document.querySelector('#location-map').open);
 assert.equal(app.players.get(user.id).scene,'rest');assert.equal(transitions.length,1);
 // Walk away and back using real input; final confirmation must not reset the
 // server's movement clock or reject a normal walk as a teleport.
 await page.evaluate(()=>document.querySelector('.world').focus());await page.keyboard.down('ArrowLeft');await page.waitForTimeout(500);await page.keyboard.up('ArrowLeft');
 const walkedX=await page.evaluate(()=>window.__socialPreview.bridge.state().x);assert.ok(walkedX<530);
 await page.keyboard.down('ArrowRight');await page.waitForFunction(()=>window.__socialPreview.bridge.state().x>=550);await page.keyboard.up('ArrowRight');await page.waitForTimeout(250);
 // E must continue to work after arrival and when the canvas owns keyboard focus.
 await page.evaluate(()=>window.__socialPreview.bridge.game.canvas.focus());await page.keyboard.press('e');await page.waitForFunction(()=>document.querySelector('#location-map').open);
 await page.locator('[data-place="hutong"]').click();await page.locator('[data-place="hutong"]').click();await page.waitForFunction(()=>window.__socialPreview.bridge.state().scene==='hutong'&&!window.__socialPreview.bridge.transitioning);
 await page.setViewportSize({width:1280,height:800});
 const targets=Object.keys(rooms).filter(key=>key!=='hutong');
 for(let n=0;n<50;n++){
  const target=targets[n%targets.length];
  await page.evaluate(()=>{document.querySelector('.world').focus();});await page.keyboard.press('e');await page.waitForFunction(()=>document.querySelector('#location-map').open);
  const button=page.locator(`[data-place="${target}"]`);await button.click();await button.click();
  await page.waitForFunction(target=>window.__socialPreview.bridge.state().scene===target&&!window.__socialPreview.bridge.transitioning&&!document.querySelector('#location-map').open,target);
  assert.equal(app.players.get(user.id).scene,target);
 }
 // Typing E is never an exit command. A blocked move stays in the map with a reason.
 await page.evaluate(()=>{const b=window.__socialPreview.bridge;b.apply({...b.state(),x:320,y:300});document.querySelector('.world').focus();});
 await page.locator('#room-open').click();const blockedTarget=targets.find(key=>key!==app.players.get(user.id).scene),blocked=page.locator(`[data-place="${blockedTarget}"]`);
 await blocked.click();await blocked.click();assert.equal(await page.locator('#location-map').evaluate(d=>d.open),true);assert.match(await page.locator('[data-error]').innerText(),/出口/);
 await page.locator('#location-map [data-cancel]').click();await page.locator('#chat-open').click();await page.locator('#chat-input').fill('');await page.locator('#chat-input').press('e');assert.equal(await page.locator('#chat-input').inputValue(),'e');assert.equal(await page.locator('#location-map').evaluate(d=>d.open),false);
 await page.evaluate(async()=>{const computer=await import('/src/desk-computer.ts');computer.openDeskComputer();});
 const icons=page.locator('#desk-computer .desk-app');assert.equal(await icons.count(),6);
 assert.equal(await page.locator('[data-app="zhipin"]').getAttribute('href'),'https://www.zhipin.com/');assert.equal(await page.locator('[data-app="maimai"]').getAttribute('href'),'https://maimai.cn/');
 await page.waitForFunction(()=>[...document.querySelectorAll('#desk-computer img')].every(img=>img.complete&&img.naturalWidth>0));await page.screenshot({path:directory+'/restored-desk.png'});
 assert.deepEqual(errors,[]);
 const report={canvasExitKey:true,realWalkBeforeExit:true,selectedBlurAndOverlay:true,twoClickConfirmation:true,serverSceneMatches:true,consecutiveTransitions:50,blockedMoveExplained:true,typingDoesNotNavigate:true,sixDeskAppsRestored:true,errors};await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){console.error(JSON.stringify({errors,transitions,diagnostic:await page.evaluate(()=>({state:window.__socialPreview?.getState(),notice:document.querySelector('#game-notice')?.textContent,map:document.querySelector('#location-map')?.innerText,active:window.__socialPreview?.bridge.game.scene.getScenes(true).map(s=>s.sys.settings.key)}))}));throw error;}
finally{await browser.close();await vite.close();app.close();app.server.closeAllConnections();}
