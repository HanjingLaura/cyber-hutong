// Isolated real UI actions. Quick-map travel prepares each scene; all movement,
// item mutations, draws and device claims use keyboard/pointer and the real API.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {sceneWalkable} from '../shared/walkability.mjs';
import {loadPlaywright} from './playwright.mjs';
const directory='output/playwright/shop-interactions-'+Date.now();await mkdir(directory,{recursive:true});
process.env.HUTONG_INVITE='isolated-shop-review';
const app=createMvpServer({dbPath:directory+'/game.sqlite',llmOptions:{key:''}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{watch:null,hmr:false,host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${app.server.address().port}`,changeOrigin:false}}}});await vite.listen();
const origin=`http://127.0.0.1:${vite.httpServer.address().port}`,browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']}),context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
const report={passed:false,environment:'isolated Chrome + file SQLite; model disabled; quick-map only for scene setup',checks:[],errors:[],failedImages:[]};let account,releaseInventory;const focusOnly=process.argv.includes('--focus-guards-only');
page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&/\.(png|webp|svg)(\?|$)/.test(r.url()))report.failedImages.push({status:r.status(),path:new URL(r.url()).pathname});});
const wait=ms=>new Promise(r=>setTimeout(r,ms)),state=()=>page.evaluate(()=>window.__socialPreview.bridge.state());
async function until(fn,label,ms=12000){const end=Date.now()+ms;do{if(await fn())return;await wait(50);}while(Date.now()<end);throw Error('Timed out: '+label);}
async function key(key){await page.locator('.world').focus();await page.keyboard.press(key);}
async function focusRestored(){await until(()=>page.evaluate(()=>document.activeElement===document.querySelector('.world')),'focus returned to world');}
async function movementResumes(checkE=false){
 await focusRestored();const before=await state();
 const code=await page.evaluate(()=>{const b=window.__socialPreview.bridge,s=b.active,p=b.state();return [[-12,0,'ArrowLeft'],[12,0,'ArrowRight'],[0,12,'ArrowDown'],[0,-12,'ArrowUp']].find(([dx,dy])=>s.canWalk(p.x+dx,p.y+dy)&&s.canWalk(p.x+dx/2,p.y+dy/2))?.[2];});
 assert.ok(code,'a clear movement direction');await page.keyboard.down(code);try{await until(async()=>{const p=await state();return Math.hypot(p.x-before.x,p.y-before.y)>2;},'keyboard movement without refocusing',2500);}finally{await page.keyboard.up(code);}
 if(checkE){await page.keyboard.press('e');await page.locator('#vending-menu[open]').waitFor();await page.keyboard.press('Escape');await focusRestored();}
}
async function hand(name){await until(async()=>(await state()).hand===name,'hand '+name);assert.equal(app.store.byId(account.id).hand,name);}
async function ready(){await page.waitForFunction(()=>{const b=window.__socialPreview?.bridge;return b?.connected&&b.controller&&!b.pendingSpawn&&!b.transitioning&&b.state();});}
async function travel(scene){await page.locator('#room-open').click();const button=page.locator(`[data-place="${scene}"]`);await button.click();await button.click();await until(async()=>{await ready();return (await state()).scene===scene&&!await page.locator('#location-map').evaluate(d=>d.open);},'travel '+scene);}
function route(scene,from,to,allowed){
 const step=8,cells=[],valid=(x,y)=>allowed?allowed.has(x+','+y):[[0,0],[3,0],[-3,0],[0,3],[0,-3]].every(([dx,dy])=>sceneWalkable(scene,x+dx,y+dy));
 for(let y=0;y<=360;y+=step)for(let x=0;x<=640;x+=step)if(valid(x,y))cells.push([x,y]);
 const near=p=>cells.reduce((a,b)=>Math.hypot(b[0]-p[0],b[1]-p[1])<Math.hypot(a[0]-p[0],a[1]-p[1])?b:a),start=near(from),end=near(to),key=p=>p.join(','),queue=[start],prev=new Map([[key(start),null]]);
 for(let i=0;i<queue.length&&!prev.has(key(end));i++)for(const [dx,dy]of [[step,0],[-step,0],[0,step],[0,-step]]){const p=[queue[i][0]+dx,queue[i][1]+dy],k=key(p);if(!prev.has(k)&&valid(...p)&&valid(p[0]-dx/2,p[1]-dy/2)){prev.set(k,queue[i]);queue.push(p);}}
 assert.ok(prev.has(key(end)),'route '+scene);const path=[];for(let p=end;p;p=prev.get(key(p)))path.push(p);path.reverse();const compressed=[path[0]];
 for(let i=1;i<path.length-1;i++)if(path[i][0]-path[i-1][0]!==path[i+1][0]-path[i][0]||path[i][1]-path[i-1][1]!==path[i+1][1]-path[i][1])compressed.push(path[i]);compressed.push(path.at(-1));return compressed;
}
async function axis(axis,target){const p=await state(),sign=Math.sign(target-p[axis]);if(Math.abs(target-p[axis])<1)return;const code=axis==='x'?(sign>0?'ArrowRight':'ArrowLeft'):(sign>0?'ArrowDown':'ArrowUp');await page.locator('.world').focus();await page.keyboard.down(code);try{await page.waitForFunction(({axis,target,sign})=>sign*(target-window.__socialPreview.bridge.state()[axis])<1,{axis,target,sign},{timeout:8000,polling:'raf'});}finally{await page.keyboard.up(code);}}
async function walk(point){const p=await state();const allowed=new Set(await page.evaluate(()=>{const scene=window.__socialPreview.bridge.active,result=[];for(let y=0;y<=360;y+=4)for(let x=0;x<=640;x+=4)if([[0,0],[3,0],[-3,0],[0,3],[0,-3]].every(([dx,dy])=>scene.canWalk(x+dx,y+dy)))result.push(x+','+y);return result;}));for(const next of route(p.scene,[p.x,p.y],point,allowed).slice(1)){await axis('x',next[0]);await axis('y',next[1]);}await wait(300);}
async function menuChoice(name){await page.locator('#noodle-choices').getByRole('button',{name,exact:true}).click();await focusRestored();}
async function record(name){report.checks.push(name);console.log(JSON.stringify({check:name,passed:true}));}
try{
 const registered=await context.request.post(origin+'/api/register/',{data:{username:'shop_trial_sid',password:'isolated-shop-password',role:'sid',invite:process.env.HUTONG_INVITE}});assert.equal(registered.status(),200);account=(await registered.json()).user;
 await page.goto(origin);await ready();await page.locator('#more-tools summary').click();await page.locator('#settings-open').click();await page.locator('#quick-travel').check();await page.locator('#settings-dialog [data-close]').click();
 if(!focusOnly){
 await travel('noodle');await walk([156,192]);await key('e');await hand('碗筷');await walk([280,192]);await key('e');await hand('米线');
 await walk([213,248]);await key('f');await page.locator('#noodle-menu[open]').waitFor();await menuChoice('放下米线');await hand(null);
 await key('f');await menuChoice('加醋');await until(()=>page.evaluate(()=>window.__noodlePreview.getState().tables[0].some(d=>d?.seasoning.includes('醋'))),'seasoning saved');
 await key('f');await menuChoice('拿回米线（醋）');await hand('米线');await walk([179,312]);await key('e');await until(async()=>!!(await state()).seat,'sit at noodle table');await key('f');await menuChoice('吃东西');await hand(null);await key('Escape');await until(async()=>!(await state()).seat,'stand from noodle table');await record('noodle utensils / noodles / put / season / take / sit / consume / stand');
 await walk([104,192]);await key('e');await menuChoice('可乐');await hand('可乐');await page.locator('#hand-use').click();await hand(null);await focusRestored();
 await walk([476,192]);await key('e');await menuChoice('鸡柳');await hand('鸡柳');await page.locator('#hand-use').click();await hand(null);await focusRestored();await record('noodle drinks and chicken use generated icons and remain consumable');
 }
 await travel('rest');const targets=await page.evaluate(()=>window.__restPreview.getState().targets);const fridge=targets.find(t=>t.id==='fridge');await walk([fridge.x,fridge.y+10]);await key('e');await page.locator('#fridge-menu[open]').waitFor();await page.locator('#fridge-items button:not([disabled])').first().click();await until(async()=>!!(await state()).hand,'fridge take');await page.locator('#fridge-store').click();await hand(null);await key('Escape');await focusRestored();await record('fridge take / put back / Escape restores input');
 const vending=targets.find(t=>t.id==='vending');await walk([vending.x,vending.y+10]);await key('e');await page.locator('#vending-menu[open]').waitFor();await page.locator('[data-product="薯片"]').click();await hand('薯片');await focusRestored();await page.locator('#hand-use').click();await hand(null);await focusRestored();await movementResumes(true);await record('vending take / consume / direct E reopens menu / focus restores');
 // Failure must release input too; a late success must preserve a newer chat focus.
 await key('e');await page.locator('#vending-menu[open]').waitFor();await page.locator('[data-product="薯片"]').click();await hand('薯片');await focusRestored();
 await page.route('**/api/inventory/**',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'隔离测试：取用失败，请重试'})}));
 await page.locator('#hand-use').click();await until(()=>page.locator('#game-notice').innerText().then(t=>t.includes('取用失败')),'inventory error shown');await focusRestored();await hand('薯片');await page.unroute('**/api/inventory/**');await movementResumes();await record('failed quick action restores movement focus and keeps the item');
 await page.route('**/api/inventory/**',async route=>{const response=await route.fetch();await new Promise(resolve=>releaseInventory=resolve);await route.fulfill({response});});
 await page.locator('#hand-use').click();await until(()=>!!releaseInventory,'held inventory result');await page.locator('#chat-open').click();await page.locator('#chat-input').focus();releaseInventory();releaseInventory=undefined;
 await hand(null);await until(()=>page.evaluate(()=>!document.querySelector('#hand-stow').disabled),'inventory settles');assert.equal(await page.evaluate(()=>document.activeElement?.id),'chat-input');await page.locator('[data-close="chat-panel"]').click();await focusRestored();await page.unroute('**/api/inventory/**');await record('late quick-action result preserves a newer chat input focus');
 if(!focusOnly){
 await travel('pop');await walk([320,296]);await key('e');await page.locator('#blind-menu[open]').waitFor();await page.locator('[data-box]:not([disabled])').first().click();await page.locator('#blind-extract').click();await page.locator('#blind-result img').waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('#blind-result img')].every(i=>i.complete&&i.naturalWidth>0));await page.locator('#blind-close').click();await focusRestored();await record('blind box opens / real result image / panel releases input');
 await walk([438,176]);await key('e');await page.locator('#blind-menu[open]').waitFor();await page.locator('#blind-extract').click();await until(()=>page.evaluate(()=>window.__popPreview.getState().capsule==='ready'),'gacha ready');await page.locator('#blind-extract').click();await page.locator('#blind-result img').waitFor();await until(async()=>(await state()).hand?.startsWith('扭蛋·'),'gacha hand');await page.locator('#blind-close').click();await focusRestored();await page.locator('#hand-collect').click();await hand(null);await record('gacha draw / open / hold / collect');
 await travel('arcade');await walk([269,205]);await key('e');await page.locator('#arcade-game[open]').waitFor();assert.equal(await page.locator('#arcade-title').innerText(),'抓娃娃');const screen=await page.locator('#arcade-screen').boundingBox();await page.mouse.click(screen.x+140/640*screen.width,screen.y+230/420*screen.height);await page.locator('#arcade-action').click();await until(async()=>(await state()).hand?.startsWith('娃娃·'),'claw real award',15000);await page.screenshot({path:directory+'/claw-reward.png'});await page.locator('#arcade-close').click();await focusRestored();await page.locator('#hand-collect').click();await hand(null);await record('claw device lease / aim / grab / server reward / collect');
 await travel('hutong');await page.evaluate(async()=>{const {openDeskComputer}=await import('/src/desk-computer.ts');openDeskComputer();});assert.equal(await page.locator('#desk-computer .desk-app').count(),6);await page.keyboard.press('Escape');await focusRestored();await key('ArrowRight');await record('computer Escape returns focus and movement');
 await page.reload();await ready();await page.locator('#collection-open').click();await page.locator('#collection-dialog[open]').waitFor();assert.ok(await page.locator('#collection-slots img').count()>=2);await page.waitForFunction(()=>[...document.querySelectorAll('#collection-slots img')].every(i=>i.complete&&i.naturalWidth>0));await page.screenshot({path:directory+'/restored-collection.png'});await page.locator('#collection-dialog [data-close-life]').click();await focusRestored();await record('reload restores earned gacha and plush collection with images');
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedImages,[]);report.passed=true;
}catch(error){report.error=error.message;report.state=await state().catch(()=>null);report.notice=await page.locator('#game-notice').innerText().catch(()=>null);report.input=await page.evaluate(()=>({activeTag:document.activeElement?.tagName,activeId:document.activeElement?.id,openDialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id),keyboardEnabled:window.__socialPreview?.bridge.active?.input.keyboard?.enabled})).catch(()=>null);await page.screenshot({path:directory+'/failure.png'}).catch(()=>{});process.exitCode=1;}
finally{releaseInventory?.();await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({directory,...report}));await browser.close();await vite.close();app.close();app.server.closeAllConnections();}
