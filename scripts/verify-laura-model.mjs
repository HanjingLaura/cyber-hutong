import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {loadLocalEnvironment} from '../server/local-env.mjs';
import {createMvpServer} from '../server/app.mjs';

// Two bounded real-provider calls, synthetic accounts/data, disposable database.
// This verifies transport and persistence, never real Laura's facts or voice.
loadLocalEnvironment();
if(!(process.env.DASHSCOPE_API_KEY||process.env.BAILIAN_API_KEY))throw Error('Bailian key is not configured');
const app=createMvpServer({agentPersonaDirectory:null,dbPath:':memory:',llmOptions:{dailyLimit:2}}),samples=[];
try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const laura=await app.store.register('synthetic_model_laura','synthetic-model-password','laura'),sid=await app.store.register('synthetic_model_sid','synthetic-model-password','sid');
 app.agentProfiles.save(laura.user.id,{source:'Synthetic connectivity fixture; not real Laura materials',sourceVersion:'2026-10-12',voice:'简短回答。明确这只是合成测试，不虚构真人经历。',facts:[{text:'这是本地合成测试角色，不代表真实 Laura。',scope:'public'},{text:'仅与 Sid 私聊的合成标记 PRIVATE_SCOPE_42。',scope:'private',peer:'sid'}],examples:[],rules:['不声称完成未发生的游戏动作。'],confirmed:true,enabled:true});
 // Model a browser that really closed more than five minutes ago.
 app.store.db.prepare('INSERT INTO browser_presence VALUES(?,?,?,?,?)').run(laura.user.id,'synthetic-offline','fixture',Date.now()-360001,Date.now()-300001);
 const root=`http://127.0.0.1:${app.server.address().port}/api/`,cookie='hutong_session='+sid.token;
 for(const channel of ['dm','lobby']){
  const response=await fetch(root+'chat',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({channel,peer:channel==='dm'?'laura':null,mentions:channel==='lobby'?['laura']:[],text:'这是合成连通测试，请简单回复一句，不执行游戏动作。',requestId:'real-smoke-'+channel})});assert.equal(response.status,200);
  await app.replies.drain();const rows=app.store.history('sid',channel==='dm'?'laura':null,'hutong',channel),reply=rows.find(row=>row.npc&&row.sender==='laura');
  assert.ok(reply,channel+' requires a saved real-model reply');assert.equal(reply.channel,channel);if(channel==='lobby')assert.ok(!reply.body.includes('PRIVATE_SCOPE_42'));
  samples.push({channel,stored:true,reply:reply.body});
 }
 const report={date:'2026-10-12',scope:'synthetic technical acceptance only; real Laura facts/voice pending',provider:app.llm.status(),calls:app.store.db.prepare('SELECT SUM(calls) calls FROM llm_usage').get().calls,samples};
 await mkdir('output',{recursive:true});await writeFile('output/laura-model-smoke.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({verified:report.samples.map(sample=>sample.channel),calls:report.calls,status:report.provider.status}));
}finally{app.close();}
