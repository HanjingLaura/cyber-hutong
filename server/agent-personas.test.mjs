import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadAgentPersonas,defaultPersonaDirectory} from './agent-personas.mjs';
import {roles} from './personas.mjs';
import {createMvpServer} from './app.mjs';
import {scopedAgentProfile} from './agent-profile.mjs';

test('all eight roles have backend-only configurations; Laura uses the supplied preferences',()=>{
 const profiles=loadAgentPersonas();assert.deepEqual([...profiles.keys()].sort(),[...roles].sort());
 const laura=profiles.get('laura');assert.equal(laura.enabled,true);assert.equal(laura.confirmed,true);assert.ok(laura.voice.includes('为啥'));assert.ok(laura.facts.length>=4);
 for(const role of roles)assert.equal(profiles.get(role).enabled,true);
});

test('nickname context identifies other roles without sharing their persona or private facts',()=>{
 const profiles=loadAgentPersonas(),profile=scopedAgentProfile(profiles.get('cora'),'lobby','sid','cora');
 assert.ok(profile.aliases.includes('co教授'));assert.ok(profile.knownAliases.suki.includes('姐'));assert.ok(profile.knownAliases.franco.includes('头哥'));assert.ok(profile.knownAliases.laura.includes('小小韩'));
 assert.ok(profile.aliases.includes('小孔'));assert.ok(profile.knownAliases.laura.includes('老瑞'));assert.ok(profile.knownAliases.amber.includes('博子'));assert.ok(profile.knownAliases.jilly.includes('几粒老师'));
 assert.ok(!JSON.stringify(profile.knownAliases).includes('facts'));
});

test('ambiguous nicknames are rejected instead of silently naming the wrong person',t=>{
 const directory=mkdtempSync(join(tmpdir(),'hutong-persona-names-'));t.after(()=>{assert.ok(directory.startsWith(join(tmpdir(),'hutong-persona-names-')));rmSync(directory,{recursive:true,force:true});});cpSync(defaultPersonaDirectory,directory,{recursive:true});
 const path=join(directory,'kay.json'),input=JSON.parse(readFileSync(path,'utf8'));input.aliases=['头哥'];writeFileSync(path,JSON.stringify(input));assert.throws(()=>loadAgentPersonas(directory),/昵称重复/);
});

test('edited files change the job revision and malformed enabled profiles fail closed',t=>{
 const directory=mkdtempSync(join(tmpdir(),'hutong-personas-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));cpSync(defaultPersonaDirectory,directory,{recursive:true});
 const before=loadAgentPersonas(directory).get('laura'),path=join(directory,'laura.json'),input=JSON.parse(readFileSync(path,'utf8'));
 input.voice+=' 少用感叹号。';writeFileSync(path,JSON.stringify(input));assert.notEqual(loadAgentPersonas(directory).get('laura').revision,before.revision);
 input.facts=[];writeFileSync(path,JSON.stringify(input));assert.throws(()=>loadAgentPersonas(directory),/laura/);
});

test('ordinary accounts cannot read or modify personas and legacy saved profiles cannot override files',async t=>{
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(()=>{app.close();app.server.closeAllConnections();});
 const registered=await app.store.register('backend_only_laura','isolated-password','laura');app.store.db.prepare('UPDATE accounts SET profile=? WHERE id=?').run(JSON.stringify({agent:{enabled:false,confirmed:true,voice:'stale frontend profile'}}),registered.user.id);
 assert.ok(app.agentProfiles.get(registered.user.id).voice.includes('为啥'));assert.equal(app.agentProfiles.get(registered.user.id).enabled,true);
 const url=`http://127.0.0.1:${app.server.address().port}/api/agent-profile`,headers={cookie:'hutong_session='+registered.token,'Content-Type':'application/json'};
 for(const method of ['GET','POST']){const response=await fetch(url,{method,headers,body:method==='POST'?JSON.stringify({confirmed:true,enabled:false}):undefined});assert.equal(response.status,404);assert.ok(!JSON.stringify(await response.json()).includes('为啥'));}
 assert.equal('profile' in app.store.publicAccount(app.store.byId(registered.user.id)),false);
});

test('a queued reply from the old backend file is canceled after a persona revision changes',async t=>{
 let now=Date.now();t.mock.method(Date,'now',()=>now);let calls=0;
 const directory=mkdtempSync(join(tmpdir(),'hutong-persona-revision-'));let app;t.after(()=>{app?.close();assert.ok(directory.startsWith(join(tmpdir(),'hutong-persona-revision-')));rmSync(directory,{recursive:true,force:true});});const personas=join(directory,'personas');cpSync(defaultPersonaDirectory,personas,{recursive:true});
 const options={dbPath:join(directory,'game.sqlite'),agentPersonaDirectory:personas,llmOptions:{key:'test',fetchImpl:async()=>{calls++;return Response.json({choices:[{message:{content:'{"text":"old answer"}'}}]});}}};
 app=createMvpServer(options);for(const role of ['laura','sid'])await app.store.register('file_revision_'+role,'isolated-password',role);now+=300001;
 const message=app.store.message('sid','laura','hutong','hello','old-file',false,'dm');assert.equal(app.replies.enqueue(message)[0].status,'queued');app.close();
 const path=join(personas,'laura.json'),profile=JSON.parse(readFileSync(path,'utf8'));profile.voice+=' 更新版本。';writeFileSync(path,JSON.stringify(profile));app=createMvpServer(options);await app.replies.drain();
 assert.equal(calls,0);assert.equal(app.replies.history('sid','laura','hutong','dm').at(-1).status,'canceled');
});
