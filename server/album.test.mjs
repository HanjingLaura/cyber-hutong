import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createClient} from '@libsql/client';
import {prepareReplica} from './replica.mjs';
import {createAlbum} from './album.mjs';
import {createMvpServer} from './app.mjs';

const jpeg=readFileSync(new URL('./fixtures/album-photo.jpg',import.meta.url));
async function fixture(t,options={}){
  const app=createMvpServer({dbPath:':memory:',albumSeedImage:()=>jpeg,...options});
  t.after(()=>app.close());
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+app.server.address().port;
  const users={};
  for(const role of ['laura','jilly','cora','amber','sid','suki','kay','franco'])users[role]=await app.store.register(role+'_album','test-password-123',role);
  const request=async(role,path,input)=>{
    const res=await fetch(base+'/api/'+path,{headers:{...(role?{Cookie:'hutong_session='+users[role].token}:{}),...(input?{'Content-Type':'application/json'}:{})},method:input?'POST':'GET',body:input?JSON.stringify(input):undefined});
    return {status:res.status,headers:res.headers,data:res.headers.get('content-type')?.includes('application/json')?await res.json():Buffer.from(await res.arrayBuffer())};
  };
  const upload=(overrides={})=>({scene:'hutong',image:jpeg.toString('base64'),caption:'曾经在这里',visibility:'selected',recipients:['jilly','cora'],requestId:crypto.randomUUID(),...overrides});
  return {app,users,request,upload};
}

test('album: per-scene upload and direct-image ACL, multi-select, revocation and owner deletion',async t=>{
  const {request,upload}=await fixture(t);
  const input=upload(),created=await request('laura','albums/',input);
  assert.equal(created.status,201);
  const id=created.data.photo.id;
  assert.equal((await request('laura','albums',input)).data.photo.id,id,'retry does not duplicate');
  for(const role of ['laura','jilly','cora']){
    assert.equal((await request(role,'albums?scene=hutong')).data.photos.length,1);
    const image=await request(role,'album-photo?id='+id);
    assert.equal(image.status,200);assert.deepEqual(image.data,jpeg);
    assert.match(image.headers.get('cache-control'),/no-store/);
  }
  assert.equal((await request('amber','albums?scene=hutong')).data.photos.length,0);
  assert.equal((await request('amber','album-photo?id='+id)).status,404);
  assert.equal((await request(null,'album-photo?id='+id)).status,401);
  assert.equal((await request('jilly','album-photo',{action:'share',id,visibility:'public',recipients:[]})).status,403);
  assert.equal((await request('laura','albums?scene=ktv')).data.photos.length,2);
  assert.equal((await request('laura','album-photo',{action:'share',id,visibility:'public',recipients:[]})).status,200);
  assert.equal((await request('amber','album-photo?id='+id)).status,200);
  await request('laura','album-photo',{action:'share',id,visibility:'selected',recipients:['amber']});
  assert.equal((await request('jilly','album-photo?id='+id)).status,404);
  assert.equal((await request('laura','album-photo?id='+id)).status,200);
  assert.equal((await request('amber','album-photo',{action:'delete',id})).status,403);
  assert.equal((await request('laura','album-photo',{action:'delete',id})).status,200);
  assert.equal((await request('laura','album-photo?id='+id)).status,404);
});

test('album: supplied KTV photos visible to eight members; POP MART only the four specified members',async t=>{
  const {request}=await fixture(t);
  for(const role of ['laura','jilly','cora','amber','sid','suki','kay','franco']){
    const ktv=await request(role,'albums?scene=ktv');assert.equal(ktv.data.photos.length,2);
    for(const photo of ktv.data.photos)assert.equal((await request(role,'album-photo?id='+photo.id)).status,200);
    const pop=await request(role,'albums?scene=pop');
    assert.equal(pop.data.photos.length,['laura','jilly','cora','amber'].includes(role)?1:0);
    assert.equal((await request(role,'album-photo?id=seed-pop-1')).status,['laura','jilly','cora','amber'].includes(role)?200:404);
  }
});

test('album: validates content, scene, recipients; defaults to owner-only; awaits durable commit',async t=>{
  let commits=0;
  const {request,upload}=await fixture(t,{albumCommit:async()=>{commits++;}});
  for(const changes of [{image:'PHN2Zz4='},{scene:'ktv'},{recipients:['nobody']},{visibility:'unknown'},{image:'A'.repeat(1100000)}]){
    assert.ok((await request('laura','albums',upload(changes))).status>=400);
  }
  const created=await request('laura','albums',upload({recipients:[]}));assert.equal(created.status,201);assert.equal(commits,1);
  assert.equal((await request('jilly','album-photo?id='+created.data.photo.id)).status,404);
  await request('laura','album-photo',{action:'delete',id:created.data.photo.id});assert.equal(commits,2);
});

