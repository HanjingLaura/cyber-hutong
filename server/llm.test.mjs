import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from './store.mjs';
import {createLife} from './life.mjs';
import {createBailian} from './llm.mjs';

test('ten unattended days cause zero background model requests; direct chat remains available',async t=>{
 let now=Date.now();t.mock.method(Date,'now',()=>now);let calls=0;const store=openStore(':memory:');t.after(()=>store.close());await store.register('sleeping_laura','test-password-123','laura');
 const llm=createBailian(store,createLife(store),{key:'test',fetchImpl:async()=>{calls++;return Response.json({choices:[{message:{content:'{"text":"有人发消息才回答"}'}}],usage:{total_tokens:40}});}});t.after(()=>llm.close());
 for(let day=0;day<10;day++){now+=86400000;await llm.choose([{id:'one',roles:['laura']}]);await llm.dialogue('laura',[],'idle','hutong');await llm.conversation(['laura','sid'],'idle','hutong');}
 assert.equal(calls,0);assert.equal(store.db.prepare('SELECT COUNT(*) n FROM llm_usage').get().n,0);
 assert.ok(await llm.reply('laura','你好','sid','hutong',{strict:true}));assert.equal(calls,1);
});

test('token reservations bound concurrent requests and survive model failures',async t=>{
 const store=openStore(':memory:');t.after(()=>store.close());await store.register('token_laura','test-password-123','laura');let calls=0;
 const llm=createBailian(store,createLife(store),{key:'test',dailyTokenLimit:1,fetchImpl:async()=>{calls++;throw Error('must not call');}});t.after(()=>llm.close());
 await Promise.all(Array.from({length:3},()=>llm.reply('laura','你好','sid','hutong',{strict:true})));assert.equal(calls,0);assert.equal(llm.status().status,'token_limit');assert.equal(store.db.prepare('SELECT COUNT(*) n FROM llm_usage').get().n,0);
});

test('provider token usage settles reservations; missing usage keeps the conservative charge',async t=>{
 const store=openStore(':memory:');t.after(()=>store.close());await store.register('settled_laura','test-password-123','laura');let calls=0;
 const llm=createBailian(store,createLife(store),{key:'test',dailyTokenLimit:50000,fetchImpl:async()=>{calls++;return Response.json({choices:[{message:{content:'{"text":"你好"}'}}],...(calls===1?{usage:{total_tokens:35}}:{})});}});t.after(()=>llm.close());
 await llm.reply('laura','你好','sid','hutong',{strict:true});assert.equal(store.db.prepare('SELECT tokens FROM llm_usage').get().tokens,35);
 await llm.reply('laura','你好','sid','hutong',{strict:true});assert.ok(store.db.prepare('SELECT tokens FROM llm_usage').get().tokens>35);
});

test('concurrent calls cannot exceed a one-request token budget and a failure retains its charge',async t=>{
 const store=openStore(':memory:');t.after(()=>store.close());await store.register('reserve_laura','test-password-123','laura');
 const probe=createBailian(store,createLife(store),{key:'test',fetchImpl:async()=>Response.json({choices:[{message:{content:'{"text":"ok"}'}}]})});await probe.reply('laura','same input','sid','hutong',{strict:true});probe.close();const reserved=store.db.prepare('SELECT tokens FROM llm_usage').get().tokens;store.db.exec('DELETE FROM llm_usage');let calls=0;
 const llm=createBailian(store,createLife(store),{key:'test',dailyTokenLimit:reserved,fetchImpl:async()=>{calls++;return new Response('upstream unavailable',{status:503});}});t.after(()=>llm.close());
 await Promise.all(Array.from({length:3},()=>llm.reply('laura','same input','sid','hutong',{strict:true})));assert.equal(calls,1);assert.equal(store.db.prepare('SELECT calls FROM llm_usage').get().calls,1);assert.equal(store.db.prepare('SELECT tokens FROM llm_usage').get().tokens,reserved);
 const reopened=createBailian(store,createLife(store),{key:'test',dailyTokenLimit:reserved,fetchImpl:async()=>{throw Error('must not retry exhausted budget');}});t.after(()=>reopened.close());await reopened.reply('laura','same input','sid','hutong',{strict:true});assert.equal(reopened.status().status,'token_limit');
});

test('excessively large personas are rejected before a model request or daily reservation',async t=>{
 const store=openStore(':memory:');t.after(()=>store.close());await store.register('oversize_laura','test-password-123','laura');let calls=0;
 const llm=createBailian(store,createLife(store),{key:'test',fetchImpl:async()=>{calls++;throw Error('must not call');}});t.after(()=>llm.close());
 assert.equal(await llm.reply('laura','hello','sid','hutong',{strict:true,profile:{voice:'字'.repeat(20000)}}),null);assert.equal(llm.status().status,'input_limit');assert.equal(calls,0);assert.equal(store.db.prepare('SELECT COUNT(*) n FROM llm_usage').get().n,0);
});

