import test from 'node:test';
import assert from 'node:assert/strict';
import {createMvpServer} from './app.mjs';
test('validated travel checkpoint persists the exit even inside the normal save interval',async t=>{
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});t.after(()=>app.close());
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const account=await app.store.register('checkpoint_user','checkpoint-password','laura'),origin='http://127.0.0.1:'+app.server.address().port;
 async function api(path,input){const response=await fetch(origin+'/api/'+path,{method:'POST',headers:{Cookie:'hutong_session='+account.token,'Content-Type':'application/json'},body:JSON.stringify(input)});return {status:response.status,body:await response.json()};}
 await api('control',{client:'checkpoint'});const p=app.players.get(account.user.id);
 Object.assign(p,{scene:'hutong',x:560,y:194,seat:null,activity:'walk',fresh:false,at:Date.now()-1000,savedAt:Date.now()});app.life.savePosition(p);
 const pose={client:'checkpoint',scene:'hutong',x:596,y:194,facing:0,seat:null,hand:null,activity:'walk',checkpoint:true};
 const confirmed=await api('presence',pose);assert.equal(confirmed.status,200);
 assert.equal(app.life.position(account.user.id).x,596,'next server replica must see the exit checkpoint');
 // A cold instance reconstructs its live player from the durable position.
 app.players.delete(account.user.id);app.autonomy.doubles.delete(account.user.id);
 assert.equal((await api('transition',{client:'checkpoint',target:'rest',checkpoint:confirmed.body.checkpoint})).status,200);
});

test('another warm replica consumes only the latest verified controller checkpoint',async t=>{
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});t.after(()=>app.close());await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const account=await app.store.register('checkpoint_warm','checkpoint-password','laura'),origin='http://127.0.0.1:'+app.server.address().port;
 const api=async(path,input)=>{const r=await fetch(origin+'/api/'+path,{method:'POST',headers:{Cookie:'hutong_session='+account.token,'Content-Type':'application/json'},body:JSON.stringify(input)});return {status:r.status,body:await r.json()};};
 await api('control',{client:'owner'});const p=app.players.get(account.user.id);
 Object.assign(p,{scene:'hutong',x:560,y:194,seat:null,activity:'walk',fresh:false,at:Date.now()-1000,savedAt:Date.now()});app.life.savePosition(p);
 const stale={...p},confirmed=await api('presence',{client:'owner',scene:'hutong',x:596,y:194,facing:0,seat:null,hand:null,activity:'walk',checkpoint:true});
 assert.equal(confirmed.status,200);assert.equal(typeof confirmed.body.checkpoint,'string');
 Object.assign(p,stale);delete p.checkpoint;
 assert.equal((await api('transition',{client:'owner',target:'rest',checkpoint:'forged'})).status,409);
 assert.equal((await api('transition',{client:'viewer',target:'rest',checkpoint:confirmed.body.checkpoint})).status,409);
 const saved=app.life.position(account.user.id);
 app.life.savePosition({id:p.id,...saved},{checkpoint:{...saved.checkpoint,at:Date.now()-120001}});
 assert.equal((await api('transition',{client:'owner',target:'rest',checkpoint:confirmed.body.checkpoint})).status,409,'expired checkpoint cannot be used');
 app.life.savePosition({id:p.id,...saved},{checkpoint:saved.checkpoint});
 Object.assign(p,{at:Date.now()+1,x:550});
 assert.equal((await api('transition',{client:'owner',target:'rest',checkpoint:confirmed.body.checkpoint})).status,409,'old checkpoint cannot overwrite newer live movement');
 Object.assign(p,stale);
 assert.equal((await api('transition',{client:'owner',target:'rest',checkpoint:confirmed.body.checkpoint})).status,200);
 assert.equal(app.life.position(account.user.id).checkpoint,undefined,'successful travel consumes checkpoint');
 assert.equal((await api('transition',{client:'owner',target:'ktv',checkpoint:confirmed.body.checkpoint})).status,409,'consumed source cannot be replayed');
});
test('travel checkpoint still rejects invalid movement and foreign controllers',async t=>{
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});t.after(()=>app.close());await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const account=await app.store.register('checkpoint_guard','checkpoint-password','laura'),origin='http://127.0.0.1:'+app.server.address().port;
 const api=async(path,input)=>{const r=await fetch(origin+'/api/'+path,{method:'POST',headers:{Cookie:'hutong_session='+account.token,'Content-Type':'application/json'},body:JSON.stringify(input)});return r.status;};
 await api('control',{client:'owner'});const p=app.players.get(account.user.id);Object.assign(p,{x:320,y:194,at:Date.now(),fresh:false});app.life.savePosition(p);
 const pose={client:'owner',scene:'hutong',x:596,y:194,facing:0,seat:null,hand:null,activity:'walk',checkpoint:true};
 assert.equal(await api('presence',pose),409);assert.equal(app.life.position(account.user.id).x,320);
 assert.equal(await api('presence',{...pose,client:'viewer'}),409);
});

test('ordinary movement on another instance revokes a durable exit checkpoint immediately',async t=>{
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});t.after(()=>app.close());await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const account=await app.store.register('checkpoint_revoke','checkpoint-password','laura'),origin='http://127.0.0.1:'+app.server.address().port;
 const api=async(path,input)=>{const r=await fetch(origin+'/api/'+path,{method:'POST',headers:{Cookie:'hutong_session='+account.token,'Content-Type':'application/json'},body:JSON.stringify(input)});return {status:r.status,body:await r.json()};};
 await api('control',{client:'owner'});const p=app.players.get(account.user.id);
 Object.assign(p,{scene:'hutong',x:596,y:194,seat:null,activity:'walk',fresh:false,at:Date.now()-1000,savedAt:Date.now()});
 const pose={client:'owner',scene:'hutong',x:596,y:194,facing:0,seat:null,hand:null,activity:'walk'};
 const confirmed=await api('presence',{...pose,checkpoint:true});assert.equal(confirmed.status,200);
 const staleWarm={...p,checkpoint:{...p.checkpoint}};
 // Another warm instance has only its local pose, not the marker created elsewhere.
 delete p.checkpoint;p.at=Date.now()-1000;
 assert.equal((await api('presence',{...pose,x:540})).status,200);
 assert.equal(app.life.position(account.user.id).checkpoint,undefined);
 assert.equal(app.life.position(account.user.id).x,540);
 app.life.savePosition(staleWarm);
 assert.equal(app.life.position(account.user.id).checkpoint,undefined,'stale disconnect/logout saves must never resurrect a revoked marker');
 Object.assign(p,{x:560,at:Date.now()-2000});
 assert.equal((await api('transition',{client:'owner',target:'rest',checkpoint:confirmed.body.checkpoint})).status,409);
});
