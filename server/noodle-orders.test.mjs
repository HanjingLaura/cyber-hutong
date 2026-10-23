import {noodleSeats} from '../shared/noodle.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from './store.mjs';
import {createWorld} from './world.mjs';
test('orders atomically pick once, replay safely, serve actual food, cancel preserves hands',async()=>{
 const {createNoodleOrders}=await import('./noodle-orders.mjs');const store=openStore(':memory:');try{
 const a=(await store.register('order_owner','test-password-123')).user,b=(await store.register('order_help','test-password-123')).user;
 const world=createWorld(store),orders=createNoodleOrders(store,null,world);let n=0;
 const act=(u,p,input)=>orders.interact(u,{scene:'noodle',x:280,y:181,...p},{requestId:'o'+(++n),revision:store.byId(u.id).revision,...input});
 let r=act(a,{}, {action:'save',table:0,items:['米线','鸡柳','可乐']});let o=r.noodleOrders[0];
 assert.equal(o.items.length,3);assert.throws(()=>act(a,{}, {action:'save',table:0,items:['米线','炸鸡','鸡柳']}),e=>e.status===400);
 assert.throws(()=>act(b,{}, {action:'cancel',orderId:o.id,orderRevision:o.revision}),e=>e.status===403);
 assert.throws(()=>act(b,{}, {action:'pickup',orderId:o.id,orderRevision:o.revision,item:0}),/碗筷/);
 store.hand(b.id,'碗筷',0);const req={action:'pickup',orderId:o.id,orderRevision:o.revision,item:0,requestId:'pick-once',revision:1};
 r=act(b,{},req);o=r.noodleOrders[0];assert.equal(store.byId(b.id).hand,'米线');
 act(b,{},req);assert.equal(store.byId(b.id).revision,2);
 assert.throws(()=>act(a,{}, {...req,requestId:'compete',orderRevision:o.revision,revision:0}),/已被/);
 assert.throws(()=>act(b,{x:noodleSeats[4].x,y:noodleSeats[4].y,seat:'4'},{action:'serve',orderId:o.id,orderRevision:o.revision,item:0,table:1,slot:2}),e=>e.status===409);
 r=act(b,{x:noodleSeats[4].x,y:noodleSeats[4].y,seat:'4'},{action:'serve',orderId:o.id,orderRevision:o.revision,item:0,table:0,slot:2});o=r.noodleOrders[0];
 assert.equal(store.byId(b.id).hand,null);assert.equal(world.snapshot('noodle')[0].slots[2].name,'米线');assert.equal(o.items[0].status,'served');
 r=act(b,{x:476},{action:'pickup',orderId:o.id,orderRevision:o.revision,item:1});o=r.noodleOrders[0];
 act(a,{}, {action:'cancel',orderId:o.id,orderRevision:o.revision});assert.equal(store.byId(b.id).hand,'鸡柳');
 assert.equal(createNoodleOrders(store,null,world).list('noodle')[0].status,'cancelled');assert.deepEqual(orders.list('rest'),[]);
 }finally{store.close();}
});
test('outer failure rolls back food and order, explicit release and expiry are persistent',async()=>{
 const {createNoodleOrders}=await import('./noodle-orders.mjs');const store=openStore(':memory:');try{
 const a=(await store.register('order_atomic','test-password-123')).user,world=createWorld(store),orders=createNoodleOrders(store,null,world);let n=0;
 const act=input=>orders.interact(a,{scene:'noodle',x:104,y:181},{revision:store.byId(a.id).revision,requestId:'atomic'+(++n),...input});
 let o=act({action:'save',table:0,items:['米线','可乐']}).noodleOrders[0];
 store.db.exec("CREATE TRIGGER reject_order BEFORE UPDATE ON noodle_orders BEGIN SELECT RAISE(ABORT,'forced storage failure'); END;");
 assert.throws(()=>act({action:'pickup',orderId:o.id,orderRevision:o.revision,item:1}),/forced/);assert.equal(store.byId(a.id).hand,null);
 store.db.exec('DROP TRIGGER reject_order');o=act({action:'pickup',orderId:o.id,orderRevision:o.revision,item:1}).noodleOrders[0];
 o=act({action:'release',orderId:o.id,orderRevision:o.revision,item:1}).noodleOrders[0];assert.equal(o.items[1].status,'pending');assert.equal(store.byId(a.id).hand,'可乐');
 assert.equal(orders.list('noodle',Date.now()+86400001)[0].status,'expired');
 }finally{store.close();}
});

