import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { createMvpServer } from './app.mjs';
import { prepareReplica } from './replica.mjs';
import { DatabaseSync } from 'node:sqlite';

const quiet = { warn() {}, error() {} };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function instance(dir, name, client, prefix = 'hutong_online') {
  const path = join(dir, name + '.sqlite');
  const replica = await prepareReplica(path, client, { prefix, flushEveryMs: 0, log: quiet });
  const app = createMvpServer({ dbPath: path, staticDir: dir });
  replica.attach(app.store.db);
  return { app, replica, client, async close() { await replica.close(); app.close(); } };
}

test('Turso replica persists accounts, sessions and messages across serverless instances', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'hutong-replica-')), remote = createClient({url:'file::memory:'});
  t.after(() => { remote.close(); rmSync(dir, { recursive: true, force: true }); });
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
  const dir = mkdtempSync(join(tmpdir(), 'hutong-replica-')), remote = createClient({url:'file::memory:'});
  t.after(() => { remote.close(); rmSync(dir, { recursive: true, force: true }); });
  const other = remote;
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

async function smallReplica(t, intercept = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'hutong-replica-race-'));
  // A shared remote connection models Turso; only local replicas need disk files.
  // libSQL's native Windows file client keeps remote-file locks after close().
  const client = createClient({ url: 'file::memory:' });
  const wrapper = {
    execute: (...args) => intercept.execute ? intercept.execute(client, ...args) : client.execute(...args),
    batch: (...args) => intercept.batch ? intercept.batch(client, ...args) : client.batch(...args),
  };
  const replica = await prepareReplica(join(dir, 'local.db'), wrapper, { flushEveryMs: 0, log: quiet });
  const db = new DatabaseSync(join(dir, 'local.db'));
  db.exec('CREATE TABLE sample(id TEXT PRIMARY KEY, value TEXT NOT NULL)');
  replica.attach(db);
  await replica.flush();
  t.after(async () => { await replica.close(); db.close(); client.close(); rmSync(dir, { recursive: true, force: true }); });
  return { replica, db, client };
}

test('a row updated or deleted during an awaited flush remains pending until acknowledged', async t => {
  let gate = null;
  const f = await smallReplica(t, { async batch(client, statements, mode) {
    if (gate && statements.some(s => s.sql?.includes('_rows'))) {
      const current = gate; gate = null; current.started.resolve(); await current.release.promise;
    }
    return client.batch(statements, mode);
  } });
  f.db.prepare('INSERT INTO sample VALUES(?,?)').run('item', 'captured');
  for (const value of ['newer-write', null]) {
    const paused = { started: deferred(), release: deferred() }; gate = paused;
    const flush = f.replica.flush(); await paused.started.promise;
    if (value === null) f.db.prepare('DELETE FROM sample WHERE id=?').run('item');
    else f.db.prepare('UPDATE sample SET value=? WHERE id=?').run(value, 'item');
    paused.release.resolve(); await flush;
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM temp._hto_dirty WHERE tbl=?').get('sample').n, 1);
    assert.equal(await f.replica.flush(), 1);
    const row = (await f.client.execute("SELECT data,deleted FROM hutong_online_rows WHERE tbl='sample'")).rows[0];
    if (value === null) assert.equal(row.deleted, 1);
    else assert.equal(JSON.parse(row.data).value, value);
    // Make the next iteration dirty before it starts.
    if (value !== null) f.db.prepare("UPDATE sample SET value='to-delete'").run();
  }
});

test('concurrent replica reads share one remote operation and reuse its freshness window', async t => {
  let gate = null, reads = 0;
  const f = await smallReplica(t, { async execute(client, statement) {
    if (typeof statement === 'object' && statement.sql.includes('WHERE ver >')) {
      reads++;
      if (gate) { const current = gate; gate = null; current.started.resolve(); await current.release.promise; }
    }
    return client.execute(statement);
  } });
  gate = { started: deferred(), release: deferred() }; const paused = gate;
  const first = f.replica.pull(); await paused.started.promise;
  const burst = Array.from({ length: 64 }, () => f.replica.pull());
  paused.release.resolve(); await Promise.all([first, ...burst]);
  assert.equal(reads, 1, '64 concurrent players/readers must not enqueue 64 database reads');
  await Promise.all(Array.from({ length: 64 }, () => f.replica.pull({ maxAgeMs: 250 })));
  assert.equal(reads, 1);
});

