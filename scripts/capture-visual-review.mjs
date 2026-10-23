// Disposable visual-review fixture. API quick travel is capture setup only,
// and does not count toward the physical-navigation acceptance evidence.
import {mkdir,writeFile,access} from 'node:fs/promises';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {loadPlaywright} from './playwright.mjs';
const directory='output/visual-review-'+Date.now();await mkdir(directory,{recursive:true});process.env.HUTONG_INVITE='isolated-visual';
const app=createMvpServer({dbPath:directory+'/game.sqlite',llmOptions:{key:''}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{watch:null,hmr:false,host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${app.server.address().port}`,changeOrigin:false}}}});await vite.listen();const origin=`http://127.0.0.1:${vite.httpServer.address().port}`;
console.log(JSON.stringify({directory,origin,stopFile:directory+'/stop',model:false}));await writeFile(directory+'/session.json',JSON.stringify({directory,origin,stopFile:directory+'/stop'},null,2));
const browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']}),context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
try{
 await page.goto(origin+'/');await page.locator('#account-dialog[open]').waitFor();await page.screenshot({path:directory+'/login.png'});
 await context.request.post(origin+'/api/register/',{data:{username:'visual_trial_sid',password:'isolated-visual-password',role:'sid',invite:process.env.HUTONG_INVITE}});await page.reload();await page.waitForFunction(()=>window.__socialPreview?.bridge.connected&&!window.__socialPreview.bridge.pendingSpawn);
 await page.locator('#more-tools summary').click();await page.locator('#settings-open').click();await page.locator('#quick-travel').check();await page.locator('#settings-dialog [data-close]').click();
 for(const scene of ['hutong','rest','ktv','yousheng','google','meeting','street','campus']){
  if(scene!=='hutong'){await page.locator('#room-open').click();const button=page.locator(`[data-place="${scene}"]`);await button.click();await button.click();await page.waitForFunction(scene=>window.__socialPreview.bridge.state()?.scene===scene&&!window.__socialPreview.bridge.transitioning&&!document.querySelector('#location-map').open,scene);}
  await page.waitForTimeout(400);await page.screenshot({path:directory+'/'+scene+'.png'});
 }
 await page.locator('#room-open').click();await page.screenshot({path:directory+'/map-desktop.png'});await page.keyboard.press('Escape');await page.locator('#chat-open').click();await page.screenshot({path:directory+'/chat-desktop.png'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:directory+'/chat-mobile.png'});await page.locator('#chat-panel [data-close]').click();await page.screenshot({path:directory+'/mobile.png'});
 console.log(JSON.stringify({captured:true,directory,origin}));
 const end=Date.now()+900000;while(Date.now()<end){try{await access(directory+'/stop');break;}catch{}await new Promise(r=>setTimeout(r,1000));}
}finally{await browser.close();await vite.close();app.close();app.server.closeAllConnections();console.log(JSON.stringify({stopped:true,directory}));}
