import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
function fixture(request=async()=>({})){
 const exports={},bridge={user:{id:'account',role:'sid',revision:0},connected:true,controller:true,active:{sys:{settings:{key:'noodle'}}},game:{events:{on(){}}},clearTransition(){}};
 runInNewContext(ts.transpileModule(readFileSync(new URL('../src/multiplayer/world-client.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,crypto:{randomUUID},clearTimeout,setTimeout,require:()=>({traceInteraction(){}})});
 const client=new exports.WorldClient(bridge,request,async()=>{},'tab',()=>{});client.apply=()=>{};client.pause=()=>{};
 return{client,bridge};
}
test('late noodle receipt cannot restore an active order after a newer cancellation snapshot',()=>{
 const {client}=fixture();client.receive({noodleOrders:[{id:'o',status:'cancelled'}],noodleOrdersRevision:5});client.receive({noodleOrders:[{id:'o',status:'active'}],noodleOrdersRevision:4});assert.equal(client.noodleOrders[0].status,'cancelled');
 client.receive({noodleOrders:[],noodleOrdersRevision:6});client.receive({noodleOrders:[{id:'o',status:'active'}],noodleOrdersRevision:4});assert.equal(client.noodleOrders.length,0);
});
test('order versions reset on logout so the next account can hydrate its own earlier state',()=>{
 const {client,bridge}=fixture();client.receive({noodleOrders:[{id:'old'}],noodleOrdersRevision:8});client.reset();bridge.user={id:'next',role:'laura',revision:0};client.receive({noodleOrders:[{id:'new'}],noodleOrdersRevision:1});assert.equal(client.noodleOrders[0].id,'new');
});
test('a rejected stale bowl action refreshes authoritative table state without reissuing the mutation',async()=>{
 const sent=[],conflict=Object.assign(Error('桌上物品已改变，请重新选择'),{status:409});
 const {client}=fixture(async(path,input)=>{sent.push({path,input});if(input)throw conflict;return{objects:[{id:'noodle:table-0',version:9,slots:[]}],noodleOrders:[],noodleOrdersRevision:3};});
 await assert.rejects(client.action('noodle:table-0','consume',{slot:0,expectedObjectVersion:7}),e=>e===conflict);
 assert.equal(sent.length,2);assert.equal(sent[0].input.action,'consume');assert.equal(sent[1].path,'noodle-orders');assert.equal(sent[1].input,undefined);assert.equal(client.objects.get('noodle:table-0').version,9);
});
