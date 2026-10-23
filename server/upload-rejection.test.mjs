import test from 'node:test';
import assert from 'node:assert/strict';
import {createMvpServer} from './app.mjs';
test('oversized uploads return a readable 413 repeatedly without resetting the connection or blocking health',async t=>{
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(()=>{app.close();app.server.closeAllConnections();});
 const root=`http://127.0.0.1:${app.server.address().port}/api/`,body=JSON.stringify({text:'x'.repeat(1_100_000)});
 for(let n=0;n<20;n++){
  const response=await fetch(root+'chat',{method:'POST',headers:{'Content-Type':'application/json'},body});assert.equal(response.status,413);assert.match((await response.json()).error,/过长/);
 }
 assert.equal((await fetch(root+'health')).status,200);
 assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM messages').get().n,0);
});
