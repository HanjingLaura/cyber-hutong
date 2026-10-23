import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from './store.mjs';
import {createClient} from '@libsql/client';
import {prepareReplica} from './replica.mjs';
import {issueResetCode} from '../scripts/reset-code.mjs';

test('organizer tool issues a code for an existing local account without changing its password',async t=>{
 assert.equal(typeof issueResetCode,'function');
 const dir=mkdtempSync(join(tmpdir(),'reset-tool-test-')),path=join(dir,'game.db');let restored;t.after(()=>{restored?.close();rmSync(dir,{recursive:true,force:true});});
 const store=openStore(path);await store.register('tool_laura','old-password-123','laura');store.close();
 const issued=await issueResetCode({username:'tool_laura',dbPath:path});assert.equal(issued.username,'tool_laura');
 restored=openStore(path);assert.ok(await restored.login('tool_laura','old-password-123'));await restored.resetPassword('tool_laura',issued.code,'new-password-123');
 await assert.rejects(issueResetCode({username:'missing',dbPath:path}),e=>e.status===404);
});

test('organizer cloud tool publishes only a hash and its code works on a fresh replica',async t=>{
 assert.equal(typeof issueResetCode,'function');
 const dir=mkdtempSync(join(tmpdir(),'reset-tool-cloud-')),client=createClient({url:'file::memory:'}),quiet={warn(){},error(){}};
 t.after(()=>{client.close();rmSync(dir,{recursive:true,force:true});});
 const path=join(dir,'bootstrap.db'),replica=await prepareReplica(path,client,{flushEveryMs:0,log:quiet}),store=openStore(path);replica.attach(store.db);
 await store.register('tool_cora','old-password-123','cora');await replica.flush();await replica.close();store.close();
 const issued=await issueResetCode({username:'tool_cora',client});
 const remote=(await client.execute("SELECT data FROM hutong_online_rows WHERE tbl='password_resets' AND deleted=0")).rows;
 assert.equal(remote.length,1);assert.ok(!String(remote[0].data).includes(issued.code.replaceAll('-','')));
 const fresh=await prepareReplica(join(dir,'fresh.db'),client,{flushEveryMs:0,log:quiet}),read=openStore(join(dir,'fresh.db'));fresh.attach(read.db);
 await read.resetPassword('tool_cora',issued.code,'new-password-123');await fresh.flush();await fresh.close();read.close();
});
