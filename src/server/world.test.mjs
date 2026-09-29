import assert from 'node:assert/strict';
import test from 'node:test';
import { pointInPolygon } from '../shared/geometry.mjs';
import { hutong } from '../shared/hutong.mjs';
import { createWorld } from './world.mjs';

test('new tab leases inherit actor sequence and a stop can recover from overtaking renew', () => {
  const world = createWorld();
  const first = world.join('suki', 'ordering-test-one', 1000);
  const intent = (seq, type, extra = {}) => world.intent('suki', { leaseId:first.leaseId, seq, intent:{type,...extra} }, 1010, true);
  intent(1, 'move', {dir:{x:1,y:0}});
  intent(3, 'renew');
  assert.equal(intent(2, 'stop').duplicate, true);
  intent(4, 'stop');
  assert.equal(world.view().find(a=>a.id==='suki').inputSeq, 4);
  assert.equal(world.view().find(a=>a.id==='suki').moving, false);
  const second = world.join('suki', 'ordering-test-two', 100000);
  assert.equal(second.seq, 4);
});

test('direct scene switching retains lease/manual validation and rejects unknown scenes', () => {
  const world = createWorld();
  const joined = world.join('suki', 'scene-switch-test', 1000);
  let seq = 0;
  const run = (scene, manual = true, leaseId = joined.leaseId) => world.intent('suki', {
    seq: ++seq, leaseId, intent: { type: 'switch-scene', scene },
  }, 1010, manual);
  assert.throws(() => run('popmart', false), { code: 'manual' });
  assert.throws(() => run('popmart', true, 'forged'));
  assert.throws(() => run('__proto__'), { status: 400 });
  assert.equal(run('popmart').scene, 'popmart');
  const actor = world.view().find(a => a.id === 'suki');
  assert.equal(actor.scene, 'popmart');
  assert.equal(actor.moving, false);
});

test('nearby visiting characters return speech rather than a non-existent member chat', () => {
  const world = createWorld({ loadPlaces: () => [{ memberId: 'amber', scene: 'hawaii', x: 640, y: 500, pose: 'stand' }] });
  const joined = world.join('amber', 'guest-talk-tab', 1000);
  const reply = world.intent('amber', { seq: 1, leaseId: joined.leaseId, intent: { type: 'interact' } }, 1010, true);
  assert.equal(reply.action, 'speech');
  assert.equal(reply.actorId, 'celine');
  assert.equal(reply.text, 'Amber，来聊聊。');
});

test('snapshots acknowledge stop input separately from an old idle state', () => {
  const world = createWorld();
  const joined = world.join('suki', 'stop-ack-tab', 1000);
  assert.equal(world.view().find(a => a.id === 'suki').inputSeq, 0);
  world.intent('suki', { seq: 1, leaseId: joined.leaseId, intent: { type: 'move', dir: { x: 1, y: 0 } } }, 1010, true);
  assert.equal(world.view().find(a => a.id === 'suki').inputSeq, 1);
  world.intent('suki', { seq: 2, leaseId: joined.leaseId, intent: { type: 'stop' } }, 1050, true);
  assert.equal(world.view().find(a => a.id === 'suki').inputSeq, 2);
});

test('continuous walking checkpoints at most once a second and stop saves the final position', () => {
  let writes = 0, saved;
  const world = createWorld({ savePlaces(rows) { writes++; saved = rows; } });
  const joined = world.join('suki', 'tab-checkpoint', 1000);
  writes = 0;
  for (let i = 0; i < 20; i++) {
    const now = 1000 + i * 50;
    world.intent('suki', { seq: i + 1, leaseId: joined.leaseId, intent: { type: 'move', dir: { x: -1, y: 0 } } }, now, true);
    world.tick(now);
  }
  assert.ok(writes <= 1, `wrote ${writes} times during one second`);
  world.intent('suki', { seq: 21, leaseId: joined.leaseId, intent: { type: 'stop' } }, 2000, true);
  assert.equal(world.tick(2000), true);
  assert.equal(saved.find(row => row.memberId === 'suki').x.toFixed(1), world.view().find(row => row.id === 'suki').x.toFixed(1));
  assert.equal(world.view().find(row => row.id === 'suki').moving, false);
});

test('seat anchors stay inside the measured aisle and keep the fixed owners', () => {
  const owners = ['jilly', 'cora', 'amber', 'franco', 'sid', 'suki', 'laura', 'kay'];
  assert.deepEqual(hutong.seats.map((seat) => seat.owner), owners);
  for (const seat of hutong.seats) {
    assert.equal(pointInPolygon(seat.stand.x, seat.stand.y, hutong.walkable), true, seat.id);
    assert.equal(pointInPolygon(seat.sit.x, seat.sit.y, hutong.walkable), false, seat.id);
  }
});

test('movement stays inside the aisle and ignores a forged position', () => {
  const world = createWorld({ loadPlaces: () => [], savePlaces() {} });
  const joined = world.join('suki', 'tab-suki-1', 1_000);
  assert.equal(joined.control, true);
  const start = joined.actors.find((actor) => actor.id === 'suki');
  world.intent('suki', {
    seq: 1,
    leaseId: joined.leaseId,
    intent: { type: 'move', x: 1, y: 1, dir: { x: -1, y: 0 } },
  }, 1_000, true);
  world.tick(1_000);
  world.tick(1_500);
  const after = world.view().find((actor) => actor.id === 'suki');
  assert.equal(pointInPolygon(after.x, after.y, hutong.walkable), true);
  assert.ok(after.x > 40);
  assert.notEqual(after.x, 1);
  assert.ok(after.x <= start.x);
});

