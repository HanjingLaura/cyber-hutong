import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {EventEmitter} from 'node:events';
import ts from 'typescript';

const exports={};
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/scene-dom.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});
test('persistent buttons invoke the active scene once after repeated shutdown and restart',()=>{
 const events=new EventEmitter(),button=new EventTarget();let active=true,calls=0;
 const scene={events,sys:{isActive:()=>active}};
 for(let n=0;n<5;n++){
  exports.bindSceneEvent(scene,button,'click',()=>calls++);
  button.dispatchEvent(new Event('click'));assert.equal(calls,n+1);
  active=false;button.dispatchEvent(new Event('click'));assert.equal(calls,n+1);
  events.emit('shutdown');active=true;
  button.dispatchEvent(new Event('click'));assert.equal(calls,n+1,'shutdown removes the old handler');
 }
});
