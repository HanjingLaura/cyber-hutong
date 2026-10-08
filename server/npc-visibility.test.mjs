import test from 'node:test';
import assert from 'node:assert/strict';
import rules from '../shared/npcs.json' with {type:'json'};
import desks from '../shared/workstations.json' with {type:'json'};
import positions from '../shared/guests.json' with {type:'json'};
import {npcVisible,visibleNpcs} from './npc-visibility.mjs';
import {createMvpServer} from './app.mjs';

const owners={ani:['sid','hutong'],buzz:['cora','pop'],zhu:['jilly','concert'],ferret:['amber','bathroom'],lulu:['suki','dance'],tutu:['kay','gym']};

test('every easter egg is always visible except Ani, who follows Sid working at his own desk',()=>{
 assert.deepEqual(Object.fromEntries(rules.map(r=>[r.id,[r.owner,r.room]])),owners);
 for(const rule of rules)assert.equal(rule.condition,rule.id==='ani'?'working':'always');
 assert.deepEqual(visibleNpcs(rules,[],desks).map(r=>r.id).sort(),['buzz','ferret','lulu','tutu','zhu']);
 const ani=rules.find(r=>r.id==='ani');
 const sid=over=>({role:'sid',scene:'hutong',seat:'L1',activity:'working',...over});
 assert.equal(npcVisible(ani,[sid()],desks),true);
 assert.equal(npcVisible(ani,[sid({seat:'L2',activity:'sit'})],desks),false);
 assert.equal(npcVisible(ani,[sid({seat:null,activity:'walk'})],desks),false);
 assert.equal(npcVisible(ani,[sid({scene:'hawaii'})],desks),false);
 assert.equal(npcVisible(ani,[sid({role:'suki',seat:'L2'})],desks),false);
 assert.equal(npcVisible({...ani,condition:'present'},[sid()],desks),false);
});

test('server: observers see every egg, only owners can interact; Ani needs Sid working at L1',async t=>{
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port;
 const register=async role=>{const r=await fetch(base+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'npc_'+role,password:'npc-test-password',role})});return{role,user:(await r.json()).user,cookie:r.headers.get('set-cookie').split(';')[0],client:role+'-client'};};
 const post=(account,path,data={})=>fetch(base+'/api/'+path,{method:'POST',headers:{Cookie:account.cookie,'Content-Type':'application/json'},body:JSON.stringify({client:account.client,...data})});
 const accounts={};for(const role of ['laura','sid','cora','jilly','amber','suki','kay']){accounts[role]=await register(role);await post(accounts[role],'control');}
 const place=(role,state)=>Object.assign(app.players.get(accounts[role].user.id),{x:0,y:0,seat:null,activity:'walk',facing:0,moving:false,at:Date.now(),...state});
 const worldFor=async account=>{const c=new AbortController(),res=await fetch(base+'/api/events?client='+account.client,{headers:{Cookie:account.cookie},signal:c.signal}),reader=res.body.getReader();let text='';while(!text.includes('event: world'))text+=new TextDecoder().decode((await reader.read()).value);c.abort();return JSON.parse(text.match(/event: world\ndata: ([^\n]+)/)[1]);};
 for(const [id,[owner,room]] of Object.entries(owners)){
  if(id==='ani')continue;
  const p=positions[id];place('laura',{scene:room,x:p.x,y:p.y+5});place(owner,{scene:room,x:p.x,y:p.y+5});
  assert.equal((await post(accounts.laura,'npc',{npc:id})).status,403,id+' observer');
  await new Promise(r=>setTimeout(r,3100));
  assert.equal((await post(accounts[owner],'npc',{npc:id})).status,200,id+' owner');
 }
 // Owners elsewhere: the eggs are still listed for an observer.
 for(const role of ['cora','jilly','amber','suki','kay'])place(role,{scene:'hutong',x:300,y:200});
 place('sid',{scene:'hutong',x:300,y:200});
 let world=await worldFor(accounts.laura);assert.deepEqual([...world.npcs].sort(),['buzz','ferret','lulu','tutu','zhu']);
 place('laura',{scene:'hutong',x:positions.ani.x,y:positions.ani.y+10});
 assert.equal((await post(accounts.sid,'npc',{npc:'ani'})).status,409,'Sid not working: Ani hidden');
 place('sid',{scene:'hutong',x:positions.ani.x-40,y:positions.ani.y+40,seat:'L1',activity:'working'});
 world=await worldFor(accounts.laura);assert.ok(world.npcs.includes('ani'));
 assert.equal((await post(accounts.laura,'npc',{npc:'ani'})).status,403,'Ani observer');
 await new Promise(r=>setTimeout(r,3100));
 assert.equal((await post(accounts.sid,'npc',{npc:'ani'})).status,200,'Ani owner');
 place('sid',{scene:'hutong',x:positions.ani.x,y:positions.ani.y+10,seat:'L2',activity:'sit'});
 world=await worldFor(accounts.laura);assert.ok(!world.npcs.includes('ani'));
});
