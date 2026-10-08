import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../src/npc-feedback.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture() {
  let wall = 100000, monotonic = 0, reduced = false;
  const exports = {};
  runInNewContext(source, { exports, Date: { now: () => wall }, performance: { now: () => monotonic }, window: { matchMedia: () => ({ matches: reduced }) } });
  return { api: exports, advance(ms) { wall += ms; monotonic += ms; }, wallJump(ms) { wall += ms; }, reduce() { reduced = true; } };
}
const reaction = (npc = 'buzz', started = 100000) => ({ id: npc + ':' + started, npc, scene: 'pop', x: 430, y: 253, text: '反馈', started, expires: started + 5000 });

test('a delayed HTTP acknowledgment cannot rewind time or replay an expired reaction', () => {
  const f = fixture(), r = reaction();
  f.api.receiveNpcFeedback([r], 100000); f.advance(4000);
  f.api.receiveNpcFeedback([], 104000); assert.equal(f.api.npcFeedback('buzz').elapsed, 4000);
  f.advance(2000); f.api.receiveNpcFeedback([], 106000); assert.equal(f.api.npcFeedback('buzz'), null);
  f.api.receiveNpcFeedback([r], 100000); assert.equal(f.api.npcFeedback('buzz'), null);
  f.wallJump(-100000); assert.equal(f.api.npcFeedback('buzz'), null, 'local wall-clock changes do not replay feedback');
});

test('older updates cannot replace the newest NPC reaction; logout clears the marker', () => {
  const f = fixture(), old = reaction(), next = reaction('buzz', 103000);
  f.api.receiveNpcFeedback([next], 103500); f.api.receiveNpcFeedback([old], 100000);
  assert.equal(f.api.npcFeedback('buzz').reaction.id, next.id);
  f.api.clearNpcFeedback(); assert.equal(f.api.npcFeedback('buzz'), null);
  f.api.receiveNpcFeedback([old], 100000); assert.equal(f.api.npcFeedback('buzz').reaction.id, old.id);
});

test('all six sprites animate briefly and reduced motion keeps their base pose', () => {
  const f = fixture(), ids = ['ani', 'lulu', 'tutu', 'buzz', 'zhu', 'ferret'];
  f.api.receiveNpcFeedback(ids.map(id => reaction(id)), 100000); f.advance(500);
  for (const id of ids) { const p = f.api.npcPose(id); assert.ok(Math.abs(p.x) + Math.abs(p.y) + Math.abs(p.angle) > .1, id); }
  f.reduce(); for (const id of ids) { const p = f.api.npcPose(id); assert.equal(p.x + p.y + p.angle, 0); }
  f.advance(5000); for (const id of ids) assert.equal(f.api.npcFeedback(id), null);
});