test('account arrears retain safe diagnostics and stop repeated model requests',async t=>{
 const store=openStore(':memory:');t.after(()=>store.close());await store.register('arrears_laura','test-password-123','laura');let calls=0;
 const llm=createBailian(store,createLife(store),{key:'secret-fixture',fetchImpl:async()=>{calls++;return Response.json({error:{code:'Arrearage',message:'private upstream body secret-fixture'}},{status:400,headers:{'x-request-id':'f0dff9ff-534f-9e63-9af8-e74f3ff835fd'}});}});t.after(()=>llm.close());
 assert.equal(await llm.reply('laura','hello','sid','hutong',{strict:true}),null);
 assert.equal(llm.status().reason,'account_arrearage');assert.equal(llm.status().upstreamCode,'Arrearage');assert.equal(llm.status().httpStatus,400);assert.equal(llm.status().requestId,'f0dff9ff-534f-9e63-9af8-e74f3ff835fd');
 await llm.reply('laura','again','sid','hutong',{strict:true});assert.equal(calls,1);assert.ok(!JSON.stringify(llm.status()).includes('secret-fixture'));assert.ok(!JSON.stringify(llm.status()).includes('private upstream body'));
});

test('rate limits expose retry time and discard untrusted provider metadata',async t=>{
 const store=openStore(':memory:');t.after(()=>store.close());await store.register('limited_laura','test-password-123','laura');let calls=0;
 const llm=createBailian(store,createLife(store),{key:'secret-fixture',fetchImpl:async()=>{calls++;return Response.json({error:{code:'limit_requests',message:'private'}},{status:429,headers:{'retry-after':'120','x-request-id':'secret-fixture'}});}});t.after(()=>llm.close());
 await llm.reply('laura','hello','sid','hutong',{strict:true});assert.equal(llm.status().reason,'upstream_429');assert.equal(llm.status().upstreamCode,'limit_requests');assert.equal(llm.status().requestId,undefined);assert.ok(llm.status().retryAt>=Date.now()+119000);
 await llm.reply('laura','again','sid','hutong',{strict:true});assert.equal(calls,1);
});

test('a recovered provider clears failure diagnostics and later budget errors have no stale reason',async t=>{
 let now=Date.now();t.mock.method(Date,'now',()=>now);let calls=0;
 const store=openStore(':memory:');t.after(()=>store.close());await store.register('recovered_laura','test-password-123','laura');
 const llm=createBailian(store,createLife(store),{key:'test',dailyLimit:2,fetchImpl:async()=>++calls===1?Response.json({error:{code:'Arrearage'}},{status:400}):Response.json({choices:[{message:{content:'{"text":"恢复了"}'}}]})});t.after(()=>llm.close());
 assert.equal(await llm.reply('laura','hello','sid','hutong',{strict:true}),null);now+=60001;
 assert.equal(await llm.reply('laura','hello','sid','hutong',{strict:true}),'恢复了');assert.equal(llm.status().status,'ready');assert.equal(llm.status().httpStatus,undefined);assert.equal(llm.status().retryAt,undefined);
 assert.equal(await llm.reply('laura','hello','sid','hutong',{strict:true}),null);assert.equal(llm.status().status,'daily_limit');assert.equal(llm.status().reason,'');assert.equal(calls,2);
});

test('provider failures expose a safe reason without upstream bodies or credentials',async t=>{
 const store=openStore(':memory:');t.after(()=>store.close());await store.register('reason_laura','test-password-123','laura');
 const llm=createBailian(store,createLife(store),{key:'secret-fixture',fetchImpl:async()=>new Response('private upstream body',{status:401})});t.after(()=>llm.close());
 assert.equal(await llm.reply('laura','hello','sid','hutong',{strict:true}),null);
 assert.equal(llm.status().reason,'upstream_401');assert.ok(!JSON.stringify(llm.status()).includes('secret-fixture'));
});

test('a reply waits for a model slot instead of failing while other model work is in flight',async t=>{
 const store=openStore(':memory:');t.after(()=>store.close());await store.register('slots_laura','test-password-123','laura');const pending=[];
 const llm=createBailian(store,createLife(store),{key:'test',fetchImpl:async()=>new Promise(resolve=>pending.push(()=>resolve(Response.json({choices:[{message:{content:'{"text":"queued reply"}'}}]}))))});t.after(()=>{for(const done of pending)done();llm.close();});
 const jobs=Array.from({length:3},()=>llm.reply('laura','hello','sid','hutong',{strict:true}));for(let n=0;n<20;n++)await Promise.resolve();assert.equal(pending.length,2);
 pending[0]();pending[1]();for(let n=0;n<30;n++)await Promise.resolve();assert.equal(pending.length,3,'third request must acquire a released slot');pending[2]();assert.ok((await Promise.all(jobs)).every(Boolean));
});

