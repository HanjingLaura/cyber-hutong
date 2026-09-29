import { pointInPolygon } from './geometry.mjs';

export function reconcileStep(point, authority, dt) {
  const seconds = Math.min(0.05, Math.max(0, dt));
  const distance = Math.hypot(authority.x - point.x, authority.y - point.y);
  const t = Math.min(1 - Math.exp(-seconds * 14), distance ? 112 * seconds / distance : 1);
  return { ...point, x: point.x + (authority.x - point.x) * t, y: point.y + (authority.y - point.y) * t };
}

export function mergeActorSnapshots(previous, next, reset = false) {
  if (reset) return next;
  const byId = new Map(previous.map(actor => [actor.id, actor]));
  return next.map(actor => {
    const old = byId.get(actor.id);
    return old && (actor.inputSeq ?? 0) < (old.inputSeq ?? 0) ? old : actor;
  });
}

// Client prediction uses the same footprint and axis sliding as the server.
export function predictStep(point, direction, dt, polygon, speed = 112, radius = 10) {
  const length = Math.hypot(direction.x, direction.y);
  if (!length) return { ...point };
  const step = Math.max(0, Math.min(dt, 0.05)) * speed;
  const nx = point.x + direction.x / length * step, ny = point.y + direction.y / length * step;
  const allowed = (x, y) => [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]]
    .every(([dx, dy]) => pointInPolygon(x + dx, y + dy, polygon));
  if (allowed(nx, ny)) return { ...point, x: nx, y: ny };
  if (allowed(nx, point.y)) return { ...point, x: nx };
  if (allowed(point.x, ny)) return { ...point, y: ny };
  return { ...point };
}

// Render a short, bounded history instead of restarting an easing on every packet.
// Timestamps use the receiving browser's monotonic clock, never mixed wall clocks.
export function createMotionBuffer(delay = 100) {
  const tracks = new Map();
  return {
    settle(actor, now) {
      tracks.set(actor.id, [{ ...actor, at: now }]);
    },
    push(actors, now, reset = false) {
      const live = new Set(actors.map(actor => actor.id));
      for (const id of tracks.keys()) if (!live.has(id)) tracks.delete(id);
      for (const actor of actors) {
        let history = tracks.get(actor.id) || [];
        const previous = history.at(-1);
        if (reset || previous?.scene !== actor.scene || previous?.pose !== actor.pose ||
            (previous && Math.hypot(previous.x - actor.x, previous.y - actor.y) > 160)) history = [];
        const sample = { ...actor, at: now };
        if (history.at(-1)?.at === now) history[history.length - 1] = sample;
        else history.push(sample);
        tracks.set(actor.id, history.slice(-32));
      }
    },
    sample(id, now) {
      const history = tracks.get(id);
      if (!history?.length) return null;
      const time = now - delay;
      if (time <= history[0].at) return { ...history[0] };
      for (let i = 1; i < history.length; i++) {
        const a = history[i - 1], b = history[i];
        if (b.at < time) continue;
        const t = (time - a.at) / (b.at - a.at);
        return { ...b, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
      return { ...history.at(-1) };
    },
  };
}
