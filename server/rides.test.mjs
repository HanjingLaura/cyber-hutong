import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from './store.mjs';
import {createLife} from './life.mjs';
import {createWorld} from './world.mjs';
import {createRides,createTickets} from './rides.mjs';
import {createMvpServer} from './app.mjs';
import {outdoorWalkable,scooterWalkable} from '../shared/outdoor-collision.mjs';

function fixture(){
 const store=openStore(':memory:'),life=createLife(store),world=createWorld(store,life),players=new Map();let now=1000;
 for(const [id,role] of [['a','sid'],['b','suki'],['c','kay'],['d','amber']]){store.db.prepare('INSERT INTO accounts(id,username,password,role) VALUES(?,?,?,?)').run(id,id,'unused',role);players.set(id,{id,role,scene:'street',x:320,y:285});}
 const controls=new Map([...players.keys()].map(id=>[id,'tab']));
 const rides=createRides(store,{clock:()=>now,position:id=>players.get(id),controller:id=>controls.get(id),live:()=>true,move:(id,pose)=>Object.assign(players.get(id),pose)});
 return {store,life,world,players,controls,rides,tickets:createTickets(store,life,world),advance:ms=>now+=ms,user:id=>store.publicAccount(store.byId(id))};
}
test('seats are exclusive and accounts cannot occupy two seats',()=>{const f=fixture();try{f.rides.act(f.user('a'),{client:'tab',action:'join',slot:'driver'});assert.throws(()=>f.rides.act(f.user('b'),{client:'tab',action:'join',slot:'driver'}),{status:409});f.rides.act(f.user('a'),{client:'tab',action:'join',slot:'rear'});const state=f.rides.snapshot();assert.equal(state.seats.driver,null);assert.equal(state.seats.rear.role,'sid');}finally{f.store.close();}});
test('ride poses use scooter and departing or expired riders recover walking',()=>{const f=fixture();try{
 f.rides.act(f.user('a'),{client:'tab',action:'join',slot:'driver'});assert.equal(f.players.get('a').activity,'scooter');
 f.rides.act(f.user('b'),{client:'tab',action:'join',slot:'front'});assert.equal(f.players.get('b').activity,'scooter-basket');
 f.players.get('b').activity='walk';f.rides.snapshot('b','tab');assert.equal(f.players.get('b').activity,'scooter-basket','a cold HTTP replica restores the reserved riding pose');
 f.rides.act(f.user('a'),{client:'tab',action:'leave'});assert.equal(f.players.get('a').activity,'walk');assert.equal(f.rides.snapshot().seats.front.role,'suki');
 f.advance(16000);f.rides.snapshot();assert.equal(f.players.get('b').activity,'walk');
}finally{f.store.close();}});
test('only controller and driver can drive with bounded elapsed speed',()=>{const f=fixture();try{assert.throws(()=>f.rides.act(f.user('a'),{client:'wrong',action:'join',slot:'driver'}),{status:409});f.rides.act(f.user('a'),{client:'tab',action:'join',slot:'driver'});f.rides.act(f.user('b'),{client:'tab',action:'join',slot:'front'});assert.throws(()=>f.rides.act(f.user('b'),{client:'tab',action:'drive',x:330,y:285}),{status:403});assert.throws(()=>f.rides.act(f.user('a'),{client:'tab',action:'drive',x:500,y:285}),{status:409});f.advance(100);f.rides.act(f.user('a'),{client:'tab',action:'drive',x:338,y:285,facing:1});assert.equal(f.players.get('b').x,372);assert.throws(()=>f.rides.act(f.user('a'),{client:'tab',action:'drive',x:606,y:285}),{status:400});}finally{f.store.close();}});
test('drive rejects visible ground edges crossed by the vehicle footprint',()=>{const f=fixture();try{
 f.rides.act(f.user('a'),{client:'tab',action:'join',slot:'driver'});f.advance(1000);
 for(const [x,y] of [[50,285],[590,285],[320,230],[320,349]])assert.throws(()=>f.rides.act(f.user('a'),{client:'tab',action:'drive',x,y}),{status:400});
 assert.deepEqual([f.rides.snapshot().x,f.rides.snapshot().y],[320,285]);
}finally{f.store.close();}});
test('legacy invalid parked vehicle migrates before seat anchors and persists all live riders',()=>{const f=fixture();try{
 f.rides.act(f.user('a'),{client:'tab',action:'join',slot:'driver'});f.rides.act(f.user('b'),{client:'tab',action:'join',slot:'front'});
 const row=JSON.parse(f.store.db.prepare('SELECT state FROM shared_rides').get().state);Object.assign(row,{x:35,y:200,facing:3});f.store.db.prepare('UPDATE shared_rides SET state=?').run(JSON.stringify(row));
 f.advance(500);
 const state=f.rides.snapshot();assert(scooterWalkable(state.x,state.y));assert.equal(state.seats.driver.role,'sid');assert.equal(state.seats.front.role,'suki');
 assert.deepEqual([f.players.get('a').x,f.players.get('a').y],[state.x,state.y]);assert.equal(f.players.get('b').x,state.x-34,'basket anchor must retain its real offset, without legacy x clamp');
 const persisted=JSON.parse(f.store.db.prepare('SELECT state FROM shared_rides').get().state);assert.deepEqual([persisted.x,persisted.y],[state.x,state.y]);
 assert.equal(persisted.seats.front.until,row.seats.front.until,'migration does not extend a seat lease');
}finally{f.store.close();}});
test('leaving an obsolete vehicle pose grounds the walker nearby and keeps other passengers seated',()=>{const f=fixture();try{
 f.rides.act(f.user('a'),{client:'tab',action:'join',slot:'driver'});f.rides.act(f.user('b'),{client:'tab',action:'join',slot:'front'});
 Object.assign(f.players.get('a'),{x:35,y:200});
 f.rides.act(f.user('a'),{client:'tab',action:'leave'});const walker=f.players.get('a');assert.equal(walker.activity,'walk');assert(outdoorWalkable('street',walker.x,walker.y));assert(Math.hypot(walker.x-35,walker.y-200)<60);
 assert.equal(f.rides.snapshot().seats.front.role,'suki');assert.equal(f.players.get('b').activity,'scooter-basket');
}finally{f.store.close();}});
test('leave, expiry, controller changes and scene transitions remove occupants',()=>{const f=fixture();try{f.rides.act(f.user('a'),{client:'tab',action:'join',slot:'driver'});f.rides.release('a');assert.equal(f.rides.snapshot().seats.driver,null);f.rides.act(f.user('b'),{client:'tab',action:'join',slot:'front'});f.players.get('b').scene='campus';assert.equal(f.rides.snapshot().seats.front,null);f.rides.act(f.user('c'),{client:'tab',action:'join',slot:'rear'});f.controls.set('c','new');assert.equal(f.rides.snapshot().seats.rear,null);f.rides.act(f.user('a'),{client:'tab',action:'join',slot:'driver'});f.advance(16000);assert.equal(f.rides.snapshot().seats.driver,null);}finally{f.store.close();}});
test('ticket is personalized, idempotent and persisted in collection and progress',()=>{const f=fixture();try{assert.equal(f.tickets.get('a'),null);const first=f.tickets.claim(f.user('a'),{scene:'google'});const second=f.tickets.claim(f.user('a'),{scene:'google'});assert.deepEqual(second,first);assert.equal(first.date,'2026-10-10');assert.equal(first.from,'Human2026');assert.equal(first.to,'Agent2027');assert.equal(first.role,'sid');assert.equal(f.life.collection('a').length,1);assert.equal(f.life.collection('a')[0].count,1);assert.deepEqual(f.tickets.get('a'),first);assert.throws(()=>f.tickets.claim(f.user('b'),{scene:'street'}),{status:409});}finally{f.store.close();}});
test('HTTP ride requires authentication, preserves anchors on presence and releases on logout',async t=>{
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});t.after(()=>app.close());await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+app.server.address().port,account=await app.store.register('ride_account','ride-password-long','sid');
 const api=async(path,input,token=account.token)=>{const r=await fetch(origin+'/api/'+path,{method:input?'POST':'GET',headers:{Cookie:'hutong_session='+token,'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});return {status:r.status,body:await r.json()};};
 assert.equal((await api('ride',null,'')).status,401);
 await api('control',{client:'tab'});const p=app.players.get(account.user.id);Object.assign(p,{scene:'street',x:320,y:285,seat:null,activity:'walk',fresh:false});app.life.savePosition(p);
 assert.equal((await api('ride',{client:'wrong',action:'join',slot:'driver'})).status,409);
 assert.equal((await api('ride',{client:'tab',action:'join',slot:'driver'})).body.ride.seats.driver.role,'sid');
 const heartbeat=await api('presence',{client:'tab',scene:'street',x:600,y:190,seat:null,facing:1,hand:null});assert.equal(heartbeat.status,200);assert.equal(heartbeat.body.player.x,320);
 await api('logout',{});assert.equal(JSON.parse(app.store.db.prepare('SELECT state FROM shared_rides').get().state).seats.driver,null);
});
test('HTTP ticket claim survives account reconnect and excludes foreign controllers',async t=>{
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});t.after(()=>app.close());await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const account=await app.store.register('ticket_account','ticket-password-long','suki'),origin='http://127.0.0.1:'+app.server.address().port;
 const api=async(input)=>{const r=await fetch(origin+'/api/ticket',{method:input?'POST':'GET',headers:{Cookie:'hutong_session='+account.token,'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});return {status:r.status,body:await r.json()};};
 await api();const p=app.players.get(account.user.id);Object.assign(p,{scene:'google',x:320,y:285,activity:'walk'});app.life.savePosition(p);
 const claimed=await api({client:'owner',action:'claim'});assert.equal(claimed.status,200);assert.equal(claimed.body.ticket.person,'Suki');assert.equal((await api({client:'other',action:'claim'})).status,409);
 app.players.delete(account.user.id);assert.deepEqual((await api()).body.ticket,claimed.body.ticket);assert.equal((await api({client:'owner',action:'claim'})).body.collection[0].count,1);
});
test('warm replica stale room cannot evict a rider whose durable scene is street',async t=>{
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});t.after(()=>app.close());await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const rider=await app.store.register('warm_rider','warm-rider-password','sid'),viewer=await app.store.register('warm_viewer','warm-viewer-password','suki'),origin='http://127.0.0.1:'+app.server.address().port;
 const api=async(account,path,input)=>{const r=await fetch(origin+'/api/'+path,{method:input?'POST':'GET',headers:{Cookie:'hutong_session='+account.token,'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});return {status:r.status,body:await r.json()};};
 await api(rider,'control',{client:'tab'});const p=app.players.get(rider.user.id);Object.assign(p,{scene:'street',x:320,y:285,seat:null,activity:'walk',fresh:false});app.life.savePosition(p);
 assert.equal((await api(rider,'ride',{client:'tab',action:'join',slot:'driver'})).status,200);
 // This memory pose models an instance that has received the new replicated
 // durable position and ride row, while retaining its earlier player object.
 Object.assign(p,{scene:'hutong',x:234,y:194,activity:'walk',at:Date.now()+1000});
 assert.equal((await api(viewer,'ride')).body.ride.seats.driver?.role,'sid');
 const recovered=await api(rider,'ride?client=tab');assert.equal(recovered.body.ride.seats.driver?.role,'sid');assert.equal(p.scene,'street');assert.equal(p.activity,'scooter');
 await api(rider,'ride',{client:'tab',action:'leave'});assert.equal(p.activity,'walk');
 // The reverse discrepancy must also honour a committed transition away.
 await api(rider,'ride',{client:'tab',action:'join',slot:'driver'});
 app.life.savePosition({id:rider.user.id,scene:'campus',x:300,y:260,activity:'walk',seat:null});
 assert.equal((await api(viewer,'ride')).body.ride.seats.driver,null);
 assert.equal(app.life.position(rider.user.id).scene,'campus','cleanup must not overwrite committed remote travel');
});
