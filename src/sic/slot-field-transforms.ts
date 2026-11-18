import type { NativePoint } from '../logos-engine/v6-native-types.ts';

const rays: readonly NativePoint[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const key = (point: NativePoint) => point.join(',');

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
