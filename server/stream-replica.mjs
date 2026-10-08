// One bounded refresh loop per instance, only while long-lived SSE is active.
export function createStreamReplicaSync(replica, { intervalMs = 1000, maxAgeMs = 750, log = console } = {}) {
  let watchers = 0, timer = null, pending = false;
  const pull = async () => {
    if (pending) return;
    pending = true;
    try { await replica.pull({ maxAgeMs }); }
    catch (e) { log.error?.('stream replica pull failed: ' + e.message); }
    finally { pending = false; }
  };
  return function watch() {
    if (++watchers === 1) { timer = setInterval(pull, intervalMs); timer.unref?.(); }
    let released = false;
    return () => {
      if (released) return; released = true;
      if (--watchers === 0) { clearInterval(timer); timer = null; }
    };
  };
}
