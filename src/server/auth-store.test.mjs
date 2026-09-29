import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openAuthStore } from './auth-store.mjs';
import { roster } from '../../examples/mvp-behavior/config.mjs';

const seeds = Object.fromEntries(roster.map(p => [p.id, createHash('sha256').update(`test-${p.id}`).digest('hex')]));
const password = 'test-only-password';

// Same asynchronous driver surface; network-independent SQL/transaction coverage.
function client(filename) {
  const db = new DatabaseSync(filename);
  const execute = async statement => {
    const sql = typeof statement === 'string' ? statement : statement.sql;
    const args = typeof statement === 'string' ? [] : statement.args;
    const prepared = db.prepare(sql);
    if (/^SELECT/i.test(sql.trim())) return { rows: prepared.all(...args), rowsAffected: 0 };
    return { rows: [], rowsAffected: Number(prepared.run(...(args ?? [])).changes) };
  };
  return {
    execute,
    close: () => db.close(),
    async transaction() {
      db.exec('BEGIN IMMEDIATE');
      let closed = false;
      return { execute, get closed() { return closed; },
        async commit() { db.exec('COMMIT'); closed = true; },
        async rollback() { db.exec('ROLLBACK'); closed = true; },
        close() { if (!closed) db.exec('ROLLBACK'); closed = true; } };
    },
    async batch(statements) {
      db.exec('BEGIN IMMEDIATE');
      try { for (const statement of statements) await execute(statement); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
}

test('persistent member-bound claims survive reopening, reject reuse and wrong names', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hutong-auth-'));
  const filename = join(directory, 'test.sqlite');
  let auth;
  try {
    auth = await openAuthStore({ client: client(filename), seeds });
    await assert.rejects(auth.register({ name: 'Nobody', claimCode: 'test-suki', password }), { status: 400 });
    await assert.rejects(auth.register({ name: 'Suki', claimCode: 'test-franco', password }), { status: 400 });
    const registration = await auth.register({ name: ' SUKI ', claimCode: 'test-suki', password });
    assert.equal(registration.member.id, 'suki');
    auth.close(); auth = undefined;
    auth = await openAuthStore({ client: client(filename), seeds });
    assert.equal((await auth.session(registration.token)).id, 'suki');
    await assert.rejects(auth.register({ name: 'suki', claimCode: 'test-suki', password }), { status: 409 });
    await assert.rejects(auth.login({ name: 'suki', password: 'wrong-password' }), { status: 401 });
    const login = await auth.login({ name: 'Suki', password });
    await auth.logout(login.token);
    assert.equal(await auth.session(login.token), null);
    const code = await auth.issueReset('suki', 1000);
    await assert.rejects(auth.resetPassword({ name: 'franco', code, password }, 2000), { status: 400 });
    await assert.rejects(auth.resetPassword({ name: 'suki', code, password }, 901001), { status: 400 });
    await auth.resetPassword({ name: 'suki', code, password: 'new-test-password' }, 2000);
    assert.equal(await auth.session(registration.token), null);
    await assert.rejects(auth.resetPassword({ name: 'suki', code, password }, 2001), { status: 400 });
    await assert.rejects(auth.login({ name: 'suki', password }), { status: 401 });
    assert.equal((await auth.login({ name: 'suki', password: 'new-test-password' })).member.id, 'suki');
  } finally { auth?.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('missing remote configuration fails closed rather than using temporary accounts', async () => {
  await assert.rejects(openAuthStore(), /requires TURSO/);
});
