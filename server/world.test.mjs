import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from './store.mjs';
import {createWorld} from './world.mjs';
import {createMvpServer} from './app.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('a progress revision changed by another instance invalidates the local cached collection',async()=>{
 const store=openStore(':memory:');
 try{
  const account=await store.register('remote_progress','test-password-123'),first=createWorld(store),second=createWorld(store);
  assert.deepEqual(first.progress(account.user.id),[]);
  second.write(account.user.id,'toy','remote-one',{toy:3});
  assert.equal(first.progress(account.user.id)[0].data.toy,3);
  second.write(account.user.id,'toy','remote-one',{toy:4});
  assert.equal(first.progress(account.user.id)[0].data.toy,4);
 }finally{store.close();}
});

test('shared storage preserves inventory across races, retries and database reopen',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hutong-world-')),path=join(dir,'world.sqlite');let store=openStore(path);
 try{
  const a=await store.register('world_a','test-password-123'),b=await store.register('world_b','test-password-123');store.claim(a.user.id,'suki');store.claim(b.user.id,'sid');let world=createWorld(store);const p={scene:'rest',x:200,y:245,seat:null},players=new Map();
  store.hand(a.user.id,'咖啡',0);const put={object:'rest:table-0',action:'put',slot:0,revision:1,requestId:'put'};world.interact(store.publicAccount(store.byId(a.user.id)),p,put,players);
  const request={object:'rest:table-0',action:'take',slot:0,revision:0,requestId:'take'};world.interact(store.publicAccount(store.byId(b.user.id)),p,request,players);
  assert.throws(()=>world.interact(store.publicAccount(store.byId(a.user.id)),p,{...request,revision:2,requestId:'race'},players),/已被拿走/);
  world.interact(store.publicAccount(store.byId(b.user.id)),p,request,players);assert.equal(store.byId(b.user.id).hand,'咖啡');
  assert.equal(world.snapshot('rest').find(o=>o.id==='rest:table-0').slots[0],null);
  store.close();store=openStore(path);world=createWorld(store);assert.equal(store.byId(b.user.id).hand,'咖啡');assert.equal(world.snapshot('rest').find(o=>o.id==='rest:table-0').slots[0],null);
 }finally{store.close();assert.ok(dir.startsWith(join(tmpdir(),'hutong-world-')));rmSync(dir,{recursive:true});}
});

test('doorway transitions reject teleport, movement cannot manufacture items, progress persists',async t=>{
 const app=createMvpServer({dbPath:':memory:'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const root='http://127.0.0.1:'+app.server.address().port;
 let cookie='';const api=async(path,input)=>{const res=await fetch(root+'/api/'+path,{method:input?'POST':'GET',headers:{Cookie:cookie,'Content-Type':'application/json'},body:input?JSON.stringify(input):undefined});const data=await res.json();return{status:res.status,data,res};};
 const a=await api('register',{username:'route_a',password:'test-password-123'});cookie=a.res.headers.get('set-cookie').split(';')[0];await api('claim',{role:'sid'});await api('control',{client:'a'});
 assert.equal((await api('transition',{client:'a',target:'rest'})).status,409);const p=[...app.players.values()][0];Object.assign(p,{x:596,y:194});assert.equal((await api('transition',{client:'a',target:'rest'})).status,200);
 const pose={client:'a',scene:'rest',x:554,y:184,facing:0,seat:null,hand:'咖啡',revision:0};assert.equal((await api('presence',pose)).status,200);assert.equal((await api('me')).data.user.hand,null);assert.equal((await api('presence',{...pose,scene:'gym'})).status,409);
 assert.equal((await api('progress',{kind:'bead',key:'work',data:{cells:Array(256).fill(2),pattern:'自由',created:1}})).status,200);assert.equal(app.store.db.prepare('SELECT COUNT(*) AS n FROM achievements').get().n,1);
});

test('blind boxes have shared availability, valid theme results and private collections',async()=>{
 const store=openStore(':memory:');try{const a=await store.register('toy_a','test-password-123'),b=await store.register('toy_b','test-password-123');store.claim(a.user.id,'cora');store.claim(b.user.id,'amber');const world=createWorld(store),p={scene:'pop',x:320,y:316,seat:null};
 const input={object:'pop:bikini',action:'draw',slot:0,revision:0,requestId:'draw'};const result=world.interact(store.publicAccount(store.byId(a.user.id)),p,input,new Map());assert.ok([3,4,5].includes(result.progress[0].data.toy));assert.throws(()=>world.interact(store.publicAccount(store.byId(b.user.id)),p,input,new Map()),/取走/);assert.equal(world.progress(b.user.id).length,0);
 }finally{store.close();}
});

test('gacha awards a held toy once and protects an occupied hand',async()=>{
 const store=openStore(':memory:');try{
  const a=await store.register('gacha_a','test-password-123');store.claim(a.user.id,'laura');const world=createWorld(store),p={scene:'pop',x:438,y:162,seat:null},players=new Map();
  const request={object:'pop:classic',action:'gacha',revision:0,requestId:'capsule-one'};
  const result=world.interact(store.publicAccount(store.byId(a.user.id)),p,request,players);
  const toy=result.progress.find(p=>p.kind==='gacha').data.toy;
  assert.equal(store.byId(a.user.id).hand,['扭蛋·粉色小熊','扭蛋·薄荷兔子','扭蛋·蓝色机器人','扭蛋·橘猫','扭蛋·紫色小巫师','扭蛋·皇冠小熊'][toy]);
  world.interact(store.publicAccount(store.byId(a.user.id)),p,request,players);assert.equal(world.progress(a.user.id).length,1);
  assert.throws(()=>world.interact(store.publicAccount(store.byId(a.user.id)),p,{...request,revision:1,requestId:'capsule-two'},players),/放下/);assert.equal(world.progress(a.user.id).length,1);
 }finally{store.close();}
});
