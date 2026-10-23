import test from 'node:test';
import assert from 'node:assert/strict';
import {stepSkate} from '../src/skateboard-physics.mjs';
import {skateboardWalkable} from '../shared/outdoor-collision.mjs';
const initial={x:320,y:310,speed:0,heading:Math.PI},open=()=>true;
function run(s,input,ms,floor=open){for(let t=0;t<ms;t+=10)s=stepSkate(s,input,Math.min(10,ms-t),floor);return s;}
test('board has direct cardinal controls and normalized diagonals capped105',()=>{
 for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1],[1,1]]){const p=run(initial,{x,y},300);assert((p.x-initial.x)*x+(p.y-initial.y)*y>20);assert(Math.abs(p.speed-105)<.0001);}
 const straight=run(initial,{x:1,y:0},400),diagonal=run(initial,{x:1,y:1},400);assert(Math.abs(Math.hypot(diagonal.x-320,diagonal.y-310)-(straight.x-320))<.02);
});
test('neutral never kicks and release stops within100ms',()=>{
 assert.equal(run(initial,{x:0,y:0},1000).speed,0);const moving=run(initial,{x:1,y:0},300),stopped=run(moving,{x:0,y:0},100);assert.equal(stopped.speed,0);assert(stopped.x-moving.x<7);
});
test('fixed horizontal board stops before a cone and can move away without rotating',()=>{
 let p={x:250,y:265,speed:0,heading:Math.PI/2};
 for(let i=0;i<60;i++){p=stepSkate(p,{x:-1,y:0},10,skateboardWalkable);assert(skateboardWalkable(p.x,p.y));}
 assert(p.x>=243&&p.x<245);assert.equal(p.speed,0);
 const moved=run(p,{x:1,y:0},300,skateboardWalkable);assert(moved.x>p.x+20);
});
test('horizontal footprint remains wide when moving vertically or reversing beside a wall',()=>{
 const p={x:37,y:310,speed:0,heading:Math.PI/2};assert(skateboardWalkable(p.x,p.y));assert.equal(skateboardWalkable(20,310),false);
 const up=run(p,{x:0,y:-1},200,skateboardWalkable);assert(up.y<p.y);assert.equal(up.x,p.x);
 const down=run(up,{x:0,y:1},300,skateboardWalkable);assert(down.y>up.y);assert(skateboardWalkable(down.x,down.y));
});
test('board slides on the free wall axis with valid accepted footprints',()=>{
 const floor=(x,y)=>x<=330&&y<=340&&skateboardWalkable(x,y);
 const p=run(initial,{x:1,y:1},200,floor);assert(p.x<=330);assert(p.y>315);assert(floor(p.x,p.y));
});
