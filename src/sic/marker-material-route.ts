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

export function nextMarkerMaterialMove(measured: ConstellationEvidence, keys: readonly string[], dismissed: readonly string[]) {
  const model = measured.model!, regions = model.materialRegions!, active = measured.active!;
  if (measured.bodies.length !== model.targets.size) return null;
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
  if (!best) return null;
  const destination = best.destinations[active]!;
  const body = measured.bodies[active]!, current = measured.poses[active]!, mask = body.mask.sorted();
  const goals = new Map(destination.poses.map(pose => [pointKey(pose), pose]));
  if (body.color === destination.color && goals.has(pointKey(current))) {
    const allPlaced = best.destinations.every((target, owner) => target.color === measured.bodies[owner]!.color
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
