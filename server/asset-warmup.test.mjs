import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import {createTexturePrefetcher} from '../src/texture-prefetch.mjs';
const source = readFileSync(new URL('../src/asset-warmup.ts', import.meta.url), 'utf8').replaceAll('import.meta.url', '"http://localhost/src/asset-warmup.ts"');
function fixture(connection = {}) {
  const images = [], exports = {},timers=new Map();let timerId=0;
  const cache=new Map(),game={textures:{exists:key=>cache.has(key),addImage:(key,image)=>cache.set(key,image)},events:{once(){}}};
  class Image { constructor() { images.push(this); } removeAttribute(name){if(name==='src')this.src='';} }
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Image, URL, navigator: { connection }, window: {}, requestAnimationFrame:callback=>callback(),setTimeout: callback => {timers.set(++timerId,callback);return timerId;}, clearTimeout: id => timers.delete(id), require: () => ({createTexturePrefetcher}) });
  return { images, timers, cache, warm:room=>exports.warmRoom(room,game) };
}
test('selected-room prefetch bounds concurrent downloads and deduplicates repeats', () => {
  const f = fixture(); f.warm('pop'); f.warm('pop');
  assert.ok(f.images.length <= 2, 'at most two images downloading');
  const first = f.images[0].src; f.images[0].onload?.();
  assert.equal(f.images.filter(i => i.src === first).length, 1);
});
test('optional room prefetch respects data saver and slow networks', () => {
  for (const connection of [{ saveData: true }, { effectiveType: '2g' }]) {
    const f = fixture(connection); f.warm('pop'); assert.equal(f.images.length, 0);
  }
});
test('prefetch timeout cancels stalled sources before advancing the queue',()=>{
 const f=fixture({effectiveType:'3g'});f.warm('pop');
 const first=f.images.slice();for(const callback of [...f.timers.values()])callback();
 assert.ok(first.every(image=>image.src===''));
 assert.ok(f.images.filter(image=>image.src).length<=2);
});
test('destination warmup does not queue unrelated office textures',()=>{
 const f=fixture();f.warm('ktv');assert.equal(f.images.length,1);assert.match(f.images[0].src,/ktv-room/);
});
