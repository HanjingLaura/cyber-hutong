import test from 'node:test';
import assert from 'node:assert/strict';
import {ktvSongs,ktvPlayback,emptyKtvPlayer,changeKtvPlayer,songDuration,ktvWalkable,ktvBeatResult,ktvTargets} from '../shared/ktv.mjs';
import geometry from '../shared/interactions.json' with {type:'json'};
import {route} from './autonomy.mjs';
import {openStore} from './store.mjs';
import {createWorld} from './world.mjs';
import {createMvpServer} from './app.mjs';
import {SCENES} from '../shared/party-room.mjs';

test('KTV queue advances on one clock, pause preserves the bar, exhausted queues restart',()=>{
 const first=ktvSongs[0],second=ktvSongs[1],start=10000;
 let state=changeKtvPlayer(emptyKtvPlayer(),'queue',first.id,start);
 state=changeKtvPlayer(state,'queue',second.id,start+1000);
 assert.equal(ktvPlayback(state,start+2000).elapsed,2000);
 state=changeKtvPlayer(state,'play',undefined,start+3000);
 assert.equal(ktvPlayback(state,start+9000).elapsed,3000);
 state=changeKtvPlayer(state,'play',undefined,start+10000);
 const next=ktvPlayback(state,start+10000+songDuration(first));
 assert.equal(next.song.id,second.id);assert.ok(Math.abs(next.elapsed-3000)<.001);
 state=changeKtvPlayer(state,'skip',undefined,start+10001);assert.equal(ktvPlayback(state,start+10001).song.id,second.id);
 state=changeKtvPlayer(state,'queue',first.id,start+100000);
 assert.equal(ktvPlayback(state,start+100000).song.id,first.id);assert.equal(ktvPlayback(state,start+100000).elapsed,0);
 assert.throws(()=>changeKtvPlayer(state,'queue','missing'),/不存在/);
 for(let i=1;i<12;i++)state=changeKtvPlayer(state,'queue',first.id,start+100000);
 assert.throws(()=>changeKtvPlayer(state,'queue',first.id,start+100000),/12/);
 assert.equal(ktvBeatResult(18,120).points,100);assert.equal(ktvBeatResult(140,120).points,60);assert.equal(ktvBeatResult(250,120).points,0);
});

test('KTV furniture leaves routes to every seat and device from the exit',()=>{
 assert.ok(SCENES.includes('ktv'));assert.equal(ktvWalkable(200,252),false);
 const targets=[...Object.values(geometry.ktv.seats).map(s=>s.approach),...Object.values(ktvTargets)];
 for(const target of targets){assert.ok(ktvWalkable(...target),target);const path=route('ktv',[580,321],target);assert.ok(path.length,target);assert.deepEqual(path.at(-1),target);}
});

test('KTV shared controls persist and retries cannot queue twice; remote players cannot control objects',async()=>{
 const store=openStore(':memory:');try{
  const account=await store.register('ktv_world','test-password-123');store.claim(account.user.id,'suki');const user=store.publicAccount(store.byId(account.user.id)),world=createWorld(store);
  const position={scene:'ktv',x:557,y:226},input={object:'ktv:player',action:'queue',song:'night',revision:0,requestId:'queue-once'};
  const one=world.interact(user,position,input,new Map()),two=world.interact(user,position,input,new Map());assert.deepEqual(one,two);
  assert.equal(world.snapshot('ktv').find(o=>o.id==='ktv:player').queue.length,1);
  assert.throws(()=>world.interact(user,{...position,scene:'rest'},{...input,requestId:'wrong-room'},new Map()),/当前房间/);
  assert.throws(()=>world.interact(user,{...position,x:60,y:320},{...input,requestId:'far'},new Map()),/附近/);
  world.interact(user,{scene:'ktv',x:581,y:259},{object:'ktv:lights',action:'light',revision:0,requestId:'light'},new Map());
  const restored=createWorld(store).snapshot('ktv');assert.equal(restored.find(o=>o.id==='ktv:lights').mode,1);assert.deepEqual(restored.find(o=>o.id==='ktv:player').queue,['night']);
 }finally{store.close();}
});

test('KTV doorway, microphone exclusivity, singing anchors and release use the real API',async t=>{
 const app=createMvpServer({dbPath:':memory:'});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(()=>app.close());const root='http://127.0.0.1:'+app.server.address().port;
 const client=async(name,role)=>{let cookie='';const api=async(path,input)=>{const r=await fetch(root+'/api/'+path,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(input)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};};const registered=await api('register',{username:name,password:'test-password-123'});cookie=registered.cookie.split(';')[0];await api('claim',{role});await api('control',{client:name});return {api,id:registered.data.user.id,name};};
 const a=await client('ktv_a','suki'),b=await client('ktv_b','sid'),p=app.players.get(a.id),q=app.players.get(b.id);
 assert.equal((await a.api('transition',{client:a.name,target:'ktv'})).status,409);
 Object.assign(p,{x:596,y:194});assert.equal((await a.api('transition',{client:a.name,target:'ktv'})).status,200);assert.equal(p.scene,'ktv');
 Object.assign(p,{x:417,y:225,at:Date.now()-1000});Object.assign(q,{scene:'ktv',x:417,y:225});
 assert.equal((await a.api('lease',{client:a.name,device:'mic'})).status,200);assert.equal((await b.api('lease',{client:b.name,device:'mic'})).status,409);
 const singing={client:a.name,scene:'ktv',x:399,y:205,facing:0,seat:null,hand:null,revision:0,activity:'sing'};
 assert.equal((await a.api('presence',singing)).status,200);assert.equal((await a.api('transition',{client:a.name,target:'rest'})).status,409);
 assert.equal((await a.api('presence',{...singing,x:417,y:225,activity:'walk'})).status,200);
 await a.api('lease',{client:a.name,device:'mic',release:true});assert.equal((await b.api('lease',{client:b.name,device:'mic'})).status,200);
});
