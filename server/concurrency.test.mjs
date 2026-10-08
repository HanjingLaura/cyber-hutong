import test from 'node:test';
import assert from 'node:assert/strict';
import {runConcurrentLoad} from '../scripts/concurrency-load.mjs';

test('eight concurrent movers and 32 SSE streams keep control and private state isolated',async()=>{
  const result=await runConcurrentLoad({durationMs:2200});
  assert.deepEqual(result.errors,[]);
  assert.equal(result.players,8);assert.equal(result.streams,32);assert.equal(result.controllers,8);
  assert.ok(result.requests>=160,'exercise sustained concurrent rounds, not sequential requests');
  assert.ok(result.minimumUpdatesPerStream>=12,'all viewers must continue receiving movement');
  assert.ok(result.poseEvents>result.worldEvents*3,'movement must use compact poses rather than full personal worlds');
});
