import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from './store.mjs';
import {createLife} from './life.mjs';
import {createBailian} from './llm.mjs';

test('Bailian chooses only a backend candidate and keeps other private chats out of the request',async t=>{
 const store=openStore(':memory:');t.after(()=>store.close());const life=createLife(store);for(const role of ['laura','sid','jilly'])await store.register('llm_'+role,'test-password-123',role);
 store.message('sid','jilly','hutong','private-third-person','third');store.message('laura','sid','hutong','你好','ours');let request;
 const llm=createBailian(store,life,{key:'test-only',fetchImpl:async(url,input)=>{request={url,...input,body:JSON.parse(input.body)};return Response.json({choices:[{message:{content:JSON.stringify({text:'嗨，我们去休息一会儿？',id:'invented-action'})}}],usage:{total_tokens:20}});}});t.after(()=>llm.close());
 assert.ok(await llm.reply('sid','你好','laura','hutong'));assert.ok(!JSON.stringify(request.body).includes('private-third-person'));assert.ok(request.url.endsWith('/chat/completions'));assert.equal(request.body.response_format.type,'json_object');
 assert.equal(await llm.choose([{id:'allowed',roles:['sid'],kind:'meet'}]),null,'invented model actions are rejected');assert.equal(store.db.prepare('SELECT tokens FROM llm_usage').get().tokens,40);
});
test('model failures, invalid JSON and daily call budget safely fall back without holding game transactions',async t=>{
 const store=openStore(':memory:');t.after(()=>store.close());await store.register('fallback_sid','test-password-123','sid');const life=createLife(store);let calls=0;
 const llm=createBailian(store,life,{key:'test-only',dailyLimit:2,fetchImpl:async()=>{calls++;return Response.json({choices:[{message:{content:'not JSON'}}]});}});t.after(()=>llm.close());
 assert.ok(await llm.reply('sid','你好','laura','hutong'));assert.ok(await llm.reply('sid','你好','laura','hutong'));assert.ok(await llm.reply('sid','你好','laura','hutong'));assert.equal(calls,2);assert.equal(llm.status().status,'daily_limit');assert.ok(!store.db.isTransaction,'game transactions must not remain open after LLM fallback');
});
