import assert from 'node:assert/strict';
import test from 'node:test';
import { pointInPolygon } from '../shared/geometry.mjs';
import { scenes } from '../shared/scenes.mjs';
import { createWorldRuntime } from './world-runtime.mjs';
import { createDirector } from './director.mjs';
import { createWorld } from './world.mjs';
import { openStore } from './store.mjs';
import { roster } from '../../examples/mvp-behavior/config.mjs';

const morning = Date.UTC(2026, 8, 29, 2, 0, 0);

test('scene targets sit inside their measured floors', () => {
  assert.equal(pointInPolygon(scenes.rest_area.targets.coffee_machine.x, scenes.rest_area.targets.coffee_machine.y, scenes.rest_area.walkable), true);
  assert.equal(pointInPolygon(scenes.rest_area.spawn.x, scenes.rest_area.spawn.y, scenes.rest_area.walkable), true);
  assert.equal(pointInPolygon(scenes.elevator.targets.gather_point.x, scenes.elevator.targets.gather_point.y, scenes.elevator.walkable), true);
  assert.equal(pointInPolygon(scenes.hutong.spawn.x, scenes.hutong.spawn.y, scenes.hutong.walkable), true);
  for (const id of ['restroom', 'popmart', 'concert', 'hawaii', 'gym', 'mixian']) {
    const scene = scenes[id];
    assert.equal(pointInPolygon(scene.spawn.x, scene.spawn.y, scene.walkable), true);
    for (const point of Object.values(scene.targets)) {
      assert.equal(pointInPolygon(point.x, point.y, scene.walkable), true);
    }
  }
  assert.equal(worldHasCeline(), true);
});

function worldHasCeline() {
  const world = createWorld({ loadPlaces: () => [], savePlaces() {} });
  return world.view().some((actor) => actor.id === 'celine' && actor.scene === 'hawaii');
}

test('coffee advances only after the actor reaches the machine, and a manual player is not dragged', async () => {
  const store = openStore(':memory:');
  const world = createWorld({ loadPlaces: () => [], savePlaces() {} });
  const manual = new Set(['amber']);
  const repository = store.worldRepository();
  const runtime = await createWorldRuntime(repository);
  const director = createDirector({ world, runtime, repository, manualIds: () => manual });
  await director.step(morning);
  for (let time = morning; time < morning + 120_000; time += 100) world.tick(time);
  await director.step(morning + 120_000);
  const kay = world.view().find((actor) => actor.id === 'kay');
  assert.equal(kay.scene, 'rest_area');
  assert.ok(Math.hypot(kay.x - scenes.rest_area.targets.coffee_machine.x, kay.y - scenes.rest_area.targets.coffee_machine.y) < 36);
  assert.equal(runtime.snapshot().events[`kay-morning:2026-09-29`].stage, 'to_sid');
  const amber = world.view().find((actor) => actor.id === 'amber');
  assert.equal(amber.scene, 'hutong');
  const afternoon = Date.UTC(2026, 8, 29, 7, 0, 0);
  const later = createWorld({ loadPlaces: () => [], savePlaces() {} });
  const laterStore = openStore(':memory:');
  const laterRepo = laterStore.worldRepository();
  const laterRuntime = await createWorldRuntime(laterRepo);
  const laterDirector = createDirector({
    world: later, runtime: laterRuntime, repository: laterRepo, manualIds: () => new Set(['amber']),
  });
  const notes = await laterDirector.step(afternoon);
  later.tick(afternoon + 100);
  assert.equal(later.view().find((actor) => actor.id === 'amber').scene, 'hutong');
  assert.equal(notes.notices.some((notice) => notice.actor === 'amber' && notice.type === 'invite'), true);
  store.close();
  laterStore.close();
});

test('a player cannot travel except from the doorway', () => {
  const world = createWorld({ loadPlaces: () => [], savePlaces() {} });
  const joined = world.join('suki', 'tab-suki-01', 1_000);
  assert.throws(() => world.intent('suki', {
    seq: 1, leaseId: joined.leaseId, intent: { type: 'travel', scene: 'hawaii' },
  }, 1_000, true), /去不了/);
  assert.equal(world.view().find((actor) => actor.id === 'suki').scene, 'hutong');
});

test('an encounter npc appears once on entry and leaves with its owner', async () => {
  const store = openStore(':memory:');
  const world = createWorld({ loadPlaces: () => [], savePlaces() {} });
  const repository = store.worldRepository();
  const runtime = await createWorldRuntime(repository);
  const director = createDirector({
    world, runtime, repository, manualIds: () => new Set(['amber']), random: () => 0.99,
  });
  const joined = world.join('amber', 'tab-amber1', morning);
  let seq = joined.seq;
  const next = () => ++seq;
  const quiet = await director.visit();
  assert.equal(quiet.notices.some((notice) => notice.text === 'amber呢'), false);
  const atDoor = walk(world, 'amber', joined.leaseId, { x: 1180, y: 650 }, morning, next);
  world.intent('amber', {
    seq: next(), leaseId: joined.leaseId, intent: { type: 'travel', scene: 'restroom' },
  }, atDoor, true);
  await director.step(atDoor);
  assert.equal(world.view().filter((actor) => actor.id === 'fuguidiao').length, 1);
  await director.step(atDoor + 1);
  assert.equal(world.view().filter((actor) => actor.id === 'fuguidiao').length, 1);
  const away = await director.visit();
  assert.equal(away.notices.filter((notice) => notice.text === 'amber呢').length, 1);
  assert.equal(world.view().find((actor) => actor.id === 'celine').scene, 'hutong');
  const again = await director.visit();
  assert.equal(again.notices.length, 0);
  const back = walk(world, 'amber', joined.leaseId, { x: 640, y: 660 }, atDoor + 2, next);
  world.intent('amber', {
    seq: next(), leaseId: joined.leaseId, intent: { type: 'travel', scene: 'hutong' },
  }, back, true);
  await director.step(back);
  assert.equal(world.view().some((actor) => actor.id === 'fuguidiao'), false);
  store.close();
});

