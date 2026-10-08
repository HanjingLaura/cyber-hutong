// Soul-Knight style touch controls: floating left joystick + right context buttons.
// They drive the existing keyboard-based rooms by emitting the same key events, so
// every room and multiplayer rule keeps one input path. Desktop never mounts this.
import './mobile.css';
import { stickVector, knobOffset, stickKeys, contextActions, isTouchDevice } from './input.mjs';

const KEY: Record<string, [string, number]> = { KeyW: ['w', 87], KeyA: ['a', 65], KeyS: ['s', 83], KeyD: ['d', 68], KeyE: ['e', 69], KeyF: ['f', 70], Escape: ['Escape', 27] };
const RADIUS = 56;

function send(code: string, down: boolean) {
  const [key, keyCode] = KEY[code];
  const world = document.querySelector<HTMLElement>('.world');
  if (down && world && document.activeElement !== world && !document.querySelector('dialog[open]')) world.focus({ preventScroll: true });
  const event = new KeyboardEvent(down ? 'keydown' : 'keyup', { key, code, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'keyCode', { get: () => keyCode });
  Object.defineProperty(event, 'which', { get: () => keyCode });
  (world ?? window).dispatchEvent(event);
}

export function touchEnvironment() {
  return isTouchDevice({ coarse: matchMedia('(pointer: coarse)').matches, maxTouchPoints: navigator.maxTouchPoints || 0, finePointer: matchMedia('(any-pointer: fine)').matches && !matchMedia('(pointer: coarse)').matches });
}

export function lockViewport() {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.append(meta); }
  meta.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
  const gameGesture=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('#game,#touch-controls');
  // Lock gestures on gameplay surfaces; account and social panels remain zoomable.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(type, e => {if(gameGesture(e.target))e.preventDefault();}, { passive: false });
  let lastTouch = 0;
  document.addEventListener('touchend', e => { const now = Date.now(); if (now - lastTouch < 320 && gameGesture(e.target)) e.preventDefault(); lastTouch = now; }, { passive: false });
  document.addEventListener('touchmove', e => { if (gameGesture(e.target)) e.preventDefault(); }, { passive: false });
  const keep = () => { if (scrollX || scrollY) scrollTo(0, 0); };
  addEventListener('scroll', keep, { passive: true });
  visualViewport?.addEventListener('resize', () => { document.documentElement.style.setProperty('--vvh', visualViewport!.height + 'px'); keep(); });
}

export function mountTouchControls() {
  if (!touchEnvironment()) return null;
  document.documentElement.classList.add('touch-ui');
  lockViewport();
  const root = document.createElement('div');
  root.id = 'touch-controls';
  root.innerHTML = `<div id="stick-zone" aria-label="移动摇杆"><div id="stick-base"><div id="stick-knob"></div></div></div>
    <div id="touch-actions"><button id="touch-secondary" type="button" hidden></button><button id="touch-primary" type="button"><span>互动</span></button></div>`;
  document.body.append(root);
  const hint=document.createElement('aside');hint.id='orientation-hint';hint.innerHTML='<span>横屏可以看得更清楚</span><button type="button" aria-label="关闭横屏提示">知道了</button>';
  let hintDismissed=false;try{hintDismissed=sessionStorage.getItem('hutong:landscape-hint')==='dismissed';}catch{}
  hint.hidden=hintDismissed;hint.querySelector('button')!.onclick=()=>{hint.hidden=true;try{sessionStorage.setItem('hutong:landscape-hint','dismissed');}catch{}};document.body.append(hint);
  const zone = root.querySelector<HTMLElement>('#stick-zone')!, base = root.querySelector<HTMLElement>('#stick-base')!, knob = root.querySelector<HTMLElement>('#stick-knob')!;
  const primary = root.querySelector<HTMLButtonElement>('#touch-primary')!, secondary = root.querySelector<HTMLButtonElement>('#touch-secondary')!;
  let pointer: number | null = null, origin = { x: 0, y: 0 }, held = new Set<string>();
  const apply = (next: Set<string>) => { for (const k of held) if (!next.has(k)) send(k, false); for (const k of next) if (!held.has(k)) send(k, true); held = next; };
  const release = () => { pointer = null; apply(new Set()); base.classList.remove('active'); knob.style.transform = ''; };
  zone.addEventListener('pointerdown', e => {
    if (pointer !== null) return;
    pointer = e.pointerId; zone.setPointerCapture(e.pointerId);
    const r = zone.getBoundingClientRect(); origin = { x: e.clientX, y: e.clientY };
    base.style.left = (e.clientX - r.left) + 'px'; base.style.top = (e.clientY - r.top) + 'px'; base.classList.add('active');
    e.preventDefault();
  });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== pointer) return;
    const dx = e.clientX - origin.x, dy = e.clientY - origin.y, k = knobOffset(dx, dy, RADIUS);
    knob.style.transform = `translate(${k.x}px,${k.y}px)`;
    apply(stickKeys(stickVector(dx, dy, RADIUS)));
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(type, e => { if ((e as PointerEvent).pointerId === pointer) release(); });
  addEventListener('blur', release); document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
  const tap = (button: HTMLButtonElement) => {
    button.addEventListener('pointerdown', e => { e.preventDefault(); const code = button.dataset.code || 'KeyE'; send(code, true); button.classList.add('pressed'); });
    const up = () => { if (!button.classList.contains('pressed')) return; button.classList.remove('pressed'); send(button.dataset.code || 'KeyE', false); };
    button.addEventListener('pointerup', up); button.addEventListener('pointercancel', up); button.addEventListener('pointerleave', up);
  };
  tap(primary); tap(secondary);
  let last = '';
  const refresh = () => {
    const text = document.querySelector('#guide-action')?.textContent ?? '';
    const modal = !!document.querySelector('dialog[open],#people-panel:not([hidden]),#chat-panel:not([hidden])');
    root.classList.toggle('hidden', modal);
    if (modal && pointer !== null) release();
    if (text !== last) {
      last = text;
      const actions = contextActions(text);
      primary.dataset.code = actions.primary?.code ?? 'KeyE';
      primary.querySelector('span')!.textContent = actions.primary?.label ?? '互动';
      primary.classList.toggle('idle', !actions.primary);
      secondary.hidden = !actions.secondary;
      if (actions.secondary) { secondary.dataset.code = actions.secondary.code; secondary.textContent = actions.secondary.label; }
    }
    requestAnimationFrame(refresh);
  };
  refresh();
  return root;
}
