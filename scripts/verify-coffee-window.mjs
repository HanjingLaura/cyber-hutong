import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as createNetServer} from 'node:net';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {loadPlaywright} from './playwright.mjs';

const directory='output/coffee-window';await mkdir(directory,{recursive:true});
const fixture=await mkdtemp(join(tmpdir(),'hutong-coffee-browser-'));
const app=createMvpServer({dbPath:join(fixture,'state.sqlite'),llmOptions:{key:''}});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const probe=createNetServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const vitePort=probe.address().port;await new Promise(r=>probe.close(r));
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{host:'127.0.0.1',port:vitePort,strictPort:true,hmr:false,watch:null,proxy:{'/api':{target:`http://127.0.0.1:${app.server.address().port}`,changeOrigin:false}}}});await vite.listen();
const origin=`http://127.0.0.1:${vite.httpServer.address().port}`;
const browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const errors=[],requests=[];const report={fixture,normalExitTravel:false,realKeyOrder:false,realKeyPickup:false,committedResponseRecovery:false,giftAccepted:false,handFull:false,repeatedE:false,offlineRecoveryMs:null,viewerBlocked:false,errors};
async function account(name,role){const session=await app.store.register(name,'coffee-browser-password',role);const context=await browser.newContext({viewport:{width:1280,height:800}});await context.addCookies([{name:'hutong_session',value:session.token,url:origin}]);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/coffee-orders'))requests.push({method:r.method(),body:r.postDataJSON?.()});});return{session,context,page};}
const sender=await account('CoffeeLaura','laura'),friend=await account('CoffeeSid','sid');
const page=sender.page;let releaseLate;
async function ready(p){await p.goto(origin,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__socialPreview?.bridge.connected&&window.__socialPreview.bridge.state()&&window.__socialPreview.bridge.user?.role&&!window.__socialPreview.bridge.transitioning);}
async function focus(p=page){await p.locator('.world').focus();}
async function walk(key,axis,target,sign,p=page){await focus(p);await p.keyboard.down(key);try{await p.waitForFunction(({axis,target,sign})=>{const p=window.__socialPreview.bridge.state();return p&&(sign>0?p[axis]>=target:p[axis]<=target);},{axis,target,sign},{timeout:15000});}finally{await p.keyboard.up(key);}await p.waitForTimeout(250);}
async function choose(target,p=page){const card=p.locator(`[data-place="${target}"]`);await card.click();await card.click();await p.waitForFunction(target=>window.__socialPreview.bridge.state()?.scene===target&&!window.__socialPreview.bridge.transitioning&&!document.querySelector('#location-map').open,target);await p.waitForTimeout(300);}
async function exitTo(target,p=page){await focus(p);await p.keyboard.press('e');await p.locator('#location-map[open]').waitFor();await choose(target,p);}
async function openCoffee(){await focus();await page.keyboard.press('e');await page.locator('.coffee-window[open]').waitFor();await page.waitForFunction(()=>{const d=document.querySelector('.coffee-window[open]');return d&&!/同步|处理/.test(d.querySelector('[data-status]').textContent)&&!d.querySelector('button[data-action]:disabled')?.textContent.includes('查看');});}
async function closeCoffee(){await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.coffee-window[open]'));await focus();}
const hand=p=>p.evaluate(()=>window.__socialPreview.bridge.user.hand);
try{
 await Promise.all([ready(page),ready(friend.page)]);
 await focus(friend.page);await friend.page.keyboard.press('Escape');const sidY=await friend.page.evaluate(()=>window.__socialPreview.bridge.state().y);if(sidY>178)await walk('ArrowUp','y',177,-1,friend.page);else if(sidY<176)await walk('ArrowDown','y',177,1,friend.page);await walk('ArrowRight','x',596,1,friend.page);await walk('ArrowDown','y',194,1,friend.page);await exitTo('rest',friend.page);await walk('ArrowLeft','x',520,-1,friend.page);
 console.log('ready',await page.evaluate(()=>window.__socialPreview.bridge.state()));
 assert.equal(await page.locator('#quick-travel').isChecked(),false);
 await focus();await page.keyboard.press('Escape');
 const initialY=await page.evaluate(()=>window.__socialPreview.bridge.state().y);if(initialY>178)await walk('ArrowUp','y',177,-1);else if(initialY<176)await walk('ArrowDown','y',177,1);
 await walk('ArrowRight','x',596,1);await walk('ArrowDown','y',194,1);await exitTo('manner');report.normalExitTravel=true;
 console.log('entered manner');
 await walk('ArrowLeft','x',260,-1);await walk('ArrowUp','y',216,-1);await openCoffee();
 await page.locator('.coffee-window [data-action="order"]').click();await page.waitForFunction(()=>document.querySelector('.coffee-window [data-status]')?.textContent.includes('已做好'));report.realKeyOrder=true;
 await closeCoffee();await walk('ArrowRight','x',440,1);await openCoffee();
 // Commit at the isolated server, then lose the response. Client must GET before resolving.
 let lost=false;await page.route(url=>url.pathname.replace(/\/+$/,'')==='/api/coffee-orders',async route=>{if(route.request().method()==='POST'&&route.request().postDataJSON().action==='take'&&!lost){lost=true;await route.fetch();await route.abort('failed');}else await route.continue();});
 await page.locator('.coffee-window [data-action="take"]').click();await page.waitForFunction(()=>window.__socialPreview.bridge.user.hand==='咖啡');await page.locator('.coffee-window [data-action="sync"]').waitFor();report.realKeyPickup=true;report.committedResponseRecovery=lost;assert.equal(lost,true);
 assert.equal(app.store.db.prepare("SELECT COUNT(*) n FROM coffee_orders WHERE account=? AND status='taken'").get(sender.session.user.id).n,1);
 const takeAt=requests.findIndex(r=>r.body?.action==='take');assert.equal(requests[takeAt+1].method,'GET');
 await closeCoffee();await walk('ArrowLeft','x',260,-1);await openCoffee();report.handFull=(await page.locator('.coffee-window [data-status]').innerText()).includes('先收好');assert.equal(await page.locator('.coffee-window [data-action="order"]').isDisabled(),true);
 const before=requests.filter(r=>r.method==='POST').length;await page.keyboard.press('e');await page.keyboard.press('e');await page.waitForTimeout(250);assert.equal(requests.filter(r=>r.method==='POST').length,before);report.repeatedE=true;
 await page.screenshot({path:directory+'/desktop-panel.png'});await closeCoffee();
 await page.screenshot({path:directory+'/desktop.png'});
 await page.setViewportSize({width:390,height:844});await openCoffee();await page.screenshot({path:directory+'/mobile-panel.png'});
 const bounds=await page.locator('.coffee-window').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);await closeCoffee();await page.screenshot({path:directory+'/mobile.png'});await page.setViewportSize({width:1280,height:800});
 // Render only the actual scene background into the new memory preview.
 await page.evaluate(()=>{const b=window.__socialPreview.bridge,s=b.active,c=s.cameras.main,parts=new Set();for(const map of [b.views.get(s),b.mirrors.get(s)])for(const a of map?.values()??[]){for(const name of ['body','upper','prop','arm','label'])if(a[name])parts.add(a[name]);for(const group of [a.legs,a.held])for(const value of Object.values(group??{}))if(value?.scene===s&&typeof value.setVisible==='function')parts.add(value);}window.__coffeeIgnored=[...parts];c.ignore([...parts]);});
 await page.waitForTimeout(100);const clean=await page.locator('#game canvas').evaluate(c=>c.toDataURL().split(',')[1]);await mkdir('assets/maps/memories',{recursive:true});await writeFile('assets/maps/memories/manner.png',Buffer.from(clean,'base64'));await writeFile(directory+'/manner-scenery.png',Buffer.from(clean,'base64'));
 await page.evaluate(()=>{const c=window.__socialPreview.bridge.active.cameras.main;for(const p of window.__coffeeIgnored)p.cameraFilter&=~c.id;delete window.__coffeeIgnored;});
 await openCoffee();await sender.context.setOffline(true);await page.waitForFunction(()=>!window.__socialPreview.bridge.connected&&!document.querySelector('.coffee-window[open]'));await page.waitForTimeout(300);const offlineAt=Date.now();await sender.context.setOffline(false);await page.waitForFunction(()=>window.__socialPreview.bridge.connected);report.offlineRecoveryMs=Date.now()-offlineAt;assert.ok(report.offlineRecoveryMs<10000);assert.equal(await hand(page),'咖啡');
 await walk('ArrowDown','y',330,1);await walk('ArrowRight','x',580,1);await exitTo('rest');assert.equal(await hand(page),'咖啡');
 await friend.page.bringToFront();await focus(friend.page);await friend.page.keyboard.press('Escape');const friendPose=await friend.page.evaluate(()=>window.__socialPreview.bridge.state());assert.equal(friendPose.scene,'rest');
 if(Math.abs(friendPose.y-184)>2)await walk(friendPose.y>184?'ArrowUp':'ArrowDown','y',184,friendPose.y>184?-1:1,friend.page);
 if(Math.abs(friendPose.x-520)>2)await walk(friendPose.x>520?'ArrowLeft':'ArrowRight','x',520,friendPose.x>520?-1:1,friend.page);
 await page.bringToFront();await focus();
 await page.waitForFunction(()=>!document.querySelector('#near-social').hidden);await page.locator('#near-more summary').click();await page.locator('[data-near="gift"]').click();
 await friend.page.locator('#life-offers button').filter({hasText:'接受'}).waitFor();await friend.page.locator('#life-offers button').filter({hasText:'接受'}).click();await friend.page.waitForFunction(()=>window.__socialPreview.bridge.user.hand==='咖啡');await page.waitForFunction(()=>window.__socialPreview.bridge.user.hand===null);report.giftAccepted=true;await friend.page.screenshot({path:directory+'/gift-accepted.png'});
 // Return by the normal exit, then revoke control while the order panel is open.
 await exitTo('manner');await walk('ArrowLeft','x',260,-1);await walk('ArrowUp','y',216,-1);await openCoffee();
 await page.route('**/api/coffee-orders/**',async route=>{if(route.request().method()!=='POST'||route.request().postDataJSON()?.action!=='order')return route.continue();const response=await route.fetch();await new Promise(r=>releaseLate=r);await route.fulfill({response});});
 await page.locator('.coffee-window [data-action="order"]').click();while(!releaseLate)await page.waitForTimeout(30);await page.locator('.coffee-window [data-close]').click();await page.waitForFunction(()=>!document.querySelector('.coffee-window[open]'));
 await walk('ArrowDown','y',330,1);await walk('ArrowRight','x',580,1);await exitTo('noodle');releaseLate();releaseLate=undefined;await page.waitForTimeout(500);assert.equal(await page.locator('.coffee-window[open]').count(),0);assert.equal(await page.evaluate(()=>window.__socialPreview.bridge.state().scene),'noodle');await page.unroute('**/api/coffee-orders/**');
 await exitTo('manner');await walk('ArrowLeft','x',440,-1);await walk('ArrowUp','y',216,-1);await openCoffee();assert.ok((await page.locator('.coffee-window [data-status]').innerText()).includes('已做好'));assert.equal(app.store.db.prepare("SELECT COUNT(*) n FROM coffee_orders WHERE account=? AND status='pending'").get(sender.session.user.id).n,1);
 await page.locator('.coffee-window [data-action="cancel"]').click();await page.waitForFunction(()=>document.querySelector('.coffee-window [data-status]')?.textContent.includes('已取消'));await closeCoffee();report.lateOrderSceneRecovery=true;report.cancelOrder=true;
 await walk('ArrowLeft','x',260,-1);await openCoffee();
 await page.evaluate(async()=>{await fetch('/api/control/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client:'isolated-viewer-owner'})});});await page.waitForFunction(()=>!window.__socialPreview.bridge.controller&&!document.querySelector('.coffee-window[open]'));await focus();await page.keyboard.press('e');assert.equal(await page.locator('.coffee-window[open]').count(),0);
 const viewerStatus=await page.evaluate(async()=>{const p=window.__socialPreview;return(await fetch('/api/coffee-orders/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client:p.getState().client,action:'order',revision:p.bridge.user.revision,requestId:'viewer-must-fail'})})).status;});assert.equal(viewerStatus,409);report.viewerBlocked=true;
 assert.deepEqual(errors,[]);report.requests=requests;report.orders=app.store.db.prepare('SELECT status,version FROM coffee_orders').all();report.modelCalls=app.store.db.prepare('SELECT COALESCE(SUM(calls),0) n FROM llm_usage').get().n;assert.equal(report.modelCalls,0);await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(e){report.error=e.message;report.requests=requests;report.state=await page.evaluate(()=>window.__socialPreview?.bridge.state());report.friend=await friend.page.evaluate(()=>window.__socialPreview?.bridge.state());report.notice=await page.locator('#game-notice').textContent();await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));await page.screenshot({path:directory+'/failure.png'});console.error(report);throw e;}
finally{releaseLate?.();await browser.close();await vite.close();app.close();app.server.closeAllConnections();}
