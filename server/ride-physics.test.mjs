import test from 'node:test';
import assert from 'node:assert/strict';
import {stepRide} from '../src/ride-physics.mjs';
const initial={x:300,y:280,speed:0,heading:Math.PI},open=()=>true;
function run(s,input,ms,frame=10,floor=open){for(let t=0;t<ms;t+=frame)s=stepRide(s,input,Math.min(frame,ms-t),floor);return s;}
test('cardinal input moves directly in screen directions regardless of previous heading',()=>{
 for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1]]){const p=run(initial,{x,y},300);assert((p.x-initial.x)*x+(p.y-initial.y)*y>20);assert(Math.abs((p.x-initial.x)*y-(p.y-initial.y)*x)<.001);assert.equal(p.speed,130);}
 assert.equal(run(initial,{x:0,y:0},300).x,initial.x);
});
test('diagonals normalize and neutral stops within100ms without long coasting',()=>{
 const straight=run(initial,{x:1,y:0},400),diagonal=run(initial,{x:1,y:1},400);
 assert(Math.abs(Math.hypot(diagonal.x-300,diagonal.y-280)-(straight.x-300))<.02);assert(Math.abs(diagonal.speed-130)<.00001);
 const stopped=run(straight,{x:0,y:0},100);assert.equal(stopped.speed,0);assert(stopped.x-straight.x<8);
});
test('reversal responds promptly and frame partitions remain consistent',()=>{
 const moving=run(initial,{x:1,y:0},200),reversed=run(moving,{x:-1,y:0},160);assert(reversed.vx< -100);
 const a=run(initial,{x:1,y:1},500,10),b=run(initial,{x:1,y:1},500,30);assert(Math.hypot(a.x-b.x,a.y-b.y)<.05);
});
test('explicit speed reset also clears cached velocity after a rejected network move',()=>{
 const moving=run(initial,{x:1,y:0},200),reset=stepRide({...moving,speed:0},{x:0,y:0},16,open);
 assert.equal(reset.x,moving.x);assert.equal(reset.speed,0);assert.equal(reset.vx,0);assert.equal(reset.vy,0);
});
test('wall contact slides and bounded substeps never tunnel through a thin obstacle',()=>{
 const slide=run(initial,{x:1,y:1},300,10,(x,y)=>x<=305&&y<=340);assert(slide.x<=305);assert(slide.y>300);
 const barrier=x=>!(x>=310&&x<=312);
 const fast=stepRide({...initial,speed:130,heading:0,vx:130,vy:0},{x:1,y:0},5000,barrier);assert(fast.x<310);assert.equal(fast.y,280);
 const clipped=stepRide(initial,{x:1,y:0},5000,open);assert(clipped.x-initial.x<7);
});
