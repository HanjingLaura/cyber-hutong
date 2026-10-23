import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from './store.mjs';
import {createAgentProfiles} from './agent-profile.mjs';
import {createAgentReplies} from './agent-replies.mjs';

async function fixture(t,{reply=async()=> 'fixture reply',mutate=operation=>operation()}={}){
 const store=openStore(':memory:');
 for(const role of ['sid','jilly'])await store.register('ownership_'+role,'isolated-password',role);
 const owner=store.byRole('jilly'),profiles=createAgentProfiles(store,{directory:null});
 profiles.save(owner.id,{source:'fixture',voice:'brief',facts:[{scope:'public',text:'fixture'}],confirmed:true,enabled:true});
 const state={live:false,calls:0},statuses=[],messages=[];
 const replies=createAgentReplies(store,{profiles,llm:{reply:async(...args)=>{state.calls++;return reply(...args);},status:()=>({status:'ready'})},humanLive:()=>state.live,canDrive:()=>!state.live,mutate:operation=>mutate(operation,state),publish:message=>messages.push(message),publishStatus:status=>statuses.push(status)});
 t.after(()=>{replies.close();store.close();});
 const message=store.message('sid','jilly','hutong','fixture question','ownership-source',false,'dm');
 replies.enqueue(message);return{replies,state,owner,messages,statuses,store};
}

test('owner cancellation permanently removes a queued reply before the owner goes offline again',async t=>{
 const f=await fixture(t);
 f.state.live=true;f.replies.cancel?.(f.owner.id);f.state.live=false;
 await f.replies.drain();
 assert.equal(f.state.calls,0);assert.equal(f.messages.length,0);
 assert.equal(f.replies.history('sid','jilly','hutong','dm')[0].status,'canceled');
});

test('owner cancellation aborts generation and a late result cannot send after another offline interval',async t=>{
 let finish,started,signal;const beginning=new Promise(resolve=>started=resolve);
 const f=await fixture(t,{reply:async(_role,_text,_peer,_scene,options)=>{signal=options.signal;started();return new Promise(resolve=>finish=resolve);}});
 f.replies.pump();await beginning;
 f.state.live=true;f.replies.cancel?.(f.owner.id);f.state.live=false;
 finish('late fixture reply');await f.replies.drain();
 assert.equal(f.messages.length,0);assert.equal(signal?.aborted,true);
 assert.equal(f.replies.history('sid','jilly','hutong','dm')[0].status,'canceled');
});

test('owner returning during the reservation await prevents a provider call',async t=>{
 const f=await fixture(t,{mutate:(operation,state)=>{const result=operation();state.live=true;return Promise.resolve(result);}});
 await f.replies.drain();
 assert.equal(f.state.calls,0);assert.equal(f.messages.length,0);
 assert.equal(f.replies.history('sid','jilly','hutong','dm')[0].status,'canceled');
});

test('reconnecting to a private conversation retains its latest twenty statuses after unrelated traffic',async t=>{
 const f=await fixture(t);f.store.db.exec('DELETE FROM agent_reply_jobs');
 const insert=f.store.db.prepare("INSERT INTO agent_reply_jobs(id,source,requester,account,channel,scene,profile_revision,status,at) VALUES(?,?,?,?,?,?,1,'sent',?)");
 for(let n=0;n<25;n++)insert.run('private-'+n,'private-source-'+n,'sid',f.owner.id,'dm','hutong',n+1);
 for(let n=0;n<205;n++)insert.run('other-'+n,'other-source-'+n,'sid',f.owner.id,'scene','rest',n+26);
 const jobs=f.replies.history('sid','jilly','hutong','dm');
 assert.equal(jobs.length,20);assert.equal(jobs[0].id,'private-5');assert.equal(jobs.at(-1).id,'private-24');
 assert.ok(jobs.every(job=>job.channel==='dm'&&job.role==='jilly'&&job.recipient==='sid'));
});
