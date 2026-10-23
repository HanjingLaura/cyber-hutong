import test from 'node:test';
import assert from 'node:assert/strict';
import {createMvpServer} from './app.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('provider account failures persist a specific agent status without losing human chat',async t=>{
 let now=Date.now();t.mock.method(Date,'now',()=>now);
 const app=createMvpServer({agentPersonaDirectory:null,dbPath:':memory:',llmOptions:{key:'test',fetchImpl:async()=>Response.json({error:{code:'Arrearage',message:'private billing details'}},{status:400})}});t.after(()=>app.close());
 for(const role of ['laura','sid'])await app.store.register('billing_'+role,'isolated-password',role);
 app.agentProfiles.save(app.store.byRole('laura').id,{source:'fixture',voice:'brief',facts:[{scope:'public',text:'fixture'}],confirmed:true,enabled:true});now+=300001;
 const message=app.store.message('sid','laura','hutong','hello','billing-dm',false,'dm');app.replies.enqueue(message);await app.replies.drain();
 const jobs=app.replies.history('sid','laura','hutong','dm');assert.equal(jobs[0].status,'failed');assert.equal(jobs[0].reason,'account_arrearage');assert.ok(!JSON.stringify(jobs).includes('private billing details'));
 assert.equal(app.store.history('sid','laura','hutong','dm').filter(message=>!message.npc).length,1);assert.equal(app.store.history('sid','laura','hutong','dm').filter(message=>message.npc).length,0);
});

test('multiple explicitly mentioned agents have separate confirmed profiles, jobs and private histories',async t=>{
 let now=Date.now();t.mock.method(Date,'now',()=>now);const contexts=[];
 const app=createMvpServer({agentPersonaDirectory:null,dbPath:':memory:',llmOptions:{key:'test',fetchImpl:async(_url,input)=>{const context=JSON.parse(JSON.parse(input.body).messages[1].content);contexts.push(context);return Response.json({choices:[{message:{content:JSON.stringify({text:'reply-'+context.character.role})}}]});}}});
 t.after(()=>app.close());
 for(const role of ['laura','sid','jilly'])await app.store.register('multi_'+role,'isolated-password',role);
 for(const role of ['laura','jilly'])app.agentProfiles.save(app.store.byRole(role).id,{source:'isolated fixture',voice:'brief',facts:[{scope:'public',text:'public-'+role},{scope:'private',peer:'sid',text:'private-'+role}],confirmed:true,enabled:true});
 now+=300001;
 const publicMessage=app.store.message('sid',null,'hutong','hello agents','multi-public',false,'lobby',['laura','jilly']);
 assert.equal(app.replies.enqueue(publicMessage).length,2);await app.replies.drain();
 assert.deepEqual(contexts.map(c=>c.character.role).sort(),['jilly','laura']);assert.ok(contexts.every(c=>!JSON.stringify(c).includes('private-')));
 app.replies.enqueue(publicMessage);await app.replies.drain();assert.equal(contexts.length,2);
 for(const role of ['laura','jilly']){const m=app.store.message('sid',role,'hutong','hello privately','private-'+role,false,'dm');app.replies.enqueue(m);}
 await app.replies.drain();assert.equal(contexts.length,4);
 for(const c of contexts.slice(2)){assert.ok(c.character.confirmedFacts.includes('private-'+c.character.role));assert.ok(!JSON.stringify(c).includes('private-'+(c.character.role==='laura'?'jilly':'laura')));}
 const sidJobs=app.replies.history('sid','jilly','hutong','dm');assert.equal(sidJobs.length,1);assert.equal(sidJobs[0].role,'jilly');
 assert.equal(app.replies.history('laura','sid','hutong','dm').length,1);assert.ok(app.replies.history('laura','sid','hutong','dm').every(j=>j.role==='laura'));
});

test('each role starts disabled and another account profile cannot be read or enabled indirectly',async t=>{
 const app=createMvpServer({agentPersonaDirectory:null,dbPath:':memory:',llmOptions:{key:''}});t.after(()=>app.close());
 const sid=(await app.store.register('disabled_sid','isolated-password','sid')).user;
 const profile=app.agentProfiles.get(sid.id);assert.equal(profile.confirmed,false);assert.equal(profile.enabled,false);assert.equal(profile.facts.length,0);
 assert.throws(()=>app.agentProfiles.save(sid.id,{enabled:true,confirmed:false}),/确认/);
});

