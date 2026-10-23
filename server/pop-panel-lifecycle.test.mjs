import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

class Element extends EventTarget{
 open=false;dataset={};style={};innerHTML='';textContent='';focusCount=0;isConnected=true;
 replaceChildren(){this.innerHTML='';} setAttribute(){} focus(){this.focusCount++;} contains(){return false;}
 showModal(){this.open=true;} close(){this.open=false;this.dispatchEvent(new Event('close'));}
 getContext(){return new Proxy({}, {get:()=>()=>{}});} toDataURL(){return '';}
 querySelectorAll(){return [];}
}
function fixture(){
 const nodes=new Map(),get=key=>{if(!nodes.has(key))nodes.set(key,new Element());return nodes.get(key);};
 const pending=[],notices=[],timers=new Map();let timer=0;
 class Scene{events=new EventEmitter();active=true;sys={isActive:()=>this.active,game:{}};input={keyboard:{resetKeys(){},addKeys(){return {};}}};game={canvas:get('game')};textures={exists:()=>true,get:()=>({getSourceImage:()=>({})})};add={image:()=>{const node={};for(const key of ['setOrigin','setDisplaySize','setDepth'])node[key]=()=>node;return node;}};}
 const world={epoch:0,bridge:{user:{id:'one',role:'laura'},active:null,connected:true,controller:true},action:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),notice:message=>notices.push(message)};
 const exports={},inventory={hand:null},focusExports={};
 const document={querySelector:key=>key==='dialog[open]'?[...nodes.values()].find(node=>node.open):get(key),createElement:()=>new Element(),activeElement:get('chat'),body:new Element()};
 runInNewContext(ts.transpileModule(readFileSync(new URL('../src/world-focus.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:focusExports,document});
 const require=name=>name==='phaser'?{default:{Scene,Geom:{Polygon:class{}}}}:name.includes('scene-dom')?{bindSceneEvent:(scene,node,type,fn)=>node.addEventListener(type,event=>{if(scene.sys.isActive())fn(event);})}:name.includes('world-focus')?focusExports:name.includes('world-client')?{onlineWorld:()=>world}:name.includes('player-inventory')?{playerInventory:inventory}:name.includes('gacha-assets')?{gachaImages:()=>new Promise(()=>{}),gachaNames:['one'],gachaItems:['toy']}:name.includes('blind-box')?{blindBoxes:{stock:()=>[0],data:{collection:[]},take:()=>({toy:0})},toyNames:['one'],toyImage:()=>''}:name.includes('gacha')?{gacha:{counts:[0]}}:name.includes('frames')?{registerRegions:()=>[]}:name.includes('easter-eggs')?{placeGuest(){}}:name.includes('hud')?{setGuide(){}}:{};
 const source=readFileSync(new URL('../src/popmart.ts',import.meta.url),'utf8').replaceAll('import.meta.url',"'file:///src/popmart.ts'");
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,URL,document,window:new EventTarget(),Image:class{},setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id)});
 const scene=new exports.PopMartScene();world.bridge.active=scene;scene.create();
 return {scene,world,pending,notices,get,flush:async()=>{for(let i=0;i<8;i++)await Promise.resolve();},start:(source='machine')=>{scene.open(source);scene.selected=0;scene.extract();},fire:()=>{for(const fn of timers.values())fn();timers.clear();}};
}
for(const source of ['machine','shelf'])for(const outcome of ['resolve','reject'])test(`late ${source} ${outcome} does not alter a reopened shop request`,async()=>{
 const f=fixture();f.start(source);f.scene.menu.close();f.start(source);f.pending[0][outcome](outcome==='resolve'?{progress:[{kind:'toy',data:{toy:0}},{kind:'gacha',data:{toy:0}}]}:Error('old request'));
 await f.flush();assert.equal(f.scene.busy,true);assert.equal(f.notices.length,0);assert.equal(f.get('#blind-result').innerHTML,'');
 f.pending[1].resolve({progress:[]});await f.flush();assert.equal(f.scene.busy,false);
});
test('sleep invalidates shelf completion before returning to the shop',async()=>{
 const f=fixture();f.start('shelf');f.scene.active=false;f.scene.events.emit('sleep');f.scene.active=true;f.start('machine');
 f.pending[0].resolve({progress:[{kind:'toy',data:{toy:0}}]});await f.flush();assert.equal(f.scene.busy,true);assert.equal(f.get('#blind-result').innerHTML,'');
});
for(const change of ['account','epoch'])test(`late capsule response is ignored after ${change} change`,async()=>{
 const f=fixture();f.start();if(change==='account')f.world.bridge.user={id:'two',role:'hanjing'};else f.world.epoch++;
 f.pending[0].resolve({progress:[{kind:'gacha',data:{toy:3}}]});await f.flush();assert.equal(f.scene.capsuleToy,0);assert.notEqual(f.scene.capsule,'ready');
});
test('shop close preserves newer chat focus',()=>{
 const f=fixture(),before=f.get('.world').focusCount;f.scene.open('shelf');f.scene.menu.close();assert.equal(f.get('.world').focusCount,before);
});
for(const change of ['controller','connected','account','epoch'])test(`losing ${change} closes a busy capsule panel and permits recovery`,async()=>{
 const f=fixture();f.start();
 if(change==='account')f.world.bridge.user={id:'two',role:'hanjing'};else if(change==='epoch')f.world.epoch++;else f.world.bridge[change]=false;
 f.scene.update(0,16);assert.equal(f.scene.menu.open,false);assert.equal(f.scene.busy,false);
 f.world.bridge.controller=true;f.world.bridge.connected=true;f.start();f.pending[0].resolve({progress:[{kind:'gacha',data:{toy:3}}]});await f.flush();assert.equal(f.scene.busy,true);assert.equal(f.scene.capsuleToy,0);
 f.pending[1].resolve({progress:[]});await f.flush();assert.equal(f.scene.busy,false);assert.equal(f.scene.capsule,'ready');
});
