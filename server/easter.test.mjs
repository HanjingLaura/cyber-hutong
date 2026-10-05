import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from './store.mjs';
import {createCeline,celineQuestion} from './celine.mjs';
import {createMvpServer} from './app.mjs';

test('Celine is one persisted visitor; Hutong never seats her, Hawaii uses HL3 and speech has descending probabilities',()=>{
 assert.equal(celineQuestion(.59),'Amber 呢？');assert.equal(celineQuestion(.60),'Jilly 呢？');assert.equal(celineQuestion(.85),'Amber 这孩子。');
 const store=openStore(':memory:');try{
  let at=100000;const visitor=createCeline(store,{random:()=>.1,now:()=>at});const first=visitor.snapshot();assert.equal(first.scene,'hawaii');assert.equal(first.seat,'HL3');const occupied=visitor.snapshot([{scene:'hawaii',seat:'HL3'}]);assert.equal(occupied.seat,null);assert.equal(occupied.mode,'standing');
  at=first.nextSpeech;const talking=visitor.snapshot();assert.equal(talking.question,'Amber 呢？');assert.ok(talking.nextSpeech-at>=90000);at+=6001;assert.equal(visitor.snapshot().question,'');const reopened=createCeline(store,{random:()=>.99,now:()=>at});assert.equal(reopened.snapshot().scene,'hawaii');
  store.db.prepare("DELETE FROM world_npcs WHERE id='celine'").run();const hutong=createCeline(store,{random:()=>.5,now:()=>at});const arrived=hutong.snapshot();assert.equal(arrived.scene,'hutong');for(let seconds=0;seconds<90;seconds++){const p=hutong.snapshot([],at+seconds*1000);assert.equal(p.seat,null);assert.notEqual(p.mode,'seated');}
 }finally{store.close();}
});
test('personal eggs are visible to observers but only their owner can interact; Celine cannot be controlled',async t=>{
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port;
 const register=async(role)=>{const r=await fetch(base+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'egg_'+role,password:'egg-test-password',role})});return{user:(await r.json()).user,cookie:r.headers.get('set-cookie').split(';')[0],client:role+'-client'};};
 const owner=await register('cora'),observer=await register('laura');const post=(account,path,data={})=>fetch(base+'/api/'+path,{method:'POST',headers:{Cookie:account.cookie,'Content-Type':'application/json'},body:JSON.stringify({client:account.client,...data})});
 for(const account of [owner,observer]){await post(account,'control');Object.assign(app.players.get(account.user.id),{scene:'pop',x:440,y:280,seat:null,activity:'walk',facing:0,moving:false,at:Date.now()});}
 const denied=await post(observer,'npc',{npc:'buzz'});assert.equal(denied.status,403);assert.equal(app.life.journal(observer.user.id).length,0);
 assert.equal((await post(owner,'npc',{npc:'buzz'})).status,200);const event=app.life.journal(owner.user.id)[0];assert.equal(event.kind,'easter');assert.ok(event.data.npcs.some(n=>n.id==='buzz'&&n.text.includes('Cora')));
 const controller=new AbortController(),response=await fetch(base+'/api/events?client='+observer.client,{headers:{Cookie:observer.cookie},signal:controller.signal}),reader=response.body.getReader();let text='';while(!text.includes('event: world'))text+=new TextDecoder().decode((await reader.read()).value);const match=text.match(/event: world\ndata: ([^\n]+)/);assert.ok(match);const world=JSON.parse(match[1]);assert.ok(world.npcs.includes('buzz'));assert.equal(world.npcReactions[0].owner,'cora');controller.abort();
 assert.equal((await post(owner,'object',{object:'pop:celine',action:'toggle',revision:0,requestId:'invalid'})).status,400);assert.equal((await post(owner,'object',{object:'hutong:celine',action:'toggle',revision:0,requestId:'cannot-control'})).status,403);
});
