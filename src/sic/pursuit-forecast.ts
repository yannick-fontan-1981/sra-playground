import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export const pursuitDirections = [
  ['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0],
] as const;
export type PursuitDirection = typeof pursuitDirections[number];
type Input = PursuitDirection[0];
export type PursuitRoles = { actor: number; peer: number; obstacle: number };
export type PursuitTerrain = Pick<PursuitRoles, 'actor' | 'peer'> & { cells: Record<string, boolean>; pitch: number; size: number };
export type PursuitState = { actor: NativePoint; peers: NativePoint[]; obstacles: NativePoint[] };
export type PursuitMove = { input: Input; expected: PursuitState; contactIn: number };

export const pursuitPointKey = ([x, y]: NativePoint) => `${x},${y}`;
const same = ([x, y]: NativePoint, [u, v]: NativePoint) => x === u && y === v;
const distance = ([x, y]: NativePoint, [u, v]: NativePoint) => Math.abs(x - u) + Math.abs(y - v);
const sorted = (points: NativePoint[]) => points.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
const shift = ([x, y]: NativePoint, [, dx, dy]: PursuitDirection, pitch: number): NativePoint => [x + dx * pitch, y + dy * pitch];
const has = (points: NativePoint[], point: NativePoint) => points.some(candidate => same(candidate, point));
export const pursuitStateKey = ({ actor, peers, obstacles }: PursuitState) =>
  [pursuitPointKey(actor), peers.map(pursuitPointKey).join(';'), obstacles.map(pursuitPointKey).join(';')].join('/');
export const pursuitTrialKey = (state: PursuitState, input: Input) => `${pursuitStateKey(state)}/${input}`;

export function readPursuitState(rows: NativeRows, terrain: PursuitTerrain, obstacle: number): PursuitState | null {
  const actors: NativePoint[] = [], peers: NativePoint[] = [], obstacles: NativePoint[] = [];
  for (const cell of Object.keys(terrain.cells)) {
    const [x, y] = cell.split(',').map(Number) as [number, number];
    const ink = rows[y]?.[x];
    const found = ink === terrain.actor ? actors : ink === terrain.peer ? peers : ink === obstacle ? obstacles : null;
    if (!found) continue;
    for (let j = y; j < y + terrain.size; j++) for (let i = x; i < x + terrain.size; i++) {
      if (rows[j]?.[i] !== ink) return null;
    }
    found.push([x, y]);
  }
  if (actors.length !== 1 || peers.length > 3 || !obstacles.length) return null;
  return { actor: actors[0]!, peers: sorted(peers), obstacles: sorted(obstacles) };
}

export function projectPursuit(state: PursuitState, terrain: PursuitTerrain, input: PursuitDirection,
  retreatOrder: readonly PursuitDirection[]): PursuitState | null {
  const actor = shift(state.actor, input, terrain.pitch);
  if (!terrain.cells[pursuitPointKey(actor)]) return null;
  let obstacles = state.obstacles;
  if (has(obstacles, actor)) {
    const displaced = shift(actor, input, terrain.pitch);
    if (!terrain.cells[pursuitPointKey(displaced)] || has(obstacles, displaced) || has(state.peers, displaced)) return null;
    obstacles = sorted(obstacles.map(obstacle => same(obstacle, actor) ? displaced : obstacle));
  }
  const survivors = state.peers.filter(peer => !same(peer, actor));
  const peers = survivors.map(peer => {
    let best = peer, separation = distance(actor, peer);
    for (const direction of retreatOrder) {
      const next = shift(peer, direction, terrain.pitch), score = distance(actor, next);
      if (score <= separation || !terrain.cells[pursuitPointKey(next)] || has(obstacles, next) || has(survivors, next)) continue;
      best = next;
      separation = score;
    }
    return best;
  });
  if (new Set(peers.map(pursuitPointKey)).size !== peers.length) return null;
  return { actor, peers: sorted(peers), obstacles };
}

export function planPursuit(state: PursuitState, terrain: PursuitTerrain, retreatOrder: PursuitDirection[],
  rejected: Set<string>, remaining: number): PursuitMove | null {
  const queue: { at: PursuitState; move: PursuitMove | null; depth: number }[] = [{ at: state, move: null, depth: 0 }];
  const visited = new Set([pursuitStateKey(state)]);
  for (let cursor = 0; cursor < queue.length && cursor < 8_192; cursor++) {
    const { at, move, depth } = queue[cursor]!;
    if (depth >= remaining) continue;
    for (const input of pursuitDirections) {
      if (rejected.has(pursuitTrialKey(at, input[0]))) continue;
      const expected = projectPursuit(at, terrain, input, retreatOrder);
      if (!expected) continue;
      const first = move ?? { input: input[0], expected, contactIn: 0 };
      if (expected.peers.length < state.peers.length) return { ...first, contactIn: depth + 1 };
      const key = pursuitStateKey(expected);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ at: expected, move: first, depth: depth + 1 });
    }
  }
  return null;
}
