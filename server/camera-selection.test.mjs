import test from 'node:test';
import assert from 'node:assert/strict';
import {cropRect} from '../src/camera-selection.mjs';

test('scene photo crop handles both drag directions and fractional pixel edges',()=>{
 assert.deepEqual(cropRect({x:30.5,y:40.2},{x:220.1,y:180.8},640,360),{x:30,y:40,width:191,height:141});
 assert.deepEqual(cropRect({x:220.1,y:180.8},{x:30.5,y:40.2},640,360),{x:30,y:40,width:191,height:141});
});
test('scene photo crop clips selection to the actual scene and rejects empty or tiny regions',()=>{
 assert.deepEqual(cropRect({x:-60,y:-10},{x:900,y:500},640,360),{x:0,y:0,width:640,height:360});
 for(const end of [{x:10,y:10},{x:12,y:40},{x:40,y:12},{x:NaN,y:100}])assert.equal(cropRect({x:10,y:10},end,640,360),null);
 assert.equal(cropRect({x:10,y:10},{x:20,y:20},0,360),null);
});
