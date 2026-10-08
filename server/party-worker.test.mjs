import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as roomProtocol from '../shared/party-room.mjs';
import * as ticketProtocol from '../shared/party-ticket.mjs';

// Exercise the actual worker class; only the transport is replaced.
const compiled = ts.transpileModule(readFileSync(new URL('../party/hutong.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const exports = {};
new Function('require', 'exports', compiled)(name => {
  if (name.endsWith('party-room.mjs')) return roomProtocol;
  if (name.endsWith('party-ticket.mjs')) return ticketProtocol;
  throw new Error(`Unexpected worker import ${name}`);
}, exports);
const HutongParty = exports.default;

function fixture() {
  const connections = new Map();
  const secret = 'isolated-worker-test';
  const worker = new HutongParty({
    id: 'worker-test', env: { PARTY_AUTH_SECRET: secret },
    getConnection: id => connections.get(id),
    getConnections: () => connections.values(),
  });
  function connect(id) {
    const conn = { id, state: null, messages: [], closed: false,
      setState(value) { this.state = value; },
      send(value) { this.messages.push(JSON.parse(value)); },
      close() { this.closed = true; },
    };
    connections.set(id, conn);
    worker.onConnect(conn);
    return conn;
  }
  async function hello(conn, controller) {
    const { ticket } = await ticketProtocol.issueTicket(secret, { userId: 'user', role: 'laura', client: conn.id, controller });
    await worker.onMessage(JSON.stringify({ type: 'hello', ticket }), conn);
  }
  function close(conn) { connections.delete(conn.id); worker.onClose(conn); }
  return { worker, connect, hello, close, cleanup() { for (const conn of [...connections.values()]) close(conn); } };
}

test('worker broadcasts only to authenticated connections and promotes a viewer', async () => {
  const f = fixture();
  try {
    const guest = f.connect('guest'), controller = f.connect('controller'), viewer = f.connect('viewer');
    await f.hello(controller, true);
    await f.hello(viewer, false);
    await f.worker.onMessage(JSON.stringify({ type: 'move', x: 450, y: 220, scene: 'hutong' }), controller);
    assert.deepEqual(guest.messages, []);
    assert.equal(viewer.messages.at(-1).player.x, 450);
    assert.equal(controller.messages.some(m => m.type === 'presence' && m.event === 'update'), false);
    f.close(controller);
    assert.ok(viewer.messages.some(m => m.type === 'control' && m.controller === true));
    assert.deepEqual(guest.messages, []);
  } finally { f.cleanup(); }
});

test('invalid ticket cannot enter the room or receive authenticated broadcasts', async () => {
  const f = fixture();
  try {
    const invalid = f.connect('invalid'), controller = f.connect('controller');
    await f.worker.onMessage(JSON.stringify({ type: 'hello', ticket: 'invalid.signature' }), invalid);
    assert.equal(invalid.closed, true);
    assert.equal(invalid.state, null);
    await f.hello(controller, true);
    await f.worker.onMessage(JSON.stringify({ type: 'move', x: 450, y: 220, scene: 'hutong' }), controller);
    assert.equal(invalid.messages.length, 1);
    assert.equal(invalid.messages[0].type, 'reject');
    assert.equal(f.worker.onRequest().status, 200);
  } finally { f.cleanup(); }
});
