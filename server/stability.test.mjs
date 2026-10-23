import test from 'node:test';
import assert from 'node:assert/strict';
import {createMvpServer} from './app.mjs';
import geometry from '../shared/interactions.json' with {type:'json'};

async function fixture(t){
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 t.after(()=>{app.close();app.server.closeAllConnections();});const account=await app.store.register('stability_laura','stability-password','laura');
 const api=async(path,input)=>{const response=await fetch(`http://127.0.0.1:${app.server.address().port}/api/${path}`,{method:'POST',headers:{Cookie:'hutong_session='+account.token,'Content-Type':'application/json'},body:JSON.stringify(input)});return{status:response.status,data:await response.json()};};
 await api('control',{client:'stable-tab'});return{app,api,user:account.user,player:app.players.get(account.user.id)};
}

test('a seat approached during the normal checkpoint interval is accepted, while instant remote seating remains blocked',async t=>{
 const f=await fixture(t),seat=geometry.hutong.seats.L3,now=Date.now();
 Object.assign(f.player,{scene:'hutong',x:seat.approach[0]+80,y:seat.approach[1],seat:null,activity:'walk',at:now-1000,fresh:false});
 const input={client:'stable-tab',scene:'hutong',x:seat.at[0],y:seat.at[1],facing:0,seat:'L3',activity:'working',hand:null};
 const sitting=await f.api('presence',input);assert.equal(sitting.status,200,JSON.stringify(sitting.data));assert.equal(f.player.seat,'L3');
 Object.assign(f.player,{x:seat.approach[0]+300,y:seat.approach[1],seat:null,activity:'walk',at:Date.now(),fresh:false});
 assert.equal((await f.api('presence',input)).status,409);
});

test('a live browser keeps its seat while a paused checkpoint is old, and expired presence still releases it',async t=>{
 t.mock.timers.enable({apis:['setInterval']});
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});t.after(()=>app.close());
 const account=await app.store.register('seat_liveness','stability-password','laura'),now=Date.now();
 app.presence.connect(account.user.id,'live-tab','generation');
 const p={id:account.user.id,role:'laura',scene:'hutong',x:384,y:207,seat:'L3',activity:'working',facing:0,moving:false,at:now-50000};app.players.set(p.id,p);
 t.mock.timers.tick(15000);assert.equal(p.seat,'L3');
 app.store.db.prepare('UPDATE browser_presence SET at=? WHERE account=?').run(now-120000,p.id);
 t.mock.timers.tick(15000);assert.equal(app.players.has(p.id),false);
});

test('a backward server clock adjustment does not reject an unchanged valid position',async t=>{
 const f=await fixture(t);Object.assign(f.player,{x:596,y:194,fresh:false,at:Date.now()+1000});
 const response=await f.api('presence',{client:'stable-tab',scene:'hutong',x:596,y:194,facing:0,seat:null,activity:'walk',hand:null});
 assert.equal(response.status,200,JSON.stringify(response.data));
});