test('eight independent orders survive instance reconstruction and expire without deleting held food',async()=>{
 const {createNoodleOrders}=await import('./noodle-orders.mjs');const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=mkdtempSync(join(tmpdir(),'noodle-orders-'));let store=openStore(join(dir,'test.sqlite'));
 try{let world=createWorld(store),orders=createNoodleOrders(store,null,world);const users=[];
 for(let i=0;i<8;i++){const u=(await store.register('eight_noodle_'+i,'test-password-123')).user;users.push(u);orders.interact(u,{scene:'noodle',x:320,y:330},{action:'save',table:i%2,items:['米线'],requestId:'save-eight',revision:0});}
 assert.equal(orders.list('noodle').length,8);assert.throws(()=>orders.interact(users[0],{scene:'noodle'},{action:'save',table:1,items:['米线'],requestId:'duplicate-order',revision:0}),e=>e.status===409);
 store.close();store=openStore(join(dir,'test.sqlite'));world=createWorld(store);orders=createNoodleOrders(store,null,world);assert.equal(orders.list('noodle').length,8);
 assert.equal(orders.list('noodle',Date.now()+86400001).filter(o=>o.status==='expired').length,8);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});

test('changed held food cannot serve and only picker may explicitly release a pickup',async()=>{
 const {createNoodleOrders}=await import('./noodle-orders.mjs');const store=openStore(':memory:');try{
 const a=(await store.register('held_owner','test-password-123')).user,b=(await store.register('held_other','test-password-123')).user,world=createWorld(store),orders=createNoodleOrders(store,null,world);let n=0;
 const act=(u,input,p={})=>orders.interact(u,{scene:'noodle',x:476,y:181,...p},{revision:store.byId(u.id).revision,requestId:'held'+(++n),...input});
 let o=act(a,{action:'save',table:0,items:['米线','鸡柳']}).noodleOrders[0];o=act(b,{action:'pickup',orderId:o.id,orderRevision:o.revision,item:1}).noodleOrders[0];
 assert.throws(()=>act(a,{action:'release',orderId:o.id,orderRevision:o.revision,item:1}),e=>e.status===403);
 world.interact(b,{scene:'noodle',x:noodleSeats[4].x,y:noodleSeats[4].y},{action:'put',object:'noodle:table-0',slot:1,revision:1,requestId:'manual-put'},new Map());
 assert.throws(()=>act(b,{action:'serve',orderId:o.id,orderRevision:o.revision,item:1,table:0,slot:2},{x:noodleSeats[4].x,y:noodleSeats[4].y}),/手中餐品已改变/);
 assert.equal(orders.list('noodle')[0].items[1].status,'picked');assert.equal(world.snapshot('noodle')[0].slots[1].name,'鸡柳');
 o=act(b,{action:'release',orderId:o.id,orderRevision:o.revision,item:1}).noodleOrders[0];assert.equal(o.items[1].status,'pending');
 }finally{store.close();}
});

test('stable account head serializes new orders across replica instances',async()=>{
 const {createNoodleOrders}=await import('./noodle-orders.mjs');const store=openStore(':memory:');try{const user=(await store.register('stable_order_head','test-password-123')).user,world=createWorld(store),orders=createNoodleOrders(store,null,world);let n=0;
 const act=input=>orders.interact(user,{scene:'noodle'},{requestId:'head'+(++n),revision:0,...input});
 let o=act({action:'save',table:0,items:['米线']}).noodleOrders[0];assert.equal(store.db.prepare('SELECT order_id FROM noodle_order_heads WHERE account=?').get(user.id).order_id,o.id);
 act({action:'cancel',orderId:o.id,orderRevision:o.revision});const next=act({action:'save',table:1,items:['米线']}).noodleOrders.find(o=>o.status==='active');assert.notEqual(next.id,o.id);assert.equal(store.db.prepare('SELECT order_id FROM noodle_order_heads WHERE account=?').get(user.id).order_id,next.id);
 }finally{store.close();}
});

test('order receipts bind replay payload and never accept unrelated object receipts',async()=>{
 const {createNoodleOrders}=await import('./noodle-orders.mjs');const store=openStore(':memory:');try{const user=(await store.register('noodle_receipt','test-password-123')).user,world=createWorld(store),orders=createNoodleOrders(store,null,world),p={scene:'noodle',x:156,y:181};
 world.interact(user,p,{action:'supply',object:'noodle:utensils',item:'碗筷',revision:0,requestId:'shared-id'},new Map());
 const input={action:'save',table:0,items:['米线'],requestId:'shared-id',revision:1};const result=orders.interact(user,p,input);assert.equal(result.noodleOrders.length,1);assert.deepEqual(orders.interact(user,p,input),result);
 assert.throws(()=>orders.interact(user,p,{...input,action:'cancel',orderId:result.noodleOrders[0].id}),e=>e.status===409);
 assert.throws(()=>orders.interact(user,p,{...input,orderId:'different'}),e=>e.status===409);
 }finally{store.close();}
});

test('scene order revision advances only successful mutations and survives replay and rollback',async()=>{
 const {createNoodleOrders}=await import('./noodle-orders.mjs');const store=openStore(':memory:');try{const user=(await store.register('order_list_revision','test-password-123')).user,world=createWorld(store),orders=createNoodleOrders(store,null,world),p={scene:'noodle'},input={action:'save',table:0,items:['米线'],requestId:'list-revision',revision:0};
 assert.equal(orders.revision,0);const r=orders.interact(user,p,input);assert.equal(r.noodleOrdersRevision,1);orders.interact(user,p,input);assert.equal(orders.revision,1);
 const o=r.noodleOrders[0];store.db.exec("CREATE TRIGGER reject_revision BEFORE UPDATE ON noodle_order_meta BEGIN SELECT RAISE(ABORT,'revision rollback'); END;");assert.throws(()=>orders.interact(user,p,{action:'cancel',orderId:o.id,orderRevision:o.revision,requestId:'list-fail',revision:0}),/revision rollback/);assert.equal(orders.revision,1);assert.equal(orders.list('noodle')[0].status,'active');
 }finally{store.close();}
});

test('expired list is a pure projection and cannot write outside durable mutation',async()=>{
 const {createNoodleOrders}=await import('./noodle-orders.mjs');const store=openStore(':memory:');try{const user=(await store.register('expiry_projection','test-password-123')).user,world=createWorld(store),orders=createNoodleOrders(store,null,world);orders.interact(user,{scene:'noodle'},{action:'save',table:0,items:['米线'],requestId:'expiry-save',revision:0});
 const before=store.db.prepare('SELECT total_changes() AS n').get().n;assert.equal(orders.list('noodle',Date.now()+86400001)[0].status,'expired');assert.equal(store.db.prepare('SELECT total_changes() AS n').get().n,before);assert.equal(store.db.prepare('SELECT status FROM noodle_orders').get().status,'active');assert.equal(orders.revision,1);
 }finally{store.close();}
});

test('client-created object receipt cannot preempt an internal order food transfer',async()=>{
 const {createNoodleOrders}=await import('./noodle-orders.mjs');const {createHash}=await import('node:crypto');const store=openStore(':memory:');try{const user=(await store.register('nested_receipt','test-password-123')).user,world=createWorld(store),orders=createNoodleOrders(store,null,world);
 const o=orders.interact(user,{scene:'noodle'},{action:'save',table:0,items:['米线','可乐'],requestId:'nested-save',revision:0}).noodleOrders[0],id=createHash('sha256').update('noodle:predictable-pickup').digest('hex');
 world.interact(user,{scene:'noodle',x:156,y:181},{object:'noodle:utensils',action:'supply',item:'碗筷',requestId:id,revision:0},new Map());world.interact(user,{scene:'noodle',x:213,y:244},{object:'noodle:table-0',action:'put',slot:0,requestId:'nested-stow',revision:1},new Map());
 orders.interact(user,{scene:'noodle',x:104,y:181},{action:'pickup',orderId:o.id,orderRevision:o.revision,item:1,requestId:'predictable-pickup',revision:2});assert.equal(store.byId(user.id).hand,'可乐');
 }finally{store.close();}
});
