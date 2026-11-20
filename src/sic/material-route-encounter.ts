import { alternatingHistogram, alternatingOverlays, type AlternatingActor, type AlternatingBox,
  type AlternatingPosition as Point } from '../logos-engine/v6-alternating-graph-observation.ts';
import type { AlternatingGuard, AlternatingTopology } from '../logos-engine/v6-alternating-graph-questions.ts';
import type { NativeRows } from '../logos-engine/v6-native-types.ts';
import type { PursuitProfile } from './material-route-diversion.ts';
import { guardSightline } from './material-route-watch.ts';

type Track = { position: Point; heading: Point };
type Removal = { guard_histogram: number[][]; size: number };
export type EncounterMemory = {
  at: Point; target: Point; fixed: AlternatingGuard[]; fixedBodies: number[]; patrols: Track[]; patrolBody: number;
  pursuer: Point; pursuerBody: number; trigger: Point[]; trail: Point[]; evidence: string[];
};
export type EncounterStep = {
  input: string; to: Point; current: EncounterMemory; expected: EncounterMemory; learning: boolean; measuringPatrols: boolean;
};

const key = (point: Point) => point.join(',');
const same = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const difference = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const opposite = ([y, x]: Point): Point => [-y, -x];
const connected = (graph: AlternatingTopology, a: Point, b: Point) => graph.edges.get(key(a))?.has(key(b)) === true;
const bounds = ([y, x]: Point, size: number): AlternatingBox => [y, x, y + size - 1, x + size - 1];
const body = (histogram: number[][], size: number) => histogram.find(([, count]) => count === size ** 2 - 1)?.[0];

function initialize(graph: AlternatingTopology, actor: AlternatingActor, profile: PursuitProfile, removals: readonly Removal[]): EncounterMemory | null {
  const followers = graph.guards.filter(guard => body(guard.histogram, actor.size) === profile.body);
  const fixed = graph.guards.filter(guard => removals.some(rule => rule.size === actor.size
    && JSON.stringify(rule.guard_histogram) === JSON.stringify(guard.histogram)));
  const moving = graph.guards.filter(guard => !fixed.includes(guard) && !followers.includes(guard));
  if (followers.length !== 1 || !fixed.length || fixed.length > 8 || moving.length < 2 || moving.length > 6
    || !moving.every(guard => JSON.stringify(guard.histogram) === JSON.stringify(moving[0]!.histogram))) return null;
  const patrolBody = body(moving[0]!.histogram, actor.size);
  if (patrolBody === undefined) return null;
  const pursuer = followers[0]!;
  const sight = guardSightline(graph, pursuer, profile.distance);
  return { at: [actor.bbox[0], actor.bbox[1]], target: graph.target, fixed, pursuer: pursuer.position,
    fixedBodies: fixed.flatMap(guard => {
      const ink = body(guard.histogram, actor.size);
      return ink === undefined ? [] : [ink];
    }),
    pursuerBody: profile.body, trigger: sight.length === profile.distance ? sight : [], trail: [],
    patrols: moving.map(guard => ({ position: guard.position, heading: difference(guard.front, guard.position) })),
    patrolBody, evidence: [] };
}

function forecast(graph: AlternatingTopology, state: EncounterMemory, to: Point) {
  if (!connected(graph, state.at, to) || same(to, state.pursuer)) return null;
  const fixed = state.fixed.filter(guard => !same(to, guard.position));
  if (fixed.some(guard => same(to, guard.front))) return null;
  const captured = state.patrols.find(track => same(to, track.position));
  if (captured && same(state.at, add(captured.position, captured.heading))) return null;
  const patrols: Track[] = [];
  for (const track of state.patrols) {
    if (track === captured) continue;
    let heading = track.heading, position = add(track.position, heading);
    if (!connected(graph, track.position, position)) {
      heading = opposite(heading);
      position = add(track.position, heading);
      if (!connected(graph, track.position, position)) return null;
    }
    if (same(position, to)) return null;
    if (!connected(graph, position, add(position, heading))) heading = opposite(heading);
    patrols.push({ position, heading });
  }
  const pursuer = state.trail[0] ?? state.pursuer;
  if (same(to, pursuer) || !same(pursuer, state.pursuer) && !connected(graph, state.pursuer, pursuer)) return null;
  const trigger = state.trigger.at(-1), awakened = trigger && same(to, trigger);
  const trail = state.trail.length ? [...state.trail.slice(1), to] : awakened ? state.trigger : [];
  return { ...state, at: to, fixed, patrols, pursuer, trail, trigger: awakened ? [] : state.trigger };
}

