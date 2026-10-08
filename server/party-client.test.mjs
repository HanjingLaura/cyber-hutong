import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the shipped TypeScript class with its transport and clock replaced.
const source = readFileSync(new URL('../src/multiplayer/party-client.ts', import.meta.url), 'utf8')
  .replace('(import.meta as any).env?.VITE_PARTYKIT_HOST', "'party.test.invalid'");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const pose = { role: 'laura', name: 'Laura', scene: 'hutong', x: 300, y: 220, facing: 0, moving: false, seat: null, hand: null, revision: 0, activity: 'walk' };
const ticket = value => ({ ticket: value, room: 'hutong-main', expires: 160000 });

function fixture(request = async () => ticket('first')) {
  const sockets = [], requests = [], notices = [], timers = new Map();
  let now = 100000, timerId = 0, changes = 0;
  class FakeSocket {
    OPEN = 1;
    CLOSED = 3;
    readyState = 0;
    listeners = new Map();
    sent = [];
    constructor(options) { this.options = options; sockets.push(this); }
    addEventListener(type, listener) {
      const handlers = this.listeners.get(type) || [];
      handlers.push(listener); this.listeners.set(type, handlers);
    }
    async emit(type, event = {}) {
      if (type === 'open') this.readyState = this.OPEN;
      if (type === 'close') this.readyState = 3;
      await Promise.all((this.listeners.get(type) || []).map(listener => listener(event)));
    }
    send(value) { this.sent.push(JSON.parse(value)); }
    close() { this.readyState = 3; }
    message(value) { return this.emit('message', { data: JSON.stringify(value) }); }
  }
  class Clock extends Date { static now() { return now; } }
  const module = { exports: {} };
  runInNewContext(compiled, {
    module, exports: module.exports,
    require(name) { assert.equal(name, 'partysocket'); return FakeSocket; },
    Date: Clock,
    setTimeout(callback, ms) { const id = ++timerId; timers.set(id, { callback, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  const bridge = { controller: true, state: () => ({ ...pose }) };
  const client = new module.exports.PartyPresence(bridge, 'tab', (...args) => {
    requests.push(args); return request(...args);
  }, () => { changes++; }, message => notices.push(message));
  return { client, bridge, sockets, requests, notices, timers, advance(ms) { now += ms; }, get changes() { return changes; } };
}

async function acknowledge(socket, controller = true) {
  await socket.emit('open');
  await socket.message({ type: 'state', players: [pose], you: { controller } });
}

test('overlapping Party connects share one ticket request and one socket', async () => {
  const pending = deferred(), f = fixture(() => pending.promise);
  const a = f.client.connect(), b = f.client.connect();
  await Promise.resolve();
  assert.equal(f.requests.length, 1);
  pending.resolve(ticket('one'));
  await Promise.all([a, b]);
  assert.equal(f.sockets.length, 1);
  assert.equal(f.sockets[0].options.id, 'tab');
});

test('disconnect during a ticket request cannot create a late socket', async () => {
  const pending = deferred(), f = fixture(() => pending.promise);
  const connecting = f.client.connect();
  f.client.disconnect();
  pending.resolve(ticket('late'));
  await connecting;
  assert.equal(f.sockets.length, 0);
  assert.equal(f.client.connected, false);
});

test('a fresh connection wins when pre-disconnect tickets resolve in reverse order', async () => {
  const old = deferred(), fresh = deferred();
  let count = 0;
  const f = fixture(() => ++count === 1 ? old.promise : fresh.promise);
  const first = f.client.connect();
  f.client.disconnect(); f.client.reopen();
  const second = f.client.connect();
  fresh.resolve(ticket('fresh'));
  await second;
  old.resolve(ticket('stale'));
  await first;
  assert.equal(f.sockets.length, 1);
  await acknowledge(f.sockets[0]);
  assert.equal(f.sockets[0].sent[0].ticket, 'fresh');
  assert.equal(f.client.connected, true);
});

test('Party transport open does not publish until authenticated state arrives', async () => {
  const f = fixture();
  await f.client.connect();
  const socket = f.sockets[0];
  await socket.emit('open');
  assert.equal(f.client.connected, false);
  assert.equal(f.client.publish(pose, true), false);
  assert.equal(socket.sent.filter(message => message.type === 'move').length, 0);
  await socket.message({ type: 'state', players: [pose], you: { controller: true } });
  assert.equal(f.client.connected, true);
  assert.equal(f.client.publish(pose), true);
});

test('stale socket events cannot change the replacement socket state or players', async () => {
  const f = fixture();
  await f.client.connect();
  const old = f.sockets[0];
  await acknowledge(old);
  await f.client.connect(true);
  const current = f.sockets[1];
  await acknowledge(current);
  const changes = f.changes;
  await old.emit('close'); await old.emit('error');
  await old.message({ type: 'presence', event: 'leave', player: { role: 'laura' } });
  await old.message({ type: 'state', players: [], you: { controller: false } });
  assert.equal(f.client.connected, true);
  assert.equal(f.client.list().length, 1);
  assert.equal(f.changes, changes);
  assert.equal(f.client.publish(pose, true), true);
});

test('a ticket refresh completed on a replaced socket cannot send hello on the new socket', async () => {
  const pending = deferred();
  let count = 0;
  const f = fixture(() => ++count === 2 ? pending.promise : Promise.resolve(ticket('ticket-' + count)));
  await f.client.connect();
  const old = f.sockets[0];
  f.advance(50000);
  const opening = old.emit('open');
  await f.client.connect(true);
  const current = f.sockets[1];
  await acknowledge(current);
  pending.resolve(ticket('stale-refresh'));
  await opening;
  assert.equal(old.sent.length, 0);
  assert.equal(current.sent.filter(message => message.type === 'hello').length, 1);
  assert.equal(current.sent[0].ticket, 'ticket-3');
  assert.equal(f.client.connected, true);
});

test('healthy Party sockets survive heartbeat checks beyond ticket expiry', async () => {
  const f = fixture();
  await f.client.connect(); await acknowledge(f.sockets[0]);
  for (let n = 0; n < 4; n++) { f.advance(60000); await f.client.refreshIfNeeded(); }
  assert.equal(f.requests.length, 1);
  assert.equal(f.sockets.length, 1);
  assert.equal(f.client.connected, true);
});

test('Party controller acknowledgments and control events gate moves independently of SSE', async () => {
  const f = fixture();
  await f.client.connect(); await acknowledge(f.sockets[0], false);
  assert.equal(f.bridge.controller, true);
  assert.equal(f.client.publish(pose, true), false);
  await f.sockets[0].message({ type: 'control', controller: true });
  assert.equal(f.client.publish(pose), true);
  await f.sockets[0].message({ type: 'control', controller: false });
  assert.equal(f.client.publish({ ...pose, x: 310 }, true), false);
  await f.sockets[0].message({ type: 'control', controller: true });
  f.bridge.controller = false;
  assert.equal(f.client.publish({ ...pose, x: 310 }, true), false);
  f.bridge.controller = true;
  assert.equal(f.client.publish({ ...pose, x: 310 }), true);
  assert.equal(f.sockets[0].sent.filter(message => message.type === 'move').length, 2);
});
