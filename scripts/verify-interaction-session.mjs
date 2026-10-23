import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {loadPlaywright} from './playwright.mjs';

const seconds=Number(process.env.HUTONG_BROWSER_SECONDS??900);assert.ok(Number.isFinite(seconds)&&seconds>0);
const directory='output/interaction-session-'+Date.now();await mkdir(directory,{recursive:true});
process.env.HUTONG_INVITE='isolated-session';
const app=createMvpServer({dbPath:directory+'/game.sqlite',llmOptions:{key:''}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{watch:null,hmr:false,host:'127.0.0.1',port:5198,strictPort:true,proxy:{'/api':{target:`http://127.0.0.1:${app.server.address().port}`,changeOrigin:false}}}});await vite.listen();
const browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']}),context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));let cycles=0,seats=0,reconnects=0,travelCount=0;
const ready=()=>page.waitForFunction(()=>window.__socialPreview?.bridge.connected&&window.__socialPreview.bridge.controller&&!window.__socialPreview.bridge.pendingSpawn);
async function travel(target){await page.locator('#room-open').click();await page.locator(`[data-place="${target}"]`).click();await page.locator(`[data-place="${target}"]`).click();await page.waitForFunction(target=>window.__socialPreview.bridge.state()?.scene===target&&!window.__socialPreview.bridge.transitioning&&!document.querySelector('#location-map').open,target);travelCount++;}
async function approach(){await page.locator('.world').focus();await page.keyboard.down('ArrowLeft');try{await page.waitForFunction(()=>window.__socialPreview.bridge.state().x<=353);}finally{await page.keyboard.up('ArrowLeft');}await page.keyboard.down('ArrowDown');try{await page.waitForFunction(()=>window.__socialPreview.bridge.state().y>=214);}finally{await page.keyboard.up('ArrowDown');}}
try{
 await page.goto('http://127.0.0.1:5198/');await page.locator('#account-dialog[open]').waitFor();await page.locator('#account-register').click();
 for(const [id,value]of Object.entries({'account-name':'Sid','account-password':'isolated-session-password','account-confirm':'isolated-session-password','account-invite':'isolated-session'}))await page.locator('#'+id).fill(value);
 await page.locator('#account-submit').click();await ready();await page.locator('#more-tools summary').click();await page.locator('#settings-open').click();await page.locator('#quick-travel').check();await page.locator('#settings-dialog [data-close]').click();await travel('rest');await approach();
 const started=Date.now();let nextSample=60000;
 while(Date.now()-started<seconds*1000){
  await page.locator('.world').focus();await page.keyboard.press('e');await page.waitForFunction(()=>window.__socialPreview.bridge.state().seat!==null,undefined,{timeout:5000});seats++;
  await page.waitForTimeout(200);await page.keyboard.press('e');await page.waitForFunction(()=>window.__socialPreview.bridge.state().seat===null);cycles++;
  if(cycles%3===0){await page.locator('#chat-open').click();await page.locator('#chat-input').fill('isolated session '+cycles);await page.locator('#chat-input').press('Enter');await page.locator('#chat-panel [data-close]').click();}
  if(cycles%5===0){for(const stream of app.streams)stream.res.end();await page.waitForTimeout(2500);await ready();reconnects++;}
  if(cycles%10===0){await travel('hutong');await travel('rest');await approach();}
  if(cycles%15===0){await context.setOffline(true);await page.waitForTimeout(500);await context.setOffline(false);await ready();reconnects++;}
  if(Date.now()-started>nextSample){nextSample+=60000;const sample={seconds:Math.round((Date.now()-started)/1000),cycles,seats,reconnects,travelCount,errors:errors.length};console.log(JSON.stringify(sample));await writeFile(directory+'/progress.json',JSON.stringify(sample,null,2));}
  assert.deepEqual(errors,[]);await page.waitForTimeout(1000);
 }
 const diagnostics=await page.evaluate(()=>window.__interactionDiagnostics?.());assert.ok(diagnostics.some(row=>row.stage==='key'));assert.ok(diagnostics.length<=256);
 await page.screenshot({path:directory+'/desktop.png'});const report={passed:true,seconds:(Date.now()-started)/1000,cycles,seats,reconnects,travelCount,errors,diagnostics,environment:'local Chrome + file SQLite; PartyKit disabled'};await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,diagnostics:diagnostics.length}));
}catch(error){await page.screenshot({path:directory+'/failure.png'}).catch(()=>{});await writeFile(directory+'/verification.json',JSON.stringify({passed:false,cycles,seats,reconnects,travelCount,error:error.message,errors,diagnostics:await page.evaluate(()=>window.__interactionDiagnostics?.()).catch(()=>[])},null,2));throw error;}
finally{await browser.close();await vite.close();app.close();app.server.closeAllConnections();}
