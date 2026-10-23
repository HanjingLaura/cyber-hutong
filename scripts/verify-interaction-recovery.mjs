import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {loadPlaywright} from './playwright.mjs';

const directory='output/interaction-recovery-'+Date.now();await mkdir(directory,{recursive:true});process.env.HUTONG_INVITE='isolated-recovery';
const app=createMvpServer({dbPath:directory+'/game.sqlite',llmOptions:{key:''}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{watch:null,hmr:false,host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${app.server.address().port}`,changeOrigin:false}}}});await vite.listen();
const origin=`http://127.0.0.1:${vite.httpServer.address().port}`,browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']}),context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
const report={passed:false,environment:'isolated Chrome + file SQLite, real HTTP; explicit fault fixtures; quick travel for fault setup only',checks:{},errors:[]};let releaseOld;
page.on('pageerror',e=>report.errors.push(e.message));const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,ms=10000){const end=Date.now()+ms;do{const value=await fn();if(value)return value;await sleep(50);}while(Date.now()<end);throw Error('Timed out: '+label);}
const state=()=>page.evaluate(()=>window.__socialPreview.bridge.state());
async function ready(){await page.waitForFunction(()=>{const b=window.__socialPreview?.bridge;return b?.connected&&b.controller&&!b.pendingSpawn&&!b.transitioning&&b.state();});}
async function travel(target){await page.locator('#room-open').click();await page.locator(`[data-place="${target}"]`).click();await page.locator(`[data-place="${target}"]`).click();await page.waitForFunction(target=>window.__socialPreview.bridge.state()?.scene===target&&!window.__socialPreview.bridge.transitioning&&!document.querySelector('#location-map').open,target);}
async function walk(axis,target){const p=await state(),sign=Math.sign(target-p[axis]);if(Math.abs(target-p[axis])<2)return;const key=axis==='x'?(sign>0?'ArrowRight':'ArrowLeft'):(sign>0?'ArrowDown':'ArrowUp');await page.locator('.world').focus();await page.keyboard.down(key);try{await page.waitForFunction(({axis,target,sign})=>sign*(target-window.__socialPreview.bridge.state()[axis])<2,{axis,target,sign},{timeout:10000,polling:'raf'});}finally{await page.keyboard.up(key);}await sleep(250);}
async function interact(){await page.locator('.world').focus();await page.keyboard.press('e');}
try{
 const registered=await context.request.post(origin+'/api/register/',{data:{username:'recovery_trial_sid',password:'isolated-recovery-password',role:'sid',invite:process.env.HUTONG_INVITE}});assert.equal(registered.status(),200);
 await page.goto(origin+'/');await ready();await page.locator('#more-tools summary').click();await page.locator('#settings-open').click();await page.locator('#quick-travel').check();await page.locator('#settings-dialog [data-close]').click();
 await travel('rest');const fridge=await page.evaluate(()=>window.__restPreview.getState().targets.find(t=>t.id==='fridge'));await walk('x',fridge.x);await walk('y',fridge.y+10);
 // A rejected mutation releases the intent; the next E and item transfer work.
 let injected=false;await page.route('**/api/object/**',async route=>{if(!injected){injected=true;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'隔离测试：暂时不可用，请重试'})});}else await route.continue();});
 await interact();await page.locator('#fridge-menu[open]').waitFor();await until(()=>page.locator('#game-notice').innerText().then(s=>s.includes('暂时不可用')),'recoverable error');await page.keyboard.press('Escape');await interact();await page.locator('#fridge-menu[open]').waitFor();
 await page.locator('#fridge-items button:not([disabled])').first().click();await until(async()=>!!(await state()).hand,'item picked');const item=(await state()).hand;await page.locator('#fridge-store').click();await until(async()=>!(await state()).hand,'item put back');assert.ok(item);await page.keyboard.press('Escape');report.checks.rejectedActionThenItemTakePut=true;
 await page.unroute('**/api/object/**');
 await travel('gym');await walk('x',415);await walk('y',155);
 let held=false,claims=0;await page.route('**/api/lease/**',async route=>{const body=route.request().postDataJSON();if(!body.release){claims++;if(!held){held=true;const response=await route.fetch();assert.equal(response.status(),200);await new Promise(r=>releaseOld=r);await route.fulfill({response});return;}}await route.continue();});
 await interact();await until(()=>!!releaseOld,'held real device acknowledgement');for(let n=0;n<8;n++)await page.keyboard.press('e');assert.equal(claims,1);report.checks.repeatedEHasOnePendingClaim=true;
 // Release the committed server lease out of band to allow normal scene changes
 // while keeping its old HTTP acknowledgement delayed in the first visit.
 const client=await page.evaluate(()=>window.__socialPreview.getState().client);const release=await context.request.post(origin+'/api/lease/',{data:{client,device:'run-2',release:true}});assert.equal(release.status(),200);
 await travel('rest');await travel('gym');releaseOld();releaseOld=undefined;await sleep(700);assert.equal((await state()).activity,'walk');report.checks.oldVisitAcknowledgementCannotStartActivity=true;
 await walk('x',415);await walk('y',155);await interact();await until(async()=>(await state()).activity==='run','fresh device claim');await page.keyboard.press('Escape');await until(async()=>(await state()).activity==='walk','device released');report.checks.newVisitDeviceUsable=true;
 assert.deepEqual(report.errors,[]);report.passed=true;await page.screenshot({path:directory+'/desktop.png'});
}catch(error){report.error=error.message;report.state=await state().catch(()=>null);report.diagnostics=await page.evaluate(()=>window.__interactionDiagnostics?.()).catch(()=>[]);await page.screenshot({path:directory+'/failure.png'}).catch(()=>{});process.exitCode=1;}
finally{releaseOld?.();await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({directory,...report}));await browser.close();await vite.close();app.close();app.server.closeAllConnections();}
