import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createMvpServer} from '../server/app.mjs';
import {loadPlaywright} from './playwright.mjs';
import rooms from '../shared/rooms.json' with {type:'json'};
const {chromium}=loadPlaywright();
const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+app.server.address().port,base=origin+'/cyber-hutong/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
const errors=[],badResources=[],conflicts=[],result={contexts:[]};
await mkdir('output/frontend-audit',{recursive:true});
try{
 for(const [name,options]of [['desktop',{viewport:{width:1440,height:900}}],['mobile',{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}]]){
  const context=await browser.newContext(options),page=await context.newPage(),network=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',async r=>{
   if(r.status()<400)return;
   const entry={url:r.url(),status:r.status()};
   if(r.status()===409&&r.url().includes('/api/presence/')){
    const body=await r.json();entry.message=body.error;
    if(/另一个窗口|移动过快/.test(body.error)){conflicts.push(entry);return;}
   }
   badResources.push(entry);
  });
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
  cdp.on('Network.loadingFinished',e=>network.push(e.encodedDataLength));
  const started=Date.now();await page.goto(base);await page.waitForFunction(()=>document.querySelector('#account-dialog')?.open);
  await page.waitForTimeout(1700);
  assert.ok(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/hutong-wall-view-v5.*\.webp/.test(r.name))),'production room textures go through lossless compression');
  // WASD must type into login fields; Phaser key capture is disabled while the account dialog is open.
  await page.locator('#account-name').click();
  await page.keyboard.type('wasd');
  assert.equal(await page.locator('#account-name').inputValue(),'wasd');
  await page.locator('#account-name').fill('');
  const login=await page.evaluate(()=>{
   const d=document.querySelector('#account-dialog'),input=document.querySelector('#account-password');
   return {rect:d.getBoundingClientRect().toJSON(),font:getComputedStyle(input).fontSize,labelledby:d.getAttribute('aria-labelledby'),zoom:document.querySelector('meta[name=viewport]').content};
  });
  assert.ok(login.labelledby);assert.ok(!login.zoom.includes('user-scalable=no'));
  if(name==='mobile'){assert.equal(login.font,'16px');assert.equal(login.rect.height,844);}
  await page.locator('#account-register').click();assert.match(await page.locator('#account-guidance').innerText(),/10 位/);
  await page.screenshot({path:`output/frontend-audit/refined-${name}-login.png`});
  result.contexts.push({name,login,coldTransferredBytes:network.reduce((a,b)=>a+b,0),elapsedMs:Date.now()-started});
  // Local fixture only: registration and controller tests never touch production accounts.
  const account=await app.store.register('refinement_'+name,'refinement-password',name==='mobile'?'cora':'laura');
  app.autonomy.reclaim(account.user.id);
  app.players.set(account.user.id,{id:account.user.id,role:account.user.role,scene:'hutong',x:320,y:194,facing:0,seat:null,activity:'walk',moving:false,at:Date.now()});
  await context.addCookies([{name:'hutong_session',value:account.token,url:origin}]);
  await page.reload();await page.waitForFunction(()=>window.__socialPreview?.getState().connected&&window.__socialPreview.bridge.state());
  if(name==='mobile'){
   const hint=await page.locator('#orientation-hint').boundingBox();assert.ok(hint.x>=0&&hint.x+hint.width<=390);
  }
  const primary=await page.evaluate(()=>['room-open','people-open','chat-open','bag-open'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,w:r.width,h:r.height};}));
  if(name==='mobile')for(const button of primary){assert.ok(button.w>=44);assert.ok(button.h>=44);}
  await page.locator('#room-open').click();assert.ok(await page.locator('#location-map').evaluate(d=>d.open));
  await page.locator('[data-place="rest"]').click();await page.locator('[data-place="rest"]').click();
  await page.waitForFunction(()=>!document.querySelector('#location-map').open);
  assert.equal(await page.evaluate(()=>window.__socialPreview.getState().room),'hutong','map preview cannot bypass the exit');
  assert.match(await page.locator('#game-notice').innerText(),/出口/);
  await page.screenshot({path:`output/frontend-audit/refined-${name}-game.png`});
  await page.locator('#more-tools summary').click();await page.locator('#settings-open').click();
  assert.ok(await page.locator('#settings-dialog').evaluate(d=>d.open));assert.equal(await page.locator('#more-tools').evaluate(d=>d.open),false);
  await page.locator('[data-close="settings-dialog"]').click();
  if(name==='mobile'){
   const zone=await page.locator('#stick-zone').boundingBox();const before=await page.evaluate(()=>window.__socialPreview.bridge.state());
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:zone.x+80,y:zone.y+90}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:zone.x+125,y:zone.y+90}]});
   await page.waitForTimeout(300);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(120);
   const after=await page.evaluate(()=>window.__socialPreview.bridge.state());assert.ok(after.x>before.x+1,'real touch joystick moves');
   await page.waitForTimeout(250);const released=await page.evaluate(()=>window.__socialPreview.bridge.state());assert.ok(Math.abs(released.x-after.x)<1,'release stops movement');
   result.touchMove=true;result.touchRelease=true;
  }
  await context.setOffline(true);await page.waitForFunction(()=>document.querySelector('#connection-panel')?.dataset.state==='offline');
  await context.setOffline(false);await page.waitForFunction(()=>document.querySelector('#connection-panel').hidden);
  result.offlineFeedback=true;result.recovery=true;
  const observer=await context.newPage();observer.on('pageerror',e=>errors.push(e.message));await observer.goto(base);
  await observer.waitForFunction(()=>window.__socialPreview?.getState().connected);
  await observer.waitForFunction(()=>document.querySelector('#connection-panel').dataset.state==='viewer');
  await observer.locator('#take-control').click();
  await page.waitForFunction(()=>document.querySelector('#connection-panel').dataset.state==='viewer');
  await page.locator('#take-control').click();await page.waitForFunction(()=>window.__socialPreview.getState().controller);
  await observer.waitForFunction(()=>document.querySelector('#connection-panel').dataset.state==='viewer');
  result.takeControl=true;await observer.close();
  // Seed a valid exit position in the disposable store, then exercise the actual transition API.
  const exit=rooms.hutong.exit;const player=app.players.get(account.user.id);Object.assign(player,{x:exit[0],y:exit[1],at:Date.now()-3000});
  app.life.savePosition(player);
  await page.evaluate(exit=>{const b=window.__socialPreview.bridge;b.apply({...b.state(),x:exit[0],y:exit[1]});},exit);
  await page.locator('#room-open').click();await page.locator('[data-place="rest"]').click();await page.locator('[data-place="rest"]').click();
  await page.waitForFunction(()=>window.__socialPreview.getState().room==='rest'&&!window.__socialPreview.bridge.transitioning);
  result.exitTransition=true;
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
  await context.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(badResources,[]);
 result.errors=errors;result.badResources=badResources;result.fixtureConflicts=conflicts;
 await writeFile('output/frontend-audit/refinement-browser.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();app.close();}
