import test from 'node:test';
import assert from 'node:assert/strict';
import {createMvpServer} from './app.mjs';
import {roles} from './personas.mjs';
import {route} from './autonomy.mjs';
import desks from '../shared/workstations.json' with {type:'json'};
import geometry from '../shared/interactions.json' with {type:'json'};

test('all eight returning owners cancel their own generated reply and retain the human message',async t=>{
 let now=Date.now(),complete,started; t.mock.method(Date,'now',()=>now);
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:'synthetic',dailyTokenLimit:1000000,fetchImpl:async()=>{started();return new Promise(resolve=>complete=()=>resolve(Response.json({choices:[{message:{content:'{"text":"late fixture"}'}}],usage:{total_tokens:10}})));}}});t.after(()=>{complete?.();app.close();});
 for(const role of roles)await app.store.register('return_'+role,'isolated-owner-password',role);now+=360001;
 for(const [index,role]of roles.entries()){
  const sender=roles[(index+1)%roles.length],owner=app.store.byRole(role),beginning=new Promise(r=>started=r);
  const message=app.store.message(sender,role,index%2?'rest':'hutong','fixture','return-'+role,false,'dm');
  assert.equal(app.replies.enqueue(message)[0].status,'queued');app.replies.pump();await beginning;
  app.presence.connect(owner.id,'returned','generation');complete();await app.replies.drain();
  assert.equal(app.replies.history(sender,role,message.scene,'dm').at(-1).status,'canceled');
  assert.equal(app.store.history(sender,role,message.scene,'dm').filter(m=>m.npc).length,0);
  assert.equal(app.store.history(sender,role,message.scene,'dm').filter(m=>!m.npc).length,1);
  // The next target is independent; prior owners become eligible again.
  now+=360001;
 }
});

test('all eight offline actors walk and work by rules, and ten unattended days make no model requests',async t=>{
 let now=Date.now(),calls=0;t.mock.method(Date,'now',()=>now);
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:'synthetic',fetchImpl:async()=>{calls++;throw Error('idle model request');}}});t.after(()=>app.close());
 for(const role of roles)await app.store.register('idle_'+role,'isolated-idle-password',role);now+=360001;app.autonomy.tick();
 assert.equal(app.autonomy.doubles.size,8);
 for(const p of app.autonomy.doubles.values()){
  const seat=geometry.hutong.seats[desks.hutong[p.role]],point=[seat.approach[0]+24,seat.approach[1]];
  Object.assign(p,{scene:'hutong',x:seat.approach[0],y:seat.approach[1],seat:null,activity:'walk',task:{kind:'walk',scene:'hutong',phase:'arrive',point},next:Infinity,path:route('hutong',seat.approach,point)});
 }
 const before=new Map([...app.autonomy.doubles].map(([id,p])=>[id,[p.x,p.y]]));
 for(let tick=0;tick<30;tick++){now+=100;app.autonomy.tick(now,100);}
 for(const p of app.autonomy.doubles.values()){assert.ok(Math.hypot(p.x-before.get(p.id)[0],p.y-before.get(p.id)[1])>=20,p.role+' rule movement');p.path=[];p.task={kind:'work',scene:'hutong',phase:'arrive'};}
 now+=100;app.autonomy.tick(now,100);
 for(const p of app.autonomy.doubles.values()){assert.equal(p.activity,'working');assert.equal(p.seat,desks.hutong[p.role]);}
 for(let day=0;day<10;day++){
  now+=86400000;app.autonomy.tick();await app.replies.drain();
  await app.llm.choose([{id:'fixture',roles:['laura','sid']}]);await app.llm.dialogue('laura',[],'fixture','hutong');await app.llm.conversation(['laura','sid'],'fixture','hutong');
 }
 assert.equal(calls,0);assert.equal(app.store.db.prepare('SELECT COALESCE(SUM(calls),0) n FROM llm_usage').get().n,0);
});
