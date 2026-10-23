import test from 'node:test';
import assert from 'node:assert/strict';
import {createMvpServer} from './app.mjs';
import {createAgentReplies} from './agent-replies.mjs';
const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};

test('owner connection durably cancels queued replies even if the owner later goes offline again',async t=>{
 let now=Date.now(),calls=0;t.mock.method(Date,'now',()=>now);
 const app=createMvpServer({agentPersonaDirectory:null,dbPath:':memory:',llmOptions:{key:'synthetic',fetchImpl:async()=>{calls++;return Response.json({choices:[{message:{content:'{"text":"fixture"}'}}],usage:{total_tokens:10}});}}});t.after(()=>app.close());
 for(const role of ['sid','laura'])await app.store.register('live_cancel_'+role,'isolated-password',role);
 const owner=app.store.byRole('laura');app.agentProfiles.save(owner.id,{source:'fixture',voice:'brief',facts:[{scope:'public',text:'isolated fixture'}],confirmed:true,enabled:true});now+=360001;
 const m=app.store.message('sid','laura','hutong','fixture','owner-online-cancel',false,'dm');app.replies.enqueue(m);app.presence.connect(owner.id,'returned','one');
 assert.equal(app.replies.history('sid','laura','hutong','dm')[0].status,'canceled');
 now+=360001;await app.replies.drain();assert.equal(calls,0);assert.equal(app.store.history('sid','laura','hutong','dm').filter(m=>m.npc).length,0);
});
test('a stale browser heartbeat also cancels queued agent work durably',async t=>{
 let now=Date.now();t.mock.method(Date,'now',()=>now);const app=createMvpServer({agentPersonaDirectory:null,dbPath:':memory:',llmOptions:{key:''}});t.after(()=>app.close());
 for(const role of ['sid','laura'])await app.store.register('heartbeat_cancel_'+role,'isolated-password',role);
 const owner=app.store.byRole('laura');app.agentProfiles.save(owner.id,{source:'fixture',voice:'brief',facts:[{scope:'public',text:'isolated fixture'}],confirmed:true,enabled:true});app.presence.connect(owner.id,'old','one');now+=360001;
 app.replies.enqueue(app.store.message('sid','laura','hutong','fixture','heartbeat-cancel',false,'dm'));app.presence.heartbeat(owner.id,'old');
 assert.equal(app.replies.history('sid','laura','hutong','dm')[0].status,'canceled');
});
test('pre-canceled model request consumes no model call',async t=>{
 let calls=0;const app=createMvpServer({agentPersonaDirectory:null,dbPath:':memory:',llmOptions:{key:'synthetic',fetchImpl:async()=>{calls++;return Response.json({choices:[{message:{content:'{"text":"fixture"}'}}]});}}});t.after(()=>app.close());await app.store.register('pre_cancel','isolated-password','laura');const c=new AbortController();c.abort();assert.equal(await app.llm.reply('laura','fixture','sid','hutong',{strict:true,signal:c.signal}),null);assert.equal(calls,0);assert.equal(app.llm.status().budget.calls,0);
});
test('owner cancellation aborts provider fetch without tripping the timeout circuit breaker',async t=>{
 let calls=0,aborts=0;const app=createMvpServer({agentPersonaDirectory:null,dbPath:':memory:',llmOptions:{key:'synthetic',dailyTokenLimit:100000,fetchImpl:async(_url,input)=>{calls++;if(calls===4)return Response.json({choices:[{message:{content:'{"text":"ok"}'}}],usage:{total_tokens:10}});return new Promise((_r,reject)=>input.signal.addEventListener('abort',()=>{aborts++;reject(new DOMException('canceled','AbortError'));},{once:true}));}}});t.after(()=>app.close());await app.store.register('inflight_cancel','isolated-password','laura');
 for(let i=0;i<3;i++){const c=new AbortController(),reply=app.llm.reply('laura','fixture','sid','hutong',{strict:true,signal:c.signal});for(let n=0;n<50&&calls<i+1;n++)await settle();assert.equal(calls,i+1);c.abort();assert.equal(await reply,null);}
 assert.equal(aborts,3);assert.equal(app.llm.status().retryAt,undefined);assert.notEqual(app.llm.status().reason,'timeout');assert.equal(await app.llm.reply('laura','fixture','sid','hutong',{strict:true}),'ok');
});
test('remote owner cancellation during budget refresh spends no provider call or reservation',async t=>{
 let live=false,calls=0;const app=createMvpServer({agentPersonaDirectory:null,dbPath:':memory:',llmOptions:{key:'synthetic',fetchImpl:async()=>{calls++;return Response.json({choices:[{message:{content:'{"text":"fixture"}'}}],usage:{total_tokens:10}});}}});app.replies.close();
 for(const role of ['sid','laura'])await app.store.register('remote_cancel_'+role,'isolated-password',role);const owner=app.store.byRole('laura');app.agentProfiles.save(owner.id,{source:'fixture',voice:'brief',facts:[{scope:'public',text:'fixture'}],confirmed:true,enabled:true});
 const options={profiles:app.agentProfiles,llm:app.llm,humanLive:()=>live,canDrive:()=>!live,mutate:async fn=>fn(),publish(){},publishStatus(){}};
 const worker=createAgentReplies(app.store,options),remote=createAgentReplies(app.store,options);t.after(()=>{worker.close();remote.close();app.close();});
 app.llm.setPersistence(async fn=>{live=true;remote.cancel(owner.id);return fn();});worker.enqueue(app.store.message('sid','laura','hutong','fixture','remote-refresh',false,'dm'));await worker.drain();
 assert.equal(calls,0);assert.equal(app.llm.status().budget.calls,0);assert.equal(worker.history('sid','laura','hutong','dm')[0].status,'canceled');
});
test('cancellation after reservation but before fetch releases the unused allowance',async t=>{
 let eligible=true,calls=0;const app=createMvpServer({agentPersonaDirectory:null,dbPath:':memory:',llmOptions:{key:'synthetic',fetchImpl:async()=>{calls++;throw Error('must not fetch');}}});t.after(()=>app.close());await app.store.register('reservation_cancel','isolated-password','laura');app.llm.setPersistence(async fn=>{const result=fn();eligible=false;return result;});
 assert.equal(await app.llm.reply('laura','fixture','sid','hutong',{strict:true,canGenerate:()=>eligible}),null);assert.equal(calls,0);assert.equal(app.llm.status().budget.calls,0);assert.equal(app.llm.status().budget.chargedTokens,0);
});
