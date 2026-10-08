// Pure room state for PartyKit presence + movement. No PartyKit imports — unit-testable.
export const PARTY_ROOM_ID = 'hutong-main';
export const SCENES = ['hutong', 'hawaii', 'rest', 'pop', 'bathroom', 'concert', 'arcade', 'noodle', 'gym', 'dance', 'perler', 'rehearsal', 'elevator', 'subway'];

export function createRoomState() {
  return { byConn: new Map(), byUser: new Map() };
}

export function publicPlayer(entry) {
  return {
    role: entry.role,
    name: entry.role[0].toUpperCase() + entry.role.slice(1),
    scene: entry.scene,
    x: entry.x,
    y: entry.y,
    facing: entry.facing,
    moving: entry.moving,
    seat: entry.seat,
    hand: entry.hand,
    revision: entry.revision,
    activity: entry.activity,
  };
}

export function roomSnapshot(state) {
  const players = [];
  for (const entry of state.byUser.values()) {
    if (entry.connId) players.push(publicPlayer(entry));
  }
  return {
    type: 'state',
    room: PARTY_ROOM_ID,
    players,
    online: players.map(p => ({ role: p.role, scene: p.scene })),
  };
}

function clampPose(input, fallback) {
  const scene = SCENES.includes(input?.scene) ? input.scene : fallback.scene;
  let x = Number(input?.x);
  let y = Number(input?.y);
  if (!Number.isFinite(x)) x = fallback.x;
  if (!Number.isFinite(y)) y = fallback.y;
  x = Math.min(620, Math.max(20, x));
  y = Math.min(355, Math.max(90, y));
  let facing = Number.isInteger(input?.facing) ? input.facing : fallback.facing;
  if (facing < 0 || facing > 3) facing = fallback.facing;
  const seat = input?.seat === null || typeof input?.seat === 'string' ? input.seat : fallback.seat;
  const hand = input?.hand === null || typeof input?.hand === 'string' ? input.hand : fallback.hand;
  const activity = typeof input?.activity === 'string' ? input.activity.slice(0, 20) : fallback.activity;
  return {
    scene,
    x,
    y,
    facing,
    moving: input?.moving === true,
    seat: seat ?? null,
    hand: hand ?? null,
    activity: activity || 'walk',
    revision: Number.isInteger(input?.revision) ? input.revision : fallback.revision,
  };
}

/** Accept hello after ticket verification. Enforces one controller per account. */
export function applyHello(state, connId, claims, pose = {}) {
  const previous = state.byUser.get(claims.userId);
  const base = previous || {
    userId: claims.userId,
    role: claims.role,
    username: claims.username || claims.role,
    scene: 'hutong',
    x: 320,
    y: 220,
    facing: 0,
    moving: false,
    seat: null,
    hand: null,
    activity: 'walk',
    revision: 0,
    controller: false,
    connId: null,
    viewerConnIds: new Set(),
  };

  const wantControl = claims.controller === true;
  let controllerConn = base.controller && base.connId && state.byConn.has(base.connId) ? base.connId : null;
  let demoted = null;
  if (wantControl) {
    if (controllerConn && controllerConn !== connId) {
      const old = state.byConn.get(controllerConn);
      if (old) {
        old.controller = false;
        demoted = controllerConn;
      }
      base.viewerConnIds.add(controllerConn);
    }
    controllerConn = connId;
  } else if (!controllerConn) {
    // First connection becomes controller if nobody holds it.
    controllerConn = connId;
  }

  const nextPose = clampPose(pose, base);
  const viewers = base.viewerConnIds instanceof Set ? new Set(base.viewerConnIds) : new Set(base.viewerConnIds || []);
  viewers.delete(connId);
  if (demoted) viewers.add(demoted);

  const isController = controllerConn === connId;
  if (!isController) viewers.add(connId);
  // Controllers may refresh pose; pure viewers keep the authoritative controller pose.
  const entry = {
    ...base,
    ...(isController || !previous ? nextPose : {}),
    userId: claims.userId,
    role: claims.role,
    username: claims.username || claims.role,
    // User-level flag: account currently has a controlling connection.
    controller: !!controllerConn,
    connId: controllerConn,
    viewerConnIds: viewers,
  };

  state.byUser.set(claims.userId, entry);
  state.byConn.set(connId, {
    userId: claims.userId,
    role: claims.role,
    controller: isController,
  });

  return {
    you: { userId: claims.userId, role: claims.role, controller: isController, client: claims.client },
    demoted,
    player: publicPlayer(entry),
  };
}

export function applyMove(state, connId, pose) {
  const link = state.byConn.get(connId);
  if (!link) return { ok: false, reason: '请先 hello' };
  if (!link.controller) return { ok: false, reason: '角色在另一个窗口操作' };
  const entry = state.byUser.get(link.userId);
  if (!entry) return { ok: false, reason: '会话无效' };
  // Allow scene changes from client (HTTP /api/transition remains authoritative for game side-effects).
  const next = clampPose(pose, entry);
  Object.assign(entry, next, { at: Date.now() });
  return { ok: true, player: publicPlayer(entry) };
}

export function applyLeave(state, connId) {
  const link = state.byConn.get(connId);
  if (!link) return { left: null, takeover: null };
  state.byConn.delete(connId);
  const entry = state.byUser.get(link.userId);
  if (!entry) return { left: null, takeover: null };

  entry.viewerConnIds.delete(connId);
  let takeover = null;
  if (link.controller) {
    // Promote an existing viewer if any; otherwise mark offline.
    const next = [...entry.viewerConnIds][0];
    if (next && state.byConn.has(next)) {
      entry.connId = next;
      entry.controller = true;
      state.byConn.get(next).controller = true;
      entry.viewerConnIds.delete(next);
      takeover = next;
    } else {
      entry.connId = null;
      entry.controller = false;
      state.byUser.delete(link.userId);
      return { left: { role: link.role, userId: link.userId }, takeover: null };
    }
  }

  if (!entry.connId && entry.viewerConnIds.size === 0) {
    state.byUser.delete(link.userId);
    return { left: { role: link.role, userId: link.userId }, takeover: null };
  }
  return { left: null, takeover, player: publicPlayer(entry) };
}
