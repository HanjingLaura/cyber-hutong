import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {DatabaseSync} from 'node:sqlite';
import {createClient} from '@libsql/client';
import {prepareReplica} from './replica.mjs';
import {createMvpServer} from './app.mjs';
const quiet={warn(){},error(){}};
async function remoteFixture(t){const dir=mkdtempSync(join(tmpdir(),'hutong-hardening-')),client=createClient({url:'file::memory:'}),apps=[];t.after(async()=>{for(const a of apps){await a.replica.close();a.app?.close();a.db?.close();a.app?.server.closeAllConnections();}client.close();rmSync(dir,{recursive:true,force:true});});return{client,async game(name,wrapper=client){const path=join(dir,name+'.db'),replica=await prepareReplica(path,wrapper,{flushEveryMs:0,log:quiet});const app=createMvpServer({dbPath:path,beforeRequest:()=>replica.pull({reconcilePending:true}),commitRequest:()=>replica.flush({allowTransaction:true})});replica.attach(app.store.db);app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const api=async(route,input,cookie)=>{const res=await fetch('http://127.0.0.1:'+app.server.address().port+'/api/'+route,{method:input===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),'Content-Type':'application/json'},body:input===undefined?undefined:JSON.stringify(input)});return{status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};};const result={replica,app,api};apps.push(result);return result;},async small(name,wrapper=client){const path=join(dir,name+'.db'),replica=await prepareReplica(path,wrapper,{flushEveryMs:0,log:quiet}),db=new DatabaseSync(path);db.exec('CREATE TABLE IF NOT EXISTS sample(id TEXT PRIMARY KEY,value TEXT); CREATE TABLE IF NOT EXISTS child(id TEXT PRIMARY KEY,parent TEXT REFERENCES sample(id))');replica.attach(db);const result={replica,db};apps.push(result);return result;}};}

