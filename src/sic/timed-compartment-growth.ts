import { gateRegion, openGates, readInhabitants } from './compartment-growth.ts';
import type { CompartmentLayout, Gate, Inhabitant } from './compartment-growth.ts';
import type { NativeRows } from '../logos-engine/v6-native-types.ts';

type Roles = { food: number; starter: number; activated: number; grower: number; threshold: number };
export type TimedCompartmentPhase = 'feed_route' | 'join_candidates' | 'prepare_route' | 'stage_growth' | 'advance_growth'
  | 'open_encounter' | 'advance_encounter';
export type TimedCompartmentChoice = {
  phase: TimedCompartmentPhase; gate: Gate; focus: Inhabitant[]; threshold: Inhabitant;
  expectedOpen: boolean; route: Gate[];
};

function routeBetween(from: ReadonlySet<number>, to: ReadonlySet<number>, allowed: (room: number) => boolean, gates: readonly Gate[]) {
  const seen = new Set(from), queue = [...from].map(room => ({ room, path: [] as Gate[] }));
  for (const { room, path } of queue) for (const gate of gates) {
    if (!gate.rooms.includes(room)) continue;
    const next = gate.rooms.find(other => other !== room)!;
    if (seen.has(next) || !allowed(next)) continue;
    if (to.has(next)) return [...path, gate];
    seen.add(next);
    queue.push({ room: next, path: [...path, gate] });
  }
  return null;
}

function planGrowthApproach(best: Inhabitant, threshold: Inhabitant, actors: Inhabitant[], open: Gate[], closed: Gate[],
  turns: number, staged: boolean): TimedCompartmentChoice | null {
  const source = gateRegion(best.room, open);
  const protectedRegion = gateRegion(threshold.room, open);
  if (source.has(threshold.room)) return null;
  const prospects = actors.filter(sprite => !protectedRegion.has(sprite.room) && sprite.area < threshold.area);
  const rooms = new Set(prospects.map(sprite => sprite.room));
  const route = routeBetween(new Set([best.room]), new Set([threshold.room]),
    room => source.has(room) || protectedRegion.has(room) || rooms.has(room), [...open, ...closed]);
  if (!route?.length || route.filter(gate => !open.includes(gate)).length > turns) return null;
  const boundary = route.find(gate => gate.rooms.some(room => protectedRegion.has(room)));
  if (!boundary || open.includes(boundary)) return null;
  const approach = route.slice(0, route.indexOf(boundary));
  const targetRoom = (gate: Gate, from: number) => gate.rooms.find(room => room !== from)!;
  let room = best.room;
  const pendingRooms = new Map<Gate, number>();
  for (const gate of approach) {
    room = targetRoom(gate, room);
    pendingRooms.set(gate, room);
  }
  const next = approach.find(gate => !open.includes(gate));
  const choose = (phase: TimedCompartmentPhase, gate: Gate, focus: Inhabitant[]): TimedCompartmentChoice =>
    ({ phase, gate, focus: [best, ...focus], threshold, expectedOpen: !open.includes(gate), route });
  if (!next && staged && best.area >= threshold.area) return choose('open_encounter', boundary, []);

  const edible = prospects.filter(sprite => sprite.area <= best.area);
  if (next) {
    const targets = edible.filter(sprite => sprite.room === pendingRooms.get(next));
    if (targets.length) return choose('stage_growth', next, targets);
  }
  if (!staged || best.area >= threshold.area || turns <= route.filter(gate => !open.includes(gate)).length) return null;
  const reachedRooms = new Set(approach.slice(0, next ? approach.indexOf(next) : approach.length).map(gate => pendingRooms.get(gate)));
  const reachableTargets = edible.filter(sprite => reachedRooms.has(sprite.room) || sprite.room === best.room);
  if (!reachableTargets.length) return null;
  const clock = open.find(gate => gate.rooms.includes(best.room) && !approach.includes(gate));
  return clock ? choose('advance_growth', clock, reachableTargets) : null;
}