test('a failed remote read releases the shared operation so a reconnect can recover', async t => {
  let fail = true;
  const f = await smallReplica(t, { execute(client, statement) {
    if (fail && typeof statement === 'object' && statement.sql.includes('WHERE ver >')) return Promise.reject(new Error('temporary network failure'));
    return client.execute(statement);
  } });
  const result = await Promise.allSettled(Array.from({ length: 8 }, () => f.replica.pull()));
  assert.ok(result.every(r => r.status === 'rejected'));
  fail = false; assert.equal(await f.replica.pull(), 0);
});

test('a pending local row does not delay unrelated remote updates',async t=>{
  const f=await smallReplica(t);
  f.db.prepare("INSERT INTO sample VALUES('item','local-pending')").run();
  await f.client.batch([
    {sql:'INSERT INTO hutong_online_rows VALUES(?,?,?,?,?)',args:['sample','["item"]',JSON.stringify({id:'item',value:'older-remote'}),0,1]},
    {sql:'INSERT INTO hutong_online_rows VALUES(?,?,?,?,?)',args:['sample','["other"]',JSON.stringify({id:'other',value:'new-message'}),0,2]},
  ],'write');
  assert.equal(await f.replica.pull(),1);
  assert.equal(f.db.prepare("SELECT value FROM sample WHERE id='item'").get().value,'local-pending');
  assert.equal(f.db.prepare("SELECT value FROM sample WHERE id='other'").get().value,'new-message');
  await f.replica.flush();
  const saved=(await f.client.execute("SELECT data,ver FROM hutong_online_rows WHERE pk='[\"item\"]'")).rows[0];
  assert.equal(JSON.parse(saved.data).value,'local-pending');assert.ok(saved.ver>2);
});

test('continuous writes cannot starve a queued remote read', async t => {
  const started=deferred(),release=deferred(),order=[];
  let armed=false,fixture,writes=0;
  fixture=await smallReplica(t, {
    async batch(client,statements,mode){
      if(armed&&statements.some(s=>s.sql?.includes('_rows'))){
        order.push('write');writes++;
        if(writes===1){started.resolve();await release.promise;}
        if(writes<5){
          fixture.db.prepare("UPDATE sample SET value=value||'+' WHERE id='item'").run();
          void fixture.replica.flush();
        }
      }
      return client.batch(statements,mode);
    },
    execute(client,statement){
      if(armed&&typeof statement==='object'&&statement.sql.includes('WHERE ver >'))order.push('read');
      return client.execute(statement);
    },
  });
  fixture.db.prepare("INSERT INTO sample VALUES('item','value')").run();armed=true;
  const writing=fixture.replica.flush();await started.promise;
  const reading=fixture.replica.pull();release.resolve();
  await Promise.all([writing,reading]);armed=false;
  assert.deepEqual(order,['write','read','write','write','write','write']);
  assert.equal(fixture.db.prepare('SELECT COUNT(*) AS n FROM temp._hto_dirty').get().n,0);
  const row=(await fixture.client.execute("SELECT data FROM hutong_online_rows WHERE tbl='sample'")).rows[0];
  assert.equal(JSON.parse(row.data).value,'value++++','the shared promise must save every follow-up write');
});

test('a flush arriving during completion starts a new flight and acknowledges its write',async t=>{
  const updated=deferred();let armed=false,fixture,followup;
  fixture=await smallReplica(t,{async batch(client,statements,mode){
    const result=await client.batch(statements,mode);
    if(armed&&statements.some(s=>s.sql?.includes('_rows'))){
      armed=false;let remaining=4;
      queueMicrotask(function step(){
        if(--remaining>0){queueMicrotask(step);return;}
        fixture.db.prepare("UPDATE sample SET value='newer' WHERE id='item'").run();
        followup=fixture.replica.flush();updated.resolve();
      });
    }
    return result;
  }});
  fixture.db.prepare("INSERT INTO sample VALUES('item','captured')").run();armed=true;
  const first=fixture.replica.flush();await first;await updated.promise;await followup;
  assert.equal(fixture.db.prepare('SELECT COUNT(*) AS n FROM temp._hto_dirty').get().n,0);
  const saved=(await fixture.client.execute("SELECT data FROM hutong_online_rows WHERE tbl='sample'")).rows[0];
  assert.equal(JSON.parse(saved.data).value,'newer');
});
