import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createClient} from '@libsql/client';
import {createMvpServer} from './app.mjs';
import {prepareReplica} from './replica.mjs';
const quiet={error(){},warn(){}};
async function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'hutong-shared-events-')),remote=createClient({url:'file::memory:'}),instances=[];
 t.after(async()=>{for(const i of instances){await i.replica.close();i.app.close();}remote.close();rmSync(dir,{recursive:true,force:true});});
 async function instance(name){const path=join(dir,name+'.sqlite'),replica=await prepareReplica(path,remote,{flushEveryMs:0,log:quiet}),app=createMvpServer({dbPath:path,llmOptions:{key:''}});replica.attach(app.store.db);const i={app,replica};instances.push(i);return i;}
 const a=await instance('a'),first=await a.app.store.register('shared_first','shared-event-password','sid'),second=await a.app.store.register('shared_second','shared-event-password','suki');await a.replica.flush();
 const b=await instance('b');await b.replica.flush();await a.replica.pull({reconcilePending:true});a.app.life.setSceneProvider(()=>null);b.app.life.setSceneProvider(()=>null);return {a,b,instance,remote,ids:[first.user.id,second.user.id]};
}
const journal=(i,id)=>i.app.store.db.prepare('SELECT seq,body,event_id FROM experiences WHERE account=? ORDER BY seq').all(id);
test('racing group records with different physical sequences hydrate once per participant using latest remote payload',async t=>{
 const f=await fixture(t);f.a.app.life.recordGroup(f.ids,'shared','older','hutong',100,'one-event');f.b.app.life.recordGroup(f.ids,'shared','newer','hutong',101,'one-event');await f.a.replica.flush();await f.b.replica.flush();
 const c=await f.instance('cold');for(const id of f.ids){assert.equal(journal(c,id).length,1);assert.equal(journal(c,id)[0].body,'newer');}assert.equal(c.app.store.roster().filter(r=>r.claimed).length,2);
});
test('warm pulls merge versions, retain unshared entries and ignore tombstones for obsolete physical keys',async t=>{
 const f=await fixture(t);f.a.app.life.recordGroup(f.ids,'shared','older','hutong',100,'one-event');await f.a.replica.flush();await f.b.replica.pull();
 const old=journal(f.a,f.ids[0])[0];const remoteRow=(await f.remote.execute({sql:"SELECT data FROM hutong_online_rows WHERE tbl='experiences' AND pk=?",args:[JSON.stringify([old.seq])]})).rows[0];
 const data={...JSON.parse(remoteRow.data),seq:old.seq+10000,body:'latest'};
 await f.remote.execute({sql:"INSERT INTO hutong_online_rows VALUES('experiences',?,?,0,(SELECT MAX(ver)+1 FROM hutong_online_rows))",args:[JSON.stringify([data.seq]),JSON.stringify(data)]});
 await f.b.replica.pull();assert.equal(journal(f.b,f.ids[0]).length,1);assert.equal(journal(f.b,f.ids[0])[0].body,'latest');assert.equal(journal(f.b,f.ids[1]).length,1);
 await f.remote.execute({sql:"UPDATE hutong_online_rows SET deleted=1,data=NULL,ver=(SELECT MAX(ver)+1 FROM hutong_online_rows) WHERE tbl='experiences' AND pk=?",args:[JSON.stringify([old.seq])]});
 await f.b.replica.pull();assert.equal(journal(f.b,f.ids[0])[0].body,'latest');
 f.b.app.life.record(f.ids[0],'walk','unshared A','hutong');f.b.app.life.record(f.ids[0],'walk','unshared B','hutong');await f.b.replica.flush();const c=await f.instance('cold');assert.equal(journal(c,f.ids[0]).length,3);
 await f.b.replica.syncAuthoritativeTables(['experiences']);assert.equal(journal(f.b,f.ids[0]).length,3);
});
test('ordinary pull preserves pending logical duplicate; request reconciliation adopts remote winner and clears losing dirty key',async t=>{
 const f=await fixture(t);f.a.app.life.recordGroup(f.ids,'shared','authoritative','hutong',100,'one-event');f.b.app.life.recordGroup(f.ids,'shared','pending','hutong',101,'one-event');await f.a.replica.flush();
 await f.b.replica.pull();assert.equal(journal(f.b,f.ids[0])[0].body,'pending');assert(f.b.replica.hasPending(['experiences']));
 await f.b.replica.pull({reconcilePending:true});for(const id of f.ids){assert.equal(journal(f.b,id).length,1);assert.equal(journal(f.b,id)[0].body,'authoritative');}assert.equal(f.b.replica.hasPending(['experiences']),false);
 await f.b.replica.flush();const c=await f.instance('cold');assert.equal(journal(c,f.ids[0]).length,1);
});
