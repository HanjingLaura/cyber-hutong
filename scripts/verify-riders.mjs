import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {loadPlaywright} from './playwright.mjs';

const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});
await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{watch:null,hmr:false,host:'127.0.0.1',port:5198,strictPort:true,proxy:{'/api':{target:`http://127.0.0.1:${app.server.address().port}`,changeOrigin:false}}}});
await vite.listen();
const browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
const dir='output/riders';await mkdir(dir,{recursive:true});
const errors=[],riders=[],rideRequests=[];
const preview=page=>page.evaluate(()=>window.__memoryPlacePreviews.street.getState());
const ride=async page=>(await (await page.request.get('http://127.0.0.1:5198/api/ride/')).json()).ride;
async function walk(page,key,axis,target,sign){
 await page.evaluate(()=>document.querySelector('.world').focus());await page.keyboard.down(key);
 try{await page.waitForFunction(({axis,target,sign})=>{const p=window.__socialPreview.bridge.state();return sign>0?p[axis]>=target:p[axis]<=target;},{axis,target,sign},{timeout:15000});}
 finally{await page.keyboard.up(key);}await page.waitForTimeout(350);
}
async function travel(page,target){
 await page.locator('#room-open').click();const button=page.locator(`[data-place="${target}"]`);await button.click();await button.click();
 await page.waitForFunction(target=>window.__socialPreview.bridge.state()?.scene===target&&!window.__socialPreview.bridge.transitioning&&!document.querySelector('#location-map').open,target);
}
try{
 for(const [name,slot] of [['Sid','driver'],['Laura','rear'],['Cora','front']]){
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();riders.push({name,slot,context,page});page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>{if(request.method()==='POST'&&request.url().includes('/api/ride/'))rideRequests.push({at:Date.now(),name,action:request.postDataJSON()?.action});});
  await page.goto('http://127.0.0.1:5198/',{waitUntil:'domcontentloaded'});await page.locator('#account-dialog[open]').waitFor();
  await page.locator('#account-register').click();await page.locator('#account-name').fill(name);await page.locator('#account-invite').fill('synthetic-riders-test');await page.locator('#account-password').fill('asdwASDW1234');await page.locator('#account-confirm').fill('asdwASDW1234');await page.locator('#account-submit').click();
  await page.waitForFunction(()=>{const b=window.__socialPreview?.bridge;return b?.connected&&b.user?.role&&b.controller&&b.state()&&!b.pendingSpawn&&!b.transitioning;},null,{timeout:60000});
  await page.locator('#more-tools summary').click();await page.locator('#settings-open').click();await page.locator('#quick-travel').check();await page.locator('#settings-dialog [data-close]').click();
  await travel(page,'street');await walk(page,'ArrowLeft','x',320,-1);await walk(page,'ArrowUp','y',310,-1);
  await page.keyboard.press('e');await page.waitForFunction(slot=>window.__memoryPlacePreviews.street.getState().slot===slot,slot);
  if(slot==='driver'){await page.waitForTimeout(500);await page.screenshot({path:dir+'/single-rider.png'});}
 }
 const [driver,rear,front]=riders;
 // Keep acknowledgments in flight to exercise controls under ordinary network lag.
 await driver.page.route('**/api/ride/',async route=>{
  const request=route.request();
  if(request.method()==='POST'&&request.postDataJSON()?.action==='drive'){
   const response=await route.fetch();await driver.page.waitForTimeout(450);await route.fulfill({response});
  }else await route.continue();
 });
 const joined=await ride(driver.page);assert.equal(Object.values(joined.seats).filter(Boolean).length,3);assert.deepEqual(Object.fromEntries(Object.entries(joined.seats).map(([slot,r])=>[slot,r.role])),{driver:'sid',front:'cora',rear:'laura'});
 await front.page.keyboard.down('ArrowUp');await front.page.waitForTimeout(650);await front.page.keyboard.up('ArrowUp');
 const passengerInput=await ride(driver.page);assert.ok(Math.hypot(passengerInput.x-joined.x,passengerInput.y-joined.y)<1,'passenger cannot drive');assert.equal((await preview(front.page)).speed,0);
 await driver.page.evaluate(()=>document.querySelector('.world').focus());await driver.page.keyboard.down('d');await driver.page.waitForTimeout(650);await driver.page.keyboard.up('d');
 const driverSpeed=(await preview(driver.page)).speed;assert.ok(driverSpeed>0,'driver accelerates');
 await driver.page.waitForTimeout(1700);
 const moved=await ride(driver.page);assert.ok(Math.hypot(moved.x-joined.x,moved.y-joined.y)>1,'scooter moves');
 for(const r of [front,rear]){const p=await preview(r.page),anchor=moved.seats[r.slot];assert.ok(Math.hypot(p.x-anchor.x,p.y-anchor.y)<3,`${r.name} follows server anchor`);}
 assert.ok((await preview(driver.page)).speed<=8,'driver brakes before leaving');
 await driver.page.screenshot({path:dir+'/three-riders.png'});
 await driver.page.screenshot({path:dir+'/three-riders-detail.png',clip:{x:570,y:430,width:280,height:200}});
 await rear.context.close();
 const rearDeadline=Date.now()+20000;let rearReleased=false;
 while(Date.now()<rearDeadline){if(!(await ride(driver.page)).seats.rear){rearReleased=true;break;}await driver.page.waitForTimeout(100);}
 assert.equal(rearReleased,true,'closed rear rider must release after its lease expires');
 await driver.page.keyboard.press('e');await driver.page.waitForFunction(()=>!window.__memoryPlacePreviews.street.getState().riding);
 const driverLeft=await ride(front.page);assert.equal(driverLeft.seats.driver,null);assert.equal(driverLeft.seats.front.role,'cora');
 await front.page.evaluate(()=>document.querySelector('.world').focus());await front.page.keyboard.press('e');await front.page.waitForFunction(()=>!window.__memoryPlacePreviews.street.getState().riding);
 const finalSeats=(await ride(front.page)).seats;assert.equal(Object.values(finalSeats).filter(Boolean).length,0,JSON.stringify(finalSeats));
 const parked=await ride(driver.page);
 await driver.page.evaluate(()=>document.querySelector('.world').focus());
 await driver.page.keyboard.down('w');await driver.page.waitForTimeout(650);await driver.page.keyboard.up('w');
 const blockedWalker=await preview(driver.page);
 assert(blockedWalker.y>=parked.y+12-.1,'walking from the dismount point stops at the scooter body');
 assert(blockedWalker.y<parked.y+20,'dismount remains close enough to board again');
 await driver.page.keyboard.press('e');await driver.page.waitForFunction(()=>window.__memoryPlacePreviews.street.getState().riding);
 const edges={};
 for(const [key,duration,axis,bound] of [['d',2200,'x',584],['w',1000,'y',233],['a',4500,'x',56],['s',1400,'y',345]]){
  await driver.page.keyboard.down(key);await driver.page.waitForTimeout(duration);await driver.page.keyboard.up(key);await driver.page.waitForTimeout(200);
  const p=await preview(driver.page);assert(Math.abs(p[axis]-bound)<2,`${key} stops full vehicle at its ground boundary: ${p[axis]}`);assert.equal(p.speed,0);edges[key]=p;
 }
 await driver.page.screenshot({path:dir+'/boundary-collision.png'});
 await driver.page.keyboard.press('e');await driver.page.waitForFunction(()=>!window.__memoryPlacePreviews.street.getState().riding);
 await travel(driver.page,'hutong');await travel(front.page,'hutong');assert.deepEqual(errors,[]);
 const report={threeBrowserRegistrations:true,seats:{driver:'sid',basket:'cora',rear:'laura'},passengerCannotDrive:true,driverSpeed,passengersFollowServerAnchors:true,brakeBeforeLeave:true,closedWindowReleasesRear:true,driverLeavesPassengerSeated:true,remainingPassengerCanLeave:true,allSeatsReleased:true,fullVehicleBoundaries:edges,mapExitAfterLeave:true,errors};
 await writeFile(dir+'/verification.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}catch(e){console.error(e);console.error(JSON.stringify({rideRequests}));for(const r of riders){if(r.page.isClosed())continue;console.error(r.name,await r.page.evaluate(()=>({rider:window.__memoryPlacePreviews?.street?.getState(),player:window.__socialPreview?.bridge.state(),notice:document.querySelector('#game-notice')?.textContent,mapError:document.querySelector('#location-map [data-error]')?.textContent,diagnostics:window.__interactionDiagnostics?.()})).catch(()=>null));await r.page.screenshot({path:`${dir}/failure-${r.name}.png`}).catch(()=>{});}throw e;}
finally{await browser.close();await vite.close();app.close();app.server.closeAllConnections();}
