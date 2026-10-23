import test from 'node:test';
import assert from 'node:assert/strict';
import {createMvpServer} from './app.mjs';
import {openStore} from './store.mjs';

test('local arrival cursor ignores rolled-back messages and survives lower sequence imports',()=>{
 const store=openStore(':memory:');try{
  store.db.exec('BEGIN');store.message('sid',null,'hutong','rolled-back','rollback');assert.equal(store.messageArrival(),1);store.db.exec('ROLLBACK');assert.equal(store.messageArrival(),0);
  store.db.prepare('INSERT INTO messages(seq,id,sender,scene,body,at) VALUES(?,?,?,?,?,?)').run(2000000,'first','sid','hutong','first',20);
  store.db.prepare('INSERT INTO messages(seq,id,sender,scene,body,at) VALUES(?,?,?,?,?,?)').run(1000001,'second','sid','hutong','second',21);
  assert.deepEqual(store.messagesArrivingAfter(1).map(row=>[row.arrival,row.message.body]),[[2,'second']]);
  assert.equal(store.db.prepare("SELECT COUNT(*) n FROM main.sqlite_master WHERE name='message_arrivals'").get().n,0);
 }finally{store.close();}
});

test('SSE relays imported lower-sequence replies once and preserves private visibility',async t=>{
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 t.after(()=>{app.close();app.server.closeAllConnections();});const root=`http://127.0.0.1:${app.server.address().port}/api/`;
 const buffers=[];
 for(const role of ['sid','jilly']){
  const registered=await fetch(root+'register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'relay_'+role,password:'relay-test-password',role})});
  const cookie=registered.headers.get('set-cookie').split(';')[0];await registered.json();
  const abort=new AbortController();t.after(()=>abort.abort());const response=await fetch(root+'events?client='+role,{headers:{Cookie:cookie},signal:abort.signal});
  const reader=response.body.getReader(),buffer={text:''};buffers.push(buffer);
  void(async()=>{try{for(;;){const {done,value}=await reader.read();if(done)break;buffer.text+=new TextDecoder().decode(value);}}catch{}})();
 }
 const insert=app.store.db.prepare('INSERT INTO messages(seq,id,sender,recipient,scene,body,at,npc,channel) VALUES(?,?,?,?,?,?,?,?,?)');
 insert.run(2000000,'new-instance','laura',null,'hutong','newer-instance-message',Date.now(),1,'lobby');
 await new Promise(r=>setTimeout(r,650));
 // An older instance allocates a lower seq range, even for a later committed reply.
 insert.run(1000001,'old-instance','laura','sid','hutong','later-private-reply',Date.now(),1,'dm');
 insert.run(1000002,'old-public','laura',null,'hutong','later-public-reply',Date.now()+1,1,'lobby');
 await new Promise(r=>setTimeout(r,1200));
 assert.equal(buffers[0].text.split('later-private-reply').length-1,1);
 assert.equal(buffers[1].text.includes('later-private-reply'),false);
 for(const buffer of buffers)assert.equal(buffer.text.split('later-public-reply').length-1,1);
 assert.deepEqual(app.store.history('sid',null,'hutong','lobby').map(m=>m.body),['newer-instance-message','later-public-reply']);
});
