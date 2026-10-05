import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createServer as createViteServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('D:/CodexHome/mcp/node/node_modules/playwright');
const backend=createMvpServer({dbPath:':memory:'});
await new Promise(resolve=>backend.server.listen(0,'127.0.0.1',resolve));
const api=`http://127.0.0.1:${backend.server.address().port}`;
const vite=await createViteServer({server:{port:5186,strictPort:true,host:'127.0.0.1',proxy:{'/api':{target:api,changeOrigin:false}}}});
await vite.listen();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
const roles=['suki','sid','jilly','laura','kay','franco','cora','amber'];
try{
 await mkdir('output/playwright',{recursive:true});
 const review=await browser.newPage({viewport:{width:900,height:850}});
 await review.goto('http://127.0.0.1:5186/members.html');
 await review.waitForFunction(()=>window.__memberPreview?.getState().ready);
 for(const [label,action,direction]of [['standing','0','1'],['walk','1','1'],['run','9','1'],['typing-front','10','0'],['typing-back','10','2']]){
  await review.locator('#team-action').selectOption(action);await review.locator('#team-direction').selectOption(direction);
  await review.locator('#team-frame').fill('0');await review.waitForTimeout(150);
  await review.locator('#team-stage').screenshot({path:`output/playwright/nine-${label}.png`});
  assert.equal((await review.evaluate(()=>window.__memberPreview.getState())).members.length,9);
 }
 await review.close();
 const pages=[];const errors=[];
 const apiProblems=[];
 for(const role of roles){
  // HTTP/1 browsers allow six persistent connections per host; real players use separate devices.
  const origin=roles.indexOf(role)%2?'http://localhost:5186':'http://127.0.0.1:5186';
  const context=await browser.newContext({viewport:{width:1100,height:850}});const page=await context.newPage();pages.push(page);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',async response=>{if(response.url().includes('/api/register')&&response.status()!==200)apiProblems.push({role,status:response.status(),body:await response.text()});});
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});await page.locator('#account-dialog[open]').waitFor();
  if(role==='suki')await page.screenshot({path:'output/playwright/login.png'});
  await page.locator('#account-register').click();await page.locator('#account-name').fill(role);
  await page.locator('#account-invite').fill('browser-verification');await page.locator('#account-password').fill('browser-test-password');
  await page.locator('#account-confirm').fill('browser-test-password');
  if(role==='suki')await page.screenshot({path:'output/playwright/register.png'});
  await page.locator('#account-submit').click();
  try{await page.waitForFunction(()=>!document.querySelector('#account-dialog').open,{},{timeout:20000});}catch(e){console.error({role,apiProblems,error:await page.locator('#account-error').textContent()});throw e;}
  console.log('Connected '+role);
  // Keep the browser session and realtime connection, release the heavy game renderer.
  await page.route('**/acceptance-client',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Realtime acceptance client</title>'}));
  await page.goto(origin+'/acceptance-client',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{const client=crypto.randomUUID();window.__acceptanceStream=new EventSource('/api/events?client='+client);});
 }
 await pages[0].waitForTimeout(500);
 assert.equal(backend.players.size,8);assert.ok(backend.streams.size>=8);assert.deepEqual([...backend.players.values()].map(p=>p.role).sort(),[...roles].sort());
 const login=await (await browser.newContext({viewport:{width:1100,height:850}})).newPage();
 await login.route('**/assets/characters/team/v3/laura.png*',async route=>{await new Promise(resolve=>setTimeout(resolve,1600));await route.continue();});
 await login.addInitScript(()=>{window.__oldOutfitFrames=[];const attach=()=>{const bridge=window.__socialPreview?.bridge;if(!bridge){requestAnimationFrame(attach);return;}bridge.game.events.on('postrender',()=>{if(bridge.user?.role==='laura')window.__oldOutfitFrames.push(!!bridge.active?.actor?.visible);});};requestAnimationFrame(attach);});
 await login.goto('http://127.0.0.1:5186/',{waitUntil:'domcontentloaded'});await login.locator('#account-dialog[open]').waitFor();
 await login.locator('#account-name').fill('laura');await login.locator('#account-password').fill('browser-test-password');await login.locator('#account-submit').click();
 await login.waitForFunction(()=>window.__socialPreview?.getState().connected&&window.__socialPreview.getState().players.length===8,{},{timeout:20000});
 assert.equal((await login.evaluate(()=>window.__socialPreview.getState())).user.role,'laura');
 await login.waitForFunction(()=>{const bridge=window.__socialPreview.bridge;return [...bridge.views.values()].some(views=>views.size===8&&[...views.values()].every(view=>view.ready));},{},{timeout:20000});
 assert.equal(await login.evaluate(()=>window.__oldOutfitFrames.some(Boolean)),false,'Old black actor flashed during Laura loading');
 await login.screenshot({path:'output/playwright/laura-entry-white.png'});

 const assets=await login.evaluate(()=>{
  const bridge=window.__socialPreview.bridge,views=bridge.views.get(bridge.active),carry=[];
  for(const [role,view]of views){
   const p=bridge.players.find(p=>p.role===role);
   for(const direction of [1,3])for(let phase=0;phase<8;phase++){
    view.draw({...p,moving:true,seat:null,hand:'咖啡'},250,230,direction,16,false,61.44,1,false,'',undefined,phase);
    carry.push({role,phase,pose:view.pose,texture:view.body.texture.key,prop:view.prop.visible});
   }
  }
  const view=views.get('laura'),p=bridge.players.find(p=>p.role==='laura'),dance=[];
  for(const direction of [0,2])for(let phase=0;phase<2;phase++){
   view.draw({...p,moving:false,seat:null,hand:null},250,230,direction,16,false,61.44,1,false,'dance',undefined,phase);
   dance.push({pose:view.pose,texture:view.body.texture.key,direction,phase});
  }
  return {carry,dance};
 });
 assert.equal(assets.carry.length,128);
 assets.carry.forEach(f=>{assert.equal(f.pose,'carry-walk-side-v12-'+f.phase);assert.equal(f.texture,'team-v3-'+f.role+'-carry-walk-v12');assert.equal(f.prop,true);});
 assets.dance.forEach(f=>{assert.equal(f.pose,'dance-v12-'+(f.direction+f.phase));assert.equal(f.texture,'team-v3-laura-dance-v12');});
 console.log('Actual game avatars use approved carry assets for all eight roles and corrected Laura front/back dance assets.');
 assert.deepEqual(errors,[]);
 console.log('Verified nine rendered members, login/register, eight isolated browser accounts and eight live connections.');
}finally{await browser.close();await vite.close();backend.close();}

