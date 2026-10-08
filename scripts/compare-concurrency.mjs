import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync,unlinkSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {runConcurrentLoad} from './concurrency-load.mjs';

const seconds=Number(process.env.HUTONG_BENCHMARK_SECONDS||8),ref=process.env.HUTONG_BENCHMARK_REF||'3bfb6c3';
if(!Number.isFinite(seconds)||seconds<=0)throw new Error('HUTONG_BENCHMARK_SECONDS must be positive');
const workspace=fileURLToPath(new URL('../',import.meta.url));
const baselinePath=fileURLToPath(new URL(`../server/.concurrency-baseline-${randomUUID()}.mjs`,import.meta.url));
const baselineCommit=execFileSync('git',['rev-parse',ref],{cwd:workspace,encoding:'utf8'}).trim();
const source=execFileSync('git',['show',`${baselineCommit}:server/app.mjs`],{cwd:workspace,encoding:'utf8'});
writeFileSync(baselinePath,source);
try{
  const {createMvpServer}=await import(pathToFileURL(baselinePath).href);
  const baseline=await runConcurrentLoad({durationMs:seconds*1000,createServer:createMvpServer});
  const current=await runConcurrentLoad({durationMs:seconds*1000});
  const result={baselineCommit,scope:'server/app.mjs snapshot implementation; shared helpers and dependencies are identical',baseline,current};
  const output=new URL('../output/concurrency-comparison.json',import.meta.url);
  mkdirSync(new URL('../output/',import.meta.url),{recursive:true});
  writeFileSync(output,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
  process.exitCode=baseline.errors.length||current.errors.length?1:0;
}finally{unlinkSync(baselinePath);}
