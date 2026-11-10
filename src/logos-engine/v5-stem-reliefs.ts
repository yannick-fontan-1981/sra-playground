/** Ordered relief measurements from pinned V5 capabilities/stem_reliefs.py.
 * A measured stem or seam is public geometry, never a calibrated tool law.
 * Coordinates in this module follow V5 (row, column).
 */
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type RC = readonly [number, number];
const key = (row: number, column: number): string => `${row},${column}`;
const comparePoint = (a: RC, b: RC): number => a[0] - b[0] || a[1] - b[1];

export function reliefRuns(values: Iterable<number>): number[][] {
  const ordered = [...values].sort((a, b) => a - b);
  if (!ordered.length) return [];
  const result: number[][] = [];
  let start = ordered[0]!, previous = start;
  for (const value of ordered.slice(1)) {
    if (value !== previous + 1) { result.push([start, previous]); start = value; }
    previous = value;
  }
  result.push([start, previous]); return result;
}

/** Source keyword arguments are retained in one explicit request mapping. */
export function measureRankedCuts(rows: NativeRows, request: R): R {
  const { rank_columns: columns, rank_width: rankWidth, reference_row: referenceRow,
    reference_columns: referenceColumns, reference_value: referenceValue,
    band_top: top, band_bottom: bottom, upper_value: upper, lower_value: lower } = request;
  const height = rows.length, width = rows[0]?.length ?? 0;
  if (!height || rows.some(row => row.length !== width) || rankWidth < 1
    || !(0 <= top && top < bottom && bottom < height) || !(0 <= referenceRow && referenceRow < height)
    || !columns.length || upper === lower
    || columns.some((c: number) => c < 0 || c + rankWidth > width)
    || referenceColumns.some((c: number) => c < 0 || c >= width)) {
    throw new RangeError('invalid ranked seam measurement request');
  }
  const visible = referenceColumns.length > 0
    && referenceColumns.every((c: number) => rows[referenceRow]![c] === referenceValue);
  const cuts: number[][] = [], offsets: (number | null)[] = [];
  for (const column of columns as number[]) {
    const matches: number[] = [];
    for (let row = top + 1; row < bottom; row++) {
      let layers = true;
      const seam = new Set<number>();
      for (let col = column; col < column + rankWidth; col++) {
        if (rows[row - 1]![col] !== upper || rows[row + 1]![col] !== lower) layers = false;
        seam.add(rows[row]![col]!);
      }
      if (layers && seam.size === 1 && rows[row]![column] !== upper && rows[row]![column] !== lower) matches.push(row);
    }
    cuts.push(matches); offsets.push(visible && matches.length === 1 ? matches[0]! - referenceRow : null);
  }
  return { reference_visible: visible, reference_row: referenceRow, reference_columns: [...referenceColumns],
    rank_columns: [...columns], rank_width_pixels: rankWidth, cut_rows_by_rank: cuts, signed_cut_offsets: offsets,
    uncertain_rank_indexes: offsets.flatMap((offset, index) => offset === null ? [index] : []) };
}

export function measureStemReliefs(components: readonly R[], configuration: R): R {
  const required = ['minimum_rank_count', 'maximum_rank_count', 'maximum_component_count',
    'maximum_alternatives_per_component', 'axis_directions'];
  if (required.some(name => !Object.hasOwn(configuration, name))) return {};
  const minimum = Math.trunc(Number(configuration.minimum_rank_count)), maximum = Math.trunc(Number(configuration.maximum_rank_count)),
    limit = Math.trunc(Number(configuration.maximum_alternatives_per_component)), directions: string[] = configuration.axis_directions;
  if (minimum < 2 || maximum < minimum || limit < 1) throw new RangeError('invalid ordered relief measurement bounds');
  if (directions.some(axis => !['up', 'down', 'left', 'right'].includes(axis))) throw new RangeError('unknown ordered relief measurement axis');
  if (components.length > Math.trunc(Number(configuration.maximum_component_count))) return {};
  const result: R = {};
  for (const component of components) {
    const absolute = new Map<string, RC>();
    for (const point of component.pixels as RC[]) absolute.set(key(...point), point);
    const alternatives: R[] = []; let truncated = false;
    for (const axis of directions) {
      const horizontal = axis === 'up' || axis === 'down', sign = axis === 'up' || axis === 'left' ? -1 : 1;
      const points = [...absolute.values()].map(([row, col]): RC => horizontal ? [row, col] : [col, row]).sort(comparePoint);
      const mask = new Set(points.map(point => key(...point))), rows = new Map<number, Set<number>>();
      for (const [row, col] of points) {
        if (!rows.has(row)) rows.set(row, new Set());
        rows.get(row)!.add(col);
      }
      let rayHeights: Map<string, number> | null = null;
      for (const [baseline, columns] of rows) {
        for (const [leftRaw, rightRaw] of reliefRuns(columns)) {
          const left = leftRaw!, right = rightRaw!;
          if (right - left + 1 < minimum * 2 - 1) continue;
          const neighborColumns: number[] = [];
          for (let col = left; col <= right; col++) if (mask.has(key(baseline + sign, col))) neighborColumns.push(col);
          const neighborBands = reliefRuns(neighborColumns);
          if (neighborBands.length < minimum) continue;
          if (rayHeights === null) {
            rayHeights = new Map();
            for (const [row, col] of sign > 0 ? [...points].reverse() : points) {
              rayHeights.set(key(row, col), 1 + (rayHeights.get(key(row + sign, col)) ?? 0));
            }
          }
          const bands: number[][] = [];
          for (const [firstRaw, lastRaw] of neighborBands) {
            const first = firstRaw!, last = lastRaw!, heights: number[] = [];
            for (let col = first; col <= last; col++) heights.push(rayHeights.get(key(baseline + sign, col))!);
            if (new Set(heights).size === 1) bands.push([first, last, heights[0]!]);
          }
          const widths = [...new Set(bands.map(([a, b]) => b! - a! + 1))].sort((a, b) => a - b);
          for (const width of widths) {
            const cohort = bands.filter(([a, b]) => b! - a! + 1 === width);
            if (!(minimum <= cohort.length && cohort.length <= maximum)) continue;
            const pitches = new Set(cohort.slice(1).map((b, i) => b[0]! - cohort[i]![0]!));
            if (pitches.size !== 1) continue;
            const pitch = pitches.values().next().value!;
            if (alternatives.length === limit) { truncated = true; break; }
            alternatives.push({ axis_direction: axis, stem_origin: horizontal ? [baseline, left] : [left, baseline],
              stem_pixel_length: right - left + 1,
              rank_origins: cohort.map(([a]) => horizontal ? [baseline, a!] : [a!, baseline]),
              rank_width_pixels: width, rank_pitch_pixels: pitch, rank_height_pixels: cohort.map(b => b[2]!),
              excluded_bands: bands.filter(b => !cohort.includes(b)) });
          }
          if (truncated) break;
        }
        if (truncated) break;
      }
      if (truncated) break;
    }
    if (alternatives.length || truncated) {
      const facts: R = { stem_relief_alternatives: alternatives, stem_relief_domain_truncated: truncated,
        stem_relief_alternative_count: alternatives.length, stem_relief_unique_profile: alternatives.length === 1 && !truncated,
        stem_relief_source_component_ref: component.component_id, stem_relief_palette_value: component.value };
      if (facts.stem_relief_unique_profile) {
        for (const name of Object.keys(alternatives[0]!).sort()) facts['stem_relief_' + name] = alternatives[0]![name];
      }
      result[component.component_id] = facts;
    }
  }
  return result;
}
