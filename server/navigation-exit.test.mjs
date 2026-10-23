import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/room-navigation.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source.slice(source.indexOf(' const key='),source.indexOf(" window.addEventListener('keydown',key,true)"))+'\nreturn key;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;

test('exit E opens the map with either game canvas or world focus, while typing never triggers travel',()=>{
 const canvas={},world={},input={},dialog={open:false};let opened=0,prevented=0;
 const document={activeElement:canvas,querySelector:s=>s==='.world'?world:null};
 const key=new Function('bridge','dialog','document','exitNear','open',code)({game:{canvas}},dialog,document,()=>true,()=>opened++);
 const event={code:'KeyE',repeat:false,preventDefault(){prevented++;},stopImmediatePropagation(){}};
 key(event);assert.equal(opened,1);
 document.activeElement=world;key(event);assert.equal(opened,2);assert.equal(prevented,2);
 document.activeElement=input;key(event);assert.equal(opened,2);
 document.activeElement=canvas;key({...event,repeat:true});assert.equal(opened,2);
 dialog.open=true;key(event);assert.equal(opened,2);
});
