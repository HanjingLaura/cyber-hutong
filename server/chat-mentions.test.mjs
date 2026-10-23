import test from 'node:test';
import assert from 'node:assert/strict';
import {explicitMentions} from '../shared/chat-mentions.mjs';
import {createMvpServer} from './app.mjs';
const roles=['sid','laura','amber','kay'];
test('typed public mentions accept case, Chinese adjacency and deduplicate, excluding self',()=>{
 assert.deepEqual(explicitMentions('你好@Laura，@laura @SID @Kay！',roles,'sid'),['laura','kay']);
 assert.deepEqual(explicitMentions('＠Amber 你好',roles,'sid'),['amber']);
});
test('ordinary names, emails, unknown names and longer handles are not mentions',()=>{
 for(const text of ['Laura hello','mail@laura.com','@Laurax','@Laura123','@Laura_name','https://site/@laura'])assert.deepEqual(explicitMentions(text,roles,'sid'),[]);
});
test('public chat recognizes a typed explicit mention without using the picker',async t=>{
 const app=createMvpServer({agentPersonaDirectory:null,dbPath:':memory:',llmOptions:{key:''}});t.after(()=>{app.close();app.server.closeAllConnections();});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const sid=await app.store.register('mention_sid','isolated-password','sid');await app.store.register('mention_laura','isolated-password','laura');
 const response=await fetch(`http://127.0.0.1:${app.server.address().port}/api/chat/`,{method:'POST',headers:{cookie:'hutong_session='+sid.token,'Content-Type':'application/json'},body:JSON.stringify({channel:'lobby',text:'@Laura 你好',requestId:'typed-mention'})});assert.equal(response.status,200);const data=await response.json();assert.deepEqual(data.message.mentions,['laura']);assert.equal(data.agents[0].role,'laura');assert.equal(app.llm.status().budget.calls,0);
});
