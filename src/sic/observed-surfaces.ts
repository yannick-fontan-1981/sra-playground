import { linkedPacketDigest } from '../logos-engine/v6-linked-packet-numeric.ts';
import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export const surfaceDirections = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
const directions = [0, 1, 2, 3] as const;
type Direction = typeof directions[number];
const opposite = [1, 0, 3, 2] as const;
export type SurfaceRoles = { actor: number; goal: number; support: number; gap: number; origin: NativePoint; pitch: number };
type Address = { floor: string; cell: NativePoint };
type Surface = { free: string[]; gates: Record<string, Direction>; goal: NativePoint | null };
export type SurfaceView = { address: Address; surface: Surface };
export type SurfaceMemory = {
  floors: Record<string, Surface>; steps: Record<string, Address>; links: Record<string, Address>; blocked: string[];
};
export type SurfacePlan = { direction: Direction; expected: Address | null; focus: Address; kind: 'move' | 'linked' | 'probe' };

const key = ([x, y]: NativePoint) => `${x},${y}`;
const addressKey = ({ floor, cell }: Address) => `${floor}/${key(cell)}`;
const stepKey = (address: Address, direction: Direction) => `${addressKey(address)}/${direction}`;
export const sameSurfaceAddress = (a: Address, b: Address) => addressKey(a) === addressKey(b);
export const emptySurfaceMemory = (): SurfaceMemory => ({ floors: {}, steps: {}, links: {}, blocked: [] });

export function surfacePoint({ origin, pitch }: SurfaceRoles, [column, row]: NativePoint): NativePoint {
  return [origin[0] + column * pitch, origin[1] + row * pitch];
}

export function measureSurface(rows: NativeRows, roles: SurfaceRoles): SurfaceView | null {
  const [left, top] = roles.origin, { pitch } = roles, size = pitch - 1;
  const columns = Math.floor((rows[0]!.length - left) / pitch), count = Math.floor((rows.length - top) / pitch);
  const right = left + columns * pitch, bottom = top + count * pitch;
  if (left < 1 || top < 1 || right >= rows[0]!.length || columns * count > 240 || size < 3) return null;
  const rail = rows.slice(0, bottom).map(row => row.slice(right));
  if (new Set(rail.flat()).size < 2) return null;
  const floor = linkedPacketDigest(rail), free: string[] = [], gates: Record<string, Direction> = {};
  const actor: NativePoint[] = [], goal: NativePoint[] = [];
  for (let row = 0; row < count; row++) for (let column = 0; column < columns; column++) {
    const cell: NativePoint = [column, row], id = key(cell), [x, y] = surfacePoint(roles, cell);
    const values = rows.slice(y, y + size).flatMap(line => line.slice(x, x + size));
    const support = values.filter(ink => ink === roles.support).length;
    if (support >= size ** 2 - 4) free.push(id);
    const center = [rows[y + 1]?.[x + 1], rows[y + 1]?.[x + 2], rows[y + 2]?.[x + 1], rows[y + 2]?.[x + 2]];
    if (center.every(ink => ink === roles.actor)) actor.push(cell);
    if (center.every(ink => ink === roles.goal)) goal.push(cell);
    const sides = [rows[y - 1]!.slice(x, x + size), rows[y + size]!.slice(x, x + size),
      rows.slice(y, y + size).map(line => line[x - 1]), rows.slice(y, y + size).map(line => line[x + size])];
    const openings = directions.filter(side => sides[side]!.every(ink => ink === roles.gap));
    const rim = sides.flatMap((side, i) => i === openings[0] ? [] : side);
    const corners = [values[0], values[size - 1], values[size * (size - 1)], values.at(-1)];
    if (openings.length === 1 && new Set(rim).size === 1 && new Set(corners).size >= 2 && support < size ** 2) {
      gates[id] = openings[0]!;
    }
  }
  if (actor.length !== 1 || goal.length > 1 || (!free.length && !Object.keys(gates).length)) return null;
  return { address: { floor, cell: actor[0]! }, surface: { free, gates, goal: goal[0] ?? null } };
}

export function rememberSurface(memory: SurfaceMemory, { address, surface }: SurfaceView): SurfaceMemory {
  const prior = memory.floors[address.floor], gates = { ...prior?.gates, ...surface.gates };
  const free = new Set([...(prior?.free ?? []), ...surface.free]), goal = surface.goal ?? prior?.goal ?? null;
  if (goal) free.add(key(goal));
  if (gates[key(address.cell)] === undefined) free.add(key(address.cell));
  return { ...memory, floors: { ...memory.floors, [address.floor]: { gates, free: [...free], goal } } };
}

