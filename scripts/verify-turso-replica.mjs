// Opt-in cloud check of the Turso replica, isolated in random hto_selftest_* tables that are dropped at the end.
// HUTONG_CLOUD_TEST=1 node --env-file=.env.production.local scripts/verify-turso-replica.mjs
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createClient } from '@libsql/client';
import { createMvpServer } from '../server/app.mjs';
import { prepareReplica } from '../server/replica.mjs';

if (process.env.HUTONG_CLOUD_TEST !== '1' || !process.env.TURSO_DATABASE_URL) { console.log('skip: set HUTONG_CLOUD_TEST=1 and TURSO_DATABASE_URL'); process.exit(0); }
const prefix = 'hto_selftest_' + randomBytes(4).toString('hex'), dir = mkdtempSync(join(tmpdir(), 'hto-cloud-'));
const client = () => createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const admin = client();
async function boot(name) {
  const c = client(), path = join(dir, name + '.sqlite'), started = Date.now();
  const replica = await prepareReplica(path, c, { prefix, flushEveryMs: 0 });
  const app = createMvpServer({ dbPath: path, staticDir: dir });
  replica.attach(app.store.db);
  return { app, replica, ms: Date.now() - started, async close() { await replica.close(); app.close(); c.close(); } };
}
try {
  const a = await boot('a');
  const reg = await a.app.store.register('cloud_test', 'cloud-password-123', 'kay');
  let t = Date.now(); await a.replica.flush(); const flushMs = Date.now() - t;
  const b = await boot('b');
  assert.equal(b.app.store.session(reg.token)?.role, 'kay');
  b.app.store.message('kay', null, 'hutong', 'cloud hello', 'c1'); await b.replica.flush();
  t = Date.now(); await a.replica.pull(); const pullMs = Date.now() - t;
  assert.equal(a.app.store.history('kay', null, 'hutong').at(-1)?.body, 'cloud hello');
  await a.close(); await b.close();
  console.log(JSON.stringify({ ok: true, prefix, hydrateMs: [a.ms, b.ms], flushMs, pullMs }));
} finally {
  await admin.batch([`DROP INDEX IF EXISTS ${prefix}_rows_ver`, `DROP TABLE IF EXISTS ${prefix}_rows`, `DROP TABLE IF EXISTS ${prefix}_schema`], 'write');
  admin.close(); rmSync(dir, { recursive: true, force: true });
}
