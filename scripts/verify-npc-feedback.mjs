import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer as createViteServer } from 'vite';
import { createMvpServer } from '../server/app.mjs';
import { loadPlaywright } from './playwright.mjs';
import rules from '../shared/npcs.json' with { type: 'json' };
import positions from '../shared/guests.json' with { type: 'json' };
import geometry from '../shared/interactions.json' with { type: 'json' };
import lines from '../shared/npc-feedback.json' with { type: 'json' };
const { chromium } = loadPlaywright();
const app = createMvpServer({ dbPath: ':memory:', llmOptions: { key: '' } });
await new Promise(r => app.server.listen(0, '127.0.0.1', r));
const vite = await createViteServer({ server: { port: 5196, strictPort: true, host: '127.0.0.1', proxy: { '/api': { target: 'http://127.0.0.1:' + app.server.address().port } } } });
await vite.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-webgl'] });
const origin = 'http://127.0.0.1:5196', accounts = new Map(), errors = [], replies = [];
let checking, activeOwner;
try {
 await mkdir('output/playwright', { recursive: true });
 for (const role of ['laura', ...rules.map(r => r.owner)]) accounts.set(role, await app.store.register('feedback_' + role, 'feedback-fixture-password', role));
 async function client(role, scene, x, y) {
  // Seed before opening the client: no previous scene's in-flight presence can
  // race the fixture's initial position. Room transitions are tested separately.
  app.autonomy.reclaim(accounts.get(role).user.id);
  app.players.set(accounts.get(role).user.id, { id: accounts.get(role).user.id, role, scene, x, y, facing: 0, seat: null, activity: 'walk', moving: false, at: Date.now() });
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  await context.addCookies([{ name: 'hutong_session', value: accounts.get(role).token, url: origin }]);
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  page.on('response', async response => { if(new URL(response.url()).pathname.replace(/\/$/,'') === '/api/npc') replies.push({role,status:response.status(),body:await response.json()}); });
  await page.goto(origin); await page.waitForFunction(scene => window.__socialPreview?.getState().connected && window.__socialPreview.bridge.state()?.scene === scene && !window.__socialPreview.bridge.transitioning, scene);
  return { context, page };
 }
 const result = [];
 for (const rule of rules) {
  const point = positions[rule.id];
  const [x, y] = rule.id === 'ani' ? geometry.hutong.seats.L1.approach : [point.x + 28, point.y + 5];
  const owner = await client(rule.owner, rule.room, x, y);
  checking=rule.id;activeOwner=owner;console.log('Checking',rule.id);
  const observer = await client('laura', rule.room, point.x + 55, point.y + 12);
  if (rule.id === 'ani') { await owner.page.locator('.world').focus(); await owner.page.keyboard.press('e'); await owner.page.waitForFunction(() => window.__hutongPreview.getState().seatedAt === 'L1'); }
  await owner.page.waitForFunction(() => !document.querySelector('#npc-interact').hidden);
  await owner.page.locator('#npc-interact').click();
  for (const page of [owner.page, observer.page]) await page.waitForFunction(text => document.querySelector('.npc-speech')?.textContent === text, lines[rule.id].text);
  await observer.page.waitForFunction(id => { const c = document.querySelector(`.npc-effect[data-npc="${id}"]`); return c && c.getContext('2d').getImageData(0, 0, 96, 96).data.some((v, i) => i % 4 === 3 && v > 0); }, rule.id);
  const motion = await owner.page.evaluate(async id => {
   const state = () => id === 'ani' ? window.__aniPreview.getState() : window.__easterEggPreview.getState().find(n => n.id === id && n.active);
   const first = state(), bubble = document.querySelector('.npc-speech'); let moved = false;
   for (let i = 0; i < 8; i++) { await new Promise(r => setTimeout(r, 50)); const next = state(); if (id === 'ani') moved ||= Math.abs(window.__socialPreview.bridge.active.aniGuest.image.y - first.screen.y) > .1; else moved ||= Math.hypot(next.x - first.x, next.y - first.y) > .1; }
   return { moved, stableBubble: document.querySelector('.npc-speech') === bubble };
  }, rule.id);
  assert.ok(motion.moved, rule.id + ' actual sprite moves'); assert.ok(motion.stableBubble, 'bubble is not recreated every tick');
  await observer.page.screenshot({ path: `output/playwright/feedback-${rule.id}.png` });
  if (rule.id === 'ani') {
   await owner.page.locator('.world').focus(); await owner.page.keyboard.press('v'); await owner.page.waitForFunction(() => window.__hutongPreview.getState().view === 'opposite');
   assert.equal(await owner.page.locator('.npc-speech').innerText(), lines.ani.text);
   await owner.page.screenshot({ path: 'output/playwright/feedback-ani-reverse.png' });
  }
  if (rule.id === 'ferret') {
   await observer.page.emulateMedia({ reducedMotion: 'reduce' }); await observer.page.setViewportSize({ width: 375, height: 812 });
   await observer.page.waitForTimeout(150);
   const pose = await observer.page.evaluate(() => window.__easterEggPreview.getState().find(n => n.id === 'ferret' && n.active));
   assert.equal(pose.x, point.x); assert.equal(pose.y, point.y);
   await observer.page.screenshot({ path: 'output/playwright/feedback-mobile-reduced-motion.png' });
  }
  await owner.page.waitForFunction(() => document.querySelectorAll('.npc-speech,.npc-effect').length === 0);
  assert.equal(app.life.journal(accounts.get(rule.owner).user.id).filter(e => e.kind === 'easter').length, 1);
  result.push({ npc: rule.id, owner: rule.owner, sharedSpeech: true, pixelsDrawn: true, spriteMotion: true, expires: true });
  await owner.context.close();
  await observer.context.close();
 }
 assert.equal(app.life.journal(accounts.get('laura').user.id).filter(e => e.kind === 'easter').length, 0);
 assert.deepEqual(errors, []); console.log(JSON.stringify({ cases: result, reverseView: true, reducedMotion: true, mobile: true }));
} catch(error) {
 console.log(JSON.stringify({checking,replies,errors,state:activeOwner?await activeOwner.page.evaluate(()=>({player:window.__socialPreview.bridge.state(),body:document.body.innerText.slice(-1000)})):null}));
 if(activeOwner)await activeOwner.page.screenshot({path:'output/playwright/feedback-failure.png'});
 throw error;
} finally { await browser.close(); await vite.close(); app.close(); }
