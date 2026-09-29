import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { createTaskPool } from './task-pool.mjs';

test('LLM pool caps concurrency, rejects overload, and recovers failed slots', async () => {
  const run = createTaskPool({ concurrency: 2, maxPending: 8 });
  let active = 0, peak = 0;
  const jobs = Array.from({ length: 10 }, (_, i) => run(async () => {
    active++; peak = Math.max(peak, active);
    await sleep(10); active--;
    if (i === 3) throw new Error('provider failed');
    return i;
  }));
  await assert.rejects(run(() => {}), { status: 429 });
  const result = await Promise.allSettled(jobs);
  assert.equal(peak, 2);
  assert.equal(result.filter(x => x.status === 'fulfilled').length, 9);
  assert.equal(await run(() => 'recovered'), 'recovered');
});

test('expired queued work never invokes the provider', async () => {
  const run = createTaskPool({ concurrency: 1, waitMs: 10 });
  let release, invoked = false;
  const first = run(() => new Promise(resolve => { release = resolve; }));
  await assert.rejects(run(() => { invoked = true; }), { status: 429 });
  release(); await first;
  assert.equal(invoked, false);
});

test('chain cancellation removes queued work immediately and releases capacity', async () => {
  const run = createTaskPool({ concurrency: 1, maxPending: 1, waitMs: 8000 });
  let release, invoked = false;
  const first = run(() => new Promise(resolve => { release = resolve; }));
  const controller = new AbortController();
  const queued = run(() => { invoked = true; }, { signal: controller.signal });
  controller.abort();
  await assert.rejects(queued, { name: 'AbortError' });
  const replacement = run(() => 'replacement');
  release(); await first;
  assert.equal(await replacement, 'replacement');
  assert.equal(invoked, false);
});
