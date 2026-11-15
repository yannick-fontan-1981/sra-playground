import { gauge_related_marks } from '../logos-engine/v6-inventory-continuation.ts';
import { type ObservedMeter, strips } from '../logos-engine/v6-inventory-caller-context.ts';
import { searchManagedAccess } from '../logos-engine/v6-morphology-managed.ts';
import type { MorphologyPair } from '../logos-engine/v6-morphology-measurements.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export type FramedRotation = {
  shape: string; peerScale: number; delta: number; station: number[]; evidence: string;
};
export type BodyOnSurface = { at: NativePoint; pitch: number; floor: number };
export type ManagedFramedPlan = {
  command: string; landing: NativePoint; target: NativePoint; contact: boolean;
  obligation: 'rotation' | 'recharge' | 'exit';
  effect: 'rotation' | 'recharge' | 'exit' | null;
  reserve: number; orientationAfter: number; steps: number; recharges: number;
  targetBox: NativeBox; meter: NonNullable<ReturnType<ObservedMeter['forecast']>>;
};

export const pointKey = (point: NativePoint) => point.join(',');
export const pixelsAt = (rows: NativeRows, [x, y]: NativePoint, pitch: number) =>
  rows.slice(y, y + pitch).flatMap(row => row.slice(x, x + pitch));

const same = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);
const mod = (n: number, base: number) => ((n % base) + base) % base;

export function framedResidual(pair: MorphologyPair, peerScale: number) {
  const peers = pair.scales.flatMap((scale, i) => scale === peerScale ? [i] : []);
  if (peers.length !== 1 || pair.quarter_turns === null) return null;
  return peers[0] === 0 ? pair.quarter_turns : mod(-pair.quarter_turns, 4);
}

export function observedFramedRotation(first: MorphologyPair, second: MorphologyPair, station: number[], evidence: string): FramedRotation | null {
  if (first.shape_class !== second.shape_class || !same(first.scales, second.scales)
    || !same(first.palette_values, second.palette_values) || first.sites.some((box, i) => !same(box, second.sites[i]!))) return null;
  const steady = first.orientations.flatMap((orientation, i) => orientation === second.orientations[i] ? [i] : []);
  if (steady.length !== 1) return null;
  const peerScale = first.scales[steady[0]!]!;
  const before = framedResidual(first, peerScale), after = framedResidual(second, peerScale);
  if (before === null || after === null || before === after) return null;
  return { shape: first.shape_class, peerScale, delta: mod(after - before, 4), station, evidence };
}

type Forecast = ManagedFramedPlan['meter'];
export function stripUnits(rows: NativeRows, meter: Forecast) {
  return strips(rows).get(JSON.stringify(meter.measured_strip)) ?? 0;
}

export function chooseManagedFramedPlan(rows: NativeRows, parts: Parameters<typeof gauge_related_marks>[0],
  pair: MorphologyPair, body: BodyOnSurface, beneath: number[] | null, rotation: FramedRotation, meter: Forecast,
  directions: Readonly<Record<string, NativePoint>>, blocked: readonly string[], remaining: number): ManagedFramedPlan | null {
  if (pair.shape_class !== rotation.shape || pair.palette_values[0] !== pair.palette_values[1] || remaining < 1) return null;
  const residual = framedResidual(pair, rotation.peerScale);
  if (residual === null) return null;
  const { pitch, at, floor } = body, peerIndex = pair.scales.indexOf(rotation.peerScale);
  const targetBox = pair.sites[peerIndex] as unknown as NativeBox;
  const centerAt = ([l, t, r, b]: readonly number[]): NativePoint => [(l! + r! + 1 - pitch) / 2, (t! + b! + 1 - pitch) / 2];
  const peer = centerAt(targetBox);
  const chargeSites = new Set(gauge_related_marks(parts, meter, [pitch, pitch], pair.sites).map(box => pointKey(centerAt(box))));
  const { observation_ref, level_epoch } = meter;
  const current = { observation_ref, level_epoch }, evidence = [observation_ref, rotation.evidence];
  const cells: NativePoint[] = [], modifiers = [], charges = [];
  for (let y = mod(at[1], pitch); y + pitch <= rows.length; y += pitch) {
    for (let x = mod(at[0], pitch); x + pitch <= rows[y]!.length; x += pitch) {
      const p: NativePoint = [x, y], address = pointKey(p), occupied = same(p, at);
      const pixels = occupied && beneath ? beneath : pixelsAt(rows, p, pitch);
      const modifier = same(pixels, rotation.station), charge = chargeSites.has(address);
      const floorOrRim = pixels.every((value, i) => value === floor || (
        x + i % pitch >= targetBox[0] && x + i % pitch <= targetBox[2] &&
        y + Math.floor(i / pitch) >= targetBox[1] && y + Math.floor(i / pitch) <= targetBox[3]));
      if (!occupied && (blocked.includes(address) || (!floorOrRim && !modifier && !charge && !same(p, peer)))) continue;
      cells.push(p);
      if (modifier) modifiers.push({ id: 'rotation:' + address, sites: [p], evidence });
      if (charge) charges.push({ id: 'charge:' + address, sites: [p], evidence: [observation_ref], status: 'hypothesis' });
    }
  }
  if (!cells.some(p => same(p, peer))) return null;
  const moves = Object.fromEntries(Object.entries(directions).map(([command, [dx, dy]]) => [command, [dx * pitch, dy * pitch]]));
  const layout = { ...current, start: at, cells, modifiers, charges, peers: [{ id: 'exit', sites: [peer], evidence }], moves };
  const orientation = { ...current, modulus: 4, residual, entry_delta: rotation.delta, status: 'revalidated_transfer_hypothesis', evidence };
  const result = searchManagedAccess(layout, meter, orientation, { actionBudget: remaining, maxStates: 15000, maxPrefix: 1 });
  const selected = result.options[0], step = selected?.prefix[0];
  if (!step || !Object.hasOwn(directions, step.command)) return null;
  const target = selected.next_composition;
  return {
    command: step.command, landing: step.to, target: target.to, contact: !!target.peer,
    obligation: target.charge ? 'recharge' : target.modifier ? 'rotation' : 'exit',
    effect: step.charge ? 'recharge' : step.modifier ? 'rotation' : step.peer ? 'exit' : null,
    reserve: step.remaining_before, orientationAfter: step.orientation_after,
    steps: selected.primitive_count, recharges: selected.charge_order.length, targetBox, meter,
  };
}
