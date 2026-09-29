import { randomBytes } from 'node:crypto';
import { roster } from '../../examples/mvp-behavior/config.mjs';
import { findPath, nearestWalkable, pointInPolygon, buildGrid } from '../shared/geometry.mjs';
import { ACTOR_RADIUS, INTERACT_RADIUS, LEASE_MS, SPEED, VIEW, hutong } from '../shared/hutong.mjs';
import { guestSprites, scenes as sceneCatalog, targetPoint } from '../shared/scenes.mjs';

const DIR_TTL = 600;

export function createWorld({ loadPlaces = () => [], savePlaces = () => {}, scene = hutong } = {}) {
  const scenes = scene === hutong ? sceneCatalog : { [scene.id]: scene };
  const grids = Object.fromEntries(Object.values(scenes).map((item) => [item.id, buildGrid(item.walkable, VIEW.width, VIEW.height, 16, ACTOR_RADIUS)]));
  const saved = new Map(loadPlaces().map((row) => [row.memberId, row]));
  const introduced = new Set(saved.keys());
  const actors = new Map(roster.map((person) => {
    const seat = scene.seats.find((item) => item.owner === person.id);
    const place = saved.get(person.id);
    const seated = !place || place.pose === 'sit';
    return [person.id, {
      id: person.id,
      name: person.name,
      scene: scenes[place?.scene] ? place.scene : 'hutong',
      x: place?.x ?? (seated ? seat.sit.x : seat.stand.x),
      y: place?.y ?? (seated ? seat.sit.y : seat.stand.y),
      facing: place?.facing ?? seat.facing,
      pose: place?.pose ?? 'sit',
      seat: place?.seatId ?? seat.id,
      path: null,
      route: null,
      dir: null,
      seq: 0,
      moving: false,
    }];
  }));
  const guests = new Map();
  // Re-anchor stored positions after changing the office artwork/coordinate layout.
  for (const actor of actors.values()) {
    const layout = scenes[actor.scene];
    const seat = layout?.seats.find(item => item.owner === actor.id);
    if (actor.pose === 'sit' && seat) Object.assign(actor, seat.sit, { facing: seat.facing });
    else if (!contained(actor.scene, actor.x, actor.y)) {
      Object.assign(actor, seat?.stand || layout.spawn, { pose: 'stand', seat: null });
    }
  }
  const celineHome = scenes.hawaii?.targets?.celine;
  if (celineHome) {
    guests.set('celine', {
      id: 'celine', name: guestSprites.celine.name, scene: 'hawaii', guest: true,
      x: celineHome.x, y: celineHome.y, facing: 'down', pose: 'stand', seat: null, moving: false,
    });
  }
  const leases = new Map();
  const arrivals = [];
  const sceneChanges = [];
  let lastTick = 0;
  let dirty = false;
  let pendingSave = false;
  let lastSave = -Infinity;

  function seatOf(id) {
    return scene.seats.find((item) => item.owner === id);
  }

  function contained(sceneId, x, y) {
    const area = scenes[sceneId]?.walkable;
    if (!area || !pointInPolygon(x, y, area)) return false;
    for (const [dx, dy] of [[ACTOR_RADIUS, 0], [-ACTOR_RADIUS, 0], [0, ACTOR_RADIUS], [0, -ACTOR_RADIUS]]) {
      if (!pointInPolygon(x + dx, y + dy, area)) return false;
    }
    return true;
  }

  function moveToward(actor, target, step) {
    const dx = target.x - actor.x;
    const dy = target.y - actor.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) return false;
    const scale = Math.min(1, step / dist);
    const nx = actor.x + dx * scale;
    const ny = actor.y + dy * scale;
    if (contained(actor.scene, nx, ny)) {
      actor.x = nx;
      actor.y = ny;
    } else if (contained(actor.scene, nx, actor.y)) actor.x = nx;
    else if (contained(actor.scene, actor.x, ny)) actor.y = ny;
    else return false;
    if (Math.abs(dx) > Math.abs(dy)) actor.facing = dx > 0 ? 'right' : 'left';
    else actor.facing = dy > 0 ? 'down' : 'up';
    actor.pose = 'stand';
    actor.seat = null;
    return true;
  }

  return {
    flush() {
      if (pendingSave) { persist(); pendingSave = false; }
    },
    view() {
      return [...actors.values(), ...guests.values()].map((actor) => ({
        id: actor.id,
        name: actor.name,
        scene: actor.scene,
        x: round(actor.x),
        y: round(actor.y),
        facing: actor.facing,
        pose: actor.pose,
        seat: actor.seat,
        moving: actor.moving,
        guest: Boolean(actor.guest),
        inputSeq: actor.seq || 0,
      }));
    },
    spawnGuest(command) {
      if (!command?.npc || guests.has(command.npc)) return;
      const info = guestSprites[command.npc];
      const point = scenes[command.scene]?.targets?.[command.npc] || scenes[command.scene]?.spawn;
      if (!info || !point) return;
      guests.set(command.npc, {
        id: command.npc, name: info.name, scene: command.scene, guest: true,
        x: point.x, y: point.y, facing: 'down', pose: 'stand', seat: null, moving: false,
      });
    },
    placeGuest(id, sceneId) {
      const guest = guests.get(id);
      const point = scenes[sceneId]?.targets?.[id] || scenes[sceneId]?.spawn;
      if (!guest || !point) return;
      guest.scene = sceneId;
      guest.x = point.x;
      guest.y = point.y;
    },
    removeGuest(id) {
      if (id === 'celine') return;
      guests.delete(id);
    },
    join(memberId, tabId, now) {
      if (!actors.has(memberId)) throw Object.assign(new Error('没有这个角色'), { status: 404 });
      if (typeof tabId !== 'string' || tabId.length < 8 || tabId.length > 64) {
        throw Object.assign(new Error('窗口标识不正确'), { status: 400 });
      }
      const current = leases.get(memberId);
      if (current && current.tabId !== tabId && now < current.until) {
        return { control: false, leaseId: null, seq: 0, actors: this.view() };
      }
      const leaseId = current?.tabId === tabId ? current.leaseId : randomBytes(16).toString('hex');
      leases.set(memberId, { tabId, leaseId, until: now + LEASE_MS, seq: current?.tabId === tabId ? current.seq : 0 });
      const actor = actors.get(memberId);
      if (!introduced.has(memberId)) {
        introduced.add(memberId);
        const seat = seatOf(memberId);
        actor.x = seat.stand.x;
        actor.y = seat.stand.y;
        actor.pose = 'stand';
        actor.seat = null;
        actor.facing = seat.facing;
        persist();
      }
      return { control: true, leaseId, seq: leases.get(memberId).seq, actors: this.view() };
    },
    release(memberId, tabId, now) {
      const current = leases.get(memberId);
      if (!current || current.tabId !== tabId) return;
      current.until = now + LEASE_MS;
      const actor = actors.get(memberId);
      actor.dir = null;
      actor.path = null;
      actor.moving = false;
      dirty = true;
    },
    intent(memberId, body, now, manual) {
      const lease = leases.get(memberId);
      if (!lease || now >= lease.until) {
        throw Object.assign(new Error('操作中断了'), { status: 409, code: 'expired' });
      }
      if (lease.leaseId !== body?.leaseId) {
        throw Object.assign(new Error('这个角色正在另一个窗口里'), { status: 409, code: 'taken' });
      }
      const seq = body?.seq;
      if (!Number.isInteger(seq) || seq < 1 || seq > 1_000_000_000) {
        throw Object.assign(new Error('意图序号不正确'), { status: 400 });
      }
      if (seq <= lease.seq) return { duplicate: true, actors: this.view() };
      lease.seq = seq;
      lease.until = now + LEASE_MS;
      const intent = body.intent;
      if (!intent || typeof intent !== 'object') throw Object.assign(new Error('意图不正确'), { status: 400 });
      const actor = actors.get(memberId);
      if (intent.type === 'renew') return { ok: true };
      if (!manual && intent.type !== 'interact') {
        throw Object.assign(new Error('托管中，先切回手动'), { status: 409, code: 'manual' });
      }
      if (intent.type === 'move') {
        const x = Number(intent.dir?.x), y = Number(intent.dir?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw Object.assign(new Error('方向不正确'), { status: 400 });
        const length = Math.hypot(x, y) || 1;
        actor.seq = seq;
        actor.dir = { x: x / length, y: y / length, until: now + DIR_TTL };
        actor.path = null;
        actor.route = null;
        if (actor.pose === 'sit' && actor.scene === 'hutong') stand(actor, seatOf(memberId));
        dirty = true;
        return { ok: true };
      }
      if (intent.type === 'path') {
        const x = Number(intent.target?.x), y = Number(intent.target?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw Object.assign(new Error('目标不正确'), { status: 400 });
        const goal = nearestWalkable(grids[actor.scene], clamp(x, 0, VIEW.width), clamp(y, 0, VIEW.height));
        if (!goal) throw Object.assign(new Error('那里走不过去'), { status: 400 });
        if (actor.pose === 'sit' && actor.scene === 'hutong') stand(actor, seatOf(memberId));
        actor.path = findPath(grids[actor.scene], actor, goal);
        actor.dir = null;
        actor.route = null;
        dirty = true;
        return { ok: true, path: actor.path.length };
      }
      if (intent.type === 'stop') {
        actor.seq = seq;
        actor.dir = null;
        actor.path = null;
        actor.route = null;
        actor.moving = false;
        dirty = true;
        return { ok: true };
      }
      if (intent.type === 'travel') return { ok: true, ...travel(actor, intent.scene) };
      if (intent.type === 'interact') return { ok: true, ...interact(actor) };
      throw Object.assign(new Error('不认识这个操作'), { status: 400 });
    },
    tick(now) {
      const dt = lastTick ? Math.min(0.1, Math.max(0, (now - lastTick) / 1000)) : 0;
      lastTick = now;
      const step = SPEED * dt;
      let moved = false;
      for (const actor of actors.values()) {
        const before = `${actor.x.toFixed(1)},${actor.y.toFixed(1)},${actor.pose},${actor.moving}`;
        actor.moving = false;
        if (actor.pose === 'sit') continue;
        if (actor.route && !actor.dir) advanceRoute(actor);
        if (actor.dir && now < actor.dir.until) {
          actor.moving = moveToward(actor, { x: actor.x + actor.dir.x * 100, y: actor.y + actor.dir.y * 100 }, step);
        } else if (actor.path?.length) {
          actor.moving = moveToward(actor, actor.path[0], step);
          if (Math.hypot(actor.path[0].x - actor.x, actor.path[0].y - actor.y) < 8) actor.path.shift();
          if (!actor.path.length) actor.path = null;
        }
        if (`${actor.x.toFixed(1)},${actor.y.toFixed(1)},${actor.pose},${actor.moving}` !== before) moved = true;
      }
      const changed = moved || dirty;
      if (changed) {
        dirty = false;
        pendingSave = true;
      }
      // Do not synchronously write eight rows to SQLite on every 50ms animation tick.
      // Flush a settled position immediately, or checkpoint an ongoing walk each second.
      if (pendingSave && (now - lastSave >= 1000 || ![...actors.values()].some(actor => actor.moving))) {
        persist();
        pendingSave = false;
        lastSave = now;
      }
      return changed;
    },
    orderRoute(memberId, order) {
      const actor = actors.get(memberId);
      const destination = scenes[order?.scene];
      if (!actor || !destination || !targetPoint(destination, order.target)) {
        throw Object.assign(new Error('没有这条路'), { status: 400 });
      }
      if (actor.pose === 'sit' && actor.scene === 'hutong') stand(actor, seatOf(memberId));
      actor.dir = null;
      actor.route = {
        scene: destination.id,
        target: order.target,
        eventId: order.eventId ?? null,
        phase: actor.scene === destination.id ? 'target' : 'exit',
      };
      actor.path = pathFor(actor);
      dirty = true;
    },
    takeArrivals() { return arrivals.splice(0); },
    takeSceneChanges() { return sceneChanges.splice(0); },
    clearRoute(eventId) {
      for (const actor of actors.values()) {
        if (actor.route?.eventId !== eventId) continue;
        actor.route = null;
        actor.path = null;
        actor.dir = null;
        actor.moving = false;
      }
    },
  };

  function pathFor(actor) {
    const grid = grids[actor.scene];
    if (!actor.route || !grid) return null;
    if (actor.route.phase === 'exit') {
      const exit = exitToward(actor.scene, actor.route.scene);
      if (!exit) return null;
      const goal = nearestWalkable(grid, centroid(exit.area).x, centroid(exit.area).y);
      return goal ? findPath(grid, actor, goal) : null;
    }
    const point = targetPoint(scenes[actor.route.scene], actor.route.target);
    const goal = point && nearestWalkable(grid, point.x, point.y);
    return goal ? findPath(grid, actor, goal) : null;
  }

  function advanceRoute(actor) {
    if (!actor.route) return;
    if (actor.route.phase === 'exit') {
      const exit = exitToward(actor.scene, actor.route.scene);
      if (exit && pointInPolygon(actor.x, actor.y, exit.area)) {
        enter(actor, actor.route.scene);
        actor.route.phase = 'target';
        actor.path = pathFor(actor);
        dirty = true;
      }
      return;
    }
    const point = targetPoint(scenes[actor.scene], actor.route.target);
    if (!point || Math.hypot(point.x - actor.x, point.y - actor.y) > 28) return;
    arrivals.push({ memberId: actor.id, scene: actor.scene, target: actor.route.target, eventId: actor.route.eventId });
    actor.route = null;
    actor.path = null;
    dirty = true;
  }

  function exitToward(from, to) {
    return scenes[from]?.exits.find((exit) => exit.destination === to || exit.choices?.some((choice) => choice.scene === to));
  }

  function enter(actor, sceneId) {
    const destination = scenes[sceneId];
    if (!destination || actor.scene === destination.id) return;
    actor.scene = destination.id;
    actor.x = destination.spawn.x;
    actor.y = destination.spawn.y;
    actor.pose = 'stand';
    actor.seat = null;
    actor.facing = 'down';
    sceneChanges.push({ memberId: actor.id, scene: destination.id });
  }

  function travel(actor, sceneId) {
    const exit = scenes[actor.scene]?.exits.find((item) => pointInPolygon(actor.x, actor.y, item.area)
      && item.choices?.some((choice) => choice.scene === sceneId));
    if (!exit || !scenes[sceneId]) throw Object.assign(new Error('这里去不了'), { status: 400 });
    actor.route = null;
    actor.path = null;
    actor.dir = null;
    enter(actor, sceneId);
    dirty = true;
    return { action: 'travel', scene: sceneId };
  }

  function persist() {
    savePlaces([...actors.values()].map((actor) => ({
          memberId: actor.id,
          scene: actor.scene,
      x: actor.x,
      y: actor.y,
      pose: actor.pose,
      facing: actor.facing,
      seatId: actor.seat,
    })));
  }

  function interact(actor) {
    if (actor.pose === 'sit') {
      stand(actor, seatOf(actor.id));
      dirty = true;
      return { action: 'stand' };
    }
    let nearest = null;
    let nearestDist = INTERACT_RADIUS;
    for (const other of [...actors.values(), ...guests.values()]) {
      if (other.id === actor.id || other.scene !== actor.scene) continue;
      const dist = Math.hypot(other.x - actor.x, other.y - actor.y);
      if (dist <= nearestDist) {
        nearest = other;
        nearestDist = dist;
      }
    }
    if (nearest?.guest) {
      const lines = {
        zhu_zhixin: actor.id === 'jilly' ? 'Jilly，今天也来听歌啦！' : '演出快开始了！',
        buzz_lightyear: actor.id === 'cora' ? 'Cora，今天想拆哪一盒？' : '一起看看新来的盲盒吧。',
        fuguidiao: actor.id === 'amber' ? 'Amber，又见面了！' : '你好呀！',
        celine: actors.get('amber')?.scene !== nearest.scene ? 'amber呢' : 'Amber，来聊聊。',
      };
      return { action: 'speech', actorId: nearest.id, text: lines[nearest.id] || '你好！' };
    }
    if (nearest) return { action: 'talk', peerId: nearest.id };
    const seat = actor.scene === 'hutong' ? seatOf(actor.id) : null;
    if (seat && Math.hypot(seat.stand.x - actor.x, seat.stand.y - actor.y) <= INTERACT_RADIUS) {
      actor.x = seat.sit.x;
      actor.y = seat.sit.y;
      actor.pose = 'sit';
      actor.seat = seat.id;
      actor.facing = seat.facing;
      actor.path = null;
      actor.dir = null;
      actor.moving = false;
      dirty = true;
      return { action: 'sit', seatId: seat.id };
    }
    const exit = scenes[actor.scene]?.exits.find((item) => pointInPolygon(actor.x, actor.y, item.area));
    if (exit?.choices?.length) return { action: 'choose', exitId: exit.id, choices: exit.choices };
    return { action: 'none' };
  }
}

function stand(actor, seat) {
  actor.x = seat.stand.x;
  actor.y = seat.stand.y;
  actor.pose = 'stand';
  actor.seat = null;
  actor.facing = seat.facing;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function centroid(area) {
  return {
    x: area.reduce((sum, point) => sum + point.x, 0) / area.length,
    y: area.reduce((sum, point) => sum + point.y, 0) / area.length,
  };
}
