import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMvpServer} from './app.mjs';

const rooms=JSON.parse(readFileSync(new URL('../shared/rooms.json',import.meta.url)));
async function fixture(t){
 const app=createMvpServer({dbPath:':memory:'});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(()=>app.close());
 const root=`http://127.0.0.1:${app.server.address().port}/api/`;let cookie='';
 const api=async(path,input)=>{const res=await fetch(root+path,{method:input===undefined?'GET':'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:input===undefined?undefined:JSON.stringify(input)});return {status:res.status,data:await res.json(),res};};
 const account=await api('register',{username:'nav_user',password:'navigation-password'});cookie=account.res.headers.get('set-cookie').split(';')[0];
 await api('claim',{role:'sid'});await api('control',{client:'nav-tab'});
 return {app,api,player:()=>app.players.get(account.data.user.id)};
}
test('quick travel bypasses distance only; legacy travel, seats, activities and control still enforce their rules',async t=>{
 const f=await fixture(t),request={client:'nav-tab',target:'rest'};
 assert.equal((await f.api('transition',request)).status,409);
 assert.equal((await f.api('transition',{...request,quick:'true'})).status,400);
 assert.equal((await f.api('transition',{...request,quick:true,client:'viewer'})).status,409);
 f.player().seat='L1';assert.equal((await f.api('transition',{...request,quick:true})).status,409);
 f.player().seat=null;f.player().activity='dance';assert.equal((await f.api('transition',{...request,quick:true})).status,409);
 f.player().activity='walk';
 const moved=await f.api('transition',{...request,quick:true});assert.equal(moved.status,200);assert.equal(moved.data.player.scene,'rest');
});
test('50 transitions cover every room and private location recovers the committed authoritative pose',async t=>{
 const f=await fixture(t),keys=Object.keys(rooms),visited=new Set();
 for(let n=0;n<50;n++){
  const target=keys[(n+1)%keys.length],current=f.player();
  Object.assign(current,{x:rooms[current.scene].exit[0],y:rooms[current.scene].exit[1]});
  const result=await f.api('transition',{client:'nav-tab',target});assert.equal(result.status,200,`${current.scene} -> ${target}`);
  visited.add(target);
  const location=await f.api('location');assert.equal(location.status,200);assert.equal(location.data.player.scene,target);
  assert.equal(location.data.player.x,rooms[target].exit[0]);assert.equal(location.data.player.seat,null);
 }
 assert.equal(visited.size,keys.length);
});

test('presence uses elapsed movement time despite heartbeat and location requests, then confirms an exit transition',async t=>{
 let now=Date.now();t.mock.method(Date,'now',()=>now);const f=await fixture(t);
 const pose={client:'nav-tab',scene:'hutong',x:546,y:194,seat:null,activity:'walk',facing:0,hand:null};
 assert.equal((await f.api('presence',pose)).status,200);
 now+=1000;await f.api('location');
 const moved=await f.api('presence',{...pose,x:576});assert.equal(moved.status,200,JSON.stringify(moved.data));
 now+=1000;assert.equal((await f.api('presence',{...pose,x:596})).status,200);
 assert.equal((await f.api('transition',{client:'nav-tab',target:'rest'})).status,200);
 now+=1;const rejected=await f.api('presence',{...pose,scene:'rest',x:320,y:300});assert.equal(rejected.status,409);assert.match(rejected.data.error,/移动过快/);
});

test('lost response recovery on a live warm instance adopts the pulled committed scene and rejects old poses',async t=>{
 const f=await fixture(t),player=f.player();player.fresh=false;
 f.app.life.savePosition({...player,scene:'rest',x:554,y:184,seat:null,activity:'walk'},{checkpoint:undefined});
 assert.equal(player.disconnectedAt,undefined);assert.equal(player.scene,'hutong');
 const recovered=await f.api('location');assert.equal(recovered.data.player.scene,'rest');assert.equal(player.scene,'rest');
 const stale=await f.api('presence',{client:'nav-tab',scene:'hutong',x:596,y:194,seat:null,activity:'walk',facing:0,hand:null});assert.equal(stale.status,409);
 assert.equal(f.app.life.position(player.id).scene,'rest');
 // An explicit location read must not snap same-room live movement to an older save.
 player.x=550;assert.equal((await f.api('location')).data.player.x,550);
});
