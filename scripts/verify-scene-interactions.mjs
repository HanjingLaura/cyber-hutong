// Desktop acceptance through real keyboard movement, exit E and map controls.
// Only the initial pose and the secondary observer use isolated fixtures.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createMvpServer} from '../server/app.mjs';
import {sceneWalkable} from '../shared/walkability.mjs';
import geometry from '../shared/interactions.json' with {type:'json'};
import rooms from '../shared/rooms.json' with {type:'json'};
import {loadPlaywright} from './playwright.mjs';

const directory='output/scene-interactions-'+Date.now();await mkdir(directory,{recursive:true});
process.env.HUTONG_INVITE='isolated-scene-acceptance';
const app=createMvpServer({dbPath:directory+'/game.sqlite',llmOptions:{key:''}});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const vite=await createServer({define:{'import.meta.env.VITE_PARTYKIT_HOST':'""'},server:{watch:null,hmr:false,host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${app.server.address().port}`,changeOrigin:false}}}});await vite.listen();
const origin=`http://127.0.0.1:${vite.httpServer.address().port}`;
const browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true,args:['--disable-webgl']}),context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
const report={passed:false,environment:'isolated desktop Chrome / file SQLite / model disabled / PartyKit covered separately',initialPoseFixture:true,observerFixture:true,quickTravel:false,scenes:[],errors:[],requests:[],checks:{}};
let current,observer,timer;
page.on('pageerror',e=>report.errors.push(e.message));
page.on('request',r=>{if(r.method()==='POST'&&/\/api\/(transition|object|device|ride)\//.test(r.url())){const p=r.postDataJSON();report.requests.push({endpoint:new URL(r.url()).pathname,action:p?.action,object:p?.object,target:p?.target,quick:p?.quick,requestId:p?.requestId});}});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,ms=10000){const end=Date.now()+ms;do{const value=await fn();if(value)return value;await wait(50);}while(Date.now()<end);throw Error('Timed out: '+label);}
const state=()=>page.evaluate(()=>window.__socialPreview?.bridge.state());
const ready=()=>until(()=>page.evaluate(()=>{const b=window.__socialPreview?.bridge;return b?.connected&&b.controller&&!b.pendingSpawn&&!b.transitioning&&b.state();}),'browser ready',30000);
const focus=()=>page.locator('.world').focus();
async function observerApi(path,input){const r=await fetch(`http://127.0.0.1:${app.server.address().port}/api/`+path,{method:input?'POST':'GET',headers:{cookie:observer.cookie,'Content-Type':'application/json'},body:input?JSON.stringify(input):undefined});assert.equal(r.status,200,'observer '+path);return r.json();}
// Grid routing uses the same static collision rules as both server and client.
// The actor still moves exclusively through actual keydown/keyup events.
function route(scene,from,to,blockers=[]){
 const size=8,valid=(x,y)=>[[0,0],[3,0],[-3,0],[0,3],[0,-3]].every(([dx,dy])=>sceneWalkable(scene,x+dx,y+dy))&&!blockers.some(b=>Math.abs(x-b.x)<b.width&&Math.abs(y-b.y)<b.height),cells=[];
 for(let y=0;y<=360;y+=size)for(let x=0;x<=640;x+=size)if(valid(x,y))cells.push([x,y]);
 const nearest=p=>cells.reduce((a,b)=>Math.hypot(b[0]-p[0],b[1]-p[1])<Math.hypot(a[0]-p[0],a[1]-p[1])?b:a);
 const start=nearest(from),end=nearest(to),key=p=>p.join(','),queue=[start],prev=new Map([[key(start),null]]);
 for(let i=0;i<queue.length&&!prev.has(key(end));i++)for(const [dx,dy]of [[size,0],[-size,0],[0,size],[0,-size]]){const p=[queue[i][0]+dx,queue[i][1]+dy],k=key(p);if(!prev.has(k)&&valid(...p)&&valid(p[0]-dx/2,p[1]-dy/2)){prev.set(k,queue[i]);queue.push(p);}}
 assert.ok(prev.has(key(end)),'no route '+scene+' '+from+' -> '+to);
 const path=[];for(let p=end;p;p=prev.get(key(p)))path.push(p);path.reverse();
 const compressed=[path[0]];for(let i=1;i<path.length-1;i++)if((path[i][0]-path[i-1][0])!==(path[i+1][0]-path[i][0])||(path[i][1]-path[i-1][1])!==(path[i+1][1]-path[i][1]))compressed.push(path[i]);compressed.push(path.at(-1));return compressed;
}
async function axisWalk(axis,target,tolerance=1){
 const p=await state(),sign=Math.sign(target-p[axis]);if(Math.abs(target-p[axis])<=tolerance)return;
 const reverse=await page.evaluate(()=>!!window.__socialPreview.bridge.active?.reverse),positive=sign*(reverse?-1:1)>0;
 const key=axis==='x'?(positive?'ArrowRight':'ArrowLeft'):(positive?'ArrowDown':'ArrowUp');await focus();await page.keyboard.down(key);
 try{await page.waitForFunction(({axis,target,sign,tolerance})=>{const p=window.__socialPreview.bridge.state();return sign*(target-p[axis])<=tolerance;},{axis,target,sign,tolerance},{timeout:7000,polling:'raf'});}finally{await page.keyboard.up(key);}
}
async function walkTo(point){const p=await state();const blockers=await page.evaluate(()=>{const b=window.__socialPreview.bridge,s=b.state().scene;return [...(window.__officeGuestsPreview?.getState()??[]).filter(n=>n.active&&n.id&&n.mode!=='seated').map(n=>({...n,width:26,height:18})),...(window.__easterEggPreview?.getState()??[]).filter(n=>n.active&&n.visible).map(n=>({...n,width:45,height:18})),...b.players.filter(n=>n.role!==b.user.role&&n.scene===s).map(n=>({...n,width:25,height:16}))];});const path=route(p.scene,[p.x,p.y],point,blockers);for(const target of path){await axisWalk('x',target[0]);await axisWalk('y',target[1]);}let last=await state();for(let correction=0;correction<3&&Math.hypot(last.x-point[0],last.y-point[1])>=12;correction++){await axisWalk('x',path.at(-1)[0]);await axisWalk('y',path.at(-1)[1]);last=await state();}assert.ok(Math.hypot(last.x-point[0],last.y-point[1])<15,'walk arrival '+p.scene);current.walkedSegments+=path.length;await wait(220);}
async function travel(target){
 const p=await state();await walkTo(rooms[p.scene].exit);await focus();await page.keyboard.press('e');await page.locator('#location-map[open]').waitFor({timeout:5000});
 const button=page.locator(`[data-place="${target}"]`);await button.click();const start=Date.now();await button.click();await until(async()=>{const p=await ready();return p.scene===target&&!await page.locator('#location-map').evaluate(d=>d.open);},'map arrival '+target,30000);
 assert.equal(app.players.get(current.account).scene,target);assert.equal(report.requests.at(-1)?.quick,false,'normal exit travel');return Date.now()-start;
}
async function pressE(){await focus();await page.keyboard.press('e');}
async function seatedCycle(point){await walkTo(point);await pressE();await until(async()=>!!(await state()).seat,'sit');await wait(250);await pressE();await until(async()=>!(await state()).seat,'stand');}
async function interact(scene){
 const seats=geometry[scene].seats;
 if(scene==='bathroom'){await walkTo([534,248]);await pressE();await until(()=>page.evaluate(()=>window.__bathroomPreview.getState().washing!==null),'wash starts');await until(()=>page.evaluate(()=>window.__bathroomPreview.getState().washing===null),'wash ends');return 'wash';}
 if(scene==='pop'){await walkTo([320,300]);await axisWalk('y',291,1);await pressE();await page.locator('#blind-menu[open]').waitFor();await page.keyboard.press('Escape');await until(()=>page.locator('#blind-menu').evaluate(d=>!d.open),'close blind menu');return 'item menu + Esc';}
 if(scene==='gym'){await walkTo([415,155]);await pressE();await until(async()=>(await state()).activity==='run','treadmill');await page.keyboard.press('Escape');await until(async()=>(await state()).activity==='walk','leave treadmill');return 'device + Esc';}
 if(scene==='dance'){await walkTo([320,267]);await pressE();await until(async()=>['dance','practice'].includes((await state()).activity),'dance');await page.keyboard.press('Escape');await until(async()=>(await state()).activity==='walk','stop dancing');return 'dance + Esc';}
 if(scene==='arcade'){await walkTo(geometry.arcade.devices.mines);await pressE();await until(()=>page.evaluate(()=>window.__arcadeGamePreview?.getState().open),'minigame');await page.keyboard.press('Escape');await until(()=>page.evaluate(()=>!window.__arcadeGamePreview.getState().open),'close minigame');return 'minigame + Esc';}
 if(scene==='elevator'||scene==='subway'){await walkTo(scene==='elevator'?[471,259]:[526,245]);const id=scene==='elevator'?'elevator:door-1':'subway:doors';const before=app.store.db.prepare('SELECT version FROM room_objects WHERE id=?').get(id)?.version??0;await pressE();await until(()=>(app.store.db.prepare('SELECT version FROM room_objects WHERE id=?').get(id)?.version??0)>before,'shared door');await wait(400);await pressE();return 'shared door twice';}
 if(scene==='street'||scene==='campus'){await walkTo([320,310]);await pressE();await until(()=>page.evaluate(scene=>window.__memoryPlacePreviews[scene].getState().riding,scene),'board vehicle');await wait(300);await page.keyboard.press('Escape');await until(()=>page.evaluate(scene=>!window.__memoryPlacePreviews[scene].getState().riding,scene),'leave vehicle');return 'vehicle + Esc';}
 if(Object.keys(seats).length){const seat=scene==='hutong'?seats.L3:scene==='hawaii'?seats.HL2:Object.values(seats)[0];await seatedCycle(seat.approach);return 'sit / stand';}
 // 优盛大厦 currently has walking only; do not invent an interaction.
 await walkTo([480,320]);return 'walking only';
}
try{
 const response=await context.request.post(origin+'/api/register/',{data:{username:'scene_trial_sid',password:'isolated-scene-password',role:'sid',invite:process.env.HUTONG_INVITE}});assert.equal(response.status(),200);const {user}=await response.json();
 const account=await app.store.register('scene_trial_cora','isolated-observer-password','cora');observer={cookie:'hutong_session='+account.token,id:account.user.id};await observerApi('control',{client:'scene-observer'});
 timer=setInterval(()=>void observerApi('heartbeat',{client:'scene-observer'}).catch(()=>{}),15000);
 // One initial fixture; all subsequent primary scene changes use actual exits.
 await page.goto(origin+'/');await ready();const player=app.players.get(user.id);Object.assign(player,{x:596,y:194,fresh:true});
 await page.evaluate(()=>{const b=window.__socialPreview.bridge;b.apply({...b.state(),x:596,y:194});});assert.equal(await page.locator('#quick-travel').isChecked(),false);
 for(let round=1;round<=2;round++)for(const scene of Object.keys(rooms)){
  current={scene,round,account:user.id,walkedSegments:0};report.scenes.push(current);const p=await state();current.enterMs=p.scene===scene?0:await travel(scene);assert.ok(sceneWalkable(scene,...[(await state()).x,(await state()).y]),'walkable spawn '+scene);
  if(app.players.get(observer.id)?.scene!==scene)await observerApi('transition',{target:scene,quick:true,client:'scene-observer'});
  // Observer lives near the exit and does not obstruct the interaction path.
  await until(()=>page.evaluate(()=>{const b=window.__socialPreview.bridge,v=b.views.get(b.active)?.get('cora');return v?.ready&&b.players.some(p=>p.role==='cora'&&p.scene===b.state().scene);}), 'other player rendered');current.otherPlayerRendered=true;
  await observerApi('transition',{target:scene==='hutong'?'rest':'hutong',quick:true,client:'scene-observer'});
  await until(()=>page.evaluate(()=>{const b=window.__socialPreview.bridge;return !b.players.some(p=>p.role==='cora'&&p.scene===b.state().scene);}), 'observer leaves');
  current.interaction=await interact(scene);
  await page.locator('#chat-open').click();const before=await state();await page.locator('#chat-input').fill('');await page.locator('#chat-input').press('e');assert.equal(await page.locator('#chat-input').inputValue(),'e');await wait(100);const after=await state();assert.equal(after.seat,before.seat);assert.equal(after.scene,before.scene);await page.locator('#chat-panel [data-close]').click();current.typingFocus=true;
  await walkTo(rooms[scene].exit);current.finished=true;assert.deepEqual(report.errors,[]);await writeFile(directory+'/progress.json',JSON.stringify({scene,round,completed:report.scenes.filter(s=>s.finished).length},null,2));console.log(JSON.stringify({scene,round,interaction:current.interaction,enterMs:current.enterMs}));
 }
 // Restore network, then prove movement and E work without reload in <=10s.
 await context.setOffline(true);await wait(1200);const recovered=Date.now();await context.setOffline(false);await ready();await axisWalk('x',(await state()).x-18);await pressE();await page.locator('#location-map[open]').waitFor();report.checks.networkRecoveryMs=Date.now()-recovered;assert.ok(report.checks.networkRecoveryMs<=10000);await page.keyboard.press('Escape');
 report.checks.allTwentyTwice=Object.keys(rooms).every(scene=>report.scenes.filter(s=>s.scene===scene&&s.finished).length===2);assert.ok(report.checks.allTwentyTwice);assert.ok(report.requests.filter(r=>r.endpoint.includes('transition')).length>=39);assert.equal(app.llm.status().budget.calls,0);
 report.passed=true;await page.screenshot({path:directory+'/desktop.png'});
}catch(error){report.error=error.message;report.failedScene=current?.scene;report.diagnostics=await page.evaluate(()=>window.__interactionDiagnostics?.()).catch(()=>[]);report.lastState=await state().catch(()=>null);await page.screenshot({path:directory+'/failure.png'}).catch(()=>{});process.exitCode=1;}
finally{clearInterval(timer);await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({directory,passed:report.passed,completed:report.scenes.filter(s=>s.finished).length,error:report.error,lastState:report.lastState}));await browser.close();await vite.close();app.close();app.server.closeAllConnections();}
