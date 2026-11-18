import type { NativePoint } from '../logos-engine/v6-native-types.ts';
import { fitOrbit } from '../logos-engine/v6-orbit-constraints.ts';

const rays: readonly NativePoint[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const key = (point: NativePoint) => point.join(',');

/** Fit simultaneous cycles only when each changing lattice component has one explanation. */
export function fitDisjointSlotCycles(before: readonly number[], after: readonly number[], positions: readonly NativePoint[],
  contours: readonly (readonly number[])[]): number[][] {
  const pitches = ([0, 1] as const).map(axis => {
    const values = [...new Set(positions.map(point => point[axis]))].sort((a, b) => a - b);
    return Math.min(...values.slice(1).map((value, i) => value - values[i]!));
  });
  const [dx, dy] = pitches as [number, number];
  const byPoint = new Map(positions.map((point, i) => [key(point), i]));
  const visited = new Set<number>(), changing: Set<number>[] = [];
  for (const [start] of positions.entries()) {
    if (visited.has(start)) continue;
    const component = new Set([start]);
    for (const index of component) {
      visited.add(index);
      const [x, y] = positions[index]!;
      const neighbors: NativePoint[] = [[x - dx, y], [x + dx, y], [x, y - dy], [x, y + dy]];
      for (const point of neighbors) {
        const next = byPoint.get(key(point));
        if (next !== undefined) component.add(next);
      }
    }
    if ([...component].some(index => before[index] !== after[index])) changing.push(component);
  }
  if (changing.length < 2) return [];
  const composed = before.map((_, index) => index);
  for (const component of changing) {
    const scoped = before.map((value, index) => component.has(index) ? after[index]! : value);
    const local = contours.filter(contour => contour.every(index => component.has(index)));
    const options = fitOrbit(before, scoped, local);
    if (options.length !== 1) return [];
    for (const index of component) composed[index] = options[0]![index]!;
  }
  return [composed];
}

/** Repeated radial spacing supports independent shifts along the rings or along the rays. */
export function radialSlotPermutations(positions: readonly NativePoint[], targets: readonly number[]) {
  const index = new Map(positions.map((point, i) => [key(point), i]));
  const xs = [...new Set(positions.map(point => point[0]))].sort((a, b) => a - b);
  const ys = new Set(positions.map(point => point[1]));
  const permutations: number[][] = [], radialSlots = new Set<number>();
  let spacing = Infinity;
  for (const x of xs) for (const y of ys) {
    const rings: number[][] = [];
    let pitch = 0;
    for (const edge of xs) {
      const radius = edge - x;
      if (radius <= 0) continue;
      const ring = rays.map(([dx, dy]) => index.get(key([x + radius * dx, y + radius * dy])));
      if (ring.some(slot => slot === undefined)) continue;
      if (pitch && radius !== (rings.length + 1) * pitch) break;
      if (!pitch) pitch = radius;
      rings.push(ring as number[]);
    }
    if (rings.length < 2) continue;
    spacing = Math.min(spacing, pitch);
    for (const ring of rings) for (const slot of ring) radialSlots.add(slot);
    const spokes = rays.map((_, i) => rings.map(ring => ring[i]!));
    for (const groups of [rings, spokes]) for (const step of [-1, 1]) {
      const permutation = positions.map((_, i) => i);
      for (const group of groups) for (const [j, to] of group.entries()) {
        permutation[to] = group[(j + step + group.length) % group.length]!;
      }
      permutations.push(permutation);
    }
  }
  const links = targets.filter(slot => !radialSlots.has(slot));
  const used = new Set<number>(), exchange = positions.map((_, i) => i);
  for (const link of links) {
    const [x, y] = positions[link]!;
    let neighbor: number | undefined, nearest = Infinity;
    for (const slot of radialSlots) {
      const [a, b] = positions[slot]!, distance = (x - a) ** 2 + (y - b) ** 2;
      if (distance < nearest) {
        neighbor = slot;
        nearest = distance;
      } else if (distance === nearest) {
        neighbor = undefined;
      }
    }
    if (neighbor === undefined || nearest > 2 * spacing ** 2 || used.has(neighbor)) return permutations;
    used.add(neighbor);
    exchange[link] = neighbor;
    exchange[neighbor] = link;
  }
  if (used.size) permutations.push(exchange);
  return permutations;
}

/** Each marked slot can only move within its orbit under the measured controls. */
export function projectionWithinLimit(targets: ReadonlyMap<number, number>,
  operators: Iterable<{ permutation: readonly number[] }>, limit: number) {
  const controls = [...operators];
  let combinations = 1;
  for (const target of targets.keys()) {
    const reachable = new Set([target]);
    for (const position of reachable) {
      for (const { permutation } of controls) reachable.add(permutation[position]!);
      if (combinations * reachable.size > limit) return false;
    }
    combinations *= reachable.size;
  }
  return true;
}

export function measureBentSlotCycles(positions: readonly NativePoint[], targets: readonly number[]) {
  if (targets.length < 2) return [];
  const index = new Map(positions.map((point, i) => [key(point), i]));
  const distance = ([a, b]: NativePoint, [c, d]: NativePoint) => [a + c, b + d] as NativePoint;
  const axes = [0, 1] as const;
  const pitch = axes.map(axis => {
    const values = [...new Set(positions.map(point => point[axis]))].sort((a, b) => a - b);
    return Math.min(...values.slice(1).map((value, i) => value - values[i]!));
  });
  if (pitch.some(n => !Number.isFinite(n))) return [];
  const walk = (start: number, vector: NativePoint) => {
    const result = [start];
    let position = positions[start]!;
    for (;;) {
      position = distance(position, vector);
      const next = index.get(key(position));
      if (next === undefined) return result;
      result.push(next);
    }
  };
  const options: number[][][] = [];
  for (const axis of axes) for (const sign of [-1, 1]) {
    if (new Set(targets.map(i => positions[i]![axis])).size !== 1) continue;
    const inward: NativePoint = axis === 0 ? [sign * pitch[0]!, 0] : [0, sign * pitch[1]!];
    for (const sideways of [-1, 1]) {
      const slope: NativePoint = axis === 0 ? [inward[0], sideways * pitch[1]!] : [sideways * pitch[0]!, inward[1]];
      const paths = targets.map(target => walk(target, inward).flatMap((corner, depth, rail) => {
        if (!depth) return [];
        const head = walk(corner, slope);
        return head.length >= 3 ? [[...head.reverse(), ...rail.slice(0, depth).reverse()]] : [];
      }));
      if (!paths.every(path => path.length === 1)) continue;
      const chains = paths.map(path => path[0]!);
      const cells = chains.flat();
      if (new Set(cells).size === cells.length) options.push(chains);
    }
  }
  return options.flatMap(chains => [-1, 1].map(step => {
    const result = positions.map((_, i) => i);
    for (const chain of chains) for (const [i, to] of chain.entries()) {
      result[to] = chain[(i + step + chain.length) % chain.length]!;
    }
    return result;
  }));
}

export function diagonalSlotContours(positions: readonly NativePoint[]): number[][] {
  const index = new Map(positions.map((point, i) => [key(point), i]));
  const pitch = ([0, 1] as const).map(axis => {
    const coordinates = [...new Set(positions.map(point => point[axis]))].sort((a, b) => a - b);
    return Math.min(...coordinates.slice(1).map((value, i) => value - coordinates[i]!));
  });
  if (pitch.some(n => !Number.isFinite(n))) return [];
  const [dx, dy] = pitch as [number, number];
  const result: number[][] = [];
  for (const horizontal of [-dx, dx]) {
    for (const [start, [x, y]] of positions.entries()) {
      if (index.has(key([x - horizontal, y - dy]))) continue;
      const run = [start];
      for (let i = 1; ; i++) {
        const next = index.get(key([x + i * horizontal, y + i * dy]));
        if (next === undefined) break;
        run.push(next);
      }
      for (let a = 0; a + 3 <= run.length; a++) {
        for (let b = a + 3; b <= run.length; b++) result.push(run.slice(a, b));
      }
    }
  }
  return result;
}
