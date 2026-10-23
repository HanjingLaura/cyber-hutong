import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

test('a nearby NPC does not swallow E intended for an available scene interaction',async()=>{
 const exports={},window=new EventTarget(),world={getBoundingClientRect:()=>({left:0,top:0,width:640})};
 const primary={disabled:false,textContent:'坐下'},npc={hidden:false,disabled:false,textContent:''},speech={};
 const document={activeElement:world,createElement:()=>({querySelector:s=>s==='#npc-interact'?npc:speech}),querySelector:s=>s==='.world'?{...world,append(){}}:s==='#interact'?primary:null};
 // querySelector('.world') must retain focus identity.
 world.append=()=>{};document.querySelector=s=>s==='.world'?world:s==='#interact'?primary:null;
 let requests=0,sceneActions=0;
 const bridge={user:{id:'sid-account',role:'sid'},controller:true,connected:true,state:()=>({scene:'hutong',x:210,y:194,seat:null}),game:{canvas:{getBoundingClientRect:()=>({left:0,top:0,width:640,height:360})},events:{once(){}}},active:{sys:{settings:{key:'hutong'}}}};
 runInNewContext(ts.transpileModule(readFileSync(new URL('../src/multiplayer/npc-ui.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,window,document,setInterval:()=>0,clearInterval(){},require:path=>path.includes('npcs.json')?{default:[{id:'ani',owner:'sid',room:'hutong'}]}:path.includes('guests.json')?{default:{ani:{x:234,y:194}}}:path.includes('npc-feedback')?{npcFeedback:()=>null,receiveNpcFeedback(){},clearNpcFeedback(){}}:{dockPrompt(){},traceInteraction(){}}});
 const ui=exports.setupNPCUI(bridge,async()=>{requests++;return{};},async()=>{},'tab',()=>{});ui.receive({npcs:['ani']});
 window.addEventListener('keydown',()=>sceneActions++);
 const key=new Event('keydown',{cancelable:true});Object.defineProperties(key,{code:{value:'KeyE'},repeat:{value:false}});window.dispatchEvent(key);
 for(let n=0;n<10;n++)await Promise.resolve();
 assert.equal(sceneActions,1,'scene handler must receive E');assert.equal(requests,0,'NPC has its own explicit button');
});
