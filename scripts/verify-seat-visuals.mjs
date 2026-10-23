import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {loadPlaywright} from './playwright.mjs';
const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{host:'127.0.0.1',port:5199,strictPort:true,proxy:{'/api':{target:`http://127.0.0.1:${app.server.address().port}`,changeOrigin:false}}}});await vite.listen();
const browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']}),context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
const errors=[],report=[];page.on('pageerror',e=>errors.push(e.message));const dir='output/seat-fix-2026-10-14';await mkdir(dir,{recursive:true});
async function walk(key,axis,target,sign){await page.evaluate(()=>document.querySelector('.world').focus());await page.keyboard.down(key);try{await page.waitForFunction(({axis,target,sign})=>{const p=window.__socialPreview.bridge.state();return sign>0?p[axis]>=target:p[axis]<=target;},{axis,target,sign},{timeout:15000});}finally{await page.keyboard.up(key);}await page.waitForTimeout(350);}
async function travel(target){await page.locator('#room-open').click();const b=page.locator(`[data-place="${target}"]`);await b.click();await b.click();await page.waitForFunction(target=>window.__socialPreview.bridge.state()?.scene===target&&!window.__socialPreview.bridge.transitioning&&!document.querySelector('#location-map').open,target);}
try{
 await page.goto('http://127.0.0.1:5199/',{waitUntil:'domcontentloaded'});await page.locator('#account-dialog[open]').waitFor();await page.locator('#account-register').click();await page.locator('#account-name').fill('Laura');await page.locator('#account-invite').fill('synthetic-seat-visual-test');await page.locator('#account-password').fill('asdwASDW1234');await page.locator('#account-confirm').fill('asdwASDW1234');await page.locator('#account-submit').click();
 await page.waitForFunction(()=>{const b=window.__socialPreview?.bridge;return b?.connected&&b.user?.role&&b.controller&&b.state()&&!b.pendingSpawn&&!b.transitioning;},null,{timeout:60000});
 await page.locator('#more-tools summary').click();await page.locator('#settings-open').click();await page.locator('#quick-travel').check();await page.locator('#settings-dialog [data-close]').click();
 for(const [scene,seat,x,y] of [['google','G1',185,275],['meeting','M1',176,310]]){
  await travel(scene);await walk('ArrowLeft','x',x,-1);await walk('ArrowUp','y',y,-1);await page.mouse.move(1250,780);await page.screenshot({path:`${dir}/${scene}-standing.png`});
  const chairs=await page.evaluate(scene=>window.__memoryPlacePreviews[scene].getState().chairs,scene);assert.equal(chairs.length,4);
  for(const c of chairs){assert.ok(c.width<=48.00001,`${scene} ${c.id} width`);assert.ok(c.height<=52.80001,`${scene} ${c.id} height`);}
  const layers=[];
  for(let cycle=0;cycle<3;cycle++){
   await page.keyboard.press('e');await page.waitForFunction(seat=>window.__socialPreview.bridge.state().seat===seat,seat);await page.waitForTimeout(1200);
   const server=(await(await page.request.get('http://127.0.0.1:5199/api/location/')).json()).player;assert.equal(server.seat,seat,'server keeps seated position');
   const layer=await page.evaluate(({scene,seat})=>{const b=window.__socialPreview.bridge,c=window.__memoryPlacePreviews[scene].getState().chairs.find(c=>c.id===seat),v=b.views.get(b.active).get('laura');return{chair:c,bodyDepth:v.body.depth,upperDepth:v.upper.depth,bodyVisible:v.body.visible,upperVisible:v.upper.visible};},{scene,seat});
   assert.equal(layer.chair.backVisible,true,'foreground back visible');assert.ok(layer.chair.backDepth>layer.bodyDepth,'chair back in front of avatar body');layers.push(layer);
   if(cycle===0)await page.screenshot({path:`${dir}/${scene}-seated.png`});
   await page.keyboard.press('e');await page.waitForFunction(()=>window.__socialPreview.bridge.state().seat===null);await page.waitForTimeout(500);
   assert.equal((await page.evaluate(({scene,seat})=>window.__memoryPlacePreviews[scene].getState().chairs.find(c=>c.id===seat).backVisible,{scene,seat})),false,'standing hides occupied back');
  }
  const before=await page.evaluate(()=>window.__socialPreview.bridge.state().x);await page.keyboard.down('ArrowRight');await page.waitForTimeout(200);await page.keyboard.up('ArrowRight');assert.ok((await page.evaluate(()=>window.__socialPreview.bridge.state().x))>before+2,'keyboard movement remains functional');
  report.push({scene,seat,chairs,sitStandCycles:3,serverSeatStable:true,foregroundBackAboveBody:true,keyboardFunctional:true,layers});
 }
 await travel('hutong');assert.deepEqual(errors,[]);const result={places:report,chairsChecked:8,sitStandCycles:6,sceneChanges:3,errors};await writeFile(dir+'/verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch(e){console.error(e);console.error(await page.evaluate(()=>({state:window.__socialPreview?.bridge.state(),notice:document.querySelector('#game-notice')?.textContent,mapError:document.querySelector('#location-map [data-error]')?.textContent})));await page.screenshot({path:dir+'/failure.png'});throw e;}
finally{await browser.close();await vite.close();app.close();app.server.closeAllConnections();}
