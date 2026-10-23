// Isolated browser fixture; actual E/F/Escape and movement exercise the board.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {loadPlaywright} from './playwright.mjs';
const directory='output/skateboard-alignment-'+Date.now();await mkdir(directory,{recursive:true});
process.env.HUTONG_INVITE='isolated-board';
const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{host:'127.0.0.1',port:0,watch:null,hmr:false,proxy:{'/api':{target:`http://127.0.0.1:${app.server.address().port}`,changeOrigin:false}}}});await vite.listen();
const origin=`http://127.0.0.1:${vite.httpServer.address().port}`;
const browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();page.setDefaultTimeout(60000);
const report={passed:false,directory,modelCalls:0,errors:[],states:[]};page.on('pageerror',e=>report.errors.push(e.message));
async function capture(name){
 await page.waitForTimeout(300);
 const state=await page.evaluate(()=>{const b=window.__socialPreview.bridge,s=b.active,v=b.views.get(s).get(b.user.role),board=s.board;return {mode:s.mode,bodyY:v.body.y,boardY:board.y,deckY:board.y-board.displayHeight/2+7,pose:v.pose};});
 report.states.push({name,...state});if(state.mode==='skateboard'||state.mode==='skate-sit')assert.equal(state.deckY,state.bodyY);
 await page.screenshot({path:directory+'/'+name+'.png'});
}
try{
 await page.goto(origin,{waitUntil:'domcontentloaded',timeout:90000});await page.locator('#account-dialog[open]').waitFor();
 const response=await context.request.post(origin+'/api/register/',{data:{username:'isolated_sid',password:'isolated-skateboard-password',role:'sid',invite:process.env.HUTONG_INVITE}});assert.equal(response.status(),200);
 const id=(await response.json()).user.id;await page.reload({timeout:90000});
 await page.waitForFunction(()=>{const b=window.__socialPreview?.bridge;return b?.connected&&b.controller&&!b.pendingSpawn&&!b.transitioning;});
 await page.locator('#more-tools summary').click();await page.locator('#settings-open').click();await page.locator('#quick-travel').check();await page.locator('#settings-dialog [data-close]').click();
 await page.locator('#room-open').click();const destination=page.locator('[data-place="campus"]');await destination.click();await destination.click();
 await page.waitForFunction(()=>window.__socialPreview.bridge.state().scene==='campus'&&!window.__socialPreview.bridge.transitioning&&!document.querySelector('#location-map').open);
 Object.assign(app.players.get(id),{x:320,y:310,fresh:true,moving:false});
 await page.evaluate(()=>{const b=window.__socialPreview.bridge;b.apply({...b.state(),x:320,y:310,moving:false});b.active.x=320;b.active.y=310;});
 await page.locator('.world').focus();await page.keyboard.press('e');await page.waitForFunction(()=>window.__memoryPlacePreviews.campus.getState().riding);
 await capture('standing');
 for(const key of ['d','a','w','s']){await page.keyboard.down(key);await page.waitForTimeout(250);await page.keyboard.up(key);await capture('moving-'+key);}
 await page.keyboard.press('f');await page.waitForFunction(()=>window.__memoryPlacePreviews.campus.getState().mode==='skate-sit');await capture('sitting');
 await page.keyboard.press('f');await page.waitForFunction(()=>window.__memoryPlacePreviews.campus.getState().mode==='skateboard');await capture('standing-again');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!window.__memoryPlacePreviews.campus.getState().riding);
 await page.keyboard.press('e');await page.waitForFunction(()=>window.__memoryPlacePreviews.campus.getState().riding);await capture('remount');
 await page.keyboard.press('e');await page.waitForFunction(()=>!window.__memoryPlacePreviews.campus.getState().riding);
 assert.deepEqual(report.errors,[]);assert.equal(app.llm.status().budget.calls,0);report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;await page.screenshot({path:directory+'/failure.png'}).catch(()=>{});}
finally{await browser.close();await vite.close();app.close();app.server.closeAllConnections();await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
