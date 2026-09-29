import { roster } from '../../examples/mvp-behavior/config.mjs';

/** Applies behavior commands only after the world has actually moved the actor. */
export function createDirector({ world, runtime, repository, manualIds, random = Math.random }) {
  let until = 0;
  async function drain() {
    const notices = [];
    for (const entry of await repository.pendingCommands(40)) {
      const command = entry.payload;
      if (command?.type === 'move' && !manualIds().has(command.actor)) {
        const events = runtime.snapshot().events;
        const event = events[command.eventId];
          const stale = !event || !['pending', 'active'].includes(event.status)
            || (event.kind === 'coffee' && event.stage === 'to_sid' && command.target === 'coffee_machine')
            || (event.kind === 'coffee' && event.status === 'completed')
            || (event.kind === 'activity' && event.stage !== 'out' && command.scene !== 'hutong')
            || (event.kind === 'activity' && event.stage !== 'home' && command.scene === 'hutong');
        if (!stale) world.orderRoute(command.actor, command);
      }
      if (command?.type === 'cancel_event') world.clearRoute(command.eventId);
      if (command?.type === 'spawn') world.spawnGuest(command);
      if (command?.type === 'despawn') world.removeGuest(command.npc);
      if (command?.type === 'say' && command.actor === 'celine') world.placeGuest('celine', 'hutong');
      if (command?.type === 'invite' || command?.type === 'say') notices.push(command);
      await repository.acknowledgeCommand(entry.id);
    }
    return notices;
  }
  return {
    async step(now) {
      await runtime.update((engine) => {
        const commands = [];
        for (const person of roster) {
          const manual = manualIds().has(person.id);
          const actor = engine.actor(person.id);
          if (manual && actor.mode !== 'manual') commands.push(...engine.manualOverride(person.id));
          else engine.setMode(person.id, manual ? 'manual' : 'auto');
        }
        commands.push(...engine.tick(now));
        commands.push(...engine.schedule(now, random));
        return commands;
      });
      const notices = await drain();
      const sceneChanges = world.takeSceneChanges();
      const arrivals = world.takeArrivals();
      if (sceneChanges.length || arrivals.length) {
        await runtime.update((engine) => {
          const commands = [];
          for (const change of sceneChanges) commands.push(...engine.enter(change.memberId, change.scene));
          for (const arrival of arrivals) {
            if (!arrival.eventId) continue;
            commands.push(...engine.coffeeReached(arrival.eventId, arrival.target, now));
            commands.push(...engine.invitationReached(arrival.eventId, arrival.memberId, now));
            commands.push(...engine.activityReached(arrival.eventId, arrival.target, now));
          }
          return commands;
        });
        notices.push(...await drain());
      }
      return { notices };
    },
    async visit(now = Date.now()) {
      const snapshot = runtime.snapshot();
      if (snapshot.actors.celine.scene === 'hutong') {
        if (now < until) return { notices: [] };
        await runtime.update((engine) => engine.enter('celine', 'hawaii'));
        world.placeGuest('celine', 'hawaii');
        until = 0;
        return { notices: [] };
      }
      if (snapshot.actors.amber.scene === 'hutong') return { notices: [] };
      until = now + 60_000;
      await runtime.update((engine) => engine.enter('celine', 'hutong'));
      return { notices: await drain() };
    },
    async respond(memberId, eventId, accept, now = Date.now()) {
      await runtime.update((engine) => {
        const event = engine.snapshot().events[eventId];
        if (!event || event.kind === 'coffee') return engine.respondCoffee(eventId, memberId, accept, now);
        return engine.respondInvite(eventId, memberId, accept, now);
      });
      return this.step(now);
    },
  };
}
