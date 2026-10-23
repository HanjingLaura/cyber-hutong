import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {sceneWalkable} from '../shared/walkability.mjs';
const source=readFileSync('src/memory-places.ts','utf8');
const method=source.slice(source.indexOf(' private walkable('),source.indexOf(' private seats('));
const C=new Function('sceneWalkable',ts.transpileModule(`class Scene{${method}} return Scene;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(sceneWalkable);
test('campus client and authoritative walking share the same cone boundaries',()=>{
 for(const x of [210,410]){
  const s=Object.assign(new C(),{place:'campus',x,y:265});
  assert.equal(s.walkable(x+1,265),false);
  s.x=x+5;assert.equal(s.walkable(x+4,265),false);assert.equal(s.walkable(x+6,265),false);
  s.x=x+13;assert.equal(s.walkable(x+11,265),false);
  assert.equal(s.walkable(x+13,265),true);
 }
});
