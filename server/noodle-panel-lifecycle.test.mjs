import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

class Node extends EventTarget{
 children=[];textContent='';open=false;dataset={};
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(){}
 showModal(){this.open=true;}
 close(){this.open=false;this.dispatchEvent(new Event('close'));}
}
function fixture(){
 const nodes=new Map(['#noodle-menu','#noodle-choices','#noodle-title','#noodle-menu-hand'].map(key=>[key,new Node()]));
 const scene={sys:{isActive:()=>true},input:{keyboard:{resetKeys(){}}},events:new EventEmitter()},exports={},pending=[];
 const world={bridge:{user:{id:'diner',role:'laura'},active:scene},epoch:0,objects:new Map([['noodle:table-0',{version:0}]]),action:()=>new Promise(r=>pending.push(r))};
 const require=name=>name.includes('scene-dom')?{bindSceneEvent:(_s,el,type,listener)=>el.addEventListener(type,listener)}:name.includes('player-inventory')?{playerInventory:{hand:'米线'}}:{onlineWorld:()=>world};
 runInNewContext(ts.transpileModule(readFileSync(new URL('../src/noodle-table.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,document:{querySelector:key=>nodes.get(key),createElement:()=>new Node()}});
 const panel=exports.setupNoodleTable(scene,()=>({dishes:[Array(6).fill(null),Array(6).fill(null)],seated:null}),()=>{},()=>{}),dialog=nodes.get('#noodle-menu'),choices=nodes.get('#noodle-choices');
 function start(){panel.open(0);choices.children[0].children[0].onclick();choices.children.find(node=>node.textContent==='放下米线').onclick();}
 return{panel,dialog,choices,scene,start,finish:async(index=0)=>{pending[index]({});for(let i=0;i<8;i++)await Promise.resolve();}};
}
test('late table completion cannot replace a drink menu opened after closing the table',async()=>{
 const f=fixture();f.start();f.dialog.close();const drinks=new Node();drinks.textContent='可乐';f.choices.replaceChildren(drinks);f.dialog.showModal();await f.finish();assert.equal(f.choices.children[0],drinks);
});
test('late table completion cannot replace a menu after the room sleeps and wakes',async()=>{
 const f=fixture();f.start();f.scene.events.emit('sleep');const drinks=new Node();f.choices.replaceChildren(drinks);await f.finish();assert.equal(f.choices.children[0],drinks);
});
test('fresh table visit remains usable after an old request finishes',async()=>{
 const f=fixture();f.start();f.dialog.close();f.panel.open(1);const before=f.choices.children[0];await f.finish();assert.equal(f.choices.children[0],before);assert.ok(before.children.every(button=>!button.disabled));
});
test('an old completion cannot clear a newer table request lock',async()=>{
 const f=fixture();f.start();f.dialog.close();f.start();const current=f.choices.children[0];assert.ok(current.children.every(button=>button.disabled));await f.finish();assert.equal(f.choices.children[0],current);assert.ok(current.children.every(button=>button.disabled));await f.finish(1);assert.ok(f.choices.children[0].children.every(button=>!button.disabled));
});
