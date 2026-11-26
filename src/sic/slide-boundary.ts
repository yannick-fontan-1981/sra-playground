import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { supportParts } from '../logos-engine/v6-support-measurements.ts';

type Part = ReturnType<typeof supportParts>[number];

export function rectangularSlideInteriors(rows: NativeRows, parts: readonly Part[]): NativeBox[] {
  return parts.flatMap(({ bbox: { left, top, right, bottom, width, height }, area, value }) => {
    if (width < 8 || height < 8 || area !== 2 * (width + height) - 4) return [];
    const horizontal = [rows[top], rows[bottom]].every(row => row?.slice(left, right + 1).every(pixel => pixel === value));
    const vertical = rows.slice(top, bottom + 1).every(row => row[left] === value && row[right] === value);
    return horizontal && vertical ? [[left + 1, top + 1, right - 1, bottom - 1]] : [];
  });
}

export type SlideBoundary = {
  claim_ref: string;
  directed_edge_pair_ref: string;
  playable_origin_row: number;
  playable_origin_column: number;
  playable_row_count: number;
  playable_column_count: number;
  cell_row_pitch: number;
  cell_column_pitch: number;
};

/** Ordered, consecutive body positions are in column/row order. A missing body breaks the track. */
export function measureSlideBoundary(positions: readonly (NativePoint | null)[], bounds: NativeBox,
  width: number, height: number, direction: NativePoint, ref: string): SlideBoundary | null {
  const [left, top, right, bottom] = bounds;
  const columns = (right - left + 1) / width, rows = (bottom - top + 1) / height;
  const [dc, dr] = direction;
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || Math.abs(dc) + Math.abs(dr) !== 1) return null;
  const cells = positions.map(at => at && [(at[0] - left) / width, (at[1] - top) / height]);
  if (cells.some(at => at && (!at.every(Number.isInteger) || at[0]! < 0 || at[0]! >= columns || at[1]! < 0 || at[1]! >= rows))) return null;
  const axis = dc ? 0 : 1, other = 1 - axis, sign = dc || dr, length = dc ? columns : rows;
  if (length < 3) return null;
  const normal = (a?: number[] | null, b?: number[] | null) => !!a && !!b
    && a[other] === b[other] && b[axis]! - a[axis]! === sign;
  const crossed = cells.some((a, index) => {
    const b = cells[index + 1];
    if (!a || !b || a[other] !== b[other]) return false;
    return a[axis] === (sign > 0 ? length - 1 : 0) && b[axis] === (sign > 0 ? 0 : length - 1)
      && (normal(cells[index - 1], a) || normal(b, cells[index + 2]));
  });
  return crossed ? { claim_ref: ref, directed_edge_pair_ref: `edge_pair:${dr}:${dc}`,
    playable_origin_row: top, playable_origin_column: left, playable_row_count: rows, playable_column_count: columns,
    cell_row_pitch: height, cell_column_pitch: width } : null;
}

export function slideBoundaryMatches(fact: SlideBoundary, [left, top, right, bottom]: NativeBox, width: number, height: number) {
  return fact.playable_origin_column === left && fact.playable_origin_row === top && fact.cell_column_pitch === width
    && fact.cell_row_pitch === height && fact.playable_column_count * width === right - left + 1
    && fact.playable_row_count * height === bottom - top + 1;
}