test('clicked paths cannot cross a desk', () => {
  const world = createWorld({ loadPlaces: () => [], savePlaces() {} });
  const joined = world.join('franco', 'tab-franco-1', 2_000);
  world.intent('franco', {
    seq: 1,
    leaseId: joined.leaseId,
    intent: { type: 'path', target: { x: 20, y: 500 } },
  }, 2_000, true);
  let x = 0;
  for (let t = 2100; t < 8000; t += 50) {
    world.tick(t);
    x = world.view().find((actor) => actor.id === 'franco').x;
    assert.equal(pointInPolygon(x, world.view().find((actor) => actor.id === 'franco').y, hutong.walkable), true);
  }
  assert.ok(x > 80);
});

test('replayed intent does not move twice and a second tab cannot take the lease', () => {
  const world = createWorld({ loadPlaces: () => [], savePlaces() {} });
  const first = world.join('kay', 'tab-kay-a', 3_000);
  world.intent('kay', { seq: 1, leaseId: first.leaseId, intent: { type: 'move', dir: { x: 0, y: 1 } } }, 3_000, true);
  world.tick(3_000);
  world.tick(3_100);
  const once = world.view().find((actor) => actor.id === 'kay');
  const replay = world.intent('kay', {
    seq: 1,
    leaseId: first.leaseId,
    intent: { type: 'move', dir: { x: 0, y: 1 } },
  }, 3_200, true);
  assert.equal(replay.duplicate, true);
  world.tick(3_700);
  const twice = world.view().find((actor) => actor.id === 'kay');
  assert.equal(twice.x, once.x);
  assert.equal(twice.y, once.y);
  const other = world.join('kay', 'tab-kay-b', 4_000);
  assert.equal(other.control, false);
  assert.throws(() => world.intent('kay', {
    seq: 1,
    leaseId: 'forged-lease',
    intent: { type: 'move', dir: { x: 1, y: 0 } },
  }, 4_000, true), /另一个窗口/);
});

test('the same tab recovers the snapshot during the grace window and another tab waits it out', () => {
  const saved = [];
  const world = createWorld({
    loadPlaces: () => [],
    savePlaces(rows) { saved.splice(0, saved.length, ...rows); },
  });
  const joined = world.join('laura', 'tab-laura', 5_000);
  world.intent('laura', { seq: 4, leaseId: joined.leaseId, intent: { type: 'stop' } }, 5_100, true);
  world.release('laura', 'tab-laura', 6_000);
  const again = world.join('laura', 'tab-laura', 6_000 + 10_000);
  assert.equal(again.control, true);
  assert.equal(again.leaseId, joined.leaseId);
  const blocked = world.join('laura', 'tab-other', 6_000 + 10_000);
  assert.equal(blocked.control, false);
  const later = createWorld({ loadPlaces: () => saved, savePlaces() {} });
  const restored = later.view().find((actor) => actor.id === 'laura');
  const live = world.view().find((actor) => actor.id === 'laura');
  assert.equal(restored.x, live.x);
  assert.equal(restored.y, live.y);
  const takeover = world.join('laura', 'tab-other', 6_000 + 10_000 + 15_000 + 1);
  assert.equal(takeover.control, true);
});

test('interaction distance is enforced and sitting returns to the same seat', () => {
  const world = createWorld({ loadPlaces: () => [], savePlaces() {} });
  const joined = world.join('sid', 'tab-sid-01', 8_000);
  const far = world.intent('sid', { seq: 1, leaseId: joined.leaseId, intent: { type: 'interact' } }, 8_000, true);
  assert.equal(far.action, 'sit');
  const stood = world.intent('sid', { seq: 2, leaseId: joined.leaseId, intent: { type: 'interact' } }, 8_100, true);
  assert.equal(stood.action, 'stand');
  const sid = world.view().find((actor) => actor.id === 'sid');
  sid.x = 640;
  // Direct mutation is not an API. Walk Sid to the center with a path, then talking fails until close.
  world.intent('sid', { seq: 3, leaseId: joined.leaseId, intent: { type: 'path', target: { x: 640, y: 420 } } }, 8_200, true);
  for (let t = 8300; t < 14000; t += 50) world.tick(t);
  const middle = world.view().find((actor) => actor.id === 'sid');
  assert.ok(Math.hypot(middle.x - 640, middle.y - 420) < 40);
  const none = world.intent('sid', { seq: 4, leaseId: joined.leaseId, intent: { type: 'interact' } }, 14_000, true);
  assert.equal(none.action, 'none');
  assert.throws(() => world.intent('sid', {
    seq: 5,
    leaseId: joined.leaseId,
    intent: { type: 'move', dir: { x: 1, y: 0 } },
  }, 14_100, false), (error) => error.code === 'manual' && /托管中/.test(error.message));
});

test('renew keeps an idle lease, and expiry is not another window taking over', () => {
  const world = createWorld({ loadPlaces: () => [], savePlaces() {} });
  const joined = world.join('suki', 'tab-suki-01', 1_000);
  world.intent('suki', { seq: 1, leaseId: joined.leaseId, intent: { type: 'renew' } }, 12_000, true);
  const moved = world.intent('suki', {
    seq: 2, leaseId: joined.leaseId, intent: { type: 'move', dir: { x: 0, y: 1 } },
  }, 24_000, true);
  assert.equal(moved.ok, true);
  assert.throws(() => world.intent('suki', {
    seq: 3, leaseId: joined.leaseId, intent: { type: 'move', dir: { x: 0, y: 1 } },
  }, 24_000 + 15_001, true), (error) => error.code === 'expired');
  const again = world.join('suki', 'tab-suki-01', 24_000 + 16_000);
  assert.equal(again.control, true);
  assert.equal(again.leaseId, joined.leaseId);
});
