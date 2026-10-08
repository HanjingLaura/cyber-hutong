import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {createMvpServer} from '../server/app.mjs';
const require=createRequire(import.meta.url),{chromium}=require('./playwright.cjs').loadPlaywright();
const dir=mkdtempSync(join(tmpdir(),'hutong-invite-browser-')),app=createMvpServer({dbPath:join(dir,'test.db'),llmOptions:{key:''}});
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const root='http://127.0.0.1:'+app.server.address().port;
let browser;const errors=[];
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
 const contexts=await Promise.all([browser.newContext({viewport:{width:1280,height:720}}),browser.newContext({viewport:{width:1280,height:720}})]);
 const roles=['laura','sid'],users=[];
 for(let i=0;i<2;i++){const r=await contexts[i].request.post(root+'/api/register',{data:{username:'browser_'+roles[i],password:'test-password-123',role:roles[i]}});assert.equal(r.status(),200);users.push((await r.json()).user);}
 const pages=await Promise.all(contexts.map(c=>c.newPage()));for(const p of pages)p.on('pageerror',e=>errors.push(e.message));
 await Promise.all(pages.map(async p=>{await p.goto(root+'/cyber-hutong/?debug=1');await p.waitForFunction(()=>window.__socialPreview?.getState().connected&&window.__socialPreview.bridge.state()?.scene==='hutong',{},{timeout:60000});}));
 const clients=await Promise.all(pages.map(p=>p.evaluate(()=>window.__socialPreview.getState().client)));
 app.store.hand(users[0].id,'咖啡',0);
 for(const place of ['ktv','rest','arcade','dance','gym']){
  const response=await contexts[0].request.post(root+'/api/invite',{data:{client:clients[0],peer:'sid',place,requestId:'browser-'+place}});assert.equal(response.status(),200);const offer=(await response.json()).offer;
  await pages[1].getByRole('button',{name:'接受',exact:true}).click();
  await Promise.all(pages.map(p=>p.waitForFunction(scene=>window.__socialPreview.bridge.state()?.scene===scene&&!window.__socialPreview.bridge.pendingSpawn&&!window.__socialPreview.bridge.transitioning,place,{timeout:30000})));
  for(let tries=0;tries<100&&app.life.meeting(users[0].id);tries++)await new Promise(r=>setTimeout(r,100));
  assert.equal(app.store.db.prepare('SELECT status FROM offers WHERE id=?').get(offer.id).status,'completed');
  const states=await Promise.all(pages.map(p=>p.evaluate(()=>window.__socialPreview.bridge.state())));assert.ok(Math.hypot(states[0].x-states[1].x,states[0].y-states[1].y)>=20);assert.ok(Math.hypot(states[0].x-states[1].x,states[0].y-states[1].y)<60);assert.equal(app.store.byId(users[0].id).hand,'咖啡');
  if(place==='ktv'){mkdirSync('output/playwright/invites',{recursive:true});await pages[0].screenshot({path:resolve('output/playwright/invites/together-ktv.png')});}
 }
 // A refreshed controller restores its latest authoritative scene and command.
 await pages[0].reload();await pages[0].waitForFunction(()=>window.__socialPreview?.bridge.state()?.scene==='gym'&&!window.__socialPreview.bridge.pendingSpawn,{},{timeout:30000});
 assert.deepEqual(errors,[]);console.log('Two-browser invites passed in KTV, rest, arcade, dance and gym; adjacent positions, completion, held item and reload verified.');
}finally{await browser?.close();app.close();app.server.closeAllConnections();rmSync(dir,{recursive:true,force:true});}
