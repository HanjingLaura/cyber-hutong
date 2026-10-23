import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {shouldEnableGameKeyboard} from '../src/keyboard-gate.mjs';
const source=readFileSync(new URL('../src/multiplayer/bridge.ts',import.meta.url),'utf8');
const method=source.slice(source.indexOf('  private syncKeyboardGate()'),source.indexOf('  get active()'));
const code=ts.transpileModule(`class Gate { constructor(game,scene){this.game=game;this.scene=scene;this.controller=true;this.connected=true;this.user={role:'laura'};}get active(){return this.scene;} ${method} }\nreturn Gate;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
test('global WASD capture is disabled during a gap with no active scene and restored only for game focus',()=>{
 const world={},canvas={},input={tagName:'INPUT'},manager={preventDefault:true},document={activeElement:input,querySelector:s=>s==='.world'?world:null};
 const Gate=new Function('shouldEnableGameKeyboard','document',code)(shouldEnableGameKeyboard,document),gate=new Gate({canvas,input:{keyboard:manager}},null);
 gate.syncKeyboardGate();assert.equal(manager.preventDefault,false);
 const keyboard={enabled:false,resetKeys(){},enableGlobalCapture(){manager.preventDefault=true;},disableGlobalCapture(){manager.preventDefault=false;}};gate.scene={input:{keyboard}};
 document.activeElement=canvas;gate.syncKeyboardGate();assert.equal(keyboard.enabled,true);assert.equal(manager.preventDefault,true);
 gate.transitioning=true;gate.syncKeyboardGate();assert.equal(keyboard.enabled,false);assert.equal(manager.preventDefault,false);
 gate.transitioning=false;document.activeElement=input;gate.syncKeyboardGate();assert.equal(manager.preventDefault,false);
});

test('authoritative scene entry resets the old visit collision position',()=>{
 const method=source.slice(source.indexOf('  apply(p:Player)'),source.indexOf('  stand()'));
 const code=ts.transpileModule(`class Bridge {constructor(scene){this.scene=scene;this.previous=new Map([['rest',{x:200,y:215}]]);this.movedAt=new Map([['rest',100]]);}get active(){return this.scene;} ${method}}\nreturn Bridge;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const Bridge=new Function(code)(),scene={sys:{settings:{key:'rest'}},x:200,y:215},bridge=new Bridge(scene);
 bridge.apply({scene:'rest',x:554,y:184,facing:0});assert.deepEqual(bridge.previous.get('rest'),{x:554,y:184});assert.equal(bridge.movedAt.get('rest'),0);
});
