import {mkdirSync,writeFileSync} from 'node:fs';
import {runConcurrentLoad} from './concurrency-load.mjs';

const seconds=Number(process.env.HUTONG_SOAK_SECONDS||1800);
if(!Number.isFinite(seconds)||seconds<=0)throw new Error('HUTONG_SOAK_SECONDS must be positive');
const result=await runConcurrentLoad({durationMs:seconds*1000,onSample:sample=>console.log(JSON.stringify(sample))});
mkdirSync('output',{recursive:true});
writeFileSync('output/next-mvp-soak.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
process.exitCode=result.errors.length||result.players!==8||result.streams!==32||result.controllers!==8?1:0;
