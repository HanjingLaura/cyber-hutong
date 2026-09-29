import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { buildPrompt, cleanReply, memberById, planAutoSpeakers, speakInOrder, threadId } from './chat.mjs';
import { roster } from '../../examples/mvp-behavior/config.mjs';
import { createDirector } from './director.mjs';
import { createWorld } from './world.mjs';
import { createWorldRuntime } from './world-runtime.mjs';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
};

export function createApp({ store, complete, maxTurns = 4, llm, clientDir, loginBackground, basePath = '', characterDir, sceneFile, sceneFiles = {}, npcDir }) {
  const clients = new Map();
  const tails = new Map();
  const generations = new Map();
  const rates = new Map();
  const authRates = new Map();
  const controls = new Map();
  const tabs = new Map();
  const invalidate = id => controls.set(id, (controls.get(id) ?? 0) + 1);
  const world = createWorld({
    loadPlaces: () => store.loadPlaces(),
    savePlaces: (rows) => store.savePlaces(rows),
  });
  const worldTimer = setInterval(() => {
    if (world.tick(Date.now())) publishWorld();
  }, 50);
  const repository = store.worldRepository();
  let director;
  createWorldRuntime(repository).then((runtime) => {
    director = createDirector({
      world,
      runtime,
      repository,
      manualIds: () => new Set(roster.filter((person) => store.controlMode(person.id) === 'manual').map((person) => person.id)),
    });
  }).catch(() => {});
  const behaviorTimer = setInterval(() => {
    director?.step(Date.now()).then(async (result) => {
      const visit = await director.visit(Date.now());
      for (const notice of [...(result?.notices ?? []), ...(visit?.notices ?? [])]) {
        if (notice.type === 'say') {
          for (const memberId of clients.keys()) publish(memberId, { type: 'say', notice });
        } else publish(notice.actor, { type: 'invite', notice });
      }
      publishWorld();
    }).catch(() => {});
  }, 2000);
  function authLimit(req) {
    const now = Date.now(), key = req.socket.remoteAddress || 'unknown';
    for (const [ip, entry] of authRates) if (now - entry.start > 60000) authRates.delete(ip);
    const entry = authRates.get(key) ?? { start: now, count: 0 };
    authRates.set(key, entry);
    if (++entry.count > 15) throw Object.assign(new Error('尝试次数太多，请一分钟后再试'), { status: 429 });
  }

  function publish(memberId, event) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of clients.get(memberId) ?? []) client.res.write(data);
  }

  function publishWorld() {
    const actors = world.view();
    for (const memberId of clients.keys()) publish(memberId, { type: 'world', actors });
  }

  function publishPresence() {
    for (const memberId of clients.keys()) {
      publish(memberId, { type: 'presence', characters: store.listCharacters(memberId) });
    }
  }

  function enqueue(thread, job) {
    const previous = tails.get(thread) ?? Promise.resolve();
    const run = previous.catch(() => {}).then(job);
    tails.set(thread, run);
    return run;
  }

  function rateLimit(memberId) {
    const now = Date.now();
    const hits = (rates.get(memberId) ?? []).filter((time) => now - time < 60000);
    if (hits.length >= 20) throw Object.assign(new Error('说得太频繁了，等一会儿'), { status: 429 });
    hits.push(now);
    rates.set(memberId, hits);
  }

  function produce({ viewer, peerId, trigger, humanBody }) {
    const thread = threadId(viewer.id, peerId);
    const generation = (generations.get(thread) ?? 0) + 1;
    generations.set(thread, generation);
    if (humanBody) { invalidate(viewer.id); store.setMode(viewer.id, 'manual'); }
    return enqueue(thread, async () => {
      const produced = [];
      const publishMessage = message => {
        produced.push(message);
        publish(viewer.id, { type: 'message', peerId, message });
        publish(peerId, { type: 'message', peerId: viewer.id, message });
      };
      if (humanBody) {
        publishMessage(store.addMessage({ thread, senderId: viewer.id, body: humanBody, source: 'human' }));
      }
      const stale = () => generations.get(thread) !== generation;
      if (!stale()) {
        const speakers = planAutoSpeakers({
          selfId: viewer.id,
          peerId,
          selfManual: store.effectiveManual(viewer.id),
          peerManual: store.effectiveManual(peerId),
          trigger,
          maxTurns,
        });
        if (trigger === 'opener' && !speakers.length) {
          throw Object.assign(new Error('对方正在本人操作，不能代为开口'), { status: 409 });
        }
        var llmError = null;
        try {
          await speakInOrder({
            speakers,
            isManual: (id) => store.effectiveManual(id),
            shouldStop: stale,
            say: async (speakerId) => {
              const version = controls.get(speakerId) ?? 0;
              const speaker = memberById(speakerId);
              const peer = memberById(speakerId === viewer.id ? peerId : viewer.id);
              const prompt = buildPrompt({ speaker, peer, history: store.recent(thread, 12) });
              const text = cleanReply(await complete(prompt), speaker.name);
              if (stale() || store.effectiveManual(speakerId) || version !== (controls.get(speakerId) ?? 0)) return text;
              publishMessage(store.addMessage({ thread, senderId: speakerId, body: text, source: 'llm' }));
              return text;
            },
          });
        } catch (error) {
          llmError = clientLlmError(error);
        }
      }
      publishPresence();
      return { messages: produced, llmError: llmError ?? null };
    });
  }

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/login-background.png') {
        return sendFile(res, loginBackground);
      }
      if (req.method === 'GET' && url.pathname === '/') return sendHtml(res, join(clientDir, 'index.html'), basePath);
      if (req.method === 'GET' && ['/app.js', '/style.css', '/portraits.js', '/stage.js'].includes(url.pathname)) return sendFile(res, join(clientDir, url.pathname.slice(1)));
      if (req.method === 'GET' && url.pathname === '/scenes/hutong.png') return sendFile(res, sceneFiles[url.pathname] || sceneFile);
      if (req.method === 'GET' && sceneFiles[url.pathname]) return sendFile(res, sceneFiles[url.pathname]);
      if (req.method === 'GET' && url.pathname === '/shared/hutong.mjs') return sendFile(res, join(clientDir, '..', 'shared', 'hutong.mjs'));
      if (req.method === 'GET' && url.pathname === '/shared/scenes.mjs') return sendFile(res, join(clientDir, '..', 'shared', 'scenes.mjs'));
      if (req.method === 'GET' && url.pathname === '/shared/geometry.mjs') return sendFile(res, join(clientDir, '..', 'shared', 'geometry.mjs'));
      if (req.method === 'GET' && url.pathname === '/shared/motion.mjs') return sendFile(res, join(clientDir, '..', 'shared', 'motion.mjs'));
      if (req.method === 'GET' && url.pathname === '/shared/sprite-key.mjs') return sendFile(res, join(clientDir, '..', 'shared', 'sprite-key.mjs'));
      if (req.method === 'GET' && /^\/characters\/f0[1-8]\.png$/.test(url.pathname) && characterDir) return sendFile(res, join(characterDir, url.pathname.split('/').at(-1)));
      if (req.method === 'GET' && npcDir && /^\/npcs\/[a-z0-9-]+\.png$/.test(url.pathname)) return sendFile(res, join(npcDir, url.pathname.split('/').at(-1)));
      if (req.method === 'GET' && /^\/props\/prop-black-office-chair(-back)?-green-512\.png$/.test(url.pathname)) return sendFile(res, join(clientDir, '..', '..', 'assets', 'props', url.pathname.split('/').at(-1)));
      if (req.method === 'GET' && url.pathname === '/api/events') return openEvents(req, res);
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      send(res, 404, { error: '没有这个页面' });
    } catch (error) {
      send(res, error.status || 500, {
        error: error.status ? error.message : '服务暂时不可用',
        ...(error.code ? { code: error.code } : {}),
      });
    }
  });
  server.on('close', () => { clearInterval(worldTimer); clearInterval(behaviorTimer); world.flush(); });
  return server;

  async function api(req, res, url) {
    if (req.method === 'POST') assertOrigin(req);
    if (req.method === 'POST' && url.pathname.startsWith('/api/auth/') && url.pathname !== '/api/auth/logout') authLimit(req);
    if (req.method === 'POST' && url.pathname === '/api/auth/forgot-password') {
      await readBody(req);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/reset-password') {
      const id = store.resetPassword(await readBody(req));
      invalidate(id);
      for (const client of clients.get(id) ?? []) client.res.end();
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/register') {
      const body = await readBody(req);
      const session = store.register(body);
      return send(res, 201, { member: session.member }, { 'Set-Cookie': cookie(session.token, 604800, req, basePath) });
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const body = await readBody(req);
      const session = store.login(body);
      invalidate(session.member.id);
      return send(res, 200, { member: session.member }, { 'Set-Cookie': cookie(session.token, 604800, req, basePath) });
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
      const token = readCookie(req), member = store.session(token);
      store.logout(readCookie(req));
      for (const client of clients.get(member?.id) ?? []) if (client.token === token) client.res.end();
      return send(res, 200, { ok: true }, { 'Set-Cookie': cookie('', 0, req, basePath) });
    }
    const viewer = store.session(readCookie(req));
    if (!viewer) return send(res, 401, { error: '请先登录' });
    store.touch(viewer.id);

    if (req.method === 'POST' && url.pathname === '/api/world/respond') {
      if (!director) return send(res, 503, { error: '世界还在准备' });
      const body = await readBody(req);
      const result = await director.respond(viewer.id, String(body.eventId ?? ''), Boolean(body.accept));
      for (const notice of result?.notices ?? []) {
        if (notice.type === 'say') {
          for (const memberId of clients.keys()) publish(memberId, { type: 'say', notice });
        } else publish(notice.actor, { type: 'invite', notice });
      }
      publishWorld();
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/world/join') {
      const body = await readBody(req);
      const joined = world.join(viewer.id, String(body.tabId ?? ''), Date.now());
      if (joined.control) tabs.set(viewer.id, String(body.tabId));
      return send(res, 200, joined);
    }
    if (req.method === 'POST' && url.pathname === '/api/world/intent') {
      const body = await readBody(req);
      const manual = store.describe(viewer.id).control === 'human';
      const result = world.intent(viewer.id, body, Date.now(), manual);
      if (!result.duplicate) publishWorld();
      return send(res, 200, result);
    }
    if (req.method === 'GET' && url.pathname === '/api/world') {
      return send(res, 200, { actors: world.view() });
    }
    if (req.method === 'GET' && url.pathname === '/api/me') {
      return send(res, 200, {
        member: { ...viewer, ...store.describe(viewer.id) },
        characters: store.listCharacters(viewer.id),
        llm,
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/me/heartbeat') {
      publishPresence();
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/me/mode') {
      const body = await readBody(req);
      store.setMode(viewer.id, body.mode);
      invalidate(viewer.id);
      publishPresence();
      return send(res, 200, { member: { ...viewer, ...store.describe(viewer.id) } });
    }
    const chat = url.pathname.match(/^\/api\/chats\/([a-z]+)(?:\/(messages|auto))?$/);
    if (!chat) return send(res, 404, { error: '没有这个接口' });
    const peerId = chat[1];
    const action = chat[2] ?? 'messages';
    threadId(viewer.id, peerId);
    if (req.method === 'GET' && action === 'messages') {
      return send(res, 200, { messages: store.messages(threadId(viewer.id, peerId)) });
    }
    if (req.method === 'POST' && action === 'messages') {
      rateLimit(viewer.id);
      const body = await readBody(req);
      const text = String(body.text ?? '').trim().replace(/\s+/g, ' ');
      if (!text || text.length > 200) return send(res, 400, { error: '一句话请写在 200 字以内' });
      const result = await produce({ viewer, peerId, trigger: 'human', humanBody: text });
      return send(res, 200, result);
    }
    if (req.method === 'POST' && action === 'auto') {
      rateLimit(viewer.id);
      const result = await produce({ viewer, peerId, trigger: 'opener' });
      return send(res, 200, result);
    }
    return send(res, 404, { error: '没有这个接口' });
  }

  function openEvents(req, res) {
    const viewer = store.session(readCookie(req));
    if (!viewer) return send(res, 401, { error: '请先登录' });
    store.touch(viewer.id);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 2000\n\n');
    const client = { res, token: readCookie(req) };
    const group = clients.get(viewer.id) ?? new Set();
    group.add(client);
    clients.set(viewer.id, group);
    const beat = setInterval(() => {
      if (!store.session(client.token)) return res.end();
      res.write(': ping\n\n');
    }, 10000);
    req.on('close', () => {
      clearInterval(beat);
      group.delete(client);
      if (!group.size) {
        clients.delete(viewer.id);
        const tabId = tabs.get(viewer.id);
        if (tabId) world.release(viewer.id, tabId, Date.now());
      }
    });
  }
}

function clientLlmError(error) {
  return '对方暂时无法自动回复，请稍后再试。';
}

function assertOrigin(req) {
  if (!req.headers.origin) return;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  let origin;
  try { origin = new URL(req.headers.origin); } catch { throw Object.assign(new Error('请求来源不正确'), { status: 403 }); }
  const allowed = new Set([host, ...String(process.env.HUTONG_ALLOWED_HOSTS || '').split(',').map((item) => item.trim()).filter(Boolean)]);
  if (!['http:', 'https:'].includes(origin.protocol) || !allowed.has(origin.host)) {
    throw Object.assign(new Error('请求来源不正确'), { status: 403 });
  }
}

function readCookie(req) {
  const pairs = Object.fromEntries(String(req.headers.cookie ?? '').split(';').map((part) => {
    const index = part.indexOf('=');
    return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter((pair) => pair[0]));
  return pairs.hutong ?? '';
}

function cookie(token, maxAge, req, basePath = '') {
  const secure = req?.headers?.['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  const path = basePath && basePath !== '/' ? basePath : '/';
  return `hutong=${token}; HttpOnly; SameSite=Lax; Path=${path}; Max-Age=${maxAge}${secure}`;
}

function sendHtml(res, file, basePath) {
  if (!existsSync(file)) return send(res, 404, { error: '没有这个文件' });
  const html = readFileSync(file, 'utf8').replaceAll('__BASE__', basePath || '');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}

async function readBody(req) {
  const body = await rawBody(req);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('请求格式不正确'), { status: 400 });
  if (Buffer.byteLength(JSON.stringify(body)) > 8192) throw Object.assign(new Error('请求太大'), { status: 413 });
  return body;
}

function rawBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try { return Promise.resolve(req.body ? JSON.parse(req.body) : {}); }
    catch { return Promise.reject(Object.assign(new Error('请求格式不正确'), { status: 400 })); }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 8192) {
        reject(Object.assign(new Error('请求太大'), { status: 413 }));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(new Error('请求格式不正确'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body, headers = {}) {
  if (res.writableEnded || res.destroyed) return;
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(json),
    ...headers,
  });
  res.end(json);
}

function sendFile(res, file) {
  if (!file) return send(res, 404, { error: '没有这个文件' });
  const safe = normalize(file);
  if (!existsSync(safe)) return send(res, 404, { error: '没有这个文件' });
  res.writeHead(200, { 'Content-Type': types[extname(safe)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(safe).pipe(res);
}
