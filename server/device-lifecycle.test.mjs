import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

function fixture(publish=async()=>{}){
 const exports={},events={},bridge={user:{id:'first',role:'sid'},connected:true,controller:true,active:{actor:true,input:{},sys:{settings:{key:'gym'}}},game:{events:{on(name,fn){events[name]=fn;}}}};
 runInNewContext(ts.transpileModule(readFileSync(new URL('../src/multiplayer/world-client.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,clearTimeout,setTimeout,document:{getElementById:()=>null},HTMLDialogElement:class{},require:()=>({traceInteraction(){}})});
 const sent=[],client=new exports.WorldClient(bridge,async(...args)=>{sent.push(args);},publish,'tab',()=>{});client.apply=()=>{};events.poststep();const leaseOriginal=client.lease.bind(client);
 const pending=[];client.lease=(device,release)=>{if(release)return Promise.resolve();return new Promise(resolve=>pending.push(resolve));};
 return{exports,client,bridge,pending,events,leaseOriginal,sent};
}
const settle=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};

test('late device acknowledgement after leaving and returning to the same scene cannot start an old activity',async()=>{
 const f=fixture();let starts=0;f.exports.useDevice('run-0',()=>starts++);
 f.bridge.active={actor:true,sys:{settings:{key:'rest'}}};f.events.poststep();
 f.bridge.active={actor:true,sys:{settings:{key:'gym'}}};f.events.poststep();
 f.pending[0]();await settle();assert.equal(starts,0);
 f.exports.useDevice('run-0',()=>starts++);f.pending[1]();await settle();assert.equal(starts,1,'fresh interaction remains usable');
});
test('late device acknowledgement for the previous account cannot drive the next account',async()=>{
 const f=fixture();let starts=0;f.exports.useDevice('run-0',()=>starts++);
 f.bridge.user={id:'second',role:'laura'};f.pending[0]();await settle();assert.equal(starts,0);
});
test('old device cleanup cannot erase the pending lock for a fresh visit',async()=>{
 const f=fixture();f.exports.useDevice('run-0',()=>{});
 f.bridge.active={actor:true,sys:{settings:{key:'rest'}}};f.events.poststep();
 f.bridge.active={actor:true,sys:{settings:{key:'gym'}}};f.events.poststep();
 f.exports.useDevice('run-0',()=>{});assert.equal(f.pending.length,2);
 f.pending[0]();await settle();assert.equal(f.exports.useDevice('run-0',()=>{}),true,'fresh pending intent stays deduplicated');assert.equal(f.pending.length,2);
 f.pending[1]();await settle();
});
test('a device request waiting for a position checkpoint cannot lease under the next account',async()=>{
 let confirm;const f=fixture(()=>new Promise(r=>confirm=r)),request=f.leaseOriginal('run-0');
 f.bridge.user={id:'second',role:'laura'};confirm();await assert.rejects(request,/场景或账号已切换/);assert.equal(f.sent.length,0);
});
test('pause then reconnect invalidates an old device acknowledgement without clearing the fresh intent',async()=>{
 const f=fixture(),starts=[];f.exports.useDevice('run-0',()=>starts.push('old'));
 f.bridge.connected=false;f.client.pause();f.bridge.connected=true;f.exports.useDevice('run-0',()=>starts.push('new'));
 f.pending[0]();await settle();assert.deepEqual(starts,[]);assert.equal(f.exports.useDevice('run-0',()=>starts.push('duplicate')),true);assert.equal(f.pending.length,2);
 f.pending[1]();await settle();assert.deepEqual(starts,['new']);
});