test('Kay entering the gym refreshes Tutu once and leaving despawns her', async () => {
  const store = openStore(':memory:');
  const world = createWorld({ loadPlaces: () => [], savePlaces() {} });
  const repository = store.worldRepository();
  const runtime = await createWorldRuntime(repository);
  const director = createDirector({
    world, runtime, repository, manualIds: () => new Set(['kay', 'sid']), random: () => 0.99,
  });
  const joined = world.join('kay', 'tab-kay-gym', morning);
  let seq = joined.seq;
  const next = () => ++seq;
  world.spawnGuest({ npc: 'tutu', scene: 'gym' });
  assert.equal(world.view().find((actor) => actor.id === 'tutu').name, '图图');
  world.removeGuest('tutu');
  const atDoor = walk(world, 'kay', joined.leaseId, { x: 1180, y: 650 }, morning, next);
  world.intent('kay', {
    seq: next(), leaseId: joined.leaseId, intent: { type: 'travel', scene: 'gym' },
  }, atDoor, true);
  await director.step(atDoor);
  assert.equal(world.view().filter((actor) => actor.id === 'tutu').length, 1);
  assert.equal(world.view().find((actor) => actor.id === 'tutu').scene, 'gym');
  const sid = world.join('sid', 'tab-sid-gym', atDoor + 1);
  world.intent('sid', {
    seq: sid.seq + 1, leaseId: sid.leaseId, intent: { type: 'switch-scene', scene: 'gym' },
  }, atDoor + 1, true);
  await director.step(atDoor + 1);
  assert.equal(world.view().filter((actor) => actor.id === 'tutu').length, 1);
  const back = walk(world, 'kay', joined.leaseId, { x: 640, y: 660 }, atDoor + 2, next);
  world.intent('kay', {
    seq: next(), leaseId: joined.leaseId, intent: { type: 'travel', scene: 'hutong' },
  }, back, true);
  await director.step(back);
  assert.equal(world.view().some((actor) => actor.id === 'tutu'), false);
  store.close();
});

function walk(world, id, leaseId, target, start, next) {
  world.intent(id, { seq: next(), leaseId, intent: { type: 'path', target } }, start, true);
  for (let time = start; time < start + 30_000; time += 50) {
    world.tick(time);
    const actor = world.view().find((item) => item.id === id);
    if (Math.hypot(actor.x - target.x, actor.y - target.y) < 24) return time;
  }
  const actor = world.view().find((item) => item.id === id);
  throw new Error(`${id} stopped at ${actor.x},${actor.y}`);
}

test('an auto preference trip starts only after the server reaches the target', async () => {
  const store = openStore(':memory:');
  const world = createWorld({ loadPlaces: () => [], savePlaces() {} });
  const repository = store.worldRepository();
  const runtime = await createWorldRuntime(repository);
  const manual = new Set(['sid']);
  const values = [0.99, 0.99, 0, 0.6, 0.99];
  let index = 0;
  const director = createDirector({
    world, runtime, repository, manualIds: () => manual, random: () => values[Math.min(index++, values.length - 1)],
  });
  await director.step(morning);
  const activityId = Object.keys(runtime.snapshot().events).find((id) => id.startsWith('activity:'));
  assert.equal(world.view().find((actor) => actor.id === 'suki').scene, 'hutong');
  assert.equal(runtime.snapshot().events[activityId].stage, 'out');
  manual.add('suki');
  await director.step(morning + 1000);
  for (let time = morning + 1000; time < morning + 40_000; time += 100) world.tick(time);
  assert.equal(world.view().find((actor) => actor.id === 'suki').scene, 'hutong');
  assert.equal(world.view().find((actor) => actor.id === 'sid').scene, 'hutong');
  store.close();
});

test('suki is in the noodle shop only after the server walks her there', async () => {
  const store = openStore(':memory:');
  const world = createWorld({ loadPlaces: () => [], savePlaces() {} });
  const repository = store.worldRepository();
  const runtime = await createWorldRuntime(repository);
  const manual = new Set(roster.filter((person) => person.id !== 'suki').map((person) => person.id));
  const values = [0.99, 0.99, 0, 0.6];
  let index = 0;
  const director = createDirector({
    world, runtime, repository, manualIds: () => manual, random: () => values[Math.min(index++, values.length - 1)],
  });
  await director.step(morning);
  const activityId = Object.keys(runtime.snapshot().events).find((id) => id.startsWith('activity:'));
  for (let time = morning; time < morning + 90_000; time += 50) world.tick(time);
  assert.equal(runtime.snapshot().events[activityId].stage, 'out');
  await director.step(morning + 90_000);
  const suki = world.view().find((actor) => actor.id === 'suki');
  assert.equal(suki.scene, 'mixian');
  assert.ok(Math.hypot(suki.x - scenes.mixian.targets.counter.x, suki.y - scenes.mixian.targets.counter.y) < 36);
  assert.equal(runtime.snapshot().events[activityId].stage, 'there');
  store.close();
});
