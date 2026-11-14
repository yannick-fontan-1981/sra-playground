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

export function solidRegionValue(rows: NativeRows, [left, top, right, bottom]: NativeBox) {
  const value = rows[top]?.[left];
  if (value === undefined) return null;
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    if (rows[y]?.[x] !== value) return null;
  }
  return value;
}
