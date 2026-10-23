// Real Chrome UI recovery. Quick-map is explicit fault/stress setup only.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createServer as createPortProbe} from 'node:net';
import {execFileSync} from 'node:child_process';
import {createMvpServer} from '../server/app.mjs';
import rooms from '../shared/rooms.json' with {type:'json'};
import {loadPlaywright} from './playwright.mjs';
const directory='output/scene-recovery-'+Date.now();await mkdir(directory,{recursive:true});
process.env.HUTONG_INVITE='isolated-scene-recovery';
const app=createMvpServer({dbPath:directory+'/game.sqlite',llmOptions:{key:''}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const probe=createPortProbe();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const vitePort=probe.address().port;await new Promise(r=>probe.close(r));
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{watch:null,hmr:false,host:'127.0.0.1',port:vitePort,strictPort:true,proxy:{'/api':{target:`http://127.0.0.1:${app.server.address().port}`,changeOrigin:false}}}});await vite.listen();
const streams=new Set();app.server.prependListener('request',(req,res)=>{if(req.url.startsWith('/api/events')){streams.add(res);res.once('close',()=>streams.delete(res));}});
const origin=`http://127.0.0.1:${vite.httpServer.address().port}`,browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:process.argv.includes('--webgl')?[]:['--disable-webgl']}),context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
const report={passed:false,environment:{revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,chrome:browser.version(),origin,apiPort:app.server.address().port,db:directory+'/game.sqlite',modelKeyEmpty:true,partyHostEmpty:true,watch:null,hmr:false,quickMapSetup:true},checks:[],errors:[],dialogs:[],transitions:[]};let account;
page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(/\/api\/transition\//.test(r.url()))report.transitions.push(r.postDataJSON());});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,ms=12000){const end=Date.now()+ms;do{if(await fn())return;await sleep(50);}while(Date.now()<end);throw Error('Timed out: '+label);}
const state=(p=page)=>p.evaluate(()=>window.__socialPreview.bridge.state());
const diagnostic=(p=page)=>p.evaluate(()=>({activeTag:document.activeElement?.tagName,activeId:document.activeElement?.id,activeClass:document.activeElement?.className,openDialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id),keyboardEnabled:window.__socialPreview?.bridge.active?.input.keyboard?.enabled,controller:window.__socialPreview?.bridge.controller,connected:window.__socialPreview?.bridge.connected}));
async function ready(p=page){await p.waitForFunction(()=>{const b=window.__socialPreview?.bridge;return b?.connected&&b.controller&&!b.pendingSpawn&&!b.transitioning&&b.state();},{},{timeout:30000});}
async function movement(p=page){
 await until(()=>p.evaluate(()=>document.activeElement===document.querySelector('.world')),'world focus without manual refocus',2000);
 const before=await state(p);
 const candidates=await p.evaluate(()=>{const b=window.__socialPreview.bridge,s=b.active,p=b.state(),reverse=s.reverse?-1:1;return [[-12,0,'ArrowLeft'],[12,0,'ArrowRight'],[0,12,'ArrowDown'],[0,-12,'ArrowUp']].filter(([dx,dy])=>!s.canWalk||s.canWalk(p.x+dx*reverse,p.y+dy*reverse)&&s.canWalk(p.x+dx*reverse/2,p.y+dy*reverse/2)).map(c=>c[2]);});
 for(const code of candidates){await p.keyboard.down(code);let moved=false;try{await until(async()=>{const s=await state(p);return Math.hypot(s.x-before.x,s.y-before.y)>2;},'movement resumes',600);moved=true;}catch{}finally{await p.keyboard.up(code);}if(moved)return;}
 assert.fail('No keyboard movement in any currently walkable direction');
}
async function openMap(target){await page.locator('#room-open').click();const b=page.locator(`[data-place="${target}"]`);await b.click();await b.click();}
async function travel(target){await openMap(target);await until(async()=>{const b=await state();return b.scene===target&&await page.locator('#location-map').evaluate(d=>!d.open)&&await page.evaluate(()=>!window.__socialPreview.bridge.transitioning);},'travel '+target,30000);assert.equal(app.players.get(account.id).scene,target);}
async function record(name){report.checks.push(name);console.log(JSON.stringify({check:name,passed:true}));}
const panels=[['chat-open','chat-panel','[data-close]'],['people-open','people-panel','[data-close]'],['settings-open','settings-dialog','[data-close]'],['bag-open','bag-dialog','[data-close-life]'],['collection-open','collection-dialog','[data-close-life]'],['memory-open','journal-dialog','[data-close-life]']];
async function openPanel(id){if(id==='settings-open'||id==='memory-open')await page.locator('#more-tools summary').click();await page.locator('#'+id).click();}
async function closeCheck(panel,esc){const [button,id,close]=panel;await openPanel(button);await page.locator('#'+id).waitFor({state:'visible'});if(id==='chat-panel'){await page.locator('#chat-input').fill('');await page.locator('#chat-input').press('e');assert.equal(await page.locator('#chat-input').inputValue(),'e');}const before=await state();console.log(JSON.stringify({closing:id,esc}));if(esc)await page.keyboard.press('Escape');else await page.locator('#'+id+' '+close).click();await page.locator('#'+id).waitFor({state:'hidden'});const entry={scene:before.scene,id,close:esc?'Escape':'button',diagnostic:await diagnostic()};report.dialogs.push(entry);await movement();await page.keyboard.press('e');await sleep(150);const afterE=await state();entry.afterE={seat:afterE.seat,activity:afterE.activity,openDialogs:(await diagnostic()).openDialogs};assert.equal(afterE.scene,before.scene);if(afterE.seat||afterE.activity!=='walk'||(await diagnostic()).openDialogs.length)await page.keyboard.press('Escape');entry.passed=true;}
async function escapeActivityOnly(){
 report.mode='escape-activity-only';report.activities=[];
 async function check(kind){
  const before=await state();assert.ok(kind==='seat'?before.seat:before.activity==='run','real '+kind+' active');
  await page.locator('#chat-open').click();await page.locator('#chat-input').fill('隔离回归草稿');
  await page.keyboard.press('Escape');await page.locator('#chat-panel').waitFor({state:'hidden'});await sleep(200);
  const afterFirst=await state(),entry={kind,before,afterFirst,diagnostic:await diagnostic()};report.activities.push(entry);
  entry.preserved=kind==='seat'?afterFirst.seat===before.seat:afterFirst.activity==='run';
  await page.keyboard.press('Escape');await until(async()=>{const p=await state();return !p.seat&&p.activity==='walk';},'second Escape ends '+kind);
  entry.afterSecond=await state();entry.exited=true;
 }
 await page.locator('.world').focus();await page.keyboard.press('e');await until(async()=>!!(await state()).seat,'real office seat');await check('seat');
 await openPanel('settings-open');await page.locator('#quick-travel').check();await page.keyboard.press('Escape');await travel('gym');
 async function axis(axis,target){const p=await state(),sign=Math.sign(target-p[axis]);if(Math.abs(target-p[axis])<1)return;const code=axis==='x'?(sign>0?'ArrowRight':'ArrowLeft'):(sign>0?'ArrowDown':'ArrowUp');await page.keyboard.down(code);try{await page.waitForFunction(({axis,target,sign})=>sign*(target-window.__socialPreview.bridge.state()[axis])<1,{axis,target,sign},{timeout:8000,polling:'raf'});}finally{await page.keyboard.up(code);}}
 await axis('x',415);await axis('y',155);await page.keyboard.press('e');await until(async()=>(await state()).activity==='run','real treadmill');await check('run');
 assert.ok(report.activities.every(a=>a.preserved),'first Escape only closes chat and preserves each activity');await record('chat Escape preserves seat and run; next Escape ends activity');await movement();
}