/** Attribute a public return to one visibly paired passage, independently of its issuing family. */
export function observedSurfacePassage(before: SurfaceView, after: SurfaceView, command: string): SurfacePlan | null {
  const direction = directions.find(index => surfaceDirections[index][0] === command);
  if (direction === undefined || before.address.floor === after.address.floor) return null;
  const [, dx, dy] = surfaceDirections[direction], origin = before.address.cell;
  const approach: NativePoint = [origin[0] + dx, origin[1] + dy];
  const originGate = before.surface.gates[key(origin)];
  const candidates: NativePoint[] = [];
  if ((originGate === undefined || originGate === direction)
    && before.surface.gates[key(approach)] === opposite[direction]
    && key(after.address.cell) === key(approach)
    && after.surface.gates[key(approach)] === direction) candidates.push(approach);
  if (originGate !== undefined && opposite[originGate] === direction
    && key(after.address.cell) === key(origin)
    && after.surface.gates[key(origin)] === direction) candidates.push(origin);
  if (candidates.length !== 1) return null;
  return { direction, expected: after.address, focus: { floor: before.address.floor, cell: candidates[0]! }, kind: 'linked' };
}

export function rememberSurfaceStep(memory: SurfaceMemory, before: SurfaceView, after: SurfaceView,
  plan: SurfacePlan): SurfaceMemory {
  const from = before.address, target = after.address, id = stepKey(from, plan.direction);
  const next = rememberSurface(memory, after);
  if (sameSurfaceAddress(from, target)) return { ...next, blocked: [...next.blocked, id] };
  const steps = { ...next.steps, [id]: target };
  if (from.floor === target.floor || key(target.cell) !== key(plan.focus.cell)) return { ...next, steps };
  const gate = { floor: from.floor, cell: target.cell };
  const sourceSide = next.floors[from.floor]?.gates[key(gate.cell)], destinationSide = next.floors[target.floor]?.gates[key(target.cell)];
  // Matching opposite openings suggest a reversible pair. Returns still verify each direction.
  const linked = sourceSide !== undefined && destinationSide === opposite[sourceSide];
  return { ...next, steps, links: linked
    ? { ...next.links, [addressKey(gate)]: target, [addressKey(target)]: gate } : next.links };
}

type RouteNode = { address: Address; first: SurfacePlan | null; depth: number };
type Frontier = { plan: SurfacePlan; cost: number };

export function planAcrossSurfaces(memory: SurfaceMemory, start: Address, remaining: number): SurfacePlan | null {
  const queue: RouteNode[] = [{ address: start, first: null, depth: 0 }], seen = new Set([addressKey(start)]);
  const free = Object.fromEntries(Object.entries(memory.floors).map(([floor, map]) => [floor, new Set(map.free)]));
  const blocked = new Set(memory.blocked);
  let frontier: Frontier | null = null;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const { address, first, depth } = queue[cursor]!, { floor, cell } = address, map = memory.floors[floor]!;
    if (map.goal && key(map.goal) === key(cell) && first) return first;
    if (depth >= remaining) continue;
    const originGate = map.gates[key(cell)];
    for (const direction of directions) {
      const id = stepKey(address, direction);
      if (blocked.has(id)) continue;
      const [, dx, dy] = surfaceDirections[direction];
      const approach: Address = { floor, cell: [cell[0] + dx, cell[1] + dy] };
      const targetGate = map.gates[key(approach.cell)];
      const exiting = originGate === undefined || originGate === direction;
      const inverse = originGate !== undefined && opposite[originGate] === direction;
      const entering = exiting && targetGate !== undefined && targetGate === opposite[direction];
      const locus = inverse ? address : approach;
      const linked = inverse || entering ? memory.links[addressKey(locus)] : undefined;
      const measured = memory.steps[id] ?? linked;
      if (!measured && (inverse || entering)) {
        const cost = depth + (inverse ? directions.length : 0);
        if (!frontier || cost < frontier.cost) frontier = { cost, plan: first ?? { direction, expected: null, focus: locus, kind: 'probe' } };
        continue;
      }
      if (!measured && (!exiting || targetGate !== undefined || !free[floor]!.has(key(approach.cell)))) continue;
      const next = measured ?? approach, nextKey = addressKey(next);
      if (seen.has(nextKey) || !memory.floors[next.floor]) continue;
      seen.add(nextKey);
      queue.push({ address: next, depth: depth + 1, first: first ?? {
        direction, expected: next, focus: locus, kind: next.floor !== floor ? 'linked' : 'move',
      } });
    }
  }
  return frontier?.plan ?? null;
}
