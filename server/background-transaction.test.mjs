import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {durableRequests} from './durable-request.mjs';

test('background reply mutations commit before publication and roll back failed saves in the shared writer queue',async t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('CREATE TABLE replies(id TEXT PRIMARY KEY)');
 let rejectSave=false,published=0,paused=false;
 const request=durableRequests({db,handle:async()=>{},before:async()=>{},commit:async()=>{assert.equal(paused,true);if(rejectSave)throw Error('cloud offline');},suspend:value=>paused=value,capture:()=>0,restore:()=>{},publish:()=>published++});
 assert.equal(typeof request.mutate,'function');
 await request.mutate(()=>db.prepare('INSERT INTO replies VALUES(?)').run('one'));
 assert.equal(published,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM replies').get().n,1);
 rejectSave=true;await assert.rejects(request.mutate(()=>db.prepare('INSERT INTO replies VALUES(?)').run('two')),/cloud offline/);
 assert.equal(published,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM replies').get().n,1);assert.equal(paused,false);assert.equal(db.isTransaction,false);
 rejectSave=false;await request.mutate(()=>db.prepare('INSERT INTO replies VALUES(?)').run('three'));assert.equal(published,2);
});
