import { BehaviorEngine } from '../../examples/mvp-behavior/engine.mjs';

/** Serializes domain updates; DB commit must atomically persist state + outbox.
 * Repository must hold exclusive world ownership for this process. */
export async function createWorldRuntime(repository) {
  const stored = await repository.load();
  let version = stored?.version ?? 0;
  let engine = new BehaviorEngine(stored?.snapshot);
  let queue = Promise.resolve();
  return {
    snapshot: () => engine.snapshot(),
    // Trusted server code supplies update, not HTTP/WS clients.
    update(update) {
      const job = queue.then(async () => {
        const candidate = new BehaviorEngine(engine.snapshot());
        const commands = await update(candidate);
        if (!Array.isArray(commands)) throw new TypeError('Update must return command array');
        const next = await repository.commit({ expectedVersion: version,
          snapshot: candidate.snapshot(), commands: commands.map((payload, index) => ({
            id: `world:${version + 1}:${index}`, payload,
          })) });
        engine = candidate; version = next;
        return { version, snapshot: engine.snapshot() };
      });
      queue = job.catch(() => {});
      return job;
    },
  };
}
