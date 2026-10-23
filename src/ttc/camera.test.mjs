import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clampCamera,worldPoint,dragCamera} from './camera.mjs';
test('pan bounds prevent empty edges and retain correct target coordinates',()=>{
 assert.equal(clampCamera(-5,2160),0);assert.equal(clampCamera(9999,2160),880);
 assert.equal(clampCamera(60,1280),0);
 assert.deepEqual(worldPoint(200,300,880),{x:1080,y:300});
});
test('touch and desktop drags scale into the same world distance',()=>{
 assert.equal(dragCamera(0,800,400,1280,2160),400);
 assert.equal(dragCamera(0,200,100,320,2160),400);
 assert.equal(dragCamera(800,200,-300,320,2160),880);
});
