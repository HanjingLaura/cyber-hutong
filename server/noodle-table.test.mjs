import {noodleSeats} from '../shared/noodle.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from './store.mjs';
import {createWorld} from './world.mjs';
test('table actions reject replaced selected food and accept rear seated diner',async()=>{
 const store=openStore(':memory:');try{
 const {user}=await store.register('noodle_table','test-password-123');const world=createWorld(store),p={scene:'noodle',x:noodleSeats[4].x,y:noodleSeats[4].y,seat:'4'};
 store.hand(user.id,'米线',0);
 world.interact(user,p,{object:'noodle:table-0',action:'put',slot:2,revision:1,requestId:'put'},new Map());
 const old=world.snapshot('noodle').find(o=>o.id==='noodle:table-0').version;
 world.interact(user,p,{object:'noodle:table-0',action:'take',slot:2,revision:2,requestId:'take'},new Map());
 world.interact(user,p,{object:'noodle:table-0',action:'put',slot:2,revision:3,requestId:'replace'},new Map());
 assert.throws(()=>world.interact(user,p,{object:'noodle:table-0',action:'consume',slot:2,expectedObjectVersion:old,revision:4,requestId:'stale'},new Map()),e=>e.status===409);
 assert.equal(world.snapshot('noodle').find(o=>o.id==='noodle:table-0').slots[2].name,'米线');
 assert.throws(()=>world.interact(user,{...p,x:320,y:180},{object:'noodle:table-0',action:'take',slot:2,revision:4,requestId:'far'},new Map()),e=>e.status===409);
 }finally{store.close();}
});

test('selected slot seasoning and hand eating leave other table meals untouched',async()=>{
 const store=openStore(':memory:');try{const {user}=await store.register('selected_bowls','test-password-123'),world=createWorld(store),p={scene:'noodle',x:179,y:286,seat:'0'};let n=0;
 const act=input=>world.interact(user,p,{object:'noodle:table-0',revision:store.byId(user.id).revision,requestId:'selected'+(++n),...input},new Map());
 store.hand(user.id,'米线',0);act({action:'put',slot:0});store.hand(user.id,'米线',2);act({action:'put',slot:1});
 act({action:'season',slot:0,item:'醋'});act({action:'season',slot:1,item:'麻油'});let o=world.snapshot('noodle')[0];assert.deepEqual(o.slots[0].seasoning,['醋']);assert.deepEqual(o.slots[1].seasoning,['麻油']);
 store.hand(user.id,'鸡柳',4);act({action:'consume',slot:0,fromHand:true});o=world.snapshot('noodle')[0];assert.equal(o.slots[0].name,'米线');assert.equal(o.slots[1].name,'米线');assert.equal(store.byId(user.id).hand,null);
 const req={object:'noodle:table-0',action:'consume',slot:1,expectedObjectVersion:o.version,revision:6,requestId:'eat-once'};world.interact(user,p,req,new Map());world.interact(user,p,req,new Map());assert.equal(world.snapshot('noodle')[0].slots[0].name,'米线');assert.equal(world.snapshot('noodle')[0].slots[1],null);
 }finally{store.close();}
});
