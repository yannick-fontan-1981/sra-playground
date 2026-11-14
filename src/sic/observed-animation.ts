import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export type AnimatedCellEvidence = {
  readonly action: string;
  readonly family: string;
  readonly beforeRef: string;
  readonly afterRef: string;
  readonly levelEpoch: number;
  readonly cells: readonly number[];
};

export function measureAnimatedCells(before: NativeRows, after: NativeRows, frames: readonly NativeRows[],
  points: readonly NativePoint[]) {
  const initial = points.map(([x, y]) => before[y]?.[x]);
  if (initial.some(color => color === undefined)
    || points.some(([x, y], i) => after[y]?.[x] !== initial[i])) return [];
  const changes = frames.map(frame => points.flatMap(([x, y], i) => frame[y]?.[x] !== initial[i] ? [i] : []));
  const strongest = changes.reduce((best, cells) => cells.length > best.length ? cells : best, [] as number[]);
  return changes.every(cells => cells.every(cell => strongest.includes(cell))) ? strongest : [];
}
