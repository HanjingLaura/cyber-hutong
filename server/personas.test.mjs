import test from 'node:test';
import assert from 'node:assert/strict';
import {distillProfile,replyFor,habits,voices,roles} from './personas.mjs';
import {storyInterval,soloBias} from './director.mjs';
import {createMvpServer} from './app.mjs';

test('distillProfile version 3 keeps human voice defaults and extracts likes',()=>{
 for(const role of roles){
  const blank=distillProfile({},role);
  assert.equal(blank.version,3);
  assert.ok(blank.distilled.facts.length>=1,role);
  assert.equal(blank.voice,voices[role]);
  assert.equal(blank.distilled.expression,voices[role]);
  assert.match(blank.habits,new RegExp(habits[role].slice(0,6)));
 }
 const kay=distillProfile({habits:'会去健身。早上给 Sid 买咖啡。',voice:'温和一点',examples:'[碰面] 要不要一起去休息室？\n咖啡好了',confirmed:true,autoReply:true},'kay');
 assert.ok(kay.distilled.likes.some(like=>/健身|咖啡|Sid/.test(like)));
 assert.equal(kay.distilled.rules['碰面'][0],'要不要一起去休息室？');
 assert.equal(kay.autoReply,true);
});

test('replyFor rotates natural first-person answers instead of one fixed line',()=>{
 const a=replyFor('suki','你平时喜欢做什么？',{});
 const b=replyFor('suki','你平时喜欢做什么？',{},{peer:'laura',scene:'rest'});
 assert.match(a,/^我/);
 assert.notEqual(a,'我听到了，你接着说。');
 assert.match(replyFor('kay','你好',{},{peer:'sid'}),/嗨/);
 assert.match(replyFor('kay','要不要一起去？',{}),/一起|去|哪/);
 const confirmed=replyFor('jilly','嗨',{confirmed:true,examples:'今晚演唱会见\n[办公] 我先回工位',autoReply:true},{peer:'laura'});
 assert.equal(confirmed,'今晚演唱会见');
});

test('storyInterval follows mvp-spec T(N) for 0-8 online people',()=>{
 const bases={0:15,1:10,2:7.5,3:6,4:5,5:900/(1+2.5)/60,6:3.75,7:900/(1+3.5)/60};
 for(const [n,minutes] of Object.entries(bases)){
  const mid=storyInterval(Number(n),()=>0.5);
  assert.ok(Math.abs(mid-minutes*60000)<1,`N=${n} mid=${mid}`);
  const low=storyInterval(Number(n),()=>0);
  const high=storyInterval(Number(n),()=>1);
  assert.ok(low>=minutes*60000*0.8-1);
  assert.ok(high<=minutes*60000*1.2+1);
 }
 assert.equal(storyInterval(8),null);
 assert.equal(storyInterval(99),null);
 assert.ok(soloBias(0)>soloBias(7));
 assert.ok(soloBias(0)<=0.6+1e-9);
 assert.ok(soloBias(7)>=0.35-1e-9);
});

test('director look-back clock and candidate bias adapt to online occupancy',async t=>{
 let clock=Date.now();
 t.mock.method(Date,'now',()=>clock);
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});
 t.after(()=>app.close());
 for(const role of roles)await app.store.register('occ_'+role,'test-password-123',role);
 clock+=5001;app.autonomy.tick();
 for(const p of app.autonomy.doubles.values())p.next=Infinity;

 const next=app.director.status().nextAt;
 assert.ok(next>=clock+12*60000&&next<=clock+18*60000,'N=0 uses 15min ±20% look-back window');
 assert.equal(app.director.status().online,0);

 const laura=app.store.byRole('laura');
 app.players.set(laura.id,{id:laura.id,role:'laura',scene:'rest',x:320,y:200,facing:0,moving:false,seat:null,activity:'walk'});
 app.autonomy.reclaim(laura.id);
 assert.equal(app.autonomy.onlineCount(),1);
 assert.deepEqual(app.autonomy.onlineScenes(),['rest']);

 const near=app.director.candidates(clock).filter(c=>c.kind==='gift'||c.kind==='meet');
 assert.ok(near.some(c=>c.weight>0));
 const restBoost=near.find(c=>c.people.every(id=>app.autonomy.get(id)?.scene==='rest'||true));
 assert.ok(restBoost);

 // Fill to eight online humans: autonomous look-back stories must stop.
 for(const role of roles){
  const account=app.store.byRole(role);
  if(!app.players.has(account.id))app.players.set(account.id,{id:account.id,role,scene:'hutong',x:200,y:200,facing:0,moving:false,seat:null,activity:'walk'});
  app.autonomy.reclaim(account.id);
 }
 assert.equal(app.autonomy.onlineCount(),8);
 assert.equal(app.director.candidates(clock).length,0);
 assert.equal(app.director.start({id:'noop',kind:'gacha',people:[laura.id],roles:['laura'],weight:1},clock),false);
 app.store.db.prepare('UPDATE activity_clock SET next_at=? WHERE id=1').run(clock);
 assert.equal(app.director.tick(clock),false);
 assert.ok(app.director.status().nextAt>clock);
});
