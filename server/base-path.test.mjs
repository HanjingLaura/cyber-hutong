import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createMvpServer, stripBase } from './app.mjs';

test('base path and proxy trailing slashes map to the same API routes', () => {
  assert.equal(stripBase('/cyber-hutong/api/me/'), '/api/me');
  assert.equal(stripBase('/cyber-hutong/api/events/?client=x'), '/api/events?client=x');
  assert.equal(stripBase('/cyber-hutong'), '/');
  assert.equal(stripBase('/cyber-hutong/moles/'), '/moles/');
  assert.equal(stripBase('/api/login'), '/api/login');
  assert.equal(stripBase('/cyber-hutongx/api/me'), '/cyber-hutongx/api/me');
});

test('API works under /cyber-hutong/ and accepts the allowlisted portfolio origin', async t => {
  const previous = process.env.HUTONG_ALLOWED_HOSTS;
  process.env.HUTONG_ALLOWED_HOSTS = 'hanjing-laura.vercel.app';
  const app = createMvpServer({ dbPath: ':memory:' });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  t.after(() => { app.close(); app.server.closeAllConnections(); if (previous === undefined) delete process.env.HUTONG_ALLOWED_HOSTS; else process.env.HUTONG_ALLOWED_HOSTS = previous; });
  const root = 'http://127.0.0.1:' + app.server.address().port;
  const post = (path, body, origin) => fetch(root + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) });
  const reg = await post('/cyber-hutong/api/register/', { username: 'base_user', password: 'base-password-123', role: 'cora' }, 'https://hanjing-laura.vercel.app');
  assert.equal(reg.status, 200);
  const cookie = reg.headers.get('set-cookie').split(';')[0];
  const me = await (await fetch(root + '/cyber-hutong/api/me/', { headers: { Cookie: cookie } })).json();
  assert.equal(me.user.role, 'cora');
  assert.equal((await post('/cyber-hutong/api/login', { username: 'base_user', password: 'base-password-123' }, 'https://evil.example')).status, 403);
  const abort = new AbortController();
  const events = await fetch(root + '/cyber-hutong/api/events/?client=base', { headers: { Cookie: cookie }, signal: abort.signal });
  assert.equal(events.headers.get('content-type'), 'text/event-stream');
  const reader = events.body.getReader(); let text = '';
  while (!text.includes('event: world')) text += new TextDecoder().decode((await reader.read()).value);
  abort.abort();
});
