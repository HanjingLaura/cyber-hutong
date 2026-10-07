// Pure helpers for touch controls (no DOM) — shared by the game and node tests.

/** Joystick vector from finger offset. Returns {x,y} in [-1,1], 0 inside the dead zone. */
export function stickVector(dx, dy, radius, deadZone = 0.22) {
  const len = Math.hypot(dx, dy);
  if (!radius || len < radius * deadZone) return { x: 0, y: 0, magnitude: 0 };
  const clamped = Math.min(len, radius);
  const scaled = (clamped / radius - deadZone) / (1 - deadZone);
  return { x: dx / len * scaled, y: dy / len * scaled, magnitude: scaled };
}

/** Knob position clamped to the base circle. */
export function knobOffset(dx, dy, radius) {
  const len = Math.hypot(dx, dy);
  if (len <= radius || !len) return { x: dx, y: dy };
  return { x: dx / len * radius, y: dy / len * radius };
}

/** Which movement keys to hold for a stick vector (8 directions, ~22.5° wedges). */
export function stickKeys(v, threshold = 0.38) {
  const keys = new Set();
  if (!v.magnitude) return keys;
  const len = Math.hypot(v.x, v.y) || 1, nx = v.x / len, ny = v.y / len;
  if (nx > threshold) keys.add('KeyD');
  if (nx < -threshold) keys.add('KeyA');
  if (ny > threshold) keys.add('KeyS');
  if (ny < -threshold) keys.add('KeyW');
  return keys;
}

const KEY_TOKEN = /(?:^|[\s·，,])(?:按\s*)?([EF])(?:\s*\/\s*Esc)?(?=\s|·|$|[\u4e00-\u9fa5])/;

/** Map the room's guide text (e.g. "E · 接一瓶水", "E / Esc 起身 · F 开关隔间门") to touch buttons. */
export function contextActions(text) {
  const result = { primary: null, secondary: null };
  if (!text) return result;
  for (const raw of String(text).split(/[·，,；;]/)) {
    const part = raw.trim();
    const match = part.match(KEY_TOKEN) || part.match(/^([EF])\b/);
    if (!match) continue;
    const key = match[1];
    let label = part.replace(/^.*?(?:按\s*)?[EF](?:\s*\/\s*Esc)?\s*/, '').replace(/^·\s*/, '').trim();
    label = label.replace(/[。.!！]+$/, '');
    if (!label) label = key === 'E' ? '互动' : '操作';
    if (/^靠近/.test(part) && key === 'E') label = label || '互动';
    const entry = { code: key === 'E' ? 'KeyE' : 'KeyF', label: label.slice(0, 8) };
    if (key === 'E' && !result.primary) result.primary = entry;
    else if (key === 'F' && !result.secondary) result.secondary = entry;
  }
  // Labels like "E · 使用跑步机" put the action in the next segment.
  if (result.primary && /^(互动)$/.test(result.primary.label)) {
    const parts = String(text).split('·').map(s => s.trim());
    const i = parts.findIndex(p => /^(?:按\s*)?E(?:\s*\/\s*Esc)?$/.test(p));
    if (i >= 0 && parts[i + 1] && !/[EF]\b/.test(parts[i + 1])) result.primary.label = parts[i + 1].slice(0, 8);
  }
  return result;
}

/** Touch-first device (phones/tablets), independent of window size. */
export function isTouchDevice(env) {
  return !!(env.coarse || (env.maxTouchPoints > 0 && !env.finePointer));
}
