import test from 'node:test';
import assert from 'node:assert/strict';
import { BehaviorEngine } from './engine.mjs';
import { roster, seats } from './config.mjs';
const morning = Date.parse('2026-09-29T09:30:00+08:00');
test('eight identities and fixed seats', () => {
  assert.equal(new Set(roster.map(r => r.id)).size, 8);
  assert.deepEqual(Object.values(seats), ['jilly','cora','amber','franco','sid','suki','laura','kay']);
});
test('encounters restricted, repeated entry idempotent, departure cleans up', () => {
  const e = new BehaviorEngine();
  assert.deepEqual(e.enter('sid', 'concert'), []);
  assert.equal(e.enter('jilly', 'concert')[0].npc, 'zhu_zhixin');
  assert.deepEqual(e.enter('jilly', 'concert'), []);
  assert.equal(e.canInteract('sid', 'zhu_zhixin'), false);
  assert.equal(e.canInteract('jilly', 'zhu_zhixin'), true);
  assert.equal(e.enter('jilly', 'hutong')[0].type, 'despawn');
  assert.equal(e.enter('cora', 'popmart')[0].npc, 'buzz_lightyear');
  assert.equal(e.enter('amber', 'restroom')[0].npc, 'fuguidiao');
});
test('Celine asks exactly on entry when Amber is absent', () => {
  const e = new BehaviorEngine();
  assert.deepEqual(e.enter('celine', 'hutong'), []);
  e.enter('celine','hawaii'); e.enter('amber','restroom');
  assert.equal(e.enter('celine','hutong')[0].text, 'amber呢');
  assert.deepEqual(e.enter('celine','hutong'), []);
});
test('coffee requires physical phases, persists daily dedup, afternoon belongs to Amber', () => {
  let e = new BehaviorEngine(); const [cmd] = e.tick(morning);
  assert.equal(cmd.actor,'kay');
  assert.deepEqual(e.coffeeReached(cmd.eventId,'coffee_machine',morning), []);
  e.enter('kay','rest_area');
  assert.equal(e.coffeeReached(cmd.eventId,'coffee_machine',morning)[0].type,'acquire_coffee');
  assert.deepEqual(e.coffeeReached(cmd.eventId,'coffee_machine',morning), []);
  e.enter('kay','hutong');
  assert.equal(e.coffeeReached(cmd.eventId,'opposite-1',morning)[0].type,'deliver_coffee');
  e = new BehaviorEngine(e.snapshot());
  assert.deepEqual(e.tick(morning + 60000), []);
  assert.equal(e.tick(Date.parse('2026-09-29T14:30:00+08:00'))[0].actor,'amber');
});
test('manual coffee needs consent, decline prevents repeated prompting', () => {
  const e = new BehaviorEngine(); e.setMode('kay','manual');
  const [cmd] = e.tick(morning); assert.equal(cmd.type,'invite');
  e.respondCoffee(cmd.eventId,'kay',false,morning);
  assert.deepEqual(e.tick(morning+1000),[]);
});
test('manual override cancels automation; preference never moves a manual actor', () => {
  const e = new BehaviorEngine(); e.tick(morning);
  assert.equal(e.manualOverride('kay')[0].type,'cancel_event');
  assert.equal(e.proposeActivity('kay',['gym']),null);
  assert.deepEqual(e.proposeActivity('sid',['development'],()=>0),{actor:'sid',activity:'development'});
});
test('group meets before transfer; optional Laura decline does not block', () => {
  const e = new BehaviorEngine(); e.setMode('laura','manual');
  const [invite] = e.invite('outing',{includeLaura:true},morning);
  const moves = e.respondInvite(invite.eventId,'laura',false,morning);
  assert.equal(moves.length,2);
  assert.deepEqual(e.invitationReached(invite.eventId,'amber',morning),[]);
  e.enter('amber','elevator'); e.enter('cora','elevator');
  assert.deepEqual(e.invitationReached(invite.eventId,'amber',morning),[]);
  assert.equal(e.invitationReached(invite.eventId,'cora',morning)[0].type,'destination_unconfigured');
});
test('unanswered optional Laura expires while core pair proceeds', () => {
  const e = new BehaviorEngine(); e.setMode('laura','manual');
  e.invite('outing',{includeLaura:true},morning);
  const commands=e.tick(morning+90001);
  assert.equal(commands.filter(c=>c.scene==='elevator').length,2);
  assert.equal(e.actor('laura').busy,null);
});
test('Hawaii invites only Amber/Jilly, needs Celine there, manual acceptance', () => {
  const e = new BehaviorEngine(); e.setMode('jilly','manual');
  assert.deepEqual(e.invite('hawaii',{target:'sid'},morning),[]);
  const [invite]=e.invite('hawaii',{target:'jilly'},morning);
  assert.equal(invite.type,'invite');
  assert.equal(e.respondInvite(invite.eventId,'jilly',true,morning)[0].scene,'hawaii');
  e.enter('jilly','hawaii');
  assert.equal(e.invitationReached(invite.eventId,'jilly',morning)[0].npc,'celine');
  e.enter('celine','hutong');
  assert.deepEqual(e.invite('hawaii',{target:'amber'},morning),[]);
});
test('preference trips wait for arrival and leave manual actors alone', () => {
  const engine = new BehaviorEngine();
  for (const person of roster) if (person.id !== 'suki') engine.setMode(person.id, 'manual');
  const values = [0.99, 0.99, 0, 0.6];
  let index = 0;
  const commands = engine.schedule(morning, () => values[index++]);
  assert.equal(commands[0].actor, 'suki');
  assert.equal(commands[0].scene, 'mixian');
  assert.equal(engine.snapshot().events[commands[0].eventId].stage, 'out');
  engine.activityReached(commands[0].eventId, 'counter', morning);
  assert.equal(engine.snapshot().events[commands[0].eventId].stage, 'out');
  engine.enter('suki', 'mixian');
  engine.activityReached(commands[0].eventId, 'counter', morning);
  assert.equal(engine.snapshot().events[commands[0].eventId].stage, 'there');
  assert.deepEqual(engine.beginActivity('sid', 'gym', morning), []);
});
