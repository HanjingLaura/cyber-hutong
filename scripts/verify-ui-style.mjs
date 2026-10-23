import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createMvpServer} from '../server/app.mjs';
import {loadPlaywright} from './playwright.mjs';

// Disposable accounts: this never consumes one of the real world's permanent roles.
const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});
const {chromium}=loadPlaywright();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const backend=`http://127.0.0.1:${app.server.address().port}`;
// Source mode avoids recompressing the entire pixel atlas during the inspection pass.
let vite,origin=backend;
if(process.env.UI_STYLE_DEV){
 const {createServer}=await import('vite');
 vite=await createServer({base:'/cyber-hutong/',define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:backend,changeOrigin:false},'/cyber-hutong/api':{target:backend,changeOrigin:false}}}});
 await vite.listen();origin=`http://127.0.0.1:${vite.httpServer.address().port}`;
}
const output='output/frontend-style';await mkdir(output,{recursive:true});
const errors=[],report=[];
const capture=(page,options)=>process.env.UI_STYLE_NO_SCREENSHOTS?Promise.resolve():page.screenshot(options);
try{
 for(const [name,options,role] of [
  ['desktop',{viewport:{width:1440,height:900}},'laura'],
  ['mobile',{viewport:{width:390,height:844},isMobile:true,hasTouch:true},'cora'],
  ['tablet',{viewport:{width:820,height:1180},isMobile:true,hasTouch:true},'sid'],
  ['compact',{viewport:{width:320,height:740},isMobile:true,hasTouch:true},'jilly'],
  ['landscape',{viewport:{width:844,height:390},isMobile:true,hasTouch:true},'franco'],
 ]){
  if(process.env.UI_STYLE_VIEWPORTS&&!process.env.UI_STYLE_VIEWPORTS.split(',').includes(name))continue;
  const context=await browser.newContext(options),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/cyber-hutong/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#account-dialog')?.open);
  await page.evaluate(()=>document.fonts.ready);await capture(page,{path:`${output}/${name}-login.png`});
  await page.locator('#account-register').click();
  assert.ok(await page.locator('#account-guidance').isVisible());
  await capture(page,{path:`${output}/${name}-register.png`});
  const account=await app.store.register(`style_${role}`,'style-password-123',role);
  app.autonomy.reclaim(account.user.id);
  app.life.savePosition({id:account.user.id,scene:'hutong',x:320,y:194,facing:0,seat:null,activity:'walk'});
  app.store.db.prepare('INSERT INTO bags VALUES(?,?)').run(account.user.id,JSON.stringify([{name:'咖啡',count:2,seasoning:[]},null,{name:'面包',count:1,seasoning:[]},null]));
  app.life.addCollected(account.user.id,'扭蛋·粉色小熊',[],{scene:'pop',at:Date.now()});
  await context.addCookies([{name:'hutong_session',value:account.token,url:origin}]);
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__socialPreview?.getState().connected&&window.__socialPreview.bridge.state());
  await page.evaluate(()=>document.fonts.ready);
  await capture(page,{path:`${output}/${name}-game.png`});
  const targets=await page.locator('#game-tools > button,#game-tools > details > summary').evaluateAll(els=>els.map(el=>({label:el.textContent,w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height})));
  if(options.hasTouch)for(const b of targets){assert.ok(b.w>=44,b.label+' width');assert.ok(b.h>=44,b.label+' height');}
  await page.locator('#room-open').focus();await page.keyboard.press('Tab');
  assert.notEqual(await page.locator(':focus').evaluate(el=>getComputedStyle(el).outlineStyle),'none','keyboard focus visible');
  for(const [button,dialog,close]of [
   ['room-open','location-map','[data-cancel]'],
   ['bag-open','bag-dialog','[data-close-life]'],
   ['collection-open','collection-dialog','[data-close-life]'],
  ]){
   if(button==='collection-open'&&name==='compact')await page.locator('#more-tools summary').click();
   await page.locator('#'+button).click();await page.locator('#'+dialog+'[open]').waitFor();
   if(dialog==='location-map'){
    await page.locator('[data-place="rest"]').click();
    assert.equal(await page.locator('[data-place="rest"] img').evaluate(el=>getComputedStyle(el).filter),'none');
   }
   const box=await page.locator('#'+dialog).boundingBox();assert.ok(box.x>=-1&&box.x+box.width<=options.viewport.width+1,dialog+' viewport');
   await capture(page,{path:`${output}/${name}-${dialog}.png`});
   await page.locator('#'+dialog+' '+close).click();
  }
  await page.locator('#people-open').click();
  if(options.hasTouch)await page.locator('#touch-controls.hidden').waitFor({state:'attached'});
  await capture(page,{path:`${output}/${name}-people.png`});
  await page.locator('[data-close="people-panel"]').click();
  await page.locator('#chat-open').click();await page.locator('#chat-input').fill('样式检查');
  await page.locator('#chat-form button').click();await page.waitForFunction(()=>document.querySelector('#chat-history')?.textContent.includes('样式检查'));
  await capture(page,{path:`${output}/${name}-chat.png`});await page.locator('[data-close="chat-panel"]').click();
  await page.locator('#more-tools summary').click();await page.locator('#settings-open').click();
  await capture(page,{path:`${output}/${name}-settings.png`});await page.locator('[data-close="settings-dialog"]').click();
  if(name==='compact')await page.locator('#more-tools summary').click();
  await page.locator('#album-open').click();await capture(page,{path:`${output}/${name}-album.png`});
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(options.hasTouch){
   await page.waitForFunction(()=>!document.querySelector('dialog[open]')&&!document.querySelector('#touch-controls').classList.contains('hidden'));
   // A walking NPC may occupy the center spawn. Measure input on the clear exit aisle.
   const pose={id:account.user.id,scene:'hutong',x:580,y:194,facing:0,seat:null,activity:'walk'};
   app.life.savePosition(pose);Object.assign(app.players.get(account.user.id),pose,{at:Date.now()-3000});
   await page.evaluate(pose=>{const b=window.__socialPreview.bridge;b.apply({...b.state(),...pose});},pose);
   const cdp=await context.newCDPSession(page),zone=await page.locator('#stick-zone').boundingBox();
   const before=await page.evaluate(()=>window.__socialPreview.bridge.state());
   const point={x:zone.x+60,y:zone.y+zone.height-100};
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+45,y:point.y}]});
   await page.waitForTimeout(250);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(100);
   const after=await page.evaluate(()=>window.__socialPreview.bridge.state());
   assert.ok(after.x>before.x+1,JSON.stringify({check:'touch stick moves',name,before,after,hit:await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.id,point)}));await page.waitForTimeout(160);
   assert.ok(Math.abs((await page.evaluate(()=>window.__socialPreview.bridge.state())).x-after.x)<1,'touch release stops');
  }
  // Guest navigation exercises KTV chrome without changing the fixture's saved location.
  await context.clearCookies();await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#account-dialog')?.open);
  await page.evaluate(()=>{document.querySelector('#account-dialog').close();dispatchEvent(new CustomEvent('hutong:navigate',{detail:'ktv'}));});
  await page.locator('#ktv-dock').waitFor();await capture(page,{path:`${output}/${name}-ktv.png`});
  report.push({name,targets,horizontalOverflow:false,chatSent:true,mapPixelSharp:true,keyboardFocus:true,touchMoveAndRelease:!!options.hasTouch});
  await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`${output}/verification.json`,JSON.stringify({report,errors},null,2));
 console.log(JSON.stringify({report,errors}));
}finally{await browser.close();await vite?.close();app.close();}
