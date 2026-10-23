import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createMvpServer} from './app.mjs';
import {roles} from './personas.mjs';

const response=text=>Response.json({choices:[{message:{content:JSON.stringify({text})}}],usage:{total_tokens:10}});
const syntheticOptions=fetchImpl=>({key:'isolated-test-key',baseURL:'https://provider.invalid/v1',model:'synthetic',dailyLimit:200,dailyTokenLimit:1_000_000,fetchImpl});
async function populate(app){
 for(const [index,role] of roles.entries()){
  const {user}=await app.store.register('privacy_'+role,'isolated-audit-password',role);
  const peer=roles[(index+1)%8],other=roles[(index+2)%8];
  app.agentProfiles.save(user.id,{source:'synthetic fixture',voice:'brief '+role,
   facts:[{scope:'public',text:'public-'+role},{scope:'private',peer,text:'allowed-'+role},{scope:'private',peer:other,text:'foreign-'+role}],
   examples:[{scope:'public',context:'public',reply:'public-example-'+role},{scope:'private',peer,context:'private',reply:'allowed-example-'+role},{scope:'private',peer:other,context:'foreign',reply:'foreign-example-'+role}],confirmed:true,enabled:true});
 }
}

// Catches incorrect target selection, shared persona context and a public reply
// accidentally inheriting a private conversation or triggering another agent.
test('eight synthetic personas isolate DM facts, samples and history from public replies',async t=>{
 let now=Date.now();t.mock.method(Date,'now',()=>now);const contexts=[];
 const app=createMvpServer({agentPersonaDirectory:null,dbPath:':memory:',llmOptions:syntheticOptions(async(_url,input)=>{
  const context=JSON.parse(JSON.parse(input.body).messages[1].content);contexts.push(context);return response('reply-'+context.character.role);
 })});t.after(()=>app.close());await populate(app);now+=360001;
 for(const [index,role] of roles.entries()){
  const peer=roles[(index+1)%8],other=roles[(index+2)%8];
  app.store.message(other,role,'rest','foreign-history-'+role,'foreign-'+role,false,'dm');
  const dm=app.store.message(peer,role,'hutong','current-dm-'+role,'dm-'+role,false,'dm');
  assert.equal(app.replies.enqueue(dm)[0].status,'queued');await app.replies.drain();
  const context=contexts.at(-1);assert.equal(context.character.role,role);assert.equal(context.peer,peer);
  assert.deepEqual(context.character.confirmedFacts,['public-'+role,'allowed-'+role]);
  assert.deepEqual(context.character.examples.map(row=>row.reply),['public-example-'+role,'allowed-example-'+role]);
  assert.ok(context.conversation.some(row=>row.body==='current-dm-'+role));
  assert.ok(!JSON.stringify(context).includes('foreign-'));
  for(const otherRole of roles.filter(value=>value!==role))assert.ok(!JSON.stringify(context.character).includes('allowed-'+otherRole));
  const plain=app.store.message(peer,null,'hutong','hello '+role,'plain-'+role,false,'lobby');
  assert.deepEqual(app.replies.enqueue(plain),[]);
  const mention=app.store.message(peer,null,'hutong','@'+role,'mention-'+role,false,index%2?'scene':'lobby',[role]);
  assert.deepEqual(app.replies.enqueue(mention).map(job=>job.role),[role]);await app.replies.drain();
  const publicContext=contexts.at(-1);assert.deepEqual(publicContext.character.confirmedFacts,['public-'+role]);
  assert.deepEqual(publicContext.character.examples.map(row=>row.reply),['public-example-'+role]);
  assert.ok(!JSON.stringify(publicContext).includes('current-dm-'));assert.ok(!JSON.stringify(publicContext).includes('foreign-'));
  const own=app.store.message(role,null,'hutong','@'+role,'own-'+role,false,'lobby',[role]);assert.deepEqual(app.replies.enqueue(own),[]);
  const generated=app.store.history(peer,null,'hutong',mention.channel).find(row=>row.npc&&row.sender===role);assert.ok(generated);
  assert.deepEqual(app.replies.enqueue(generated),[]);
 }
 assert.equal(contexts.length,16);
});

// Catches non-durable generated messages or peer/scene filters that expose a
// third party's private message when a browser reloads historical messages.
test('generated DM history survives reconnect reads and a database restart without leaking other peers',async t=>{
 let now=Date.now();t.mock.method(Date,'now',()=>now);
 const directory=mkdtempSync(join(tmpdir(),'hutong-privacy-audit-')),path=join(directory,'fixture.sqlite'),apps=[];
 const create=()=>{const app=createMvpServer({agentPersonaDirectory:null,dbPath:path,llmOptions:syntheticOptions(async()=>response('durable synthetic reply'))});apps.push(app);return app;};
 t.after(()=>{for(const app of apps)app.close();rmSync(directory,{recursive:true,force:true});});
 let app=create();await populate(app);now+=360001;const expected=new Map();
 for(const [index,role] of roles.entries()){
  const peer=roles[(index+1)%8],dm=app.store.message(peer,role,index%2?'rest':'hutong','history-'+role,'history-'+role,false,'dm');
  app.replies.enqueue(dm);await app.replies.drain();expected.set(role,app.store.history(peer,role,'hutong','dm'));
 }
 for(const [index,role] of roles.entries())assert.deepEqual(app.store.history(roles[(index+1)%8],role,'rest','dm'),expected.get(role));
 app.close();app=create();
 for(const [index,role] of roles.entries()){
  const peer=roles[(index+1)%8],other=roles[(index+2)%8];
  assert.deepEqual(app.store.history(peer,role,'rest','dm'),expected.get(role));
  assert.equal(app.store.history(peer,role,'rest','dm').filter(row=>row.npc).length,1);
  assert.deepEqual(app.store.history(other,role,'rest','dm'),[]);
 }
});

// Catches a returning second tab allowing an already-generating agent reply
// through, and a stale stream disconnect overriding a newer tab generation.
test('a returning owner tab cancels an in-flight reply until every live tab expires',async t=>{
 let now=Date.now(),complete,started;t.mock.method(Date,'now',()=>now);
 const app=createMvpServer({agentPersonaDirectory:null,dbPath:':memory:',llmOptions:syntheticOptions(async()=>{
  started();return new Promise(resolve=>complete=()=>resolve(response('discarded synthetic reply')));
 })});t.after(()=>{complete?.();app.close();});await populate(app);now+=360001;
 const owner=app.store.byRole('suki'),message=app.store.message('sid','suki','hutong','pending','owner-tabs',false,'dm');
 const beginning=new Promise(resolve=>started=resolve);app.replies.enqueue(message);app.replies.pump();await beginning;
 app.presence.connect(owner.id,'a','old');app.presence.connect(owner.id,'a','new');app.presence.connect(owner.id,'b','second');
 assert.equal(app.presence.disconnect(owner.id,'a','old'),false);assert.equal(app.presence.disconnect(owner.id,'b','second'),true);
 complete();await app.replies.drain();assert.equal(app.replies.history('sid','suki','hutong','dm').at(-1).status,'canceled');
 assert.equal(app.store.history('sid','suki','hutong','dm').filter(row=>row.npc).length,0);
 now+=300000;assert.equal(app.presence.heartbeat(owner.id,'a'),true);assert.equal(app.presence.canDrive(owner.id),false);
 now+=359999;assert.equal(app.presence.canDrive(owner.id),false);now++;assert.equal(app.presence.canDrive(owner.id),true);
});
