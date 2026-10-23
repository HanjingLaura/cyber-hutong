import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

test('missing optional toy art does not hide an otherwise loaded player',async()=>{
 const source=readFileSync(new URL('../src/multiplayer/avatar.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const node={setVisible(){return this;},setOrigin(){return this;},setText(){return this;}};
 const scene={sys:{game:{}},add:{image:()=>Object.create(node),text:()=>Object.create(node)},textures:{exists:()=>true,get:()=>({has:()=>true})}};
 const optionalArt=new Promise((_,reject)=>queueMicrotask(()=>reject(Error('404 optional art'))));
 class View{}
 const modules={
  '../gacha-assets':{gachaReady:()=>optionalArt,registerGachaTextures:()=>assert.fail('failed toy art cannot register')},
  '../character-assets':{characterRegistry:{members:{laura:{frames:[{source:'laura',rect:[0,0,32,48]}],carryFrames:[],officeFrames:[]}}},characterImage:async()=>({})},
  '../side-walk-legs':{SideWalkLegs:View},'../held-item':{HeldItemView:View},
 };
 const exports={};new Function('exports','require',compiled)(exports,id=>modules[id]??{});
 const avatar=new exports.TeamAvatar(scene,'laura');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(avatar.ready,true,'player must remain visible when toy PNG fails');
});
