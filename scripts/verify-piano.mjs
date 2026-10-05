import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer as createViteServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
const require=createRequire(import.meta.url),{chromium}=require('D:/CodexHome/mcp/node/node_modules/playwright');
const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const vite=await createViteServer({server:{port:5192,strictPort:true,host:'127.0.0.1',proxy:{'/api':{target:'http://127.0.0.1:'+app.server.address().port}}}});await vite.listen();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const registered=await page.request.post('http://127.0.0.1:5192/api/register',{data:{username:'piano_laura',password:'piano-test-password',role:'laura'}});assert.equal(registered.status(),200);const {user}=await registered.json();
 await page.goto('http://127.0.0.1:5192/');await page.waitForFunction(()=>window.__socialPreview?.getState().connected);
 Object.assign(app.players.get(user.id),{scene:'rehearsal',x:536,y:246,seat:null,activity:'walk',moving:false,at:Date.now()-3000});
 const client=await page.evaluate(()=>window.__socialPreview.getState().client);await page.request.post('http://127.0.0.1:5192/api/control',{data:{client}});
 await page.evaluate(()=>{const player=window.__socialPreview.bridge.players.find(p=>p.role==='laura');if(player)Object.assign(player,{scene:'rehearsal',x:536,y:246,seat:null,activity:'walk'});window.dispatchEvent(new CustomEvent('hutong:navigate',{detail:'rehearsal'}));window.__socialPreview.bridge.pendingSpawn={scene:'rehearsal',x:536,y:246,role:'laura',facing:2,seat:null,activity:'walk',moving:false};});
 await page.waitForFunction(()=>window.__rehearsalPreview?.getState().active);await page.locator('.world').focus();await page.keyboard.press('e');await page.waitForFunction(()=>window.__rehearsalPreview.getState().mode==='piano');
 assert.equal(await page.locator('#rehearsal-keyboard button').count(),37);
 assert.equal(await page.evaluate(()=>window.__rehearsalPreview.getState().facing),2);
 const box=await page.locator('#rehearsal-piano').boundingBox(),world=await page.locator('.world').boundingBox();assert.ok(Math.abs(box.x+box.width/2-(world.x+world.width/2))<3);assert.ok(Math.abs(box.y+box.height/2-(world.y+world.height/2))<3);
 await page.keyboard.down('z');await page.keyboard.down('c');await page.keyboard.down('b');await page.waitForFunction(()=>window.__rehearsalPreview.getState().notes.length===3);
 assert.deepEqual(await page.evaluate(()=>window.__rehearsalPreview.getState().notes.sort((a,b)=>a-b)),[12,16,19]);
 for(const key of ['z','c','b'])await page.keyboard.up(key);
 await page.keyboard.press('ArrowDown');await page.keyboard.down('z');await page.waitForFunction(()=>window.__rehearsalPreview.getState().notes.includes(0));await page.keyboard.up('z');
 await page.keyboard.down('e');await page.waitForFunction(()=>window.__rehearsalPreview.getState().notes.includes(16));assert.equal(await page.evaluate(()=>window.__rehearsalPreview.getState().mode),'piano');await page.keyboard.up('e');
 await page.keyboard.press('j');assert.equal(await page.locator('#journal-dialog').evaluate(d=>d.open),false);
 const highC=await page.locator('#rehearsal-keyboard [data-note="36"]').boundingBox();await page.mouse.move(highC.x+highC.width/2,highC.y+highC.height*.8);await page.mouse.down();await page.waitForFunction(()=>window.__rehearsalPreview.getState().notes.includes(36));await page.mouse.up();
 await mkdir('output/playwright',{recursive:true});await page.screenshot({path:'output/playwright/piano-centered.png'});
 await page.locator('#rehearsal-piano').evaluate(p=>p.hidden=true);await page.screenshot({path:'output/playwright/piano-seated.png'});await page.locator('#rehearsal-piano').evaluate(p=>p.hidden=false);
 await page.keyboard.down('q');await page.keyboard.press('Escape');await page.keyboard.up('q');await page.waitForFunction(()=>window.__rehearsalPreview.getState().mode==='walk'&&window.__rehearsalPreview.getState().notes.length===0);assert.equal(await page.locator('#rehearsal-piano').isVisible(),false);
 await page.keyboard.down('ArrowDown');await page.waitForFunction(()=>window.__rehearsalPreview.getState().y>260);await page.keyboard.up('ArrowDown');
 Object.assign(app.players.get(user.id),{x:172,y:260,seat:null,activity:'walk',at:Date.now()-3000});await page.evaluate(()=>{const scene=window.__socialPreview.bridge.active;scene.x=172;scene.y=260;});await page.keyboard.press('e');await page.waitForFunction(()=>window.__rehearsalPreview.getState().mode==='seat');
 // A stale pre-sit coordinate inside the furniture must never be used on exit.
 await page.evaluate(()=>{window.__socialPreview.bridge.active.returnPoint={x:172,y:239};});await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__rehearsalPreview.getState().mode==='walk'&&window.__rehearsalPreview.getState().y===260);
 await page.keyboard.down('ArrowLeft');await page.waitForFunction(()=>window.__rehearsalPreview.getState().x<150);await page.keyboard.up('ArrowLeft');
 await page.evaluate(()=>{const scene=window.__socialPreview.bridge.active;scene.x=172;scene.y=239;});await page.waitForFunction(()=>window.__rehearsalPreview.getState().y===260);
 assert.deepEqual(errors,[]);console.log('Piano and chair: keyboard, exit movement, stale return point and stuck-position recovery passed');
}finally{await browser.close();await vite.close();app.close();}
