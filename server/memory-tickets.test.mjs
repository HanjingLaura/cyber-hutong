import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from './store.mjs';
import {createLife} from './life.mjs';
import {createWorld} from './world.mjs';
import {createTickets} from './rides.mjs';

const expected = {
 suki:['Suki Xu','TT710','B12','16A'], sid:['Sid Qin','TT628','B16','12A'],
 jilly:['Jilly Han','TT639','B12','18F'], laura:['Laura Han','TT628','B16','12A'],
 kay:['Kay Qiang','TT631','B06','01A'], franco:['Franco Wen','TT007','A07','07F'],
 cora:['Cora Kong','TT523','B08','14A'], amber:['Amber Guo','TT684','A09','07A'],
};

test('all eight roles receive their own reference ticket, ignoring requested passenger fields',()=>{
 const store=openStore(':memory:'),life=createLife(store),world=createWorld(store,life),tickets=createTickets(store,life,world);
 try {
  for(const [role,fields] of Object.entries(expected)) {
   store.db.prepare('INSERT INTO accounts(id,username,password,role) VALUES(?,?,?,?)').run(role,role,'unused',role);
   const user=store.publicAccount(store.byId(role));
   const first=tickets.claim({...user,role:'untrusted-role',passenger:'Someone else',flight:'WRONG'},{scene:'google'});
   assert.equal(first.role,role);
   assert.deepEqual([first.passenger,first.flight,first.gate,first.seat],fields);
   assert.equal(first.boarding,'13:30');
   assert.deepEqual(tickets.claim(user,{scene:'google'}),first);
   assert.equal(life.collection(role)[0].count,1);
  }
  assert.equal(tickets.get('outsider'),null);
 } finally {store.close();}
});

test('previously collected tickets acquire reference details without creating a second collectible',()=>{
 const store=openStore(':memory:'),life=createLife(store),world=createWorld(store,life),tickets=createTickets(store,life,world);
 try {
  store.db.prepare('INSERT INTO accounts(id,username,password,role) VALUES(?,?,?,?)').run('old','old','unused','suki');
  const user=store.publicAccount(store.byId('old'));
  const old={id:'google-2026:old',role:'suki',person:'Suki',claimedAt:123,name:'车票·Human2026→Agent2027'};
  world.write(user.id,'ticket','google-2026',old);
  const upgraded=tickets.get(user.id);
  assert.equal(upgraded.passenger,'Suki Xu');
  assert.equal(upgraded.claimedAt,123);
  assert.equal(tickets.claim(user,{scene:'google'}).seat,'16A');
 } finally {store.close();}
});