const identity = (state: EncounterMemory) => [key(state.at), key(state.pursuer), state.trail.map(key).join('/'),
  state.patrols.map(track => [key(track.position), key(track.heading)].join(':')).sort().join('/'),
  state.fixed.map(guard => key(guard.position)).join('/')].join('|');

/** Use one safe observation to establish the patrol's motion before trusting distant crossings. */
export function planCombinedEncounter(graph: AlternatingTopology, actor: AlternatingActor,
  controls: Readonly<Record<string, Point>>, profile: PursuitProfile, removals: readonly Removal[],
  known: EncounterMemory | undefined, remaining: number, shouldStop: () => boolean): EncounterStep | null {
  const current = known ?? initialize(graph, actor, profile, removals);
  if (!current || !same(current.at, [actor.bbox[0], actor.bbox[1]]) || !same(current.target, graph.target)) return null;
  const unconfirmed = !current.evidence.length;
  const unsafeProbe = new Set(unconfirmed ? graph.guards.flatMap(guard =>
    [key(guard.position), key(guard.front), ...graph.edges.get(key(guard.position)) ?? []]) : []);
  const moves = Object.entries(controls).sort(([a], [b]) => a.localeCompare(b));
  type Node = { state: EncounterMemory; depth: number; first: EncounterStep | null };
  const queue: Node[] = [{ state: current, depth: 0, first: null }], seen = new Set([identity(current)]);
  for (let index = 0; index < queue.length && index < 65_536; index++) {
    if (index % 128 === 0 && shouldStop()) return null;
    const { state, depth, first } = queue[index]!;
    if (same(state.at, graph.target)) return first;
    if (depth >= remaining) continue;
    for (const [input, movement] of moves) {
      const to = add(state.at, movement);
      if (!first && unsafeProbe.has(key(to))) continue;
      const expected = forecast(graph, state, to);
      if (!expected) continue;
      const id = identity(expected);
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push({ state: expected, depth: depth + 1, first: first ?? {
        input, to, current, expected, learning: unconfirmed || expected.patrols.length < current.patrols.length,
        measuringPatrols: unconfirmed,
      } });
    }
  }
  return null;
}

function observesPositions(state: EncounterMemory, size: number, rows: NativeRows) {
  const expected = new Map<string, Set<number>>();
  const addBody = (at: Point, ink: number | undefined) => {
    if (ink === undefined) return;
    const cell = key(at), possible = expected.get(cell) ?? new Set<number>();
    possible.add(ink);
    expected.set(cell, possible);
  };
  for (const guard of state.fixed) addBody(guard.position, body(guard.histogram, size));
  for (const track of state.patrols) addBody(track.position, state.patrolBody);
  addBody(state.pursuer, state.pursuerBody);
  const wanted = new Set([state.patrolBody, state.pursuerBody, ...state.fixedBodies]);
  for (const piece of alternatingOverlays(rows)) {
    if (piece.size !== size) continue;
    const ink = body(piece.histogram, size);
    if (ink === undefined || !wanted.has(ink)) continue;
    const at = key([piece.bbox[0], piece.bbox[1]]);
    // More than one predicted role can share an occupied cell. The visible role must be one of them.
    if (!expected.get(at)?.has(ink)) return false;
    if (ink === state.patrolBody) {
      const marker = piece.histogram.find(([, count]) => count === 1)?.[0], offset = Math.floor(size / 2);
      if (marker === undefined || !state.patrols.some(({ position: [y, x], heading: [dy, dx] }) =>
        key([y, x]) === at && rows[y + offset + Math.sign(dy) * offset]?.[x + offset + Math.sign(dx) * offset] === marker)) return false;
    }
    expected.delete(at);
  }
  return !expected.size;
}

export function observeCombinedEncounter(step: EncounterStep, actor: AlternatingActor, rows: NativeRows,
  frames: readonly NativeRows[], ref: string): EncounterMemory | null {
  const arrived = (frame: NativeRows) =>
    JSON.stringify(alternatingHistogram(frame, bounds(step.to, actor.size))) === JSON.stringify(actor.histogram);
  if (!arrived(rows) || !observesPositions(step.expected, actor.size, rows)) return null;
  if (step.measuringPatrols && !frames.some(frame => arrived(frame) && observesPositions(step.current, actor.size, frame))) return null;
  return { ...step.expected, evidence: [...step.current.evidence.slice(-5), ref] };
}
