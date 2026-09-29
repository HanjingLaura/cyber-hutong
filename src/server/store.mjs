import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { roster } from '../../examples/mvp-behavior/config.mjs';

const OFFLINE_MS = 60000;
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt:16384:8:1:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [kind, n, r, p, saltHex, hashHex] = String(stored ?? '').split(':');
  if (kind !== 'scrypt') return false;
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), 32, {
    N: Number(n), r: Number(r), p: Number(p),
  });
  const expected = Buffer.from(hashHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function claimCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
}

export function openStore(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  const dummyPassword = hashPassword('dummy-password-value');
  const connections = new Map();
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      canonical_name TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      credential_version INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      sprite TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at INTEGER,
      consumed_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS claims (
      member_id TEXT PRIMARY KEY,
      character_id TEXT UNIQUE NOT NULL,
      claimed_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      credential_version INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS presence (
      member_id TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      seen_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      body TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_thread ON messages(thread_id, created_at);
    CREATE TABLE IF NOT EXISTS world_state (
      id INTEGER PRIMARY KEY,
      version INTEGER NOT NULL,
      snapshot TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS world_outbox (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      acked INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS actor_places (
      member_id TEXT PRIMARY KEY,
      scene TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      pose TEXT NOT NULL,
      facing TEXT NOT NULL,
      seat_id TEXT
    );
  `);

  function fail(status, error) {
    throw Object.assign(new Error(error), { status });
  }

  function presenceOf(memberId) {
    return db.prepare('SELECT mode, seen_at FROM presence WHERE member_id = ?').get(memberId);
  }

  return {
    close() { db.close(); },
    ensureRoster(codeFile, { claims = true } = {}) {
      const insertMember = db.prepare('INSERT OR IGNORE INTO members (id, canonical_name) VALUES (?, ?)');
      const insertCharacter = db.prepare('INSERT OR IGNORE INTO characters (id, sprite) VALUES (?, ?)');
      const insertPresence = db.prepare("INSERT OR IGNORE INTO presence (member_id, mode, seen_at) VALUES (?, 'auto', 0)");
      for (const person of roster) {
        insertMember.run(person.id, person.name);
        insertCharacter.run(person.sprite, person.sprite);
        insertPresence.run(person.id);
      }
      if (!claims) return { written: false, file: codeFile };
      const existing = db.prepare("SELECT COUNT(*) AS n FROM auth_tokens WHERE purpose = 'claim'").get().n;
      if (existing) return { written: false, file: codeFile };
      const insertToken = db.prepare(`INSERT INTO auth_tokens
        (id, member_id, purpose, token_hash, expires_at, consumed_at) VALUES (?, ?, 'claim', ?, NULL, NULL)`);
      const lines = [];
      for (const person of roster) {
        const code = claimCode();
        insertToken.run(cryptoRandomId(), person.id, digest(code));
        lines.push(`${person.name}\t${code}`);
      }
      mkdirSync(dirname(codeFile), { recursive: true });
      writeFileSync(codeFile, `${lines.join('\n')}\n`, 'utf8');
      return { written: true, file: codeFile };
    },
    register({ name, claimCode: code, password }) {
      const person = roster.find((item) => item.id === String(name ?? '').trim().toLowerCase());
      if (!person) fail(400, '无法用这个英文名注册');
      if (typeof password !== 'string' || password.length < 10 || password.length > 128) fail(400, '密码需为 10 到 128 位');
      db.exec('BEGIN IMMEDIATE');
      try {
        const member = db.prepare('SELECT password_hash, credential_version FROM members WHERE id = ?').get(person.id);
        if (member.password_hash) fail(409, '该名字已注册，请直接登录');
        const tokens = db.prepare(`SELECT id, token_hash FROM auth_tokens
          WHERE member_id = ? AND purpose = 'claim' AND consumed_at IS NULL`).all(person.id);
        const hashed = digest(String(code ?? '').trim());
        const match = tokens.find((token) => token.token_hash === hashed);
        if (!match) fail(400, '领取码无效');
        db.prepare('UPDATE members SET password_hash = ? WHERE id = ?').run(hashPassword(password), person.id);
        db.prepare('UPDATE auth_tokens SET consumed_at = ? WHERE id = ?').run(Date.now(), match.id);
        db.prepare('INSERT INTO claims (member_id, character_id, claimed_at) VALUES (?, ?, ?)')
          .run(person.id, person.sprite, Date.now());
        const session = insertSession(person.id, member.credential_version);
        db.exec('COMMIT');
        return session;
      } catch (error) {
        if (db.isTransaction) db.exec('ROLLBACK');
        throw error;
      }
    },
    login({ name, password }) {
      if (typeof password !== 'string' || password.length > 128) fail(401, '英文名或密码不正确');
      const person = roster.find((item) => item.id === String(name ?? '').trim().toLowerCase());
      const member = person && db.prepare('SELECT password_hash, credential_version FROM members WHERE id = ?').get(person.id);
      const matched = verifyPassword(String(password ?? ''), member?.password_hash || dummyPassword);
      if (!member?.password_hash || !matched) fail(401, '英文名或密码不正确');
      return insertSession(person.id, member.credential_version);
    },
    logout(token) {
      if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token));
    },
    issueReset(name, now = Date.now()) {
      const id = String(name ?? '').trim().toLowerCase();
      const member = db.prepare('SELECT password_hash FROM members WHERE id = ?').get(id);
      if (!member?.password_hash) fail(400, '该成员尚未注册');
      const code = randomBytes(24).toString('base64url');
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare("DELETE FROM auth_tokens WHERE member_id = ? AND purpose = 'reset'").run(id);
        db.prepare("INSERT INTO auth_tokens (id, member_id, purpose, token_hash, expires_at) VALUES (?, ?, 'reset', ?, ?)")
          .run(cryptoRandomId(), id, digest(code), now + 15 * 60000);
        db.exec('COMMIT');
      } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
      return code;
    },
    resetPassword({ name, code, password }, now = Date.now()) {
      const id = String(name ?? '').trim().toLowerCase();
      if (typeof password !== 'string' || password.length < 10 || password.length > 128) fail(400, '密码需为 10 到 128 位');
      db.exec('BEGIN IMMEDIATE');
      try {
        const token = db.prepare("SELECT id FROM auth_tokens WHERE member_id = ? AND purpose = 'reset' AND token_hash = ? AND consumed_at IS NULL AND expires_at > ?")
          .get(id, digest(String(code ?? '').trim()), now);
        if (!token) fail(400, '重置码无效或已过期');
        db.prepare('UPDATE members SET password_hash = ?, credential_version = credential_version + 1 WHERE id = ?').run(hashPassword(password), id);
        db.prepare('UPDATE auth_tokens SET consumed_at = ? WHERE id = ?').run(now, token.id);
        db.prepare('DELETE FROM sessions WHERE member_id = ?').run(id);
        db.prepare("UPDATE presence SET mode = 'auto', seen_at = 0 WHERE member_id = ?").run(id);
        db.exec('COMMIT');
        return id;
      } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
    },
    session(token) {
      if (!token) return null;
      const row = db.prepare(`SELECT s.member_id, s.expires_at, s.credential_version, m.credential_version AS current_version, m.canonical_name
        FROM sessions s JOIN members m ON m.id = s.member_id WHERE s.token_hash = ?`).get(digest(token));
      if (!row || row.expires_at <= Date.now() || row.credential_version !== row.current_version) return null;
      return { id: row.member_id, name: row.canonical_name };
    },
    touch(memberId) {
      db.prepare('UPDATE presence SET seen_at = ? WHERE member_id = ?').run(Date.now(), memberId);
    },
    setMode(memberId, mode) {
      if (!['manual', 'auto'].includes(mode)) fail(400, '无法切换这个状态');
      db.prepare('UPDATE presence SET mode = ?, seen_at = ? WHERE member_id = ?').run(mode, Date.now(), memberId);
    },
    connectPresence(memberId, connection) {
      const group = connections.get(memberId) ?? new Set();
      group.add(connection);
      connections.set(memberId, group);
      this.setMode(memberId, 'manual');
    },
    disconnectPresence(memberId, connection) {
      const group = connections.get(memberId);
      group?.delete(connection);
      if (!group?.size) connections.delete(memberId);
      this.touch(memberId);
    },
    effectiveManual(memberId, now = Date.now()) {
      const row = presenceOf(memberId);
      return Boolean(row && row.mode === 'manual' && (connections.get(memberId)?.size || now - row.seen_at < OFFLINE_MS));
    },
    describe(memberId, viewerId) {
      const person = roster.find((item) => item.id === memberId);
      const row = presenceOf(memberId);
      const watching = Boolean(row && (connections.get(memberId)?.size || Date.now() - row.seen_at < OFFLINE_MS));
      const human = this.effectiveManual(memberId);
      const last = viewerId ? db.prepare(`SELECT sender_id, body, source, created_at FROM messages
        WHERE thread_id = ? ORDER BY created_at DESC LIMIT 1`).get([viewerId, memberId].sort().join(':')) : null;
      return {
        id: person.id,
        name: person.name,
        control: human ? 'human' : 'llm',
        watching,
        last: last ? { body: last.body, source: last.source, at: last.created_at, mine: last.sender_id === viewerId } : null,
      };
    },
    listCharacters(viewerId) {
      return roster.filter((person) => person.id !== viewerId).map((person) => this.describe(person.id, viewerId));
    },
    messages(thread) {
      return db.prepare(`SELECT id, sender_id, body, source, created_at FROM messages
        WHERE thread_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 100`).all(thread).reverse().map(publicMessage);
    },
    recent(thread, limit) {
      const rows = db.prepare(`SELECT sender_id, body FROM messages
        WHERE thread_id = ? ORDER BY created_at DESC LIMIT ?`).all(thread, limit);
      return rows.reverse().map((row) => ({
        senderName: roster.find((person) => person.id === row.sender_id).name,
        body: row.body,
      }));
    },
    controlMode(memberId) {
      return db.prepare('SELECT mode FROM presence WHERE member_id = ?').get(memberId)?.mode ?? 'auto';
    },
    worldRepository() {
      return {
        async load() {
          const row = db.prepare('SELECT version, snapshot FROM world_state WHERE id = 1').get();
          return row ? { version: row.version, snapshot: JSON.parse(row.snapshot) } : null;
        },
        async commit({ expectedVersion, snapshot, commands }) {
          db.exec('BEGIN IMMEDIATE');
          try {
            const row = db.prepare('SELECT version FROM world_state WHERE id = 1').get();
            const version = row?.version ?? 0;
            if (version !== expectedVersion) throw Object.assign(new Error('世界版本冲突'), { status: 409 });
            db.prepare(`INSERT INTO world_state (id, version, snapshot) VALUES (1, ?, ?)
              ON CONFLICT(id) DO UPDATE SET version = excluded.version, snapshot = excluded.snapshot`)
              .run(expectedVersion + 1, JSON.stringify(snapshot));
            const insert = db.prepare('INSERT INTO world_outbox (id, payload, acked) VALUES (?, ?, 0)');
            for (const command of commands) insert.run(command.id, JSON.stringify(command.payload));
            db.exec('COMMIT');
            return expectedVersion + 1;
          } catch (error) {
            if (db.isTransaction) db.exec('ROLLBACK');
            throw error;
          }
        },
        async pendingCommands(limit) {
          return db.prepare('SELECT id, payload FROM world_outbox WHERE acked = 0 ORDER BY rowid LIMIT ?').all(limit)
            .map((row) => ({ id: row.id, payload: JSON.parse(row.payload) }));
        },
        async acknowledgeCommand(id) {
          db.prepare('UPDATE world_outbox SET acked = 1 WHERE id = ?').run(id);
        },
      };
    },
    loadPlaces() {
      return db.prepare(`SELECT member_id, scene, x, y, pose, facing, seat_id FROM actor_places`).all()
        .map((row) => ({
          memberId: row.member_id, scene: row.scene, x: row.x, y: row.y,
          pose: row.pose, facing: row.facing, seatId: row.seat_id,
        }));
    },
    savePlaces(rows) {
      const write = db.prepare(`INSERT INTO actor_places (member_id, scene, x, y, pose, facing, seat_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(member_id) DO UPDATE SET scene = excluded.scene, x = excluded.x, y = excluded.y,
          pose = excluded.pose, facing = excluded.facing, seat_id = excluded.seat_id`);
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const row of rows) write.run(row.memberId, row.scene, row.x, row.y, row.pose, row.facing, row.seatId);
        db.exec('COMMIT');
      } catch (error) {
        if (db.isTransaction) db.exec('ROLLBACK');
        throw error;
      }
    },
    addMessage({ thread, senderId, body, source }) {
      const id = cryptoRandomId();
      const createdAt = Date.now();
      db.prepare(`INSERT INTO messages (id, thread_id, sender_id, body, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`).run(id, thread, senderId, body, source, createdAt);
      return publicMessage({ id, sender_id: senderId, body, source, created_at: createdAt });
    },
  };

  function insertSession(memberId, credentialVersion) {
    const token = randomBytes(32).toString('base64url');
    db.prepare(`INSERT INTO sessions (token_hash, member_id, credential_version, expires_at)
      VALUES (?, ?, ?, ?)`).run(digest(token), memberId, credentialVersion, Date.now() + SESSION_MS);
    db.prepare("UPDATE presence SET mode = 'manual', seen_at = ? WHERE member_id = ?").run(Date.now(), memberId);
    return { token, member: { id: memberId, name: roster.find((person) => person.id === memberId).name } };
  }
}

function publicMessage(row) {
  return {
    id: row.id,
    senderId: row.sender_id,
    body: row.body,
    source: row.source,
    at: row.created_at,
  };
}

function cryptoRandomId() {
  return randomBytes(16).toString('hex');
}
