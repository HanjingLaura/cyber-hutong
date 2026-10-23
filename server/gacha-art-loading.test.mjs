import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

test('optional prize art retries after failure and never caches a blank prize',async()=>{
 let image,requests=0,draws=0;
 class ImageFixture{constructor(){image=this;}set src(value){requests++;}}
 const document={createElement:()=>({getContext:()=>({drawImage(){draws++;}})})};
 const source=readFileSync(new URL('../src/gacha-assets.ts',import.meta.url),'utf8').replaceAll('import.meta.url','"http://localhost/src/gacha-assets.ts"');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('exports','require','Image','document','URL',compiled)(exports,()=>({default:{frames:[{x:0,y:0,width:20,height:24}]}}),ImageFixture,document,URL);
 const initial=exports.gachaReady();assert.equal(requests,1,'concurrent callers share one image request');
 const blank=exports.toyCanvas(0);assert.equal(draws,0);
 const failed=assert.rejects(initial,/重新打开面板/);image.onerror();await failed;
 const retry=exports.gachaReady();assert.notEqual(retry,initial);assert.equal(requests,2);
 image.onload();await retry;
 const prize=exports.toyCanvas(0);assert.notEqual(prize,blank);assert.equal(draws,1);
 assert.equal(exports.toyCanvas(0),prize);await exports.gachaReady();assert.equal(requests,2);
});
