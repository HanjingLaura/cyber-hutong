import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {loadPlaywright} from './playwright.mjs';
const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});
await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{host:'127.0.0.1',port:5199,strictPort:true,proxy:{'/api':{target:`http://127.0.0.1:${app.server.address().port}`,changeOrigin:false}}}});
await vite.listen();const browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],dir='output/campus';await mkdir(dir,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
const state=()=>page.evaluate(()=>window.__memoryPlacePreviews.campus.getState());
async function hold(key,milliseconds){await page.keyboard.down(key);await page.waitForTimeout(milliseconds);await page.keyboard.up(key);}
async function walk(key,axis,target,sign){await page.keyboard.down(key);try{await page.waitForFunction(({axis,target,sign})=>{const s=window.__memoryPlacePreviews.campus.getState();return sign>0?s[axis]>=target:s[axis]<=target;},{axis,target,sign},{timeout:12000});}finally{await page.keyboard.up(key);}}
try{
 await page.goto('http://127.0.0.1:5199/',{waitUntil:'domcontentloaded'});await page.locator('#account-dialog[open]').waitFor();
 await page.locator('#account-register').click();await page.locator('#account-name').fill('Sid');await page.locator('#account-invite').fill('synthetic-campus-test');await page.locator('#account-password').fill('asdwASDW1234');await page.locator('#account-confirm').fill('asdwASDW1234');await page.locator('#account-submit').click();
 await page.waitForFunction(()=>{const b=window.__socialPreview?.bridge;return b?.connected&&b.user?.role&&b.controller&&b.state()&&!b.pendingSpawn&&!b.transitioning;},null,{timeout:60000});
 await page.locator('#more-tools summary').click();await page.locator('#settings-open').click();await page.locator('#quick-travel').check();await page.locator('#settings-dialog [data-close]').click();
 await page.locator('#room-open').click();const destination=page.locator('[data-place="campus"]');await destination.click();await destination.click();
 await page.waitForFunction(()=>window.__socialPreview.bridge.state()?.scene==='campus'&&!window.__socialPreview.bridge.transitioning&&!document.querySelector('#location-map').open);
 await page.evaluate(()=>document.querySelector('.world').focus());await walk('ArrowLeft','x',320,-1);await walk('ArrowUp','y',310,-1);
 await page.keyboard.press('e');await page.waitForFunction(()=>window.__memoryPlacePreviews.campus.getState().riding);
 const initial=await state();await page.waitForTimeout(300);assert.equal((await state()).speed,0,'mount does not auto-accelerate');
 const checks=[];
 for(const [key,axis,sign] of [['a','x',-1],['w','y',-1],['d','x',1],['s','y',1]]){
  const before=await state();await hold(key,500);await page.waitForTimeout(200);const after=await state();
  assert((after[axis]-before[axis])*sign>20,key+' moves in the requested direction');assert.equal(after.speed,0,'release stops board');checks.push(key);
  const deck=await page.evaluate(()=>{const board=window.__socialPreview.bridge.active.board;return {rotation:board.rotation,width:board.displayWidth,height:board.displayHeight};});
  assert.deepEqual(deck,{rotation:0,width:48,height:16},'board remains horizontal at a fixed size');
 }
 await hold('a',4000);await page.waitForTimeout(200);const leftEdge=await state();assert(leftEdge.x>=35&&leftEdge.x<45,'whole board stops at left pavement edge');
 await hold('w',3000);await page.waitForTimeout(200);const sceneryEdge=await state();assert(sceneryEdge.y>250,'cannot skate into left greenery/background');
 await page.screenshot({path:dir+'/background-collision.png'});
 await hold('s',150);await page.waitForTimeout(200);
 await hold('d',3000);await page.waitForTimeout(200);const coneEdge=await state();assert(coneEdge.x>145&&coneEdge.x<190,'board tip stops before the first visible cone');
 await page.screenshot({path:dir+'/cone-collision.png'});
 await hold('s',800);await page.waitForTimeout(200);
 await hold('ArrowLeft',650);await page.waitForTimeout(200);const stopped=await state();assert.equal(stopped.speed,0);assert(stopped.x<280);
 await page.keyboard.press('e');await page.waitForFunction(()=>!window.__memoryPlacePreviews.campus.getState().riding);
 await page.keyboard.press('e');await page.waitForFunction(()=>window.__memoryPlacePreviews.campus.getState().riding,null,{timeout:2000});
 const remounted=await state();assert(Math.hypot(remounted.x-stopped.x,remounted.y-stopped.y)<2,'remount stays at actual parked board');
 await page.keyboard.press('f');await page.waitForFunction(()=>window.__memoryPlacePreviews.campus.getState().mode==='skate-sit');await page.keyboard.press('f');await page.waitForFunction(()=>window.__memoryPlacePreviews.campus.getState().mode==='skateboard');
 await page.screenshot({path:dir+'/parked-remount.png'});assert.deepEqual(errors,[]);
 const report={noAutoAcceleration:true,directWASD:checks,releaseStops:true,arrowKeys:true,leftEdge,sceneryEdge,coneEdge,parkedBoardRemount:true,sittingToggle:true,errors};await writeFile(dir+'/verification.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}catch(e){await page.screenshot({path:dir+'/failure.png'}).catch(()=>{});console.error(await state().catch(()=>null));throw e;}
finally{await browser.close();await vite.close();app.close();app.server.closeAllConnections();}
