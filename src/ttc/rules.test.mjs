import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRound, startRound, tickRound, shoot, visibleHit, TARGETS} from './rules.mjs';

test('timer starts on play, expires once and rejects late hits',()=>{
 const r=createRound(); tickRound(r,4000); assert.equal(r.remaining,60);
 startRound(r,5000); tickRound(r,65000); assert.equal(r.status,'lost');
 shoot(r,0,65000); assert.equal(r.status,'lost'); assert.equal(r.shots,0);
});
test('miss costs three seconds; visible hit wins and freezes time',()=>{
 const r=createRound();startRound(r,1000);shoot(r,null,2000);
 assert.equal(r.remaining,56);assert.equal(r.shots,1);
 shoot(r,0,3000);assert.equal(r.status,'playing');assert.deepEqual(r.found,[0]);
 for(let i=1;i<TARGETS.length;i++)shoot(r,i,3000);
 assert.equal(r.status,'won');assert.equal(r.shots,TARGETS.length+1);
 tickRound(r,99000);assert.equal(r.remaining,55);
 assert.equal(createRound().status,'ready');
});
test('covered body and transparent sprite pixels cannot be hit',()=>{
 const TARGET=TARGETS[0];
 const x=TARGET.x+TARGET.w/2,y=TARGET.y+10;
 assert.equal(visibleHit(x,y,()=>255),true);
 assert.equal(visibleHit(x,y,()=>0),false);
 assert.equal(visibleHit(x,TARGET.y+TARGET.visibleHeight+1,()=>255),false);
 assert.equal(visibleHit(TARGET.x-1,y,()=>255),false);
});
test('each target has its own visible region; duplicate hits do not advance progress',()=>{
 for(const t of TARGETS){
  assert.equal(visibleHit(t.x+t.w*.55,t.y+10,()=>255,t),true);
  assert.equal(visibleHit(t.x+1,t.y+10,()=>255,t),false);
  assert.equal(visibleHit(t.x+t.w*.55,t.y+t.visibleHeight+1,()=>255,t),false);
 }
 const r=createRound();startRound(r,0);shoot(r,0,100);shoot(r,0,200);shoot(r,99,300);
 assert.deepEqual(r.found,[0]);assert.equal(r.status,'playing');
 startRound(r,400);assert.deepEqual(r.found,[]);
});
