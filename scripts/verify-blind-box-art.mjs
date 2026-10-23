import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {loadPlaywright} from './playwright.mjs';
const machine=process.argv.includes('--machine');
const directory='output/'+(machine?'capsule-machine-':'blind-box-art-')+Date.now();await mkdir(directory,{recursive:true});process.env.HUTONG_INVITE='isolated-box-art';
const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{host:'127.0.0.1',port:0,watch:null,hmr:false,proxy:{'/api':{target:`http://127.0.0.1:${app.server.address().port}`,changeOrigin:false}}}});await vite.listen();
const origin=`http://127.0.0.1:${vite.httpServer.address().port}`,browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();page.setDefaultTimeout(60000);
const report={passed:false,directory,modelCalls:0,errors:[],sizes:[]};page.on('pageerror',e=>report.errors.push(e.message));
function stage(value){report.stage=value;console.log(JSON.stringify({stage:value}));}
async function capture(name){
 if(!machine)await page.waitForFunction(()=>[...document.querySelectorAll('#blind-boxes img')].every(i=>i.complete&&i.naturalWidth===48&&i.naturalHeight===64));
 else await page.waitForFunction(()=>document.querySelector('#gacha-art').getContext('2d').getImageData(20,40,1,1).data[3]>0);
 const layout=await page.locator('#blind-menu').evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,viewport:[innerWidth,innerHeight],images:[...e.querySelectorAll('.box-art')].map(i=>({width:i.width,height:i.height}))};});
 assert(layout.x>=0&&layout.right<=layout.viewport[0]&&layout.y>=0&&layout.bottom<=layout.viewport[1]);report.sizes.push({name,...layout});await page.screenshot({path:directory+'/'+name+'.png'});
}
try{
 stage('load');
 await page.goto(origin,{waitUntil:'domcontentloaded',timeout:90000});await page.locator('#account-dialog[open]').waitFor();
 const response=await context.request.post(origin+'/api/register/',{data:{username:'box_art_sid',password:'isolated-box-art-password',role:'sid',invite:process.env.HUTONG_INVITE}});assert.equal(response.status(),200);const id=(await response.json()).user.id;
 stage('registered');await page.reload({timeout:90000});await page.waitForFunction(()=>{const b=window.__socialPreview?.bridge;return b?.connected&&b.controller&&!b.pendingSpawn&&!b.transitioning;});stage('connected');
 await page.locator('#more-tools summary').click();await page.locator('#settings-open').click();await page.locator('#quick-travel').check();await page.locator('#settings-dialog [data-close]').click();
 await page.locator('#room-open').click();const destination=page.locator('[data-place="pop"]');await destination.click();await destination.click();await page.waitForFunction(()=>window.__socialPreview.bridge.state().scene==='pop'&&!window.__socialPreview.bridge.transitioning&&!document.querySelector('#location-map').open);
 const pose=machine?{x:438,y:185,facing:2}:{x:320,y:302,facing:2};Object.assign(app.players.get(id),{...pose,fresh:true,moving:false});await page.evaluate(pose=>{const b=window.__socialPreview.bridge;b.apply({...b.state(),...pose,moving:false});Object.assign(b.active,pose);},pose);
 stage('at shelf');await page.locator('.world').focus();await page.keyboard.press('e');await page.locator('#blind-menu[open]').waitFor();await capture('desktop');stage('desktop captured');
 if(machine){
  await page.locator('#blind-extract').click();await page.waitForFunction(()=>window.__popPreview.getState().capsule==='ready');await capture('capsule-ready');
  await page.locator('#blind-extract').click();await page.waitForFunction(()=>window.__popPreview.getState().capsule==='opened');await page.locator('#blind-result strong').waitFor();
 }else{
  await page.locator('.blind-slot:not(:disabled)').first().click();assert.equal(await page.locator('.blind-slot[aria-pressed="true"]').count(),1);await page.locator('#blind-extract').click();await page.locator('#blind-result .blind-reveal').waitFor();
 }report.drawSucceeded=true;
 await page.locator('#blind-close').click();await page.keyboard.press('e');await page.locator('#blind-menu[open]').waitFor();
 await page.setViewportSize({width:390,height:844});await capture('mobile');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#blind-menu').open);report.closeAndReopen=true;
 assert.deepEqual(report.errors,[]);assert.equal(app.llm.status().budget.calls,0);report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;await page.screenshot({path:directory+'/failure.png'}).catch(()=>{});}
finally{await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();await vite.close();app.close();app.server.closeAllConnections();}
