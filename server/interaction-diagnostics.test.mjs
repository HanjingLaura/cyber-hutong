import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {runInNewContext} from 'node:vm';

test('interaction diagnostics are bounded and discard chat, keys and arbitrary payloads',()=>{
 const exports={};
 const source=readFileSync(new URL('../src/interaction-diagnostics.ts',import.meta.url),'utf8');
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date});
 for(let n=0;n<400;n++)exports.traceInteraction('request',{path:'object',action:'take',body:'private chat',key:'secret',at:n});
 const rows=exports.interactionDiagnostics();
 assert.equal(rows.length,256);assert.equal(rows.at(-1).path,'object');
 assert.ok(!JSON.stringify(rows).includes('private chat'));assert.ok(!JSON.stringify(rows).includes('secret'));
 rows.length=0;assert.equal(exports.interactionDiagnostics().length,256);
});
