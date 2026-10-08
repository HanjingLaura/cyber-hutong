const {chromium}=require('./playwright.cjs').loadPlaywright();
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
 const {createMvpServer}=await import('../server/app.mjs');
 const rooms=JSON.parse(fs.readFileSync('shared/rooms.json','utf8'));
 const testJpeg=fs.readFileSync('server/fixtures/album-photo.jpg');
 const app=createMvpServer({dbPath:':memory:',staticDir:path.resolve('dist'),albumSeedImage:()=>testJpeg});
 const users={};
 for(const role of ['laura','jilly','cora','amber','sid','suki','kay','franco']){
   users[role]=await app.store.register(role+'_album_ui','test-password-123',role);
   const scene=['cora','sid'].includes(role)?'pop':'ktv',at=rooms[scene].exit;
   app.life.savePosition({id:users[role].user.id,scene,x:at[0],y:at[1],facing:0,seat:null,activity:'walk'});
   app.players.set(users[role].user.id,{id:users[role].user.id,role,scene,x:at[0],y:at[1],facing:0,seat:null,activity:'walk',moving:false,at:Date.now()});
 }
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+app.server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
 const output=path.resolve('output/playwright/album');fs.mkdirSync(output,{recursive:true});
 const errors=[];
 async function session(role,touch=false){
   const context=await browser.newContext({viewport:touch?{width:390,height:844}:{width:1280,height:720},hasTouch:touch,isMobile:touch});
   await context.addCookies([{name:'hutong_session',value:users[role].token,url:origin}]);
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/cyber-hutong/');
   await page.waitForFunction(()=>window.__socialPreview?.getState().user&&window.__socialPreview.bridge.active?.sys.settings.key!=='hutong');
   await page.locator('#album-open').click();await page.waitForFunction(()=>document.querySelector('#album-status').textContent==='');
   return {page,context};
 }
 try{
   const {page,context}=await session('laura');
   assert.match(await page.locator('#album-title').textContent(),/KTV/);
   assert.equal(await page.locator('#album-grid .album-photo').count(),2);
   await page.waitForFunction(()=>[...document.querySelectorAll('#album-grid img')].every(i=>i.complete&&i.naturalWidth>0));
   const labels=await page.locator('#game-tools button').allTextContents();assert.deepEqual(labels.slice(labels.indexOf('背包'),labels.indexOf('背包')+3),['背包','收藏','相册']);
   await page.screenshot({path:output+'/desktop.png'});
   await page.locator('#album-add').click();
   await page.locator('#album-files').setInputFiles(['server/fixtures/album-photo.jpg','server/fixtures/album-photo.jpg']);
   await page.locator('#album-submit:not([disabled])').waitFor();
   assert.equal(await page.locator('#album-previews img').count(),2);
   await page.locator('input[name="upload-recipient"][value="jilly"]').check();
   await page.locator('input[name="upload-recipient"][value="cora"]').check();
   await page.locator('#album-caption').fill('测试：只给 Jilly、Cora 的两张照片');
   await page.screenshot({path:output+'/desktop-upload.png'});
   await page.locator('#album-submit').click();
   await page.waitForFunction(()=>document.querySelectorAll('#album-grid .album-photo').length===4||document.querySelector('#album-status').classList.contains('album-error'));
   assert.equal(await page.locator('#album-grid .album-photo').count(),4,await page.locator('#album-status').textContent());
   const own=await context.request.get(origin+'/api/albums?scene=ktv');const photos=(await own.json()).photos.filter(p=>p.editable);assert.equal(photos.length,2);
   for(const role of ['jilly','cora','sid']){
     const res=await fetch(origin+'/api/album-photo?id='+photos[0].id,{headers:{Cookie:'hutong_session='+users[role].token}});
     assert.equal(res.status,role==='sid'?404:200);
   }
   await page.locator('#album-grid .album-photo-open').first().click();
   await page.locator('input[name="edit-visibility"][value="public"]').check();
   await page.locator('#album-save-sharing').click();await page.getByText('可见范围已更新。',{exact:true}).waitFor();
   const shared=await fetch(origin+'/api/album-photo?id='+photos[0].id,{headers:{Cookie:'hutong_session='+users.sid.token}});assert.equal(shared.status,200);
   await page.locator('input[name="edit-visibility"][value="selected"]').check();
   await page.locator('#album-save-sharing').click();await page.waitForFunction(()=>document.querySelector('#album-status').textContent==='可见范围已更新。');
   await page.locator('#album-delete').click();await page.locator('#album-confirm-delete').click();
   await page.waitForFunction(()=>document.querySelectorAll('#album-grid .album-photo').length===3);
   await page.locator('#album-close').click();
   const {page:mobile}=await session('cora',true);
   assert.match(await mobile.locator('#album-title').textContent(),/POP MART/);assert.equal(await mobile.locator('#album-grid .album-photo').count(),1);
   await mobile.waitForFunction(()=>document.querySelector('#album-grid img')?.naturalWidth>0);
   await mobile.screenshot({path:output+'/mobile.png'});
   await mobile.locator('#album-add').tap();await mobile.locator('#album-files').setInputFiles('server/fixtures/album-photo.jpg');await mobile.locator('#album-submit:not([disabled])').waitFor();
   await mobile.locator('input[name="upload-recipient"][value="laura"]').check();await mobile.locator('input[name="upload-recipient"][value="amber"]').check();
   await mobile.screenshot({path:output+'/mobile-upload.png'});
   assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await mobile.setViewportSize({width:844,height:390});await mobile.screenshot({path:output+'/mobile-landscape.png'});
   await mobile.locator('#album-cancel-upload').click();await mobile.locator('#album-close').click();
   const {page:denied}=await session('sid');assert.equal(await denied.locator('#album-grid .album-photo').count(),0);
   assert.deepEqual(errors,[]);
   console.log('Album browser checks passed: toolbar order, protected seed photos, real multi-upload, member multi-select, owner sharing/deletion, POP MART ACL, desktop and touch portrait/landscape.');
 }finally{await browser.close();app.close();app.server.closeAllConnections();}
})().catch(e=>{console.error(e);process.exitCode=1;});
