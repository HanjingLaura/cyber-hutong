import test from 'node:test';
import assert from 'node:assert/strict';
const {createTexturePrefetcher}=await import('../src/texture-prefetch.mjs').catch(()=>({}));
function fixture(connection={}){
 assert.equal(typeof createTexturePrefetcher,'function');
 const images=[],cache=new Map(),timers=new Map();let next=0;
 class Image{constructor(){images.push(this);}decode(){return Promise.resolve();}removeAttribute(){this.src='';}}
 const textures={exists:key=>cache.has(key),addImage:(key,image)=>cache.set(key,image)};
 const loader=createTexturePrefetcher({textures,makeImage:()=>new Image(),connection:()=>connection,defer:async()=>{},setTimer:fn=>{timers.set(++next,fn);return next;},clearTimer:id=>timers.delete(id)});
 return {images,cache,timers,loader};
}
const entries=[{key:'room',url:'/room.webp'},{key:'props',url:'/props.webp'},{key:'cached',url:'/cached.webp'}];
const tick=()=>new Promise(r=>setImmediate(r));
test('selected room skips textures already in Phaser and reuses one decoded image per asset',async()=>{
 const f=fixture();f.cache.set('cached',{});
 const first=f.loader.load(entries),second=f.loader.load(entries);assert.equal(f.images.length,2);
 for(const image of f.images)image.onload();await Promise.all([first,second]);
 assert.equal(f.cache.get('room'),f.images[0]);assert.equal(f.cache.get('props'),f.images[1]);
 await f.loader.load(entries);assert.equal(f.images.length,2);
});
test('explicit entry can load on data saver without unsolicited prefetch',async()=>{
 const f=fixture({saveData:true});await f.loader.load(entries.slice(0,1));assert.equal(f.images.length,0);
 const entered=f.loader.load(entries.slice(0,1),{required:true});assert.equal(f.images.length,1);
 f.images[0].onload();await entered;assert.ok(f.cache.has('room'));
});
test('entry pins shared optional downloads only until that attempt finishes',async()=>{
 const f=fixture();const optional=f.loader.load(entries.slice(0,2)).catch(()=>{});
 const required=f.loader.load(entries.slice(0,2),{required:true});assert.equal(f.images.length,2);
 f.images[0].onerror();await assert.rejects(required);await optional;
 assert.equal(f.images[1].src,'','failed entry cancels unneeded sibling immediately');
 const retry=f.loader.load([{key:'new',url:'/new.webp'}],{required:true});
 assert.equal(f.images.at(-1).src,'/new.webp');f.images.at(-1).onload();await retry;
});
test('another entry consumer keeps its image pinned when the first attempt fails',async()=>{
 const f=fixture(),first=f.loader.load(entries.slice(0,2),{required:true});
 const shared=f.loader.load(entries.slice(1,2),{required:true});
 f.images[0].onerror();await assert.rejects(first);assert.equal(f.images[1].src,'/props.webp');
 f.images[1].onload();await shared;
});
test('failed position confirmation can abort destination preparation and release both image slots',async()=>{
 const f=fixture(),controller=new AbortController();const cancelled=f.loader.load(entries,{required:true,signal:controller.signal});
 controller.abort();await assert.rejects(cancelled);assert.ok(f.images.every(image=>!image.src));
 const next=f.loader.load([{key:'next',url:'/next.webp'}],{required:true});assert.equal(f.images.at(-1).src,'/next.webp');f.images.at(-1).onload();await next;
});
test('prefetch failure cancels source and permits retry without caching corrupt textures',async()=>{
 const f=fixture();const failed=f.loader.load(entries.slice(0,1),{required:true});
 f.images[0].onerror();await assert.rejects(failed);assert.equal(f.cache.has('room'),false);
 const retry=f.loader.load(entries.slice(0,1),{required:true});f.images[1].onload();await retry;
 assert.equal(f.images.length,2);
});
test('two-image bound includes decoding and newer destination discards stale optional queue',async()=>{
 const f=fixture();const old=f.loader.load(entries).catch(()=>{});
 const next=f.loader.load([{key:'new',url:'/new.webp'}]);
 assert.equal(f.images.filter(i=>i.src).length,1,'cancel irrelevant optional images first');
 assert.ok(f.images.slice(0,2).every(i=>!i.src));
 f.images.at(-1).onload();await next;await old;
});
test('required assets are pinned during entry and timeout never adds a late texture',async()=>{
 const f=fixture();const load=f.loader.load(entries.slice(0,1),{required:true});
 const late=f.images[0].onload;[...f.timers.values()][0]();await assert.rejects(load);
 late();await tick();assert.equal(f.cache.has('room'),false);
});
