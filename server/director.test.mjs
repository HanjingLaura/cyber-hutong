import test from 'node:test';
import assert from 'node:assert/strict';
import {createMvpServer} from './app.mjs';
import {roles} from './personas.mjs';

async function setup(t){let clock=Date.now();t.mock.method(Date,'now',()=>clock);const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});t.after(()=>app.close());for(const role of roles)await app.store.register('story_'+role,'test-password-123',role);clock+=5001;app.autonomy.tick();for(const p of app.autonomy.doubles.values())p.next=Infinity;
 return{app,step(count=1){for(let i=0;i<count;i++){clock+=100;app.autonomy.tick(clock,100);}},get now(){return clock;}};
}
for(const kind of ['gacha','meet','gift'])test('offline '+kind+' follows actual routes and completes with immutable outcome',async t=>{
 const s=await setup(t),{app}=s,candidate=app.director.candidates(s.now).find(c=>c.kind===kind);assert.ok(candidate);const start=app.autonomy.get(candidate.people[0]);const originalScene=start.scene;
 assert.equal(app.director.start(candidate,s.now),true);const id=app.director.status().active.id;assert.equal(start.scene,originalScene,'starting an activity does not teleport');
 s.step(1700);const row=app.store.db.prepare('SELECT * FROM activities WHERE id=?').get(id);assert.equal(row.status,'completed',row.state);assert.equal(app.director.status().active,null);
 const events=candidate.people.map(account=>app.life.journal(account));
 if(kind==='gacha'){assert.match(app.store.byId(start.id).hand,/^扭蛋·/);assert.equal(start.scene,'pop');assert.ok(events[0].some(e=>e.eventId===id&&e.data.actors.some(p=>p.hand?.startsWith('扭蛋·'))));}
 if(kind==='gift'){const recipient=app.store.byId(candidate.people[1]);assert.equal(recipient.hand,'咖啡');assert.equal(app.store.byId(start.id).hand,null);const a=events[0].find(e=>e.eventId.endsWith(':completed')),b=events[1].find(e=>e.eventId===a?.eventId);assert.ok(a&&b);assert.deepEqual(a.data,b.data);assert.ok(a.data.actors.some(p=>p.role===recipient.role&&p.hand==='咖啡'));}
 if(kind==='meet'){const a=events[0].find(e=>e.eventId===id),b=events[1].find(e=>e.eventId===id);assert.ok(a&&b);assert.deepEqual(a.data,b.data);assert.deepEqual(a.data.participants,candidate.roles);assert.equal(a.data.actors.filter(p=>candidate.roles.includes(p.role)&&p.seat&&p.activity==='sit').length,2);}
});

test('one global clock controls eight offline people; participant cooldown and login interruption are enforced',async t=>{
 const s=await setup(t),{app}=s,next=app.director.status().nextAt;assert.ok(next>=s.now+20*60000&&next<=s.now+30*60000);s.step(1000);assert.equal(app.store.db.prepare('SELECT count(*) AS n FROM activities').get().n,0);
 const candidate=app.director.candidates(s.now).find(c=>c.kind==='gift');app.director.start(candidate,s.now);const id=app.director.status().active.id;
 assert.equal(app.director.start(candidate,s.now),false);app.autonomy.reclaim(candidate.people[0]);assert.equal(app.director.status().active,null);assert.equal(app.store.db.prepare('SELECT status FROM activities WHERE id=?').get(id).status,'interrupted');assert.ok(!app.life.journal(candidate.people[0]).some(e=>e.eventId.endsWith(':completed')));
});

test('shared snapshots are exactly once and preserve NPC visibility after the world changes',async t=>{
 const s=await setup(t),{app}=s,a=app.store.byRole('sid'),b=app.store.byRole('laura'),p=app.autonomy.get(a.id);Object.assign(p,{scene:'hutong',seat:'L1',activity:'working',x:192,y:242.12});
 app.life.recordGroup([a.id,b.id],'greet','一起看到了 Ani。','hutong',s.now,'shared-ani');const first=app.life.journal(a.id)[0];assert.ok(first.data.npcs.some(n=>n.id==='ani'));
 Object.assign(p,{seat:null,activity:'walk'});app.life.recordGroup([a.id,b.id],'greet','重复请求不得改变记录。','hutong',s.now,'shared-ani');assert.deepEqual(app.life.journal(a.id)[0],first);assert.deepEqual(app.life.journal(b.id)[0].data,first.data);
});
