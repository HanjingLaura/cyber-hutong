import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../server/store.mjs';
import {createServer as createViteServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
const require=createRequire(import.meta.url),{chromium}=require('D:/CodexHome/mcp/node/node_modules/playwright');
const dbPath=join(mkdtempSync(join(tmpdir(),'hutong-eggs-')),'fixture.sqlite'),seed=openStore(dbPath),now=Date.now();seed.db.exec('CREATE TABLE world_npcs(id TEXT PRIMARY KEY,state TEXT NOT NULL)');seed.db.prepare('INSERT INTO world_npcs VALUES(?,?)').run('celine',JSON.stringify({scene:'hutong',started:now,nextVisit:now+600000,nextSpeech:now+90000,question:'',until:0}));seed.close();
const app=createMvpServer({dbPath,llmOptions:{key:''}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const vite=await createViteServer({server:{port:5194,strictPort:true,host:'127.0.0.1',proxy:{'/api':{target:'http://127.0.0.1:'+app.server.address().port}}}});await vite.listen();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
try{
 const pages=[],users=[],errors=[];for(const role of ['cora','laura']){const context=await browser.newContext({viewport:{width:1100,height:800}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const r=await context.request.post('http://127.0.0.1:5194/api/register',{data:{username:'easter_'+role,password:'easter-test-password',role}});assert.equal(r.status(),200);users.push((await r.json()).user);pages.push(page);await page.goto('http://127.0.0.1:5194/');await page.waitForFunction(()=>window.__socialPreview?.getState().connected);}
 await pages[0].waitForFunction(()=>window.__officeGuestsPreview?.getState().some(n=>n.id==='celine'&&n.scene==='hutong'&&n.mode==='standing'));await mkdir('output/playwright',{recursive:true});await pages[0].screenshot({path:'output/playwright/celine-hutong-standing.png'});
 for(const [i,page]of pages.entries()){Object.assign(app.players.get(users[i].id),{scene:'pop',x:440+i*25,y:280,seat:null,activity:'walk',moving:false,at:Date.now()-3000});await page.evaluate(({x})=>{const b=window.__socialPreview.bridge;window.dispatchEvent(new CustomEvent('hutong:navigate',{detail:'pop'}));b.pendingSpawn={scene:'pop',x,y:280,role:b.user.role,facing:0,seat:null,activity:'walk',moving:false};},{x:440+i*25});await page.waitForFunction(()=>window.__popPreview?.getState().active);}
 const owner=pages[0],observer=pages[1];await owner.waitForFunction(()=>!document.querySelector('#npc-interact').hidden);assert.equal(await observer.locator('#npc-interact').isVisible(),false);assert.ok((await observer.evaluate(()=>window.__easterEggPreview.getState())).some(n=>n.id==='buzz'&&n.active));await owner.locator('#npc-interact').click();await observer.waitForFunction(()=>document.querySelector('.npc-speech')?.textContent.includes('Cora'));await observer.screenshot({path:'output/playwright/easter-observer.png'});
 const client=await observer.evaluate(()=>window.__socialPreview.getState().client);const denied=await observer.request.post('http://127.0.0.1:5194/api/npc',{data:{client,npc:'buzz'}});assert.equal(denied.status(),403);assert.equal(app.life.journal(users[0].id).filter(e=>e.kind==='easter').length,1);assert.equal(app.life.journal(users[1].id).filter(e=>e.kind==='easter').length,0);assert.deepEqual(errors,[]);console.log('Browser: shared Celine stands in Hutong, Buzz visible to both, owner-only interaction and shared speech passed');
}finally{await browser.close();await vite.close();app.close();}
