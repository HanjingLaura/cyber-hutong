import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {once} from 'node:events';
import {createServer as createViteServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {loadPlaywright} from './playwright.mjs';

const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});
const account=await app.store.register('laura','old-password-123','laura');
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const vite=await createViteServer({server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:'http://127.0.0.1:'+app.server.address().port,changeOrigin:false}}}});await vite.listen();
const origin='http://127.0.0.1:'+vite.httpServer.address().port;
const {chromium}=loadPlaywright(),browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']}),errors=[];
await mkdir('output/playwright/password-reset',{recursive:true});
try{
 for(const [name,viewport,touch]of [['desktop',{width:1280,height:720},false],['mobile',{width:390,height:844},true]]){
   const context=await browser.newContext({viewport,isMobile:touch,hasTouch:touch}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin);await page.locator('#account-dialog[open]').waitFor();
   await page.locator('#account-forgot').click();
   assert.equal(await page.locator('#account-title').innerText(),'重置密码');
   await page.locator('#account-name').fill('Laura');
   await page.locator('#account-reset-code').fill('bad-code');
   await page.locator('#account-password').fill('new-password-123');await page.locator('#account-confirm').fill('different-password-123');
   await page.locator('#account-submit').click();await page.getByText('两次密码不一致',{exact:true}).waitFor();
   await page.locator('#account-confirm').fill('new-password-123');await page.locator('#account-submit').click();
   await page.locator('#account-error').filter({hasText:'用户名或重置码不正确'}).waitFor();
   const issued=app.store.createPasswordReset('laura');await page.locator('#account-reset-code').fill(issued.code);
   await page.screenshot({path:`output/playwright/password-reset/${name}.png`});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.locator('#account-submit').click();await page.getByText('密码已修改，请用新密码登录。',{exact:true}).waitFor();
   assert.equal(await page.locator('#account-title').innerText(),'登录');
   assert.equal(await page.locator('#account-reset-code').inputValue(),'');assert.equal(await page.locator('#account-password').inputValue(),'');
   await page.locator('#account-password').fill('new-password-123');await page.locator('#account-submit').click();
   await page.waitForFunction(()=>window.__socialPreview?.getState().user?.role==='laura');
   await context.close();
 }
 assert.equal(app.store.session(account.token),null);assert.deepEqual(errors,[]);
 console.log('Password reset browser checks passed: desktop/mobile, confirmation errors, wrong code, successful reset, cleared secret fields and login with new password.');
}finally{await browser.close();await vite.close();app.close();app.server.closeAllConnections();}
