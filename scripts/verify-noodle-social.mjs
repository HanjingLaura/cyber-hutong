// Isolated Chrome verification. Direct pose fixtures set up approaches/counters;
// E/F, slot selection, seasoning, order save/pickup/serve and native Escape are real UI actions.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {sceneWalkable} from '../shared/walkability.mjs';
import {noodleSeats} from '../shared/noodle.mjs';
import net from 'node:net';
import {loadPlaywright} from './playwright.mjs';
const directory='output/playwright/noodle-social-'+Date.now();await mkdir(directory,{recursive:true});process.env.HUTONG_INVITE='noodle-social-isolated';
const app=createMvpServer({dbPath:directory+'/game.sqlite',llmOptions:{key:''}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const vitePort=socket.address().port;await new Promise(r=>socket.close(r));
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{watch:null,hmr:false,host:'127.0.0.1',port:vitePort,strictPort:true,proxy:{'/api':{target:`http://127.0.0.1:${app.server.address().port}`,changeOrigin:false}}}});await vite.listen();
const origin=`http://127.0.0.1:${vite.httpServer.address().port}`,browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
const lifecycleOnly=process.argv.includes('--lifecycle-only');
const focusOnly=process.argv.includes('--focus-only')||lifecycleOnly;
const report={passed:false,environment:{origin,node:process.version,chrome:browser.version(),database:'isolated file SQLite',modelKey:'empty',hmr:false,fixtures:'server+client poses only; no mutation fixture for orders, inventory, seats, or dishes'},checks:[],errors:[]},actors=[];let release;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));async function until(fn,label,ms=12000){const end=Date.now()+ms;do{if(await fn())return;await sleep(60);}while(Date.now()<end);throw Error('Timeout: '+label);}
const state=a=>a.page.evaluate(()=>window.__socialPreview.bridge.state());
const ready=a=>a.page.waitForFunction(()=>{const b=window.__socialPreview?.bridge;return b?.connected&&b.controller&&!b.pendingSpawn&&!b.transitioning&&b.state()?.scene==='noodle';},{},{timeout:30000});
async function fixture(a,x,y){await a.page.bringToFront();assert.equal(sceneWalkable('noodle',x,y),true,'fixture must be walkable: '+x+','+y);await a.page.evaluate(async()=>{const{onlineWorld}=await import('/src/multiplayer/world-client.ts');await onlineWorld().checkpointPosition();});const p=app.players.get(a.user.id);Object.assign(p,{scene:'noodle',x,y,seat:null,facing:0,moving:false,fresh:true,at:Date.now()-3000});app.life.savePosition(p);await a.page.evaluate(({x,y})=>{const b=window.__socialPreview.bridge,s=b.active;s.seated=null;b.apply({...b.state(),scene:'noodle',x,y,seat:null,facing:0});},{x,y});for(let attempt=0;attempt<3;attempt++){try{await a.page.evaluate(async()=>{const{onlineWorld}=await import('/src/multiplayer/world-client.ts');await onlineWorld().checkpointPosition();});break;}catch(error){if(attempt===2||!String(error).includes('移动过快'))throw error;const current=app.players.get(a.user.id);Object.assign(current,{scene:'noodle',x,y,seat:null,fresh:true,at:Date.now()-3000});app.life.savePosition(current);}}await sleep(250);}
async function key(a,k){await a.page.bringToFront();await a.page.locator('.world').focus();await a.page.keyboard.press(k);await a.page.evaluate(async()=>{const{onlineWorld}=await import('/src/multiplayer/world-client.ts');await onlineWorld().checkpointPosition();});}
async function focus(a){await until(()=>a.page.evaluate(()=>document.activeElement===document.querySelector('.world')),'world focus');}
async function openOrders(a){await a.page.bringToFront();await a.page.locator('#noodle-order-action').click();await a.page.locator('#noodle-orders[open]').waitFor();}
async function close(a){await a.page.keyboard.press('Escape');await focus(a);}
async function hand(a,value){await until(async()=>(await state(a)).hand===value,'hand '+value);assert.equal(app.store.byId(a.user.id).hand,value);}
function check(name){report.checks.push(name);console.log(JSON.stringify({check:name,passed:true}));}
async function slot(a,index,label){await a.page.locator(`#noodle-choices [data-slot="${index}"]`).click();await a.page.locator('#noodle-choices').getByRole('button',{name:label,exact:true}).click();await until(()=>a.page.locator('.noodle-selection').innerText().then(t=>t==='已完成'),'table '+label);}
try{
 // Use the canonical roles from server to avoid inventing identities.
 const {roles:validRoles}=await import('../server/personas.mjs');
 for(let i=0;i<(focusOnly?1:8);i++){
  const context=await browser.newContext({viewport:{width:1440,height:900}});const res=await context.request.post(origin+'/api/register/',{data:{username:'noodle_trial_'+i,password:'isolated-noodle-password',role:validRoles[i],invite:process.env.HUTONG_INVITE}});assert.equal(res.status(),200);const user=(await res.json()).user;
  const pose={id:user.id,role:user.role,scene:'noodle',x:320,y:337,facing:0,seat:null,moving:false,activity:'walk'};app.players.set(user.id,pose);app.life.savePosition(pose);
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(origin);const a={page,context,user};actors.push(a);await ready(a);
  const s=noodleSeats[i];await fixture(a,...s.approach);await key(a,'e');await until(async()=>(await state(a)).seat===s.id,'seat '+s.id);await until(()=>app.players.get(user.id)?.seat===s.id,'authoritative seat '+s.id);console.log(JSON.stringify({seat:s.id,accepted:true}));
 }
 const a=actors[0],b=actors[focusOnly?0:4];
 if(lifecycleOnly){
  await key(a,'Escape');await fixture(a,156,181);await key(a,'e');await hand(a,'碗筷');await fixture(a,280,181);await key(a,'e');await hand(a,'米线');await fixture(a,213,244);await key(a,'f');
  await a.page.locator('#noodle-choices [data-slot="0"]').click();
  await a.page.route('**/api/object/**',async route=>{if(route.request().method()!=='POST'||route.request().postDataJSON()?.action!=='put')return route.continue();const response=await route.fetch();await new Promise(r=>release=r);await route.fulfill({response});});
  await a.page.locator('#noodle-choices').getByRole('button',{name:'放下米线',exact:true}).click();await until(()=>!!release,'held table response');await close(a);
  await fixture(a,104,181);await key(a,'e');await a.page.locator('#noodle-menu[open]').waitFor();assert.ok((await a.page.locator('#noodle-choices').innerText()).includes('可乐'));
  release();release=undefined;await sleep(700);
  assert.ok((await a.page.locator('#noodle-choices').innerText()).includes('可乐'),'late table response must not overwrite the newly opened drink menu');
  await a.page.locator('#noodle-choices').getByRole('button',{name:'可乐',exact:true}).click();await hand(a,'可乐');await a.page.unroute('**/api/object/**');check('late table response preserves reopened drinks menu and drink remains usable');
  await fixture(a,213,244);await key(a,'f');await a.page.locator('#noodle-choices [data-slot="1"]').click();
  await a.page.route('**/api/object/**',async route=>{if(route.request().method()!=='POST'||route.request().postDataJSON()?.action!=='put')return route.continue();const response=await route.fetch();await new Promise(r=>release=r);await route.fulfill({response});});
  await a.page.locator('#noodle-choices').getByRole('button',{name:'放下可乐',exact:true}).click();await until(()=>!!release,'held second table result');await close(a);await fixture(a,320,337);
  async function exitTo(target){await key(a,'e');await a.page.locator('#location-map[open]').waitFor();const card=a.page.locator(`[data-place="${target}"]`);await card.click();await card.click();await a.page.waitForFunction(target=>window.__socialPreview.bridge.state()?.scene===target&&!window.__socialPreview.bridge.transitioning&&!document.querySelector('#location-map').open,target);}
  await exitTo('manner');await exitTo('noodle');await fixture(a,104,181);await key(a,'e');release();release=undefined;await sleep(700);
  assert.ok((await a.page.locator('#noodle-choices').innerText()).includes('冰红茶'),'old scene result cannot replace a fresh counter menu after returning');await a.page.locator('#noodle-choices').getByRole('button',{name:'冰红茶',exact:true}).click();await hand(a,'冰红茶');await a.page.unroute('**/api/object/**');check('real exits to MANNER and back invalidate old table result; fresh drink pickup works');
  assert.deepEqual(report.errors,[]);report.passed=true;
 }else{
 if(!focusOnly){
 assert.equal(new Set([...app.players.values()].map(p=>p.seat)).size,8);await until(()=>actors[0].page.evaluate(()=>window.__socialPreview.bridge.players.filter(p=>p.seat!==null).length===8),'all seated snapshots reach first window');await sleep(200);await actors[0].page.bringToFront();await sleep(200);await actors[0].page.screenshot({path:directory+'/eight-seats.png'});check('eight isolated accounts occupy eight unique seats through real E');
 await actors[0].page.locator('#game canvas').screenshot({path:directory+'/eight-seats-canvas.png'});
 await actors[0].page.evaluate(()=>{const b=window.__socialPreview.bridge,s=b.active,c=s.cameras.main,parts=new Set();for(const map of [b.views.get(s),b.mirrors.get(s)])for(const a of map?.values()??[]){for(const name of ['body','upper','prop','arm','label'])if(a[name])parts.add(a[name]);for(const group of [a.legs,a.held])for(const value of Object.values(group??{}))if(value?.scene===s&&typeof value.setVisible==='function')parts.add(value);}for(const row of s.dishImages??[])for(const p of row)parts.add(p);if(s.toppings)parts.add(s.toppings);window.__noodleCaptureIgnored=[...parts];c.ignore([...parts]);});
 await sleep(150);const clean=await actors[0].page.locator('#game canvas').evaluate(c=>c.toDataURL().split(',')[1]);await writeFile(directory+'/noodle-scenery.png',Buffer.from(clean,'base64'));await writeFile('assets/maps/memories/noodle.png',Buffer.from(clean,'base64'));await actors[0].page.evaluate(()=>{const s=window.__socialPreview.bridge.active,c=s.cameras.main;for(const p of window.__noodleCaptureIgnored??[])p.cameraFilter&=~c.id;delete window.__noodleCaptureIgnored;});check('clean noodle memory scenery refreshed; actor and dynamic dish camera filters restored');
 for(const i of [0,4]){const a=actors[i];await key(a,'e');await until(async()=>(await state(a)).seat===null,'stand '+i);const p=await state(a);assert.deepEqual([p.x,p.y],noodleSeats[i].approach);await key(a,'e');await until(async()=>(await state(a)).seat===String(i),'resit '+i);await key(a,'Escape');await until(async()=>(await state(a)).seat===null,'escape stand');}check('front and rear E stand/resit and Escape use shared approach');

 // Two real counter journeys, using pose fixtures only to remove travel time.
 for(let index=0;index<2;index++){
  await fixture(a,156,181);await key(a,'e');await hand(a,'碗筷');await fixture(a,280,181);await key(a,'e');await hand(a,'米线');await fixture(a,213,244);await key(a,'f');await slot(a,index,'放下米线');await hand(a,null);await slot(a,index,index===0?'加醋':'加麻油');await close(a);
 }
 let dishes=JSON.parse(app.store.db.prepare("SELECT state FROM room_objects WHERE id='noodle:table-0'").get().state).slots;assert.deepEqual(dishes[0].seasoning,['醋']);assert.deepEqual(dishes[1].seasoning,['麻油']);check('explicit bowl selection gives two bowls independent seasoning');
 await openOrders(a);await a.page.locator('#noodle-orders select[name=chicken]').selectOption('鸡柳');await a.page.locator('#noodle-orders form button').click();await until(()=>a.page.locator('.noodle-orders-status').innerText().then(t=>t==='已保存点单'),'saved order');await close(a);
 await fixture(b,156,181);await key(b,'e');await hand(b,'碗筷');await fixture(b,280,181);await openOrders(b);await b.page.locator('.noodle-order-item').filter({hasText:'米线'}).getByRole('button',{name:'帮取',exact:true}).click();await hand(b,'米线');await close(b);
 await fixture(b,...noodleSeats[4].approach);await openOrders(b);const meal=b.page.locator('.noodle-order-item').filter({hasText:'米线'});await meal.locator('select').selectOption('2');await meal.getByRole('button',{name:'上桌',exact:true}).click();await hand(b,null);await until(()=>meal.innerText().then(t=>t.includes('已上桌')),'order served');await close(b);check('shared order GUI saves, another diner picks actual noodles and serves selected slot');
 // Two API writes with one revision compete for the same pending item; no duplicate food.
 const order=JSON.parse(app.store.db.prepare('SELECT items FROM noodle_orders').get().items);assert.equal(order[0].status,'served');
 const row=app.store.db.prepare('SELECT * FROM noodle_orders').get();for(const actor of [a,b])await fixture(actor,476,181);
 // Invoke the public WorldClient action to retain its real controller client and idempotency flow.
 const results=await Promise.all([a,b].map(actor=>actor.page.evaluate(async({id,revision})=>{const {onlineWorld}=await import('/src/multiplayer/world-client.ts');try{await onlineWorld().noodleOrder('pickup',{orderId:id,orderRevision:revision,item:1});return 'ok';}catch(e){return e.message;}},{id:row.id,revision:row.revision})));
 assert.equal(results.filter(x=>x==='ok').length,1);assert.equal([a,b].filter(actor=>app.store.byId(actor.user.id).hand==='鸡柳').length,1);check('shared pending food competition gives one actual item');
 }
 await fixture(a,...noodleSeats[4].approach);await key(a,'f');await a.page.locator('#noodle-menu[open]').waitFor();await close(a);await until(()=>a.page.evaluate(()=>window.__socialPreview.bridge.active.input.keyboard.enabled),'keyboard gate resumes after native close',4000);await a.page.keyboard.down('ArrowRight');try{await until(async()=>(await state(a)).x>181,'movement after Escape',4000);}finally{await a.page.keyboard.up('ArrowRight');}check('native Escape restores movement without manual focus');
 await a.page.setViewportSize({width:390,height:844});await openOrders(a);await a.page.screenshot({path:directory+'/mobile-orders.png'});assert.ok(await a.page.locator('#noodle-orders').evaluate(d=>d.getBoundingClientRect().width<=390));await close(a);check('390px order dialog fits viewport and closes natively');
 // A delayed save response must not steal focus or reopen a panel after Escape.
 await openOrders(a);await a.page.route('**/api/noodle-orders/**',async route=>{if(route.request().method()!=='POST')return route.continue();const response=await route.fetch();await new Promise(resolve=>release=resolve);await route.fulfill({response});});await a.page.locator('#noodle-orders form button').click();await until(()=>!!release,'held order result');await close(a);await a.page.locator('#chat-open').click();await a.page.locator('#chat-input').focus();release();release=undefined;await sleep(600);assert.equal(await a.page.evaluate(()=>document.activeElement?.id),'chat-input');assert.equal(await a.page.locator('#noodle-orders').evaluate(d=>d.open),false);await a.page.unroute('**/api/noodle-orders/**');await a.page.locator('[data-close="chat-panel"]').click();check('late order response preserves chat focus and leaves closed panel closed');
 const started=Date.now();await a.context.setOffline(true);await sleep(500);await a.context.setOffline(false);await ready(a);await a.page.evaluate(async()=>{const{onlineWorld}=await import('/src/multiplayer/world-client.ts');await onlineWorld().checkpointPosition();});assert.ok(Date.now()-started<10000);check('offline reconnect returns control within ten seconds');
 const second=await a.context.newPage();await second.goto(origin);await second.waitForFunction(()=>window.__socialPreview?.bridge.connected);await second.locator('#people-open').click();await second.locator('#take-control').click();await until(()=>second.evaluate(()=>window.__socialPreview.bridge.controller),'second tab takes control');await until(()=>a.page.evaluate(()=>!window.__socialPreview.bridge.controller),'first tab becomes viewer');await second.close();check('same-account second window explicitly takes control; first becomes viewer');
 assert.deepEqual(report.errors,[]);report.passed=true;
 }
}catch(error){report.error=error.stack;report.input=actors[0]?await actors[0].page.evaluate(()=>{const b=window.__socialPreview.bridge,s=b.active;return{active:document.activeElement?.className,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id),keyboard:s.input.keyboard.enabled,gameKeyboard:b.game.input.keyboard.enabled,controller:b.controller,connected:b.connected,transitioning:b.transitioning,recovery:b.navigationRecovery,actor:s.actor,keys:Object.fromEntries(Object.entries(s.keys??{}).map(([k,v])=>[k,v.isDown]))};}):null;report.states=await Promise.all(actors.map(async a=>({local:await state(a),server:app.players.get(a.user.id),notice:await a.page.locator('#game-notice').innerText()})));for(let i=0;i<Math.min(actors.length,2);i++)await actors[i].page.screenshot({path:directory+`/failure-${i}.png`}).catch(()=>{});process.exitCode=1;}
finally{release?.();await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({directory,...report}));await browser.close();await vite.close();app.close();app.server.closeAllConnections();}
