import test from 'node:test';
import assert from 'node:assert/strict';
import { stickVector, knobOffset, stickKeys, contextActions, isTouchDevice } from '../src/mobile/input.mjs';
test('joystick dead zone, clamping and scaling',()=>{
 assert.deepEqual(stickVector(5,0,60),{x:0,y:0,magnitude:0});
 const full=stickVector(200,0,60);assert.equal(Math.round(full.x*100),100);assert.equal(full.y,0);
 const half=stickVector(0,-30,60);assert.ok(half.y<0&&half.y>-1);
 assert.deepEqual(knobOffset(120,0,60),{x:60,y:0});assert.deepEqual(knobOffset(10,10,60),{x:10,y:10});
});
test('joystick maps to 8-direction keys',()=>{
 assert.deepEqual([...stickKeys(stickVector(60,0,60))],['KeyD']);
 assert.deepEqual([...stickKeys(stickVector(-60,0,60))],['KeyA']);
 assert.deepEqual([...stickKeys(stickVector(0,-60,60))],['KeyW']);
 assert.deepEqual([...stickKeys(stickVector(0,60,60))],['KeyS']);
 assert.deepEqual([...stickKeys(stickVector(40,40,60))].sort(),['KeyD','KeyS']);
 assert.equal(stickKeys(stickVector(3,3,60)).size,0);
});
test('context button labels from room guide text',()=>{
 assert.deepEqual(contextActions('E · 接一瓶水').primary,{code:'KeyE',label:'接一瓶水'});
 const bath=contextActions('E / Esc 起身 · F 开关隔间门');assert.equal(bath.primary.label,'起身');assert.deepEqual(bath.secondary,{code:'KeyF',label:'开关隔间门'});
 assert.equal(contextActions('靠近电梯按 E 开关门').primary.label,'开关门');
 assert.equal(contextActions('E · 坐到 A3 面向舞台').primary.label,'坐到 A3 面向');
 const gym=contextActions('F 切换速度，E / Esc 下机。');assert.equal(gym.primary.label,'下机');assert.equal(gym.secondary.label,'切换速度');
 assert.equal(contextActions('靠近设备、餐桌或椅子。').primary,null);
 assert.equal(contextActions('E 互动').primary.label,'互动');
});
test('touch device detection',()=>{
 assert.equal(isTouchDevice({coarse:true,maxTouchPoints:5,finePointer:false}),true);
 assert.equal(isTouchDevice({coarse:false,maxTouchPoints:0,finePointer:true}),false);
 assert.equal(isTouchDevice({coarse:false,maxTouchPoints:10,finePointer:true}),false);
});
