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
// Atomic writes use optimistic version checks; a stale writer must retry.
// This does not make in-memory seat/device leases globally shared.
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
  const keys=keyColumns(db,table), updates=cols.filter(c=>!keys.includes(c));
  const conflict=updates.length?`DO UPDATE SET ${updates.map(c=>`${q(c)}=excluded.${q(c)}`).join(',')} WHERE ${updates.map(c=>`${q(table)}.${q(c)} IS NOT excluded.${q(c)}`).join(' OR ')}`:'DO NOTHING';
  db.prepare(`INSERT INTO ${q(table)}(${cols.map(q).join(',')}) VALUES(${cols.map(() => '?').join(',')}) ON CONFLICT(${keys.map(q).join(',')}) ${conflict}`).run(...cols.map(c => decodeValue(data[c])));
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
    ...['username','role'].map(field=>`CREATE UNIQUE INDEX IF NOT EXISTS ${t.rows}_account_${field} ON ${t.rows}(json_extract(data,'$.${field}')) WHERE tbl='accounts' AND deleted=0`),
    `CREATE TRIGGER IF NOT EXISTS ${t.rows}_claims_immutable BEFORE UPDATE ON ${t.rows} WHEN OLD.tbl='role_claims' AND (NEW.deleted<>0 OR NEW.data IS NOT OLD.data) BEGIN SELECT RAISE(ABORT,'role permanently claimed'); END`,
    `CREATE TRIGGER IF NOT EXISTS ${t.rows}_account_capacity BEFORE INSERT ON ${t.rows} WHEN NEW.tbl='accounts' AND NEW.deleted=0 AND NOT EXISTS(SELECT 1 FROM ${t.rows} WHERE tbl='accounts' AND pk=NEW.pk AND deleted=0) AND (SELECT COUNT(*) FROM ${t.rows} WHERE tbl='accounts' AND deleted=0)>=8 BEGIN SELECT RAISE(ABORT,'account capacity constraint'); END`,
    ...['INSERT','UPDATE'].map(event=>`CREATE TRIGGER IF NOT EXISTS ${t.rows}_offer_exclusive_${event.toLowerCase()} BEFORE ${event} ON ${t.rows} WHEN NEW.tbl='offers' AND NEW.deleted=0 AND json_extract(NEW.data,'$.status') IN ('pending','accepted') AND EXISTS(SELECT 1 FROM ${t.rows} r WHERE r.tbl='offers' AND r.pk<>NEW.pk AND r.deleted=0 AND json_extract(r.data,'$.status') IN ('pending','accepted') AND json_extract(r.data,'$.kind')=json_extract(NEW.data,'$.kind') AND (json_extract(r.data,'$.sender') IN (json_extract(NEW.data,'$.sender'),json_extract(NEW.data,'$.recipient')) OR json_extract(r.data,'$.recipient') IN (json_extract(NEW.data,'$.sender'),json_extract(NEW.data,'$.recipient')))) BEGIN SELECT RAISE(ABORT,'active invitation constraint'); END`),
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
  // Capture the watermark first: writes during hydration are safely replayed by the next pull.
  const verRow = (await client.execute(`SELECT COALESCE(MAX(ver), 0) AS v FROM ${t.rows}`)).rows[0];
  const rows = (await client.execute(`SELECT tbl, pk, data, deleted, ver FROM ${t.rows} ORDER BY ver`)).rows;
  let lastVer = Number(verRow?.v ?? 0);
  const versions=new Map(rows.map(r=>[r.tbl+'\u0000'+r.pk,Number(r.ver)]));
  const loaded = new Set();
  // Rows arrive in version order, not dependency order: load them with foreign keys off.
  const db = new DatabaseSync(path, { enableForeignKeyConstraints: false });
  try {
    db.exec('BEGIN');
    for (const kind of ['table', 'index']) for (const s of schema) if (s.type === kind) {
      db.exec(String(s.sql));
    }
    for (const r of rows) {
      if(Number(r.deleted))continue;
      upsertRow(db, String(r.tbl), JSON.parse(String(r.data))); loaded.add(r.tbl + '\u0000' + r.pk);
    }
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('replica hydration failed foreign key validation');
    for(const s of schema)if(s.type==='trigger')db.exec(String(s.sql));
    db.exec('COMMIT');
  } catch (e) { try { db.exec('ROLLBACK'); } catch {} throw e; } finally { db.close(); }

  let db2 = null, timer = null, chain = Promise.resolve(), lastPull = Date.now(), closed = false;
  let pulling = null, flushing = null, flushAgain = false;
  const serial = job => { const next = chain.then(job, job); chain = next.catch(() => {}); return next; };

  function attach(target) {
    db2 = target;
    db2.exec(`CREATE TEMP TABLE IF NOT EXISTS _hto_dirty(tbl TEXT NOT NULL, pk TEXT NOT NULL, generation INTEGER NOT NULL DEFAULT 0); CREATE INDEX IF NOT EXISTS temp._hto_dirty_key ON _hto_dirty(tbl, pk);
      CREATE TEMP TABLE IF NOT EXISTS _hto_ctl(applying INTEGER NOT NULL, generation INTEGER NOT NULL); DELETE FROM temp._hto_ctl; INSERT INTO temp._hto_ctl VALUES(0, 0);`);
    // Trigger bodies must use unqualified names (older SQLite builds reject schema-qualified targets).
    const when = 'WHEN (SELECT applying FROM _hto_ctl) = 0';
    for (const table of userTables(db2)) {
      const keys = keyColumns(db2, table), key = p => `json_array(${keys.map(k => p + '.' + q(k)).join(',')})`;
      const tag = table.replace(/[^A-Za-z0-9_]/g, '_');
      const name = "'" + table.replaceAll("'", "''") + "'";
      // No UNIQUE constraint: an outer UPSERT's conflict policy overrides OR IGNORE inside trigger bodies.
      const ins = p => `UPDATE _hto_ctl SET generation = generation + 1;
        UPDATE _hto_dirty SET generation = (SELECT generation FROM _hto_ctl) WHERE tbl = ${name} AND pk = ${key(p)};
        INSERT INTO _hto_dirty(tbl, pk, generation) SELECT ${name}, ${key(p)}, (SELECT generation FROM _hto_ctl) WHERE NOT EXISTS (SELECT 1 FROM _hto_dirty WHERE tbl = ${name} AND pk = ${key(p)});`;
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
    const items = db2.prepare("SELECT name, type, tbl_name AS tbl, sql FROM main.sqlite_master WHERE type IN ('table','index','trigger') AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'").all().filter(s => !SKIP.has(s.tbl));
    await client.batch(items.map(s => ({ sql: `INSERT INTO ${t.schema}(name, type, tbl, sql) VALUES(?,?,?,?) ON CONFLICT(name) DO UPDATE SET type=excluded.type, tbl=excluded.tbl, sql=excluded.sql`, args: [s.name, s.type, s.tbl, s.sql] })), 'write');
  }

  function readRow(table, pk) {
    const keys = keyColumns(db2, table), values = JSON.parse(pk);
    const select = keys[0] === 'rowid' ? `SELECT rowid AS rowid, * FROM main.${q(table)}` : `SELECT * FROM main.${q(table)}`;
    return db2.prepare(`${select} WHERE ${keys.map(k => q(k) + ' IS ?').join(' AND ')}`).get(...values) ?? null;
  }

  function flush({allowTransaction=false}={}) {
    if(allowTransaction)return serial(()=>flushRows(true));
    if (flushing) { flushAgain = true; return flushing; }
    const flight = (async () => {
      try {
        let total = 0;
        do {
          flushAgain = false;
          // Each pass queues behind waiting reads; callers still await every follow-up.
          total += await serial(flushRows);
        } while (flushAgain && dbIsOpen(db2));
        return total;
      } finally {
        // Release in the same continuation as loop exit. A .finally() microtask
        // would let a late caller join a flight that can no longer drain its write.
        if (flushing === flight) flushing = null;
      }
    })();
    flushing = flight;
    return flight;
  }

  async function flushRows(allowTransaction=false) {
      if (!dbIsOpen(db2) || dbInTx(db2)&&!allowTransaction) return 0;
      const dirty = db2.prepare('SELECT tbl, pk, generation FROM temp._hto_dirty').all();
      if (!dirty.length) return 0;
      const statements = [];
      for (const { tbl, pk } of dirty) {
        let row = null;
        row = readRow(tbl, pk);
        // This NOT NULL violation aborts the entire batch if any row was changed
        // since our last read. Never overwrite a concurrent gift, claim or queue edit.
        statements.push({sql:`INSERT INTO ${t.schema}(name,type,tbl,sql) SELECT NULL,'guard',?,NULL WHERE COALESCE((SELECT ver FROM ${t.rows} WHERE tbl=? AND pk=?),0) <> ?`,args:[tbl,tbl,pk,versions.get(tbl+'\u0000'+pk)??0]});
        statements.push({ sql: `INSERT INTO ${t.rows}(tbl, pk, data, deleted, ver) VALUES(?, ?, ?, ?, (SELECT COALESCE(MAX(ver), 0) + 1 FROM ${t.rows})) ON CONFLICT(tbl, pk) DO UPDATE SET data=excluded.data, deleted=excluded.deleted, ver=excluded.ver RETURNING ver`, args: [tbl, pk, row ? encode(row) : null, row ? 0 : 1] });
      }
      try {
        // One atomic batch includes state changes and idempotency receipts.
        const results=await client.batch(statements,'write');
        for(let i=0;i<dirty.length;i++)versions.set(dirty[i].tbl+'\u0000'+dirty[i].pk,Number(results[i*2+1].rows[0].ver));
        if (dbIsOpen(db2)) {
          // A request can update this row while the remote batch is in flight.
          // Acknowledge only the generation captured above, leaving newer writes dirty.
          const clear = db2.prepare('DELETE FROM temp._hto_dirty WHERE tbl = ? AND pk = ? AND generation = ?');
          for (const d of dirty) clear.run(d.tbl, d.pk, d.generation);
        }
      } catch (e) {
        log.error?.('replica: flush failed: ' + e.message);
        if(/constraint|permanently claimed/i.test(e.message))throw Object.assign(new Error('状态已更新或角色已领取，请刷新后重试'),{status:409});
        throw e;
      }
      return dirty.length;
  }

  function pull({ maxAgeMs = 0,reconcilePending=false } = {}) {
    if (pulling) return pulling;
    if (Date.now() - lastPull < maxAgeMs) return Promise.resolve(0);
    pulling = serial(async () => {
      // Requests queued behind a flush must reuse the latest completed read too.
      if (Date.now() - lastPull < maxAgeMs) return 0;
      if (!dbIsOpen(db2)) return 0;
      if(reconcilePending){
        // Only unacknowledged background changes can be pending at a request
        // boundary. A newer authoritative row replaces them before gameplay.
        const dirty=db2.prepare('SELECT tbl,pk FROM temp._hto_dirty').all();
        if(dirty.length){
          const result=await client.execute({sql:`SELECT tbl,pk,data,deleted,ver FROM ${t.rows} WHERE ${dirty.map(()=>'(tbl=? AND pk=?)').join(' OR ')}`,args:dirty.flatMap(r=>[r.tbl,r.pk])});
          const changed=result.rows.filter(r=>Number(r.ver)!==(versions.get(r.tbl+'\u0000'+r.pk)??0));
          if(changed.length){db2.exec('UPDATE temp._hto_ctl SET applying=1; BEGIN; PRAGMA defer_foreign_keys=ON;');try{for(const r of changed){if(Number(r.deleted)){const keys=keyColumns(db2,r.tbl);db2.prepare(`DELETE FROM ${q(r.tbl)} WHERE ${keys.map(k=>q(k)+' IS ?').join(' AND ')}`).run(...JSON.parse(r.pk));}else upsertRow(db2,r.tbl,JSON.parse(r.data));db2.prepare('DELETE FROM temp._hto_dirty WHERE tbl=? AND pk=?').run(r.tbl,r.pk);}db2.exec('COMMIT');for(const r of changed)versions.set(r.tbl+'\u0000'+r.pk,Number(r.ver));}catch(e){db2.exec('ROLLBACK');throw e;}finally{db2.exec('UPDATE temp._hto_ctl SET applying=0');}}
        }
      }
      let applied = 0;
      for (;;) {
        const result = await client.execute({ sql: `SELECT tbl, pk, data, deleted, ver FROM ${t.rows} WHERE ver > ? ORDER BY ver LIMIT 500`, args: [lastVer] });
        if (!result.rows.length || !dbIsOpen(db2)) break;
        if (dbInTx(db2)) break;
        const local = new Set(userTables(db2)), pending = new Set(db2.prepare('SELECT tbl, pk FROM temp._hto_dirty').all().map(r => r.tbl + '\u0000' + r.pk));
        db2.exec('UPDATE temp._hto_ctl SET applying = 1; BEGIN; PRAGMA defer_foreign_keys = ON;');
        let candidate=lastVer,count=0;const changes=[];
        try {
          for (const r of result.rows) {
            const tbl = String(r.tbl), pk = String(r.pk);
            if (!local.has(tbl))throw new Error('replica unknown table: '+tbl);
            // Preserve pending local work for the flush conflict check. Request
            // boundaries reconcile background conflicts before another command.
            if (pending.has(tbl + '\u0000' + pk)) { candidate = Math.max(candidate, Number(r.ver)); continue; }
              if (Number(r.deleted)) {
                const keys = keyColumns(db2, tbl);
                db2.prepare(`DELETE FROM main.${q(tbl)} WHERE ${keys.map(k => q(k) + ' IS ?').join(' AND ')}`).run(...JSON.parse(pk));
              } else upsertRow(db2, tbl, JSON.parse(String(r.data)));
              count++;changes.push([tbl+'\u0000'+pk,Number(r.ver)]);
            candidate = Math.max(candidate, Number(r.ver));
          }
          db2.exec('COMMIT');
          lastVer=candidate;applied+=count;for(const [key,value]of changes)versions.set(key,value);
        } catch (e) { try { db2.exec('ROLLBACK'); } catch {} throw e; } finally { db2.exec('UPDATE temp._hto_ctl SET applying = 0'); }
        if (result.rows.length < 500) break;
      }
      lastPull = Date.now();
      return applied;
    }).finally(() => { pulling = null; });
    return pulling;
  }

  function checkedTables(tables) {
    if (!dbIsOpen(db2)) throw Object.assign(new Error('replica is not attached'), { status: 503 });
    const local = new Set(userTables(db2));
    if (!Array.isArray(tables) || !tables.length || tables.some(table => typeof table !== 'string' || !local.has(table))) throw new TypeError('invalid authoritative tables');
    return [...new Set(tables)];
  }

  function pendingFor(tables) {
    const wanted = new Set(tables);
    return db2.prepare('SELECT tbl, pk, generation FROM temp._hto_dirty').all().filter(row => wanted.has(row.tbl));
  }

  function hasPending(tables) {
    return pendingFor(checkedTables(tables)).length > 0;
  }

  // Permission-bearing tables must use remote truth even when an ordinary pull
  // skipped a failed local write. One complete query also recovers rows whose
  // remote versions are already behind lastVer, without rewinding other tables.
  // Dependent tables read only their captured dirty keys, keeping large immutable
  // image payloads out of the normal metadata refresh.
  function syncAuthoritativeTables(tables, { pendingTables = [] } = {}) {
    const wanted = checkedTables(tables);
    const dependent = pendingTables.length ? checkedTables(pendingTables).filter(table => !wanted.includes(table)) : [];
    const watched = [...wanted, ...dependent];
    return serial(async () => {
      if (!dbIsOpen(db2) || dbInTx(db2)) throw Object.assign(new Error('replica is busy'), { status: 503 });
      const captured = pendingFor(watched);
      const generations = new Map(captured.map(row => [row.tbl + '\u0000' + row.pk, row.generation]));
      const dependentRows = captured.filter(row => dependent.includes(row.tbl));
      const dependentKeys = dependent.map(table => [table, dependentRows.filter(row => row.tbl === table).map(row => row.pk)]).filter(([, keys]) => keys.length);
      const result = await client.execute({
        sql: `SELECT tbl, pk, data, deleted, ver FROM ${t.rows} WHERE tbl IN (${wanted.map(() => '?').join(',')})${dependentKeys.map(() => ' OR (tbl = ? AND pk IN (SELECT value FROM json_each(?)))').join('')} ORDER BY ver`,
        args: [...wanted, ...dependentKeys.flatMap(([table, keys]) => [table, JSON.stringify(keys)])],
      });
      if (!dbIsOpen(db2) || dbInTx(db2)) throw Object.assign(new Error('replica is busy'), { status: 503 });
      const pending = pendingFor(watched);
      if (pending.length !== captured.length || pending.some(row => generations.get(row.tbl + '\u0000' + row.pk) !== row.generation)) {
        // A new request mutated this table while the remote read was in flight.
        // Preserve its write, but prevent the caller from trusting this snapshot.
        throw Object.assign(new Error('authoritative state changed during synchronization'), { status: 503 });
      }
      const remote = new Map(result.rows.map(row => [String(row.tbl) + '\u0000' + String(row.pk), row]));
      db2.exec('UPDATE temp._hto_ctl SET applying = 1; BEGIN; PRAGMA defer_foreign_keys = ON;');
      try {
        for (const table of wanted) {
          const keys = keyColumns(db2, table);
          const key = `json_array(${keys.map(column => q(column)).join(',')})`;
          const remove = db2.prepare(`DELETE FROM main.${q(table)} WHERE ${keys.map(column => q(column) + ' IS ?').join(' AND ')}`);
          for (const row of db2.prepare(`SELECT ${key} AS pk FROM main.${q(table)}`).all()) {
            const authoritative = remote.get(table + '\u0000' + row.pk);
            if (!authoritative || Number(authoritative.deleted)) remove.run(...JSON.parse(row.pk));
          }
        }
        for (const row of dependentRows) {
          const authoritative = remote.get(row.tbl + '\u0000' + row.pk);
          if (!authoritative || Number(authoritative.deleted)) {
            const keys = keyColumns(db2, row.tbl);
            db2.prepare(`DELETE FROM main.${q(row.tbl)} WHERE ${keys.map(column => q(column) + ' IS ?').join(' AND ')}`).run(...JSON.parse(row.pk));
          }
        }
        for (const row of result.rows) if (!Number(row.deleted)) upsertRow(db2, String(row.tbl), JSON.parse(String(row.data)));
        const clear = db2.prepare('DELETE FROM temp._hto_dirty WHERE tbl = ? AND pk = ? AND generation = ?');
        for (const row of captured) clear.run(row.tbl, row.pk, row.generation);
        db2.exec('COMMIT');
        for (const key of versions.keys()) if (wanted.includes(key.slice(0, key.indexOf('\u0000')))) versions.delete(key);
        for (const row of dependentRows) versions.delete(row.tbl + '\u0000' + row.pk);
        for (const row of result.rows) versions.set(String(row.tbl) + '\u0000' + String(row.pk), Number(row.ver));
      } catch (e) { try { db2.exec('ROLLBACK'); } catch {} throw e; }
      finally { db2.exec('UPDATE temp._hto_ctl SET applying = 0'); }
      return result.rows.length;
    });
  }

  async function close() {
    if (closed) return; closed = true; clearInterval(timer);
    try { await flush(); } catch {}
  }

  const handle = { attach, flush, pull, syncAuthoritativeTables, hasPending, close, get lastVersion() { return lastVer; }, tables: t };
  return handle;
}
