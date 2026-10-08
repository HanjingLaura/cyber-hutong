import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {request as httpRequest} from 'node:http';
import {Readable} from 'node:stream';
import {openStore} from './store.mjs';
import {createLife} from './life.mjs';
import {createMvpServer} from './app.mjs';

async function pair(t){const store=openStore(':memory:');t.after(()=>store.close());const a=await store.register('hardening_a','test-password-123','laura'),b=await store.register('hardening_b','test-password-123','sid');return{store,life:createLife(store),a:a.user,b:b.user};}
test('inherited and non-string destinations are rejected before creating an invitation',async t=>{
 const {life,a}=await pair(t);for(const place of ['toString','constructor','__proto__',{},[]])assert.throws(()=>life.send(a.id,'sid','meet','bad-'+String(place),'hutong',undefined,place),e=>e.status===400);
});
test('a role stays claimed after its original account no longer has the role',async t=>{
 const {store,a,b}=await pair(t);store.db.prepare('UPDATE accounts SET role=NULL WHERE id=?').run(a.id);
 assert.equal(store.roster().find(r=>r.role==='laura').claimed,true);
 store.db.prepare('UPDATE accounts SET role=NULL WHERE id=?').run(b.id);
 assert.throws(()=>store.claim(b.id,'laura'),e=>e.status===409);
 await assert.rejects(store.register('hardening_c','test-password-123','laura'),e=>e.status===409);
});
test('accepted invitations persist two adjacent relocations and complete only after both arrive',async t=>{
 const {store,life,a,b}=await pair(t);store.hand(a.id,'咖啡',0);
 const offer=life.send(a.id,'sid','meet','travel-1','hutong',undefined,'arcade');
 assert.equal(life.respond(b.id,offer.id,'accept').status,'accepted');
 const first=life.travel(a.id),second=life.travel(b.id);
 assert.equal(first.offer,offer.id);assert.equal(second.offer,offer.id);
 const pa=life.position(a.id),pb=life.position(b.id);assert.equal(pa.scene,'arcade');assert.equal(pb.scene,'arcade');assert.ok(Math.hypot(pa.x-pb.x,pa.y-pb.y)>=20);assert.ok(Math.hypot(pa.x-pb.x,pa.y-pb.y)<60);
 life.finishMeetings([{id:a.id,role:a.role,...pa},{id:b.id,role:b.role,...pb}]);assert.ok(life.meeting(a.id));
 life.ackTravel(a.id,offer.id);life.ackTravel(b.id,offer.id);life.finishMeetings([{id:a.id,role:a.role,...pa},{id:b.id,role:b.role,...pb}]);assert.equal(life.meeting(a.id),undefined);
 assert.equal(store.byId(a.id).hand,'咖啡');assert.equal(life.respond(b.id,offer.id,'accept').status,'completed');
 assert.equal(life.send(a.id,'sid','meet','travel-1','hutong',undefined,'arcade').id,offer.id);
});
test('terminal invitation retries do not create another invitation',async t=>{
 const {life,a,b}=await pair(t);const o=life.send(a.id,'sid','meet','terminal','hutong');life.respond(b.id,o.id,'reject');assert.equal(life.send(a.id,'sid','meet','terminal','hutong').status,'rejected');
});
test('failed durable commit returns 503 without account, session or cookie success',async t=>{
 const app=createMvpServer({dbPath:':memory:',commitRequest:async()=>{throw new Error('remote unavailable');}});t.after(()=>{app.close();app.server.closeAllConnections();});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 const res=await fetch('http://127.0.0.1:'+app.server.address().port+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'commit_fail',password:'test-password-123',role:'franco'})});
 assert.equal(res.status,503);assert.equal(res.headers.get('set-cookie'),null);assert.equal(app.store.byRole('franco'),undefined);assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM sessions').get().n,0);
});
test('a reconnect retains an accepted relocation after meeting expiry',async t=>{
 const {life,a,b}=await pair(t),o=life.send(a.id,'sid','meet','expired-travel','hutong',undefined,'ktv');life.respond(b.id,o.id,'accept');life.expire(o.expires+1);assert.equal(life.travel(a.id).offer,o.id);assert.equal(life.travel(b.id).state.scene,'ktv');assert.equal(life.respond(b.id,o.id,'accept').status,'expired');
});
test('ordinary walking cannot enter KTV furniture after initial presence',async t=>{
 const app=createMvpServer({dbPath:':memory:'});t.after(()=>{app.close();app.server.closeAllConnections();});const registered=await app.store.register('walking','test-password-123','franco');app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const root='http://127.0.0.1:'+app.server.address().port,cookie='hutong_session='+registered.token;
 const post=async(path,input)=>fetch(root+'/api/'+path,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(input)});
 await post('control',{client:'a'});const p=app.players.get(registered.user.id);Object.assign(p,{scene:'ktv',x:320,y:310,at:Date.now()-3000});delete p.fresh;
 const r=await post('presence',{client:'a',scene:'ktv',x:200,y:252,facing:0,seat:null,hand:null,activity:'walk'});assert.equal(r.status,409);assert.equal(p.x,320);assert.equal(p.y,310);
});
test('an incomplete upload does not queue or pause unrelated health requests',async t=>{
 const app=createMvpServer({dbPath:':memory:',commitRequest:async()=>{}});t.after(()=>{app.close();app.server.closeAllConnections();});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const root='http://127.0.0.1:'+app.server.address().port;
 const upload=httpRequest(root+'/api/register',{method:'POST',headers:{'Content-Length':100,'Content-Type':'application/json'}});upload.on('error',()=>{});upload.write('{');await new Promise(r=>setTimeout(r,20));
 try{const response=await fetch(root+'/api/health',{signal:AbortSignal.timeout(1000)});assert.equal(response.status,200);}finally{upload.destroy();}
});
test('function adapters with an already parsed body still commit registration',async t=>{
 const app=createMvpServer({dbPath:':memory:',commitRequest:async()=>{}});t.after(()=>app.close());const req=Readable.from([]);Object.assign(req,{method:'POST',url:'/api/register',headers:{host:'localhost'},socket:{remoteAddress:'127.0.0.1'},body:{username:'adapter_body',password:'test-password-123',role:'amber'}});
 const res={headersSent:false,headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(status,headers={}){this.status=status;Object.assign(this.headers,headers);this.headersSent=true;},end(value){this.value=value;}};await app.server.listeners('request')[0](req,res);assert.equal(res.status,200);assert.equal(JSON.parse(res.value).user.role,'amber');
});
