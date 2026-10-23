import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {randomUUID} from 'node:crypto';

function fixture(){
 const exports={},requests=[],bridge={user:{id:'account',role:'laura',revision:0},connected:true,controller:true,active:{sys:{settings:{key:'rest'}}},game:{events:{on(){}}}};
 runInNewContext(ts.transpileModule(readFileSync(new URL('../src/multiplayer/world-client.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,crypto:{randomUUID},clearTimeout,setTimeout,require:()=>({traceInteraction(){}})});
 const client=new exports.WorldClient(bridge,(path,input)=>new Promise(resolve=>requests.push({path,input,resolve})),async()=>{},'tab',()=>{});client.receive=()=>{};
 return{client,bridge,requests};
}
const settle=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};

test('repeated E presses during a stalled shared action do not build a mutation backlog',async()=>{
 const f=fixture(),first=f.client.action('rest:fridge-door','toggle');
 const duplicates=Array.from({length:40},()=>f.client.action('rest:fridge-door','toggle'));
 assert.equal(duplicates[0],first,'repeated pending intent must share the same promise');
 await settle();assert.equal(f.requests.length,1);f.requests[0].resolve({});await Promise.all([first,...duplicates]);
 await settle();assert.equal(f.requests.length,1,'one pending intent must create only one mutation');
 const later=f.client.action('rest:fridge-door','toggle');await settle();assert.equal(f.requests.length,2);f.requests[1].resolve({});await later;
});

test('a queued action from a departed scene is canceled before sending',async()=>{
 const f=fixture(),first=f.client.action('rest:fridge-door','toggle'),queued=f.client.action('rest:fridge','take',{slot:0});
 const rejected=assert.rejects(queued,/场景已切换/);await settle();f.bridge.active={sys:{settings:{key:'gym'}}};f.requests[0].resolve({});await first;await rejected;assert.equal(f.requests.length,1);
});

test('logout invalidates queued intents even when the same account returns to the same scene',async()=>{
 const f=fixture();f.client.pause=()=>{};f.bridge.clearTransition=()=>{};
 const first=f.client.action('rest:fridge-door','toggle'),queued=f.client.action('rest:fridge','take',{slot:0});
 const rejected=assert.rejects(queued,/场景已切换/);await settle();f.client.reset();f.requests[0].resolve({});await first;await rejected;assert.equal(f.requests.length,1);
});
