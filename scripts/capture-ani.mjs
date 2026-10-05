import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createServer as createViteServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
const require=createRequire(import.meta.url),{chromium}=require('D:/CodexHome/mcp/node/node_modules/playwright');
const backend=createMvpServer({dbPath:':memory:'});await new Promise(r=>backend.server.listen(0,'127.0.0.1',r));
const vite=await createViteServer({server:{port:5188,strictPort:true,host:'127.0.0.1',proxy:{'/api':{target:'http://127.0.0.1:'+backend.server.address().port,changeOrigin:false}}}});await vite.listen();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const registered=await page.request.post('http://127.0.0.1:5188/api/register',{data:{username:'ani_preview_sid',password:'preview-password-2026',role:'sid'}});assert.equal(registered.status(),200);
 await page.goto('http://127.0.0.1:5188/');await page.waitForFunction(()=>window.__socialPreview?.getState().connected);
 const state=backend.players.values().next().value;Object.assign(state,{x:192,y:220.6,seat:null,activity:'walk',moving:false,at:Date.now()-3000});
 await page.evaluate(()=>{window.__socialPreview.bridge.pendingSpawn={role:'sid',scene:'hutong',x:192,y:220.6,facing:0,seat:null,activity:'walk',moving:false};});
 await page.waitForFunction(()=>Math.abs(window.__socialPreview.bridge.state().y-220.6)<1);
 await page.waitForFunction(()=>window.__hutongPreview.getState().nearest==='L1'&&!document.querySelector('dialog[open]'));await page.locator('.world').focus();await page.waitForTimeout(150);await page.keyboard.press('e');
 await page.waitForFunction(()=>window.__socialPreview.bridge.active.aniGuest?.snapshot().visible===true&&window.__socialPreview.bridge.state().seat==='L1');
 await page.waitForFunction(()=>window.__socialPreview.bridge.active.children.list.some(c=>c.visible&&c.texture?.key?.startsWith('team-v3-')));
 await page.waitForTimeout(700);await mkdir('output/playwright',{recursive:true});
 await page.locator('#game canvas').screenshot({path:'output/playwright/ani-easter-egg.png'});
 // A second screenshot of the actual rendered canvas, enlarged by the game's pixel scaling.
 await page.evaluate(()=>{const c=document.querySelector('#game canvas');c.style.setProperty('width','1920px','important');c.style.setProperty('height','1080px','important');});
 await page.waitForTimeout(100);const bounds=await page.locator('#game canvas').boundingBox();
 await page.screenshot({path:'output/playwright/ani-easter-egg-detail.png',clip:{x:Math.max(0,bounds.x+120*3),y:Math.max(0,bounds.y+100*3),width:540,height:480}});
 const before=await page.evaluate(()=>window.__socialPreview.bridge.active.aniGuest.snapshot());
 await page.keyboard.press('e');await page.waitForFunction(()=>!window.__socialPreview.bridge.active.aniGuest.snapshot().visible);
 await page.waitForTimeout(400);assert.deepEqual(errors,[]);assert.equal(state.seat,null);
 await writeFile('output/playwright/ani-state.json',JSON.stringify({working:before,disappearsOnStand:true,errors},null,2));console.log(JSON.stringify({visibleWhileSidWorking:true,disappearsOnStand:true,errors}));
}catch(e){console.log(await browser.contexts()[0].pages()[0].evaluate(()=>({state:window.__hutongPreview?.getState(),dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id),ani:window.__socialPreview?.bridge.active?.aniGuest?.snapshot()})));throw e;}finally{await browser.close();await vite.close();backend.close();}
