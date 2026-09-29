// Per-process admission control. World ticks never wait for this LLM pool.
export function createTaskPool({ concurrency = 2, maxPending = 8, waitMs = 8000 } = {}) {
  let active = 0;
  const pending = [];
  const busy = () => Object.assign(new Error('对话繁忙，请稍后再试'), { status: 429 });
  function drain() {
    while (active < concurrency && pending.length) {
      const entry = pending.shift();
      clearTimeout(entry.timer);
      entry.cleanup();
      active++;
      Promise.resolve().then(entry.job).then(entry.resolve, entry.reject).finally(() => { active--; drain(); });
    }
  }
  return function run(job, { signal } = {}) {
    if (signal?.aborted) return Promise.reject(signal.reason);
    if (active >= concurrency && pending.length >= maxPending) return Promise.reject(busy());
    return new Promise((resolve, reject) => {
      const entry = { job, resolve, reject };
      const cancel = () => {
        const index = pending.indexOf(entry);
        if (index < 0) return;
        pending.splice(index, 1);
        clearTimeout(entry.timer);
        entry.cleanup();
        reject(signal.reason);
      };
      entry.cleanup = () => signal?.removeEventListener('abort', cancel);
      entry.timer = setTimeout(() => {
        const index = pending.indexOf(entry);
        if (index >= 0) { pending.splice(index, 1); entry.cleanup(); reject(busy()); }
      }, waitMs);
      pending.push(entry);
      signal?.addEventListener('abort', cancel, { once: true });
      drain();
    });
  };
}
