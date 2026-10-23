import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../api/index.mjs',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const body=source.slice(source.indexOf('  beforeRequest: async req=>{')+'  beforeRequest: async req=>{'.length,source.indexOf('  },\n  commitRequest:'));
test('ordinary motion avoids an extra authoritative positions scan, while explicit travel still synchronizes it',async()=>{
 const calls=[],replica={async pull(options){calls.push(['pull',options]);},async syncAuthoritativeTables(tables){calls.push(['sync',tables]);},hasPending(){return false;}};
 const before=new Function('replica','stripBase',`return async req=>{${body}};`)(replica,url=>url.replace('/cyber-hutong','').replace(/\/$/,''));
 await before({method:'POST',url:'/api/presence',hutongBody:Buffer.from(JSON.stringify({scene:'hutong',checkpoint:false}))});
 assert.equal(calls.filter(call=>call[0]==='sync').length,0);
 await before({method:'POST',url:'/api/presence',hutongBody:Buffer.from(JSON.stringify({checkpoint:true}))});
 await before({method:'POST',url:'/api/transition'});
 assert.equal(calls.filter(call=>call[0]==='sync').length,2);
 assert.ok(calls.every(call=>call[0]!=='pull'||call[1].maxAgeMs===0));
});
