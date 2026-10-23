import test from 'node:test';
import assert from 'node:assert/strict';
import {outdoorWalkable,scooterWalkable,skateboardWalkable,scooterPathClear,safeOutdoorPoint} from '../shared/outdoor-collision.mjs';
import {sceneWalkable} from '../shared/walkability.mjs';
test('outdoor walking follows foreground pavement and keeps buildings/greenery out',()=>{
 for(const scene of ['street','campus']){
  assert(outdoorWalkable(scene,580,330));assert(outdoorWalkable(scene,20,330));assert(outdoorWalkable(scene,620,330));
  assert.equal(outdoorWalkable(scene,19,330),false);assert.equal(outdoorWalkable(scene,621,330),false);
  assert.equal(outdoorWalkable(scene,320,190),false);
  for(const [x,y] of [[20,330],[320,230],[210,265],[320,190]])assert.equal(sceneWalkable(scene,x,y),outdoorWalkable(scene,x,y));
 }
 assert.equal(outdoorWalkable('street',120,205),false,'bus stop is background');
 assert.equal(outdoorWalkable('campus',30,220),false,'left greenery');
 assert(outdoorWalkable('campus',320,220),'central pavement');
});
test('full scooter and board footprints stop before their visible extremities clip',()=>{
 assert(outdoorWalkable('street',30,285));assert.equal(scooterWalkable(30,285),false);
 assert(scooterWalkable(56,233));assert(scooterWalkable(584,345));assert.equal(scooterWalkable(585,330),false);
 assert.equal(skateboardWalkable(230,265,0),false,'deck tip hits cone while center is outside cone');
 assert.equal(outdoorWalkable('campus',210,265),false,'cone also blocks authoritative walking');
 assert(skateboardWalkable(320,310,0));assert(skateboardWalkable(320,310,Math.PI/2));
 assert.equal(skateboardWalkable(320,347,0),false,'board center must also pass authoritative presence validation');
 assert(scooterPathClear(100,285,500,285));assert.equal(scooterPathClear(100,285,610,285),false);
});
test('old outdoor saves and parked vehicles recover to valid reachable ground',()=>{
 for(const [scene,x,y,mode] of [['street',610,190,'scooter'],['campus',210,265,'walk'],['campus',30,220,'walk'],['street',320,190,'walk']]){
  const at=safeOutdoorPoint(scene,x,y,mode);assert(mode==='scooter'?scooterWalkable(...at):outdoorWalkable(scene,...at));
 }
});
