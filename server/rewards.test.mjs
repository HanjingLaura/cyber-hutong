import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from './store.mjs';
import {createLife} from './life.mjs';
import {createWorld} from './world.mjs';
import {createRewards} from './rewards.mjs';

async function fixture(t,path=':memory:'){
 const store=openStore(path);t.after(()=>store.close());const a=(await store.register('reward_laura','test-password-123','laura')).user,b=(await store.register('reward_sid','test-password-123','sid')).user;
 const life=createLife(store),world=createWorld(store,life),leases=new Map(),rewards=createRewards(store,life,world,leases);
 const move={scene:'perler',x:320,y:300};let n=0;const reward=(action,args={})=>rewards.interact(a,move,{action,...args,revision:store.byId(a.id).revision,requestId:'reward-'+(++n)}),inventory=(action,args={})=>life.inventory(a.id,{action,...args,revision:store.byId(a.id).revision,requestId:'bag-'+(++n)},move.scene);
 return{store,a,b,life,world,leases,rewards,move,reward,inventory};
}
test('perler rewards preserve the exact design, mint once, and transfer through collection, bag and gift',async t=>{
 const {store,a,b,life,world,rewards,reward,inventory}=await fixture(t);const cells=Array(256).fill(-1);cells[25]=2;cells[26]=7;world.write(a.id,'bead','work',{cells,pattern:'自由',created:1});
 const input={action:'perler',key:'work',revision:0,requestId:'unique-work'},p={scene:'perler',x:320,y:300};const result=rewards.interact(a,p,input);assert.equal(rewards.interact(a,p,input).item,result.item);assert.deepEqual(rewards.art(result.item).cells,cells);assert.throws(()=>reward('perler',{key:'work'}),/已经带走/);assert.equal(life.collection(a.id).length,0);
 const collectInput={action:'collect',revision:store.byId(a.id).revision,requestId:'unique-collect'};life.inventory(a.id,collectInput,'perler');life.inventory(a.id,collectInput,'perler');assert.equal(life.collection(a.id)[0].count,1);assert.equal(store.byId(a.id).hand,null);assert.equal(life.collection(b.id).length,0);
 inventory('retrieve',{slot:0});inventory('stow');inventory('equip',{slot:0});assert.equal(store.byId(a.id).hand,result.item);
 const offer=life.send(a.id,'sid','gift','give-art','perler');life.respond(b.id,offer.id,'accept');assert.equal(store.byId(a.id).hand,null);assert.equal(store.byId(b.id).hand,result.item);assert.deepEqual(rewards.art(result.item).cells,cells);
 world.write(a.id,'bead','work2',{cells,pattern:'爱心',created:2});reward('perler',{key:'work2',collect:true});assert.equal(store.byId(a.id).hand,null);assert.equal(life.collection(a.id).length,1);
});
test('claw awards require a real leased timed round; misses, retries and occupied hands are safe',async t=>{
 const {store,a,life,leases,rewards,move,reward}=await fixture(t);Object.assign(move,{scene:'arcade',x:269,y:205});assert.throws(()=>reward('claw-start',{aim:140}),/娃娃机/);leases.set('arcade:claw',{account:a.id});
 const start=reward('claw-start',{aim:140});assert.throws(()=>reward('claw-finish',{round:start.round}),/没有回到/);assert.throws(()=>reward('claw-start',{aim:220}),/尚未完成/);store.db.prepare('UPDATE claw_rounds SET at=at-2400 WHERE id=?').run(start.round);
 const finishInput={action:'claw-finish',round:start.round,revision:store.byId(a.id).revision,requestId:'finish-once'};const result=rewards.interact(a,move,finishInput);assert.equal(result.item,'娃娃·粉色小熊');assert.deepEqual(rewards.interact(a,move,finishInput),result);assert.equal(rewards.state(a.id).wins,1);assert.equal(store.byId(a.id).hand,result.item);
 const next=reward('claw-start',{aim:220});store.db.prepare('UPDATE claw_rounds SET at=at-2400 WHERE id=?').run(next.round);reward('claw-finish',{round:next.round});assert.equal(life.collection(a.id)[0].name,'娃娃·蓝色小熊');assert.equal(store.byId(a.id).hand,'娃娃·粉色小熊');
 const miss=reward('claw-start',{aim:180});store.db.prepare('UPDATE claw_rounds SET at=at-2400 WHERE id=?').run(miss.round);assert.equal(reward('claw-finish',{round:miss.round}).won,false);assert.equal(rewards.state(a.id).wins,2);
});
test('food consumes exactly once and collections survive reopening without becoming shared inventory',async t=>{
 const path=join(mkdtempSync(join(tmpdir(),'hutong-rewards-')),'state.sqlite'),f=await fixture(t,path);f.store.hand(f.a.id,'面包',0);const input={action:'consume',revision:1,requestId:'eat-once'};f.life.inventory(f.a.id,input,'rest');f.life.inventory(f.a.id,input,'rest');assert.equal(f.life.journal(f.a.id).filter(e=>e.kind==='consume').length,1);assert.equal(f.store.byId(f.a.id).hand,null);
 f.store.hand(f.a.id,'扭蛋·橘猫',f.store.byId(f.a.id).revision);f.inventory('collect');const other=openStore(path);try{const life=createLife(other);assert.equal(life.collection(f.a.id)[0].name,'扭蛋·橘猫');assert.equal(life.collection(f.b.id).length,0);}finally{other.close();}
});
