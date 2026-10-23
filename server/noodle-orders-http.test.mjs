import test from 'node:test';
import assert from 'node:assert/strict';
import {createMvpServer} from './app.mjs';

test('HTTP never relabels an old noodle receipt with the latest list revision',async t=>{
 const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''}});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(()=>{app.close();app.server.closeAllConnections();});
 const session=await app.store.register('http_noodle_revision','test-password-123','laura');
 const api=async(path,input)=>{const response=await fetch(`http://127.0.0.1:${app.server.address().port}/api/${path}/`,{method:input?'POST':'GET',headers:{Cookie:'hutong_session='+session.token,'Content-Type':'application/json'},body:input?JSON.stringify(input):undefined});const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;};
 await api('control',{client:'noodle-version-tab'});Object.assign(app.players.get(session.user.id),{scene:'noodle',x:320,y:330});
 const original={client:'noodle-version-tab',action:'save',table:0,items:['米线'],revision:0,requestId:'original-order'};
 const created=await api('noodle-orders',original),order=created.noodleOrders[0];
 const cancelled=await api('noodle-orders',{client:'noodle-version-tab',action:'cancel',orderId:order.id,orderRevision:order.revision,revision:0,requestId:'cancel-original'});
 assert.ok(cancelled.noodleOrdersRevision>created.noodleOrdersRevision);assert.equal(cancelled.noodleOrders[0].status,'cancelled');
 const replay=await api('noodle-orders',original);
 assert.equal(replay.noodleOrdersRevision,created.noodleOrdersRevision);assert.equal(replay.noodleOrders[0].status,'active');
 const latest=await api('noodle-orders');assert.equal(latest.noodleOrdersRevision,cancelled.noodleOrdersRevision);assert.equal(latest.noodleOrders[0].status,'cancelled');
});
