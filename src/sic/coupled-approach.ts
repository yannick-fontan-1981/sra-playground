import type { NativeExecution, NativePoint } from '../logos-engine/v6-native-types.ts';
import { settleCoupledPieces, type CoupledPiece } from './coupled-piece-settling.ts';

type Field = { floor: readonly string[]; goal: NativePoint; grid: { width: number; height: number } };
type Entry = { positions: [string, string]; directions: [number, number] };
export type CoupledRotation = { piece: CoupledPiece; action: string; expected: CoupledPiece[] };
type Node = { pieces: CoupledPiece[]; depth: number; previous?: Node; rotation?: CoupledRotation };
const signature = (pieces: CoupledPiece[]) =>
  pieces.map(({ point, direction }) => `${point.join(',')}:${direction}`).sort().join('|');
const quarterDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 4 - Math.abs(a - b));

function approachEntries(field: Field, floor: ReadonlySet<string>): Entry[] {
  const { goal, grid } = field, goalKey = goal.join(',');
  const positions = field.floor.map(key => key.split(',').map(Number) as [number, number]);
  const entries: Entry[] = [];
  for (const axis of [0, 1] as const) {
    const line = positions.filter(point => point[axis] === goal[axis] && point.join(',') !== goalKey);
    for (const [i, a] of line.entries()) for (const b of line.slice(i + 1)) for (const direction of [axis, axis + 2]) {
      const result = settleCoupledPieces([{ point: a, direction: axis, selected: false }, { point: b, direction, selected: false }],
        floor, grid.width, grid.height);
      if (result?.some(piece => piece.point.join(',') === goalKey)) entries.push({ positions: [a.join(','), b.join(',')], directions: [axis, direction] });
    }
  }
  return entries;
}

function distancesFrom(target: string, floor: ReadonlySet<string>) {
  const distances = new Map([[target, 0]]);
  for (const [key, depth] of distances) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    for (const next of [`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`]) {
      if (floor.has(next) && !distances.has(next)) distances.set(next, depth + 1);
    }
  }
  return distances;
}

/** Rank preparations by poses from which an aligned pair can settle on the target. */
export async function planCoupledApproach(pieces: CoupledPiece[], field: Field, turns: readonly [string, number][], remaining: number,
  acceptsFirst: (piece: CoupledPiece, action: string) => boolean, shouldStop: () => boolean,
  execution?: NativeExecution): Promise<CoupledRotation[] | null> {
  const floor = new Set(field.floor), goal = field.goal.join(','), { width, height } = field.grid;
  const entries = approachEntries(field, floor);
  if (!entries.length) return null;
  const distances = new Map([...new Set(entries.flatMap(entry => entry.positions))].map(point => [point, distancesFrom(point, floor)]));
  const limit = Math.min(remaining, 32), queue = new Map<number, Node[]>(), seen = new Map([[signature(pieces), 0]]);
  function offer(node: Node) {
    const locations = node.pieces.map(piece => piece.point.join(','));
    let best = Infinity;
    for (const { positions: [x, y], directions: [a, b] } of entries) {
      const from = distances.get(x)!, to = distances.get(y)!;
      for (const [i, first] of node.pieces.entries()) for (const [j, second] of node.pieces.entries()) {
        if (i === j) continue;
        const rotations = Math.min(quarterDistance(first.direction, a) + quarterDistance(second.direction, b),
          quarterDistance(first.direction, (a + 2) % 4) + quarterDistance(second.direction, (b + 2) % 4));
        best = Math.min(best, (from.get(locations[i]!) ?? Infinity) + (to.get(locations[j]!) ?? Infinity) + rotations / 4);
      }
    }
    const score = node.depth + 2 * best;
    const bucket = queue.get(score);
    if (bucket) bucket.push(node);
    else queue.set(score, [node]);
  }
  offer({ pieces, depth: 0 });
  const now = execution?.now ?? (() => performance.now());
  let lastYield = now();
  for (let expanded = 0; expanded < 12_000 && queue.size; expanded++) {
    if (expanded % 16 === 0 && shouldStop()) return null;
    if (execution && now() - lastYield >= 12) {
      await execution.yieldControl();
      if (shouldStop()) return null;
      lastYield = now();
    }
    const score = Math.min(...queue.keys()), bucket = queue.get(score)!, node = bucket.pop()!;
    if (!bucket.length) queue.delete(score);
    for (const piece of node.pieces) for (const [action, quarter] of turns) {
      const depth = node.depth + (piece.selected ? 1 : 2);
      if (depth > limit || !node.previous && !acceptsFirst(piece, action)) continue;
      const oriented = node.pieces.map(candidate => ({ ...candidate, selected: candidate === piece,
        direction: candidate === piece ? (candidate.direction + quarter + 4) % 4 : candidate.direction }));
      const expected = settleCoupledPieces(oriented, floor, width, height);
      if (!expected) continue;
      const rotation = { piece, action, expected };
      if (expected.some(candidate => candidate.point.join(',') === goal)) {
        const route = [rotation];
        for (let cursor: Node | undefined = node; cursor?.rotation; cursor = cursor.previous) route.push(cursor.rotation);
        return route.reverse();
      }
      const key = signature(expected);
      if ((seen.get(key) ?? Infinity) <= depth) continue;
      seen.set(key, depth);
      offer({ pieces: expected, depth, previous: node, rotation });
    }
  }
  return null;
}
