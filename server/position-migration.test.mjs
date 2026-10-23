import test from 'node:test';
import assert from 'node:assert/strict';
import {createMvpServer} from './app.mjs';
import {sceneWalkable} from '../shared/walkability.mjs';

async function setup(t,pose){
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});t.after(()=>app.close());await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const account=await app.store.register('migration_user','migration-password','sid'),origin='http://127.0.0.1:'+app.server.address().port;
 app.life.savePosition({id:account.user.id,seat:null,facing:0,activity:'walk',...pose});
 const api=async(path,input)=>{const response=await fetch(origin+'/api/'+path,{method:input?'POST':'GET',headers:{Cookie:'hutong_session='+account.token,'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});return {status:response.status,body:await response.json()};};
 return {app,account,api};
}
for(const [label,pose] of [['old upper floor',{scene:'yousheng',x:300,y:220}],['new sculpture footprint',{scene:'yousheng',x:404,y:272}],['Google chair footprint',{scene:'google',x:185,y:240}],['old street background',{scene:'street',x:120,y:200}],['campus cone',{scene:'campus',x:210,y:265}],['campus greenery',{scene:'campus',x:30,y:220}]]){
 test(`loading ${label} migrates invalid walking save to a persisted safe position`,async t=>{
  const f=await setup(t,pose),response=await f.api('location');assert.equal(response.status,200);
  const p=response.body.player;assert(sceneWalkable(p.scene,p.x,p.y),'first client pose must be walkable');
  assert.deepEqual([p.x,p.y],[580,330]);assert.deepEqual([f.app.life.position(f.account.user.id).x,f.app.life.position(f.account.user.id).y],[p.x,p.y]);
 });
}
test('control acquisition loads legacy walking save safely; repeated control does not move active pose',async t=>{
 const f=await setup(t,{scene:'yousheng',x:300,y:220}),claimed=await f.api('control',{client:'tab'});assert.equal(claimed.status,200);assert(sceneWalkable('yousheng',claimed.body.player.x,claimed.body.player.y));
 const p=f.app.players.get(f.account.user.id);Object.assign(p,{x:300,y:220,fresh:false});
 const repeated=await f.api('control',{client:'tab'});assert.equal(repeated.body.player.x,300);assert.equal(repeated.body.player.y,220,'ordinary active control must not trigger recovery');
});
test('valid saved chair stands at its approach and valid walking pose remains in place',async t=>{
 const f=await setup(t,{scene:'google',x:185,y:240,seat:'G1',activity:'sit'}),loaded=await f.api('location');assert.deepEqual([loaded.body.player.x,loaded.body.player.y],[185,275]);
 f.app.players.delete(f.account.user.id);f.app.life.savePosition({id:f.account.user.id,scene:'yousheng',x:300,y:300,seat:null,activity:'walk'});
 const walk=await f.api('location');assert.deepEqual([walk.body.player.x,walk.body.player.y],[300,300]);
});
test('warm explicit location recovery migrates an invalid committed scene arrival',async t=>{
 const f=await setup(t,{scene:'hutong',x:300,y:194});await f.api('control',{client:'tab'});
 f.app.life.savePosition({id:f.account.user.id,scene:'yousheng',x:404,y:272,seat:null,activity:'walk'});
 const response=await f.api('location');assert(sceneWalkable('yousheng',response.body.player.x,response.body.player.y));assert.equal(f.app.life.position(f.account.user.id).x,580);
});
test('warm control takeover adopts and migrates the committed scene without changing active same-controller movement',async t=>{
 const f=await setup(t,{scene:'hutong',x:300,y:194});await f.api('control',{client:'tab'});
 f.app.life.savePosition({id:f.account.user.id,scene:'yousheng',x:300,y:220,seat:null,activity:'walk'});
 const response=await f.api('control',{client:'new-tab'});assert.equal(response.body.player.scene,'yousheng');assert(sceneWalkable('yousheng',response.body.player.x,response.body.player.y));assert.equal(f.app.life.position(f.account.user.id).x,580);
});

test('boarding supersedes an old walking checkpoint and persists the vehicle anchor',async t=>{
 const f=await setup(t,{scene:'street',x:300,y:285});await f.api('control',{client:'tab'});
 const p=f.app.players.get(f.account.user.id);
 f.app.life.savePosition(p,{checkpoint:{id:'old-arrival',scene:'street',x:300,y:285}});
 const joined=await f.api('ride',{client:'tab',action:'join',slot:'driver'});assert.equal(joined.status,200);
 const saved=f.app.life.position(f.account.user.id);assert.equal(saved.x,joined.body.ride.x);assert.equal(saved.y,joined.body.ride.y);assert.equal(saved.checkpoint,undefined);
});
