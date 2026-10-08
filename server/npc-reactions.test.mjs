import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@libsql/client';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareReplica } from './replica.mjs';
import { createNpcReactions } from './npc-reactions.mjs';
import { createStreamReplicaSync } from './stream-replica.mjs';

test('NPC feedback reaches a second replica and expires without extra writes', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'hutong-npc-react-'));
  const remote = createClient({ url: 'file::memory:' });
  const instances = [];
  t.after(async () => {
    for (const i of instances) { await i.replica.close(); i.db.close(); }
    remote.close();
    if (dir.startsWith(join(tmpdir(), 'hutong-npc-react-'))) rmSync(dir, { recursive: true, force: true });
  });
  async function instance(name) {
    const path = join(dir, name + '.sqlite');
    const replica = await prepareReplica(path, remote, { flushEveryMs: 0 });
    const db = new DatabaseSync(path), reactions = createNpcReactions(db);
    replica.attach(db);
    const value = { replica, db, reactions }; instances.push(value); return value;
  }
  const a = await instance('a'), b = await instance('b');
  const watch = createStreamReplicaSync(b.replica, { intervalMs: 10, maxAgeMs: 0 });
  const releases = Array.from({ length: 32 }, () => watch());
  t.after(() => releases.forEach(release => release()));
  async function received(id) { for(let n=0;n<200;n++){if(b.reactions.get('buzz')?.id===id)return;await new Promise(r=>setTimeout(r,10));}assert.fail('stream replica did not receive feedback'); }
  const now = Date.now(), reaction = { id: 'buzz:one', npc: 'buzz', text: 'Cora，准备起飞！', started: now, expires: now + 5000 };
  a.reactions.set('buzz', reaction);
  await a.replica.flush(); await received('buzz:one');
  assert.deepEqual(b.reactions.get('buzz'), reaction);
  assert.deepEqual(b.reactions.values(), [reaction]);
  const next = { ...reaction, id: 'buzz:two', started: now + 3000, expires: now + 8000 };
  a.reactions.set('buzz', next); await a.replica.flush(); await received('buzz:two');
  assert.equal(b.reactions.values().length, 1, 'one row per NPC, no accumulation');
  assert.equal(b.reactions.get('buzz').id, 'buzz:two');
  t.mock.method(Date, 'now', () => now + 8001);
  assert.deepEqual(b.reactions.values(), []);
  assert.equal(b.reactions.get('buzz'), undefined);
  assert.equal(b.db.prepare('SELECT COUNT(*) AS n FROM temp._hto_dirty').get().n, 0, 'expiry creates no replicated writes');
});
