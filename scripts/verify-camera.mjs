import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import sharp from 'sharp';
import {loadPlaywright} from './playwright.mjs';
import {createMvpServer} from '../server/app.mjs';

const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});
await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{host:'127.0.0.1',port:5199,strictPort:true,proxy:{'/api':{target:`http://127.0.0.1:${app.server.address().port}`,changeOrigin:false}}}});
await vite.listen();
const origin='http://127.0.0.1:5199',browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true});
const dir='output/camera';await mkdir(dir,{recursive:true});const errors=[];let recentPage;
const photos=async page=>(await(await page.request.get(origin+'/api/albums/?scene=google')).json()).photos;
async function session(role,touch=false){
 const account=await app.store.register(role+'_camera','camera-test-password',role);
 app.life.savePosition({id:account.user.id,scene:'google',x:580,y:330,facing:0,seat:null,activity:'walk'});
 const context=await browser.newContext({viewport:touch?{width:390,height:844}:{width:1280,height:800},isMobile:touch,hasTouch:touch});
 await context.addCookies([{name:'hutong_session',value:account.token,url:origin}]);
 const page=await context.newPage();recentPage=page;page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
 await page.waitForFunction(()=>{const b=window.__socialPreview?.bridge;return b?.connected&&b.user?.role&&b.active?.sys.settings.key==='google'&&!b.pendingSpawn&&!b.transitioning;},null,{timeout:60000});
 return {page,context};
}
async function openCamera(page){
 if(!await page.locator('#camera-open').isVisible())await page.locator('#more-tools summary').click();
 await page.locator('#camera-open').click();await page.locator('#camera-confirm:not([disabled])').waitFor();
}
async function drag(page,reverse=false){
 const box=await page.locator('#camera-stage').boundingBox();assert(box);
 const a={x:box.x+box.width*.15,y:box.y+box.height*.2},b={x:box.x+box.width*.85,y:box.y+box.height*.8};
 await page.mouse.move((reverse?b:a).x,(reverse?b:a).y);await page.mouse.down();await page.mouse.move((reverse?a:b).x,(reverse?a:b).y,{steps:10});await page.mouse.up();
 const match=(await page.locator('#camera-status').innerText()).match(/取景 (\d+) × (\d+)/);assert(match);return {width:Number(match[1]),height:Number(match[2])};
}
try{
 const {page}=await session('sid');const before=(await photos(page)).length;
 await openCamera(page);const full=await page.locator('#camera-frame').evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight}));
 assert(full.width>=640&&full.height>=360);
 await page.locator('#camera-stage').press('Shift+ArrowLeft');
 assert.match(await page.locator('#camera-status').innerText(),new RegExp(`取景 ${full.width-1} × ${full.height}`));
 await page.locator('#camera-full').click();
 await drag(page);await page.locator('#camera-cancel').click();assert.equal((await photos(page)).length,before);
 await openCamera(page);const expected=await drag(page,true);
 assert(expected.width<full.width&&expected.height<full.height);
 await page.screenshot({path:dir+'/desktop-selection.png'});
 await page.locator('#camera-confirm').click();await page.locator('#album-dialog[data-capture=true][open]').waitFor();await page.locator('#album-previews img').waitFor();
 await page.waitForFunction(()=>document.querySelector('#album-previews img')?.naturalWidth>0);
 const preview=await page.locator('#album-previews img').evaluate(async img=>({width:img.naturalWidth,height:img.naturalHeight,data:Array.from(new Uint8Array(await(await fetch(img.src)).arrayBuffer()))}));
 assert.equal(preview.width,expected.width);assert.equal(preview.height,expected.height);
 const stats=await sharp(Buffer.from(preview.data)).stats();assert(stats.channels.some(c=>c.stdev>10),'snapshot contains actual scene pixels');
 await page.screenshot({path:dir+'/desktop-preview.png'});
 await page.locator('#album-cancel-upload').click();await page.locator('#album-dialog').waitFor({state:'hidden'});assert.equal((await photos(page)).length,before,'cancel after cropping does not upload');
 await openCamera(page);await drag(page);await page.keyboard.press('Escape');assert.equal(await page.locator('#scene-camera[open]').count(),0);
 // Saving retries use the same prepared image/request id.
 await openCamera(page);await drag(page);await page.locator('#camera-confirm').click();await page.locator('#album-submit:not([disabled])').waitFor();
 await page.locator('#album-caption').fill('框选拍照测试');let rejected=false;
 await page.route('**/api/albums/',route=>{if(route.request().method()==='POST'&&!rejected){rejected=true;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'测试暂时无法保存'})});}return route.continue();});
 await page.locator('#album-submit').click();await page.locator('#album-status.album-error').waitFor();assert.equal((await photos(page)).length,before);
 await page.locator('#album-submit').click();await page.waitForFunction(()=>document.querySelector('#album-compose').hidden);
 const saved=(await photos(page)).filter(p=>p.owner==='sid');assert.equal(saved.length,1);assert.equal(saved[0].visibility,'selected');assert.equal(saved[0].caption,'框选拍照测试');
 const bytes=await(await page.request.get(origin+'/api/album-photo/?id='+saved[0].id)).body();assert((await sharp(bytes).metadata()).width<full.width);await writeFile(dir+'/saved-crop.jpg',bytes);
 await page.locator('#album-close').click();await page.locator('#album-open').click();await page.getByRole('button',{name:'查看 框选拍照测试',exact:true}).waitFor();await page.locator('#album-close').click();
 const {page:mobile}=await session('jilly',true);assert(!(await photos(mobile)).some(p=>p.id===saved[0].id),'other account cannot see private capture');
 await openCamera(mobile);
 const box=await mobile.locator('#camera-stage').boundingBox();const cdp=await mobile.context().newCDPSession(mobile);
 const touch=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1}]});
 await touch('touchStart',box.x+box.width*.1,box.y+box.height*.1);
 await touch('touchMove',box.x+box.width*.75,box.y+box.height*.75);await touch('touchEnd');
 assert.match(await mobile.locator('#camera-status').innerText(),/取景 \d+ × \d+/);
 await mobile.screenshot({path:dir+'/mobile-selection.png'});
 await mobile.locator('#camera-confirm').tap();await mobile.locator('#album-dialog[data-capture=true][open]').waitFor();
 await mobile.locator('input[name="upload-visibility"][value="public"]').check();await mobile.locator('#album-caption').fill('触屏框选拍照');
 assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mobile.screenshot({path:dir+'/mobile-preview.png'});
 await mobile.locator('#album-submit').tap();await mobile.waitForFunction(()=>document.querySelector('#album-compose').hidden);
 assert((await photos(page)).some(p=>p.caption==='触屏框选拍照'&&p.owner==='jilly'),'public capture visible to another account');
 assert.deepEqual(errors,[]);
 await writeFile(dir+'/verification.json',JSON.stringify({full,expected,realPixels:true,cancelBeforeAndAfterCrop:true,escape:true,retryWithoutDuplicate:true,privateVisibility:true,publicVisibility:true,touchDrag:true,errors},null,2));
 console.log('Camera checks passed: real renderer snapshot, reverse crop, exact source dimensions, cancellation, save/retry, album reopen, privacy, touch selection and no page errors.');
}catch(error){await recentPage?.screenshot({path:dir+'/failure.png'});console.log(await recentPage?.evaluate(()=>({camera:document.querySelector('#scene-camera')?.hasAttribute('open'),status:document.querySelector('#camera-status')?.textContent,disabled:document.querySelector('#camera-confirm')?.disabled,album:document.querySelector('#album-dialog')?.hasAttribute('open'),notice:document.querySelector('#game-notice')?.textContent})));throw error;}finally{await browser.close();await vite.close();app.close();app.server.closeAllConnections();}
