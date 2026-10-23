import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer as portProbe} from 'node:net';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {loadPlaywright} from './playwright.mjs';
import rooms from '../shared/rooms.json' with {type:'json'};

const directory='output/zhu-appearance-'+Date.now();await mkdir(directory,{recursive:true});
const app=createMvpServer({dbPath:directory+'/state.sqlite',llmOptions:{key:''}});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const probe=portProbe();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null,proxy:{'/api':{target:`http://127.0.0.1:${app.server.address().port}`}}}});await vite.listen();
const origin=`http://127.0.0.1:${port}`,browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']}),context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
const report={passed:false,environment:'isolated SQLite / Chrome / no model / no PartyKit',checks:[],errors:[]};page.on('pageerror',e=>report.errors.push(e.message));
async function travel(target){console.log('travel',target);await page.locator('#room-open').click();const card=page.locator(`[data-place="${target}"]`);await card.click();await card.click();await page.waitForFunction(target=>window.__socialPreview.bridge.state()?.scene===target&&!window.__socialPreview.bridge.transitioning&&!document.querySelector('#location-map').open,target,{timeout:60000});await page.waitForTimeout(250);}
async function forceChoice(value,action){await page.evaluate(value=>{window.__originalRandom=Math.random;Math.random=()=>value;},value);try{await action();}finally{await page.evaluate(()=>{Math.random=window.__originalRandom;delete window.__originalRandom;});}}
const guest=()=>page.evaluate(()=>window.__easterEggPreview.getState().find(p=>p.id==='zhu'));
try{
 const session=await app.store.register('ZhuAppearanceJilly','isolated-test-password','jilly');await context.addCookies([{name:'hutong_session',value:session.token,url:origin}]);
 await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>{const b=window.__socialPreview?.bridge;return b?.connected&&b.controller&&b.user?.role&&b.state()&&!b.pendingSpawn&&!b.transitioning;});
 await page.locator('#more-tools summary').click();await page.locator('#settings-open').click();await page.locator('#quick-travel').check();await page.keyboard.press('Escape');
 if(process.argv.includes('--all-exits')){
  for(const target of ['manner',...Object.keys(rooms).filter(key=>key!=='manner')]){
   await travel(target);
   const labels=await page.evaluate(()=>({dom:[...document.querySelectorAll('.scene-sign:not([hidden])')].map(n=>n.textContent.trim()),canvas:window.__socialPreview.bridge.active.children.list.filter(n=>typeof n.text==='string'&&n.visible).map(n=>n.text.trim())}));
   assert.ok(![...labels.dom,...labels.canvas].includes('出口'),'exit lettering in '+target);
   await page.locator('.world').focus();await page.keyboard.press('e');await page.locator('#location-map[open]').waitFor();await page.keyboard.press('Escape');
   await page.screenshot({path:directory+'/'+target+'.png'});report.checks.push(target+': no exit lettering; E navigation works');
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
 }else{
 await travel('manner');assert.equal(await page.locator('.scene-sign:visible').filter({hasText:/^出口$/}).count(),0);
 await page.screenshot({path:directory+'/manner.png'});await page.locator('.world').focus();await page.keyboard.press('e');await page.locator('#location-map[open]').waitFor();await page.keyboard.press('Escape');report.checks.push('MANNER exit label removed; actual E exit opens map');
 await forceChoice(.1,()=>travel('concert'));assert.equal((await guest()).appearance,'classic');await page.screenshot({path:directory+'/classic.png'});
 await page.waitForTimeout(1000);assert.equal((await guest()).appearance,'classic');
 await travel('manner');await forceChoice(.9,()=>travel('concert'));const winter=await guest();assert.equal(winter.appearance,'winter');assert.equal(winter.height,54);assert.equal(winter.owner,'jilly');
 await page.waitForTimeout(1000);assert.equal((await guest()).appearance,'winter');
 const alpha=await page.evaluate(()=>{const s=window.__socialPreview.bridge.active,t=s.textures.get('guest-zhu-winter').getSourceImage(),ctx=t.getContext('2d'),d=ctx.getImageData(0,0,t.width,t.height).data;let opaque=0,green=0,transparent=0;for(let i=0;i<d.length;i+=4){if(!d[i+3])transparent++;else{opaque++;if(d[i+1]>180&&d[i]<100&&d[i+2]<100)green++;}}return{opaque,green,transparent,width:t.width,height:t.height};});assert.ok(alpha.opaque>10000);assert.ok(alpha.transparent>10000);assert.equal(alpha.green,0);report.alpha=alpha;
 await page.screenshot({path:directory+'/winter.png'});report.checks.push('classic and winter rendered across real scene transitions; stable between frames; fixed height/owner; green backdrop removed');
 const clicked=await page.evaluate(()=>{const b=window.__socialPreview.bridge,s=b.active,image=s.children.list.find(p=>p.texture?.key==='guest-zhu-winter');let received=null;const listener=e=>received=e.detail;window.addEventListener('hutong:npc-interact',listener,{once:true});image.emit('pointerdown');window.removeEventListener('hutong:npc-interact',listener);return received;});assert.equal(clicked,'zhu');report.checks.push('winter sprite retains Zhu interaction ID');
 assert.deepEqual(report.errors,[]);report.passed=true;
 }
}catch(e){report.error=e.stack;report.state=await page.evaluate(()=>({state:window.__socialPreview?.bridge.state(),controller:window.__socialPreview?.bridge.controller,connected:window.__socialPreview?.bridge.connected,transitioning:window.__socialPreview?.bridge.transitioning,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>({id:d.id,text:d.textContent.slice(-900)}))}));await page.screenshot({path:directory+'/failure.png'});process.exitCode=1;}
finally{await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({directory,...report}));await browser.close();await vite.close();await app.close();}
