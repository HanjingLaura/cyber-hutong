import test from 'node:test';
import assert from 'node:assert/strict';
import {createMvpServer} from './app.mjs';

async function fixture(t,{fetchImpl=async()=>Response.json({choices:[{message:{content:'{"text":"A source-backed reply"}'}}]}),dailyLimit=20,commitRequest}={}){
 let now=Date.now();t.mock.method(Date,'now',()=>now);const background=[];
 const app=createMvpServer({agentPersonaDirectory:null,dbPath:':memory:',llmOptions:{key:'test-only',fetchImpl,dailyLimit},backgroundTask:task=>background.push(task),commitRequest});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>{app.close();app.server.closeAllConnections();});const root=`http://127.0.0.1:${app.server.address().port}/api/`;
 const register=async role=>{const r=await fetch(root+'register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'reply_'+role,password:'reply-test-password',role})});return {cookie:r.headers.get('set-cookie').split(';')[0],user:(await r.json()).user};};
 const laura=await register('laura'),sid=await register('sid'),jilly=await register('jilly');
 const api=async(user,path,input)=>{const r=await fetch(root+path,{method:input===undefined?'GET':'POST',headers:{Cookie:user.cookie,'Content-Type':'application/json'},body:input===undefined?undefined:JSON.stringify(input)});return{status:r.status,data:await r.json()};};
 const saved=app.agentProfiles.save(laura.user.id,{source:'synthetic test notes',voice:'brief',facts:[{text:'approved-public',scope:'public'},{text:'sid-private-only',scope:'private',peer:'sid'}],examples:[],confirmed:true,enabled:true});assert.equal(saved.enabled,true);
 now+=300001;return {app,api,laura,sid,jilly,background,advance(ms){now+=ms;},async drain(){await app.replies.drain();}};
}
test('Laura replies only to explicit public mentions or direct messages, with channel-scoped context and one durable reply per retry',async t=>{
 let calls=0,contexts=[];const f=await fixture(t,{fetchImpl:async(_url,input)=>{calls++;contexts.push(JSON.parse(JSON.parse(input.body).messages[1].content));return Response.json({choices:[{message:{content:'{"text":"Hello from the trial"}'}}]});}});
 await f.api(f.sid,'chat',{channel:'lobby',text:'plain Laura text',requestId:'plain'});await f.drain();assert.equal(calls,0);
 const input={channel:'lobby',text:'explicit public mention',mentions:['laura'],requestId:'public'};
 await f.api(f.sid,'chat',input);await f.drain();assert.equal(calls,1);await f.api(f.sid,'chat',input);await f.drain();assert.equal(calls,1);
 assert.ok(!JSON.stringify(contexts[0]).includes('sid-private-only'));
 const lobby=await f.api(f.jilly,'history?channel=lobby');assert.equal(lobby.data.messages.filter(m=>m.npc).length,1);assert.equal(lobby.data.messages.at(-1).channel,'lobby');
 await f.api(f.sid,'chat',{peer:'laura',channel:'dm',text:'direct message',requestId:'dm'});await f.drain();assert.equal(calls,2);assert.ok(JSON.stringify(contexts[1]).includes('sid-private-only'));
 assert.equal((await f.api(f.jilly,'history?channel=dm&peer=laura')).data.messages.length,0);
 const ownProfile=await f.api(f.jilly,'agent-profile');assert.equal(ownProfile.status,404);assert.ok(f.background.length>=2);
});
test('returning owner cancels a pending reply while human chat and health remain responsive',async t=>{
 let resolve,started;const beginning=new Promise(r=>started=r);const f=await fixture(t,{fetchImpl:()=>{started();return new Promise(r=>resolve=r);}});
 await f.api(f.sid,'chat',{peer:'laura',text:'pending reply',requestId:'pending'});await beginning;
 assert.equal((await f.api(f.sid,'health')).status,200);
 f.app.presence.connect(f.laura.user.id,'human','generation');
 resolve(Response.json({choices:[{message:{content:'{"text":"late reply"}'}}]}));await f.drain();
 assert.equal((await f.api(f.sid,'history?peer=laura')).data.messages.filter(m=>m.npc).length,0);
 assert.equal((await f.api(f.sid,'agent-replies?channel=dm&peer=laura')).data.jobs.at(-1).status,'canceled');
});
test('daily budget exhaustion records a visible failure without inventing a fallback personality reply',async t=>{
 const f=await fixture(t,{dailyLimit:0});await f.api(f.sid,'chat',{peer:'laura',text:'quota test',requestId:'quota'});await f.drain();
 const jobs=(await f.api(f.sid,'agent-replies?channel=dm&peer=laura')).data.jobs;
 assert.equal(jobs.at(-1).status,'failed');assert.equal(jobs.at(-1).reason,'daily_limit');
 assert.equal((await f.api(f.sid,'history?peer=laura')).data.messages.length,1);
});

test('a background reservation persistence outage backs off instead of monopolizing gameplay requests',async t=>{
 let app,outage=true,failedSaves=0,calls=0;
 const f=await fixture(t,{fetchImpl:async()=>{calls++;return Response.json({choices:[{message:{content:'{"text":"recovered reply"}'}}]});},commitRequest:async()=>{
  if(app&&outage&&app.store.db.prepare("SELECT COUNT(*) n FROM agent_reply_jobs WHERE status='generating'").get().n&&++failedSaves<=5)throw Error('cloud unavailable');
 }});app=f.app;
 await f.api(f.sid,'chat',{peer:'laura',text:'backoff test',requestId:'backoff'});await f.drain();
 assert.equal(calls,0,'failed durable reservation must not call the provider');assert.equal(failedSaves,1,'retry must wait for recovery rather than spin');
 assert.equal((await f.api(f.sid,'health')).status,200);
 outage=false;f.advance(5001);await f.drain();assert.equal(calls,1);assert.equal((await f.api(f.sid,'history?peer=laura')).data.messages.filter(m=>m.npc).length,1);
});
