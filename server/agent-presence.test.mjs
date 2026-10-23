import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createMvpServer} from './app.mjs';

async function fixture(t){
 let now=Date.now();t.mock.method(Date,'now',()=>now);
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 t.after(()=>{app.close();app.server.closeAllConnections();});
 const root='http://127.0.0.1:'+app.server.address().port;
 const register=await fetch(root+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'agent_probe',password:'test-password-123',role:'franco'})});
 const cookie=register.headers.get('set-cookie').split(';')[0],{user}=await register.json();
 const api=async(path,input)=>{const r=await fetch(root+'/api/'+path,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(input)});return{status:r.status,data:await r.json()};};
 const stream=async(client)=>{const abort=new AbortController();const r=await fetch(root+'/api/events?client='+client,{headers:{Cookie:cookie},signal:abort.signal});assert.equal(r.status,200);const reader=r.body.getReader();await reader.read();t.after(()=>abort.abort());return abort;};
 return{app,user,api,stream,advance(ms){now+=ms;app.autonomy.tick();},get now(){return now;}};
}

test('last browser heartbeat expires before the five minute takeover delay; returning human interrupts the agent',async t=>{
 const f=await fixture(t),tab=await f.stream('first');
 tab.abort();await new Promise(r=>setTimeout(r,60));
 f.advance(60000);assert.equal(f.app.autonomy.isDriven(f.user.id),false);
 f.advance(299999);assert.equal(f.app.autonomy.isDriven(f.user.id),false,'not one millisecond early');
 f.advance(1);assert.equal(f.app.autonomy.isDriven(f.user.id),true,'eligible five minutes after browser heartbeat expiry');
 const returned=await f.stream('return');
 assert.equal(f.app.autonomy.isDriven(f.user.id),false);assert.equal(f.app.autonomy.doubles.has(f.user.id),false);
 assert.equal(f.app.players.get(f.user.id).disconnectedAt,undefined);
 returned.abort();
});

test('another live browser tab prevents takeover and maintains its own heartbeat',async t=>{
 const f=await fixture(t),a=await f.stream('a'),b=await f.stream('b');a.abort();await new Promise(r=>setTimeout(r,60));
 for(let n=0;n<24;n++){assert.equal((await f.api('heartbeat',{client:'b'})).status,200);f.advance(15000);}
 assert.equal(f.app.autonomy.isDriven(f.user.id),false);
 b.abort();
});

test('a dead browser with a lingering server stream expires by browser heartbeat',async t=>{
 const f=await fixture(t);await f.stream('stale');
 f.advance(60000+299999);assert.equal(f.app.autonomy.isDriven(f.user.id),false);
 f.advance(1);assert.equal(f.app.autonomy.isDriven(f.user.id),true,'server writes cannot keep an absent browser online');
});

test('closing an old stream cannot close a reconnected generation of the same tab',async t=>{
 const f=await fixture(t),a=await f.stream('same'),b=await f.stream('same');a.abort();await new Promise(r=>setTimeout(r,60));
 assert.equal((await f.api('heartbeat',{client:'same'})).status,200);
 assert.equal(f.app.autonomy.isDriven(f.user.id),false);b.abort();
});
