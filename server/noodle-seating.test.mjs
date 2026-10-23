import test from 'node:test';
import assert from 'node:assert/strict';
import geometry from '../shared/interactions.json' with {type:'json'};
import {sceneWalkable} from '../shared/walkability.mjs';
test('eight seats preserve old anchors and have reachable approaches',()=>{
 const seats=Object.values(geometry.noodle.seats);assert.equal(seats.length,8);
 assert.deepEqual(seats.slice(0,4).map(s=>s.at),[[179,286],[247,286],[405,286],[473,286]]);
 for(const seat of seats)assert.equal(sceneWalkable('noodle',...seat.approach),true);
 assert.equal(seats[4].facing,0);
});
