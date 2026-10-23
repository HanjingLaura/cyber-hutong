import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from './store.mjs';
import {createLife} from './life.mjs';
import {createCoffeeOrders} from './coffee-orders.mjs';
import {createMvpServer} from './app.mjs';
async function fixture(t,path=':memory:'){
 const store=openStore(path);t.after(()=>store.close());const a=(await store.register('coffee_laura','test-password-123','laura')).user,b=(await store.register('coffee_sid','test-password-123','sid')).user;
 const life=createLife(store),orders=createCoffeeOrders(store,life),p={scene:'manner',x:260,y:216};let n=0;
 const act=(action,extra={})=>orders.interact(a,p,{action,revision:store.byId(a.id).revision,requestId:'coffee-'+(++n),...extra});
 return{store,a,b,life,orders,p,act};
}
test('coffee orders are private, immediate, idempotent and mint exactly once',async t=>{
 const {store,a,b,orders,p,act,life}=await fixture(t);const input={action:'order',revision:0,requestId:'same-order'};
 const ordered=orders.interact(a,p,input);assert.deepEqual(orders.interact(a,p,input),ordered);assert.equal(ordered.order.status,'pending');assert.equal(orders.self(b.id).order,null);
 assert.throws(()=>act('order'),/待取/);p.x=440;
 const take={action:'take',orderId:ordered.order.id,expectedOrderVersion:0,revision:0,requestId:'same-take'};
 const cup=orders.interact(a,p,take);assert.equal(cup.self.hand,'咖啡');assert.deepEqual(orders.interact(a,p,take),cup);assert.equal(store.byId(a.id).revision,1);
 life.inventory(a.id,{action:'stow',revision:1,requestId:'stow-coffee'},'hutong');
 assert.throws(()=>act('take',{orderId:ordered.order.id,expectedOrderVersion:1}),/已取/);assert.equal(store.byId(a.id).hand,null);assert.equal(life.bag(a.id)[0].origin.scene,'manner');
});
test('distance, identity, hand and optimistic versions prevent invalid cups',async t=>{
 const {store,a,b,orders,p,act}=await fixture(t);p.scene='rest';assert.throws(()=>act('order'),/门店/);p.scene='manner';p.x=580;assert.throws(()=>act('order'),/点单/);p.x=260;
 store.hand(a.id,'面包',0);assert.throws(()=>act('order'),/手里/);store.hand(a.id,null,1);
 const order=act('order').order;p.x=440;const args={orderId:order.id,expectedOrderVersion:0};
 assert.throws(()=>orders.interact(b,p,{action:'take',...args,revision:0,requestId:'theft'}),/订单/);
 assert.throws(()=>act('take',{...args,revision:0}),/改变/);assert.throws(()=>act('take',{...args,expectedOrderVersion:99}),/订单已改变/);
 assert.equal(orders.self(a.id).order.status,'pending');act('cancel',args);assert.throws(()=>act('take',{...args,expectedOrderVersion:1}),/取消/);
});
test('pending survives reopen and outer rollback does not retain a cup or receipt',async t=>{
 const path=join(mkdtempSync(join(tmpdir(),'hutong-coffee-')),'state.sqlite');const f=await fixture(t,path),order=f.act('order').order;
 const other=openStore(path);try{const orders=createCoffeeOrders(other,createLife(other));assert.equal(orders.self(f.a.id).order.id,order.id);}finally{other.close();}
 f.p.x=440;f.store.db.exec('BEGIN IMMEDIATE');const input={action:'take',orderId:order.id,expectedOrderVersion:0,revision:0,requestId:'rolled-back'};f.orders.interact(f.a,f.p,input);f.store.db.exec('ROLLBACK');
 assert.equal(f.store.byId(f.a.id).hand,null);assert.equal(f.orders.self(f.a.id).order.status,'pending');assert.equal(f.orders.interact(f.a,f.p,input).self.hand,'咖啡');
});
test('HTTP validates controller and commits cup, origin and receipt only after persistence',async t=>{
 let reject=false;const app=createMvpServer({dbPath:':memory:',llmOptions:{key:''},commitRequest:async()=>{if(reject)throw Error('storage unavailable');}});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(()=>{app.close();app.server.closeAllConnections();});
 const a=await app.store.register('coffee_http','test-password-123','laura');
 const request=async(path,input)=>{const r=await fetch(`http://127.0.0.1:${app.server.address().port}/api/${path}`,{method:input?'POST':'GET',headers:{Cookie:'hutong_session='+a.token,'Content-Type':'application/json'},body:input?JSON.stringify(input):undefined});return{status:r.status,data:await r.json()};};
 await request('control',{client:'coffee-tab'});const p=app.players.get(a.user.id);Object.assign(p,{scene:'manner',x:260,y:216});
 assert.equal((await request('coffee-orders',{client:'wrong',action:'order',revision:0,requestId:'wrong-tab'})).status,409);
 const ordered=await request('coffee-orders/',{client:'coffee-tab',action:'order',revision:0,requestId:'http-order'});assert.equal(ordered.status,200);app.players.get(a.user.id).x=440;
 const input={client:'coffee-tab',action:'take',revision:0,orderId:ordered.data.order.id,expectedOrderVersion:0,requestId:'http-take'};
 reject=true;assert.equal((await request('coffee-orders',input)).status,503);assert.equal(app.store.byId(a.user.id).hand,null);assert.equal((await request('coffee-orders')).data.order.status,'pending');
 reject=false;assert.equal((await request('coffee-orders',input)).data.self.hand,'咖啡');assert.equal(app.store.db.prepare('SELECT scene FROM hand_origins WHERE account=?').get(a.user.id).scene,'manner');
});
test('eight accounts each receive exactly their own single coffee',async t=>{
 const store=openStore(':memory:');t.after(()=>store.close());const orders=createCoffeeOrders(store,createLife(store));
 // Roles are drawn from the repository roster rather than relying on invented identities.
 const {roles:validRoles}=await import('./personas.mjs');
 const users=await Promise.all(validRoles.slice(0,8).map((role,i)=>store.register('coffee_eight_'+i,'test-password-123',role)));
 const pending=users.map(({user},i)=>orders.interact(user,{scene:'manner',x:260,y:216},{action:'order',revision:0,requestId:'order-'+i}).order);
 assert.equal(new Set(pending.map(o=>o.id)).size,8);
 users.forEach(({user},i)=>{orders.interact(user,{scene:'manner',x:440,y:216},{action:'take',revision:0,requestId:'take-'+i,orderId:pending[i].id,expectedOrderVersion:0});assert.equal(store.byId(user.id).hand,'咖啡');assert.equal(store.byId(user.id).revision,1);});
});
