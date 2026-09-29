import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { createApp } from './app.mjs';
import { openStore } from './store.mjs';

test('eight concurrent actors keep moving while an LLM response is blocked', { timeout: 10000 }, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'hutong-eight-'));
  const store = openStore(':memory:');
  const codes = readFileSync(store.ensureRoster(join(directory, 'codes.txt')).file, 'utf8').trim().split(/\r?\n/);
  const users = codes.map(line => {
    const [name, claimCode] = line.split('\t');
    const session = store.register({ name, claimCode, password: 'test-only-password' });
    store.setMode(session.member.id, 'manual');
    return { id: session.member.id, token: session.token, seq: 0 };
  });
  let release, began;
  const started = new Promise(resolve => { began = resolve; });
  const provider = new Promise(resolve => { release = resolve; });
  const server = createApp({ store, basePath: '/cyber-hutong',
    clientDir: fileURLToPath(new URL('../client', import.meta.url)),
    complete: async () => { began(); return provider; },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    release('迟到的回复');
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    store.close(); rmSync(directory, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${server.address().port}/cyber-hutong`;
  async function post(user, path, body) {
    const response = await fetch(origin + path, { method: 'POST', headers: {
      cookie: `hutong=${user.token}`, 'content-type': 'application/json',
    }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  await Promise.all(users.map(async user => {
    const response = await post(user, '/api/world/join', { tabId: `test-${user.id}` });
    assert.equal(response.status, 200);
    user.leaseId = response.body.leaseId;
  }));
  const suki = users.find(x => x.id === 'suki');
  store.setMode('franco', 'auto');
  const chat = post(suki, '/api/chats/franco/messages', { text: '在吗' });
  await started;
  const duplicate = await post(suki, '/api/chats/franco/messages', { text: '重复请求' });
  assert.equal(duplicate.status, 429);
  store.setMode('franco', 'manual');
  const latencies = [];
  for (let round = 0; round < 6; round++) {
    await Promise.all(users.map(async user => {
      const now = performance.now();
      const response = await post(user, '/api/world/intent', {
        leaseId: user.leaseId, seq: ++user.seq, intent: { type: 'move', dir: { x: 0, y: 1 } },
      });
      latencies.push(performance.now() - now);
      assert.equal(response.status, 200);
    }));
    await sleep(100);
  }
  assert.equal(latencies.length, 48);
  assert.ok(Math.max(...latencies) < 1500, 'movement must not wait for blocked LLM');
  const snapshot = await fetch(origin + '/api/world', { headers: { cookie: `hutong=${suki.token}` } }).then(r => r.json());
  assert.equal(snapshot.actors.filter(actor => !actor.guest && actor.inputSeq === 6).length, 8);
  release('迟到的回复');
  assert.equal((await chat).body.messages.filter(message => message.source === 'llm').length, 0);
  t.diagnostic(`Local 48 movement requests, max ${Math.max(...latencies).toFixed(1)} ms; mock LLM held throughout`);
});
