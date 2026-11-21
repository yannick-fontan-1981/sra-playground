import { symbolicDigest } from '../logos-engine/v6-hash.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import { orderedTransientComponentPathFacts } from '../logos-engine/v6-transient-measurements.ts';
import type { NativeBox, NativeCommand, NativePoint, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';

export type AnimatedCellEvidence = {
  readonly action: string;
  readonly family: string;
  readonly beforeRef: string;
  readonly afterRef: string;
  readonly levelEpoch: number;
  readonly cells: readonly number[];
};

export type TransientTranslationEvidence = Omit<AnimatedCellEvidence, 'cells'> & {
  readonly displacement: NativePoint;
};

/** Identify the same public silhouette away from its origin and then back again. */
export function returningTranslation(before: NativeRows, after: NativeRows, frames: readonly NativeRows[],
  footprint: readonly NativePoint[]): NativePoint | null {
  if (!footprint.length || frames.length < 2) return null;
  const [x, y] = footprint[0]!, color = before[y]?.[x];
  const left = Math.min(...footprint.map(p => p[0])), top = Math.min(...footprint.map(p => p[1]));
  const origin = [left, top].join();
  const mask = new Set(footprint.map(([u, v]) => [u - left, v - top].join()));
  if (color === undefined || mask.size !== footprint.length) return null;
  function locations(rows: NativeRows) {
    return new Set(geometricComponents(rows).filter(p => p.color === color && p.area === mask.size
      && p.mask.every(offset => mask.has(offset.join()))).map(p => [p.bbox[0], p.bbox[1]].join()));
  }
  const initial = locations(before);
  if (!initial.has(origin)) return null;
  const final = locations(after);
  if (final.size !== initial.size || [...initial].some(p => !final.has(p))) return null;
  for (const frame of frames) {
    const sites = locations(frame);
    if (sites.has(origin) || sites.size !== initial.size) continue;
    const entered = [...sites].filter(p => !initial.has(p));
    if (entered.length !== 1) continue;
    const [u, v] = entered[0]!.split(',').map(Number);
    return [u! - left, v! - top];
  }
  return null;
}

export type AnimatedContact = {
  readonly contact: NativePoint | null;
  readonly disclosure: NativePoint | null;
  readonly source: NativeBox | null;
  readonly peer: NativeBox | null;
  readonly frames: number;
};

export type AnimatedContactEvidence = AnimatedContact & Omit<AnimatedCellEvidence, 'action' | 'cells'> & {
  readonly point: NativePoint;
};

function measuredBox(facts: NativeRecord, center: string, size = center): NativeBox | null {
  const x = facts[center + '_center_column_twice'], y = facts[center + '_center_row_twice'];
  const width = facts[size + '_bbox_width'], height = facts[size + '_bbox_height'];
  if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') return null;
  const left = (x - width + 1) / 2, top = (y - height + 1) / 2;
  return [left, top, left + width - 1, top + height - 1];
}

function measuredPoint(facts: NativeRecord, prefix: string): NativePoint | null {
  const x = facts[prefix + '_column'], y = facts[prefix + '_row'];
  return facts[prefix + '_present'] === true && typeof x === 'number' && typeof y === 'number' ? [x, y] : null;
}

export function measureAnimatedContact(before: NativeRows, after: NativeRows, frames: readonly NativeRows[], command: NativeCommand): AnimatedContact {
  const intermediate = frames.length && symbolicDigest(frames.at(-1)!) === symbolicDigest(after) ? frames.slice(0, -1) : frames;
  const facts = intermediate.length ? orderedTransientComponentPathFacts(before, intermediate, after, command.action_ref, command.data) : {};
  return {
    contact: measuredPoint(facts, 'ballistic_contact_solution'),
    disclosure: measuredPoint(facts, 'ballistic_curve_disclosure'),
    source: measuredBox(facts, 'unique_transient_path_source'),
    peer: measuredBox(facts, 'unique_transient_path_source_peer', 'unique_transient_path_source_morphology_peer'),
    frames: frames.length,
  };
}

export function measureAnimatedCells(before: NativeRows, after: NativeRows, frames: readonly NativeRows[],
  points: readonly NativePoint[]) {
  const initial = points.map(([x, y]) => before[y]?.[x]);
  if (initial.some(color => color === undefined)
    || points.some(([x, y], i) => after[y]?.[x] !== initial[i])) return [];
  const changes = frames.map(frame => points.flatMap(([x, y], i) => frame[y]?.[x] !== initial[i] ? [i] : []));
  const strongest = changes.reduce((best, cells) => cells.length > best.length ? cells : best, [] as number[]);
  return changes.every(cells => cells.every(cell => strongest.includes(cell))) ? strongest : [];
}

/** Localize one repeated transient change whose pixels return to their initial state. */
export function measureReturningAnimation(before: NativeRows, after: NativeRows, frames: readonly NativeRows[],
  [left, top, right, bottom]: NativeBox) {
  const regions = new Map<string, { box: NativeBox; frames: number[] }>();
  for (const [index, frame] of frames.entries()) {
    let l = right + 1, t = bottom + 1, r = left - 1, b = top - 1;
    const changed: number[] = [];
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const initial = before[y]?.[x], transient = frame[y]?.[x];
      if (initial === undefined || transient === undefined || initial === transient || initial !== after[y]?.[x]) continue;
      l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
      changed.push((y - top) * (right - left + 1) + x - left);
    }
    if (!changed.length) continue;
    const key = changed.join(',');
    const region = regions.get(key);
    if (region) region.frames.push(index + 1);
    else regions.set(key, { box: [l, t, r, b], frames: [index + 1] });
  }
  const repeated = [...regions.values()].filter(region => region.frames.length >= 2);
  return repeated.length === 1 ? repeated[0] : undefined;
}
