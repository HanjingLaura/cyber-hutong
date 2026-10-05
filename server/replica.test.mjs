import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { createMvpServer } from './app.mjs';
import { prepareReplica } from './replica.mjs';

const quiet = { warn() {}, error() {} };
async function instance(dir, name, remoteFile, prefix = 'hutong_online') {
  const client = createClient({ url: 'file:' + remoteFile });
  const path = join(dir, name + '.sqlite');
  const replica = await prepareReplica(path, client, { prefix, flushEveryMs: 0, log: quiet });
  const app = createMvpServer({ dbPath: path, staticDir: dir });
  replica.attach(app.store.db);
  return { app, replica, client, async close() { await replica.close(); app.close(); client.close(); } };
}

test('Turso replica persists accounts, sessions and messages across serverless instances', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'hutong-replica-')), remote = join(dir, 'remote.db');
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const a = await instance(dir, 'a', remote);
  const reg = await a.app.store.register('laura_test', 'test-password-123', 'laura');
  assert.ok(await a.replica.flush() > 0);

  const b = await instance(dir, 'b', remote);
  assert.equal(b.app.store.byRole('laura').username, 'laura_test', 'cold start hydrates accounts');
  assert.equal(b.app.store.session(reg.token)?.role, 'laura', 'session created on A is valid on B');
  const login = await b.app.store.login('laura_test', 'test-password-123');
  const msg = b.app.store.message('laura', null, 'hutong', '你好', 'm1');
  assert.ok(msg.seq > Date.now(), 'autoincrement keys are offset per instance');
  b.app.store.logout(reg.token);
  await b.replica.flush();

  await a.replica.pull();
  assert.equal(a.app.store.history('laura', null, 'hutong').at(-1)?.body, '你好', 'A pulls messages written on B');
  assert.equal(a.app.store.session(reg.token), null, 'logout on B removes the session on A');
  assert.equal(a.app.store.session(login.token)?.role, 'laura');

  // UPSERTs (ON CONFLICT DO UPDATE) and repeated updates of the same row must not trip the change log.
  const position = { id: reg.user.id, scene: 'hutong', x: 100, y: 200, facing: 0, seat: null, activity: 'walk' };
  a.app.life.savePosition(position); a.app.life.savePosition({ ...position, x: 120 }); a.app.life.savePosition({ ...position, x: 140 });
  await a.replica.flush();
  // Local unflushed changes win over older remote versions during pull.
  a.app.store.db.prepare("UPDATE accounts SET hand='咖啡',revision=revision+1").run();
  await a.replica.pull();
  assert.equal(a.app.store.byRole('laura').hand, '咖啡');
  await a.replica.flush();
  await a.close(); await b.close();

  const c = await instance(dir, 'c', remote);
  assert.equal(c.app.store.db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n, 1);
  assert.equal(c.app.store.byRole('laura').hand, '咖啡');
  assert.equal(c.app.store.history('laura', null, 'hutong').length, 1);
  assert.equal(c.app.life.position(reg.user.id).x, 140, 'latest upserted position persisted');
  await c.close();
});

test('replica uses its own remote tables and leaves other tables alone', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'hutong-replica-')), remote = join(dir, 'remote.db');
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const other = createClient({ url: 'file:' + remote });
  await other.execute('CREATE TABLE sessions(token_hash TEXT PRIMARY KEY, member_id TEXT NOT NULL)');
  await other.execute("INSERT INTO sessions VALUES('existing','member')");
  const a = await instance(dir, 'a', remote, 'hto_test');
  await a.app.store.register('sid_test', 'test-password-123', 'sid');
  await a.replica.flush(); await a.close();
  const names = (await other.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).rows.map(r => r.name);
  assert.deepEqual(names, ['hto_test_rows', 'hto_test_schema', 'sessions']);
  assert.equal((await other.execute('SELECT COUNT(*) AS n FROM sessions')).rows[0].n, 1);
  other.close();
});
