import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from './store.mjs';
import {createAgentProfiles,scopedAgentProfile} from './agent-profile.mjs';

test('Laura opens supplied preferences as an unconfirmed candidate without overwriting saved owner data',async t=>{
 const store=openStore(':memory:');t.after(()=>store.close());const laura=(await store.register('laura_preferences','test-password-123','laura')).user;
 const profiles=createAgentProfiles(store,{directory:null}),candidate=profiles.get(laura.id);
 assert.equal(candidate.revision,0);assert.equal(candidate.confirmed,false);assert.equal(candidate.enabled,false);
 assert.ok(candidate.voice.includes('啊哈哈哈哈哈哈'));assert.ok(candidate.voice.includes('为啥'));assert.ok(candidate.voice.includes('我绷不住了'));
 for(const fact of ['喜欢参加黑客松。','喜欢吹萨克斯和长号。','喜欢滑滑板。','喜欢吃好吃的。'])assert.ok(candidate.facts.some(item=>item.text===fact));
 assert.equal(candidate.examples.length,0);assert.equal(store.db.prepare('SELECT COUNT(*) n FROM agent_profile_versions').get().n,0);
 const saved=profiles.save(laura.id,{...candidate,voice:'owner edited voice',confirmed:true,enabled:true});
 assert.equal(profiles.get(laura.id).voice,'owner edited voice');assert.equal(saved.revision,1);
});

test('each owner edits their profile, explicit confirmation gates replies, and revisions preserve imports',async t=>{
 const store=openStore(':memory:');t.after(()=>store.close());const laura=(await store.register('profile_laura','test-password-123','laura')).user,sid=(await store.register('profile_sid','test-password-123','sid')).user;
 const profiles=createAgentProfiles(store,{directory:null}),input={source:'supplied notes',voice:'short sentences',facts:[{scope:'public',text:'public fact'},{scope:'private',peer:'sid',text:'private sid fact'},{scope:'private',peer:'jilly',text:'private jilly fact'}],examples:[],confirmed:true,enabled:true};
 assert.equal(profiles.get(sid.id).enabled,false);assert.throws(()=>profiles.save(laura.id,{...input,confirmed:false}),/确认/);
 const profile=profiles.save(laura.id,input);assert.equal(profile.enabled,true);assert.equal(profile.revision,1);
 assert.deepEqual(scopedAgentProfile(profile,'lobby','sid').confirmedFacts,['public fact']);
 assert.deepEqual(scopedAgentProfile(profile,'dm','sid').confirmedFacts,['public fact','private sid fact']);
 assert.throws(()=>profiles.save(laura.id,input),/已更新/);
 profiles.save(laura.id,{...input,revision:1,enabled:false});assert.equal(store.db.prepare('SELECT COUNT(*) n FROM agent_profile_versions').get().n,2);
 assert.equal('profile' in store.publicAccount(store.byId(laura.id)),false);
});
