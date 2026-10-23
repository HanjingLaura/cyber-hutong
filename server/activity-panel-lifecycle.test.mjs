import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

class Element extends EventTarget {
 children=[];style={};dataset={};open=false;value='';textContent='';isConnected=true;focusCount=0;
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=items;}
 setAttribute(){} focus(){this.focusCount++;} contains(){return false;}
 showModal(){this.open=true;}
 close(){this.open=false;this.dispatchEvent(new Event('close'));}
 getContext(){return new Proxy({}, {get:()=>()=>{}});}
}
function fixture(file,klass){
 const nodes=new Map(),get=key=>{if(!nodes.has(key))nodes.set(key,new Element());return nodes.get(key);};
 const pending=[],saved=[],timers=new Map();let timer=0,changes=0;
 const world={epoch:0,bridge:{user:{id:'one',role:'laura'},active:{},controller:true,connected:true},
  reward:(action,args)=>action==='claw-cancel'?Promise.resolve({}):new Promise((resolve,reject)=>pending.push({action,args,resolve,reject})),
  saveNow:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))};
 const document={querySelector:key=>key==='dialog[open]'?[...nodes.values()].find(node=>node.open):get(key),querySelectorAll:()=>[],createElement:()=>new Element(),activeElement:get('chat'),body:new Element()},focusExports={};
 runInNewContext(ts.transpileModule(readFileSync(new URL('../src/world-focus.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:focusExports,document});
 const exports={},worldModule={onlineWorld:()=>world,personalProgress:()=>[],useDevice:()=>false,releaseDevice(){},saveProgress:(...args)=>saved.push(structuredClone(args))};
 const require=name=>name.includes('world-focus')?focusExports:name.includes('world-client')?worldModule:name.endsWith('.png')?{default:''}:name.includes('gacha-assets')?{toyCanvas:()=>({})}:name.includes('arcade-rules')?{Mines:class{bombs=new Set();open=new Set();flags=new Set();},Spider:class{columns=[];stock=[];}}:{ArcadeSports:class{state(){return {basketball:{score:0},hockey:{goals:[0]}};}}};
 runInNewContext(ts.transpileModule(readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {exports,require,document,window:new EventTarget(),Image:class{},localStorage:{getItem:()=>null,setItem(){}},AbortController,performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame(){},structuredClone,
   setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id)});
 const panel=new exports[klass](()=>changes++);
 return {panel,world,pending,saved,get,changes:()=>changes,fireTimer:()=>{const [id,fn]=timers.entries().next().value;timers.delete(id);return fn();},flush:async()=>{for(let i=0;i<8;i++)await Promise.resolve();}};
}
test('closing a pending claw grab allows a fresh visit and ignores the old start',async()=>{
 const f=fixture('arcade-games.ts','ArcadeGames');f.panel.open('claw');const old=f.panel.startClaw();f.panel.dialog.close();f.panel.open('claw');
 f.get('#arcade-action').dispatchEvent(new Event('click'));assert.equal(f.pending.length,2);
 f.pending[0].resolve({round:'old'});await old;assert.equal(f.panel.phase,'ready');assert.equal(f.panel.waiting,true);
 f.pending[1].resolve({round:'new'});await f.flush();assert.equal(f.panel.round,'new');assert.equal(f.panel.phase,'down');
});
test('old claw delivery cannot reset a newer visit',async()=>{
 const f=fixture('arcade-games.ts','ArcadeGames');f.panel.open('claw');f.panel.round='old';f.panel.phase='deliver';const old=f.panel.finishClaw();
 f.panel.dialog.close();f.panel.open('claw');const fresh=f.panel.startClaw();f.pending[1].resolve({round:'new'});await fresh;
 f.pending[0].resolve({wins:5,remaining:[1]});await old;assert.equal(f.panel.round,'new');assert.equal(f.panel.phase,'down');assert.equal(f.panel.wins,0);
});
test('closing while saving a bead work cannot fuse or save the newly opened board',async()=>{
 const f=fixture('perler-board.ts','PerlerBoard');f.panel.open(0);f.panel.board.cells[0]=2;f.panel.iron();const old=f.fireTimer();f.panel.close();f.panel.open(1);
 f.pending[0].resolve();await old;assert.equal(f.panel.board.fused,false);assert.equal(f.saved.length,0);assert.equal(f.changes(),0);
});
test('old gallery request cannot clear the busy lock of a fresh request',async()=>{
 const f=fixture('perler-board.ts','PerlerBoard');f.panel.open(0);const work={created:1,cells:Array(256).fill(2),pattern:'自由'};
 const old=f.panel.takeWork(work,true);f.panel.close();f.panel.open(1);const fresh=f.panel.takeWork(work,true);
 f.pending[0].resolve({});await old;assert.equal(f.panel.busy,true);f.pending[1].resolve({});await fresh;assert.equal(f.panel.busy,false);
});
for(const change of ['account','control','scene'])test(`bead completion is ignored after ${change} changes`,async()=>{
 const f=fixture('perler-board.ts','PerlerBoard');f.panel.open(0);f.panel.board.cells[0]=2;f.panel.iron();const old=f.fireTimer();
 if(change==='account')f.world.bridge.user={id:'two',role:'hanjing'};else if(change==='control'){f.world.bridge.controller=false;f.world.epoch++;}else {f.world.bridge.active={};f.world.epoch++;}
 f.pending[0].resolve();await old;assert.equal(f.panel.board.fused,false);assert.equal(f.saved.length,0);assert.equal(f.changes(),0);
});
test('loading an account draft cannot undo into a previous account board',()=>{
 const f=fixture('perler-board.ts','PerlerBoard');f.panel.open(0);f.panel.board.cells[0]=2;f.panel.stroke=[...f.panel.board.cells];f.panel.board.cells[1]=3;f.panel.commitStroke();
 f.panel.close();f.world.bridge.user={id:'two',role:'hanjing'};f.panel.open(0);f.get('#perler-undo').dispatchEvent(new Event('click'));
 assert.equal(f.panel.board.cells[0],-1);assert.equal(f.panel.getState().undo,0);
});
for(const [file,klass,seat] of [['arcade-games.ts','ArcadeGames','claw'],['perler-board.ts','PerlerBoard',0]])test(`${klass} close preserves newer chat focus`,()=>{
 const f=fixture(file,klass);f.panel.open(seat);f.panel.dialog.close();assert.equal(f.get('.world').focusCount,0);
});
