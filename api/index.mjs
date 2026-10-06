// Vercel entry: the whole node:http game server runs inside one function.
// Static files (dist/) are served by Vercel's CDN; only /api/* reaches this handler (see vercel.json).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { waitUntil } from '@vercel/functions';
import { createMvpServer, stripBase } from '../server/app.mjs';
import { prepareReplica } from '../server/replica.mjs';

const dataDir = process.env.VERCEL ? '/tmp/hutong-online' : join(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });
const dbPath = join(dataDir, 'mvp.sqlite');

let replica = null;
const url = process.env.TURSO_DATABASE_URL?.trim();
if (url) {
  const { createClient } = await import('@libsql/client');
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN?.trim() });
  replica = await prepareReplica(dbPath, client, { prefix: process.env.HUTONG_TURSO_PREFIX || 'hutong_online' });
} else {
  console.warn('TURSO_DATABASE_URL missing: using ephemeral local SQLite (data is lost when the instance stops).');
}

const app = createMvpServer({ dbPath, staticDir: join(process.cwd(), 'dist') });
replica?.attach(app.store.db);

// End SSE streams before the function's maxDuration so EventSource reconnects cleanly.
const sseMs = Number(process.env.HUTONG_SSE_MAX_MS || 240000);
const fresh = /\/api\/(me|login|register|events|claim|logout|inventory|control|presence)$/;

export default async function handler(req, res) {
  req.url = stripBase(req.url || '/');
  const path = req.url.split('?')[0];
  if (replica) {
    try { await replica.pull({ maxAgeMs: fresh.test(path) ? 0 : 2000 }); } catch (e) { console.error('replica pull failed: ' + e.message); }
  }
  const done = new Promise(resolve => { res.once('finish', resolve); res.once('close', resolve); });
  if (path === '/api/events') {
    const timer = setTimeout(() => { if (!res.writableEnded) res.end(); }, sseMs);
    res.once('close', () => clearTimeout(timer));
  }
  app.server.emit('request', req, res);
  if (replica) waitUntil(done.then(() => replica.flush()).catch(e => console.error('replica flush failed: ' + e.message)));
  await done;
}
