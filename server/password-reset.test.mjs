import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {openStore} from './store.mjs';
import {createMvpServer} from './app.mjs';

test('organizer code changes one account password once, preserves its role/items and revokes its sessions',async t=>{
 const store=openStore(':memory:');t.after(()=>store.close());
 const a=await store.register('reset_laura','old-password-123','laura'),b=await store.register('reset_sid','other-password-123','sid');
 const second=await store.login('reset_laura','old-password-123');store.hand(a.user.id,'咖啡',0);
 const issued=store.createPasswordReset('reset_laura');
 assert.match(issued.code,/^(?:[A-F0-9]{4}-){7}[A-F0-9]{4}$/);
 assert.ok(issued.expires>Date.now());assert.ok(issued.expires<=Date.now()+30*60*1000);
 assert.ok(!JSON.stringify(store.db.prepare('SELECT * FROM password_resets').all()).includes(issued.code.replaceAll('-','')));
 await assert.rejects(store.resetPassword('reset_sid',issued.code,'new-password-123'),e=>e.status===400);
 await store.resetPassword('reset_laura',issued.code.toLowerCase().replaceAll('-',' '),'new-password-123');
 assert.equal(store.session(a.token),null);assert.equal(store.session(second.token),null);assert.equal(store.session(b.token).id,b.user.id);
 assert.equal(store.byId(a.user.id).role,'laura');assert.equal(store.byId(a.user.id).hand,'咖啡');
 await assert.rejects(store.login('reset_laura','old-password-123'),e=>e.status===401);
 assert.equal((await store.login('reset_laura','new-password-123')).user.id,a.user.id);
 await assert.rejects(store.resetPassword('reset_laura',issued.code,'another-password-123'),e=>e.status===400);
});

test('wrong, expired, replaced and unknown-account codes cannot reset passwords; password validation keeps a valid code',async t=>{
 const store=openStore(':memory:');t.after(()=>store.close());await store.register('reset_cora','old-password-123','cora');
 const first=store.createPasswordReset('reset_cora'),second=store.createPasswordReset('reset_cora');
 const messages=[];
 for(const [name,code]of [['reset_cora','0000-0000'],['unknown',second.code],['reset_cora',first.code]]){
   await assert.rejects(store.resetPassword(name,code,'new-password-123'),e=>{messages.push(e.message);return e.status===400;});
 }
 assert.equal(new Set(messages).size,1);
 await assert.rejects(store.resetPassword('reset_cora',second.code,'short'),e=>e.status===400);
 store.db.prepare('UPDATE password_resets SET expires=?').run(Date.now()-1);
 await assert.rejects(store.resetPassword('reset_cora',second.code,'new-password-123'),e=>e.status===400);
 assert.ok(await store.login('reset_cora','old-password-123'));
 const current=store.createPasswordReset('reset_cora');await store.resetPassword('reset_cora',current.code,'new-password-123');
});

async function fixture(t,commitRequest){
 const app=createMvpServer({dbPath:':memory:',commitRequest});t.after(()=>{app.close();app.server.closeAllConnections();});
 const registered=await app.store.register('reset_amber','old-password-123','amber');
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const origin='http://127.0.0.1:'+app.server.address().port;
 const post=(input,headers={},method='POST')=>fetch(origin+'/cyber-hutong/api/reset-password',{method,headers:{'Content-Type':'application/json',...headers},...(method==='POST'?{body:JSON.stringify(input)}:{})});
 return {app,registered,origin,post};
}

test('public reset endpoint enforces POST, origin, secret, rate limiting and clears the browser cookie',async t=>{
 const {app,registered,post}=await fixture(t);const issued=app.store.createPasswordReset('reset_amber');
 assert.equal((await post({}, {},'GET')).status,405);
 assert.equal((await post({username:'reset_amber',code:issued.code,password:'new-password-123'},{Origin:'https://evil.example'})).status,403);
 const response=await post({username:'reset_amber',code:issued.code,password:'new-password-123'});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal(app.store.session(registered.token),null);
 for(let i=0;i<5;i++)assert.equal((await post({username:'reset_amber',code:'bad',password:'new-password-123'})).status,400);
 assert.equal((await post({username:'reset_amber',code:'bad',password:'new-password-123'})).status,429);
});

test('failed durable password reset leaves the original password, session and reset code usable',async t=>{
 let failing=true;const {app,registered,post}=await fixture(t,async()=>{if(failing)throw new Error('remote offline');});
 const issued=app.store.createPasswordReset('reset_amber'),input={username:'reset_amber',code:issued.code,password:'new-password-123'};
 const stream={user:registered.user.id,client:'reset-check',token:registered.token,res:{writableEnded:false,writableLength:0,destroyed:false,write(){},end(){this.writableEnded=true;}}};app.streams.add(stream);
 const failed=await post(input);assert.equal(failed.status,503);assert.equal(failed.headers.get('set-cookie'),null);
 assert.equal(stream.res.writableEnded,false);
 assert.equal(app.store.session(registered.token).id,registered.user.id);assert.ok(await app.store.login('reset_amber','old-password-123'));
 failing=false;assert.equal((await post(input)).status,200);assert.equal(stream.res.writableEnded,true);assert.ok(await app.store.login('reset_amber','new-password-123'));
});

test('two simultaneous resets can consume one organizer code only once',async t=>{
 const store=openStore(':memory:');t.after(()=>store.close());await store.register('reset_jilly','old-password-123','jilly');
 const issued=store.createPasswordReset('reset_jilly');
 const results=await Promise.allSettled(['first-password-123','second-password-123'].map(password=>store.resetPassword('reset_jilly',issued.code,password)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.status===400).length,1);
});
