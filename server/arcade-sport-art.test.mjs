import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function fixture(){
 let now=1000;const created=[];
 class FakeImage{naturalWidth=0;onload;onerror;set src(v){this.url=v;created.push(this);}}
 const exports={};const source=ts.transpileModule(readFileSync(new URL('../src/arcade-sport-art.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:name=>({default:name}),Image:FakeImage,Date:{now:()=>now}});
 const draws=[],ctx={drawImage:(...args)=>draws.push(args),imageSmoothingEnabled:true};return {art:exports,created,ctx,draws,tick:n=>now+=n};
}
test('sport art caches loading only and draws after successful load at the declared logical size',()=>{const f=fixture();assert.equal(f.art.drawSportArt(f.ctx,'basketball',10.4,12.6),false);assert.equal(f.created.length,1);assert.equal(f.art.drawSportArt(f.ctx,'basketball',10,13),false);assert.equal(f.created.length,1);f.created[0].naturalWidth=26;f.created[0].onload();assert.equal(f.art.drawSportArt(f.ctx,'basketball',10.4,12.6),true);assert.deepEqual(f.draws[0].slice(1),[10,13,26,26]);assert.equal(f.ctx.imageSmoothingEnabled,false);});
test('failed sport raster retries after cooldown and never caches a blank success',()=>{const f=fixture();f.art.drawSportArt(f.ctx,'hockeyTable',0,0);f.created[0].onerror();f.tick(1999);assert.equal(f.art.drawSportArt(f.ctx,'hockeyTable',0,0),false);assert.equal(f.created.length,1);f.tick(1);assert.equal(f.art.drawSportArt(f.ctx,'hockeyTable',0,0),false);assert.equal(f.created.length,2);f.created[1].naturalWidth=640;f.created[1].onload();assert.equal(f.art.drawSportArt(f.ctx,'hockeyTable',0,0),true);assert.deepEqual(f.draws[0].slice(1),[0,0,640,420]);});
test('empty decoded sport image remains unavailable and becomes retryable',()=>{const f=fixture();f.art.drawSportArt(f.ctx,'puck',0,0);f.created[0].onload();assert.equal(f.art.drawSportArt(f.ctx,'puck',0,0),false);f.tick(2000);f.art.drawSportArt(f.ctx,'puck',0,0);assert.equal(f.created.length,2);assert.equal(f.draws.length,0);});
