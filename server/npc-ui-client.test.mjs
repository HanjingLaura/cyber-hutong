import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import rules from '../shared/npcs.json' with { type: 'json' };
import positions from '../shared/guests.json' with { type: 'json' };
const source = ts.transpileModule(readFileSync(new URL('../src/multiplayer/npc-ui.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const settled = () => new Promise(r => setImmediate(r));

function fixture(publish = async () => {}) {
  const listeners = new Map(), writes = [], pending = [], notices = [];
  let destroy;
  const rect = () => ({ left: 0, top: 0, width: 640, height: 360 });
  const button = { remove() {} }, speech = {}, world = { append() {}, getBoundingClientRect: rect };
  const root = { querySelector: name => name === '#npc-interact' ? button : speech, remove() {} };
  const exports = {}, bridge = { user: { id: 'account', role: 'cora' }, controller: true, connected: true, state: () => null,
    game: { canvas: { getBoundingClientRect: rect }, events: { once(_event, callback) { destroy = callback; } } } };
  runInNewContext(source, {
    exports, setInterval: () => 1, clearInterval() {},
    window: { addEventListener(name, callback) { listeners.set(name, callback); }, removeEventListener(name) { listeners.delete(name); } },
    document: { createElement: () => root, querySelector: name => name === '.world' ? world : null },
    require(name) {
      if (name.endsWith('npcs.json')) return { default: rules };
      if (name.endsWith('guests.json')) return { default: positions };
      if (name.endsWith('/hud')) return { dockPrompt() {} };
      if (name.endsWith('/npc-feedback')) return { receiveNpcFeedback(list) { writes.push(...list); }, clearNpcFeedback() {}, npcFeedback: () => null };
      throw Error(name);
    },
  });
  const ui = exports.setupNPCUI(bridge, () => { const d = deferred(); pending.push(d); return d.promise; }, publish, 'client', message => notices.push(message));
  return { ui, bridge, pending, writes, notices, destroy: () => destroy(), click: () => listeners.get('hutong:npc-interact')({ detail: 'buzz' }) };
}

test('reset during presence confirmation prevents the old NPC action', async () => {
  const publish = deferred(), f = fixture(() => publish.promise);
  f.click(); f.ui.reset(); publish.resolve(); await settled();
  assert.equal(f.pending.length, 0); assert.equal(f.writes.length, 0); f.destroy();
});

for (const finish of ['reset', 'destroy']) test(`late NPC acknowledgments are ignored after ${finish}`, async () => {
  const f = fixture(); f.click(); await settled(); assert.equal(f.pending.length, 1);
  finish === 'reset' ? f.ui.reset() : f.destroy();
  f.pending[0].resolve({ reaction: { id: 'old', npc: 'buzz' } }); await settled();
  assert.equal(f.writes.length, 0); assert.deepEqual(f.notices, []);
  if (finish === 'reset') f.destroy();
});

test('an old acknowledgment cannot unlock a new in-flight interaction', async () => {
  const f = fixture(); f.click(); await settled(); f.ui.reset(); f.click(); await settled();
  assert.equal(f.pending.length, 2);
  f.pending[0].resolve({ reaction: { id: 'old', npc: 'buzz' } }); await settled(); f.click(); await settled();
  assert.equal(f.pending.length, 2, 'new request is still busy');
  f.pending[1].resolve({ reaction: { id: 'new', npc: 'buzz' } }); await settled();
  assert.equal(f.writes.length, 1); assert.equal(f.writes[0].id, 'new'); f.destroy();
});
