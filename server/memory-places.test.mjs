import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import rooms from '../shared/rooms.json' with {type:'json'};
import geometry from '../shared/interactions.json' with {type:'json'};
import {sceneWalkable} from '../shared/walkability.mjs';
import {SCENES} from '../shared/party-room.mjs';
import {createMvpServer,scenes} from './app.mjs';

const places=['yousheng','google','meeting','street','campus'];
test('every registered room has a validated exit and accessible chair approach',()=>{
 assert.deepEqual(Object.keys(rooms).sort(),Object.keys(geometry).sort());
 assert.deepEqual([...SCENES].sort(),Object.keys(rooms).sort());
 assert.deepEqual([...scenes].sort(),Object.keys(rooms).sort());
 for(const [key,room] of Object.entries(rooms)){
  assert.equal(sceneWalkable(key,...room.exit),true,`${key} exit`);
  for(const [id,seat] of Object.entries(geometry[key].seats))assert.equal(sceneWalkable(key,...seat.approach),true,`${key} ${id} approach`);
 }
});

test('authoritative presence accepts new room seats and rejects unknown rooms',async t=>{
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 t.after(()=>{app.close();app.server.closeAllConnections();});
 const account=await app.store.register('place_seat_user','places-password','laura');
 const api=async(path,input)=>{
  const response=await fetch(`http://127.0.0.1:${app.server.address().port}/api/${path}`,{method:'POST',headers:{Cookie:'hutong_session='+account.token,'Content-Type':'application/json'},body:JSON.stringify(input)});
  return {status:response.status,data:await response.json()};
 };
 await api('control',{client:'place-tab'});
 const player=app.players.get(account.user.id);
 for(const key of places){
  Object.assign(player,{scene:key,x:580,y:330,seat:null,activity:'walk',fresh:false,at:Date.now()});
  const pose={client:'place-tab',scene:key,x:580,y:330,facing:2,seat:null,activity:'walk',hand:null};
  assert.equal((await api('presence',pose)).status,200,key);
  for(const [id,seat] of Object.entries(geometry[key].seats)){
   Object.assign(player,{x:seat.approach[0],y:seat.approach[1],seat:null,at:Date.now()});
   const seated=await api('presence',{...pose,x:seat.at[0],y:seat.at[1],seat:id,activity:'sit'});
   assert.equal(seated.status,200,JSON.stringify(seated.data));
   const standing=await api('presence',{...pose,x:seat.approach[0],y:seat.approach[1]});
   assert.equal(standing.status,200,JSON.stringify(standing.data));
  }
 }
 assert.equal((await api('presence',{client:'place-tab',scene:'unknown',x:580,y:330,facing:2,seat:null,hand:null})).status,400);
});

test('new floors respect boundaries, sculpture and seated chair footprints',()=>{
 for(const key of places){
  assert.deepEqual(rooms[key].exit,[580,330]);
  assert.equal(sceneWalkable(key,320,330),true);
  const outdoor=['street','campus'].includes(key);
  for(const point of outdoor?[[14,330],[626,330],[320,190],[320,353]]:[[34,330],[606,330],[320,key==='google'?174:189],[320,346]])assert.equal(sceneWalkable(key,...point),false,`${key} ${point}`);
 }
 assert.equal(sceneWalkable('yousheng',80,225),false);
 assert.equal(sceneWalkable('yousheng',150,260),true);
 assert.equal(sceneWalkable('yousheng',404,272),false,'sculpture in front of PAGEONE');
 assert.equal(sceneWalkable('yousheng',80,270),true,'former sculpture spot is clear pavement');
 assert.equal(sceneWalkable('meeting',320,240),false);
 assert.equal(sceneWalkable('meeting',80,240),true);
 assert.equal(sceneWalkable('google',320,175),true);
 for(const key of ['street','campus'])assert.equal(sceneWalkable(key,150,260),true);
 for(const key of ['google','meeting']){
  assert.equal(Object.keys(geometry[key].seats).length,4);
  for(const seat of Object.values(geometry[key].seats))assert.equal(sceneWalkable(key,...seat.at),false);
 }
});

test('chair approaches connect to every room exit across the shared floor',()=>{
 for(const key of places){
  const start=rooms[key].exit,visited=new Set([start.join(',')]),queue=[start];
  for(let i=0;i<queue.length;i++){
   const [x,y]=queue[i];
   for(const [dx,dy] of [[5,0],[-5,0],[0,5],[0,-5]]){
    const point=[x+dx,y+dy],id=point.join(',');
    if(!visited.has(id)&&sceneWalkable(key,...point)){visited.add(id);queue.push(point);}
   }
  }
  for(const [id,seat] of Object.entries(geometry[key].seats))assert.ok(queue.some(([x,y])=>Math.hypot(x-seat.approach[0],y-seat.approach[1])<4),`${key} ${id} connects to exit`);
 }
});

test('bridge reads the generic preview and applies seated viewer poses',()=>{
 const source=readFileSync(new URL('../src/multiplayer/bridge.ts',import.meta.url),'utf8');
 const state=source.slice(source.indexOf('  state():Player|null{'),source.indexOf('  apply(p:Player)'));
 const apply=source.slice(source.indexOf('  apply(p:Player)'),source.indexOf('  stand()'));
 const code=ts.transpileModule(`class Bridge {${state}${apply}} return Bridge;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const scene={sys:{settings:{key:'google'}},x:320,y:330,facing:0,seated:null,mode:'walk'};
 const window={__memoryPlacePreviews:{google:{getState:()=>({ready:true,x:scene.x,y:scene.y,facing:scene.facing,seated:scene.seated,mode:scene.mode})}}};
 const Bridge=new Function('window','previewKeys','playerInventory','performance','canWorkAt',code)(window,{google:'__memoryPlacePreviews'},{hand:null},{now:()=>1000},()=>false);
 const bridge=new Bridge();Object.assign(bridge,{active:scene,previous:new Map(),movedAt:new Map(),user:{role:'laura',revision:1}});
 assert.equal(bridge.state().scene,'google');
 bridge.apply({scene:'google',x:185,y:240,facing:2,seat:'G1'});
 assert.equal(bridge.state().seat,'G1');assert.equal(bridge.state().activity,'sit');
 bridge.apply({scene:'google',x:185,y:275,facing:0,seat:null});
 assert.equal(bridge.state().seat,null);assert.equal(bridge.state().activity,'walk');
});
