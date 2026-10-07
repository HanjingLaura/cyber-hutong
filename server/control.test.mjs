import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createMvpServer } from './app.mjs';
const password='control-test-password-2026';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function setup(t){const app=createMvpServer({dbPath:':memory:'});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const root='http://127.0.0.1:'+app.server.address().port;t.after(()=>{app.close();app.server.closeAllConnections();});
 const api=async(path,input,cookie)=>{const res=await fetch(root+'/api/'+path,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(input)});return {status:res.status,cookie:res.headers.get('set-cookie')?.split(';')[0],data:await res.json().catch(()=>null)};};
 const stream=async(cookie,client)=>{const abort=new AbortController(),res=await fetch(root+'/api/events?client='+client,{headers:{Cookie:cookie},signal:abort.signal});assert.equal(res.status,200);t.after(()=>abort.abort());const reader=res.body.getReader(),dec=new TextDecoder();let buf='';(async()=>{try{for(;;){const {value,done}=await reader.read();if(done)break;buf+=dec.decode(value);}}catch{}})();abort.lastController=()=>{const m=[...buf.matchAll(/"controller":(true|false)/g)];return m.length?m.at(-1)[1]==='true':null;};return abort;};
 return {app,api,stream};}

test('closing the controlling tab hands control to the user\'s other open tab',async t=>{
 const {app,api,stream}=await setup(t);const reg=await api('register',{username:'laura',password,role:'laura'});
 const a=await stream(reg.cookie,'tab-a');const b=await stream(reg.cookie,'tab-b');await wait(200);
 assert.equal(b.lastController(),false);
 const probe=()=>api('inventory',{client:'tab-b',action:'noop',revision:-1},reg.cookie);
 assert.equal((await probe()).status,409,'tab-b starts as viewer');
 a.abort();await wait(400);
assert.equal(b.lastController(),true,'remaining tab is told it controls the character');
 assert.notEqual((await probe()).status,409,'tab-b must not be treated as "other window"');
 assert.equal(app.players.has(reg.data.user.id),true);
 assert.equal(app.autonomy.doubles.has(reg.data.user.id),false);
});

test('autonomy never drives an online user, even before the 5s roster refresh',async t=>{
 const {app,api,stream}=await setup(t);const reg=await api('register',{username:'laura2',password,role:'laura'}),id=reg.data.user.id;
 app.players.delete(id);app.autonomy.tick(Date.now()+10000);assert.equal(app.autonomy.doubles.has(id),true,'offline user is driven');
 app.players.set(id,{id,role:'laura',scene:'hutong',x:300,y:200,facing:0,moving:false,seat:null,activity:'walk',at:Date.now()});
 app.autonomy.tick(Date.now()+10100);
 assert.equal(app.autonomy.doubles.has(id),false);assert.equal(app.autonomy.isDriven(id),false);
 void stream;
});

test('retired black-outfit Laura sheets are not referenced by the character registry',()=>{
 const reg=JSON.parse(readFileSync(new URL('../assets/metadata/team-v3.json',import.meta.url)));
 const approved=new Set(Object.entries(reg.sources).filter(([,s])=>s.file.startsWith('laura/approved/')).map(([id])=>id));
 for(const [role,m] of Object.entries(reg.members))for(const f of [...m.frames,...m.carryFrames,...m.officeFrames])assert.equal(approved.has(f.source),false,role+' uses retired sheet '+f.source);
 const src=readFileSync(new URL('../src/character-assets.ts',import.meta.url),'utf8');
 assert.match(src,/delete \(characterRegistry[^;]*blackLaura/);assert.doesNotMatch(src,/laura\/approved\/\*\.png/);
 const avatar=readFileSync(new URL('../src/multiplayer/avatar.ts',import.meta.url),'utf8');assert.doesNotMatch(avatar,/blackLaura/);
 const social=readFileSync(new URL('../src/multiplayer/social.ts',import.meta.url),'utf8');assert.doesNotMatch(social,/PartyKit…|在另一个窗口操作'\)/);
});

test('legacy built-in player actor and its sheets are removed',async()=>{
 const {existsSync,readdirSync}=await import('node:fs');
 assert.equal(existsSync(new URL('../src/shop-actor.ts',import.meta.url)),false);
 assert.equal(existsSync(new URL('../assets/characters/laura/approved',import.meta.url)),false);
 assert.deepEqual(readdirSync(new URL('../assets/drafts',import.meta.url)).filter(f=>f.startsWith('owner-')),[]);
 for(const f of readdirSync(new URL('../src',import.meta.url)).filter(f=>f.endsWith('.ts')))assert.doesNotMatch(readFileSync(new URL('../src/'+f,import.meta.url),'utf8'),/owner-[a-z-]+v\d\.png|ShopActor/,f);
});
