import test from 'node:test';
import assert from 'node:assert/strict';
import {createMvpServer} from './app.mjs';

test('three accounts see the same lobby, isolated scene histories and private two-person messages in history and SSE',async t=>{
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 t.after(()=>{app.close();app.server.closeAllConnections();});const root=`http://127.0.0.1:${app.server.address().port}/api/`;
 const account=async role=>{const response=await fetch(root+'register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'channels_'+role,password:'channel-test-password',role})});const cookie=response.headers.get('set-cookie').split(';')[0],{user}=await response.json();return {cookie,user};};
 const a=await account('suki'),b=await account('sid'),c=await account('jilly');
 const api=async(user,path,input)=>{const response=await fetch(root+path,{method:input?'POST':'GET',headers:{Cookie:user.cookie,'Content-Type':'application/json'},body:input?JSON.stringify(input):undefined});return {status:response.status,data:await response.json()};};
 const buffers=new Map();
 for(const user of [a,b,c]){
  const abort=new AbortController();t.after(()=>abort.abort());const res=await fetch(root+'events?client='+user.user.role,{headers:{Cookie:user.cookie},signal:abort.signal});assert.equal(res.status,200);
  const reader=res.body.getReader();buffers.set(user,'');
  void(async()=>{try{for(;;){const {done,value}=await reader.read();if(done)break;buffers.set(user,buffers.get(user)+new TextDecoder().decode(value));}}catch{}})();
 }
 app.players.get(b.user.id).scene='rest';
 const lobby=await api(a,'chat',{channel:'lobby',text:'lobby-cross-room',mentions:['sid'],requestId:'lobby-1',scene:'fake'});
 assert.equal(lobby.status,200);assert.equal(lobby.data.message.channel,'lobby');assert.deepEqual(lobby.data.message.mentions,['sid']);
 const scene=await api(a,'chat',{text:'legacy-scene-only',requestId:'scene-1'});assert.equal(scene.status,200);assert.equal(scene.data.message.channel,'scene');
 assert.equal((await api(a,'chat',{channel:'dm',peer:'sid',text:'dm-two-people',requestId:'dm-1'})).status,200);
 const history=async(user,query)=>(await api(user,'history?'+query)).data.messages.map(m=>m.body);
 assert.deepEqual(await history(b,'channel=lobby'),['lobby-cross-room']);
 assert.deepEqual(await history(c,'channel=lobby'),['lobby-cross-room']);
 assert.deepEqual(await history(b,'channel=scene'),[]);assert.deepEqual(await history(c,'channel=scene'),['legacy-scene-only']);
 assert.deepEqual(await history(b,'channel=dm&peer=suki'),['dm-two-people']);assert.deepEqual(await history(c,'channel=dm&peer=sid'),[]);
 const replay=await api(a,'chat',{channel:'lobby',text:'lobby-cross-room',mentions:['sid'],requestId:'lobby-1'});assert.equal(replay.data.message.seq,lobby.data.message.seq);
 await new Promise(r=>setTimeout(r,150));
 assert.ok(buffers.get(b).includes('lobby-cross-room'));assert.ok(buffers.get(c).includes('lobby-cross-room'));
 assert.ok(!buffers.get(b).includes('legacy-scene-only'));assert.ok(buffers.get(c).includes('legacy-scene-only'));
 assert.ok(buffers.get(b).includes('dm-two-people'));assert.ok(!buffers.get(c).includes('dm-two-people'));
 assert.equal((await api(a,'chat',{channel:'lobby',peer:'sid',text:'invalid',requestId:'invalid-1'})).status,400);
 assert.equal((await api(a,'history?channel=dm')).status,400);
 assert.equal((await api(a,'chat',{channel:'unknown',text:'invalid',requestId:'invalid-2'})).status,400);
});
