import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync('src/arcade-sports.ts','utf8').replace(/^import .*;\r?\n/,'').replaceAll('export ','');
const Sports=new Function('drawSportArt',ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\nreturn ArcadeSports;')(()=>true);
test('left and right goal openings score for the opponent and serve from center',()=>{
 for(const [x,vx,expected] of [[61,-230,[0,1]],[579,230,[1,0]]]){
  const game=new Sports();game.puck={x,y:210,vx,vy:0};game.update('hockey',1,new Set());
  assert.deepEqual(game.state().hockey.goals,expected);assert.equal(game.state().hockey.puck.x,320);
 }
});
test('top, bottom and closed sections of side rails bounce without scoring',()=>{
 for(const puck of [{x:320,y:71,vx:0,vy:-230},{x:320,y:359,vx:0,vy:230},{x:61,y:120,vx:-230,vy:0},{x:579,y:300,vx:230,vy:0}]){
  const game=new Sports();game.puck={...puck};game.update('hockey',1,new Set());const state=game.state().hockey;
  assert.deepEqual(state.goals,[0,0]);assert.ok(puck.vx?state.puck.vx*puck.vx<0:state.puck.vy*puck.vy<0);
 }
});
test('player stays on left half and computer on right through pointer, keys and reset',()=>{
 const game=new Sports();game.pointer('hockey',600,40);let state=game.state().hockey;
 assert.ok(state.player.x<320);assert.ok(state.player.y>=88);assert.ok(state.bot.x>320);
 for(let i=0;i<100;i++)game.update('hockey',16,new Set(['KeyD','KeyS']));state=game.state().hockey;
 assert.ok(state.player.x<320);assert.ok(state.player.y<=342);assert.ok(state.bot.x>320);
 game.reset('hockey');assert.deepEqual(game.state().hockey.player,{x:120,y:210});
});
test('paddles strike toward the opposing left or right goal',()=>{
 for(const [bat,x,vx,sign]of [['player',144,-130,1],['bot',496,130,-1]]){
  const game=new Sports();game[bat]={x:bat==='player'?120:520,y:210};game.puck={x,y:210,vx,vy:0};game.update('hockey',1,new Set());assert.ok(game.state().hockey.puck.vx*sign>0);
 }
});
