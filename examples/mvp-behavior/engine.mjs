import { roster, seats, preferences, encounters, gifts, shanghaiTime } from './config.mjs';

const trips = {
  concert: ['concert', 'zhu_zhixin'],
  popmart: ['popmart', 'buzz_lightyear'],
  restroom: ['restroom', 'fuguidiao'],
  gym: ['gym', 'floor'],
  mixian: ['mixian', 'counter'],
  coffee: ['rest_area', 'coffee_machine'],
  snack: ['rest_area', 'coffee_machine'],
};
const localActivities = ['work', 'development', 'phone_scroll', 'phone_call'];

/** Pure single-server domain module. Methods are called by authenticated server handlers,
 * never directly with a client-supplied actor identity. Commands need a game adapter. */
export class BehaviorEngine {
  constructor(snapshot) {
    this.state = snapshot ? structuredClone(snapshot) : {
      actors: Object.fromEntries([...roster.map(r => r.id), 'celine'].map(id => [id, {
        scene: id === 'celine' ? 'hawaii' : 'hutong', mode: 'auto', busy: null, visit: 0,
      }])), npcs: {}, events: {}, sequence: 0,
    };
  }
  snapshot() { return structuredClone(this.state); }
  actor(id) { const a = this.state.actors[id]; if (!a) throw new Error('Unknown actor'); return a; }
  seat(id) { return Object.keys(seats).find(key => seats[key] === id) ?? null; }
  setMode(id, mode) {
    if (!['manual', 'auto'].includes(mode)) throw new Error('Invalid mode');
    this.actor(id).mode = mode;
  }
  manualOverride(id) {
    const a = this.actor(id); a.mode = 'manual';
    return a.busy ? this.cancel(a.busy) : [];
  }
  enter(id, scene) {
    if (typeof scene !== 'string' || !scene) throw new Error('Invalid scene');
    const a = this.actor(id);
    if (a.scene === scene) return []; // reconnect/snapshot is not a fresh visit
    const commands = [];
    for (const [key, npc] of Object.entries(this.state.npcs)) {
      if (npc.owner === id) { delete this.state.npcs[key]; commands.push({ type: 'despawn', npc: key }); }
    }
    a.scene = scene; a.visit++;
    const npc = encounters[`${id}:${scene}`];
    if (npc) {
      this.state.npcs[npc] = { owner: id, scene, visit: a.visit };
      commands.push({ type: 'spawn', npc, scene, interactionOwner: id });
    }
    if (id === 'celine' && scene === 'hutong' && this.actor('amber').scene !== 'hutong') {
      commands.push({ type: 'say', actor: 'celine', text: 'amber呢' });
    }
    return commands;
  }
  canInteract(actor, npc) { return this.state.npcs[npc]?.owner === actor &&
    this.state.npcs[npc]?.scene === this.actor(actor).scene; }

  proposeActivity(id, availableActivities, random = Math.random) {
    const a = this.actor(id);
    if (a.mode !== 'auto' || a.busy) return null;
    const options = Object.entries(preferences[id] ?? {}).filter(([key]) => availableActivities.includes(key));
    const total = options.reduce((sum, [, w]) => sum + w, 0);
    if (!total) return null;
    let n = Math.min(1 - Number.EPSILON, Math.max(0, random())) * total;
    for (const [activity, weight] of options) { n -= weight; if (n < 0) return { actor: id, activity }; }
    return null;
  }