test('a full agent queue reports backpressure and old jobs cannot starve new requests',async t=>{
 let now=Date.now();t.mock.method(Date,'now',()=>now);
 const app=createMvpServer({agentPersonaDirectory:null,dbPath:':memory:',llmOptions:{key:''}});t.after(()=>app.close());
 for(const role of ['laura','sid'])await app.store.register('bounded_'+role,'isolated-password',role);
 app.agentProfiles.save(app.store.byRole('laura').id,{source:'fixture',voice:'brief',facts:[{text:'fixture',scope:'public'}],confirmed:true,enabled:true});now+=300001;
 for(let n=0;n<8;n++)assert.equal(app.replies.enqueue(app.store.message('sid','laura','hutong','hello','bounded-'+n,false,'dm'))[0].status,'queued');
 const full=app.replies.enqueue(app.store.message('sid','laura','hutong','hello','full',false,'dm'));
 assert.equal(full[0].status,'failed');assert.equal(full[0].reason,'queue_full');
 now+=600001;await app.replies.drain();
 const expired=app.replies.history('sid','laura','hutong','dm').filter(j=>j.reason!=='queue_full');assert.equal(expired.length,8);assert.ok(expired.every(j=>j.status==='failed'&&j.reason==='queue_expired'));
});

test('two server instances share the limit of two model-generation leases',async t=>{
 let now=Date.now();t.mock.method(Date,'now',()=>now);
 const directory=mkdtempSync(join(tmpdir(),'hutong-agent-leases-')),pending=[],apps=[];
 const fetchImpl=async(_url,input)=>new Promise(resolve=>{const done=()=>resolve(Response.json({choices:[{message:{content:'{"text":"lease reply"}'}}]}));pending.push(done);input.signal.addEventListener('abort',done,{once:true});});
 t.after(()=>{for(const complete of pending)complete();for(const app of apps)app.close();rmSync(directory,{recursive:true,force:true});});
 const a=createMvpServer({agentPersonaDirectory:null,dbPath:join(directory,'game.sqlite'),llmOptions:{key:'test',fetchImpl}});apps.push(a);
 for(const role of ['laura','sid'])await a.store.register('leases_'+role,'isolated-password',role);
 a.agentProfiles.save(a.store.byRole('laura').id,{source:'fixture',voice:'brief',facts:[{scope:'public',text:'fixture'}],confirmed:true,enabled:true});now+=300001;
 for(let n=0;n<6;n++)a.replies.enqueue(a.store.message('sid','laura','hutong','hello','lease-'+n,false,'dm'));
 const b=createMvpServer({agentPersonaDirectory:null,dbPath:join(directory,'game.sqlite'),llmOptions:{key:'test',fetchImpl}});apps.push(b);
 a.replies.pump();b.replies.pump();for(let n=0;n<60;n++)await Promise.resolve();
 assert.equal(pending.length,2,'global reservation limit must include another instance');
 for(const complete of pending)complete();
 for(let n=0;n<60;n++)await Promise.resolve();now+=1001;
 await new Promise(resolve=>setTimeout(resolve,1100));
 assert.ok(pending.length>=4,'deferred jobs must wake without another HTTP request');
 for(const complete of pending)complete();
 // Close before teardown to prevent intentionally pending later jobs starting.
 a.replies.close();b.replies.close();await Promise.all([a.replies.drain(),b.replies.drain()]);
});

test('a non-Laura queued reply survives restart and a repeated source never sends twice',async t=>{
 let now=Date.now(),calls=0;t.mock.method(Date,'now',()=>now);
 const directory=mkdtempSync(join(tmpdir(),'hutong-agent-restart-')),path=join(directory,'game.sqlite'),apps=[];
 const create=()=>{const app=createMvpServer({agentPersonaDirectory:null,dbPath:path,llmOptions:{key:'test',fetchImpl:async()=>{calls++;return Response.json({choices:[{message:{content:'{"text":"durable Jilly reply"}'}}]});}}});apps.push(app);return app;};
 t.after(()=>{for(const app of apps)app.close();rmSync(directory,{recursive:true,force:true});});
 let app=create();for(const role of ['sid','jilly'])await app.store.register('restart_'+role,'isolated-password',role);
 app.agentProfiles.save(app.store.byRole('jilly').id,{source:'fixture',voice:'brief',facts:[{scope:'public',text:'fixture'}],confirmed:true,enabled:true});now+=300001;
 const message=app.store.message('sid','jilly','hutong','hello','restart:namespace',false,'dm');assert.equal(app.replies.enqueue(message)[0].status,'queued');app.close();
 app=create();await app.replies.drain();assert.equal(calls,1);assert.equal(app.store.history('sid','jilly','hutong','dm').filter(m=>m.npc).length,1);
 app.close();app=create();assert.equal(app.replies.enqueue(message)[0].status,'sent');await app.replies.drain();assert.equal(calls,1);
});
