import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

function fixture(place='google'){
 const exports={},pending=[],tickets=[],received=[],events=new EventEmitter();let active=true;
 const chain=new Proxy({}, {get:(_target,key)=>key==='getSourceImage'?()=>({width:100,height:100}):()=>chain});
 class Scene{constructor(){this.events=events;this.sys={isActive:()=>active};this.add={image:()=>chain,graphics:()=>chain};this.input={keyboard:{addKeys:()=>({}),resetKeys(){}}};this.textures={get:()=>chain};}}
 const world={client:'tab',epoch:0,bridge:{user:{id:'first',role:'sid'},active:null,connected:true,controller:true},receive:data=>received.push(data)};
 const require=name=>{
  if(name==='phaser')return{default:{Scene}};
  if(name.includes('world-client'))return{onlineWorld:()=>world};
  if(name.includes('multiplayer/api'))return{api:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))};
  if(name.includes('ticket-view'))return{showMemoryTicket:ticket=>tickets.push(ticket)};
  if(name.includes('place-chairs'))return{PlaceChairs:class{getState(){return{};}}};
  if(name.includes('scene-dom'))return{bindSceneEvent(){},sceneLabels(){}};
  if(name.includes('interactions.json'))return{default:{}};
  if(name.includes('outdoor-collision'))return{scooterDismountPoint:()=>[350,300]};
  return{};
 };
 const source=readFileSync(new URL('../src/memory-places.ts',import.meta.url),'utf8').replaceAll('import.meta.url',JSON.stringify(import.meta.url));
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,URL,window:{addEventListener(){}},document:{querySelector:()=>({})}});
 const scene=new exports.MemoryPlaceScene(place);world.bridge.active=scene;scene.create();scene.x=place==='google'?85:320;scene.y=place==='google'?230:285;
 return{scene,world,pending,tickets,received,sleep(){active=false;events.emit('sleep');},wake(){active=true;},finish:async(index=0,reject=false)=>{const result={ticket:{owner:'first'},ride:{x:320,y:285,facing:3,seats:{driver:{role:'sid',x:320,y:285}}}};pending[index][reject?'reject':'resolve'](reject?Error('old failure'):result);for(let i=0;i<8;i++)await Promise.resolve();}};
}
for(const transition of ['sleep','account'])test(`late ticket response cannot open a modal after ${transition}`,async()=>{
 const f=fixture();const request=f.scene.interact();if(transition==='sleep'){f.sleep();f.wake();}else f.world.bridge.user={id:'second',role:'laura'};
 await f.finish();await request;assert.equal(f.tickets.length,0);assert.equal(f.received.length,0);
});
for(const transition of ['sleep','account'])test(`late ride join cannot put a later ${transition} visit on the scooter`,async()=>{
 const f=fixture('street');const request=f.scene.interact();if(transition==='sleep'){f.sleep();f.wake();}else f.world.bridge.user={id:'second',role:'laura'};
 await f.finish();await request;assert.equal(f.scene.riding,false);assert.equal(f.scene.slot,null);
});
test('late ride leave cannot move the player on a later visit',async()=>{
 const f=fixture('street');f.scene.riding=true;f.scene.slot='driver';const request=f.scene.leave();f.sleep();f.wake();f.scene.x=500;f.scene.y=300;
 await f.finish();await request;assert.equal(f.scene.x,500);assert.equal(f.scene.y,300);
});
test('old ticket completion cannot unlock a newer pending interaction',async()=>{
 const f=fixture();const first=f.scene.interact();f.sleep();f.wake();const second=f.scene.interact();assert.equal(f.pending.length,2,'fresh visit can interact before the old request finishes');await f.finish();await first;
 await f.scene.interact();assert.equal(f.pending.length,2,'fresh pending interaction remains locked');await f.finish(1);await second;assert.equal(f.tickets.length,1);
});
test('late ride errors cannot replace the current visit message',async()=>{
 const f=fixture('street');const request=f.scene.interact();f.sleep();f.wake();f.scene.message='current visit';await f.finish(0,true);await request;assert.equal(f.scene.message,'current visit');
});

test('late scooter poll cannot install the previous account ride state',async()=>{
 const f=fixture('street');const request=f.scene.poll();f.world.bridge.user={id:'second',role:'laura'};await f.finish();await request;assert.equal(f.scene.ride,null);
});
test('late scooter poll errors cannot replace the returned visit message',async()=>{
 const f=fixture('street');const request=f.scene.poll();f.sleep();f.wake();f.scene.message='current visit';await f.finish(0,true);await request;assert.equal(f.scene.message,'current visit');
});
test('late scooter drive cannot install the previous account ride state',async()=>{
 const f=fixture('street');const request=f.scene.drive();f.world.bridge.user={id:'second',role:'laura'};await f.finish();await request;assert.equal(f.scene.ride,null);
});

for(const field of ['controller','connected'])for(const place of ['google','street'])test(`late ${place} acknowledgement cannot resume after ${field} is lost`,async()=>{
 const f=fixture(place);const request=f.scene.interact();f.world.bridge[field]=false;await f.finish();await request;assert.equal(f.tickets.length,0);assert.equal(f.scene.riding,false);assert.equal(f.received.length,0);
});
