import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export type ClickRegionEvidence = {
  readonly point: NativePoint;
  readonly family: string;
  readonly beforeRef: string;
  readonly afterRef: string;
  readonly levelEpoch: number;
  readonly before: readonly (number | null)[];
  readonly after: readonly (number | null)[];
};

export type ClickMarkerEvidence = Omit<ClickRegionEvidence, 'before' | 'after'> & {
  readonly marker: NativePoint;
  readonly value: number;
};

export function singleChangedPoint(before: NativeRows, after: NativeRows): NativePoint | null {
  let point: NativePoint | null = null;
  for (let y = 0; y < after.length; y++) for (let x = 0; x < after[y]!.length; x++) {
    if (before[y]?.[x] === after[y]![x]) continue;
    if (point) return null;
    point = [x, y];
  }
  return point;
}

export function markerDisplacement(before: NativeRows, after: NativeRows, [x, y]: NativePoint,
  [dx, dy]: NativePoint, limit: number): NativePoint | null {
  const value = before[y]?.[x];
  if (value === undefined || after[y]?.[x] === value) return null;
  let displacement: NativePoint | null = null;
  for (let step = 1; step <= limit; step++) {
    const a = x + step * dx, b = y + step * dy;
    if (after[b]?.[a] !== value || before[b]?.[a] === value) continue;
    if (displacement) return null;
    displacement = [a - x, b - y];
  }
  return displacement;
}

export function solidRegionValue(rows: NativeRows, [left, top, right, bottom]: NativeBox) {
  const value = rows[top]?.[left];
  if (value === undefined) return null;
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    if (rows[y]?.[x] !== value) return null;
  }
  return value;
}