test('album: photos and revoked permissions survive Turso cold starts and chunk replication',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'hutong-album-')),remote=createClient({url:'file::memory:'});
  const instances=[];
  t.after(async()=>{for(const {app,replica} of instances){await replica.close();app.close();}remote.close();rmSync(dir,{recursive:true,force:true});});
  const instance=async name=>{
    const path=join(dir,name+'.sqlite'),replica=await prepareReplica(path,remote,{flushEveryMs:0});
    const app=createMvpServer({dbPath:path,albumCommit:()=>replica.flush()});replica.attach(app.store.db);const result={app,replica};instances.push(result);return result;
  };
  const a=await instance('a'),laura=await a.app.store.register('laura_album','test-password-123','laura'),jilly=await a.app.store.register('jilly_album','test-password-123','jilly');
  await new Promise(r=>a.app.server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+a.app.server.address().port;
  const created=await fetch(base+'/api/albums',{method:'POST',headers:{Cookie:'hutong_session='+laura.token,'Content-Type':'application/json'},body:JSON.stringify({scene:'hutong',image:jpeg.toString('base64'),caption:'跨实例的照片',visibility:'selected',recipients:['jilly'],requestId:crypto.randomUUID()})});
  assert.equal(created.status,201);const id=(await created.json()).photo.id;
  const b=await instance('b');await new Promise(r=>b.app.server.listen(0,'127.0.0.1',r));
  const image=await fetch('http://127.0.0.1:'+b.app.server.address().port+'/api/album-photo?id='+id,{headers:{Cookie:'hutong_session='+jilly.token}});
  assert.equal(image.status,200);assert.deepEqual(Buffer.from(await image.arrayBuffer()),jpeg);
  b.app.store.db.prepare("UPDATE album_photos SET recipients='[]',updated=updated+1 WHERE id=?").run(id);await b.replica.flush();await a.replica.pull();
  assert.equal((await fetch(base+'/api/album-photo?id='+id,{headers:{Cookie:'hutong_session='+jilly.token}})).status,404);
  a.app.store.db.prepare('DELETE FROM album_photo_chunks WHERE photo=? AND part=0').run(id);
  assert.equal((await fetch(base+'/api/album-photo?id='+id,{headers:{Cookie:'hutong_session='+laura.token}})).status,503,'incomplete replicas never serve partial JPEG');
});

test('album: upload success waits for durable commit; failures are reported for safe retry',async t=>{
  let resolve,started;const ready=new Promise(r=>started=r),gate=new Promise(r=>resolve=r);
  let failCommit=false;
  const {request,upload}=await fixture(t,{albumCommit:async()=>{started();await gate;if(failCommit)throw new Error('offline');}});
  let completed=false;const saving=request('laura','albums',upload()).then(result=>{completed=true;return result;});
  await ready;assert.equal(completed,false);resolve();assert.equal((await saving).status,201);
  failCommit=true;const input=upload();assert.equal((await request('laura','albums',input)).status,503);failCommit=false;
  assert.equal((await request('laura','albums',input)).status,201,'same upload can be retried after durability failure');
  assert.equal((await request('laura','albums?scene=hutong')).data.photos.length,2);
});

test('album: concurrent retries use one remote record and cold starts remain valid',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'hutong-album-retry-')),remote=createClient({url:'file::memory:'}),instances=[];
  t.after(async()=>{for(const {app,replica} of instances){await replica.close();app.close();}remote.close();rmSync(dir,{recursive:true,force:true});});
  const instance=async name=>{
    const dbPath=join(dir,name+'.sqlite'),replica=await prepareReplica(dbPath,remote,{flushEveryMs:0,log:{error(){}}}),app=createMvpServer({dbPath});
    replica.attach(app.store.db);const result={app,replica,album:createAlbum(app.store)};instances.push(result);return result;
  };
  const a=await instance('a'),registered=await a.app.store.register('laura_retry','test-password-123','laura');await a.replica.flush();const b=await instance('b');
  const input={scene:'hutong',image:jpeg.toString('base64'),caption:'同一次上传',visibility:'selected',recipients:[],requestId:'concurrent-photo-retry'};
  const first=a.album.upload(input,registered.user,'hutong'),second=b.album.upload(input,registered.user,'hutong');assert.equal(first.id,second.id);
  await a.replica.flush();await assert.rejects(b.replica.flush(),e=>e.status===409);
  await b.replica.syncAuthoritativeTables(['album_photos'],{pendingTables:['album_photo_chunks']});
  assert.equal(b.album.upload(input,registered.user,'hutong').id,first.id);await b.replica.flush();
  const cold=await instance('cold');assert.equal(cold.album.list('hutong',registered.user).photos.length,1);assert.deepEqual(cold.album.image(first.id,registered.user),jpeg);
});

test('album: integrates with the whole-request savepoint and rolls back failed cloud commits',async t=>{
  let failCommit=true;
  const {app,request,upload}=await fixture(t,{commitRequest:async()=>{if(failCommit)throw new Error('offline');}});
  const input=upload();assert.equal((await request('laura','albums',input)).status,503);
  assert.equal(app.store.db.prepare('SELECT COUNT(*) AS n FROM album_photos').get().n,0);
  assert.equal(app.store.db.prepare('SELECT COUNT(*) AS n FROM album_photo_chunks').get().n,0);
  failCommit=false;assert.equal((await request('laura','albums',input)).status,201);
});
