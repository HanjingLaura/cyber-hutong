import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from './store.mjs';
import {createLife} from './life.mjs';
import {createAutonomy,route,walkable} from './autonomy.mjs';
import {createMvpServer} from './app.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {copyDatabase} from '../scripts/database.mjs';

async function fixture(t){const store=openStore(':memory:');t.after(()=>store.close());const a=await store.register('life_laura','test-password-123','laura'),b=await store.register('life_sid','test-password-123','sid');return{store,life:createLife(store),a:a.user,b:b.user};}
test('four bag slots stack five each and preserve seasoning, no duplication on retries',async t=>{
 const {store,life,a}=await fixture(t);for(let i=0;i<20;i++){store.hand(a.id,'咖啡',store.byId(a.id).revision);const input={action:'stow',revision:store.byId(a.id).revision,requestId:'stow-'+i};life.inventory(a.id,input,'rest');life.inventory(a.id,input,'rest');}
 assert.deepEqual(life.bag(a.id).map(s=>s.count),[5,5,5,5]);store.hand(a.id,'咖啡',store.byId(a.id).revision);assert.throws(()=>life.inventory(a.id,{action:'stow',revision:store.byId(a.id).revision,requestId:'full'},'rest'),/背包已满/);assert.equal(store.byId(a.id).hand,'咖啡');
 life.inventory(a.id,{action:'consume',revision:store.byId(a.id).revision,requestId:'drink'},'rest');life.inventory(a.id,{action:'equip',slot:0,revision:store.byId(a.id).revision,requestId:'equip'},'rest');assert.equal(life.bag(a.id)[0].count,4);assert.equal(store.byId(a.id).hand,'咖啡');assert.throws(()=>life.inventory(a.id,{action:'equip',slot:1,revision:store.byId(a.id).revision,requestId:'double'},'rest'),/先收起/);
});
test('gifts reserve their item, rejection and expiry do not lose it; acceptance transfers once',async t=>{
 const {store,life,a,b}=await fixture(t);store.hand(a.id,'咖啡',0);const first=life.send(a.id,'sid','gift','offer-1','rest',1);assert.throws(()=>life.inventory(a.id,{action:'consume',revision:1,requestId:'locked'},'rest'),/等待对方回应/);assert.throws(()=>life.respond(a.id,first.id,'accept'),/对方回应/);life.respond(b.id,first.id,'reject');assert.equal(store.byId(a.id).hand,'咖啡');
 const second=life.send(a.id,'sid','gift','offer-2','rest',1);life.expire(second.expires+1);assert.equal(store.byId(a.id).hand,'咖啡');assert.equal(life.respond(b.id,second.id,'accept').status,'expired');
 const third=life.send(a.id,'sid','gift','offer-3','rest',1);life.respond(b.id,third.id,'accept');life.respond(b.id,third.id,'accept');assert.equal(store.byId(a.id).hand,null);assert.equal(store.byId(b.id).hand,'咖啡');assert.equal(life.send(a.id,'sid','gift','offer-3','rest',1).id,third.id);
 assert.ok(life.journal(a.id).some(e=>e.body.includes('收下了')));
});
test('meetups require acceptance, finish on actual co-location, cancel and timeout stay terminal',async t=>{
 const {life,a,b}=await fixture(t);const one=life.send(a.id,'sid','meet','meet-1','hutong');life.respond(b.id,one.id,'accept');life.finishMeetings([{id:a.id,role:'laura',scene:'hutong',x:320,y:190},{id:b.id,role:'sid',scene:'rest',x:320,y:190}]);assert.ok(life.meeting(a.id));life.finishMeetings([{id:a.id,role:'laura',scene:'rest',x:320,y:190},{id:b.id,role:'sid',scene:'rest',x:320,y:195}]);assert.equal(life.meeting(a.id),undefined);
 const two=life.send(a.id,'sid','meet','meet-2','hutong');life.respond(b.id,two.id,'accept');life.respond(a.id,two.id,'cancel');assert.equal(life.respond(b.id,two.id,'accept').status,'cancelled');const three=life.send(a.id,'sid','meet','meet-3','hutong');life.expire(three.expires+1);assert.equal(life.offers(a.id).length,0);
});
test('offline rules use furniture routes and surrender to the human without two copies',async t=>{
 const {store,life,a}=await fixture(t),players=new Map(),npc=createAutonomy(store,life,players);npc.tick();const p=npc.get(a.id);assert.ok(p);p.next=0;const random=Math.random;Math.random=()=>0;try{for(let i=0;i<150;i++)npc.tick(Date.now()+i*100,100);}finally{Math.random=random;}
 assert.equal(p.activity,'working');assert.equal(p.seat,'L3');assert.equal(life.journal(a.id).length,0,'routine office activity does not create a story');const remembered=npc.reclaim(a.id);assert.equal(npc.doubles.size,1); // Sid still offline.
 players.set(a.id,remembered);npc.tick(Date.now()+10000);assert.equal(npc.all().filter(p=>p.role==='laura').length,1);
 const path=route('rest',[554,184],[314,156]);assert.ok(path.length);assert.ok(path.every(([x,y])=>walkable('rest',x,y)));
});
test('journal is private and read-only; position restores across service recreation',async t=>{
 const store=openStore(':memory:');store.close();const app=createMvpServer({dbPath:':memory:'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const root='http://127.0.0.1:'+app.server.address().port;
 const register=async(username,role)=>{const r=await fetch(root+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'test-password-123',role})});return{user:(await r.json()).user,cookie:r.headers.get('set-cookie').split(';')[0]};};
 const a=await register('reader_laura','laura'),b=await register('reader_sid','sid');app.life.record(a.user.id,'private','自己的经历','rest');
 assert.equal((await(await fetch(root+'/api/journal?account='+a.user.id,{headers:{Cookie:b.cookie}})).json()).entries.length,0);
 for(const path of ['journal','journal/delete','journal/correct']){const r=await fetch(root+'/api/'+path,{method:'POST',headers:{Cookie:a.cookie,'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,404);}
 assert.equal(app.life.journal(a.user.id).length,1);app.life.savePosition({id:a.user.id,scene:'rest',x:300,y:190,facing:1,seat:null,activity:'walk'});assert.equal(app.life.position(a.user.id).scene,'rest');
});
test('backup and reopen preserve history, backpack, location and pending gift reservation',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hutong-life-')),source=join(dir,'source.sqlite'),target=join(dir,'backup.sqlite');let store=openStore(source);
 try{const a=(await store.register('backup_laura','test-password-123','laura')).user,b=(await store.register('backup_sid','test-password-123','sid')).user;let life=createLife(store);
  store.hand(a.id,'咖啡',0);life.inventory(a.id,{action:'stow',revision:1,requestId:'pack'},'rest');store.hand(a.id,'面包',store.byId(a.id).revision);const offer=life.send(a.id,'sid','gift','pending','rest');life.savePosition({id:a.id,scene:'rest',x:314,y:180,facing:1,seat:null,activity:'walk'});life.record(a.id,'visit','在平行空间留下的经历。','rest');
  copyDatabase(source,target);store.close();store=openStore(target);life=createLife(store);assert.equal(life.bag(a.id)[0].name,'咖啡');assert.equal(life.position(a.id).x,314);assert.ok(life.journal(a.id).some(e=>e.body==='在平行空间留下的经历。'));assert.throws(()=>life.unlocked(a.id),/等待对方回应/);life.respond(b.id,offer.id,'accept');assert.equal(store.byId(b.id).hand,'面包');assert.equal(store.byId(a.id).hand,null);
 }finally{store.close();assert.ok(dir.startsWith(join(tmpdir(),'hutong-life-')));rmSync(dir,{recursive:true});}
});
test('offline exercise reserves a real treadmill and relinquishes it on login',async t=>{
 const {store,life,a,b}=await fixture(t);const kay=(await store.register('life_kay','test-password-123','kay')).user,players=new Map([[a.id,{id:a.id,role:'laura',scene:'hutong',x:384,y:194}],[b.id,{id:b.id,role:'sid',scene:'hutong',x:192,y:194}]]),leases=new Map(),npc=createAutonomy(store,life,players,leases);npc.tick();const p=npc.get(kay.id);p.next=0;
 const original=Math.random;Math.random=()=>.9;try{for(let i=0;i<600;i++)npc.tick(Date.now()+i*100,100);}finally{Math.random=original;}
 assert.equal(p.activity,'run');assert.equal(p.scene,'gym');assert.equal(leases.get('gym:run-0').account,kay.id);npc.reclaim(kay.id);assert.equal(leases.size,0);assert.equal(life.position(kay.id).y,155);
});

test('event pictures preserve authoritative actors and objects instead of following live state',async t=>{
 const app=createMvpServer({dbPath:':memory:'});t.after(()=>app.close());
 const a=(await app.store.register('picture_laura','test-password-123','laura')).user;
 app.players.set(a.id,{id:a.id,role:'laura',scene:'rest',x:300,y:180,facing:1,moving:false,seat:null,activity:'walk'});
 app.store.hand(a.id,'咖啡',0);app.life.record(a.id,'visit','留下画面的经历。','rest');
 const saved=app.life.journal(a.id)[0];assert.equal(saved.data.version,1);assert.equal(saved.data.actors[0].hand,'咖啡');assert.equal(saved.data.actors[0].x,300);assert.ok(saved.data.objects.some(o=>o.id==='rest:fridge'));
 app.players.get(a.id).x=450;app.store.hand(a.id,null,1);const old=app.life.journal(a.id)[0];assert.equal(old.data.actors[0].x,300);assert.equal(old.data.actors[0].hand,'咖啡');
});

test('routine cooldown persists through recreation and skips snapshots without suppressing deliberate interactions',async t=>{
 const {store,life,a}=await fixture(t);let captures=0;life.setSceneProvider(()=>{captures++;return{version:1};});const at=Date.now();
 assert.equal(life.record(a.id,'coffee','接了一杯咖啡。','rest',at,{routine:true}).changes,1);
 assert.equal(life.record(a.id,'coffee','接了一杯咖啡。','rest',at+1000,{routine:true}).changes,0);assert.equal(captures,1);
 const reopened=createLife(store);assert.equal(reopened.record(a.id,'coffee','接了一杯咖啡。','rest',at+10*60000,{routine:true}).changes,0);
 assert.equal(reopened.record(a.id,'coffee','接了一杯咖啡。','rest',at+30*60000,{routine:true}).changes,1);
 for(let i=0;i<30;i++)reopened.record(a.id,'gift','真实的赠送。','rest',at+i);assert.equal(reopened.journal(a.id).filter(e=>e.kind==='gift').length,30);
 const policy={key:'encounter:laura:sid',cooldown:60*60000};assert.equal(reopened.record(a.id,'encounter','碰面。','rest',at,policy).changes,1);
 assert.equal(createLife(store).record(a.id,'encounter','换一个房间碰面。','hutong',at+1000,policy).changes,0);
});