test('password reset consumes the organizer code durably and invalidates old sessions across replicas',async t=>{
 const f=await remoteFixture(t),a=await f.game('reset-a'),registered=await a.api('register',{username:'cloud_reset','password':'old-password-123',role:'cora'});
 const b=await f.game('reset-b'),second=await b.api('login',{username:'cloud_reset',password:'old-password-123'});
 const issued=a.app.store.createPasswordReset('cloud_reset');await a.replica.flush();
 const reset=await b.api('reset-password',{username:'cloud_reset',code:issued.code,password:'new-password-123'});assert.equal(reset.status,200);
 assert.equal((await a.api('me',undefined,registered.cookie)).data.user,null);assert.equal((await a.api('me',undefined,second.cookie)).data.user,null);
 assert.equal((await a.api('reset-password',{username:'cloud_reset',code:issued.code,password:'another-password-123'})).status,400);
 const restarted=await f.game('reset-restart');assert.equal((await restarted.api('login',{username:'cloud_reset',password:'old-password-123'})).status,401);
 assert.equal((await restarted.api('login',{username:'cloud_reset',password:'new-password-123'})).data.user.role,'cora');
});
test('independent instances racing to register one role produce one durable account and session',async t=>{
 const f=await remoteFixture(t),a=await f.game('a'),b=await f.game('b');
 const results=await Promise.all([a.api('register',{username:'replica_one',password:'test-password-123',role:'franco'}),b.api('register',{username:'replica_two',password:'test-password-123',role:'franco'})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const c=await f.game('c');assert.equal(c.app.store.db.prepare('SELECT COUNT(*) n FROM accounts').get().n,1);assert.equal(c.app.store.db.prepare('SELECT COUNT(*) n FROM sessions').get().n,1);assert.equal(c.app.store.db.prepare('PRAGMA foreign_key_check').all().length,0);
 const winner=results.find(r=>r.status===200);assert.equal((await c.api('login',{username:winner.data.user.username,password:'test-password-123'})).status,200);
 c.app.store.db.prepare('UPDATE accounts SET role=NULL').run();await c.replica.flush();assert.equal((await c.api('register',{username:'reclaimed',password:'test-password-123',role:'franco'})).status,409);
});
test('a rollback never advances pull watermark and repaired rows are retried',async t=>{
 const f=await remoteFixture(t),a=await f.small('a');await a.replica.flush();
 await f.client.batch([{sql:'INSERT INTO hutong_online_rows VALUES(?,?,?,?,?)',args:['sample','["valid"]',JSON.stringify({id:'valid',value:'ok'}),0,1]},{sql:'INSERT INTO hutong_online_rows VALUES(?,?,?,?,?)',args:['child','["orphan"]',JSON.stringify({id:'orphan',parent:'missing'}),0,2]}],'write');
 await assert.rejects(a.replica.pull());assert.equal(a.replica.lastVersion,0);assert.equal(a.db.prepare('SELECT COUNT(*) n FROM sample').get().n,0);
 await f.client.execute({sql:"UPDATE hutong_online_rows SET data=?,ver=3 WHERE tbl='child'",args:[JSON.stringify({id:'orphan',parent:'valid'})]});await a.replica.pull();assert.equal(a.replica.lastVersion,3);assert.equal(a.db.prepare('SELECT parent FROM child').get().parent,'valid');
});
test('a write between hydration rows and watermark reads is recovered',async t=>{
 const f=await remoteFixture(t),a=await f.small('a');a.db.prepare("INSERT INTO sample VALUES('old','before')").run();await a.replica.flush();let injected=false;
 const wrapper={batch:(...args)=>f.client.batch(...args),async execute(statement){const result=await f.client.execute(statement);if(!injected&&typeof statement==='string'&&statement.includes('SELECT tbl, pk, data, deleted, ver')){injected=true;await f.client.execute({sql:"INSERT INTO hutong_online_rows SELECT 'sample',?, ?,0,MAX(ver)+1 FROM hutong_online_rows",args:['["late"]',JSON.stringify({id:'late',value:'during-bootstrap'})]});}return result;}};
 const b=await f.small('b',wrapper);await b.replica.pull();assert.equal(b.db.prepare("SELECT value FROM sample WHERE id='late'").get().value,'during-bootstrap');
});
test('two concurrent invitations to one recipient cannot both commit',async t=>{
 const f=await remoteFixture(t),a=await f.game('a');for(const role of ['laura','sid','suki'])await a.api('register',{username:'invite_'+role,password:'test-password-123',role});const b=await f.game('b');
 const laura=(await a.api('login',{username:'invite_laura',password:'test-password-123'})).cookie,suki=(await b.api('login',{username:'invite_suki',password:'test-password-123'})).cookie;
 const results=await Promise.all([a.api('invite',{client:'a',peer:'sid',place:'arcade',requestId:'one'},laura),b.api('invite',{client:'b',peer:'sid',place:'rest',requestId:'two'},suki)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const c=await f.game('c');assert.equal(c.app.store.db.prepare("SELECT COUNT(*) n FROM offers WHERE status='pending'").get().n,1);
});
test('equal target object rows still conflict so a shared item cannot be taken twice',async t=>{
 const f=await remoteFixture(t),a=await f.small('a');a.db.prepare("INSERT INTO sample VALUES('item','full')").run();await a.replica.flush();const b=await f.small('b');a.db.prepare("UPDATE sample SET value='empty'").run();b.db.prepare("UPDATE sample SET value='empty'").run();await a.replica.flush();await assert.rejects(b.replica.flush(),e=>e.status===409);
});
test('accepted pair on separate instances reject stale movement and complete after durable arrivals',async t=>{
 const f=await remoteFixture(t),a=await f.game('a');const laura=await a.api('register',{username:'travel_laura',password:'test-password-123',role:'laura'});const b=await f.game('b'),sid=await b.api('register',{username:'travel_sid',password:'test-password-123',role:'sid'});
 await a.api('control',{client:'a'},laura.cookie);await b.api('control',{client:'b'},sid.cookie);a.app.store.hand(laura.data.user.id,'咖啡',0);await a.replica.flush();
 const invite=await a.api('invite',{client:'a',peer:'sid',place:'ktv',requestId:'cross-travel'},laura.cookie),offer=invite.data.offer;assert.equal((await b.api('offer',{client:'b',id:offer.id,answer:'accept'},sid.cookie)).status,200);
 const stale=await a.api('presence',{client:'a',scene:'hutong',x:384,y:207,facing:0,moving:false,seat:null,hand:'咖啡',activity:'walk'},laura.cookie);assert.equal(stale.status,409);
 for(const [instance,user,client]of [[a,laura,'a'],[b,sid,'b']]){const command=instance.app.life.travel(user.data.user.id)??(await instance.api('offer',{client,id:offer.id,answer:'accept'},user.cookie)).data.travel;const r=await instance.api('presence',{...command.state,client,hand:user===laura?'咖啡':null},user.cookie);assert.equal(r.status,200);}
 await a.api('me',undefined,laura.cookie);assert.equal(a.app.life.meeting(laura.data.user.id),undefined);assert.equal(a.app.store.byId(laura.data.user.id).hand,'咖啡');assert.equal(a.app.life.position(sid.data.user.id).scene,'ktv');
 const abort=new AbortController();try{const response=await fetch('http://127.0.0.1:'+a.app.server.address().port+'/api/events?client=a',{headers:{cookie:laura.cookie},signal:abort.signal});const reader=response.body.getReader();let text='';while(!text.includes('event: world\ndata: ')||!text.split('event: world\ndata: ')[1].includes('\n\n'))text+=new TextDecoder().decode((await reader.read()).value);const world=JSON.parse(text.split('event: world\ndata: ')[1].split('\n')[0]);assert.deepEqual(world.players.filter(p=>['laura','sid'].includes(p.role)).map(p=>p.role).sort(),['laura','sid']);assert.ok(world.players.every(p=>p.scene==='ktv'));}finally{abort.abort();}
 const c=await f.game('c');assert.equal(c.app.life.travel(laura.data.user.id).offer,offer.id);assert.equal(c.app.life.travel(sid.data.user.id).ack,1);
});
test('failed coffee persistence rolls back state and receipt, survives restart and retries once',async t=>{
 const f=await remoteFixture(t);let offline=false;const wrapper={execute:(...args)=>f.client.execute(...args),batch:(...args)=>offline?Promise.reject(new Error('network offline')):f.client.batch(...args)},a=await f.game('a',wrapper);
 const user=await a.api('register',{username:'coffee_franco',password:'test-password-123',role:'franco'});await a.api('control',{client:'a'},user.cookie);assert.equal((await a.api('presence',{client:'a',scene:'rest',x:314,y:156,facing:0,seat:null,hand:null,activity:'walk'},user.cookie)).status,200);
 const input={client:'a',object:'rest:coffee',action:'supply',item:'咖啡',revision:0,requestId:'durable-coffee'};offline=true;assert.equal((await a.api('object',input,user.cookie)).status,503);offline=false;
 assert.equal(a.app.store.byId(user.data.user.id).hand,null);assert.equal(a.app.store.db.prepare('SELECT COUNT(*) n FROM operations WHERE id=?').get(input.requestId).n,0);
 const b=await f.game('restart');assert.equal(b.app.store.byId(user.data.user.id).hand,null);assert.equal(b.app.store.db.prepare('SELECT COUNT(*) n FROM operations WHERE id=?').get(input.requestId).n,0);
 assert.equal((await a.api('object',input,user.cookie)).status,200);assert.equal((await a.api('object',input,user.cookie)).status,200);await b.api('me',undefined,user.cookie);assert.equal(b.app.store.byId(user.data.user.id).hand,'咖啡');assert.equal(b.app.store.byId(user.data.user.id).revision,1);
});
