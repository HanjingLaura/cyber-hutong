import test from 'node:test';
import assert from 'node:assert/strict';
import { createStreamReplicaSync } from './stream-replica.mjs';

test('32 streams share one refresh loop; slow pulls do not overlap and cleanup stops it', async t => {
  let tick, starts = 0, stops = 0, reads = 0, resolve;
  t.mock.method(globalThis, 'setInterval', callback => { tick = callback; starts++; return { unref() {} }; });
  t.mock.method(globalThis, 'clearInterval', () => { stops++; });
  const watch = createStreamReplicaSync({ pull({ maxAgeMs }) { assert.equal(maxAgeMs, 750); reads++; return new Promise(r => { resolve = r; }); } });
  assert.equal(starts, 0);
  const releases = Array.from({ length: 32 }, () => watch());
  assert.equal(starts, 1);
  const pending = tick(); await tick(); await tick(); assert.equal(reads, 1);
  resolve(); await pending;
  releases.slice(0, 31).forEach(release => release()); assert.equal(stops, 0);
  releases[31](); releases[31](); assert.equal(stops, 1, 'last release stops the shared loop once');
  const release = watch(); assert.equal(starts, 2, 'a reconnect can restart the loop'); release();
});

test('a transient refresh failure is contained and the next tick recovers', async t => {
  let tick, attempts = 0, failures = 0;
  t.mock.method(globalThis, 'setInterval', callback => { tick = callback; return { unref() {} }; });
  t.mock.method(globalThis, 'clearInterval', () => {});
  const watch = createStreamReplicaSync({ async pull() { if (++attempts === 1) throw Error('offline'); } }, { log: { error() { failures++; } } });
  const release = watch(); await tick(); await tick(); release();
  assert.equal(attempts, 2); assert.equal(failures, 1);
});
