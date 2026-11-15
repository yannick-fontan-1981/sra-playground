import { gauge_related_marks } from '../logos-engine/v6-inventory-continuation.ts';
import { type ObservedMeter, strips } from '../logos-engine/v6-inventory-caller-context.ts';
import { searchManagedAccess } from '../logos-engine/v6-morphology-managed.ts';
import type { MorphologyPair } from '../logos-engine/v6-morphology-measurements.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export type FramedRotation = {
  shape: string; peerScale: number; delta: number; station: number[]; evidence: string;
};
export type FramedTransport = { from: NativePoint; action: string; landing: NativePoint; evidence: string };
export type FramedReserve = { row: number; left: number; right: number; active: number; depleted: number; cost: number; samples: number };
export type BodyOnSurface = { at: NativePoint; pitch: number; floor: number };
export type ManagedFramedPlan = {
  command: string; landing: NativePoint; target: NativePoint; contact: boolean;
  obligation: 'rotation' | 'recharge' | 'exit' | 'color' | 'transport';
  effect: 'rotation' | 'recharge' | 'exit' | 'color' | 'transport' | null;
  reserve: number; orientationAfter: number; steps: number; recharges: number;
  targetBox: NativeBox; meter: NonNullable<ReturnType<ObservedMeter['forecast']>>;
  reserveBand?: FramedReserve; colorAfter?: number; mobileIndex?: number;
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

export function reserveSteps(rows: NativeRows, reserve: FramedReserve) {
  return Math.floor(rows[reserve.row]!.slice(reserve.left, reserve.right).filter(value => value === reserve.active).length / reserve.cost);
}

export function observeFramedReserve(first: NativeRows, second: NativeRows, surface: NativeBox, known?: FramedReserve): FramedReserve | null {
  if (known) {
    const consumed = reserveSteps(first, known) - reserveSteps(second, known);
    return consumed === 1 ? { ...known, samples: known.samples + 1 } : known;
  }
  for (let y = surface[3] + 1; y + 1 < first.length; y++) {
    const line = first[y]!, returned = second[y]!, lost = line.flatMap((value, x) => value === returned[x] ? [] : [x]);
    if (lost.length === 0 || lost.at(-1)! - lost[0]! + 1 !== lost.length) continue;
    const active = line[lost[0]!]!, depleted = returned[lost[0]!]!;
    if (!lost.every(x => line[x] === active && returned[x] === depleted
      && first[y + 1]![x] === active && second[y + 1]![x] === depleted)) continue;
    let left = lost[0]!, right = lost.at(-1)! + 1;
    const part = (x: number) => [active, depleted].includes(line[x]!) && [active, depleted].includes(returned[x]!);
    while (left > 0 && part(left - 1)) left--;
    while (right < line.length && part(right)) right++;
    if (right - left < lost.length * 5 || (right - left) % lost.length !== 0) continue;
    return { row: y, left, right, active, depleted, cost: lost.length, samples: 1 };
  }
  return null;
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

type FramedSurface = {
  body: BodyOnSurface; surface: NativeBox; beneath: readonly number[] | null; blocked: readonly string[];
  transports: readonly FramedTransport[]; directions: Readonly<Record<string, NativePoint>>;
};
type Landing = { entry: NativePoint; to: NativePoint; evidence: string[] };

function transportLandings(parts: Parameters<typeof gauge_related_marks>[0],
  model: FramedSurface, clear: ReadonlySet<string>): Landing[] {
  const { body: { at, pitch }, transports, directions } = model;
  const bands = parts.flatMap(part => {
    const [left, top, right, bottom] = part.bbox;
    if (!part.rectangular || part.area !== pitch || Math.min(right - left, bottom - top) !== 0) return [];
    const candidates: { entry: NativePoint; direction: NativePoint }[] = left === right
      ? [{ entry: [right + 1, top], direction: [1, 0] }, { entry: [left - pitch, top], direction: [-1, 0] }]
      : [{ entry: [left, bottom + 1], direction: [0, 1] }, { entry: [left, top - pitch], direction: [0, -1] }];
    return candidates.filter(({ entry }) => entry.every((value, i) => mod(value - at[i]!, pitch) === 0) && clear.has(pointKey(entry)))
      .map(candidate => ({ ...candidate, color: part.color }));
  });
  const landings = new Map<string, Landing>(), matchedBands = new Set<number>();
  for (const t of transports) {
    const move = directions[t.action];
    if (!move) continue;
    const entry: NativePoint = [t.from[0] + move[0] * pitch, t.from[1] + move[1] * pitch];
    if (!clear.has(pointKey(entry)) || !clear.has(pointKey(t.landing))) continue;
    landings.set(pointKey(entry), { entry, to: t.landing, evidence: [t.evidence] });
    for (const band of bands) {
      if (!same(band.entry, entry)) continue;
      const [dx, dy] = band.direction, dxObserved = t.landing[0] - entry[0], dyObserved = t.landing[1] - entry[1];
      if (dxObserved * dx + dyObserved * dy > 0 && dxObserved * dy === dyObserved * dx) matchedBands.add(band.color);
    }
  }
  for (const { color, entry, direction } of bands) {
    if (landings.has(pointKey(entry)) || !matchedBands.has(color)) continue;
    const [dx, dy] = direction;
    let to = entry;
    while (true) {
      const next: NativePoint = [to[0] + dx * pitch, to[1] + dy * pitch];
      if (!clear.has(pointKey(next))) break;
      to = next;
    }
    if (!same(entry, to)) landings.set(pointKey(entry), { entry, to, evidence: transports.map(t => t.evidence) });
  }
  return [...landings.values()];
}

export function chooseManagedTransitPlan(rows: NativeRows, parts: Parameters<typeof gauge_related_marks>[0],
  pair: MorphologyPair, model: FramedSurface, rotation: FramedRotation, reserve: FramedReserve,
  context: { level_epoch: number; observation_ref: string }, remaining: number): ManagedFramedPlan | null {
  if (pair.shape_class !== rotation.shape || reserve.samples < 2 || !model.transports.length || remaining < 1) return null;
  const turn = framedResidual(pair, rotation.peerScale), peerIndex = pair.scales.indexOf(rotation.peerScale);
  if (turn === null || peerIndex < 0 || pair.sites.length !== 2) return null;
  const { body: { at, pitch, floor }, surface, beneath, blocked, directions } = model;
  const targetBox = pair.sites[peerIndex] as unknown as NativeBox, mobileIndex = 1 - peerIndex;
  const wanted = pair.palette_values[peerIndex]!, initial = pair.palette_values[mobileIndex]!;
  const peer: NativePoint = [(targetBox[0] + targetBox[2] + 1 - pitch) / 2, (targetBox[1] + targetBox[3] + 1 - pitch) / 2];
  if (!peer.every((value, i) => Number.isInteger(value) && mod(value - at[i]!, pitch) === 0)) return null;
  const { observation_ref } = context, evidence = [observation_ref, rotation.evidence];
  const cells: NativePoint[] = [], clear = new Set<string>();
  const charges = [], modifiers = [], features = [];
  for (let y = mod(at[1], pitch); y + pitch - 1 <= surface[3]; y += pitch) {
    if (y < surface[1]) continue;
    for (let x = mod(at[0], pitch); x + pitch - 1 <= surface[2]; x += pitch) {
      if (x < surface[0]) continue;
      const cell: NativePoint = [x, y], address = pointKey(cell), occupied = same(cell, at), goal = same(cell, peer);
      const pixels = occupied && beneath ? beneath : pixelsAt(rows, cell, pitch), colors = new Set(pixels);
      const floorArea = pixels.filter(value => value === floor).length;
      const walkable = floorArea * 4 >= pixels.length * 3 && colors.size <= 2;
      const rotates = same(pixels, rotation.station);
      const charge = floorArea * 2 > pixels.length && colors.size === 2 && colors.has(reserve.active);
      const color = initial !== wanted && floorArea * 2 > pixels.length && colors.size >= 4 && colors.has(initial) && colors.has(wanted);
      if (!occupied && (blocked.includes(address) || !(goal || walkable || rotates || charge || color))) continue;
      cells.push(cell);
      if (walkable && !goal && !charge) clear.add(address);
      if (rotates) modifiers.push({ id: address, sites: [cell], evidence });
      if (charge) charges.push({ id: address, sites: [cell], evidence: [observation_ref], status: 'hypothesis' });
      if (color) features.push({ id: address, sites: [cell], uncertain_sources: [],
        effects: [{ from_color: initial, to_color: wanted, mobile_site: pair.sites[mobileIndex] }] });
    }
  }
  if (!cells.some(cell => same(cell, peer)) || (initial !== wanted && features.length !== 1)) return null;
  const moves = Object.fromEntries(Object.entries(directions).map(([command, [dx, dy]]) => [command, [dx * pitch, dy * pitch]]));
  const layout = { ...context, start: at, cells, modifiers, charges, moves,
    peers: [{ id: 'exit', sites: [peer], evidence }], forced_landings: transportLandings(parts, model, clear),
    color_state: { initial, wanted, features, mobile_site: pair.sites[mobileIndex] } };
  const orientation = { ...context, modulus: 4, residual: turn, entry_delta: rotation.delta, status: 'revalidated_transfer_hypothesis', evidence };
  const fuel = reserveSteps(rows, reserve), capacity = (reserve.right - reserve.left) / reserve.cost;
  const meter = { ...context, steps_before_empty: fuel, capacity_steps: capacity };
  const planned = searchManagedAccess(layout, meter, orientation, { actionBudget: remaining, maxStates: 15000, maxPrefix: 1 }).options[0];
  const step = planned?.prefix[0];
  if (!step || !Object.hasOwn(directions, step.command)) return null;
  const target = planned.next_composition;
  const effect = step.feature ? 'color' : step.conditional_crossing?.kind === 'transport' ? 'transport'
    : step.charge ? 'recharge' : step.modifier ? 'rotation' : step.peer ? 'exit' : null;
  return {
    command: step.command, landing: step.to, target: target.to, contact: !!target.peer, effect,
    obligation: effect === 'transport' ? 'transport' : target.feature ? 'color' : target.charge ? 'recharge'
      : target.modifier ? 'rotation' : 'exit',
    reserve: step.remaining_before, orientationAfter: step.orientation_after, steps: planned.primitive_count,
    recharges: planned.charge_order.length, targetBox, meter, reserveBand: reserve, colorAfter: step.color_after, mobileIndex,
  };
}
