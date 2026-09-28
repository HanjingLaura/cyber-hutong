import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrompt, cleanReply, planAutoSpeakers, speakInOrder } from './chat.mjs';
import { createApp } from './app.mjs';
import { openStore } from './store.mjs';

const clientDir = fileURLToPath(new URL('../client/', import.meta.url));

test('auto replies never speak for a person who is present', () => {
  assert.deepEqual(planAutoSpeakers({
    selfId: 'suki', peerId: 'franco', selfManual: true, peerManual: true, trigger: 'human', maxTurns: 4,
  }), []);
  assert.deepEqual(planAutoSpeakers({
    selfId: 'suki', peerId: 'franco', selfManual: true, peerManual: false, trigger: 'human', maxTurns: 4,
  }), ['franco']);
  assert.deepEqual(planAutoSpeakers({
    selfId: 'suki', peerId: 'franco', selfManual: false, peerManual: false, trigger: 'opener', maxTurns: 4,
  }), ['franco', 'suki', 'franco', 'suki']);
  assert.deepEqual(planAutoSpeakers({
    selfId: 'suki', peerId: 'franco', selfManual: true, peerManual: false, trigger: 'opener', maxTurns: 4,
  }), ['franco']);
});

test('prompt stays inside the given facts and drops a name prefix', () => {
  const prompt = buildPrompt({
    speaker: { id: 'sid', name: 'Sid' },
    peer: { id: 'kay', name: 'Kay' },
    history: [{ senderName: 'Kay', body: '咖啡放你桌上了' }],
  });
  assert.match(prompt.system, /用电脑开发/);
  assert.equal(prompt.system.includes('喜欢打电话'), false);
  assert.equal(cleanReply('Sid：我在写代码。', 'Sid'), '我在写代码。');
});

test('a chain stops when the next speaker is a real person', async () => {
  const spoken = [];
  const produced = await speakInOrder({
    speakers: ['franco', 'suki'],
    isManual: (id) => id === 'suki',
    say: async (id) => { spoken.push(id); return '嗯'; },
  });
  assert.deepEqual(spoken, ['franco']);
  assert.equal(produced.length, 1);
});

test('human, llm, and two-llm threads stay private', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'hutong-chat-'));
  const store = openStore(':memory:');
  const codes = Object.fromEntries(readFileSync(store.ensureRoster(join(directory, 'codes.txt')).file, 'utf8')
    .trim().split(/\r?\n/).map((line) => {
      const [name, code] = line.split('\t');
      return [name.toLowerCase(), code];
    }));
  const calls = [];
  const server = createApp({
    store,
    maxTurns: 4,
    llm: { configured: true, model: 'qwen-turbo' },
    clientDir,
    complete: async (prompt) => {
      calls.push(prompt.system);
      if (prompt.system.includes('Franco')) return 'Franco：我在打电话。';
      return '我听到了。';
    },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  t.after(() => new Promise((resolve) => server.close(() => {
    store.close();
    rmSync(directory, { recursive: true, force: true });
    resolve();
  })));

  const suki = await register(port, 'Suki', codes.suki);
  const franco = await register(port, 'Franco', codes.franco);
  const human = await post(port, suki, '/api/chats/franco/messages', { text: '在吗' });
  assert.equal(human.status, 200);
  assert.equal(calls.length, 0);
  assert.equal(human.body.messages[0].source, 'human');
  const seen = await get(port, franco, '/api/chats/suki/messages');
  assert.equal(seen.body.messages[0].body, '在吗');
  const outsider = await register(port, 'Laura', codes.laura);
  const hidden = await get(port, outsider, '/api/chats/suki/messages');
  assert.equal(hidden.body.messages.length, 0);

  await post(port, franco, '/api/me/mode', { mode: 'auto' });
  calls.length = 0;
  const reply = await post(port, suki, '/api/chats/franco/messages', { text: '现在呢' });
  assert.equal(calls.length, 1);
  assert.equal(reply.body.messages.at(-1).source, 'llm');
  assert.equal(reply.body.messages.at(-1).body, '我在打电话。');
  assert.match(calls[0], /喜欢打电话/);

  await post(port, suki, '/api/me/mode', { mode: 'auto' });
  calls.length = 0;
  const both = await post(port, suki, '/api/chats/franco/auto', {});
  assert.equal(both.status, 200);
  assert.equal(calls.length, 4);
  assert.deepEqual(both.body.messages.map((item) => item.senderId), ['franco', 'suki', 'franco', 'suki']);
});

async function register(port, name, code) {
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, claimCode: code, password: 'correct-horse' }),
  });
  const body = await response.json();
  assert.equal(response.status, 201, body.error);
  return response.headers.getSetCookie()[0].split(';')[0];
}

function post(port, cookie, path, payload) {
  return send(port, cookie, path, 'POST', payload);
}

function get(port, cookie, path) {
  return send(port, cookie, path, 'GET');
}

async function send(port, cookie, path, method, payload) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  return { status: response.status, body: await response.json() };
}
