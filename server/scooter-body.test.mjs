import test from 'node:test';
import assert from 'node:assert/strict';
import * as collision from '../shared/outdoor-collision.mjs';
import {createMvpServer} from './app.mjs';

test('walking paths stop at the scooter body and go around either side',()=>{
 const ride={x:320,y:285};
 assert.equal(typeof collision.walkerScooterPathClear,'function');
 const clear=collision.walkerScooterPathClear;
 assert.equal(clear(240,285,320,285,ride),false);
 assert.equal(clear(240,285,400,285,ride),false,'cannot skip through between presence packets');
 assert.equal(clear(320,250,320,285,ride),false);
 assert.equal(clear(320,320,320,285,ride),false);
 assert.equal(clear(240,270,400,270,ride),true);
 assert.equal(clear(240,300,400,300,ride),true);
 assert.equal(clear(240,285,260,285,ride),true);
 assert.equal(clear(320,285,320,302,ride),true,'a vehicle arriving over a walker must not trap them');
 assert.equal(clear(270,285,320,285,ride),false,'overlap escape cannot go further into the body');
});

test('HTTP walking rejects both body overlap and jumping across a parked scooter',async t=>{
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});t.after(()=>app.close());
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const account=await app.store.register('scooter_walker','scooter-walker-password','sid');
 const api=async(path,input)=>{const response=await fetch(`http://127.0.0.1:${app.server.address().port}/api/${path}`,{method:'POST',headers:{Cookie:'hutong_session='+account.token,'Content-Type':'application/json'},body:JSON.stringify(input)});return {status:response.status,body:await response.json()};};
 await api('control',{client:'tab'});
 const p=app.players.get(account.user.id);
 const origin=(x,y)=>{Object.assign(p,{scene:'street',x,y,seat:null,activity:'walk',fresh:false,at:Date.now()-1000});app.life.savePosition(p);};
 const move=(x,y)=>api('presence',{client:'tab',scene:'street',x,y,seat:null,facing:1,hand:null,activity:'walk'});
 origin(240,285);assert.equal((await move(320,285)).status,409);
 origin(240,285);assert.equal((await move(400,285)).status,409);
 origin(240,305);assert.equal((await move(400,305)).status,200,'can walk around the vehicle');
 origin(320,297);assert.equal((await api('ride',{client:'tab',action:'join',slot:'driver'})).status,200);
 assert.equal((await api('ride',{client:'tab',action:'leave'})).status,200);
 assert(collision.walkerScooterPathClear(p.x,p.y,p.x,p.y,{x:320,y:285}));
 assert.equal((await move(p.x,p.y)).status,200,'walking after dismount does not snap back into the body');
});

test('dismounting beside every seat stays on pavement and outside the body at every map edge',()=>{
 assert.equal(typeof collision.scooterDismountPoint,'function');
 for(const x of [56,320,584])for(const y of [233,285,345])for(const offset of [-23,0,34]){
  const ride={x,y};const at=collision.scooterDismountPoint(x+offset,y,ride);
  assert(collision.outdoorWalkable('street',...at));
  assert(collision.walkerScooterPathClear(...at,...at,ride));
  assert(Math.hypot(at[0]-x-offset,at[1]-y)<=20);
 }
});
