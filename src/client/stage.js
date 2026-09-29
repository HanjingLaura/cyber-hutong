import { loadGuestSheet, loadSheet } from "./portraits.js";
import { heightAt, hutongPoint, hutongFacing } from "./shared/hutong.mjs";
import { pointInPolygon } from "./shared/geometry.mjs";
import { guestSprites, scenes } from "./shared/scenes.mjs";
import { createMotionBuffer, predictStep, reconcileStep } from "./shared/motion.mjs";

const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const sceneNames = {
  hutong: "胡同",
  rest_area: "休息区",
  elevator: "电梯间",
  restroom: "厕所",
  popmart: "POP MART",
  concert: "演唱会",
  hawaii: "Hawaii",
  gym: "健身房",
  mixian: "米线店",
};

export function mountStage({ canvas, hint, request, meId, onTalk, chatOpen, place, notice, manual = () => true }) {
  const ctx = canvas.getContext("2d");
  let reverse = false;
  const viewButton = document.createElement("button");
  viewButton.type = "button";
  viewButton.className = "view-switch";
  viewButton.textContent = "换个视角";
  viewButton.setAttribute("aria-pressed", "false");
  viewButton.onclick = () => {
    reverse = !reverse;
    viewButton.setAttribute("aria-pressed", String(reverse));
    keys.clear();
    lastSent = "";
    if (control) send({ type: "stop" });
    mark = null;
    canvas.focus();
  };
  canvas.parentElement.append(viewButton);
  const reversed = () => reverse && actors.find(actor => actor.id === meId)?.scene === "hutong";
  const sheets = new Map();
  const motion = createMotionBuffer();
  let predicted = null;
  let previousFrame = 0;
  let lastSnapshot = 0;
  let moveInFlight = false;
  let stopSeq = Infinity;
  const speech = new Map();
  const spoken = new Set();
  const speechLayer = document.createElement("div");
  speechLayer.className = "speech-layer";
  speechLayer.setAttribute("aria-live", "polite");
  canvas.parentElement.append(speechLayer);
  function speak({ actorId, text, id, source }) {
    if (!actorId || !text || (id && spoken.has(id))) return;
    if (id) { spoken.add(id); if (spoken.size > 128) spoken.delete(spoken.values().next().value); }
    speech.get(actorId)?.element.remove();
    const element = document.createElement("div");
    element.className = "actor-speech";
    const name = document.createElement("strong");
    name.textContent = (actors.find(actor => actor.id === actorId)?.name || actorId) + (source === "llm" ? " · 自动回复" : "");
    const body = document.createElement("p");
    body.textContent = text;
    element.append(name, body);
    element.hidden = true;
    speechLayer.append(element);
    speech.set(actorId, { element, until: performance.now() + Math.min(16000, Math.max(5000, text.length * 140)) });
  }
  let actors = [];
  let leaseId = null;
  let control = false;
  let seq = 0;
  let tabId = sessionStorage.getItem("hutong-tab");
  if (!tabId) {
    tabId = crypto.randomUUID();
    sessionStorage.setItem("hutong-tab", tabId);
  }
  const keys = new Set();
  let lastSent = "";
  let stopped = false;
  let choosing = false;
  let recovering = false;
  let mark = null;
  const failed = new Set();
  const base = document.documentElement.dataset.base || "";
  const backgrounds = new Map();
  const chairs = {};
  for (const side of ["front", "back"]) {
    const file = `prop-black-office-chair${side === "back" ? "-back" : ""}-green-512.png`;
    loadGuestSheet(base + "/props/" + file, [[0, 0, 512, 512]])
      .then(sheet => { chairs[side] = sheet.front; }).catch(() => report("椅子素材没有加载出来"));
  }
  function backgroundFor(scene) {
    const config = scenes[scene] || scenes.hutong;
    const source = config.views?.[reverse ? 1 : 0].background || config.background;
    if (!backgrounds.has(source)) {
      const image = new Image();
      image.addEventListener("error", () => failed.add(source));
      image.addEventListener("load", () => failed.delete(source));
      image.src = base + source;
      image.dataset.source = source;
      backgrounds.set(source, image);
    }
    return backgrounds.get(source);
  }
  for (const id of ["suki", "franco", "sid", "jilly", "laura", "kay", "cora", "amber"]) {
    loadSheet(id).then((sheet) => { if (sheet) sheets.set(id, sheet); })
      .catch(() => report("人物素材没有加载出来，请刷新重试"));
  }
  for (const [id, info] of Object.entries(guestSprites)) {
    loadGuestSheet(base + "/npcs/" + info.file, info.frames).then((sheet) => {
      if (sheet) sheets.set(id, sheet);
    }).catch(() => report("来访角色素材没有加载出来，请刷新重试"));
  }

  function typing() {
    const el = document.activeElement;
    return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  }
  function onKey(e) {
    const move = { KeyW: "up", KeyA: "left", KeyS: "down", KeyD: "right", ArrowUp: "up", ArrowLeft: "left", ArrowDown: "down", ArrowRight: "right" };
    if (e.type === "keyup" && move[e.code]) {
      keys.delete(move[e.code]);
      pumpKeys(performance.now());
      return;
    }
    if (!control || typing() || !manual()) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
    if (e.type === "keydown" && e.key === "Escape") {
      keys.clear();
      if (choosing) closeChoices();
      else send({ type: "stop" });
      return;
    }
    if (move[e.code]) {
      if (e.type === "keydown") keys.add(move[e.code]);
      pumpKeys(performance.now());
    }
    if (e.type === "keydown" && e.key.toLowerCase() === "e" && !e.repeat) interact();
  }
  function onClick(e) {
    if (!control || chatOpen() || !manual()) return;
    predicted = null;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1280;
    const y = ((e.clientY - rect.top) / rect.height) * 720;
    if (x < 0 || y < 0 || x > 1280 || y > 720) return;
    send({ type: "path", target: hutongPoint({ x, y }, reversed()) });
    mark = { x, y, until: performance.now() + 1400 };
  }
  document.addEventListener("keydown", onKey);
  document.addEventListener("keyup", onKey);
  canvas.addEventListener("click", onClick);
  function onBlur() { keys.clear(); lastSent = ""; if (control) send({ type: "stop" }); }
  window.addEventListener("blur", onBlur);

  async function join() {
    const r = await request("/api/world/join", { tabId });
    if (!r.ok) {
      hint.hidden = false;
      hint.textContent = r.body.error || "进不了胡同";
      return;
    }
    control = r.body.control;
    leaseId = r.body.leaseId;
    seq = r.body.seq || 0;
    apply(r.body.actors, true);
    hint.hidden = control;
    if (!control) hint.textContent = "这个角色正在另一个窗口里。";
  }
  async function send(intent) {
    if (!leaseId) return;
    if (intent.type === "move" && moveInFlight) return;
    if (intent.type === "move") moveInFlight = true;
    let r;
    const inputSeq = ++seq;
    if (intent.type === "stop") stopSeq = inputSeq;
    if (intent.type === "move") stopSeq = Infinity;
    try { r = await request("/api/world/intent", { seq: inputSeq, leaseId, intent }); }
    finally { if (intent.type === "move") moveInFlight = false; }
    if (r.status === 409) {
      if (r.body.code === "manual") {
        report(r.body.error || "托管中，先切回手动");
        return r;
      }
      if (r.body.code === "taken") {
        control = false;
        keys.clear();
        hint.hidden = false;
        hint.textContent = r.body.error || "这个角色正在另一个窗口里。";
        return r;
      }
      if (r.body.code === "expired" && !recovering) {
        recovering = true;
        keys.clear();
        if (intent.type !== "renew") report("操作中断了，正在恢复");
        await join();
        recovering = false;
        if (control && intent.type !== "renew") return send(intent);
        return r;
      }
    }
    if (!r.ok && (intent.type === "path" || intent.type === "travel")) {
      report(r.body.error || "那里走不过去");
      if (intent.type === "travel") closeChoices();
    }
    if (r.ok && intent.type === "path" && r.body.path === 0) report("那里走不过去");
    if (r.ok && intent.type === "interact") {
      if (r.body.action === "talk") onTalk(r.body.peerId);
      if (r.body.action === "speech") speak({ actorId: r.body.actorId, text: r.body.text });
      if (r.body.action === "choose") showChoices(r.body.choices);
    }
    if (r.ok && intent.type === "travel") closeChoices();
  }
  async function interact() {
    if (chatOpen()) return;
    await send({ type: "interact" });
  }
  function apply(next, snap) {
    motion.push(next, performance.now(), snap);
    lastSnapshot = performance.now();
    const mine = next.find(actor => actor.id === meId);
    if (snap || !mine || mine.scene !== predicted?.scene || mine.pose === "sit") predicted = null;
    actors = next;
  }
  let dirTimer = 0;
  function pumpKeys(now) {
    const paused = !control || typing() || chatOpen() || !manual();
    if (paused) {
      if (keys.size || lastSent) {
        keys.clear();
        lastSent = "";
        if (control && leaseId) send({ type: "stop" });
      }
      return;
    }
    if (now - dirTimer < 80) return;
    const dir = direction();
    const signature = dir ? `${dir.x},${dir.y}` : "";
    if (signature === lastSent && !dir) return;
    lastSent = signature;
    dirTimer = now;
    if (dir) send({ type: "move", dir: reversed() ? { x: -dir.x, y: -dir.y } : dir });
    else send({ type: "stop" });
  }
  function loop(now) {
    if (stopped) return;
    pumpKeys(now);
    try { draw(now); }
    catch (error) { window.__stageError = String(error && error.stack || error); }
    requestAnimationFrame(loop);
  }
  function direction() {
    const x = (keys.has("right") ? 1 : 0) - (keys.has("left") ? 1 : 0);
    const y = (keys.has("down") ? 1 : 0) - (keys.has("up") ? 1 : 0);
    if (!x && !y) return null;
    const length = Math.hypot(x, y);
    return { x: x / length, y: y / length };
  }
  function showChoices(choices) {
    choosing = true;
    hint.hidden = false;
    hint.replaceChildren();
    for (const choice of choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = choice.label;
      button.onclick = () => send({ type: "travel", scene: choice.scene });
      hint.append(button);
    }
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "取消";
    cancel.onclick = () => closeChoices();
    hint.append(cancel);
  }
  function closeChoices() {
    choosing = false;
    hint.replaceChildren();
    hint.hidden = true;
  }
  function exitHere(actor) {
    const here = scenes[actor.scene] || scenes.hutong;
    return here.exits?.find((item) => pointInPolygon(actor.x, actor.y, item.area)) || null;
  }
  function report(text) {
    if (!notice || !text) return;
    notice.hidden = false;
    const line = document.createElement("p");
    line.textContent = text;
    notice.append(line);
    while (notice.querySelectorAll("p").length > 3) notice.querySelector("p").remove();
    setTimeout(() => { line.remove(); if (!notice.childElementCount) notice.hidden = true; }, 4500);
  }
  function draw(now) {
    const dt = previousFrame ? (now - previousFrame) / 1000 : 0;
    previousFrame = now;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 1280, 720);
    const mine = actors.find((actor) => actor.id === meId);
    const scene = scenes[mine?.scene] || scenes.hutong;
    viewButton.hidden = scene.id !== "hutong";
    const background = backgroundFor(scene.id);
    if (background.complete && background.naturalWidth) ctx.drawImage(background, 0, 0, 1280, 720);
    const sprites = [];
    for (const actor of actors) {
      if (actor.scene !== scene.id) continue;
      let renderedActor = motion.sample(actor.id, now) || actor;
      const input = direction();
      if (actor.id === meId && control && manual() && !typing() && !chatOpen() && input && now - lastSnapshot < 650) {
        const dir = reversed() ? { x: -input.x, y: -input.y } : input;
        if (!predicted) {
          const seat = scene.seats?.find(item => item.owner === meId);
          predicted = { ...actor, ...(actor.pose === "sit" && seat ? seat.stand : {}) };
        }
        // Network authority wins on large corrections; normal local input renders immediately.
        if (Math.hypot(predicted.x - actor.x, predicted.y - actor.y) > 72) predicted = { ...actor };
        predicted = predictStep(predicted, dir, dt, scene.walkable);
        renderedActor = { ...actor, ...predicted, pose: "stand", moving: true,
          facing: Math.abs(dir.x) > Math.abs(dir.y) ? (dir.x > 0 ? "right" : "left") : (dir.y > 0 ? "down" : "up") };
      } else if (actor.id === meId && predicted && now - lastSnapshot < 650 && control && manual()) {
        // A stale idle snapshot is not a stop acknowledgement. Only reconcile after
        // the server confirms the actual stop input, and blend the small correction.
        if (!direction() && actor.inputSeq >= stopSeq && !actor.moving) {
          predicted = reconcileStep(predicted, actor, dt);
        }
        renderedActor = { ...actor, x: predicted.x, y: predicted.y, moving: false };
        if (!direction() && actor.inputSeq >= stopSeq && Math.hypot(predicted.x - actor.x, predicted.y - actor.y) < 0.5) {
          // Do not hand off to an older, deliberately delayed interpolation frame.
          motion.settle(actor, now);
          predicted = null;
        }
      } else if (actor.id === meId) predicted = null;
      sprites.push(renderedActor);
    }
    const rendered = sprites.map(actor => ({ ...actor, ...hutongPoint(actor, reversed()), facing: hutongFacing(actor.facing, reversed()) }));
    const foreground = reversed() ? [{ x: 147, y: 448, w: 988, h: 146, depth: 475 }] : scene.foreground || [];
    const layers = [
      ...foreground.map((item) => ({ kind: "front", ...item })),
      ...rendered.map((actor) => ({ kind: "actor", depth: actor.y, actor })),
      ...(scene.id === "hutong" ? scene.seats.map(seat => {
        const point = hutongPoint(seat.sit, reversed());
        const back = hutongFacing(seat.facing, reversed()) === "up";
        return { kind: "chair", ...point, back, depth: point.y + (back ? 1 : -1) };
      }) : []),
    ].sort((a, b) => a.depth - b.depth);
    for (const layer of layers) {
      if (layer.kind === "front") {
        if (background.complete && background.naturalWidth) ctx.drawImage(background, layer.x, layer.y, layer.w, layer.h, layer.x, layer.y, layer.w, layer.h);
      } else if (layer.kind === "chair") {
        const pose = chairs[layer.back ? "back" : "front"];
        if (pose) {
          const h = 100, w = pose.width / pose.height * h;
          ctx.drawImage(pose.source, pose.left, pose.top, pose.width, pose.height,
            Math.round(layer.x - w / 2), Math.round(layer.y + (layer.back ? 48 : 12) - h), Math.round(w), h);
        }
      } else drawActor(layer.actor, now);
    }
    for (const [id, bubble] of speech) {
      if (now > bubble.until) { bubble.element.remove(); speech.delete(id); continue; }
      const actor = rendered.find(item => item.id === id);
      bubble.element.hidden = !actor;
      if (!actor) continue;
      bubble.element.style.left = `${Math.max(12, Math.min(88, actor.x / 1280 * 100))}%`;
      bubble.element.style.top = `${Math.max(16, (actor.y - heightAt(actor.y, actor.scene) - 12) / 720 * 100)}%`;
    }
    paintHint(sprites);
    if (place) place.textContent = sceneNames[scene.id] || scene.id;
    if (mark && now < mark.until) {
      ctx.fillStyle = "#f4f1c8";
      ctx.fillRect(Math.round(mark.x) - 3, Math.round(mark.y) - 3, 6, 6);
    }
    if (failed.has(background.dataset.source)) reportLoad(background.dataset.source);
  }
  function drawActor(actor, now) {
    const sheet = sheets.get(actor.id);
    if (!sheet) return;
    if (actor.id === meId) {
      ctx.fillStyle = "#f4f1c8";
      ctx.fillRect(Math.round(actor.x) - 14, Math.round(actor.y) - 4, 28, 6);
    }
    const moving = actor.moving && !reduced.matches;
    let name = "front";
    let flip = false;
    if (actor.pose === "sit") name = actor.facing === "up" ? "sit_back" : "sit";
    else if (actor.facing === "up") name = "back";
    else if (actor.facing === "left" || actor.facing === "right") {
      name = moving && Math.floor(now / 180) % 2 ? "walk" : "side";
      flip = actor.facing === "left";
    }
    const pose = sheet[name] || sheet.front;
    const unit = heightAt(actor.y, actor.scene) / sheet.front.height;
    const w = pose.width * unit;
    const h = pose.height * unit;
    ctx.save();
    ctx.translate(Math.round(actor.x), Math.round(actor.y));
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(pose.source, pose.left, pose.top, pose.width, pose.height, Math.round(-w / 2), Math.round(-h), Math.round(w), Math.round(h));
    ctx.restore();
  }
  function paintHint(sprites) {
    const me = sprites.find((actor) => actor.id === meId);
    if (choosing) {
      if (!me || !exitHere(me)) closeChoices();
      else return;
    }
    if (!control || chatOpen()) {
      if (control) hint.hidden = true;
      return;
    }
    if (!me) return;
    let text = "";
    if (me.pose === "sit") text = "E 起身";
    else {
      const door = exitHere(me);
      const near = sprites.filter((actor) => actor.id !== meId && Math.hypot(actor.x - me.x, actor.y - me.y) < 52)
        .sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
      if (near) text = `E 和 ${near.name} 说话`;
      else if (door) text = "E 选择去向";
      else {
        const here = scenes[me.scene] || scenes.hutong;
        const seat = here.seats?.find((item) => item.owner === meId);
        if (seat && Math.hypot(seat.stand.x - me.x, seat.stand.y - me.y) < 52) text = "E 坐下";
      }
    }
    hint.hidden = !text;
    if (text) hint.textContent = text;
  }
  function reportLoad(source) {
    if (!notice || notice.querySelector("[data-retry]")) return;
    notice.hidden = false;
    const line = document.createElement("p");
    line.dataset.retry = source;
    line.textContent = "场景没有加载出来。";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "重试";
    button.onclick = () => {
      failed.delete(source);
      const image = backgrounds.get(source);
      if (image) image.src = base + source + "?retry=" + Date.now();
      line.remove();
    };
    line.append(button);
    notice.append(line);
  }

  const renewTimer = setInterval(() => {
    if (control && leaseId && document.visibilityState !== "hidden") send({ type: "renew" });
  }, 5000);
  join();
  requestAnimationFrame(loop);
  return {
    setActors(next) { apply(next, false); },
    refresh() { join(); },
    focus() { canvas.focus(); },
    say(text) { report(text); },
    speak,
    sameScene(id) {
      const me = actors.find(actor => actor.id === meId), other = actors.find(actor => actor.id === id);
      return Boolean(me && other && me.scene === other.scene);
    },
    async halt() {
      keys.clear();
      lastSent = "";
      if (control && leaseId) await send({ type: "stop" });
    },
    async reclaim() {
      keys.clear();
      lastSent = "";
      closeChoices();
      await join();
      if (control && leaseId) await send({ type: "stop" });
    },
    stop() {
      stopped = true;
      clearInterval(renewTimer);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKey);
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("blur", onBlur);
      speechLayer.remove();
      viewButton.remove();
    },
  };
}
