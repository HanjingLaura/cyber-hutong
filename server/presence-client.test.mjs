import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Run the production closure without starting Phaser, DOM UI, or real transports.
const source = readFileSync(new URL('../src/multiplayer/social.ts', import.meta.url), 'utf8');
const start = source.indexOf('  async function publishPresence(');
const end = source.indexOf('  function livePlayers()', start);
assert.ok(start >= 0 && end > start, 'production presence closure must be available');
const compiled = ts.transpileModule(source.slice(start, end) + '\nreturn publishPresence;', {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function settle() { for (let n = 0; n < 12; n++) await Promise.resolve(); }

function fixture({ partyConnected = true, pending = false } = {}) {
  const requests = [], partyMoves = [], notices = [];
  let now = 2000;
  const user = { id: 'account', role: 'laura' };
  let pose = { role: 'laura', scene: 'hutong', x: 300, y: 220, facing: 0, moving: true, seat: null, hand: null, revision: 0, activity: 'walk' };
  const party = { connected: partyConnected, publish(state, force) { partyMoves.push({ state, force }); } };
  const api = (path, input) => {
    const gate = deferred(); requests.push({ path, input, ...gate });
    return pending ? gate.promise : Promise.resolve({ self: user });
  };
  const bridge = { controller: true, state: () => ({ ...pose }), stand() {} };
  const publish = new Function('api', 'user', 'connected', 'party', 'bridge', 'performance', 'applySelf', 'notice', 'hardLogout', 'lastSent', 'client', compiled)(
    api, user, true, party, bridge, { now: () => now }, () => {}, message => notices.push(message), () => {}, '', 'tab',
  );
  return {
    publish, requests, partyMoves, notices, party, bridge,
    advance(ms) { now += ms; },
    move(x) { pose = { ...pose, x }; },
    accept(index) { requests[index].resolve({ self: user }); },
  };
}

test('concurrent forced presence confirmations each wait for their own latest pose acknowledgment', async () => {
  const f = fixture({ pending: true }), finished = [];
  const background = f.publish();
  const first = f.publish(true).then(() => finished.push('first'));
  const second = f.publish(true).then(() => finished.push('second'));
  f.move(320); f.accept(0); await settle();
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].input.x, 320);
  assert.deepEqual(finished, [], 'neither gameplay action can proceed while confirmation is pending');
  f.move(340); f.accept(1); await settle();
  assert.equal(f.requests.length, 3);
  assert.equal(f.requests[2].input.x, 340);
  assert.deepEqual(finished, ['first']);
  f.accept(2); await Promise.all([background, first, second]);
  assert.deepEqual(finished, ['first', 'second']);
});

test('healthy Party movement continues every 100ms while HTTP checkpoints stay at one per second', async () => {
  const f = fixture();
  for (let n = 0; n < 10; n++) {
    f.move(300 + n); await f.publish(); f.advance(100);
  }
  assert.equal(f.partyMoves.length, 10, 'each 10Hz movement tick reaches the live transport');
  assert.equal(f.requests.length, 1, 'ten movement ticks must share one HTTP checkpoint');
  f.move(310); await f.publish();
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].input.x, 310);
});

test('without healthy Party presence HTTP sends changed poses at 100ms intervals', async () => {
  const f = fixture({ partyConnected: false });
  for (let n = 0; n < 10; n++) {
    f.move(300 + n); await f.publish(); f.advance(100);
  }
  assert.equal(f.requests.length, 10);
  f.advance(-50); f.move(320); await f.publish();
  assert.equal(f.requests.length, 10, 'a pose 50ms after the last checkpoint is throttled');
  f.advance(50); await f.publish();
  assert.equal(f.requests.length, 11);
});

test('a forced interaction confirms a new pose immediately inside the HTTP checkpoint window', async () => {
  const f = fixture({ pending: true });
  const background = f.publish(); f.accept(0); await background;
  f.advance(50); f.move(325);
  await f.publish();
  assert.equal(f.requests.length, 1);
  let confirmed = false;
  const force = f.publish(true).then(() => { confirmed = true; });
  await settle();
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].input.x, 325);
  assert.equal(f.requests[1].input.client, 'tab');
  assert.equal(confirmed, false);
  f.accept(1); await force;
  assert.equal(confirmed, true);
});

test('failed forced confirmations reject the action and release pending state for recovery', async () => {
  const f = fixture({ pending: true });
  const force = f.publish(true);
  const rejected = assert.rejects(force, /checkpoint timed out/);
  f.requests[0].reject(new Error('checkpoint timed out'));
  await rejected;
  f.move(330);
  const retry = f.publish(true);
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].input.x, 330);
  f.accept(1); await retry;
});

test('navigation checkpoint confirms the source while regular presence stays paused during travel',async()=>{
 const f=fixture();f.bridge.transitioning=true;
 await f.publish(true);assert.equal(f.requests.length,0);
 const checkpoint={};await f.publish(true,checkpoint);
 assert.equal(f.requests.length,1);assert.equal(f.requests[0].input.checkpoint,true);
 f.bridge.pendingSpawn={};await f.publish(true,{});assert.equal(f.requests.length,1,'pending destination spawn is never published as a source');
});
