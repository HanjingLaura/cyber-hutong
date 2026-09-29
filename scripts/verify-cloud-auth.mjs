// Explicit opt-in integration test. Uses fresh test tables, NEVER claims real users.
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@tursodatabase/serverless/compat';
import { openAuthStore } from '../src/server/auth-store.mjs';
import { openStore } from '../src/server/store.mjs';
import { createApp } from '../src/server/app.mjs';
import { roster } from '../examples/mvp-behavior/config.mjs';
import { claimHashes } from '../src/server/claim-seed.mjs';

if (process.env.HUTONG_CLOUD_TEST !== '1') throw new Error('Set HUTONG_CLOUD_TEST=1 to run the isolated cloud test');
const options = { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN };
const inspector = createClient(options);
const prefix = `hutong_verify_${randomBytes(8).toString('hex')}`;
const codes = Object.fromEntries(roster.map(p => [p.id, randomBytes(16).toString('hex')]));
const seeds = Object.fromEntries(roster.map(p => [p.id, createHash('sha256').update(codes[p.id]).digest('hex')]));
const password = randomBytes(24).toString('base64url');
const directory = mkdtempSync(join(tmpdir(), 'hutong-cloud-test-'));
const handles = [];
const auths = [];

async function start() {
  const auth = await openAuthStore({ ...options, prefix, seeds });
  auths.push(auth);
  const store = openStore(':memory:');
  store.ensureRoster(join(directory, `codes-${handles.length}.txt`));
  const server = createApp({ store, authStore: auth, complete: async () => 'test', llm: { configured: false }, clientDir: 'src/client' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const root = `http://127.0.0.1:${server.address().port}`;
  handles.push({ server, store });
  return { auth, root };
}
async function post(root, path, body) {
  return fetch(root + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
try {
  const realRows = (await inspector.execute('SELECT id, claim_hash, claimed_at FROM hutong_auth_members ORDER BY id')).rows;
  assert.equal(realRows.length, 8);
  for (const row of realRows) assert.equal(row.claim_hash, claimHashes[row.id]);
  const first = await start(), second = await start();
  for (const person of roster) {
    const registration = await post(first.root, '/api/auth/register', { name: person.name, claimCode: codes[person.id], password });
    assert.equal(registration.status, 201);
    assert.equal((await registration.json()).member.id, person.id);
    const cookie = registration.headers.get('set-cookie').split(';')[0];
    const me = await fetch(second.root + '/api/me', { headers: { Cookie: cookie } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).member.id, person.id);
  }
  const login = await post(second.root, '/api/auth/login', { name: 'Suki', password });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(first.root + '/api/me', { headers: { Cookie: cookie } })).status, 200);
  const third = await start();
  assert.equal((await fetch(third.root + '/api/me', { headers: { Cookie: cookie } })).status, 200);
  assert.equal((await post(third.root, '/api/auth/register', { name: 'Suki', claimCode: codes.suki, password })).status, 409);
  assert.equal((await post(third.root, '/api/auth/login', { name: 'Suki', password: 'wrong-password' })).status, 401);

  // Fresh isolated member state for actual concurrent registration on two clients.
  await inspector.execute(`DELETE FROM ${prefix}_sessions`);
  await inspector.execute(`UPDATE ${prefix}_members SET password_hash = NULL, claimed_at = NULL WHERE id = 'suki'`);
  const results = await Promise.all([first, second].map(instance => post(instance.root, '/api/auth/register', { name: 'suki', claimCode: codes.suki, password })));
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  const after = (await inspector.execute('SELECT id, claim_hash, claimed_at FROM hutong_auth_members ORDER BY id')).rows;
  assert.deepEqual(after, realRows);
  console.log('PASS: eight member mappings, HTTP cookies across three instances, wrong password, duplicate and concurrent claims; real member claims unchanged.');
} finally {
  for (const { server, store } of handles) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    store.close();
  }
  for (const auth of auths) auth.close();
  // Only tables in the random prefix created by this run are removed.
  for (const suffix of ['sessions', 'resets', 'members']) await inspector.execute(`DROP TABLE IF EXISTS ${prefix}_${suffix}`);
  inspector.close();
  rmSync(directory, { recursive: true, force: true });
}