test('strict public replies use only the supplied approved profile and public-channel history, and report model failure',async t=>{
 const store=openStore(':memory:');t.after(()=>store.close());await store.register('scope_laura','test-password-123','laura');
 store.message('sid','laura','hutong','private-excluded','private');store.message('sid',null,'hutong','scene-excluded','scene');store.message('sid',null,'rest','lobby-included','lobby',false,'lobby');
 let context;const llm=createBailian(store,createLife(store),{key:'test',fetchImpl:async(_url,input)=>{assert.equal(store.db.isTransaction,false);context=JSON.parse(JSON.parse(input.body).messages[1].content);return Response.json({choices:[{message:{content:'invalid-json'}}]});}});t.after(()=>llm.close());
 const result=await llm.reply('laura','hello','sid','hutong',{channel:'lobby',strict:true,profile:{confirmedFacts:['approved-public'],voice:'short'}});
 assert.equal(result,null);assert.ok(JSON.stringify(context).includes('lobby-included'));assert.ok(!JSON.stringify(context).includes('private-excluded'));assert.ok(!JSON.stringify(context).includes('scene-excluded'));assert.deepEqual(context.character.confirmedFacts,['approved-public']);
 assert.equal(llm.status().status,'unavailable');
});

test('agent conversation is bounded, alternates the two participants and rejects invented speakers',async t=>{
 const store=openStore(':memory:');t.after(()=>store.close());for(const role of ['laura','sid'])await store.register('duo_'+role,'test-password-123',role);
 const llm=createBailian(store,createLife(store),{key:'test',allowBackground:true,fetchImpl:async()=>Response.json({choices:[{message:{content:JSON.stringify({turns:[{role:'laura',text:'一起跳了一会儿，挺开心。'},{role:'sid',text:'下次再来！'},{role:'intruder',text:'不该出现'}]})}}]})});t.after(()=>llm.close());
 const turns=await llm.conversation(['laura','sid'],'一起跳舞','dance');assert.deepEqual(turns.map(t=>t.role),['laura','sid']);assert.ok(turns.every(t=>t.text.length<=100));
});

test('Bailian chooses only a backend candidate and keeps other private chats out of the request',async t=>{
 const store=openStore(':memory:');t.after(()=>store.close());const life=createLife(store);for(const role of ['laura','sid','jilly'])await store.register('llm_'+role,'test-password-123',role);
 store.message('sid','jilly','hutong','private-third-person','third');store.message('laura','sid','hutong','你好','ours');let request;
 const llm=createBailian(store,life,{key:'test-only',allowBackground:true,fetchImpl:async(url,input)=>{request={url,...input,body:JSON.parse(input.body)};return Response.json({choices:[{message:{content:JSON.stringify({text:'嗨，我们去休息一会儿？',id:'invented-action'})}}],usage:{total_tokens:20}});}});t.after(()=>llm.close());
 assert.ok(await llm.reply('sid','你好','laura','hutong'));assert.ok(!JSON.stringify(request.body).includes('private-third-person'));assert.ok(request.url.endsWith('/chat/completions'));assert.equal(request.body.response_format.type,'json_object');
 assert.equal(await llm.choose([{id:'allowed',roles:['sid'],kind:'meet'}]),null,'invented model actions are rejected');assert.equal(store.db.prepare('SELECT tokens FROM llm_usage').get().tokens,40);
});
test('model failures, invalid JSON and daily call budget safely fall back without holding game transactions',async t=>{
 const store=openStore(':memory:');t.after(()=>store.close());await store.register('fallback_sid','test-password-123','sid');const life=createLife(store);let calls=0;
 const llm=createBailian(store,life,{key:'test-only',dailyLimit:2,fetchImpl:async()=>{calls++;return Response.json({choices:[{message:{content:'not JSON'}}]});}});t.after(()=>llm.close());
 assert.ok(await llm.reply('sid','你好','laura','hutong'));assert.ok(await llm.reply('sid','你好','laura','hutong'));assert.ok(await llm.reply('sid','你好','laura','hutong'));assert.equal(calls,2);assert.equal(llm.status().status,'daily_limit');assert.ok(!store.db.isTransaction,'game transactions must not remain open after LLM fallback');
});
