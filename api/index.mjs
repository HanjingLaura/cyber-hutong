// Vercel entry: the whole node:http game server runs inside one function.
// Static files (dist/) are served by Vercel's CDN; only /api/* reaches this handler (see vercel.json).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { waitUntil } from '@vercel/functions';
import { createMvpServer, stripBase } from '../server/app.mjs';
import { prepareReplica } from '../server/replica.mjs';
import { createStreamReplicaSync } from '../server/stream-replica.mjs';

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

const app = createMvpServer({ dbPath, staticDir: join(process.cwd(), 'dist'),
  beforeRequest: async req=>{
    if (!replica) return;
    const path=stripBase(req.url||'/').split('?')[0];
    const albumRequest=path==='/api/albums'||path==='/api/album-photo';
    await replica.pull({maxAgeMs:req.method==='POST'?0:req.url?.includes('/presence')?250:0,reconcilePending:!albumRequest});
    if (albumRequest) {
      await replica.syncAuthoritativeTables(['album_photos'], {pendingTables:['album_photo_chunks']});
      if (replica.hasPending(['album_photos','album_photo_chunks'])) throw Object.assign(new Error('相册正在同步，请稍后重试'),{status:503});
    }
  },
  commitRequest:replica?()=>replica.flush({allowTransaction:true}):undefined });
replica?.attach(app.store.db);

// End SSE streams before the function's maxDuration so EventSource reconnects cleanly.
const sseMs = Number(process.env.HUTONG_SSE_MAX_MS || 240000);
const watchReplicaStreams = replica ? createStreamReplicaSync(replica) : null;

export default async function handler(req, res) {
  req.url = stripBase(req.url || '/');
  const path = req.url.split('?')[0];
  const done = new Promise(resolve => { res.once('finish', resolve); res.once('close', resolve); });
  if (path === '/api/events') {
    const release = watchReplicaStreams?.();
    if (release) void done.then(release);
    const timer = setTimeout(() => { if (!res.writableEnded) res.end(); }, sseMs);
    res.once('close', () => clearTimeout(timer));
  }
  app.server.emit('request', req, res);
  if (replica) waitUntil(done.then(() => replica.flush()).catch(e => console.error('replica flush failed: ' + e.message)));
  await done;
}
