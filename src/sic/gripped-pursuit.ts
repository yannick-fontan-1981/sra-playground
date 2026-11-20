import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { projectPursuit, projectRetreat, pursuitDirections, pursuitPointKey, pursuitStateKey,
  type PursuitDirection, type PursuitState, type PursuitTerrain } from './pursuit-forecast.ts';

export type GripTerrain = PursuitTerrain & { obstacle: number; wall: number; floor: number; fixed: NativePoint[]; peerInks?: number[] };
export type GripState = PursuitState & { held: NativePoint | null };
type GripInput = PursuitDirection[0] | 'ACTION5';
export type GripLeg = { input: GripInput; expected: GripState };
const stateKey = (state: GripState) => pursuitStateKey(state) + '/' + (state.held ? pursuitPointKey(state.held) : '');
const same = ([x, y]: NativePoint, [u, v]: NativePoint) => x === u && y === v;
const sorted = (points: NativePoint[]) => points.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
const shift = ([x, y]: NativePoint, [, dx, dy]: PursuitDirection, pitch: number): NativePoint => [x + dx * pitch, y + dy * pitch];
const has = (points: NativePoint[], at: NativePoint) => points.some(point => same(point, at));

function retreatAfterContact(actor: NativePoint, peers: NativePoint[], obstacles: NativePoint[], terrain: GripTerrain,
  order: readonly PursuitDirection[]): NativePoint[] | null {
  const survivors = peers.flatMap(peer => {
    if (!same(peer, actor)) return [peer];
    const escapes = order.map(direction => shift(peer, direction, terrain.pitch));
    const escape = escapes.find(cell => terrain.cells[pursuitPointKey(cell)] && !has(obstacles, cell) && !has(peers, cell));
    return escape ? [escape] : [];
  });
  return projectRetreat(actor, survivors, obstacles, terrain, order);
}

export function readGripState(rows: NativeRows, terrain: GripTerrain, heldInk?: number): { state: GripState; heldInk?: number } | null {
  const actors: NativePoint[] = [], peers: NativePoint[] = [], obstacles: NativePoint[] = [];
  let held: NativePoint | null = null, actualInk: number | undefined;
  const uniform = ([x, y]: NativePoint, ink: number) => {
    for (let j = y; j < y + terrain.size; j++) for (let i = x; i < x + terrain.size; i++) if (rows[j]?.[i] !== ink) return false;
    return true;
  };
  if (!terrain.fixed.every(point => uniform(point, terrain.wall))) return null;
  for (const cell of Object.keys(terrain.cells)) {
    const point = cell.split(',').map(Number) as [number, number], [x, y] = point, ink = rows[y]?.[x];
    if (ink === terrain.floor) continue;
    if (ink === undefined || !uniform(point, ink)) return null;
    if (ink === terrain.actor) actors.push(point);
    else if (ink === terrain.peer || terrain.peerInks?.includes(ink)) peers.push(point);
    else if (ink === terrain.obstacle) obstacles.push(point);
    else {
      if (held || heldInk !== undefined && ink !== heldInk) return null;
      held = point;
      actualInk = ink;
    }
  }
  if (actors.length !== 1 || peers.length > 3 || !obstacles.length) return null;
  const actor = actors[0]!;
  if (held && Math.abs(held[0] - actor[0]) + Math.abs(held[1] - actor[1]) !== terrain.pitch) return null;
  return { state: { actor, peers: sorted(peers), obstacles: sorted(obstacles), held }, heldInk: actualInk };
}

function projectGrip(state: GripState, terrain: GripTerrain, order: readonly PursuitDirection[], direction?: PursuitDirection): GripState | null {
  const { actor, obstacles, held, peers } = state;
  if (!direction) {
    if (held) return { ...state, obstacles: sorted([...obstacles, held]), held: null };
    const adjacent = obstacles.filter(([x, y]) => Math.abs(x - actor[0]) + Math.abs(y - actor[1]) === terrain.pitch);
    const contact = adjacent.length === 1 ? adjacent[0]! : null;
    return contact ? { ...state, obstacles: obstacles.filter(point => !same(point, contact)), held: contact } : null;
  }
  if (!held) {
    const moved = projectPursuit(state, terrain, direction, order);
    if (!moved) return null;
    const reactive = moved.peers.length === peers.length ? moved.peers : retreatAfterContact(moved.actor, peers, moved.obstacles, terrain, order);
    return reactive && { ...moved, peers: reactive, held: null };
  }
  const next = shift(actor, direction, terrain.pitch), carried = shift(held, direction, terrain.pitch);
  if (!terrain.cells[pursuitPointKey(next)] || !terrain.cells[pursuitPointKey(carried)]
    || has(obstacles, next) || has(obstacles, carried) || has(peers, carried)) return null;
  const reactive = retreatAfterContact(next, peers, [...obstacles, carried], terrain, order);
  return reactive && { actor: next, obstacles, peers: reactive, held: carried };
}

export const gripStateMatches = (a: GripState, b: GripState) => stateKey(a) === stateKey(b);
export const gripTrialKey = (state: GripState, input: GripInput) => stateKey(state) + '/' + input;

export function planGrippedPursuit(start: GripState, terrain: GripTerrain, order: readonly PursuitDirection[],
  rejected: ReadonlySet<string>, remaining: number, interrupted: () => boolean = () => false): GripLeg[] | null {
  type Search = { at: GripState; input: GripInput; parent: number; depth: number };
  const nodes: Search[] = [{ at: start, input: 'ACTION5', parent: -1, depth: 0 }];
  const seen = new Set([stateKey(start)]);
  const actions = [...pursuitDirections, undefined];
  for (let i = 0; i < nodes.length && i < 262_144; i++) {
    if (i % 512 === 0 && interrupted()) return null;
    const { at, depth } = nodes[i]!;
    if (depth >= remaining) break;
    for (const direction of actions) {
      const input = direction?.[0] ?? 'ACTION5';
      if (rejected.size && rejected.has(gripTrialKey(at, input))) continue;
      const expected = projectGrip(at, terrain, order, direction);
      if (!expected) continue;
      const next: Search = { at: expected, input, parent: i, depth: depth + 1 };
      if (expected.peers.length === 0) {
        const legs: GripLeg[] = [];
        for (let node = next; node.parent >= 0; node = nodes[node.parent]!) legs.push({ input: node.input, expected: node.at });
        return legs.reverse();
      }
      const key = stateKey(expected);
      if (seen.has(key)) continue;
      seen.add(key);
      nodes.push(next);
    }
  }
  return null;
}
