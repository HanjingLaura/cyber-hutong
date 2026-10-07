import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMvpServer } from './app.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
// Vercel runs several instances of the same server over one (replicated) SQLite DB.
async function pair(t){
 const dir=mkdtempSync(join(tmpdir(),'hutong-inst-')),dbPath=join(dir,'db.sqlite');
 const make=async()=>{const app=createMvpServer({dbPath});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');return {app,root:'http://127.0.0.1:'+app.server.address().port};};
 const A=await make(),B=await make();
 t.after(()=>{for(const x of [A,B]){x.app.close();x.app.server.closeAllConnections();}rmSync(dir,{recursive:true,force:true});});
 const api=async(I,path,input,cookie)=>{const res=await fetch(I.root+'/api/'+path,{method:'POST',headers:{...(cookie?{Cookie:cookie}:{}),'Content-Type':'application/json'},body:JSON.stringify(input)});return {status:res.status,cookie:res.headers.get('set-cookie')?.split(';')[0],data:await res.json().catch(()=>null)};};
 const stream=async(I,cookie,client)=>{const abort=new AbortController();const res=await fetch(I.root+'/api/events?client='+client,{headers:{Cookie:cookie},signal:abort.signal});assert.equal(res.status,200);t.after(()=>abort.abort());return abort;};
 return {A,B,api,stream};
}
test('actions on a different instance than the SSE stream work and do not snap the pose',async t=>{
 const {A,B,api,stream}=await pair(t);const reg=await api(A,'register',{username:'laura_i',password:'instance-pass-2026',role:'laura'});
 await stream(A,reg.cookie,'tab');await wait(100);
 // Live pose on A moves away from what B would load from the DB.
 const r=await api(B,'presence',{client:'tab',scene:'hutong',x:150,y:194,facing:1,moving:false,seat:null,hand:null,activity:'walk'},reg.cookie);
 assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.player.x,150);
 const water=await api(B,'object',{client:'tab',object:'gym:water',action:'supply',item:'水',requestId:'x1'},reg.cookie);
 assert.notEqual(water.status,500);assert.notEqual(water.status,409);
});
test('a stream closing on another instance does not revoke the live tab\'s control',async t=>{
 const {A,B,api,stream}=await pair(t);const reg=await api(A,'register',{username:'laura_j',password:'instance-pass-2026',role:'laura'});
 await stream(A,reg.cookie,'live');await wait(100);
 const old=await stream(B,reg.cookie,'old');await wait(100);old.abort();await wait(200);
 assert.equal(A.app.store.db.prepare('SELECT client FROM controllers WHERE account=?').get(reg.data.user.id)?.client,'live');
});
test('autonomy on another instance never drives a user live elsewhere',async t=>{
 const {A,B,api,stream}=await pair(t);const reg=await api(A,'register',{username:'laura_k',password:'instance-pass-2026',role:'laura'});
 await stream(A,reg.cookie,'live');await wait(100);
 B.app.autonomy.tick(Date.now()+60000);B.app.autonomy.tick(Date.now()+60100);
 assert.equal(B.app.autonomy.doubles.has(reg.data.user.id),false);
});
test('client guards: no snapping to remote/offline self, gym stop keeps position when walking',()=>{
 const src=f=>readFileSync(new URL('../src/'+f,import.meta.url),'utf8');
 assert.match(src('multiplayer/bridge.ts'),/!this\.transitioning&&\(!this\.controller\|\|this\.pendingSpawn\)/);
 assert.match(src('multiplayer/party-client.ts'),/p\.role === selfRole \? !offline : offline/);
 assert.match(src('gym.ts'),/if\(wasWalking\)\{this\.liftStart=null;return;\}/);
 assert.doesNotMatch(src('multiplayer/social.ts'),/err\.status===409\)\{bridge\.stand\(\);const self/);
 assert.match(src('multiplayer/world-client.ts'),/await this\.ensureLive\(\)/);
});
