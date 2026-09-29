import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@tursodatabase/serverless/compat';
import { roster } from '../../examples/mvp-behavior/config.mjs';
import { claimHashes } from './claim-seed.mjs';
import { hashPassword, verifyPassword } from './store.mjs';

const digest = value => createHash('sha256').update(String(value)).digest('hex');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const personFor = name => roster.find(p => p.id === String(name ?? '').trim().toLowerCase());
const validPassword = password => {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) fail(400, '密码需为 10 到 128 位');
};

// Authentication only. World simulation remains a separate, process-local service.
// Prefix/client overrides are for isolated tests, never supplied by HTTP callers.
export async function openAuthStore({ url, authToken, client, prefix = 'hutong_auth', seeds = claimHashes } = {}) {
  if (!client && (!url || !authToken)) throw new Error('Persistent authentication requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
  if (!/^[a-z][a-z0-9_]*$/.test(prefix)) throw new Error('Invalid auth table prefix');
  const db = client ?? createClient({ url, authToken });
  const members = `${prefix}_members`, sessions = `${prefix}_sessions`, resets = `${prefix}_resets`;
  const dummy = hashPassword(randomBytes(24).toString('hex'));
  const query = (connection, sql, ...args) => connection.execute({ sql, args });
  await db.batch([
    `CREATE TABLE IF NOT EXISTS ${members} (id TEXT PRIMARY KEY, name TEXT NOT NULL, sprite TEXT UNIQUE NOT NULL,
      claim_hash TEXT NOT NULL, password_hash TEXT, claimed_at INTEGER, version INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS ${sessions} (token_hash TEXT PRIMARY KEY, member_id TEXT NOT NULL,
      version INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS ${resets} (member_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, expires_at INTEGER NOT NULL)`,
    ...roster.map(p => {
      if (!/^[a-f0-9]{64}$/.test(seeds[p.id] ?? '')) throw new Error('Missing member claim hash');
      return { sql: `INSERT OR IGNORE INTO ${members} (id, name, sprite, claim_hash) VALUES (?, ?, ?, ?)`,
        args: [p.id, p.name, p.sprite, seeds[p.id]] };
    }),
  ], 'immediate');

  async function transaction(work) {
    const tx = await db.transaction('immediate');
    try {
      const result = await work(tx);
      await tx.commit();
      return result;
    } catch (error) {
      if (!tx.closed) await tx.rollback().catch(() => {});
      throw error;
    } finally { if (!tx.closed) tx.close(); }
  }
  async function insertSession(tx, person, version) {
    const token = randomBytes(32).toString('base64url');
    await query(tx, `INSERT INTO ${sessions} (token_hash, member_id, version, expires_at) VALUES (?, ?, ?, ?)`,
      digest(token), person.id, version, Date.now() + 7 * 86400000);
    return { token, member: { id: person.id, name: person.name } };
  }
  return {
    close() { db.close(); },
    async register({ name, claimCode, password }) {
      const person = personFor(name);
      if (!person) fail(400, '无法用这个英文名注册');
      validPassword(password);
      const passwordHash = hashPassword(password);
      return transaction(async tx => {
        const row = (await query(tx, `SELECT password_hash, claim_hash, version FROM ${members} WHERE id = ?`, person.id)).rows[0];
        if (row.password_hash) fail(409, '该名字已注册，请直接登录');
        if (row.claim_hash !== digest(String(claimCode ?? '').trim())) fail(400, '领取码与英文名不匹配');
        const changed = await query(tx, `UPDATE ${members} SET password_hash = ?, claimed_at = ? WHERE id = ? AND password_hash IS NULL`,
          passwordHash, Date.now(), person.id);
        if (changed.rowsAffected !== 1) fail(409, '该名字已注册，请直接登录');
        return insertSession(tx, person, Number(row.version));
      });
    },
    async login({ name, password }) {
      if (typeof password !== 'string' || password.length > 128) fail(401, '英文名或密码不正确');
      const person = personFor(name);
      const row = person && (await query(db, `SELECT password_hash, version FROM ${members} WHERE id = ?`, person.id)).rows[0];
      const matched = verifyPassword(password, row?.password_hash || dummy);
      if (!row?.password_hash || !matched) fail(401, '英文名或密码不正确');
      // Reset can race verification: a session with the old version is rejected.
      return insertSession(db, person, Number(row.version));
    },
    async session(token) {
      if (!token) return null;
      const row = (await query(db, `SELECT m.id, m.name FROM ${sessions} s JOIN ${members} m ON m.id = s.member_id
        WHERE s.token_hash = ? AND s.expires_at > ? AND s.version = m.version`, digest(token), Date.now())).rows[0];
      return row ? { id: row.id, name: row.name } : null;
    },
    async logout(token) {
      if (token) await query(db, `DELETE FROM ${sessions} WHERE token_hash = ?`, digest(token));
    },
    async issueReset(name, now = Date.now()) {
      const person = personFor(name);
      if (!person) fail(400, '该成员尚未注册');
      const code = randomBytes(24).toString('base64url');
      await transaction(async tx => {
        const row = (await query(tx, `SELECT password_hash FROM ${members} WHERE id = ?`, person.id)).rows[0];
        if (!row?.password_hash) fail(400, '该成员尚未注册');
        await query(tx, `INSERT INTO ${resets} (member_id, token_hash, expires_at) VALUES (?, ?, ?)
          ON CONFLICT(member_id) DO UPDATE SET token_hash = excluded.token_hash, expires_at = excluded.expires_at`,
          person.id, digest(code), now + 900000);
      });
      return code;
    },
    async resetPassword({ name, code, password }, now = Date.now()) {
      validPassword(password);
      const person = personFor(name);
      if (!person) fail(400, '重置码无效或已过期');
      const hash = hashPassword(password);
      return transaction(async tx => {
        const row = (await query(tx, `SELECT member_id FROM ${resets} WHERE member_id = ? AND token_hash = ? AND expires_at > ?`,
          person.id, digest(String(code ?? '').trim()), now)).rows[0];
        if (!row) fail(400, '重置码无效或已过期');
        await query(tx, `UPDATE ${members} SET password_hash = ?, version = version + 1 WHERE id = ?`, hash, person.id);
        await query(tx, `DELETE FROM ${resets} WHERE member_id = ?`, person.id);
        await query(tx, `DELETE FROM ${sessions} WHERE member_id = ?`, person.id);
        return person.id;
      });
    },
  };
}
