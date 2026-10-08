import test from 'node:test';
import assert from 'node:assert/strict';
const {connectionStatus} = await import('../src/multiplayer/connection-state.mjs').catch(() => ({}));
test('connection feedback distinguishes anonymous, offline, viewer and partial transport recovery', () => {
 assert.equal(typeof connectionStatus, 'function');
 const live={role:'laura',online:true,controller:true,events:true,party:true,partyEnabled:true};
 assert.equal(connectionStatus({...live,role:null}).text,'');
 assert.equal(connectionStatus(live).text,'');
 assert.equal(connectionStatus({...live,online:false}).kind,'offline');
 assert.equal(connectionStatus({...live,controller:false}).kind,'viewer');
 assert.equal(connectionStatus({...live,events:false,party:false}).kind,'reconnecting');
 assert.equal(connectionStatus({...live,events:false}).kind,'chat');
 assert.equal(connectionStatus({...live,party:false}).kind,'presence');
 assert.equal(connectionStatus({...live,party:false,partyEnabled:false}).text,'');
});
