import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotionBuffer, predictStep, reconcileStep } from '../shared/motion.mjs';

test('short released predictions reconcile without a single-frame rewind', () => {
  let point = { x: 565.6, y: 400 };
  const target = { x: 560, y: 400 };
  for (let i = 0; i < 60; i++) {
    const next = reconcileStep(point, target, 1/60);
    assert.ok(point.x - next.x < 2);
    point = next;
  }
  assert.ok(Math.abs(point.x - target.x) < 0.001);
});

test('settling a confirmed stop does not return to the old delayed frame', () => {
  const buffer = createMotionBuffer(100);
  buffer.push([{id:'suki',scene:'hutong',pose:'stand',x:560,y:465}], 0);
  const stopped = {id:'suki',scene:'hutong',pose:'stand',x:565.6,y:465,inputSeq:2};
  buffer.push([stopped], 50);
  buffer.settle(stopped, 55);
  assert.equal(buffer.sample('suki', 60).x, 565.6);
});
import { hutongPoint, hutongFacing } from '../shared/hutong.mjs';

test('prediction is immediate, normalizes diagonals and respects the actor footprint', () => {
  const area = [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
  const start = {x:50,y:50};
  const moved = predictStep(start, {x:1,y:1}, 1/60, area);
  assert.ok(Math.abs(Math.hypot(moved.x - 50, moved.y - 50) - 112/60) < 0.0001);
  const blocked = predictStep({x:89,y:50}, {x:1,y:0}, 0.05, area);
  assert.equal(blocked.x, 89);
});
test('both camera projections round-trip input and preserve canonical positions', () => {
  const point = { x: 330, y: 390 };
  assert.deepEqual(hutongPoint(hutongPoint(point, true), true), point);
  assert.equal(hutongFacing(hutongFacing('up', true), true), 'up');
});

const actor = (x, extra = {}) => ({ id: 'sid', scene: 'hutong', pose: 'stand', x, y: 550, ...extra });
test('rendering follows a fixed timeline, not the frequency of repeated snapshots', () => {
  const buffer = createMotionBuffer(100);
  for (let t = 0; t <= 300; t += 50) buffer.push([actor(t / 10)], t);
  assert.equal(buffer.sample('sid', 275).x, 17.5);
  assert.equal(buffer.sample('sid', 300).x, 20);
  buffer.push([actor(30)], 310);
  assert.equal(buffer.sample('sid', 325).x, 22.5);
  assert.equal(buffer.sample('sid', 900).x, 30);
});
test('scene changes and sitting snap rather than sliding through walls', () => {
  const buffer = createMotionBuffer();
  buffer.push([actor(600)], 0);
  buffer.push([actor(650, { scene: 'hawaii' })], 50);
  assert.equal(buffer.sample('sid', 50).x, 650);
  buffer.push([actor(680, { scene: 'hawaii', pose: 'sit' })], 100);
  assert.equal(buffer.sample('sid', 100).x, 680);
  buffer.push([], 150);
  assert.equal(buffer.sample('sid', 150), null);
});
