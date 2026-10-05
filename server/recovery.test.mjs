import test from 'node:test';
import assert from 'node:assert/strict';
import {createMvpServer} from './app.mjs';
import {openStore} from './store.mjs';
import {createWorld} from './world.mjs';
import {copyDatabase} from '../scripts/database.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('concurrent registration never exceeds the eight-account limit',async()=>{
 const store=openStore(':memory:');try{const result=await Promise.allSettled(Array.from({length:9},(_,i)=>store.register('capacity_'+i,'test-password-123')));assert.equal(result.filter(r=>r.status==='fulfilled').length,8);assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n,8);}finally{store.close();}
});

test('live WAL backup and restore preserve seasoned dishes, collections and gift ownership',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hutong-recovery-')),source=join(dir,'live.sqlite'),backup=join(dir,'backup.sqlite'),target=join(dir,'restored.sqlite');let store=openStore(source);
 try{const a=await store.register('restore_a','test-password-123'),b=await store.register('restore_b','test-password-123');store.claim(a.user.id,'suki');store.claim(b.user.id,'sid');const world=createWorld(store),p={scene:'noodle',x:213,y:285,seat:'0'};
 store.db.prepare("UPDATE accounts SET hand='米线',seasoning='[\"醋\"]',revision=1 WHERE id=?").run(a.user.id);
 world.interact(a.user,p,{object:'noodle:table-0',action:'put',slot:0,revision:1,requestId:'put'},new Map());
 world.interact(b.user,p,{object:'noodle:table-0',action:'take',slot:0,revision:0,requestId:'take'},new Map());
 store.gift(b.user.id,'suki','gift',1);world.write(a.user.id,'score','mines',{value:1});
 copyDatabase(source,backup);copyDatabase(backup,target);assert.throws(()=>copyDatabase(source,target),/已存在/);store.close();store=openStore(target);const restored=createWorld(store);
 assert.equal(store.byId(a.user.id).hand,'米线');assert.deepEqual(JSON.parse(store.byId(a.user.id).seasoning),['醋']);assert.equal(store.byId(b.user.id).hand,null);assert.equal(restored.progress(a.user.id)[0].data.value,1);assert.equal(restored.snapshot('noodle').find(o=>o.id==='noodle:table-0').slots[0],null);
 }finally{store.close();assert.ok(dir.startsWith(join(tmpdir(),'hutong-recovery-')));rmSync(dir,{recursive:true});}
});

test('seat and device claims require proximity and release on logout',async t=>{
 const app=createMvpServer({dbPath:':memory:'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const root='http://127.0.0.1:'+app.server.address().port;let cookie='';
 const api=async(path,input)=>{const res=await fetch(root+'/api/'+path,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(input)});return{status:res.status,data:await res.json(),res};};
 const a=await api('register',{username:'lease_a',password:'test-password-123'});cookie=a.res.headers.get('set-cookie').split(';')[0];await api('claim',{role:'sid'});await api('control',{client:'a'});
 const pose={client:'a',scene:'hutong',x:500,y:194,facing:0,seat:null,hand:null,activity:'walk'};
 assert.equal((await api('presence',{...pose,activity:'anything',x:610,y:340})).status,409);
 assert.equal((await api('presence',{...pose,seat:'fake-seat'})).status,409);
 const p=[...app.players.values()][0];Object.assign(p,{scene:'arcade',x:568,y:212,at:Date.now()-3000});assert.equal((await api('lease',{client:'a',device:'mines'})).status,409);
 Object.assign(p,{x:95,y:205});assert.equal((await api('lease',{client:'a',device:'mines'})).status,200);Object.assign(p,{x:568,y:212});assert.equal((await api('transition',{client:'a',target:'rest'})).status,409);await api('lease',{client:'a',device:'mines',release:true});assert.equal((await api('transition',{client:'a',target:'rest'})).status,200);
 Object.assign(p,{scene:'gym',x:225,y:155});assert.equal((await api('lease',{client:'a',device:'run-0'})).status,200);await api('logout',{});assert.equal(app.players.size,0);
});

test('short disconnect preserves location; service restart clears occupancy and keeps inventory',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hutong-reconnect-')),path=join(dir,'world.sqlite');let app=createMvpServer({dbPath:path});const streams=[];
 try{const listen=async()=>{await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+app.server.address().port;};let root=await listen();let cookie='';
 const api=async(name,input)=>{const res=await fetch(root+'/api/'+name,{method:input?'POST':'GET',headers:{Cookie:cookie,'Content-Type':'application/json'},body:input?JSON.stringify(input):undefined});return{res,data:await res.json()};};
 const registered=await api('register',{username:'reconnect_a',password:'test-password-123'});cookie=registered.res.headers.get('set-cookie').split(';')[0];await api('claim',{role:'suki'});
 const stream=async(client)=>{const abort=new AbortController();streams.push(abort);const res=await fetch(root+'/api/events?client='+client,{headers:{Cookie:cookie},signal:abort.signal});const reader=res.body.getReader();await reader.read();return{abort,reader};};
 const first=await stream('first'),p=[...app.players.values()][0];Object.assign(p,{scene:'rest',x:177,y:236.6,seat:'0'});app.store.hand(p.id,'咖啡',0);first.abort.abort();await new Promise(r=>setTimeout(r,80));assert.equal(app.players.get(p.id).scene,'rest');assert.ok(app.players.get(p.id).disconnectedAt);
 const second=await stream('second');assert.equal(app.players.get(p.id).scene,'rest');assert.equal(app.players.get(p.id).seat,'0');second.abort.abort();await new Promise(r=>setTimeout(r,50));app.close();app=createMvpServer({dbPath:path});root=await listen();await stream('third');const restored=[...app.players.values()][0];assert.equal(restored.seat,null);assert.equal(restored.scene,'rest');assert.equal(restored.x,177);assert.equal((await api('me')).data.user.hand,'咖啡');
 }finally{streams.forEach(a=>a.abort());app.close();assert.ok(dir.startsWith(join(tmpdir(),'hutong-reconnect-')));rmSync(dir,{recursive:true});}
});
