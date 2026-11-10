/** Exact bounded diagram geometry consumed by V6 SymbolTransactions.
 * The pinned Python source owns all shape, order and multiplicity contracts.
 * No palette role, recipe validity or action permission is inferred here. */
import { symbolicDigest } from './v6-hash.ts';
import { supportCompare, supportParts } from './v6-support-measurements.ts';
import { FrameGrid, measureConcentricFrames, sameRC, type ConcentricFrame,
  type PointCandidate, type RC, type V5Component, type Measurement } from './v5-concentric-frames.ts';

export const MAX_AREA = 4096, MAX_COMPONENTS = 512, MAX_ROWS = 16, MAX_GROUP_ITEMS = 4;
export interface DiagramRow {
  readonly left_values: readonly number[];
  readonly right_values: readonly number[];
  readonly branch_value: number;
  readonly symbol_extent: number;
}
export type EqualRowPair = readonly [ConcentricFrame, ConcentricFrame];
class DiagramBoundExceeded extends Error {
  constructor(message: string) { super(message); this.name = 'ValueError'; }
}
const componentsCache = new Map<FrameGrid, readonly V5Component[]>();
const rowsCache = new Map<FrameGrid, readonly DiagramRow[]>();
const pairsCache = new Map<FrameGrid, readonly EqualRowPair[]>();
function cached<T>(cache: Map<FrameGrid, T>, frame: FrameGrid): T | undefined {
  const value = cache.get(frame);
  if (value !== undefined) { cache.delete(frame); cache.set(frame, value); }
  return value;
}
function retain<T>(cache: Map<FrameGrid, T>, frame: FrameGrid, value: T, maximum: number): T {
  if (frame instanceof FrameGrid && Object.isFrozen(frame) && Object.isFrozen(frame.rows)
      && frame.rows.every(row => Object.isFrozen(row))) {
    cache.set(frame, value); if (cache.size > maximum) cache.delete(cache.keys().next().value!);
  }
  return value;
}
export function diagramComponents(frame: FrameGrid): readonly V5Component[] {
  const prior = cached(componentsCache, frame); if (prior) return prior;
  if (frame.height * frame.width > MAX_AREA) throw new DiagramBoundExceeded('symbol diagram area bound exceeded');
  const result = supportParts(frame.rows);
  if (result.length > MAX_COMPONENTS) throw new DiagramBoundExceeded('symbol diagram component bound exceeded');
  return retain(componentsCache, frame, Object.freeze(result), 16);
}
export function rectangularPerimeter(component: V5Component): boolean {
  const b = component.bbox;
  return Math.min(b.height, b.width) >= 3 && component.area === 2 * (b.height + b.width) - 4
    && component.relative_pixels.every(([r, c]: RC) => r === 0 || r === b.height - 1 || c === 0 || c === b.width - 1);
}
export function solidSquare(component: V5Component): boolean {
  return component.bbox.height === component.bbox.width && component.bbox.width > 1 && component.area === component.bbox.height ** 2;
}
export function threeBranchToLeft(component: V5Component): boolean {
  const b = component.bbox;
  if (b.height < 3 || b.height % 2 === 0 || b.width < 2) return false;
  const expected = new Set<string>();
  for (let r = 0; r < b.height; r++) expected.add(`${r},${b.width - 1}`);
  for (let c = 0; c < b.width; c++) expected.add(`${Math.floor(b.height / 2)},${c}`);
  const actual = new Set<string>(component.relative_pixels.map(([r, c]: RC) => `${r},${c}`));
  return expected.size === actual.size && [...expected].every(p => actual.has(p));
}
export function measureDiagramRows(frame: FrameGrid): readonly DiagramRow[] {
  const prior = cached(rowsCache, frame); if (prior) return prior;
  const components = diagramComponents(frame);
  const borders = components.filter(c => {
    const b = c.bbox; if (Math.min(b.height, b.width) < 3) return false;
    for (let r = b.top; r <= b.bottom; r++) for (let col = b.left; col <= b.right; col++)
      if ((r === b.top || r === b.bottom || col === b.left || col === b.right) && frame.rows[r]![col] !== c.value) return false;
    return true;
  });
  const result: DiagramRow[] = [];
  for (const border of borders) {
    const box = border.bbox;
    const interior = new FrameGrid(frame.rows.slice(box.top + 1, box.bottom).map(row => row.slice(box.left + 1, box.right)));
    const local = diagramComponents(interior), squares = local.filter(solidSquare);
    for (const branch of local) {
      if (!threeBranchToLeft(branch)) continue;
      const bb = branch.bbox, top = box.top + 1 + bb.top, left_pos = box.left + 1 + bb.left;
      const bottom = box.top + 1 + bb.bottom, right_pos = box.left + 1 + bb.right;
      if (borders.some(d => d.component_id !== border.component_id && box.top <= d.bbox.top && box.bottom >= d.bbox.bottom
        && box.left <= d.bbox.left && box.right >= d.bbox.right && d.bbox.top < top && top < bottom && bottom < d.bbox.bottom
        && d.bbox.left < left_pos && left_pos < right_pos && right_pos < d.bbox.right)) continue;
      const aligned = squares.filter(c => c.bbox.top === bb.top && c.bbox.bottom === bb.bottom);
      const left = aligned.filter(c => c.bbox.right < bb.left).sort((a, b) => a.bbox.left - b.bbox.left);
      const right = aligned.filter(c => c.bbox.left > bb.right).sort((a, b) => a.bbox.left - b.bbox.left);
      if (!left.length || !right.length) continue;
      if (Math.max(left.length, right.length) > MAX_GROUP_ITEMS) throw new DiagramBoundExceeded('symbol diagram group bound exceeded');
      result.push(Object.freeze({ left_values: Object.freeze(left.map(c => c.value)), right_values: Object.freeze(right.map(c => c.value)),
        branch_value: branch.value, symbol_extent: bb.height }));
      if (result.length > MAX_ROWS) throw new DiagramBoundExceeded('symbol diagram row bound exceeded');
    }
  }
  return retain(rowsCache, frame, Object.freeze(result), 8);
}
export function measureEqualRowPairs(frame: FrameGrid): readonly EqualRowPair[] {
  const prior = cached(pairsCache, frame); if (prior) return prior;
  const groups = new Map<string, { key: number[]; frames: ConcentricFrame[] }>();
  for (const f of measureConcentricFrames(frame)) {
    if (f.maximum_equal_padding !== 1) continue;
    const key = [f.top, f.bottom, f.right - f.left, f.outer_value], encoded = JSON.stringify(key);
    const group = groups.get(encoded) ?? { key, frames: [] }; group.frames.push(f); groups.set(encoded, group);
  }
  const result = [...groups.values()].sort((a, b) => supportCompare(a.key, b.key)).filter(g => g.frames.length === 2)
    .map(g => Object.freeze(g.frames.sort((a, b) => a.left - b.left)) as unknown as EqualRowPair);
  return retain(pairsCache, frame, Object.freeze(result), 16);
}
function valueAt(frame: FrameGrid, [row, column]: RC): number {
  if (row < 0 || row >= frame.height || column < 0 || column >= frame.width) {
    const error = new Error('tuple index out of range'); error.name = 'IndexError'; throw error;
  }
  return frame.rows[row]![column]!;
}
function counts(values: readonly number[]): Map<number, number> {
  const result = new Map<number, number>(); for (const v of values) result.set(v, (result.get(v) ?? 0) + 1); return result;
}
const sameValues = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
const sameBox = (a: V5Component, b: V5Component): boolean =>
  ['top', 'left', 'bottom', 'right'].every(key => a.bbox[key] === b.bbox[key]);

