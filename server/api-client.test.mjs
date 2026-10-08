import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const source=readFileSync(new URL('../src/multiplayer/api.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(fetch){
  const module={exports:{}},events=[],deadlines=[];
  runInNewContext(compiled,{module,exports:module.exports,fetch,Event,
    require:()=>({apiUrl:path=>'/api/'+path}),window:{dispatchEvent:event=>events.push(event.type)},
    AbortSignal:{timeout:ms=>{deadlines.push(ms);return AbortSignal.timeout(10);}},
  });
  return{api:module.exports.api,events,deadlines};
}
test('a hung checkpoint times out and a later gameplay request can recover',async()=>{
  let stalled=true;
  const f=fixture(async(_url,{signal})=>{
    if(!stalled)return{ok:true,json:async()=>({ok:true})};
    return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
  });
  // Keep the fake transport alive, like an actual open network connection.
  const keepAlive=setInterval(()=>{},100);
  try{
    await assert.rejects(f.api('presence',{}),/连接中/);
    stalled=false;assert.equal((await f.api('inventory',{})).ok,true);
    assert.deepEqual(f.deadlines,[8000,15000]);
    assert.deepEqual(f.events,['hutong:connection-lost']);
  }finally{clearInterval(keepAlive);}
});
test('the timeout also aborts a response body that never finishes',async()=>{
  const f=fixture(async(_url,{signal})=>({ok:true,status:200,json:()=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))}));
  const keepAlive=setInterval(()=>{},100);
  try{await assert.rejects(f.api('presence',{}),/联机服务响应异常/);}finally{clearInterval(keepAlive);}
  assert.deepEqual(f.events,['hutong:connection-lost']);
});
