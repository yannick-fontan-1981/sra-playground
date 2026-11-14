import { symbolicDigest } from '../logos-engine/v6-hash.ts';
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
