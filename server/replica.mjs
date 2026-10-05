// Turso/libSQL persistence for the synchronous node:sqlite store.
//
// The game server keeps using a local node:sqlite file (fast, synchronous, transactional).
// When a remote libSQL database is configured (Vercel + Turso) this module:
//  1. hydrates the local file from the remote copy before the server opens it;
//  2. records every committed row change through TEMP triggers and pushes them to Turso;
//  3. pulls rows written by other serverless instances (ordered by a global version).
// Remote layout (prefix default "hutong_online"):
//   <prefix>_schema(name, type, tbl, sql)       CREATE statements of local tables/indexes
//   <prefix>_rows(tbl, pk, data, deleted, ver)  one JSON row per local row, tombstones on delete
// Conflict policy is row-level last-writer-wins. It does not make the in-memory world shared.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

const q = name => '"' + String(name).replaceAll('"', '""') + '"';
const encode = row => JSON.stringify(row, (_k, v) => v instanceof Uint8Array ? { $b64: Buffer.from(v).toString('base64') } : typeof v === 'bigint' ? Number(v) : v);
const decodeValue = v => v && typeof v === 'object' && typeof v.$b64 === 'string' ? new Uint8Array(Buffer.from(v.$b64, 'base64')) : v;
const SKIP = new Set(['sqlite_sequence', 'sqlite_stat1']);
// Node <22.17 may lack DatabaseSync.isOpen / isTransaction; probe instead of treating undefined as closed/idle.
const dbIsOpen = db => {
  if (!db) return false;
  if (typeof db.isOpen === 'boolean') return db.isOpen;
  try { db.prepare('SELECT 1').get(); return true; } catch { return false; }
};
const dbInTx = db => typeof db?.isTransaction === 'boolean' ? db.isTransaction : false;

function tableColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${q(table)})`).all();
}
function keyColumns(db, table) {
  const cols = tableColumns(db, table).filter(c => c.pk > 0).sort((a, b) => a.pk - b.pk).map(c => c.name);
  return cols.length ? cols : ['rowid'];
}
function userTables(db) {
  return db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_hto%' ESCAPE '\\'").all().map(r => r.name).filter(n => !SKIP.has(n));
}
function upsertRow(db, table, data) {
  const cols = Object.keys(data);
  if (!cols.length) return;
  db.prepare(`INSERT OR REPLACE INTO ${q(table)}(${cols.map(q).join(',')}) VALUES(${cols.map(() => '?').join(',')})`).run(...cols.map(c => decodeValue(data[c])));
}

export function remoteTables(prefix = 'hutong_online') {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(prefix)) throw new Error('invalid replica prefix');
  return { schema: `${prefix}_schema`, rows: `${prefix}_rows` };
}

async function ensureRemote(client, t) {
  await client.batch([
    `CREATE TABLE IF NOT EXISTS ${t.schema}(name TEXT PRIMARY KEY, type TEXT NOT NULL, tbl TEXT NOT NULL, sql TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS ${t.rows}(tbl TEXT NOT NULL, pk TEXT NOT NULL, data TEXT, deleted INTEGER NOT NULL DEFAULT 0, ver INTEGER NOT NULL, PRIMARY KEY(tbl, pk))`,
    `CREATE INDEX IF NOT EXISTS ${t.rows}_ver ON ${t.rows}(ver)`,
  ], 'write');
}

/**
 * Replace the local database file with the remote copy. Call before openStore/createMvpServer.
 * Returns a replica handle; call handle.attach(db) once the server has created its tables.
 */
export async function prepareReplica(path, client, { prefix = 'hutong_online', flushEveryMs = 1500, log = console } = {}) {
  const t = remoteTables(prefix);
  await ensureRemote(client, t);
  for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(path + suffix, { force: true });
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const schema = (await client.execute(`SELECT name, type, tbl, sql FROM ${t.schema}`)).rows;
  const rows = (await client.execute(`SELECT tbl, pk, data, ver FROM ${t.rows} WHERE deleted = 0 ORDER BY ver`)).rows;
  const verRow = (await client.execute(`SELECT COALESCE(MAX(ver), 0) AS v FROM ${t.rows}`)).rows[0];
  let lastVer = Number(verRow?.v ?? 0);
  const loaded = new Set();
  // Rows arrive in version order, not dependency order: load them with foreign keys off.
  const db = new DatabaseSync(path, { enableForeignKeyConstraints: false });
  try {
    db.exec('BEGIN');
    for (const kind of ['table', 'index']) for (const s of schema) if (s.type === kind) {
      try { db.exec(String(s.sql)); } catch (e) { log.warn?.(`replica: schema ${s.name} skipped: ${e.message}`); }
    }
    let skipped = 0;
    for (const r of rows) {
      try { upsertRow(db, String(r.tbl), JSON.parse(String(r.data))); loaded.add(r.tbl + '\u0000' + r.pk); } catch { skipped++; }
    }
    db.exec('COMMIT');
    if (skipped) log.warn?.(`replica: ${skipped} remote rows could not be applied locally`);
  } catch (e) { try { db.exec('ROLLBACK'); } catch {} throw e; } finally { db.close(); }

  let db2 = null, timer = null, chain = Promise.resolve(), lastPull = Date.now(), closed = false;
  const serial = job => { const next = chain.then(job, job); chain = next.catch(() => {}); return next; };

  function attach(target) {
    db2 = target;
    db2.exec(`CREATE TEMP TABLE IF NOT EXISTS _hto_dirty(tbl TEXT NOT NULL, pk TEXT NOT NULL); CREATE INDEX IF NOT EXISTS temp._hto_dirty_key ON _hto_dirty(tbl, pk);
      CREATE TEMP TABLE IF NOT EXISTS _hto_ctl(applying INTEGER NOT NULL); DELETE FROM temp._hto_ctl; INSERT INTO temp._hto_ctl VALUES(0);`);
    // Trigger bodies must use unqualified names (older SQLite builds reject schema-qualified targets).
    const when = 'WHEN (SELECT applying FROM _hto_ctl) = 0';
    for (const table of userTables(db2)) {
      const keys = keyColumns(db2, table), key = p => `json_array(${keys.map(k => p + '.' + q(k)).join(',')})`;
      const tag = table.replace(/[^A-Za-z0-9_]/g, '_');
      const name = "'" + table.replaceAll("'", "''") + "'";
      // No UNIQUE constraint: an outer UPSERT's conflict policy overrides OR IGNORE inside trigger bodies.
      const ins = p => `INSERT INTO _hto_dirty(tbl, pk) SELECT ${name}, ${key(p)} WHERE NOT EXISTS (SELECT 1 FROM _hto_dirty WHERE tbl = ${name} AND pk = ${key(p)});`;
      db2.exec(`DROP TRIGGER IF EXISTS temp._hto_i_${tag}; DROP TRIGGER IF EXISTS temp._hto_u_${tag}; DROP TRIGGER IF EXISTS temp._hto_d_${tag};
        CREATE TEMP TRIGGER _hto_i_${tag} AFTER INSERT ON main.${q(table)} ${when} BEGIN ${ins('NEW')} END;
        CREATE TEMP TRIGGER _hto_u_${tag} AFTER UPDATE ON main.${q(table)} ${when} BEGIN ${ins('OLD')} ${ins('NEW')} END;
        CREATE TEMP TRIGGER _hto_d_${tag} AFTER DELETE ON main.${q(table)} ${when} BEGIN ${ins('OLD')} END;`);
      // Rows created locally before attach (defaults written during startup) are not remote yet.
      // Positional ? (not ?1/?2): older node:sqlite rejects reused numbered params ("column index out of range").
      const mark = db2.prepare('INSERT INTO temp._hto_dirty(tbl, pk) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM temp._hto_dirty WHERE tbl = ? AND pk = ?)');
      for (const r of db2.prepare(`SELECT ${key(q(table))} AS k FROM main.${q(table)}`).all()) if (!loaded.has(table + '\u0000' + r.k)) mark.run(table, r.k, table, r.k);
    }
    // Keep AUTOINCREMENT keys (messages, experiences) from colliding across instances.
    const base = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    for (const table of userTables(db2)) {
      const sql = db2.prepare("SELECT sql FROM main.sqlite_master WHERE type='table' AND name=?").get(table)?.sql || '';
      if (!/AUTOINCREMENT/i.test(sql)) continue;
      const current = db2.prepare('SELECT seq FROM main.sqlite_sequence WHERE name=?').get(table);
      if (!current) db2.prepare('INSERT INTO main.sqlite_sequence(name, seq) VALUES(?, ?)').run(table, base);
      else if (current.seq < base) db2.prepare('UPDATE main.sqlite_sequence SET seq=? WHERE name=?').run(base, table);
    }
    void serial(pushSchema).catch(e => log.error?.('replica: schema push failed: ' + e.message));
    if (flushEveryMs > 0) { timer = setInterval(() => { void flush().catch(() => {}); }, flushEveryMs); timer.unref?.(); }
    return handle;
  }

  async function pushSchema() {
    const items = db2.prepare("SELECT name, type, tbl_name AS tbl, sql FROM main.sqlite_master WHERE type IN ('table','index') AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'").all().filter(s => !SKIP.has(s.tbl));
    await client.batch(items.map(s => ({ sql: `INSERT INTO ${t.schema}(name, type, tbl, sql) VALUES(?,?,?,?) ON CONFLICT(name) DO UPDATE SET type=excluded.type, tbl=excluded.tbl, sql=excluded.sql`, args: [s.name, s.type, s.tbl, s.sql] })), 'write');
  }

  function readRow(table, pk) {
    const keys = keyColumns(db2, table), values = JSON.parse(pk);
    const select = keys[0] === 'rowid' ? `SELECT rowid AS rowid, * FROM main.${q(table)}` : `SELECT * FROM main.${q(table)}`;
    return db2.prepare(`${select} WHERE ${keys.map(k => q(k) + ' IS ?').join(' AND ')}`).get(...values) ?? null;
  }

  function flush() {
    return serial(async () => {
      if (!dbIsOpen(db2) || dbInTx(db2)) return 0;
      const dirty = db2.prepare('SELECT DISTINCT tbl, pk FROM temp._hto_dirty').all();
      if (!dirty.length) return 0;
      db2.exec('DELETE FROM temp._hto_dirty');
      const statements = [];
      for (const { tbl, pk } of dirty) {
        let row = null;
        try { row = readRow(tbl, pk); } catch { continue; }
        statements.push({ sql: `INSERT INTO ${t.rows}(tbl, pk, data, deleted, ver) VALUES(?, ?, ?, ?, (SELECT COALESCE(MAX(ver), 0) + 1 FROM ${t.rows})) ON CONFLICT(tbl, pk) DO UPDATE SET data=excluded.data, deleted=excluded.deleted, ver=excluded.ver`, args: [tbl, pk, row ? encode(row) : null, row ? 0 : 1] });
      }
      try {
        for (let i = 0; i < statements.length; i += 200) await client.batch(statements.slice(i, i + 200), 'write');
      } catch (e) {
        if (dbIsOpen(db2)) { const back = db2.prepare('INSERT INTO temp._hto_dirty(tbl, pk) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM temp._hto_dirty WHERE tbl = ? AND pk = ?)'); for (const d of dirty) back.run(d.tbl, d.pk, d.tbl, d.pk); }
        log.error?.('replica: flush failed: ' + e.message);
        throw e;
      }
      return statements.length;
    });
  }

  function pull({ maxAgeMs = 0 } = {}) {
    if (Date.now() - lastPull < maxAgeMs) return Promise.resolve(0);
    return serial(async () => {
      if (!dbIsOpen(db2)) return 0;
      let applied = 0;
      for (;;) {
        const result = await client.execute({ sql: `SELECT tbl, pk, data, deleted, ver FROM ${t.rows} WHERE ver > ? ORDER BY ver LIMIT 500`, args: [lastVer] });
        if (!result.rows.length || !dbIsOpen(db2)) break;
        if (dbInTx(db2)) break;
        const local = new Set(userTables(db2)), pending = new Set(db2.prepare('SELECT tbl, pk FROM temp._hto_dirty').all().map(r => r.tbl + '\u0000' + r.pk));
        db2.exec('UPDATE temp._hto_ctl SET applying = 1; BEGIN; PRAGMA defer_foreign_keys = ON;');
        try {
          for (const r of result.rows) {
            lastVer = Math.max(lastVer, Number(r.ver));
            const tbl = String(r.tbl), pk = String(r.pk);
            if (!local.has(tbl) || pending.has(tbl + '\u0000' + pk)) continue;
            try {
              if (Number(r.deleted)) {
                const keys = keyColumns(db2, tbl);
                db2.prepare(`DELETE FROM main.${q(tbl)} WHERE ${keys.map(k => q(k) + ' IS ?').join(' AND ')}`).run(...JSON.parse(pk));
              } else upsertRow(db2, tbl, JSON.parse(String(r.data)));
              applied++;
            } catch (e) { log.warn?.(`replica: pull skipped ${tbl}: ${e.message}`); }
          }
          db2.exec('COMMIT');
        } catch (e) { try { db2.exec('ROLLBACK'); } catch {} throw e; } finally { db2.exec('UPDATE temp._hto_ctl SET applying = 0'); }
        if (result.rows.length < 500) break;
      }
      lastPull = Date.now();
      return applied;
    });
  }

  async function close() {
    if (closed) return; closed = true; clearInterval(timer);
    try { await flush(); } catch {}
  }

  const handle = { attach, flush, pull, close, get lastVersion() { return lastVer; }, tables: t };
  return handle;
}
