import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const before=JSON.parse(readFileSync(new URL('../scripts/fixtures/character-library-before.json',import.meta.url)));
test('formal manifests preserve every selectable pose, loop order, anchor and source pixel',()=>{
 const sources=new Set();
 for(const [role,old]of Object.entries(before.members)){
  const path=resolve('assets/characters',role,'manifest.json');assert.ok(existsSync(path),`${role} needs a formal manifest`);
  const manifest=JSON.parse(readFileSync(path)),member=manifest.member;
  assert.equal(manifest.role,role);assert.equal(manifest.worldHeight,before.worldHeight);assert.equal(manifest.seatedHeight,before.seatedHeight);
  for(let index=0;index<64;index++)assert.deepEqual(member.frames[index],old.frames[index],`${role} pose ${index}`);
  for(const property of ['sideWalkLoop','runLoop'])assert.deepEqual(member[property].map(i=>member.frames[i]),old[property].map(i=>old.frames[i]),`${role} ${property}`);
  for(const property of ['carryFrontLoop','carryBackLoop','carryRightLoop'])assert.deepEqual(member[property].map(i=>member.carryFrames[i]),old[property].map(i=>old.carryFrames[i]),`${role} ${property}`);
  for(const property of ['officeFrames','podiumFrames','sideWalkFrameMs','runFrameMs','carrySideFrameMs','officeFrameMs','podiumFrameMs','officeAction','approvedLegacy','seat'])assert.deepEqual(member[property],old[property],`${role} ${property}`);
  for(const frame of [...member.frames,...member.carryFrames,...member.officeFrames,...(member.podiumFrames??[])]){
   const source=manifest.sources[frame.source];assert.ok(source,`${role} source ${frame.source}`);sources.add(frame.source);
   const bytes=readFileSync(resolve('assets/characters',source.file));
   assert.equal(createHash('sha256').update(bytes).digest('hex'),before.sources[frame.source].sha256);
   assert.deepEqual(source.size,before.sources[frame.source].size);
  }
 }
 assert.equal(sources.size,55,'superseded appended motion sheets must not preload');
});

test('runtime preloads only sources from formal manifests and rejects superseded sheets',async()=>{
 const exports={},loaded=[];let source=readFileSync(new URL('../src/character-assets.ts',import.meta.url),'utf8');
 const files={};for(const role of Object.keys(before.members)){
  const manifest=JSON.parse(readFileSync(resolve('assets/characters',role,'manifest.json')));
  for(const item of Object.values(manifest.sources))files['../assets/characters/'+item.file]=item.file;
 }
 source=source.replace(/import\.meta\.glob\([^\n]+\) as Record<string,string>/,JSON.stringify(files));
 class Image{set src(value){loaded.push(value);}decode(){return Promise.resolve();}}
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Image,require:path=>({default:JSON.parse(readFileSync(resolve('src',path),'utf8'))})});
 for(const role of Object.keys(before.members))await exports.preloadCharacter(role);
 const mobility=Object.keys(before.members).length;
 assert.equal(new Set(loaded).size,55+mobility);assert.equal(Object.keys(exports.characterRegistry.sources).length,55+mobility);
 assert.ok(loaded.every(file=>!file.includes('/v')));
 assert.throws(()=>exports.characterSource('laura-motion-v5'),/素材缺失/);
});

test('moles retains its exact visible avatar crops and image pixels through the formal library',()=>{
 const metadata=JSON.parse(readFileSync(resolve('assets/characters/moles.json')));
 for(const [role,old]of Object.entries(before.moles)){
  const current=metadata.members[role];assert.deepEqual(current.frames,old.frames);
  assert.equal(createHash('sha256').update(readFileSync(resolve('assets/characters',current.file))).digest('hex'),old.sha256);
 }
});