export function selectTimedCompartment(layout: CompartmentLayout, rows: NativeRows, roles: Roles, turns: number,
  earlierClock?: Gate, staged = false): TimedCompartmentChoice | null {
  const parts = readInhabitants(layout, rows), thresholds = parts.filter(sprite => sprite.color === roles.threshold);
  if (thresholds.length !== 1 || turns <= 0) return null;
  const threshold = thresholds[0]!, open = openGates(layout, rows), closed = layout.gates.filter(gate => !open.includes(gate));
  const all = [...open, ...closed];
  const region = (sprite: Inhabitant) => gateRegion(sprite.room, open);
  const protectedRegion = region(threshold), outside = (room: number) => !protectedRegion.has(room);
  const actors = parts.filter(sprite => sprite.color === roles.starter || sprite.color === roles.activated);
  const activated = actors.filter(sprite => sprite.color === roles.activated);
  const food = parts.filter(sprite => sprite.color === roles.food);
  const edible = food.filter(item => actors.some(sprite => sprite.area >= item.area));
  const best = parts.filter(sprite => sprite.color === roles.grower).sort((a, b) => b.area - a.area)[0];
  const choose = (phase: TimedCompartmentPhase, gate: Gate, focus: Inhabitant[], route: Gate[] = []): TimedCompartmentChoice =>
    ({ phase, gate, focus, route, threshold, expectedOpen: !open.includes(gate) });

  const approach = best && planGrowthApproach(best, threshold, actors, open, closed, turns, staged);
  if (approach) return approach;

  const explored = new Set<number>(), feeding: { choice: TimedCompartmentChoice; score: number }[] = [];
  for (const actor of activated.length ? activated : actors) {
    if (explored.has(actor.room) || !outside(actor.room)) continue;
    const source = region(actor), allies = actors.filter(sprite => source.has(sprite.room));
    for (const room of source) explored.add(room);
    for (const item of edible) {
      if (source.has(item.room)) continue;
      const path = routeBetween(source, new Set([item.room]), outside, all);
      const gate = path?.find(candidate => !open.includes(candidate));
      if (!path || !gate) continue;
      const supply = region(item), targets = edible.filter(sprite => supply.has(sprite.room));
      feeding.push({ choice: choose('feed_route', gate, [...allies, ...targets], path), score: allies.length * targets.length / path.length });
    }
  }
  const feed = feeding.sort((a, b) => b.score - a.score)[0];
  if (feed) return feed.choice;
  if (!best) return null;

  const from = region(best);
  if (from.has(threshold.room)) {
    if (best.area < threshold.area) return null;
    const contact = routeBetween(new Set([best.room]), new Set([threshold.room]), () => true, open) ?? [];
    const preserves = (gate: Gate) => !open.includes(gate) || gateRegion(best.room, open.filter(other => other !== gate)).has(threshold.room);
    const safe = open.filter(gate => !contact.includes(gate) && preserves(gate));
    const reused = earlierClock && layout.gates.find(gate => gate.point[0] === earlierClock.point[0] && gate.point[1] === earlierClock.point[1]);
    const clock = reused && preserves(reused) ? reused : safe.find(gate => gate.rooms.includes(best.room)) ?? safe[0];
    return clock ? choose('advance_encounter', clock, [best], contact) : null;
  }

  if (best.area < threshold.area) {
    const others = actors.filter(sprite => outside(sprite.room) && !from.has(sprite.room));
    const to = new Set(others.map(sprite => sprite.room));
    if (to.size) {
      const join = closed.find(gate => gate.rooms.some(room => from.has(room)) && gate.rooms.some(room => to.has(room)));
      const path = join ? [join] : routeBetween(from, to, outside, all);
      const gate = path?.find(candidate => !open.includes(candidate));
      if (gate) return choose('join_candidates', gate, [best, ...others], path ?? []);
    }
  }

  // Keep the threshold isolated while assembling a route through resources that
  // a smaller participant cannot consume. The distant toggles also advance time.
  const accessSize = Math.max(0, ...actors.map(actor => actor.area));
  const large = food.filter(sprite => sprite.area > accessSize && sprite.area < threshold.area);
  const supplies = new Set(large.map(sprite => sprite.room));
  const route = routeBetween(new Set([threshold.room]), from, room => supplies.has(room) || from.has(room), all);
  if (!route?.length) return null;
  const pending = route.filter(gate => !open.includes(gate));
  if (pending.length > turns) return null;
  const next = route.slice(1).find(gate => !open.includes(gate));
  if (next) return choose('prepare_route', next, [best, ...large], route);
  if (best.area >= threshold.area) return choose('open_encounter', route[0]!, [best], route);
  const wait = closed.find(gate => gate.rooms.every(outside));
  return wait ? choose('prepare_route', wait, [best], route) : null;
}