async function scenePanelsOnly(){
 await openPanel('settings-open');await page.locator('#quick-travel').check();await page.keyboard.press('Escape');
 await travel('manner');
 report.scenePanelChecks=[];report.networkByScene=[];
 const panels={rest:['#fridge-menu','#vending-menu','#table-menu'],pop:['#blind-menu'],gym:['#gym-storage'],arcade:['#arcade-game'],perler:['#perler-workshop'],ktv:['#ktv-menu']};
 for(const scene of Object.keys(rooms)){
  if((await state()).scene!==scene)await travel(scene);
  for(const selector of panels[scene]??[]){
   // Direct showModal is an explicit close-event race fixture, not gameplay evidence.
   await page.evaluate(selector=>{const d=document.querySelector(selector);d.showModal();d.close();document.querySelector('#chat-open').click();document.querySelector('#chat-input').focus();},selector);
   await sleep(120);const active=await page.evaluate(()=>document.activeElement?.id),entry={scene,selector,preservesNewChatFocus:active==='chat-input',active};report.scenePanelChecks.push(entry);console.log(JSON.stringify(entry));await page.locator('#chat-panel [data-close]').click();
  }
  await context.setOffline(true);await until(()=>page.evaluate(()=>!window.__socialPreview.bridge.connected),'offline '+scene);await sleep(150);const started=Date.now();await context.setOffline(false);await ready();await page.locator('.world').focus();await movement();
  const milliseconds=Date.now()-started;assert.ok(milliseconds<=10000,scene+' reconnect <=10s');report.networkByScene.push({scene,milliseconds});
  await page.keyboard.press('e');await page.locator('#location-map[open]').waitFor();await page.keyboard.press('Escape');await record('scene panel / reconnect '+scene);
 }
 assert.ok(report.scenePanelChecks.every(entry=>entry.preservesNewChatFocus),'each scene dialog close must preserve newer chat focus');
}

