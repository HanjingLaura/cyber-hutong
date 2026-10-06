import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer as createViteServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {createWorld} from '../server/world.mjs';
import {roles} from '../server/personas.mjs';
import geometry from '../shared/interactions.json' with {type:'json'};
import {loadPlaywright} from './playwright.mjs';
const {chromium}=loadPlaywright();
const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const vite=await createViteServer({server:{port:5190,strictPort:true,host:'127.0.0.1',proxy:{'/api':{target:'http://127.0.0.1:'+app.server.address().port,changeOrigin:false}}}});await vite.listen();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const registered=await page.request.post('http://127.0.0.1:5190/api/register',{data:{username:'story_laura',password:'test-password-123',role:'laura'}});assert.equal(registered.status(),200);
 for(const role of roles.filter(r=>r!=='laura'))await app.store.register('story_'+role,'test-password-123',role);
 const originalNow=Date.now;let at=originalNow()+5001;Date.now=()=>at;
 try{
  app.autonomy.tick();for(const p of app.autonomy.doubles.values())p.next=Infinity;
  for(const [kind,people]of [['gacha',['laura']],['gift',['kay','sid']],['meet',['laura','sid']]]){
   const c=app.director.candidates(at).find(c=>c.kind===kind&&JSON.stringify(c.roles)===JSON.stringify(people));assert.ok(c,kind);app.director.start(c,at);const id=app.director.status().active.id;
   for(let i=0;i<1700;i++){at+=100;app.autonomy.tick(at,100);}assert.equal(app.store.db.prepare('SELECT status FROM activities WHERE id=?').get(id).status,'completed',kind);
  }
  const sid=app.store.byRole('sid'),laura=app.store.byRole('laura'),p=app.autonomy.get(sid.id);Object.assign(p,{scene:'hutong',x:192,y:242.12,seat:'L1',activity:'working'});app.life.recordGroup([laura.id,sid.id],'preview','Sid 办公时，Ani 在旁边。','hutong',at,'ani-browser-preview');
  for(const room of ['hawaii','rest','concert','rehearsal','bathroom','noodle','arcade','gym','dance','perler']){
   const seats=Object.entries(geometry[room].seats);for(const [i,account]of (seats.length===1?[laura]:[laura,sid]).entries()){const [seat,spec]=seats[room==='hawaii'&&i===1?seats.length-1:i];Object.assign(app.autonomy.get(account.id),{scene:room,x:spec.at[0],y:spec.at[1],seat,activity:'sit',facing:['concert','rehearsal','perler','noodle'].includes(room)||room==='hawaii'&&seat.includes('R')?2:0,moving:false});}
   app.life.recordGroup([laura.id,sid.id],'preview','座位检查 '+room,room,++at,'seat-check-'+room);
   if(room==='bathroom'){const actor=app.autonomy.get(laura.id);createWorld(app.store,app.life).interact(app.store.publicAccount(app.store.byId(laura.id)),actor,{object:'bathroom:door-0',action:'toggle',revision:app.store.byId(laura.id).revision,requestId:'bath-open-fixture'},new Map(),{skipRecord:true});app.life.recordGroup([laura.id,sid.id],'preview','座位检查 bathroom-open',room,++at,'seat-check-bathroom-open');}
  }
 }finally{Date.now=originalNow;}
 await page.goto('http://127.0.0.1:5190/');await page.waitForFunction(()=>window.__socialPreview?.getState().connected);await page.locator('.world').focus();await page.keyboard.press('j');await page.waitForFunction(()=>document.querySelector('#memory-canvas').dataset.ready==='true');
 await mkdir('output/playwright',{recursive:true});const seen=new Set();
 const checkedSeats=[];
 for(let i=0;i<24;i++){
  await page.waitForFunction(()=>document.querySelector('#memory-canvas').dataset.ready==='true');const caption=await page.locator('#memory-caption').textContent();
  if(caption.includes('Ani')){seen.add('ani');await page.screenshot({path:'output/playwright/story-ani.png'});}
  if(caption.includes('一起坐着休息')){seen.add('meet');await page.screenshot({path:'output/playwright/story-meeting.png'});}
  if(caption.includes('抽到了')){seen.add('gacha');await page.screenshot({path:'output/playwright/story-gacha.png'});}
  if(caption.includes('收下了'))seen.add('gift');
  if(caption.startsWith('座位检查 ')){const room=caption.slice(5).trim();checkedSeats.push(room);await page.screenshot({path:`output/playwright/seat-${room}.png`});}
  if(await page.locator('#memory-next').isDisabled())break;await page.locator('#memory-next').click();
 }
 const sidContext=await browser.newContext({viewport:{width:1100,height:800}}),sidPage=await sidContext.newPage();sidPage.on('pageerror',e=>errors.push(e.message));await sidContext.request.post('http://127.0.0.1:5190/api/login',{data:{username:'story_sid',password:'test-password-123'}});await sidPage.goto('http://127.0.0.1:5190/');await sidPage.waitForFunction(()=>window.__socialPreview?.getState().connected);await sidPage.locator('.world').focus();await sidPage.keyboard.press('j');
 for(let i=0;i<24;i++){await sidPage.waitForFunction(()=>document.querySelector('#memory-canvas').dataset.ready==='true');const caption=await sidPage.locator('#memory-caption').textContent();if(caption.includes('收下了')){seen.add('gift');await sidPage.screenshot({path:'output/playwright/story-gift.png'});break;}if(await sidPage.locator('#memory-next').isDisabled())break;await sidPage.locator('#memory-next').click();}
 assert.deepEqual([...seen].sort(),['ani','gacha','gift','meet']);assert.equal(checkedSeats.length,11);assert.deepEqual(errors,[]);await writeFile('output/story-browser-acceptance.json',JSON.stringify({threeActivities:true,sharedSnapshots:true,npcMemory:true,heldToyMemory:true,checkedSeats,errors},null,2));console.log('Three activities and additional seat scenes including open/closed doors rendered successfully');
}finally{await browser.close();await vite.close();app.close();}
