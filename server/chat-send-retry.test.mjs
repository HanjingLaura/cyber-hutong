import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {createMvpServer} from './app.mjs';

const transpile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const stateExports={};runInNewContext(transpile(readFileSync(new URL('../src/multiplayer/chat-state.ts',import.meta.url),'utf8')),{exports:stateExports});
// Execute the actual form handler with the real durable message idempotency
// boundary. Only transport and DOM are substitutes; no model is called.
async function fixture(t){
 let now=Date.now();t.mock.method(Date,'now',()=>now);
 const app=createMvpServer({agentPersonaDirectory:null,dbPath:':memory:',llmOptions:{key:'synthetic-test-key',baseURL:'https://provider.invalid/v1',model:'synthetic',dailyLimit:100,dailyTokenLimit:1000000,fetchImpl:async()=>Response.json({choices:[{message:{content:'{"text":"synthetic reply"}'}}],usage:{total_tokens:10}})}});
 const store=app.store;t.after(()=>app.close());await store.register('retry_suki','isolated-test-password','suki');await store.register('retry_sid','isolated-test-password','sid');
 app.agentProfiles.save(store.byRole('sid').id,{source:'fixture',voice:'brief',facts:[{scope:'public',text:'synthetic'}],confirmed:true,enabled:true});now+=360001;
 const state=new stateExports.ChatState('suki');state.select('dm','hutong','sid');state.current.draft='question';
 const input={value:'question'},button={},form={querySelector:()=>button};let next=0,loseResponse=true;
 const source=readFileSync(new URL('../src/multiplayer/social.ts',import.meta.url),'utf8').split('\n').find(line=>line.includes("$('chat-form').onsubmit="));
 const context={exports:{},$:(id)=>id==='chat-form'?form:input,user:{role:'suki'},sending:false,chat:()=>state,peer:'sid',channel:'dm',roles:['suki','sid'],crypto:{randomUUID:()=>String(++next)},receive:message=>state.receive(message,true),renderAgentStatus(){},notice(){},showAccount(){},explicitMentions:()=>[],api:async(_path,payload)=>{
  const message=store.message('suki',payload.peer,'hutong',payload.text,payload.requestId,false,payload.channel,payload.mentions);
  app.replies.enqueue(message);await app.replies.drain();
  if(loseResponse){loseResponse=false;throw Error('response lost after commit');}return {message};
 }};
 runInNewContext(transpile(source),context);
 return{store,state,input,submit:()=>form.onsubmit({preventDefault(){}}),select(channel,peer){state.select(channel,'hutong',peer);context.channel=channel;context.peer=peer;input.value=state.current.draft;}};
}

test('retrying an unchanged draft after a committed response is lost sends one durable message',async t=>{
 const f=await fixture(t);await f.submit();assert.equal(f.state.current.draft,'question');await f.submit();
 const history=f.store.history('suki','sid','hutong','dm');assert.equal(history.filter(message=>!message.npc).length,1);assert.equal(history.filter(message=>message.npc).length,1);
 assert.equal(f.input.value,'');assert.equal(f.state.current.draft,'');
 // Deliberately sending the same words again after success is a new message.
 f.input.value='question';f.state.current.draft='question';await f.submit();assert.equal(f.store.history('suki','sid','hutong','dm').filter(message=>!message.npc).length,2);
});

test('editing an uncertain draft starts a new send identity',async t=>{
 const f=await fixture(t);await f.submit();f.input.value='edited question';f.state.current.draft='edited question';await f.submit();
 assert.deepEqual(f.store.history('suki','sid','hutong','dm').filter(message=>!message.npc).map(message=>message.body),['question','edited question']);
});

test('an uncertain send retains its own identity while another channel sends the same text',async t=>{
 const f=await fixture(t);await f.submit();f.select('lobby',null);f.input.value='question';f.state.current.draft='question';await f.submit();
 f.select('dm','sid');assert.equal(f.input.value,'question');await f.submit();
 assert.equal(f.store.history('suki','sid','hutong','dm').filter(message=>!message.npc).length,1);
 assert.equal(f.store.history('suki',null,'hutong','lobby').length,1);
 const otherAccount=new stateExports.ChatState('sid');assert.equal(otherAccount.current.pendingSend,undefined);
});
