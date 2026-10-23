// Isolated visual fixture. UI quick travel and direct pose/panel setup are
// screenshot preparation, not evidence for physical navigation or game actions.
import {mkdir,writeFile,access} from 'node:fs/promises';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {loadPlaywright} from './playwright.mjs';
import net from 'node:net';
const directory='output/playwright/all-art-scenes-'+Date.now();
await mkdir(directory,{recursive:true});
process.env.HUTONG_INVITE='isolated-art-review';
const app=createMvpServer({dbPath:directory+'/game.sqlite',llmOptions:{key:''}});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const vitePort=socket.address().port;await new Promise(r=>socket.close(r));
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{watch:null,hmr:false,host:'127.0.0.1',port:vitePort,strictPort:true,proxy:{'/api':{target:`http://127.0.0.1:${app.server.address().port}`,changeOrigin:false}}}});
await vite.listen();
const origin=`http://127.0.0.1:${vite.httpServer.address().port}`;
const session={directory,origin,apiPort:app.server.address().port,model:false,hmr:false};
await writeFile(directory+'/session.json',JSON.stringify(session,null,2));console.log(JSON.stringify(session));
const browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
const errors=[],failedImages=[],failedRequests=[],scenes=[],geometry=[];let exitError;
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400&&/\.(png|jpg|webp|svg)(\?|$)/i.test(r.url()))failedImages.push({url:r.url(),status:r.status()});});
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
const keys=['hutong','hawaii','rest','pop','bathroom','concert','arcade','noodle','gym','dance','perler','rehearsal','elevator','subway','ktv','yousheng','google','meeting','street','campus'];
async function travel(scene){
 if(await page.evaluate(()=>window.__socialPreview.bridge.state()?.scene)===scene)return;
 await page.locator('#room-open').click();const b=page.locator(`[data-place="${scene}"]`);await b.click();await b.click();
 await page.waitForFunction(scene=>window.__socialPreview.bridge.state()?.scene===scene&&!window.__socialPreview.bridge.transitioning&&!document.querySelector('#location-map').open,scene);
}
async function capture(name){await page.waitForTimeout(220);await page.screenshot({path:directory+'/'+name+'.png'});}
async function measure(name,selector){geometry.push(await page.evaluate(({name,selector})=>{const e=document.querySelector(selector),r=e?.getBoundingClientRect();return {name,viewport:[innerWidth,innerHeight],pageOverflow:document.documentElement.scrollWidth>innerWidth,bounds:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,visible:!!r&&r.width>0&&r.height>0,contained:!!r&&r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};},{name,selector}));}
try{
 await page.goto(origin+'/');await page.locator('#account-dialog[open]').waitFor();
 const registration=await context.request.post(origin+'/api/register/',{data:{username:'art_review_sid',password:'isolated-art-review-password',role:'sid',invite:process.env.HUTONG_INVITE}});
 if(!registration.ok())throw new Error('Fixture registration '+registration.status()+': '+await registration.text());
 await page.reload();await page.waitForFunction(()=>window.__socialPreview?.bridge.connected&&!window.__socialPreview.bridge.pendingSpawn);
 await page.locator('#more-tools summary').click();await page.locator('#settings-open').click();await page.locator('#quick-travel').check();await page.locator('#settings-dialog [data-close]').click();
 for(const key of process.argv.some(a=>['--panels-only','--responsive-only'].includes(a))?[]:keys){
  await travel(key);await page.waitForTimeout(600);
  const state=await page.evaluate(()=>{const b=window.__socialPreview.bridge,s=b.active;return {scene:b.state()?.scene,ready:!!s&&s.sys.isActive()&&!s.load.isLoading(),canvas:[b.game.canvas.width,b.game.canvas.height],textures:s.children.list.filter(c=>c.texture).map(c=>({key:c.texture.key,width:c.texture.getSourceImage()?.width,height:c.texture.getSourceImage()?.height,visible:c.visible})),missing:s.children.list.filter(c=>c.texture?.key==='__MISSING').length};});
  if(!state.ready||state.missing)throw new Error(key+' not ready/missing texture '+JSON.stringify(state));
  await capture(key+'-page');
  const raw=await page.locator('#game canvas').evaluate(c=>c.toDataURL().split(',')[1]);await writeFile(directory+'/'+key+'-canvas.png',Buffer.from(raw,'base64'));
  await page.evaluate(()=>{const b=window.__socialPreview.bridge,s=b.active,c=s.cameras.main,parts=new Set();for(const map of [b.views.get(s),b.mirrors.get(s)])for(const a of map?.values()??[]){for(const name of ['body','upper','prop','arm','label'])if(a[name])parts.add(a[name]);for(const group of [a.legs,a.held])for(const value of Object.values(group??{}))if(value?.scene===s&&typeof value.setVisible==='function')parts.add(value);}window.__artCaptureIgnored=[...parts];c.ignore([...parts]);});
  await page.waitForTimeout(100);
  const clean=await page.locator('#game canvas').evaluate(c=>c.toDataURL().split(',')[1]);
  const cleanPath=directory+'/'+key+'-scenery.png';await writeFile(cleanPath,Buffer.from(clean,'base64'));
  let refreshed=false;const destination='assets/maps/memories/'+key+'.png';try{await access(destination);await writeFile(destination,Buffer.from(clean,'base64'));refreshed=true;}catch(e){if(e.code!=='ENOENT')throw e;}
  await page.evaluate(()=>{const s=window.__socialPreview.bridge.active,c=s.cameras.main;for(const p of window.__artCaptureIgnored??[])p.cameraFilter&=~c.id;delete window.__artCaptureIgnored;});
  scenes.push({...state,key,previewRefreshed:refreshed,previewAvatarRemoved:true});console.log(JSON.stringify({scene:key,ready:true,previewRefreshed:refreshed}));
 }
 if(!process.argv.includes('--responsive-only')){
 await travel('arcade');
 await page.evaluate(()=>{const g=window.__socialPreview.bridge.active.games;g.kind='claw';g.loadPrizes();document.querySelector('#arcade-title').textContent='抓娃娃';g.dialog.showModal();g.draw();});await page.locator('#arcade-game[open]').waitFor();await capture('claw-panel');await measure('claw-panel','#arcade-game');await page.locator('#arcade-close').click();
 await travel('noodle');
 await page.evaluate(()=>{const s=window.__socialPreview.bridge.active;s.sit(0);});await capture('noodle-seated');
 await page.keyboard.press('f');await page.locator('#noodle-menu[open]').waitFor();await capture('noodle-table-menu');await page.locator('#noodle-close').click();
 await page.evaluate(()=>{const s=window.__socialPreview.bridge.active;s.stand();s.x=104;s.y=181;s.interact();});await page.locator('#noodle-menu[open]').waitFor();await capture('noodle-drinks-menu');await page.locator('#noodle-close').click();
 await page.evaluate(()=>{const s=window.__socialPreview.bridge.active;s.x=476;s.y=181;s.interact();});await page.locator('#noodle-menu[open]').waitFor();await capture('noodle-chicken-menu');await page.locator('#noodle-close').click();
 await page.evaluate(async()=>{const s=window.__socialPreview.bridge.active;const {playerInventory}=await import('/src/player-inventory.ts');playerInventory.hand='米线';s.dishes[0]=[{name:'米线',seasoning:[]},{name:'鸡柳',seasoning:[]},{name:'炸鸡',seasoning:[]},{name:'可乐',seasoning:[]},{name:'冰红茶',seasoning:[]},null];s.sit(0);});await capture('noodle-complete-food');
 await page.keyboard.press('f');await capture('noodle-complete-table-menu');await page.locator('#noodle-close').click();
 await page.setViewportSize({width:390,height:844});await capture('noodle-mobile');await page.keyboard.press('f');await capture('noodle-mobile-menu');await page.locator('#noodle-close').click();
 }
 await page.setViewportSize({width:1440,height:900});await travel('street');await page.setViewportSize({width:390,height:844});await capture('street-mobile');
 await page.setViewportSize({width:1440,height:900});await travel('ktv');await page.setViewportSize({width:390,height:844});await capture('ktv-mobile-390');await measure('ktv-mobile-390','#ktv-dock');
 await page.setViewportSize({width:320,height:740});await capture('ktv-mobile-320');await measure('ktv-mobile-320','#ktv-dock');
 await page.setViewportSize({width:1440,height:900});await travel('hutong');
 for(const [width,height]of [[1440,900],[390,844],[320,740]]){
  await page.setViewportSize({width,height});await page.evaluate(async()=>{const {openDeskComputer}=await import('/src/desk-computer.ts');openDeskComputer();});
  await capture('computer-'+width);await measure('computer-'+width,'#desk-computer');
  geometry.push(await page.evaluate(()=>{const a=document.querySelector('.desk-icons'),b=document.querySelector('.desk-taskbar'),r=a.getBoundingClientRect(),t=b.getBoundingClientRect();return {name:'computer-icon-taskbar',width:innerWidth,iconBottom:r.bottom,taskbarTop:t.top,overlap:r.bottom>t.top+1,iconCount:a.querySelectorAll('a').length,scrollHeight:a.scrollHeight,clientHeight:a.clientHeight};}));
  await page.locator('.desk-close').click();
 }
}catch(error){exitError=error;try{await page.screenshot({path:directory+'/failure.png'});}catch{}console.error(error.stack);}
finally{
 const report={...session,sceneCount:scenes.length,scenes,geometry,errors,failedImages,failedRequests,fixtureOnly:'UI quick travel and direct scene pose/panel/inventory preparation; no functional-navigation claims',previews:'Only existing assets/maps/memories files refreshed. Player TeamAvatar camera ignored. Places source backgrounds never overwritten.',error:exitError?.message??null};
 await writeFile(directory+'/report.json',JSON.stringify(report,null,2));
 await browser.close();await vite.close();app.close();app.server.closeAllConnections();console.log(JSON.stringify({stopped:true,directory,sceneCount:scenes.length,errors:errors.length,failedImages:failedImages.length}));
}
if(exitError)process.exitCode=1;