export function measureDiagramTransition(before: FrameGrid, after: FrameGrid): number {
  const rows = measureDiagramRows(before), squares_after = diagramComponents(after).filter(solidSquare);
  const squares_before = diagramComponents(before).filter(solidSquare);
  const changed = squares_after.filter(c => !squares_before.some(d => sameBox(c, d) && c.value === d.value));
  let matches = 0;
  for (const pair of measureEqualRowPairs(before)) {
    const values = pair.map(f => valueAt(before, f.center)), after_values = pair.map(f => valueAt(after, f.center));
    for (const row of rows) {
      const appeared = counts(changed.filter(c => c.bbox.height === row.symbol_extent && !pair.some(f =>
        f.top <= c.bbox.top && c.bbox.bottom <= f.bottom && f.left <= c.bbox.left && c.bbox.right <= f.right)).map(c => c.value));
      const required = counts(row.right_values);
      if (sameValues(values, row.left_values) && new Set(after_values).size === 1 && values.every((v, i) => v !== after_values[i])
        && [...required].every(([v, count]) => (appeared.get(v) ?? 0) >= count)) matches++;
    }
  }
  return matches;
}
export function measureDiagramContext(frame: FrameGrid, transition_match_count: number): Measurement {
  const rows = measureDiagramRows(frame);
  return { three_branch_diagram_row_count: rows.length, three_branch_pair_left_row_count: rows.filter(r => r.left_values.length === 2).length,
    diagram_left_removal_right_appearance_count: transition_match_count };
}
export function measureDiagramCandidate(frame: FrameGrid, candidate: PointCandidate, white_value: number): Measurement {
  const rows = measureDiagramRows(frame), point = candidate.point;
  if (point === null) return {};
  const components = diagramComponents(frame), extents = new Set(rows.map(r => r.symbol_extent));
  const at_center = components.filter(c => sameRC(point, [Math.floor((c.bbox.top + c.bbox.bottom) / 2), Math.floor((c.bbox.left + c.bbox.right) / 2)]));
  const solids = at_center.filter(c => solidSquare(c) && extents.has(c.bbox.height));
  const tight = measureConcentricFrames(frame).filter(f => f.outer_value === white_value && f.maximum_equal_padding === 1);
  const tight_center_values = tight.map(f => valueAt(frame, f.center));
  const hollow = at_center.filter(c => rectangularPerimeter(c) && c.bbox.height === c.bbox.width && extents.has(c.bbox.height));
  const matching_hollows = components.filter(c => solids.length === 1 && rectangularPerimeter(c)
    && c.bbox.height === c.bbox.width && extents.has(c.bbox.height) && c.value === solids[0]!.value);
  const correspondence = matching_hollows.length ? {
    source_frame_digest: symbolicDigest({ rows: frame.rows, schema_version: frame.schema_version }), point: [...point],
    solid_component_ref: solids[0]!.component_id,
    matching_hollow_component_refs: matching_hollows.map(c => c.component_id),
    matching_hollow_bboxes: matching_hollows.map(c => [c.bbox.top, c.bbox.left, c.bbox.bottom, c.bbox.right]),
  } : {};
  const pairs = measureEqualRowPairs(frame), matching_pairs = pairs.filter(pair => rows.some(row => sameValues(pair.map(f => valueAt(frame, f.center)), row.left_values)));
  return {
    diagram_point_full_symbol_count: solids.length,
    diagram_point_full_matches_hollow_count: matching_hollows.length,
    diagram_point_hollow_correspondence_context: correspondence,
    diagram_point_branch_value_square_count: solids.filter(c => rows.some(r => c.value === r.branch_value && c.bbox.height === r.symbol_extent)).length,
    diagram_point_equal_pair_center_count: pairs.filter(pair => pair.some(f => sameRC(f.center, point))).length,
    diagram_equal_pair_matches_left_group_count: matching_pairs.length,
    diagram_tight_white_center_count: tight.length,
    diagram_point_hollow_matches_tight_value_count: hollow.filter(c => tight_center_values.includes(c.value)).length,
  };
}

export const _components = diagramComponents;
export const _rectangular_perimeter = rectangularPerimeter;
export const _solid_square = solidSquare;
export const _three_branch_to_left = threeBranchToLeft;
export const measure_diagram_rows = measureDiagramRows;
export const measure_equal_row_pairs = measureEqualRowPairs;
export const measure_diagram_transition = measureDiagramTransition;
export const measure_diagram_context = measureDiagramContext;
export const measure_diagram_candidate = measureDiagramCandidate;
