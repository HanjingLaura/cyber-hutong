import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
import {safeOutdoorPoint,outdoorWalkable,skateboardWalkable,scooterDismountPoint} from '../shared/outdoor-collision.mjs';
function client(api){const world={client:'tab',epoch:0,bridge:{user:{id:'rider',role:'sid'},connected:true,controller:true}};const source=readFileSync('src/memory-places.ts','utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.url',JSON.stringify('file:///C:/game/src/memory-places.ts'));const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace('export class MemoryPlaceScene','class MemoryPlaceScene');const C=new Function('Phaser','api','onlineWorld','safeOutdoorPoint','scooterDismountPoint',js+';return MemoryPlaceScene;')({Scene:class{sys={isActive:()=>true};}},api,()=>world,safeOutdoorPoint,scooterDismountPoint);return new C('street');}
const ride={x:510,y:220,facing:3,seats:{driver:{role:'sid',x:510,y:220},front:null,rear:null}};
test('resuming an existing driver initializes physics from server anchor, not default parking spot',async()=>{const c=client(async()=>({ride}));await c.poll();assert.equal(c.riding,true);assert.deepEqual(c.pose,{x:510,y:220,speed:0,heading:Math.PI});assert.equal(c.x,510);});
test('late snapshot cannot put a rider back after leaving or sleeping',async()=>{let finish;const c=client(()=>new Promise(r=>finish=r));const pending=c.poll();c.rideEpoch++;c.riding=false;finish({ride});await pending;assert.equal(c.riding,false);assert.equal(c.slot,null);});
test('slow drive acknowledgments do not lock dismount or restore an old riding state',async()=>{
 let finish;const empty={...ride,seats:{driver:null,front:null,rear:null}};
 const c=client((_path,input)=>input.action==='drive'?new Promise(r=>finish=r):Promise.resolve({ride:empty}));
 Object.assign(c,{riding:true,slot:'driver',ride,pose:{x:510,y:220,speed:0,heading:Math.PI}});
 const pending=c.drive();assert.equal(c.driving,true);assert.equal(c.busy,false);
 await c.leave();assert.equal(c.riding,false);assert.equal(c.slot,null);assert.equal(c.ride,empty);
 finish({ride});await pending;assert.equal(c.ride,empty);assert.equal(c.driving,false);
});
test('remounting a board near the pavement edge uses its valid parked anchor',async()=>{
 const c=client(async()=>({ride}));Object.assign(c,{place:'campus',x:20,y:310,parkedBoard:{x:40,y:310,heading:Math.PI},nearestSeat:()=>undefined});
 await c.interact();assert.equal(c.riding,true);assert.equal(c.x,40);assert.equal(c.y,310);assert.equal(c.pose.x,40);assert.equal(c.pose.y,310);
});
test('dismounting a board from an older edge position restores valid walking ground',async()=>{
 const c=client(async()=>({ride}));Object.assign(c,{place:'campus',x:320,y:347,riding:true,pose:{x:320,y:347,speed:0,heading:0}});
 assert.equal(outdoorWalkable('campus',c.x,c.y),false);
 await c.leave();assert(outdoorWalkable('campus',c.x,c.y));assert.deepEqual(c.parkedBoard,{x:320,y:347,heading:0});
});
