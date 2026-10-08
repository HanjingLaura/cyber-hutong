export type NpcReaction = { id: string; npc: string; scene: string; x: number; y: number; text: string; started: number; expires: number };
const reactions = new Map<string, NpcReaction>();
let serverClock: number | null = null, localAt = 0;
const serverNow = () => serverClock === null ? Date.now() : serverClock + performance.now() - localAt;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function receiveNpcFeedback(list: NpcReaction[], clock?: number) {
  // HTTP acknowledgments and SSE updates can arrive out of order. Rendering
  // time must never rewind; retain the newest marker even after it expires.
  if (clock && (serverClock === null || clock > serverNow())) { serverClock = clock; localAt = performance.now(); }
  for (const reaction of list) {
    const old = reactions.get(reaction.npc);
    if (!old || reaction.started >= old.started) reactions.set(reaction.npc, reaction);
  }
}
export function clearNpcFeedback() { reactions.clear(); serverClock = null; localAt = 0; }
export function npcFeedback(id: string) {
  const reaction = reactions.get(id);
  if (!reaction || reaction.expires <= serverNow()) return null;
  return { reaction, elapsed: Math.max(0, serverNow() - reaction.started) };
}
export function npcPose(id: string) {
  const feedback = npcFeedback(id);
  const idle = { x: 0, y: 0, angle: 0 };
  if (!feedback || feedback.elapsed > 2400 || reducedMotion()) return idle;
  const t = feedback.elapsed / 2400, fade = Math.min(1, t * 10, (1 - t) * 8);
  const beat = Math.sin(t * Math.PI * 8) * fade;
  if (id === 'buzz') return { x: 0, y: -14 * Math.sin(t * Math.PI), angle: -4 * beat };
  if (id === 'lulu') return { x: 6 * beat, y: -2 * Math.abs(beat), angle: 5 * beat };
  if (id === 'tutu') return { x: 0, y: -8 * Math.abs(beat), angle: 3 * beat };
  if (id === 'zhu') return { x: 2 * beat, y: 0, angle: 6 * beat };
  if (id === 'ferret') return { x: 5 * beat, y: -3 * Math.abs(beat), angle: 8 * beat };
  return { x: 0, y: -3 * Math.abs(beat), angle: 3 * beat };
}

// Small transparent pixel drawings, reusing the existing 100ms UI tick.
export function paintNpcFeedback(canvas: HTMLCanvasElement, id: string, height: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, 96, 96);
  const feedback = npcFeedback(id);
  if (!feedback) return;
  const elapsed = reducedMotion() ? 600 : feedback.elapsed;
  if (elapsed > 2400) return;
  const t = elapsed / 2400, rise = Math.round(t * 14), head = 88 - height;
  ctx.globalAlpha = Math.min(1, t * 8 + .2, (1 - t) * 4);
  const rect = (x: number, y: number, w: number, h: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const note = (x: number, y: number) => { rect(x, y, 2, 10, '#657be8'); rect(x + 2, y, 5, 2, '#657be8'); rect(x - 4, y + 8, 6, 3, '#657be8'); };
  const star = (x: number, y: number) => { rect(x - 4, y, 10, 2, '#f2c75c'); rect(x, y - 4, 2, 10, '#f2c75c'); rect(x - 2, y - 2, 6, 6, '#fff1a8'); };
  if (id === 'ani') {
    for (const [x, y] of [[9, head + 18 - rise], [78, head + 26 - rise]]) {
      for (const [row, pattern] of ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'].entries()) {
        for (let col = 0; col < pattern.length; col++) if (pattern[col] === '1') rect(x + col, y + row, 1, 1, '#ed87a2');
      }
    }
  } else if (id === 'buzz') {
    const pulse = 2 + Math.floor(t * 12) % 3;
    rect(41, 82 - 14 * Math.sin(t * Math.PI), 3, pulse * 2, '#ef9346');
    rect(52, 82 - 14 * Math.sin(t * Math.PI), 3, pulse * 2, '#ef9346');
    star(10, head + 20 - rise); star(84, head + 28 - rise);
  } else if (id === 'zhu' || id === 'lulu') {
    if (id === 'zhu') {
      ctx.fillStyle = '#eac769'; ctx.globalAlpha *= .18;
      ctx.beginPath(); ctx.moveTo(42, 0); ctx.lineTo(54, 0); ctx.lineTo(77, 89); ctx.lineTo(19, 89); ctx.fill();
      ctx.globalAlpha = Math.min(1, (1 - t) * 4);
      rect(27, 89, 42, 2, '#f2c75c');
    }
    note(8, head + 22 - rise); note(82, head + 30 - rise);
  } else if (id === 'ferret') {
    for (const [x, y] of [[7, head + 24 - rise], [80, head + 31 - rise]]) {
      rect(x + 2, y, 5, 2, '#d5a137'); rect(x, y + 2, 9, 7, '#f2c75c'); rect(x + 2, y + 9, 5, 2, '#d5a137'); rect(x + 4, y + 3, 1, 5, '#fff1a8');
    }
    star(17, head + 16 - rise);
  } else { star(10, head + 24 - rise); star(84, head + 16 - rise); }
  ctx.globalAlpha = 1;
}