try{
 const registered=await context.request.post(origin+'/api/register/',{data:{username:'scene_recovery_sid',password:'isolated-scene-password',role:'sid',invite:process.env.HUTONG_INVITE}});assert.equal(registered.status(),200);account=(await registered.json()).user;
 await page.goto(origin);await ready();
 report.environment.renderer=await page.evaluate(()=>window.__socialPreview.bridge.game.renderer.type);
 if(process.argv.includes('--webgl'))assert.equal(report.environment.renderer,2,'exercise WebGL rather than Canvas fallback');
 if(process.argv.includes('--scene-panels-only'))await scenePanelsOnly();else if(process.argv.includes('--escape-activity-only'))await escapeActivityOnly();else{
 // Run all close paths before scene stress so one red run retains each defect.
 for(const panel of panels)for(const esc of [false,true]){try{await closeCheck(panel,esc);}catch(e){report.checks.push({failed:panel[1],esc,error:e.message,diagnostic:await diagnostic()});await page.keyboard.press('Escape');await page.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelectorAll('#chat-panel,#people-panel').forEach(d=>d.hidden=true);document.querySelector('.world').focus();});}}
 assert.equal(report.checks.filter(c=>typeof c==='object'&&c.failed).length,0,'all close paths restore focus');
 await openPanel('settings-open');await page.locator('#quick-travel').check();await page.keyboard.press('Escape');
 for(const [i,scene]of Object.keys(rooms).entries()){if((await state()).scene!==scene)await travel(scene);await closeCheck(panels[i%panels.length],i%2===0);await record('scene '+scene);}
 // A closing event must not steal from a newly opened modal or chat input.
 await page.evaluate(()=>{document.querySelector('#bag-dialog').showModal();document.querySelector('#bag-dialog').close();document.querySelector('#collection-dialog').showModal();});await sleep(100);assert.equal(await page.evaluate(()=>document.activeElement?.closest('dialog')?.id),'collection-dialog');await page.keyboard.press('Escape');
 await page.evaluate(()=>{document.querySelector('#bag-dialog').showModal();document.querySelector('#bag-dialog').close();document.querySelector('#chat-open').click();document.querySelector('#chat-input').focus();});await sleep(100);assert.equal(await page.evaluate(()=>document.activeElement.id),'chat-input');await page.keyboard.press('Escape');await movement();await record('close preserves newer modal and chat focus');
 await context.setOffline(true);await sleep(1200);const onlineAt=Date.now();await context.setOffline(false);await ready();await movement();report.offlineRecoveryMs=Date.now()-onlineAt;assert.ok(report.offlineRecoveryMs<10000);await record('offline online recovery');
 // End actual SSE HTTP responses (same as finite serverless streams); EventSource must reconnect.
 let sseRequests=0;page.on('request',r=>{if(/\/api\/events\/\?/.test(r.url()))sseRequests++;});assert.ok(streams.size,'active SSE transport');for(const res of streams)res.end();const sseAt=Date.now();await until(()=>sseRequests>0,'new SSE request',10000);await ready();await movement();report.sseRecoveryMs=Date.now()-sseAt;await record('SSE transport reconnect');
 const other=await context.newPage();await other.goto(origin);await other.waitForFunction(()=>window.__socialPreview?.bridge.connected);await until(()=>other.locator('#take-control').isVisible(),'viewer takeover');const viewerBefore=await state(other);await other.locator('.world').focus();await other.keyboard.down('ArrowRight');await sleep(250);await other.keyboard.up('ArrowRight');assert.equal((await state(other)).x,viewerBefore.x);await other.locator('#take-control').click();await ready(other);await until(()=>page.locator('#take-control').isVisible(),'original viewer');await page.locator('#take-control').click();await ready();await other.close();await page.locator('#chat-open').click();await page.keyboard.press('Escape');await movement();await record('viewer gate and multi-window takeover return');
 // Real map clicks submit failures and lost committed responses. Server scene is authoritative.
 for(const mode of ['reject','lost-committed']){const before=await state(),target=before.scene==='rest'?'gym':'rest',count=report.transitions.length;let injected=false;await page.route('**/api/transition/**',async route=>{injected=true;if(mode==='reject')await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'隔离测试：切换失败'})});else{const response=await route.fetch();assert.equal(response.status(),200);await route.abort('failed');}});await openMap(target);await until(()=>injected,'fault submitted');await until(()=>page.evaluate(()=>!window.__socialPreview.bridge.transitioning&&!window.__socialPreview.bridge.navigationRecovery),'transition settles',30000);const authoritative=app.players.get(account.id).scene;assert.equal((await state()).scene,authoritative);assert.equal(authoritative,mode==='reject'?before.scene:target);assert.equal(report.transitions.length-count,1);await page.unroute('**/api/transition/**');if(await page.locator('#location-map').evaluate(d=>d.open))await page.keyboard.press('Escape');await movement();await travel(authoritative==='rest'?'gym':'rest');await record(mode+' transition recovers without duplicate');}
 }
 assert.equal(app.llm.status().budget.calls,0);assert.deepEqual(report.errors,[]);report.passed=true;await page.screenshot({path:directory+'/desktop.png'});
}catch(e){report.error=e.message;report.diagnostic=await diagnostic().catch(()=>null);report.state=await state().catch(()=>null);await page.screenshot({path:directory+'/failure.png'}).catch(()=>{});process.exitCode=1;}
finally{await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({directory,passed:report.passed,error:report.error,checks:report.checks,diagnostic:report.diagnostic}));await browser.close();await vite.close();app.close();app.server.closeAllConnections();}
