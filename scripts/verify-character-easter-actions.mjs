import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer as createViteServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {loadPlaywright} from './playwright.mjs';
import geometry from '../shared/interactions.json' with {type:'json'};
const {chromium}=loadPlaywright();
const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const vite=await createViteServer({server:{port:5197,strictPort:true,host:'127.0.0.1',proxy:{'/api':{target:'http://127.0.0.1:'+app.server.address().port}}}});await vite.listen();
const origin='http://127.0.0.1:5197',browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']}),errors=[];
try{
 await mkdir('output/playwright',{recursive:true});
 async function client(role,scene,x,y){
  const account=await app.store.register('actions_'+role,'character-action-password',role);
  app.autonomy.reclaim(account.user.id);
  app.players.set(account.user.id,{id:account.user.id,role,scene,x,y,facing:0,seat:null,activity:'walk',moving:false,at:Date.now()});
  const context=await browser.newContext({viewport:{width:1100,height:800}});
  await context.addCookies([{name:'hutong_session',value:account.token,url:origin}]);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.waitForFunction(scene=>window.__socialPreview?.getState().connected&&window.__socialPreview.bridge.state()?.scene===scene&&!window.__socialPreview.bridge.transitioning,scene);
  await page.waitForFunction(role=>window.__socialPreview.bridge.views.get(window.__socialPreview.bridge.active)?.get(role)?.ready,role);
  return {page,id:account.user.id};
 }
 const franco=await client('franco','hutong',...geometry.hutong.seats.R4.approach);
 const observer=await client('sid','hutong',320,260);
 const pose=page=>page.evaluate(()=>{const b=window.__socialPreview.bridge,v=b.views.get(b.active)?.get('franco');return v?.pose;});
 await franco.page.locator('.world').focus();await franco.page.keyboard.press('e');
 await franco.page.waitForFunction(()=>window.__hutongPreview.getState().seatedAt==='R4');
 await franco.page.waitForFunction(()=>{const b=window.__socialPreview.bridge;return b.views.get(b.active).get('franco').pose.startsWith('call-back-');});
 await observer.page.waitForFunction(()=>{const b=window.__socialPreview.bridge;return b.views.get(b.active)?.get('franco')?.pose.startsWith('call-back-');});
 const initial=await pose(franco.page);
 await franco.page.waitForFunction(initial=>{const b=window.__socialPreview.bridge;return b.views.get(b.active).get('franco').pose!==initial;},initial);
 await franco.page.screenshot({path:'output/playwright/franco-call-back.png'});
 await franco.page.keyboard.press('v');
 await franco.page.waitForFunction(()=>{const b=window.__socialPreview.bridge;return b.views.get(b.active).get('franco').pose.startsWith('call-front-');});
 await franco.page.screenshot({path:'output/playwright/franco-call-front.png'});
 const computer=await franco.page.evaluate(()=>{
  const b=window.__socialPreview.bridge,s=b.active.seats.find(s=>s.id==='R4'),bounds=s.laptop.getBounds(),canvas=b.game.canvas,rect=canvas.getBoundingClientRect();
  return {x:rect.x+bounds.centerX*rect.width/canvas.width,y:rect.y+bounds.centerY*rect.height/canvas.height,interactive:!!s.laptop.input?.enabled};
 });
 assert.ok(computer.interactive);await franco.page.mouse.click(computer.x,computer.y);
 await franco.page.locator('#desk-computer[open]').waitFor();
 assert.deepEqual(await franco.page.locator('.desk-app').evaluateAll(links=>links.map(a=>a.dataset.app)),['grokbot','codex','ani','feishu']);
 assert.ok((await pose(franco.page)).startsWith('call-front-'));
 await franco.page.locator('.desk-close').click();await franco.page.keyboard.press('Escape');
 await franco.page.waitForFunction(()=>window.__hutongPreview.getState().seatedAt===null);
 await franco.page.waitForFunction(()=>{const b=window.__socialPreview.bridge;return !b.views.get(b.active).get('franco').pose.startsWith('call-');});
 async function arrange(player,scene,x,y){
  Object.assign(app.players.get(player.id),{scene,x,y,seat:null,activity:'walk',moving:false,at:Date.now()});
  await player.page.evaluate(({scene,x,y})=>{const b=window.__socialPreview.bridge;b.apply({...b.state(),scene,x,y});},{scene,x,y});
 }
 await arrange(franco,'hutong',...geometry.hutong.seats.L4.approach);
 await franco.page.keyboard.press('e');await franco.page.waitForFunction(()=>window.__hutongPreview.getState().seatedAt==='L4');
 await franco.page.waitForFunction(()=>{const b=window.__socialPreview.bridge;return !b.views.get(b.active).get('franco').pose.startsWith('call-');});await franco.page.keyboard.press('Escape');
 // No workstations are assigned in Hawaii; a chair there must stay a normal seat.
 const office=await franco.page.evaluate(async()=>{const {TeamAvatar}=await import('/src/multiplayer/avatar.ts');const b=window.__socialPreview.bridge,v=new TeamAvatar(b.active,'franco');await new Promise(resolve=>{const timer=setInterval(()=>{if(v.ready){clearInterval(timer);resolve();}},20);});
  const cases=[];for(const [seat,hand]of [['R3',null],['R3','咖啡'],['L3',null]]){v.draw({...b.state(),scene:'hawaii',seat,hand,moving:false},200,200,0,16,true,61.44,1,false,'working',183,0);cases.push({seat,hand,pose:v.pose,prop:v.prop.visible});}v.destroy();return cases;});
 assert.ok(office.every(row=>!row.pose.startsWith('call-')));
 console.log('Franco: automatic call, both views, remote rendering, computer App list, exit, other desks and inventory passed.');

 const laura=await client('laura','rehearsal',320,219);
 Object.assign(app.players.get(observer.id),{scene:'rehearsal',x:420,y:340,seat:null,activity:'walk',moving:false,at:Date.now()});
 await observer.page.evaluate(()=>{const b=window.__socialPreview.bridge;Object.assign(b.players.find(p=>p.role==='sid'),{scene:'rehearsal',x:420,y:340,seat:null,activity:'walk'});b.pendingSpawn={...b.state(),role:'sid',scene:'rehearsal',x:420,y:340,seat:null,activity:'walk',moving:false};window.dispatchEvent(new CustomEvent('hutong:navigate',{detail:'rehearsal'}));});
 await observer.page.waitForFunction(()=>window.__rehearsalPreview?.getState().active&&!window.__socialPreview.bridge.transitioning);
 await laura.page.locator('.world').focus();await laura.page.keyboard.press('e');
 await laura.page.waitForFunction(()=>window.__rehearsalPreview.getState().mode==='podium'&&window.__rehearsalPreview.getState().saxophoneNotesPlayed>1);
 await laura.page.waitForFunction(()=>{const b=window.__socialPreview.bridge;return b.views.get(b.active).get('laura').pose.startsWith('saxophone-front-');});
 await observer.page.waitForFunction(()=>{const b=window.__socialPreview.bridge;return b.views.get(b.active)?.get('laura')?.pose.startsWith('saxophone-front-');});
 assert.equal(await observer.page.evaluate(()=>window.__rehearsalPreview.getState().saxophonePlaying),false);
 assert.equal(await laura.page.evaluate(()=>{const b=window.__socialPreview.bridge;return b.views.get(b.active).get('laura').body.depth;}),191);
 await laura.page.screenshot({path:'output/playwright/laura-saxophone-podium.png'});
 const sax=await laura.page.evaluate(()=>{const b=window.__socialPreview.bridge;return b.views.get(b.active).get('laura').pose;});
 await laura.page.waitForFunction(sax=>{const b=window.__socialPreview.bridge;return b.views.get(b.active).get('laura').pose!==sax;},sax);
 await laura.page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 const stopped=await laura.page.evaluate(()=>window.__rehearsalPreview.getState().saxophoneNotesPlayed);
 await laura.page.waitForTimeout(400);assert.equal(await laura.page.evaluate(()=>window.__rehearsalPreview.getState().saxophoneNotesPlayed),stopped);
 await laura.page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await laura.page.waitForFunction(stopped=>window.__rehearsalPreview.getState().saxophoneNotesPlayed>stopped,stopped);
 await laura.page.keyboard.press('Escape');await laura.page.waitForFunction(()=>window.__rehearsalPreview.getState().mode==='walk'&&!window.__rehearsalPreview.getState().saxophonePlaying);
 await laura.page.waitForFunction(()=>{const b=window.__socialPreview.bridge;return !b.views.get(b.active).get('laura').pose.startsWith('saxophone');});
 await observer.page.waitForFunction(()=>{const b=window.__socialPreview.bridge;return !b.views.get(b.active).get('laura').pose.startsWith('saxophone');});
 await laura.page.keyboard.press('e');await laura.page.waitForFunction(()=>window.__rehearsalPreview.getState().saxophonePlaying);
 await laura.page.evaluate(()=>window.dispatchEvent(new CustomEvent('hutong:navigate',{detail:'culture'})));
 await laura.page.waitForFunction(()=>!window.__rehearsalPreview.getState().active&&!window.__rehearsalPreview.getState().saxophonePlaying);
 console.log('Laura: podium automatically animates and sounds, remote rendering, feet layer, blur/resume, exit and scene change passed.');
 assert.deepEqual(errors,[]);
}finally{await browser.close();await vite.close();app.close();}
