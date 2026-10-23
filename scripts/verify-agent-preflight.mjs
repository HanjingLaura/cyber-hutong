import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';

const directory='output/agent-preflight-'+Date.now();await mkdir(directory,{recursive:true});
const report={passed:false,scope:'isolated accounts only; real provider',limits:{calls:24,tokens:20000},day:new Date(Date.now()+28800000).toISOString().slice(0,10),calls:0,tokens:0,runs:[]};
const scripts=['verify-eight-live-agents.mjs','verify-live-agent-lifecycle.mjs','verify-live-agent-browser.mjs','verify-agent-persona-context.mjs','verify-agent-history.mjs','verify-agent-timeout.mjs'];
try{
 for(const script of scripts){
  assert.ok(report.calls<24&&report.tokens<20000,'aggregate budget exhausted');
  console.log(JSON.stringify({stage:'start',script,remainingCalls:24-report.calls,remainingTokens:20000-report.tokens}));
  const result=await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,['--import','./scripts/fixtures/live-provider-guard.mjs','scripts/'+script],{windowsHide:true,env:{...process.env,HUTONG_LIVE_BUDGET_DAY:report.day,HUTONG_EIGHT_RESULT_DIRECTORY:report.runs[0]?.directory??'',HUTONG_LIVE_CALL_LIMIT:String(24-report.calls),HUTONG_LIVE_TOKEN_LIMIT:String(20000-report.tokens)}});
   let buffer='',last;
   child.stdout.on('data',chunk=>{buffer+=chunk;let n;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n);buffer=buffer.slice(n+1);try{const row=JSON.parse(line);if(row.directory&&typeof row.passed==='boolean')last=row;else if(row.stage)console.log(JSON.stringify({script,...row}));}catch{}}});
   child.stderr.on('data',chunk=>{for(const line of String(chunk).split('\n'))try{const row=JSON.parse(line);if(row.directory&&row.provider)last=row;}catch{}});
   child.once('error',reject);child.once('exit',code=>resolve({code,last}));
  });
  if(!result.last?.provider?.budget)throw Error(script+': missing budget evidence; stopped without retry');
  const usage=result.last.provider.budget;
  report.calls+=usage.calls;report.tokens+=usage.chargedTokens;
  report.runs.push({script,directory:result.last.directory,passed:result.last.passed,calls:usage.calls,tokens:usage.chargedTokens});
  await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));
  assert.ok(report.calls<=24&&report.tokens<=20000,'aggregate allowance exceeded');
  assert.equal(result.code,0,script+': failed; suite stopped');assert.equal(result.last.passed,true);
 }
 report.passed=true;
}catch(error){report.error=error.message;process.exitCode=1;}
await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({directory,...report}));
