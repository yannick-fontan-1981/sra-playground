import {
  constellationComponents, constellationMaterial, constellationMinus, constellationPlus,
  type ConstellationEvidence, type ConstellationMaterialRegion,
} from '../logos-engine/v6-constellation-cover.ts';
import type { NativeBox, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { pointKey, type Point } from '../logos-engine/v6-point-set.ts';

type Destination = { color: number; poses: readonly Point[] };
export type MaterialContact = { region: ConstellationMaterialRegion; expected: boolean };

export function measureMarkerMaterialRegions(observation: NativeObservation, rows: NativeRows): ConstellationMaterialRegion[] {
  const regions = observation.entities.flatMap(entity => {
    const [l, t, r, b] = entity.bbox, side = r - l + 1;
    if (side < 2 || side !== b - t + 1 || !entity.rectangular || l < 1 || t < 1 || b >= rows.length - 1 || r >= rows[t]!.length - 1) return [];
    const border = rows[t - 1]![l]!;
    if (border === entity.palette_value) return [];
    for (let y = t - 1; y <= b + 1; y++) {
      if (rows[y]![l - 1] !== border || rows[y]![r + 1] !== border) return [];
    }
    for (let x = l; x <= r; x++) {
      if (rows[t - 1]![x] !== border || rows[b + 1]![x] !== border) return [];
    }
    return [{ color: entity.palette_value, box: [l - 1, t - 1, r + 1, b + 1] as NativeBox, interior: entity.bbox, border, side }];
  });
  const compatible = regions.find(candidate => regions.some(other =>
    other.side === candidate.side && other.border === candidate.border && other.color !== candidate.color));
  return compatible ? regions.filter(region => region.side === compatible.side && region.border === compatible.border)
    .map(({ color, box, interior }) => ({ color, box, interior })) : [];
}

export function measureClippedMarkerMaterialRegions(rows: NativeRows, known: readonly ConstellationMaterialRegion[]): ConstellationMaterialRegion[] {
  const reference = known[0];
  if (!reference) return [];
  const [x, y, right] = reference.box, side = right - x + 1;
  const border = rows[y]![x]!, width = rows[0]!.length, height = rows.length;
  const colors = new Set(known.map(region => region.color));
  const regions: ConstellationMaterialRegion[] = [];
  const clip = ([l, t, r, b]: NativeBox): NativeBox => [Math.max(0, l), Math.max(0, t), Math.min(width - 1, r), Math.min(height - 1, b)];
  function read(l: number, t: number) {
    const r = l + side - 1, b = t + side - 1;
    const interior = clip([l + 1, t + 1, r - 1, b - 1]), box = clip([l, t, r, b]);
    const color = rows[interior[1]]?.[interior[0]];
    if (color === undefined || !colors.has(color) || color === border) return;
    for (let row = box[1]; row <= box[3]; row++) for (let column = box[0]; column <= box[2]; column++) {
      const edge = row === t || row === b || column === l || column === r;
      if (rows[row]![column] !== (edge ? border : color)) return;
    }
    regions.push({ box, interior, color });
  }
  for (let missing = 1; missing < side - 1; missing++) {
    for (let top = 0; top + side <= height; top++) {
      read(-missing, top);
      read(width - side + missing, top);
    }
    for (let left = 0; left + side <= width; left++) {
      read(left, -missing);
      read(left, height - side + missing);
    }
  }
  return regions;
}

const overlaps = (mask: readonly Point[], [x, y]: Point, [l, t, r, b]: NativeBox) =>
  mask.some(([dx, dy]) => l <= x + dx && x + dx <= r && t <= y + dy && y + dy <= b);

export function markerAcquisitionRisk(measured: ConstellationEvidence, rows: NativeRows, cursor: Point) {
  const model = measured.model!, regions = model.materialRegions;
  if (!regions) return (_pose: Point) => 0;
  const candidates = [...constellationMaterial(rows, model)].flatMap(([color, pixels]) => [...constellationComponents(pixels)]
    .map(part => ({ color, mask: [...part].map(point => constellationMinus(point, cursor)) }))
    .filter(({ mask }) => mask.some(([x, y]) => Math.abs(x) <= 1 && Math.abs(y) <= 1)));
  return (pose: Point) => Number(candidates.some(({ color, mask }) =>
    regions.some(region => region.color !== color && overlaps(mask, pose, region.box))));
}

export const markerContactKey = (region: ConstellationMaterialRegion, pose: Point) => JSON.stringify([region.box, pose]);

function separateMaterialDestinations(measured: ConstellationEvidence): readonly Destination[] | undefined {
  const model = measured.model!;
  const choices = measured.bodies.map(body => [...model.targets].flatMap(([color, targets]) => {
    const pins = targets.sorted(), poses = body.mask.sorted()
      .map(offset => constellationMinus(pins[0]!, offset))
      .filter(pose => pins.every(pin => body.mask.has(constellationMinus(pin, pose))));
    return poses.length ? [{ color, poses }] : [];
  }));
  let best: { cost: number; destinations: Destination[] } | undefined;
  function assign(destinations: Destination[], taken: ReadonlySet<number>, cost: number): void {
    if (best && cost >= best.cost) return;
    const index = destinations.length;
    if (index === choices.length) { best = { cost, destinations }; return; }
    for (const choice of choices[index]!) {
      if (!taken.has(choice.color)) assign([...destinations, choice], new Set([...taken, choice.color]),
        cost + Number(choice.color !== measured.bodies[index]!.color));
    }
  }
  assign([], new Set(), 0);
  return best?.destinations;
}

function sharedMaterialDestinations(measured: ConstellationEvidence): readonly Destination[] | undefined {
  const model = measured.model!;
  const pins = [...model.targets].flatMap(([color, points]) => points.sorted().map(point => ({ color, point })));
  const vectors = [...measured.motion.values()];
  const horizontal = Math.min(...vectors.filter(vector => vector[0]).map(vector => Math.abs(vector[0])));
  const vertical = Math.min(...vectors.filter(vector => vector[1]).map(vector => Math.abs(vector[1])));
  if (!Number.isFinite(horizontal) || !Number.isFinite(vertical)) return undefined;
  const distance = ([ax, ay]: Point, [bx, by]: Point) => Math.abs(ax - bx) / horizontal + Math.abs(ay - by) / vertical;
  const choices = measured.bodies.map((body, owner) => {
    const origin = measured.poses[owner]!, candidates = new Map<string, { color: number; pose: Point; covered: bigint; cost: number }>();
    for (const { color, point } of pins) for (const offset of body.mask) {
      const pose = constellationMinus(point, offset), [x, y] = pose;
      if ((x - origin[0]) % horizontal || (y - origin[1]) % vertical || x < 0 || x >= model.width || y < 0 || y >= model.height
        || model.boundary_overlay.has(pose)) continue;
      const key = color + ':' + pointKey(pose);
      if (candidates.has(key)) continue;
      const covered = pins.reduce((mask, pin, index) => pin.color === color
        && body.mask.has(constellationMinus(pin.point, pose)) ? mask | (1n << BigInt(index)) : mask, 0n);
      const sources = model.materialRegions!.filter(region => region.color === color);
      const approach = body.color === color ? 0 : Math.min(...sources.map(({ interior: [l, t, r, b] }) =>
        distance(origin, [Math.floor((l + r) / 2), Math.floor((t + b) / 2)])));
      candidates.set(key, { color, pose, covered, cost: distance(origin, pose) + approach });
    }
    return [...candidates.values()].sort((a, b) => a.cost - b.cost);
  });
  const possible = choices.reduceRight<bigint[]>((suffix, options) =>
    [options.reduce((mask, item) => mask | item.covered, suffix[0]!), ...suffix], [0n]);
  const all = (1n << BigInt(pins.length)) - 1n;
  let bestCost = Infinity, best: Destination[] | undefined;
  function assign(next: Destination[], mask: bigint, cost: number): void {
    const owner = next.length;
    if (cost >= bestCost || (mask | possible[owner]!) !== all) return;
    if (owner === choices.length) {
      bestCost = cost;
      best = next;
      return;
    }
    for (const choice of choices[owner]!) {
      assign([...next, { color: choice.color, poses: [choice.pose] }], mask | choice.covered, cost + choice.cost);
    }
  }
  assign([], 0n, 0);
  return best;
}

export function nextMarkerMaterialMove(measured: ConstellationEvidence, keys: readonly string[], dismissed: readonly string[]) {
  const model = measured.model!, regions = model.materialRegions!, active = measured.active!;
  const count = measured.bodies.length;
  if (count < model.targets.size) return null;
  const destinations = count === model.targets.size ? separateMaterialDestinations(measured) : sharedMaterialDestinations(measured);
  if (!destinations) return null;
  const destination = destinations[active]!;
  const body = measured.bodies[active]!, current = measured.poses[active]!, mask = body.mask.sorted();
  const goals = new Map(destination.poses.map(pose => [pointKey(pose), pose]));
  if (body.color === destination.color && goals.has(pointKey(current))) {
    const allPlaced = destinations.every((target, owner) => target.color === measured.bodies[owner]!.color
      && target.poses.some(pose => pointKey(pose) === pointKey(measured.poses[owner]!)));
    return allPlaced ? null : { kind: 'cycle' as const };
  }
  type Move = { key: string; next: Point; contact?: MaterialContact };
  type State = { pose: Point; ready: boolean; first: Move | null; source?: NativeBox };
  const motions = [...measured.motion].filter(([key]) => keys.includes(key));
  const queue: State[] = [{ pose: current, ready: body.color === destination.color, first: null }];
  const seen = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const state = queue[i]!, goal = state.ready ? goals.get(pointKey(state.pose)) : undefined;
    if (goal && state.first) return { kind: 'move' as const, ...state.first, goal, source: state.source };
    for (const [key, vector] of motions) {
      const next = constellationPlus(state.pose, vector), [x, y] = next;
      if (x < 0 || y < 0 || x >= model.width || y >= model.height || model.boundary_overlay.has(next)) continue;
      if (regions.some(region => region.color !== destination.color && overlaps(mask, next, region.box))) continue;
      const region = regions.find(region => !state.ready && region.color === destination.color && overlaps(mask, next, region.box));
      const expected = !!region && overlaps(mask, next, region.interior) && !dismissed.includes(markerContactKey(region, next));
      const ready = state.ready || expected;
      const visit = pointKey(next) + ':' + ready;
      if (seen.has(visit)) continue;
      seen.add(visit);
      queue.push({ pose: next, ready, source: expected ? region.box : state.source,
        first: state.first ?? { key, next, ...(region ? { contact: { region, expected } } : {}) } });
    }
  }
  return null;
}
