import {liveBudget} from './fixtures/live-budget.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {loadLocalEnvironment} from '../server/local-env.mjs';
import {createMvpServer} from '../server/app.mjs';
import {scopedAgentProfile} from '../server/agent-profile.mjs';

loadLocalEnvironment();const directory='output/persona-context-'+Date.now();await mkdir(directory,{recursive:true});
const app=createMvpServer({dbPath:':memory:',llmOptions:{...liveBudget(2)}}),checks={};
try{
 assert.equal(app.llm.configured,true,'existing real key required');
 for(const role of ['laura','sid','cora'])await app.store.register('persona_context_'+role,'isolated-persona-password',role);
 const profile=role=>scopedAgentProfile(app.agentProfiles.get(app.store.byRole(role).id),'lobby','sid',role);
 const aliases=await app.llm.reply('laura','头哥、哥、姐、几粒老师、博子、小孔、老瑞分别是谁？只说对应的角色英文名。','sid','hutong',{strict:true,channel:'lobby',profile:profile('laura')});
 assert.ok(aliases,'real nickname reply required');for(const role of ['franco','sid','suki','jilly','amber','cora','laura'])assert.ok(aliases.toLowerCase().includes(role),'missing nickname target '+role);checks.realModelUnderstandsNicknames=true;
 const car=await app.llm.reply('cora','之前你说想放进游戏的小车是什么品牌、几号？只说已提供的信息。','sid','hutong',{strict:true,channel:'lobby',profile:profile('cora')});
 assert.ok(car,'real screenshot-context reply required');assert.ok(/奔驰|梅赛德斯|mercedes/i.test(car));assert.ok(car.includes('63'));checks.realModelUsesAttributedScreenshot=true;
 const report={passed:true,realModel:true,scope:'isolated context validation; no real accounts or enable switches changed',provider:app.llm.status(),checks,calls:app.store.db.prepare('SELECT SUM(calls) n FROM llm_usage').get().n};await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({directory,...report}));
}catch(error){const report={passed:false,provider:app.llm.status(),checks,error:error.message};await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.error(JSON.stringify({directory,...report}));process.exitCode=1;}
finally{app.close();}
