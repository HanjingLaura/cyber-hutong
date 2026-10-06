import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createMvpServer } from './app.mjs';
import { openStore } from './store.mjs';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const password='mvp-test-password-2026';
async function setup(t){const app=createMvpServer({dbPath:':memory:'});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const root='http://127.0.0.1:'+app.server.address().port;t.after(()=>{app.close();app.server.closeAllConnections();});
  const api=async(path,input,cookie)=>{const res=await fetch(root+'/api/'+path,{method:input===undefined?'GET':'POST',headers:{...(cookie?{Cookie:cookie}:{}),...(input===undefined?{}:{'Content-Type':'application/json'})},body:input===undefined?undefined:JSON.stringify(input)});return {status:res.status,cookie:res.headers.get('set-cookie')?.split(';')[0],data:await res.json()};};
  const account=async(username,role)=>{const reg=await api('register',{username,password});assert.equal(reg.status,200);if(role)assert.equal((await api('claim',{role},reg.cookie)).status,200);return {cookie:reg.cookie,id:reg.data.user.id};};
  const stream=async(auth,client)=>{const abort=new AbortController(),res=await fetch(root+'/api/events?client='+client,{headers:{Cookie:auth.cookie},signal:abort.signal});assert.equal(res.status,200);t.after(()=>abort.abort());return {reader:res.body.getReader(),abort};};
  return {app,api,account,stream,root};
}
test('role claim is exclusive under concurrent requests, sessions and profile survive independent reads',async t=>{
  const {api,account,app}=await setup(t),[a,b]=await Promise.all([account('race_a'),account('race_b')]);
  const results=await Promise.all([api('claim',{role:'suki'},a.cookie),api('claim',{role:'suki'},b.cookie)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const owner=results[0].status===200?a:b;assert.equal((await api('claim',{role:'sid'},owner.cookie)).status,409);
  app.store.profile(owner.id,{habits:'我喜欢米线。',voice:'短句',examples:'走，吃米线。',confirmed:true,autoReply:true});assert.equal(JSON.parse(app.store.byId(owner.id).profile).voice,'短句');assert.equal((await api('profile',{habits:'覆盖'},owner.cookie)).status,404);
  const me=await api('me',undefined,owner.cookie);assert.equal(me.data.user.role,'suki');assert.equal('profile' in me.data.user,false);assert.equal('habits' in me.data,false);
  const invalid=await api('login',{username:'race_a',password:'wrong'});assert.equal(invalid.status,401);
});

test('registration claims a member atomically and eight member accounts can enter together',async t=>{
  const {api,stream,app}=await setup(t),roles=['suki','sid','jilly','laura','kay','franco','cora','amber'];
  const results=await Promise.all(roles.map(role=>api('register',{username:role,password,role})));
  assert.ok(results.every((r,i)=>r.status===200&&r.data.user.role===roles[i]));
  assert.equal(app.store.roster().filter(r=>r.claimed).length,8);
  await Promise.all(results.map((r,i)=>stream({cookie:r.cookie},'member-'+i)));
  assert.equal(app.players.size,8);assert.equal(app.streams.size,8);
  const login=await api('login',{username:'sid',password});assert.equal(login.data.user.role,'sid');
});

test('a concurrent claim cannot leave an extra role-less registration behind',async t=>{
  const {api,app}=await setup(t);
  const results=await Promise.all(['first_member','second_member'].map(username=>api('register',{username,password,role:'suki'})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal(app.store.db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n,1);
  assert.equal((await api('register',{username:'invalid_member',password,role:'celine'})).status,400);
});
test('DM history and SSE are only visible to their two participants; offline replies do not impersonate online users',async t=>{
  const {api,account,stream,app}=await setup(t);const a=await account('private_a','suki'),b=await account('private_b','sid'),c=await account('private_c','jilly');
  await stream(a,'a');await stream(b,'b');const observer=await stream(c,'c');
  let observed='';const reading=(async()=>{try{for(;;){const chunk=await observer.reader.read();if(chunk.done)break;observed+=new TextDecoder().decode(chunk.value);}}catch{}})();
  const sent=await api('chat',{peer:'sid',text:'private-only-unique',requestId:'private-1'},a.cookie);assert.equal(sent.status,200);
  const own=await api('history?peer= sid'.replace(' ',' '),undefined,a.cookie);assert.equal(own.status,400);
  assert.equal((await api('history?peer=suki',undefined,b.cookie)).data.messages.length,1);
  const outside=await api('history?peer=sid',undefined,c.cookie);assert.equal(outside.data.messages.length,0);
  await new Promise(resolve=>setTimeout(resolve,250));observer.abort.abort();await reading;assert.ok(!observed.includes('private-only-unique'));
  assert.equal(app.store.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE npc=1').get().n,0);
  await api('chat',{peer:'amber',text:'你平时喜欢做什么？',requestId:'offline-1'},a.cookie);
  assert.equal((await api('history?peer=amber',undefined,a.cookie)).data.messages.length,1);
  app.store.profile(c.id,{habits:'喜欢演唱会',confirmed:true,autoReply:false});await new Promise(resolve=>setTimeout(resolve,40));await api('chat',{peer:'jilly',text:'你好',requestId:'no-offline-consent'},a.cookie);assert.equal((await api('history?peer=jilly',undefined,a.cookie)).data.messages.length,1);
  app.store.profile(c.id,{habits:'喜欢演唱会',confirmed:true,autoReply:true});await api('chat',{peer:'jilly',text:'你好',requestId:'offline-consent'},a.cookie);assert.equal((await api('history?peer=jilly',undefined,a.cookie)).data.messages.length,3);
});
test('seat races, gift atomicity, stale hand revisions and duplicate operations',async t=>{
  const {api,account,stream,app}=await setup(t),a=await account('game_a','suki'),b=await account('game_b','sid');await stream(a,'a');await stream(b,'b');
  const pose={scene:'hutong',x:500,y:194,facing:0,moving:false,seat:null,hand:null,revision:0};
  // Arrange a test position; production scene changes use the doorway endpoint.
  for(const player of app.players.values())Object.assign(player,{scene:'rest',x:500,y:194,at:Date.now()-3000});
  assert.equal((await api('presence',{...pose,scene:'rest',client:'a'},a.cookie)).status,200);
  assert.equal((await api('presence',{...pose,scene:'rest',x:526,client:'b'},b.cookie)).status,200);
  const seats=await Promise.all([api('presence',{...pose,scene:'rest',seat:'4',x:497,y:236.6,client:'a'},a.cookie),api('presence',{...pose,scene:'rest',seat:'4',x:497,y:236.6,client:'b'},b.cookie)]);assert.deepEqual(seats.map(r=>r.status).sort(),[200,409]);
  for(const p of app.players.values())Object.assign(p,{x:500,y:194,seat:null,at:Date.now()-3000});
  app.store.hand(app.store.byRole('suki').id,'咖啡',0);await api('presence',{...pose,scene:'rest',client:'a',hand:'咖啡'},a.cookie);await api('presence',{...pose,scene:'rest',client:'b',x:526},b.cookie);
  const gift=await api('interact',{peer:'sid',action:'gift',client:'a',revision:1,requestId:'gift-1'},a.cookie);assert.equal(gift.status,200);
  const duplicate=await api('interact',{peer:'sid',action:'gift',client:'a',revision:1,requestId:'gift-1'},a.cookie);assert.equal(duplicate.status,200);assert.equal((await api('me',undefined,a.cookie)).data.user.hand,'咖啡');assert.equal((await api('offer',{client:'b',id:gift.data.id,answer:'accept'},b.cookie)).status,200);
  assert.equal((await api('me',undefined,a.cookie)).data.user.hand,null);assert.equal((await api('me',undefined,b.cookie)).data.user.hand,'咖啡');
  await api('presence',{...pose,scene:'rest',client:'a',hand:'咖啡',revision:1},a.cookie);assert.equal((await api('me',undefined,a.cookie)).data.user.hand,null);
});
test('eight players with 32 SSE connections: bounded movement, single controller, logout and recovery',async t=>{
  const {api,account,stream,app}=await setup(t),roles=['suki','sid','jilly','laura','kay','franco','cora','amber'];
  const accounts=await Promise.all(roles.map((role,i)=>account('load_'+i,role)));
  const channels=await Promise.all(accounts.flatMap((a,i)=>[0,1,2,3].map(tab=>stream(a,`player-${i}-${tab}`))));assert.equal(app.streams.size,32);assert.equal(app.players.size,8);
  for(const [i,p] of [...app.players.values()].entries())Object.assign(p,{scene:'rest',x:90+i*65,y:240,at:Date.now()-3000});
  const actions=await Promise.all(accounts.map((a,i)=>api('presence',{client:`player-${i}-0`,scene:'rest',x:90+i*65,y:240,facing:0,moving:true,seat:null,hand:null,revision:0},a.cookie)));assert.ok(actions.every(r=>r.status===200));
  for(let tick=1;tick<=20;tick++){await new Promise(resolve=>setTimeout(resolve,100));const updates=await Promise.all(accounts.map((a,i)=>api('presence',{client:`player-${i}-0`,scene:'rest',x:90+i*65+tick%2,y:240,facing:tick%4,moving:true,seat:null,hand:null,revision:0},a.cookie)));assert.ok(updates.every(r=>r.status===200));}assert.equal(app.streams.size,32);
  assert.equal((await api('presence',{client:'player-0-1',scene:'rest',x:90,y:240,facing:0,moving:false,seat:null,hand:null,revision:0},accounts[0].cookie)).status,409);
  assert.equal((await api('control',{client:'player-0-1'},accounts[0].cookie)).status,200);
  assert.equal((await api('presence',{client:'player-0-1',scene:'rest',x:91,y:240,facing:0,moving:false,seat:null,hand:null,revision:0},accounts[0].cookie)).status,200);
  assert.equal((await api('logout',{},accounts[0].cookie)).status,200);assert.equal((await api('me',undefined,accounts[0].cookie)).data.user,null);
  assert.equal((await api('login',{username:'load_0',password})).data.user.role,'suki');channels.forEach(c=>c.abort.abort());
});

test('account, session, role profile, held item and private history survive a database reopen',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'hutong-mvp-'));const path=join(dir,'test.sqlite');let store=openStore(path);t.after(()=>{store.close();assert.ok(dir.startsWith(join(tmpdir(),'hutong-mvp-')));rmSync(dir,{recursive:true,force:true});});
  const registered=await store.register('persist_user',password),id=registered.user.id;store.claim(id,'amber');store.profile(id,{habits:'喜欢和 Cora 逛店',voice:'简短',confirmed:true,autoReply:false});store.hand(id,'咖啡',0);store.message('amber','cora','pop','下次一起逛','persist-message');store.close();store=openStore(path);
  const restored=store.session(registered.token);assert.equal(restored.role,'amber');assert.equal(restored.hand,'咖啡');assert.equal(JSON.parse(store.byId(id).profile).voice,'简短');assert.equal('profile' in restored,false);assert.equal(store.history('amber','cora','pop').length,1);assert.equal(store.history('sid','cora','pop').length,0);
});
test('origin protection and untrusted inputs fail without altering another account',async t=>{
  const {api,account,root}=await setup(t),a=await account('boundary_a','cora');
  const request=await fetch(root+'/api/profile',{method:'POST',headers:{Cookie:a.cookie,Origin:'http://evil.example','Content-Type':'application/json'},body:JSON.stringify({habits:'overwrite'})});assert.equal(request.status,403);
  assert.equal((await api('chat',{peer:'celine',text:'hi',requestId:'x'},a.cookie)).status,400);assert.equal((await api('profile',{memberId:'sid',habits:'自己的资料'},a.cookie)).status,404);
});

test('emotes play invites and score shouts keep co-play lively without leaving the room',async t=>{
  const {api,account,stream,app}=await setup(t),a=await account('fun_a','laura'),b=await account('fun_b','sid');
  await stream(a,'a');await stream(b,'b');
  for(const p of app.players.values())Object.assign(p,{scene:'arcade',x:300,y:200,at:Date.now()-3000});
  assert.equal((await api('interact',{action:'emote',emote:'wave',client:'a',requestId:'wave-1'},a.cookie)).status,200);
  assert.equal((await api('interact',{action:'emote',emote:'shrug',client:'a',requestId:'bad-emote'},a.cookie)).status,400);
  const room=await api('history',undefined,a.cookie);assert.ok(room.data.messages.some(m=>m.body.includes('挥手')));
  const invite=await api('invite',{peer:'sid',place:'arcade',client:'a',requestId:'play-arcade'},a.cookie);assert.equal(invite.status,200);assert.equal(invite.data.offer.item,'arcade');
  assert.equal((await api('offer',{client:'b',id:invite.data.offer.id,answer:'accept'},b.cookie)).status,200);
  for(const p of app.players.values())Object.assign(p,{scene:'arcade',x:300,y:200});
  app.autonomy.tick();assert.equal(app.life.meeting(a.id),undefined);
  assert.ok(app.life.journal(a.id).some(e=>e.body.includes('娱乐室')));
  assert.equal((await api('progress',{kind:'score',key:'basketball',data:{value:12},client:'a'},a.cookie)).status,200);
  assert.ok((await api('history',undefined,a.cookie)).data.messages.some(m=>m.body.includes('投篮纪录')));
  assert.equal((await api('progress',{kind:'score',key:'basketball',data:{value:10},client:'a'},a.cookie)).status,200);
  assert.equal((await api('history',undefined,a.cookie)).data.messages.filter(m=>m.body.includes('投篮纪录')).length,1);
});