  tick(now) {
    const commands = [];
    for (const e of Object.values(this.state.events)) {
      if (['pending', 'active'].includes(e.status) && now >= e.expiresAt) {
        if (e.kind === 'outing' && e.status === 'pending' && e.required.every(id => e.answers[id] === true)) {
          for (const id of e.members) if (!(id in e.answers)) { e.answers[id] = false; this.release(id, e.id); }
          e.expiresAt = now + 90000;
          commands.push(...this.startInvitation(e));
          continue;
        }
        commands.push(...this.cancel(e.id, 'expired'));
      }
    }
    const { date, minute } = shanghaiTime(now);
    for (const rule of gifts) {
      const id = `${rule.id}:${date}`, a = this.actor(rule.from);
      if (minute < rule.start || minute >= rule.end || a.busy || this.state.events[id]) continue;
      const e = { id, kind: 'coffee', actor: rule.from, recipient: rule.to,
        status: a.mode === 'manual' ? 'pending' : 'active', stage: 'to_coffee',
        expiresAt: now + (rule.end - minute) * 60000 };
      this.state.events[id] = e; a.busy = id;
      commands.push(a.mode === 'manual'
        ? { type: 'invite', eventId: id, actor: rule.from, activity: 'deliver_coffee' }
        : this.coffeeMove(e));
    }
    return commands;
  }
  schedule(now, random = Math.random) {
    const commands = [];
    for (const event of Object.values(this.state.events)) {
      if (event.kind === 'activity' && event.status === 'active' && event.stage === 'there' && now >= event.returnAt) {
        event.stage = 'home';
        commands.push({ type: 'move', eventId: event.id, actor: event.actor, scene: 'hutong', target: this.seat(event.actor) });
      }
    }
    if (this.state.nextSchedule && now < this.state.nextSchedule) return commands;
    this.state.nextSchedule = now + 20000;
    if (random() < 0.2) commands.push(...this.invite('outing', { includeLaura: random() < 0.35 }, now));
    if (random() < 0.15) commands.push(...this.invite('hawaii', { target: random() < 0.5 ? 'amber' : 'jilly' }, now));
    const idle = roster.filter((person) => {
      const actor = this.actor(person.id);
      return actor.mode === 'auto' && !actor.busy && (!actor.nextAt || now >= actor.nextAt);
    });
    if (!idle.length) return commands;
    const person = idle[Math.min(idle.length - 1, Math.floor(random() * idle.length))];
    const pick = this.proposeActivity(person.id, [...Object.keys(trips), ...localActivities], random);
    if (pick) commands.push(...this.beginActivity(pick.actor, pick.activity, now));
    return commands;
  }
  beginActivity(id, activity, now) {
    const actor = this.actor(id);
    if (actor.mode !== 'auto' || actor.busy) return [];
    const trip = trips[activity];
    if (!trip) {
      actor.nextAt = now + 45000;
      return [];
    }
    const eventId = `activity:${++this.state.sequence}`;
    this.state.events[eventId] = {
      id: eventId, kind: 'activity', actor: id, activity, status: 'active', stage: 'out',
      scene: trip[0], target: trip[1], expiresAt: now + 180000,
    };
    actor.busy = eventId;
    return [{ type: 'move', eventId, actor: id, scene: trip[0], target: trip[1] }];
  }
  activityReached(id, target, now) {
    const event = this.state.events[id];
    if (!event || event.kind !== 'activity' || event.status !== 'active') return [];
    if (now >= event.expiresAt) return this.cancel(id, 'expired');
    const actor = this.actor(event.actor);
    if (event.stage === 'out' && target === event.target && actor.scene === event.scene) {
      event.stage = 'there';
      event.returnAt = now + 25000;
      return [];
    }
    if (event.stage === 'home' && actor.scene === 'hutong' && target === this.seat(event.actor)) {
      event.status = 'completed';
      this.release(event.actor, id);
      actor.nextAt = now + 90000;
    }
    return [];
  }
  coffeeMove(e) { return { type: 'move', eventId: e.id, actor: e.actor,
    scene: 'rest_area', target: 'coffee_machine' }; }
  respondCoffee(id, actor, accept, now) {
    const e = this.state.events[id];
    if (!e || e.kind !== 'coffee' || e.actor !== actor || e.status !== 'pending') return [];
    if (now >= e.expiresAt || !accept) return this.cancel(id, accept ? 'expired' : 'declined');
    e.status = 'active'; return [this.coffeeMove(e)];
  }
  // Server calls only AFTER actual navigation/interaction success (not browser claims).
  coffeeReached(id, target, now) {
    const e = this.state.events[id];
    if (!e || e.kind !== 'coffee' || e.status !== 'active') return [];
    if (now >= e.expiresAt) return this.cancel(id, 'expired');
    if (e.stage === 'to_coffee' && target === 'coffee_machine' && this.actor(e.actor).scene === 'rest_area') {
      e.stage = 'to_sid';
      return [{ type: 'acquire_coffee', actor: e.actor, itemId: id },
        { type: 'move', eventId: id, actor: e.actor, scene: 'hutong', target: this.seat('sid') }];
    }
    if (e.stage === 'to_sid' && target === this.seat('sid') && this.actor(e.actor).scene === 'hutong') {
      e.status = 'completed'; this.release(e.actor, id);
      return [{ type: 'deliver_coffee', eventId: id, itemId: id, from: e.actor, to: 'sid',
        placement: 'desk', target: this.seat('sid'), notifyNow: this.actor('sid').scene === 'hutong' }];
    }
    return [];
  }
  release(actor, eventId) { if (this.actor(actor).busy === eventId) this.actor(actor).busy = null; }
  cancel(id, reason = 'player_cancelled') {
    const e = this.state.events[id];
    if (!e || !['pending', 'active'].includes(e.status)) return [];
    e.status = 'cancelled'; e.reason = reason;
    for (const actor of e.members ?? [e.actor]) this.release(actor, id);
    return [{ type: 'cancel_event', eventId: id, reason }];
  }
  // External low-frequency scheduler calls this. A pending invite reserves actors;
  // game adapter can cancel on manual movement. No forced acceptance for players.
  invite(kind, { target, includeLaura = false, downstairsDestination = null } = {}, now) {
    if (!['hawaii', 'outing'].includes(kind)) throw new Error('Invalid invitation');
    if (kind === 'hawaii' && (!['amber', 'jilly'].includes(target) || this.actor('celine').scene !== 'hawaii')) return [];
    const members = kind === 'hawaii' ? [target] : ['amber', 'cora', ...(includeLaura ? ['laura'] : [])];
    if (members.some(id => this.actor(id).busy)) return [];
    const id = `invite:${++this.state.sequence}`;
    const e = { id, kind, members, required: kind === 'outing' ? ['amber', 'cora'] : members,
      answers: {}, arrived: [], status: 'pending', expiresAt: now + 90000, downstairsDestination };
    this.state.events[id] = e;
    const commands = [];
    for (const member of members) {
      this.actor(member).busy = id;
      if (this.actor(member).mode === 'auto') e.answers[member] = true;
      else commands.push({ type: 'invite', eventId: id, actor: member, activity: kind });
    }
    return [...commands, ...this.startInvitation(e)];
  }
  respondInvite(id, actor, accept, now) {
    const e = this.state.events[id];
    if (!e?.members || e.status !== 'pending' || !e.members.includes(actor) || actor in e.answers) return [];
    if (now >= e.expiresAt) return this.cancel(id, 'expired');
    e.answers[actor] = Boolean(accept);
    if (!accept && e.required.includes(actor)) return this.cancel(id, 'declined');
    if (!accept) this.release(actor, id);
    return this.startInvitation(e);
  }
  startInvitation(e) {
    if (!e.members.every(id => id in e.answers)) return [];
    e.status = 'active';
    return e.members.filter(id => e.answers[id]).map(actor => ({ type: 'move', eventId: e.id, actor,
      scene: e.kind === 'hawaii' ? 'hawaii' : 'elevator', target: e.kind === 'hawaii' ? 'celine' : 'gather_point' }));
  }
  invitationReached(id, actor, now) {
    const e = this.state.events[id];
    if (!e?.members || e.status !== 'active' || !e.answers[actor]) return [];
    if (now >= e.expiresAt) return this.cancel(id, 'expired');
    if (this.actor(actor).scene !== (e.kind === 'hawaii' ? 'hawaii' : 'elevator')) return [];
    if (!e.arrived.includes(actor)) e.arrived.push(actor);
    const participants = e.members.filter(id => e.answers[id]);
    if (!participants.every(id => e.arrived.includes(id))) return [];
    e.status = 'completed'; participants.forEach(id => this.release(id, e.id));
    return [e.kind === 'hawaii' ? { type: 'interact', eventId: id, actor, npc: 'celine' }
      : { type: e.downstairsDestination ? 'request_group_transfer' : 'destination_unconfigured',
        eventId: id, actors: participants, destination: e.downstairsDestination }];
  }
}
