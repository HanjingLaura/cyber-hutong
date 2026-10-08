import test from 'node:test';
import assert from 'node:assert/strict';
import { launchApp } from '../src/app-launch.mjs';

function fakeEnv({ ua = 'Chrome/130', blockPopup = false } = {}) {
  const listeners = { win: {}, doc: {} };
  const calls = { open: [], assign: [], frames: [] };
  const add = bag => (type, fn) => { (bag[type] ||= new Set()).add(fn); };
  const remove = bag => (type, fn) => { bag[type]?.delete(fn); };
  const fire = (bag, type) => { for (const fn of bag[type] || []) fn(); };
  const win = {
    navigator: { userAgent: ua },
    addEventListener: add(listeners.win), removeEventListener: remove(listeners.win),
    open: url => { calls.open.push(url); return blockPopup ? null : { opener: 1 }; },
    location: { assign: url => calls.assign.push(url) },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 20)),
  };
  const doc = {
    visibilityState: 'visible',
    addEventListener: add(listeners.doc), removeEventListener: remove(listeners.doc),
    createElement: () => { const f = { style: {}, remove() { f.removed = true; } }; return f; },
    body: { append: f => calls.frames.push(f) },
  };
  return { win, doc, calls, blur: () => fire(listeners.win, 'blur'), hide: () => { doc.visibilityState = 'hidden'; fire(listeners.doc, 'visibilitychange'); }, listeners };
}

const app = { scheme: 'codex://threads/new', href: 'https://chatgpt.com/codex/' };

test('no scheme or mobile opens the website directly', async () => {
  const e = fakeEnv();
  assert.equal(await launchApp({ href: 'https://app.ani.cool/' }, { ...e, mobile: false }), 'web');
  assert.equal(await launchApp({ ...app, mobileHref: 'https://m.example/' }, { ...e, mobile: true }), 'web');
  assert.deepEqual(e.calls.open, ['https://app.ani.cool/', 'https://m.example/']);
  assert.deepEqual(e.calls.assign, []);
});

test('scheme opens the app when the page loses focus', async () => {
  const e = fakeEnv();
  const pending = launchApp(app, { ...e, mobile: false });
  assert.deepEqual(e.calls.assign, ['codex://threads/new']);
  e.blur();
  assert.equal(await pending, 'app');
  assert.deepEqual(e.calls.open, []);
  assert.equal(e.listeners.win.blur.size, 0);
});

test('hidden page also counts as opened', async () => {
  const e = fakeEnv();
  const pending = launchApp(app, { ...e, mobile: false });
  e.hide();
  assert.equal(await pending, 'app');
});

test('falls back to the website when nothing happens', async () => {
  const e = fakeEnv();
  assert.equal(await launchApp(app, { ...e, mobile: false }), 'web');
  assert.deepEqual(e.calls.open, ['https://chatgpt.com/codex/']);
  const blocked = fakeEnv({ blockPopup: true });
  assert.equal(await launchApp(app, { ...blocked, mobile: false }), 'blocked');
});

test('firefox tries the scheme in a hidden frame', async () => {
  const e = fakeEnv({ ua: 'Firefox/131' });
  await launchApp(app, { ...e, mobile: false });
  assert.equal(e.calls.assign.length, 0);
  assert.equal(e.calls.frames[0].src, 'codex://threads/new');
  assert.equal(e.calls.frames[0].removed, true);
});

test('safari also uses the hidden frame, chrome on mac does not', async () => {
  const safari = fakeEnv({ ua: 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15' });
  await launchApp(app, { ...safari, mobile: false });
  assert.equal(safari.calls.frames.length, 1);
  const chrome = fakeEnv({ ua: 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130.0 Safari/537.36' });
  await launchApp(app, { ...chrome, mobile: false });
  assert.deepEqual(chrome.calls.assign, ['codex://threads/new']);
  assert.equal(chrome.calls.frames.length, 0);
});
