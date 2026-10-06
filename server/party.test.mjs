import test from 'node:test';
import assert from 'node:assert/strict';
import { issueTicket, verifyTicket } from '../shared/party-ticket.mjs';
import {
  applyHello,
  applyLeave,
  applyMove,
  createRoomState,
  roomSnapshot,
  PARTY_ROOM_ID,
} from '../shared/party-room.mjs';

const secret = 'test-party-secret';

test('party tickets round-trip and expire', async () => {
  const { ticket, expires } = await issueTicket(secret, {
    userId: 'u1',
    role: 'laura',
    username: 'laura',
    client: 'c1',
    controller: true,
  }, 1000);
  assert.ok(expires > Date.now());
  const claims = await verifyTicket(secret, ticket);
  assert.equal(claims.userId, 'u1');
  assert.equal(claims.role, 'laura');
  assert.equal(claims.controller, true);
  assert.equal(await verifyTicket('wrong', ticket), null);
  assert.equal(await verifyTicket(secret, 'not-a-ticket'), null);

  const stale = await issueTicket(secret, {
    userId: 'u1', role: 'laura', username: 'laura', client: 'c1', controller: true,
  }, -10);
  assert.equal(await verifyTicket(secret, stale.ticket), null);
});

test('party room hello/move/leave keeps single controller and broadcasts poses', () => {
  const state = createRoomState();
  const a = applyHello(state, 'conn-a', {
    userId: 'u-laura', role: 'laura', username: 'laura', client: 'a', controller: true,
  }, { scene: 'hutong', x: 200, y: 200, facing: 1 });
  assert.equal(a.you.controller, true);
  assert.equal(roomSnapshot(state).players.length, 1);

  const viewer = applyHello(state, 'conn-b', {
    userId: 'u-laura', role: 'laura', username: 'laura', client: 'b', controller: false,
  }, { scene: 'hutong', x: 210, y: 200, facing: 1 });
  assert.equal(viewer.you.controller, false);
  assert.equal(applyMove(state, 'conn-b', { x: 300, y: 200, scene: 'hutong', facing: 0 }).ok, false);

  const moved = applyMove(state, 'conn-a', { x: 250, y: 210, scene: 'hutong', facing: 2, moving: true });
  assert.equal(moved.ok, true);
  assert.equal(moved.player.x, 250);

  const takeover = applyHello(state, 'conn-c', {
    userId: 'u-laura', role: 'laura', username: 'laura', client: 'c', controller: true,
  }, { scene: 'rest', x: 400, y: 220, facing: 0 });
  assert.equal(takeover.you.controller, true);
  assert.equal(takeover.demoted, 'conn-a');
  assert.equal(applyMove(state, 'conn-a', { x: 260, y: 210, scene: 'hutong', facing: 2 }).ok, false);
  assert.equal(applyMove(state, 'conn-c', { x: 410, y: 220, scene: 'rest', facing: 1 }).ok, true);

  const other = applyHello(state, 'conn-sid', {
    userId: 'u-sid', role: 'sid', username: 'sid', client: 's', controller: true,
  }, { scene: 'rest', x: 420, y: 230, facing: 3 });
  assert.equal(other.you.role, 'sid');
  assert.equal(roomSnapshot(state).room, PARTY_ROOM_ID);
  assert.equal(roomSnapshot(state).players.length, 2);

  const left = applyLeave(state, 'conn-sid');
  assert.equal(left.left.role, 'sid');
  assert.equal(roomSnapshot(state).players.length, 1);
});

test('party-ticket API requires session, role and shared secret', async t => {
  const previous = process.env.PARTY_AUTH_SECRET;
  process.env.PARTY_AUTH_SECRET = secret;
  t.after(() => {
    if (previous === undefined) delete process.env.PARTY_AUTH_SECRET;
    else process.env.PARTY_AUTH_SECRET = previous;
  });

  const { createMvpServer } = await import('./app.mjs');
  const { once } = await import('node:events');
  const app = createMvpServer({ dbPath: ':memory:' });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => { app.close(); app.server.closeAllConnections(); });
  const root = 'http://127.0.0.1:' + app.server.address().port;
  const api = async (path, input, cookie) => {
    const res = await fetch(root + '/api/' + path, {
      method: input === undefined ? 'GET' : 'POST',
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(input === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
    return { status: res.status, cookie: res.headers.get('set-cookie')?.split(';')[0], data: await res.json() };
  };

  assert.equal((await api('party-ticket', { client: 'x' })).status, 401);
  const reg = await api('register', { username: 'laura', password: 'party-ticket-password', role: 'laura' });
  assert.equal(reg.status, 200);
  const denied = await api('party-ticket', { client: 'c1' }, reg.cookie);
  // Already has role from register
  assert.equal(denied.status, 200);
  assert.ok(denied.data.ticket);
  assert.equal(denied.data.room, PARTY_ROOM_ID);
  const claims = await verifyTicket(secret, denied.data.ticket);
  assert.equal(claims.role, 'laura');
  assert.equal(claims.client, 'c1');

  delete process.env.PARTY_AUTH_SECRET;
  assert.equal((await api('party-ticket', { client: 'c1' }, reg.cookie)).status, 503);
});
