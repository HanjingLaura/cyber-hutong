import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {loadPlaywright} from './playwright.mjs';
import {sceneWalkable} from '../shared/walkability.mjs';
import {TARGETS} from '../src/ttc/rules.mjs';

const directory='output/ttc';await mkdir(directory,{recursive:true});
process.env.HUTONG_INVITE='ttc-local-check';
const app=createMvpServer({dbPath:directory+'/acceptance-'+Date.now()+'.sqlite',llmOptions:{key:''}});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{watch:null,hmr:false,host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${app.server.address().port}`,changeOrigin:false}}}});
await vite.listen();const origin=`http://127.0.0.1:${vite.httpServer.address().port}`;
const browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
const report={passed:false,checks:[],errors:[],fixture:'Five fixed hiding locations. Arcade approach pose arranged through existing adapter; real E, pointer, keyboard and touch controls perform gameplay. Isolated SQLite, model disabled.'};
const context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage();
page.on('pageerror',e=>report.errors.push(e.message));
async function aim(p,x,y){const b=await p.locator('.ttc-scene').boundingBox();return {x:b.x+x*b.width/1280,y:b.y+y*b.height/720};}
try{
 await page.goto(origin+'/ttc.html');await page.getByLabel('选择场景').selectOption('0');await page.getByRole('button',{name:'开始寻找'}).click();
 await page.screenshot({path:directory+'/five-coras.png'});
 await page.mouse.click(...Object.values(await aim(page,5,5)));
 await page.waitForFunction(()=>document.querySelector('.ttc-feedback').textContent.includes('扣 3 秒'));
 await page.getByRole('button',{name:'放大',exact:true}).click();
 await page.mouse.move(...Object.values(await aim(page,515.5,382)));
 await page.screenshot({path:directory+'/desktop-lens.png'});
 for(let i=0;i<TARGETS.length;i++){
  const t=TARGETS[i];await page.mouse.click(...Object.values(await aim(page,t.x+t.w*.5,t.y+t.h*.3)));
  await page.waitForFunction(n=>document.querySelector('.ttc-target small').textContent===`${n} / 5`,i+1);
  if(i===0){
   assert.equal(await page.locator('.ttc-notice').isVisible(),false);
   await page.getByRole('button',{name:'提示一次'}).click();
   await page.waitForFunction(()=>document.querySelector('.ttc-feedback').textContent.includes('左边的窗户'));
  }
 }
 await page.waitForFunction(()=>document.querySelector('.ttc-notice strong').textContent==='找齐了 Cora');
 assert.equal(await page.locator('.ttc-target small').textContent(),'5 / 5');
 report.checks.push('desktop miss penalty, lens and visible hit');
 await page.getByRole('button',{name:'再玩一次'}).click();
 await page.getByRole('button',{name:'提示一次'}).click();assert.equal(await page.getByRole('button',{name:'提示一次'}).isDisabled(),true);
 await page.mouse.click(...Object.values(await aim(page,515,410)));
 await page.waitForFunction(()=>document.querySelector('.ttc-feedback').textContent.includes('扣 3 秒'));
 report.checks.push('one-use hint; covered body misses');
 await page.getByRole('button',{name:'重来',exact:true}).click();
 await page.clock.install();await page.clock.fastForward(61000);
 await page.waitForFunction(()=>document.querySelector('.ttc-notice strong').textContent==='时间到了');
 report.checks.push('timeout reveals target and ends round');
 await page.keyboard.press('Escape');assert.equal(await page.locator('.ttc-game').evaluate(d=>d.open),false);
 await page.getByRole('button',{name:'打开击倒TTC'}).click();await page.getByRole('button',{name:'开始寻找'}).waitFor();
 report.checks.push('Escape close and reopen');

 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});const mp=await mobile.newPage();mp.on('pageerror',e=>report.errors.push(e.message));
 await mp.goto(origin+'/ttc.html');await mp.getByLabel('选择场景').selectOption('0');await mp.getByRole('button',{name:'开始寻找'}).click();
 await mp.getByRole('button',{name:'放大',exact:true}).click();
 for(let i=0;i<TARGETS.length;i++){
  const t=TARGETS[i],a=await aim(mp,t.x+t.w*.5,t.y+t.h*.3);await mp.touchscreen.tap(a.x,a.y);
  if(i===0)await mp.screenshot({path:directory+'/mobile.png'});
  await mp.getByRole('button',{name:'射击',exact:true}).click();
  await mp.waitForFunction(n=>document.querySelector('.ttc-target small').textContent===`${n} / 5`,i+1);
 }
 await mp.waitForFunction(()=>document.querySelector('.ttc-notice strong').textContent==='找齐了 Cora');
 assert.ok(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
 report.checks.push('mobile touch aim, magnifier, fire; no page scrolling');await mobile.close();

 await page.goto(origin+'/');await page.locator('#account-dialog[open]').waitFor();
 const r=await context.request.post(origin+'/api/register/',{data:{username:'ttc_tester',password:'isolated-ttc-password',role:'cora',invite:process.env.HUTONG_INVITE}});assert.equal(r.status(),200);const id=(await r.json()).user.id;
 await page.reload();await page.waitForFunction(()=>{const b=window.__socialPreview?.bridge;return b?.connected&&b.controller&&!b.pendingSpawn;},null,{timeout:30000});
 await page.locator('#more-tools summary').click();await page.locator('#settings-open').click();await page.locator('#quick-travel').check();await page.locator('#settings-dialog [data-close]').click();
 await page.locator('#room-open').click();const room=page.locator('[data-place="arcade"]');await room.click();await room.click();
 await page.waitForFunction(()=>window.__socialPreview.bridge.state().scene==='arcade'&&!window.__socialPreview.bridge.transitioning);
 Object.assign(app.players.get(id),{x:286,y:324,fresh:true,moving:false});
 await page.evaluate(()=>{const b=window.__socialPreview.bridge;b.apply({...b.state(),x:286,y:324,moving:false});b.active.x=286;b.active.y=324;});
 await page.locator('.world').focus();await page.screenshot({path:directory+'/arcade-cabinet.png'});
 assert.equal(sceneWalkable('arcade',286,290),false);assert.equal(sceneWalkable('arcade',286,324),true);assert.equal(sceneWalkable('arcade',340,324),true);
 await page.keyboard.press('e');await page.getByRole('button',{name:'开始寻找'}).waitFor();
 await page.getByRole('button',{name:'开始寻找'}).click();await page.screenshot({path:directory+'/arcade-playing.png'});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.ttc-game').open);
 assert.ok(await page.locator('.world').evaluate(e=>e===document.activeElement));
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(170);await page.keyboard.up('ArrowRight');
 assert.ok(await page.evaluate(()=>window.__socialPreview.bridge.state().x>286));
 report.checks.push('arcade cabinet, collision, real E opens, Escape restores movement');
 assert.deepEqual(report.errors,[]);assert.equal(app.llm.status().budget.calls,0);report.passed=true;
}catch(e){report.error=e.stack;process.exitCode=1;await page.screenshot({path:directory+'/failure.png'}).catch(()=>{});}
finally{await browser.close();await vite.close();app.close();app.server.closeAllConnections();await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
