import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const exports={};runInNewContext(ts.transpileModule(readFileSync(new URL('../src/multiplayer/chat-state.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});

test('drafts, unread and history survive independent lobby, scene and peer switches without duplication',()=>{
 const state=new exports.ChatState('suki');
 state.select('scene','hutong',null);state.current.draft='office draft';
 state.select('lobby','hutong',null);state.current.draft='lobby draft';
 const publicMessage={seq:1,sender:'sid',recipient:null,scene:'rest',body:'public',channel:'lobby'};
 state.receive(publicMessage,false);state.receive(publicMessage,false);assert.equal(state.current.unread,1);
 state.select('dm','rest','sid');state.current.draft='private draft';
 state.receive({seq:2,sender:'sid',recipient:'suki',scene:'rest',body:'private'},false);
 assert.equal(state.current.unread,1);
 state.select('scene','rest',null);assert.equal(state.current.messages.size,0);assert.equal(state.current.draft,'');
 state.select('scene','hutong',null);assert.equal(state.current.draft,'office draft');
 state.select('lobby','rest',null);assert.equal(state.current.draft,'lobby draft');assert.equal(state.current.messages.size,1);assert.equal(state.current.unread,0);
 state.select('dm','hutong','sid');assert.equal(state.current.draft,'private draft');assert.equal(state.current.messages.size,1);
 const foreign={seq:3,sender:'sid',recipient:'jilly',scene:'hutong',body:'foreign'};
 assert.equal(state.receive(foreign,false),false);assert.equal(state.current.messages.size,1);
});
test('a late history response merges with live messages and never replaces another selected channel',()=>{
 const state=new exports.ChatState('suki');state.select('scene','hutong',null);const key=state.key;
 state.receive({seq:20,sender:'sid',recipient:null,scene:'hutong',channel:'scene',body:'live'},true);
 state.select('lobby','rest',null);
 state.history(key,[{seq:19,sender:'sid',recipient:null,scene:'hutong',body:'old'}]);
 assert.equal(state.current.messages.size,0);state.select('scene','hutong',null);assert.deepEqual([...state.current.messages.keys()].sort(),[19,20]);
});

test('later lower-sequence messages remain visible when trimming cross-instance history',()=>{
 const state=new exports.ChatState('suki');state.select('lobby','hutong',null);
 for(let n=0;n<100;n++)state.receive({seq:2000000+n,at:n,sender:'sid',recipient:null,scene:'hutong',channel:'lobby',body:'earlier'},true);
 const later={seq:1000001,at:101,sender:'laura',recipient:null,scene:'hutong',channel:'lobby',body:'later'};
 state.receive(later,true);assert.equal(state.current.messages.size,100);assert.ok(state.current.messages.has(later.seq));assert.ok(!state.current.messages.has(2000000));
 assert.equal([...state.current.messages.values()].sort(exports.compareMessages).at(-1),later);
});

test('reconnect history merges a missed agent reply into its selected DM without duplicating live delivery',()=>{
 const state=new exports.ChatState('suki');state.select('dm','hutong','sid');state.current.draft='retained draft';
 const human={seq:101,at:1,sender:'suki',recipient:'sid',scene:'hutong',channel:'dm',body:'question'};
 const reply={seq:102,at:2,sender:'sid',recipient:'suki',scene:'rest',channel:'dm',body:'answer',npc:true};
 state.receive(human,true);const reconnectKey=state.key;
 state.select('lobby','rest',null);state.current.draft='lobby draft';
 state.receive(reply,false);
 state.history(reconnectKey,[human,reply,{seq:103,sender:'sid',recipient:'jilly',scene:'rest',channel:'dm',body:'foreign'}]);
 assert.equal(state.key,'lobby');assert.equal(state.current.messages.size,0);assert.equal(state.current.draft,'lobby draft');
 state.select('dm','rest','sid');assert.equal(state.current.messages.size,2);assert.equal(state.current.draft,'retained draft');
 assert.deepEqual([...state.current.messages.keys()],[101,102]);assert.equal(state.current.unread,0);
 assert.equal(state.receive(reply,true),false);
});
