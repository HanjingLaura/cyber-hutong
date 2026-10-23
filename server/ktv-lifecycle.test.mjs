import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {EventEmitter} from 'node:events';
import ts from 'typescript';
import * as rules from '../shared/ktv.mjs';
import geometry from '../shared/interactions.json' with {type:'json'};

function fixture(){
 const nodes=[],pending=[],audioPending=[];let active=true;
 const document={activeElement:null,hidden:false,body:null,documentElement:{classList:{contains:()=>false}},
  createElement:()=>new Element(),querySelector:selector=>selector==='dialog[open]'?nodes.find(n=>n.open)??null:get(selector),
  addEventListener(){},removeEventListener(){}};
 class Element extends EventTarget{
  nodes=new Map();children=[];style={};dataset={};open=false;hidden=false;isConnected=true;clientLeft=0;clientTop=0;
  constructor(){super();nodes.push(this);}
  querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new Element());return this.nodes.get(selector);}
  querySelectorAll(){return [];}
  append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}
  setAttribute(){}remove(){this.isConnected=false;}contains(node){return this===node||this.children.includes(node)||[...this.nodes.values()].some(n=>n.contains(node));}
  focus(){document.activeElement=this;}showModal(){this.open=true;this.querySelector('button').focus();}
  close(){this.open=false;this.dispatchEvent(new Event('close'));}
  getBoundingClientRect(){return {left:0,top:0,width:640,height:360};}
 }
 const globals=new Map(),get=selector=>{if(!globals.has(selector))globals.set(selector,new Element());return globals.get(selector);};
 document.body=new Element();const world=get('.world'),canvas=new Element();
 const service={epoch:0,bridge:{user:{id:'one',role:'laura'},active:null,controller:true,connected:true,players:[]},action:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))};
 const graphic=()=>new Proxy({}, {get:(_,key)=>key==='text'?'':()=>graphic()});
 class Scene{events=new EventEmitter();sys={isActive:()=>active};game={canvas};input={keyboard:{addKeys:()=>({}),resetKeys(){}}};add={image:graphic,graphics:graphic,text:graphic};}
 class Audio{enabled=false;async enable(){this.enabled=true;await new Promise((resolve,reject)=>audioPending.push({resolve,reject}));}stop(){this.enabled=false;}dispose(){this.stop();}}
 const exports={},require=name=>name==='phaser'?{default:{Scene}}:name.endsWith('interactions.json')?{default:geometry}:name.endsWith('ktv.mjs')?rules:name==='./ktv-audio'?{KtvAudio:Audio}:name.includes('world-client')?{onlineWorld:()=>service,releaseDevice(){},sharedAction:()=>false,useDevice:()=>false}:name==='./player-inventory'?{playerInventory:{hand:null}}:name==='./world-focus'?focusExports:{setGuide(){}};
 const focusExports={};runInNewContext(ts.transpileModule(readFileSync(new URL('../src/world-focus.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:focusExports,document});
 const source=readFileSync(new URL('../src/ktv.ts',import.meta.url),'utf8').replaceAll('import.meta.url',JSON.stringify(import.meta.url));
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,document,window:new EventTarget(),ResizeObserver:class{observe(){}disconnect(){}},Event,Date});
 const scene=new exports.KtvScene();service.bridge.active=scene;scene.create();[scene.x,scene.y]=rules.ktvTargets.terminal;
 return {scene,service,pending,audioPending,document,world,get,Element,sleep(){active=false;scene.events.emit('sleep');},wake(){active=true;scene.events.emit('wake');},open(){scene.interact();},flush:async()=>{for(let i=0;i<8;i++)await Promise.resolve();}};
}

for(const newer of ['dialog','chat'])test(`KTV close preserves focus in a newer ${newer}`,()=>{
 const f=fixture();f.open();const newerUi=new f.Element();if(newer==='dialog')newerUi.showModal();else newerUi.focus();const focused=f.document.activeElement;f.scene.menu.close();assert.equal(f.document.activeElement,focused);
});

test('closing the KTV menu releases its pending operation for a fresh visit',async()=>{
 const f=fixture();f.open();const old=f.scene.control('queue','power');f.scene.menu.close();f.open();const fresh=f.scene.control('queue','power');
 assert.equal(f.pending.length,2);f.pending[0].resolve({});await old;assert.equal(f.scene.busy,true);f.pending[1].resolve({});await fresh;assert.equal(f.scene.busy,false);
});

for(const change of ['account','control','sleep'])test(`KTV ignores a control result after ${change} changes`,async()=>{
 const f=fixture();f.open();const old=f.scene.control('queue','power');const message=f.scene.message;
 if(change==='account')f.service.bridge.user={id:'two',role:'sid'};else if(change==='control')f.service.bridge.controller=false;else {f.sleep();f.wake();}
 f.pending[0].reject(new Error('old failure'));await old;assert.equal(f.scene.message,message);
});

for(const change of ['account','sleep','shutdown'])test(`KTV ignores an MV enable result after ${change}`,async()=>{
 const f=fixture();const old=f.scene.toggleSound();if(change==='account')f.service.bridge.user={id:'two',role:'sid'};else if(change==='sleep'){f.sleep();f.wake();}else f.scene.events.emit('shutdown');
 f.audioPending[0].resolve();await old;assert.equal(f.scene.audioEnabled,false);assert.equal(f.scene.audio.enabled,false);
});

test('an old MV rejection cannot turn off a fresh visit playback',async()=>{
 const f=fixture();const old=f.scene.toggleSound();f.sleep();f.wake();const fresh=f.scene.toggleSound();assert.equal(f.audioPending.length,2);
 f.audioPending[1].resolve();await fresh;f.audioPending[0].reject(new Error('old audio'));await old;assert.equal(f.scene.audioEnabled,true);assert.equal(f.scene.audio.enabled,true);
});

function audioFixture(){
 const pending=[],messages=[];const video=new class extends EventTarget{
  paused=true;readyState=0;currentTime=0;
  setAttribute(){}removeAttribute(){}load(){}pause(){this.paused=true;}
  play(){this.paused=false;return new Promise((resolve,reject)=>pending.push({resolve,reject}));}
 }();
 const host={hidden:true,append(){},replaceChildren(){}},exports={};
 const source=readFileSync(new URL('../src/ktv-audio.ts',import.meta.url),'utf8').replaceAll('import.meta.url',JSON.stringify(import.meta.url));
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,document:{createElement:()=>video,querySelector:()=>null},performance:{now:()=>1000}});
 return {audio:new exports.KtvAudio(host,message=>messages.push(message)),video,pending,messages,flush:async()=>{for(let i=0;i<8;i++)await Promise.resolve();}};
}

for(const change of ['visit','song','pause'])test(`an old MV play rejection cannot block playback after a new ${change}`,async()=>{
 const f=audioFixture();await f.audio.enable();f.audio.update(rules.ktvSongs[0],0,true);
 if(change==='visit'){f.audio.stop();await f.audio.enable();}else if(change==='pause')f.audio.update(rules.ktvSongs[0],0,false);
 f.video.paused=true;f.audio.update(rules.ktvSongs[change==='song'?1:0],0,true);
 assert.equal(f.pending.length,2);f.pending[0].reject(Object.assign(new Error('old playback'),{name:'NotAllowedError'}));await f.flush();
 assert.equal(f.messages.length,0);assert.equal(f.audio.pending,true);assert.equal(f.video.paused,false);
 f.pending[1].resolve();await f.flush();assert.equal(f.audio.pending,false);
});
