import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createMvpServer} from './app.mjs';

async function fixture(t){
 let now=Date.now();t.mock.method(Date,'now',()=>now);
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 t.after(()=>{app.close();app.server.closeAllConnections();});
 const account=await app.store.register('fallback_sid','test-password-123','sid');
 const root='http://127.0.0.1:'+app.server.address().port,headers={Cookie:'hutong_session='+account.token,'Content-Type':'application/json'};
 const api=async(path,input)=>{const res=await fetch(root+'/api/'+path,{method:input===undefined?'GET':'POST',headers,...(input===undefined?{}:{body:JSON.stringify(input)})});return{status:res.status,body:await res.json()};};
 async function stream(client){const abort=new AbortController(),res=await fetch(root+'/api/events?client='+client,{headers,signal:abort.signal});assert.equal(res.status,200);await res.body.getReader().read();t.after(()=>abort.abort());return abort;}
 return{app,id:account.user.id,api,stream,advance(ms){now+=ms;app.autonomy.tick();},get now(){return now;}};
}

test('HTTP browser acknowledgments keep a rider and controller live after SSE closes',async t=>{
 const f=await fixture(t),stream=await f.stream('driver');
 const p=f.app.players.get(f.id);Object.assign(p,{scene:'street',x:320,y:285,seat:null,activity:'walk',fresh:false});f.app.life.savePosition(p);
 assert.equal((await f.api('ride',{client:'driver',action:'join',slot:'driver'})).status,200);
 // A viewer must not inherit control merely because the driver's SSE failed.
 await f.stream('viewer');stream.abort();
 for(let n=0;n<50&&[...f.app.streams].some(s=>s.client==='driver');n++)await new Promise(r=>setTimeout(r,10));
 assert.equal([...f.app.streams].some(s=>s.client==='driver'),false);
 assert.equal((await f.api('ride?client=driver')).body.ride.seats.driver?.role,'sid','SSE closure must not eject the driver');
 for(let n=0;n<40;n++){
  f.advance(10000);
  assert.equal((await f.api('heartbeat',{client:'driver'})).status,200);
  const ride=await f.api('ride?client=driver');assert.equal(ride.body.ride.seats.driver?.role,'sid');
  assert.equal(f.app.presence.online(f.id),true);assert.equal(f.app.presence.canDrive(f.id),false);
  assert.equal(f.app.autonomy.isDriven(f.id),false);
  assert.equal(f.app.store.db.prepare('SELECT client FROM controllers WHERE account=?').get(f.id).client,'driver');
 }
 // Once browser acknowledgments really stop, server streams cannot postpone takeover.
 f.advance(60000+300000);
 assert.equal(f.app.presence.online(f.id),false);assert.equal(f.app.autonomy.isDriven(f.id),true);
});

test('authenticated HTTP heartbeat restores a closed browser row and works before any SSE stream',async t=>{
 const f=await fixture(t);
 assert.equal((await f.api('heartbeat',{client:'http-only'})).status,200);
 assert.equal(f.app.presence.online(f.id),true);
 f.app.presence.connect(f.id,'http-only','old-stream');f.app.presence.disconnect(f.id,'http-only','old-stream');
 assert.equal((await f.api('heartbeat',{client:'http-only'})).status,200);
 assert.equal(f.app.presence.online(f.id),true);assert.equal(f.app.presence.canDrive(f.id),false);
});

test('a stale SSE replica cannot release a ride kept alive by another replica',async t=>{
 t.mock.timers.enable({apis:['setInterval']});
 const f=await fixture(t);
 assert.equal((await f.api('heartbeat',{client:'driver'})).status,200);
 assert.equal((await f.api('control',{client:'driver'})).status,200);
 const p=f.app.players.get(f.id);Object.assign(p,{scene:'street',x:320,y:285,seat:null,activity:'walk',fresh:false});f.app.life.savePosition(p);
 assert.equal((await f.api('ride',{client:'driver',action:'join',slot:'driver'})).status,200);
 p.disconnectedAt=f.now;
 f.advance(50000);
 // Imported writes from another replica refresh shared rows without touching
 // this replica's old in-memory player or disconnectedAt timestamp.
 f.app.presence.heartbeat(f.id,'driver');
 f.app.store.db.prepare('UPDATE controllers SET at=? WHERE account=?').run(f.now,f.id);
 const ride=JSON.parse(f.app.store.db.prepare('SELECT state FROM shared_rides').get().state);
 ride.seats.driver.until=f.now+15000;
 f.app.store.db.prepare('UPDATE shared_rides SET state=?').run(JSON.stringify(ride));
 t.mock.timers.tick(15000);
 assert.equal(f.app.presence.online(f.id),true);
 const saved=JSON.parse(f.app.store.db.prepare('SELECT state FROM shared_rides').get().state);
 assert.equal(saved.seats.driver?.role,'sid','a live remote browser retains its shared ride');
 assert.equal(f.app.store.db.prepare('SELECT client FROM controllers WHERE account=?').get(f.id).client,'driver');
 assert.equal(f.app.players.has(f.id),false,'only the stale local player cache is retired');
});

test('the browser sends an independent HTTP heartbeat while SSE and PartyKit reconnect',()=>{
 const source=readFileSync(new URL('../src/multiplayer/social.ts',import.meta.url),'utf8');
 const start=source.indexOf('  setInterval(()=>{const pulse='),end=source.indexOf('void publishPresence(pulse)',start);
 assert.ok(start>=0&&end>start);
 const script=ts.transpileModule(source.slice(start,end)+'},100);',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 for(const partyConnected of [false,true]){
  const requests=[];let tick;
  new Function('setInterval','performance','user','connected','party','navigator','api','client','lastPulse',script)(
   callback=>tick=callback,{now:()=>16000},{role:'sid'},false,{connected:partyConnected},{onLine:true},
   (path,input)=>{requests.push({path,input});return Promise.resolve();},'tab',0,
  );
  tick();assert.deepEqual(requests,[{path:'heartbeat',input:{client:'tab'}}]);
 }
});
