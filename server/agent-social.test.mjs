import test from 'node:test';
import assert from 'node:assert/strict';
import {createMvpServer} from './app.mjs';

async function fixture(t,fetchImpl){let now=Date.now();t.mock.method(Date,'now',()=>now);const app=createMvpServer({agentPersonaDirectory:null,dbPath:':memory:',llmOptions:{key:fetchImpl?'test':'',fetchImpl}});t.after(()=>app.close());for(const role of ['laura','sid'])await app.store.register('social_'+role,'test-password-123',role);now+=300001;app.autonomy.tick();for(const p of app.autonomy.doubles.values())Object.assign(p,{scene:'rest',x:p.role==='laura'?300:340,y:190,moving:false,task:null,path:[],next:Infinity});return{app,advance(ms){now+=ms;app.autonomy.tick();},get now(){return now;}};}
const settle=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};

test('offline colocated agents do not start public reply loops without an explicit mention',async t=>{
 const f=await fixture(t);assert.ok(f.app.director.candidates(f.now).every(c=>!['chat','play'].includes(c.kind)));
 const message=f.app.store.message('sid',null,'rest','plain text @Laura','ordinary');assert.deepEqual(f.app.replies.enqueue(message),[]);
 await f.app.replies.drain();assert.equal(f.app.store.db.prepare('SELECT COUNT(*) n FROM messages WHERE npc=1').get().n,0);
});

test('a human returning during a mentioned public reply suppresses the late answer',async t=>{
 let complete,started;const beginning=new Promise(r=>started=r),f=await fixture(t,()=>{started();return new Promise(r=>complete=r);});
 const laura=f.app.store.byRole('laura');f.app.agentProfiles.save(laura.id,{source:'synthetic test notes',voice:'brief',facts:[{scope:'public',text:'test fact'}],confirmed:true,enabled:true});
 const message=f.app.store.message('sid',null,'rest','explicit mention','mentioned',false,'scene',['laura']);f.app.replies.enqueue(message);f.app.replies.pump();await beginning;
 f.app.presence.connect(laura.id,'human','generation');complete(Response.json({choices:[{message:{content:'{"text":"late public reply"}'}}]}));await f.app.replies.drain();
 assert.equal(f.app.store.db.prepare('SELECT COUNT(*) n FROM messages WHERE npc=1').get().n,0);assert.equal(f.app.replies.history('sid',null,'rest','scene').at(-1).status,'canceled');
});

test('offline meetups use actual routes and interruption never records completion',async t=>{
 const f=await fixture(t),candidate=f.app.director.candidates(f.now).find(c=>c.kind==='meet');assert.ok(candidate);assert.equal(f.app.director.start(candidate,f.now),true);
 const activity=f.app.director.status().active.id;f.advance(100);const first=candidate.people[0];f.app.autonomy.reclaim(first);
 assert.equal(f.app.store.db.prepare('SELECT status FROM activities WHERE id=?').get(activity).status,'interrupted');assert.ok(!f.app.life.journal(first).some(entry=>entry.eventId===activity));
});
