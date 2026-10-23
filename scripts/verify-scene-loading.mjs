import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createMvpServer} from '../server/app.mjs';
import {loadPlaywright} from './playwright.mjs';
import rooms from '../shared/rooms.json' with {type:'json'};

// Disposable local accounts only. Run after npm run build; never writes to production.
const {chromium}=loadPlaywright(),app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});
app.server.prependListener('request',(req,res)=>{if(req.url.includes('/assets/'))res.setHeader('Cache-Control','public,max-age=31536000,immutable');});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+app.server.address().port,base=origin+'/cyber-hutong/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:process.argv.includes('--webgl')?[]:['--disable-webgl']});
const result={renderer:process.argv.includes('--webgl')?'webgl':'canvas',first:[],repeat:[],rooms:[],errors:[],badResources:[]};
await mkdir('output/scene-loading',{recursive:true});
let context;
try{
 for(const target of ['rest','arcade','ktv']){
  const account=await app.store.register('loading_'+target,'scene-loading-password',['laura','cora','sid'][result.first.length]);
  app.autonomy.reclaim(account.user.id);
  app.players.set(account.user.id,{id:account.user.id,role:account.user.role,scene:'hutong',x:rooms.hutong.exit[0],y:rooms.hutong.exit[1],facing:0,seat:null,activity:'walk',moving:false,at:Date.now()});
  context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage(),requests=[];
  await context.addCookies([{name:'hutong_session',value:account.token,url:origin}]);
  page.on('pageerror',e=>result.errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)result.badResources.push({url:r.url(),status:r.status()});});
  page.on('request',r=>requests.push({url:r.url(),type:r.resourceType(),body:r.postDataJSON?.()}));
  await page.goto(base);await page.waitForFunction(()=>window.__socialPreview?.getState().connected&&window.__socialPreview.bridge.state()?.scene==='hutong');
  await page.waitForFunction(()=>{const b=window.__socialPreview.bridge;return b.views.get(b.active)?.get(b.user.role)?.ready;});
  await page.waitForTimeout(500);
  if(result.renderer==='webgl')assert.equal(await page.evaluate(()=>window.__socialPreview.bridge.game.renderer.type),2,'exercise WebGL, not Canvas fallback');
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:300,downloadThroughput:1500000,uploadThroughput:500000});
  async function travel(place,prefetchMs=0){
   await page.locator('#room-open').click();await page.waitForTimeout(500);const startIndex=requests.length;
   await page.locator(`[data-place="${place}"]`).click();await page.waitForTimeout(prefetchMs);
   const started=performance.now();await page.locator(`[data-place="${place}"]`).click();
   if(prefetchMs){
    assert.ok(await page.locator('#location-map [data-cancel]').isDisabled(),'prevent closing a loading source and moving before confirmation');
    await page.keyboard.press('Escape');assert.ok(await page.locator('#location-map').evaluate(dialog=>dialog.open));
   }
   await page.waitForFunction(place=>window.__socialPreview.getState().room===place&&!window.__socialPreview.bridge.transitioning&&!document.querySelector('#location-map').open,place,{timeout:30000});
   const ms=Math.round(performance.now()-started),during=requests.slice(startIndex),images=during.filter(r=>r.type==='image');
   const confirmed=during.find(r=>r.url.includes('/api/presence/')&&r.body?.checkpoint===true),transition=during.find(r=>r.url.includes('/api/transition/'));
   assert.ok(confirmed,'source pose checkpoint must run during travel');assert.equal(typeof transition?.body?.checkpoint,'string');
   assert.equal(during.filter(r=>r.type==='xhr'&&r.url.includes('/assets/')).length,0,'no second Blob image loader');
   return {target:place,ms,images:images.map(r=>r.url.split('/').at(-1))};
  }
  const first=await travel(target,300);result.first.push(first);
  assert.ok(!first.images.some(url=>/hutong-|desk-decor|rest-interaction|water-bottle/.test(url)),'already cached shared assets never crowd the destination');
  await page.locator('#game canvas').first().screenshot({path:`output/scene-loading/${result.renderer}-${target}.png`});
  await travel('hutong');const repeat=await travel(target);assert.deepEqual(repeat.images,[],'repeat entry reuses decoded Phaser textures');result.repeat.push(repeat);
  if(target==='ktv'){
   await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
   for(const place of Object.keys(rooms).filter(key=>key!=='ktv')){await travel(place);result.rooms.push(place);}
   const dimensions=await page.evaluate(()=>Object.fromEntries(['wall','reverse','hawaii-wall','rest-shell','arcade-room','ktv-room','pop-room','concert-room'].map(key=>{const image=window.__socialPreview.bridge.game.textures.get(key).getSourceImage();return [key,{width:image.width,height:image.height}];})));
   for(const key of ['wall','reverse','hawaii-wall','rest-shell','arcade-room','ktv-room'])assert.deepEqual(dimensions[key],{width:640,height:360});
   for(const key of ['pop-room','concert-room'])assert.ok(dimensions[key].width>640,'cropped source remains native');
   result.dimensions=dimensions;
  }
  await context.close();context=null;
 }
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.badResources,[]);
 await writeFile(`output/scene-loading/verified-${result.renderer}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{if(context)await context.close();await browser.close();app.close();}
