/**
 * Exact bounded raster mechanics used by observed_framed_transfer.
 * Transferred from V5 parallel_bands, point_motion_spans, framed_masks,
 * framed_replacements and framed_reception_loci at 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 * Measurements preserve every admitted correspondence; they assign no game role.
 */
import { compareUnicode } from './canonical.ts';
import { symbolicDigest } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truthy } from './v6-operations.ts';
import type { V5Component } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';

export type FramedRecord = Record<string, any>;
export type FramedPoint = readonly [number, number];
/** All mechanical boxes are [top,left,bottom,right], as in V5. */
export type FramedBox = readonly [number, number, number, number];
export interface FramedFrame { rows: NativeRows; height: number; width: number }
export interface FramedEntity { entity_id: string; component: V5Component }
export interface FramedScene { entities: FramedEntity[]; frame_ref: string }
export interface FramedTranslation { entity_ref: string; delta_row: number; delta_col: number }
export interface FramedRegion {
  component_id: string; value: number;
  bbox: { top: number; left: number; bottom: number; right: number };
  pixels: readonly FramedPoint[]; supported_by_mutual_parallel_pair: boolean;
  support_refs: readonly string[];
}
export type FramedBinding = readonly [FramedRecord, readonly FramedRecord[]];
export type FramedLocus = readonly [string, FramedPoint, FramedRecord];
export type FramedLoci = readonly [FramedLocus[], boolean];

export const framedBox = (component: V5Component): FramedBox => [component.bbox.top, component.bbox.left, component.bbox.bottom, component.bbox.right];
export const framedPatch = (frame: FramedFrame, box: readonly number[]): number[][] => {
  const result: number[][] = [];
  // Temporal historical supports use Python row indexing and slice semantics;
  // ordinary current bindings separately reject out-of-frame support boxes.
  for (let y = box[0]!; y <= box[2]!; y++) result.push([...frame.rows.at(y)!.slice(box[1]!, box[3]! + 1)]);
  return result;
};
const keyOf = (value: unknown): string => JSON.stringify(value);
const numeric = (a: number, b: number): number => a - b;
export function framedCompare(a: any, b: any): number {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) { const order = framedCompare(a[i], b[i]); if (order) return order; }
    return a.length - b.length;
  }
  if (typeof a === 'string' && typeof b === 'string') return compareUnicode(a, b);
  return Number(a) - Number(b);
}
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort(compareUnicode);
const inBox = (frame: FramedFrame, box: readonly number[]): boolean => 0 <= box[0]! && box[0]! <= box[2]! && box[2]! < frame.height && 0 <= box[1]! && box[1]! <= box[3]! && box[3]! < frame.width;

export function measureParallelSolidBands(components: readonly V5Component[], contract: FramedRecord): FramedRecord {
  if (!truthy(contract)) return {};
  const bands = components.filter(c => c.area === c.bbox.width * c.bbox.height
    && Math.min(c.bbox.width, c.bbox.height) <= contract.maximum_thickness
    && Math.max(c.bbox.width, c.bbox.height) >= contract.minimum_length
    && Math.max(c.bbox.width, c.bbox.height) >= contract.minimum_axis_ratio * Math.min(c.bbox.width, c.bbox.height));
  const complete = bands.length <= contract.maximum_bands && bands.length * bands.length <= contract.maximum_pairs;
  if (!complete) return Object.fromEntries(bands.map(c => [c.component_id, { parallel_solid_band_domain_complete: false }]));
  const rows: FramedRecord = {};
  for (const component of bands) {
    const b = component.bbox, horizontal = b.width > b.height, peers: string[] = [];
    for (const peer of bands) {
      if (peer.component_id === component.component_id || peer.value !== component.value) continue;
      const a = peer.bbox;
      const same = horizontal ? b.left === a.left && b.right === a.right && b.height === a.height : b.top === a.top && b.bottom === a.bottom && b.width === a.width;
      const gap = horizontal ? Math.max(a.top - b.bottom - 1, b.top - a.bottom - 1) : Math.max(a.left - b.right - 1, b.left - a.right - 1);
      const thickness = horizontal ? b.height : b.width;
      if (same && contract.minimum_gap <= gap && gap <= contract.maximum_gap_multiple * thickness) peers.push(peer.component_id);
    }
    rows[component.component_id] = { parallel_solid_band_domain_complete: true, parallel_solid_band_peer_count: peers.length, parallel_solid_band_peer_refs: peers.sort(compareUnicode) };
  }
  return rows;
}

interface PointSpanInput {
  before: FramedScene; after: FramedScene; before_frame: FramedFrame; after_frame: FramedFrame;
  translations: readonly FramedTranslation[]; point: FramedPoint | null; action_ref: string;
  transition_ref: string; candidate_ref: string; context_epoch: number; contract: FramedRecord;
}
export function measurePointMotionSpans(input: PointSpanInput): FramedRecord {
  const { before, after, before_frame: beforeFrame, after_frame: afterFrame, translations, point, action_ref, transition_ref, candidate_ref, context_epoch, contract } = input;
  const result = (rows: FramedRecord[] = [], complete = false, status = 'not_measured'): FramedRecord => ({ point_motion_span_rows: rows, point_motion_span_domain_complete: complete, point_motion_span_measurement_status: status });
  if (!truthy(contract) || point === null) return result([], false, 'missing_point_or_contract');
  if (translations.length > contract.maximum_translations || translations.length * (translations.length - 1) / 2 > contract.maximum_pairs
    || Math.max(before.entities.length, after.entities.length) > contract.maximum_components) return result([], false, 'component_or_pair_bound_exceeded');
  if (Math.max(beforeFrame.height * beforeFrame.width, afterFrame.height * afterFrame.width) > contract.maximum_pixels) return result([], false, 'pixel_bound_exceeded');
  const old = new Map(before.entities.map(e => [e.entity_id, e.component])), current = new Map(after.entities.map(e => [e.entity_id, e.component]));
  if (old.size !== before.entities.length || current.size !== after.entities.length) throw new TypeError('duplicate point span component identity');
  const dominant = (frame: FramedFrame): number | null => {
    const counts = new Map<number, number>();
    for (const row of frame.rows) for (const value of row) counts.set(value, (counts.get(value) ?? 0) + 1);
    const greatest = Math.max(0, ...counts.values()), values = [...counts].filter(([, count]) => count === greatest).map(([value]) => value).sort(numeric);
    return values.length === 1 ? values[0]! : null;
  };
  const oldPeak = dominant(beforeFrame), newPeak = dominant(afterFrame);
  if (oldPeak === null || oldPeak !== newPeak) return result([], false, 'dominant_value_not_unique_or_changed');
  const interval = (component: V5Component, horizontal: boolean): FramedBox => horizontal
    ? [component.bbox.left, component.bbox.right, component.bbox.top, component.bbox.bottom]
    : [component.bbox.top, component.bbox.bottom, component.bbox.left, component.bbox.right];
  const borderGaps = (frame: FramedFrame, first: V5Component, second: V5Component, horizontal: boolean): boolean => {
    const [, b, low, high] = interval(first, horizontal), [c, , otherLow, otherHigh] = interval(second, horizontal);
    if (low !== otherLow || high !== otherHigh || b >= c) return false;
    for (const orthogonal of [low, high]) {
      let run = 0;
      for (let coordinate = b + 1; coordinate < c; coordinate++) {
        const value = horizontal ? frame.rows[orthogonal]![coordinate] : frame.rows[coordinate]![orthogonal];
        run = value === oldPeak ? run + 1 : 0;
        if (run > contract.maximum_interior_border_gap) return false;
      }
    }
    return true;
  };
  const results: FramedRecord[] = [];
  for (let index = 0; index < translations.length; index++) for (const second of translations.slice(index + 1)) {
    const first = translations[index]!, delta: FramedPoint = [first.delta_row, first.delta_col];
    if (delta[0] !== second.delta_row || delta[1] !== second.delta_col || (delta[0] === 0) === (delta[1] === 0)) continue;
    const horizontal = delta[0] === 0, refs = [first.entity_ref, second.entity_ref];
    if (refs.some(ref => !old.has(ref) || !current.has(ref))) continue;
    if (old.get(refs[0]!)!.value !== old.get(refs[1]!)!.value) continue;
    const ordered = [...refs].sort((a, b) => interval(old.get(a)!, horizontal)[0] - interval(old.get(b)!, horizontal)[0]);
    const left = old.get(ordered[0]!)!, right = old.get(ordered[1]!)!, newLeft = current.get(ordered[0]!)!, newRight = current.get(ordered[1]!)!;
    if (!borderGaps(beforeFrame, left, right, horizontal) || !borderGaps(afterFrame, newLeft, newRight, horizontal)) continue;
    const [a, , low, high] = interval(left, horizontal), [, b] = interval(right, horizontal), [na, , nl, nh] = interval(newLeft, horizontal), [, nb] = interval(newRight, horizontal);
    if (!equal([na - a, nb - b, nl - low, nh - high], horizontal ? [delta[1], delta[1], 0, 0] : [delta[0], delta[0], 0, 0])) continue;
    const [axisPoint, orthogonalPoint] = horizontal ? [point[1], point[0]] : point;
    if (!(low <= orthogonalPoint && orthogonalPoint <= high && (axisPoint < a || axisPoint > b) && na <= axisPoint && axisPoint <= nb)) continue;
    const stripMembers = translations.filter(t => t.delta_row === delta[0] && t.delta_col === delta[1] && old.has(t.entity_ref) && current.has(t.entity_ref)
      && interval(old.get(t.entity_ref)!, horizontal)[2] <= high && interval(old.get(t.entity_ref)!, horizontal)[3] >= low).map(t => t.entity_ref);
    if (stripMembers.some(ref => interval(old.get(ref)!, horizontal)[0] < a || interval(old.get(ref)!, horizontal)[1] > b)) continue;
    results.push({ point_span_token: symbolicDigest([transition_ref, ordered]), point_span_endpoint_refs: ordered, point_span_member_refs: [...stripMembers].sort(compareUnicode),
      point_span_member_count: stripMembers.length, point_span_before_interval: [a, b], point_span_after_interval: [na, nb], point_span_orthogonal_interval: [low, high],
      point_span_axis: horizontal ? 'column' : 'row', point_span_delta: delta, point_span_extent_preserved: true, point_span_before_side: axisPoint < a ? 'lower' : 'upper',
      point_span_point_to_lower_edge: axisPoint - na, point_span_point_to_upper_edge: nb - axisPoint, point_span_action_point: point, point_span_action_ref: action_ref,
      point_span_operator_value: beforeFrame.rows[point[0]]![point[1]], point_span_endpoint_patches: ordered.map(ref => { const box = framedBox(current.get(ref)!); return [box, framedPatch(afterFrame, box)]; }),
      point_span_transition_ref: transition_ref, point_span_candidate_ref: candidate_ref, point_span_context_epoch: context_epoch, point_span_frame_ref: after.frame_ref, point_span_domain_complete: true });
    if (results.length > contract.maximum_spans) return result([], false, 'span_bound_exceeded');
  }
  return result(results, true, 'complete');
}

export function measureCurrentPointSpanBindings(frame: FramedFrame, records: readonly FramedRecord[], contextEpoch: number, contract: FramedRecord): readonly [FramedBinding[], boolean] {
  if (!truthy(contract) || records.length > contract.maximum_recall_records) return [[], false];
  const current = new Map<string, { key: any[]; row: FramedRecord }>();
  for (const row of records) {
    if (!equal(row.context_epoch, contextEpoch)) continue;
    const patches = row.endpoint_patches ?? [];
    if (patches.length !== 2) continue;
    let valid = true;
    for (const [box, patch] of patches) {
      const [top, left, bottom, right] = box;
      if (top < 0 || left < 0 || bottom >= frame.height || right >= frame.width || patch.length !== bottom - top + 1
        || patch.some((line: readonly number[]) => line.length !== right - left + 1) || !equal(framedPatch(frame, box), patch)) { valid = false; break; }
    }
    if (!valid) continue;
    const key = [row.endpoint_refs, row.axis, row.after_interval, row.orthogonal_interval], encoded = keyOf(key);
    if (!current.has(encoded)) current.set(encoded, { key, row });
  }
  if (current.size > contract.maximum_spans) return [[], false];
  const rows: FramedBinding[] = [];
  for (const { key, row } of [...current.values()].sort((a, b) => framedCompare(a.key, b.key))) {
    const history = records.filter(r => equal(r.context_epoch, contextEpoch) && equal(r.endpoint_refs ?? [], key[0]) && equal(r.axis, key[1]) && truthy(r.source_claim_ref));
    rows.push([row, history]);
  }
  return [rows, true];
}

export function measurePointSpanLocus(frame: FramedFrame, point: FramedPoint, bindings: readonly FramedBinding[], complete: boolean): FramedRecord {
  const matches: { row: FramedRecord; samples: readonly FramedRecord[]; delta: number }[] = [];
  for (const [row, history] of bindings) {
    const [axis, orthogonal] = row.axis === 'column' ? [point[1], point[0]] : point;
    const [lower, upper] = row.after_interval, [orthoLower, orthoUpper] = row.orthogonal_interval;
    if (!(orthoLower <= orthogonal && orthogonal <= orthoUpper) || lower <= axis && axis <= upper) continue;
    const side = axis < lower ? 'lower' : 'upper', samples = history.filter(r => r.point_before_side === side && equal(r.operator_value, frame.rows[point[0]]![point[1]]));
    if (!samples.length) continue;
    const offsets = [...new Set<number>(samples.map(r => side === 'lower' ? r.point_to_lower_edge : r.point_to_upper_edge))].sort(numeric);
    if (offsets.length !== 1) continue;
    matches.push({ row, samples, delta: side === 'lower' ? axis - offsets[0]! - lower : axis + offsets[0]! - upper });
  }
  const result: FramedRecord = { point_span_recall_domain_complete: complete, point_span_locus_binding_count: matches.length };
  if (matches.length === 1 && complete) {
    const { row, samples, delta } = matches[0]!;
    Object.assign(result, { point_span_current_support_exact: true, point_span_locus_expected_delta: delta, point_span_locus_expected_distance: Math.abs(delta),
      point_span_locus_sample_count: samples.length, point_span_locus_distinct_points: new Set(samples.map(r => keyOf(r.action_point))).size,
      point_span_locus_support_claim_refs: sortedUnique(samples.map(r => r.source_claim_ref)), point_span_locus_current_endpoint_refs: row.endpoint_refs, point_span_locus_axis: row.axis });
  }
  return result;
}

export function measureFramedMaskCorrespondences(frame: FramedFrame, entities: readonly (FramedEntity | V5Component)[], contract: FramedRecord): FramedRecord {
  const incomplete = (): FramedRecord => ({ framed_mask_domain_complete: false, framed_mask_pairs: [] });
  if (!truthy(contract) || frame.height * frame.width > contract.maximum_frame_pixels || entities.length > contract.maximum_component_count) return incomplete();
  const framed: { component: V5Component; ref: string; border: number; box: FramedBox }[] = [];
  for (const entity of entities) {
    const component = 'component' in entity ? entity.component : entity, ref = 'entity_id' in entity ? entity.entity_id : component.component_id, box = component.bbox;
    if (!(contract.minimum_mask_area <= component.area && component.area <= contract.maximum_mask_area && Math.min(box.height, box.width) >= contract.minimum_mask_extent && Math.max(box.height, box.width) <= contract.maximum_mask_extent)) continue;
    const bounds: FramedBox = [box.top - 1, box.left - 1, box.bottom + 1, box.right + 1], [top, left, bottom, right] = bounds;
    if (!inBox(frame, bounds)) continue;
    const border = frame.rows[top]![left]!;
    if (border === component.value) continue;
    let valid = true;
    for (const y of [top, bottom]) for (let x = left; x <= right; x++) if (frame.rows[y]![x] !== border) valid = false;
    for (const x of [left, right]) for (let y = top; y <= bottom; y++) if (frame.rows[y]![x] !== border) valid = false;
    if (!valid) continue;
    const mask = new Set(component.relative_pixels.map(keyOf));
    for (let y = box.top; y <= box.bottom; y++) for (let x = box.left; x <= box.right; x++) if (frame.rows[y]![x] !== (mask.has(keyOf([y - box.top, x - box.left])) ? component.value : border)) valid = false;
    if (valid) framed.push({ component, ref, border, box: bounds });
  }
  if (framed.length > contract.maximum_framed_occurrences) return incomplete();
  const pairs: FramedRecord[] = [];
  for (let index = 0; index < framed.length; index++) for (const second of framed.slice(index + 1)) {
    const first = framed[index]!, a = first.component, b = second.component;
    if (a.value === b.value || a.bbox.height !== b.bbox.height || a.bbox.width !== b.bbox.width || !equal(a.relative_pixels, b.relative_pixels)) continue;
    pairs.push({ mask_digest: symbolicDigest([a.bbox.height, a.bbox.width, a.relative_pixels]), mask_extent: [a.bbox.height, a.bbox.width], mask_area: a.area,
      first_entity_ref: first.ref, second_entity_ref: second.ref, first_component_ref: a.component_id, second_component_ref: b.component_id,
      first_frame_bbox: first.box, second_frame_bbox: second.box, first_inner_value: a.value, second_inner_value: b.value, first_border_value: first.border, second_border_value: second.border });
    if (pairs.length > contract.maximum_correspondences) return incomplete();
  }
  const occurrences = framed.map(({ component, ref, border, box }) => ({ entity_ref: ref, component_ref: component.component_id,
    mask_digest: symbolicDigest([component.bbox.height, component.bbox.width, component.relative_pixels]), mask_extent: [component.bbox.height, component.bbox.width],
    mask_area: component.area, inner_value: component.value, border_value: border, frame_bbox: box, inner_bbox: framedBox(component), inner_fills_bbox: component.area === component.bbox.height * component.bbox.width }));
  return { framed_mask_domain_complete: true, framed_mask_pairs: pairs, framed_mask_occurrences: occurrences, framed_mask_pair_count: pairs.length, framed_mask_occurrence_count: framed.length };
}

export function framedGapPatches(sourceBox: FramedBox, markerBox: FramedBox, frame: FramedFrame): any[] {
  const [st, sl, sb, sr] = sourceBox, [mt, ml, mb, mr] = markerBox, boxes: [string, FramedBox][] = [];
  if (sb < mt) boxes.push(['column', [sb + 1, ml, mt - 1, mr]]);
  else if (mb < st) boxes.push(['column', [mb + 1, ml, st - 1, mr]]);
  if (sr < ml) boxes.push(['row', [mt, sr + 1, mb, ml - 1]]);
  else if (mr < sl) boxes.push(['row', [mt, mr + 1, mb, sl - 1]]);
  return boxes.filter(([, box]) => inBox(frame, box)).map(([axis, box]) => [axis, box, framedPatch(frame, box)]);
}
interface ReplacementInput {
  pairs: readonly FramedRecord[]; before: FramedScene; after: FramedScene; after_frame: FramedFrame; complete: boolean;
  action_ref: string; transition_ref: string; context_epoch: number; contract: FramedRecord;
  before_occurrences?: readonly FramedRecord[]; after_occurrences?: readonly FramedRecord[]; motion_spans?: readonly FramedRecord[];
  prior_authority?: FramedRecord | null;
}
export function measureFramedReplacements(input: ReplacementInput): FramedRecord {
  const { pairs, before, after, after_frame: frame, complete, action_ref, transition_ref, context_epoch, contract,
    before_occurrences: beforeOccurrences = [], after_occurrences: afterOccurrences = [], motion_spans: motionSpans = [], prior_authority: priorAuthority = null } = input;
  const incomplete = (): FramedRecord => ({ framed_replacement_rows: [], framed_replacement_domain_complete: false });
  if (!complete || !truthy(contract) || Math.max(before.entities.length, after.entities.length) > contract.maximum_components || pairs.length > contract.maximum_pairs) return incomplete();
  const old = new Map(before.entities.map(e => [e.entity_id, e])), rows: FramedRecord[] = [];
  for (const pair of pairs) for (const [first, second] of [['first', 'second'], ['second', 'first']] as const) {
    const source = old.get(pair[`${first}_entity_ref`]), target = old.get(pair[`${second}_entity_ref`]);
    if (!source || !target) continue;
    const a = source.component, b = target.component, signature = [a.value, a.bbox.height, a.bbox.width, a.relative_pixels];
    const same = (entity: FramedEntity): boolean => { const c = entity.component; return equal([c.value, c.bbox.height, c.bbox.width, c.relative_pixels], signature); };
    if (before.entities.filter(same).length !== 1 || after.entities.filter(same).length !== 1) continue;
    const moved = after.entities.find(same)!, c = moved.component;
    if (!equal(framedBox(c), framedBox(b)) || equal(framedBox(a), framedBox(c))) continue;
    if (after.entities.some(e => equal(framedBox(e.component), framedBox(b)) && e.component.value === b.value && equal(e.component.relative_pixels, b.relative_pixels))) continue;
    const box = pair[`${second}_frame_bbox`] as FramedBox;
    if (!inBox(frame, box)) continue;
    const [top, left, bottom, right] = box, borderValues = new Set<number>();
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) if (y === top || y === bottom || x === left || x === right) borderValues.add(frame.rows[y]![x]!);
    if (borderValues.size !== 1) continue;
    const border = [...borderValues][0]!;
    rows.push({ framed_replacement_token: symbolicDigest([transition_ref, source.entity_id, target.entity_id]), framed_replacement_source_ref: source.entity_id,
      framed_replacement_current_visible_ref: moved.entity_id, framed_replacement_marker_ref: target.entity_id, framed_replacement_tracking_lineage_agrees: moved.entity_id === source.entity_id,
      framed_replacement_marker_uniform: false, framed_replacement_gap_patches: framedGapPatches(pair[`${first}_frame_bbox`], pair[`${second}_frame_bbox`], frame),
      framed_replacement_mask_digest: pair.mask_digest, framed_replacement_mask_extent: pair.mask_extent, framed_replacement_source_inner_value: pair[`${first}_inner_value`],
      framed_replacement_source_border_value: pair[`${first}_border_value`], framed_replacement_marker_inner_value: pair[`${second}_inner_value`], framed_replacement_marker_border_value: pair[`${second}_border_value`],
      framed_replacement_after_border_value: border, framed_replacement_border_preserved: border === pair[`${first}_border_value`],
      framed_replacement_source_frame_bbox: pair[`${first}_frame_bbox`], framed_replacement_marker_frame_bbox: pair[`${second}_frame_bbox`],
      framed_replacement_delta: [c.bbox.top - a.bbox.top, c.bbox.left - a.bbox.left], framed_replacement_action_ref: action_ref, framed_replacement_transition_ref: transition_ref,
      framed_replacement_context_epoch: context_epoch, framed_replacement_frame_ref: after.frame_ref, framed_replacement_unique_preserved_copy: true, framed_replacement_marker_disappeared: true });
    if (rows.length > contract.maximum_replacements) return incomplete();
  }
  if (beforeOccurrences.length > contract.maximum_occurrences || afterOccurrences.length > contract.maximum_occurrences || motionSpans.length > contract.maximum_motion_spans) return incomplete();
  for (const source of beforeOccurrences) {
    if (truthy(source.inner_fills_bbox)) continue;
    const copiesBefore = beforeOccurrences.filter(r => equal(r.inner_value, source.inner_value) && r.mask_digest === source.mask_digest);
    const copiesAfter = afterOccurrences.filter(r => equal(r.inner_value, source.inner_value) && r.mask_digest === source.mask_digest);
    if (copiesBefore.length !== 1 || copiesAfter.length !== 1) continue;
    const displayed = copiesAfter[0]!;
    for (const span of motionSpans) {
      const [low, high] = span.point_span_before_interval, [olow, ohigh] = span.point_span_orthogonal_interval;
      const beforeBox = span.point_span_axis === 'column' ? [olow, low, ohigh, high] : [low, olow, high, ohigh];
      const inside = (box: readonly number[]): boolean => beforeBox[0] <= box[0]! && beforeBox[1] <= box[1]! && box[2]! <= beforeBox[2] && box[3]! <= beforeBox[3];
      if (inside(source.frame_bbox)) continue;
      const [dr, dc] = span.point_span_delta;
      for (const marker of beforeOccurrences) {
        if (!equal(marker.mask_extent, source.mask_extent) || !inside(marker.frame_bbox)
          || !(truthy(marker.inner_fills_bbox) || marker.mask_digest === source.mask_digest && !equal(marker.inner_value, source.inner_value))) continue;
        const [mt, ml, mb, mr] = marker.frame_bbox, projected: FramedBox = [mt + dr, ml + dc, mb + dr, mr + dc];
        if (!equal(displayed.frame_bbox, projected) || equal(displayed.frame_bbox, source.frame_bbox)) continue;
        const [st, sl] = source.frame_bbox;
        rows.push({ framed_replacement_token: symbolicDigest([transition_ref, source.entity_ref, marker.entity_ref, span.point_span_token]),
          framed_replacement_source_ref: source.entity_ref, framed_replacement_current_visible_ref: displayed.entity_ref, framed_replacement_marker_ref: marker.entity_ref,
          framed_replacement_tracking_lineage_agrees: displayed.entity_ref === source.entity_ref, framed_replacement_mask_digest: source.mask_digest, framed_replacement_mask_extent: source.mask_extent,
          framed_replacement_source_inner_value: source.inner_value, framed_replacement_source_border_value: source.border_value, framed_replacement_marker_inner_value: marker.inner_value,
          framed_replacement_marker_border_value: marker.border_value, framed_replacement_after_border_value: displayed.border_value, framed_replacement_border_preserved: equal(displayed.border_value, source.border_value),
          framed_replacement_source_frame_bbox: source.frame_bbox, framed_replacement_marker_frame_bbox: projected, framed_replacement_before_marker_frame_bbox: marker.frame_bbox,
          framed_replacement_marker_uniform: marker.inner_fills_bbox, framed_replacement_gap_patches: framedGapPatches(source.frame_bbox, projected, frame),
          framed_replacement_receiver_endpoint_refs: span.point_span_endpoint_refs, framed_replacement_delta: [projected[0] - st, projected[1] - sl], framed_replacement_action_ref: action_ref,
          framed_replacement_transition_ref: transition_ref, framed_replacement_context_epoch: context_epoch, framed_replacement_frame_ref: after.frame_ref,
          framed_replacement_unique_preserved_copy: true, framed_replacement_marker_disappeared: true });
        if (rows.length > contract.maximum_replacements) return incomplete();
      }
    }
  }
  return { framed_replacement_rows: rows.map(row => ({ ...row, framed_replacement_prior_goal_ref: priorAuthority?.active_goal_ref ?? null,
    framed_replacement_prior_subgoal_ref: priorAuthority?.subgoal_ref ?? null })), framed_replacement_domain_complete: true };
}

export function framedContains(span: FramedRecord, box: readonly number[]): boolean {
  const [lower, upper] = span.after_interval, [olower, oupper] = span.orthogonal_interval;
  const outer = span.axis === 'column' ? [olower, lower, oupper, upper] : [lower, olower, upper, oupper];
  return outer[0] <= box[0]! && outer[1] <= box[1]! && box[2]! <= outer[2] && box[3]! <= outer[3];
}
export const framedCenter = (box: readonly number[], axis: string): number => axis === 'column' ? Math.floor((box[1]! + box[3]!) / 2) : Math.floor((box[0]! + box[2]!) / 2);
export interface FramedReceptionInput {
  frame: FramedFrame; components: readonly V5Component[]; records: readonly FramedRecord[]; span_records: readonly FramedRecord[];
  context_epoch: number; mask_contract: FramedRecord; span_contract: FramedRecord; contract: FramedRecord;
  band_facts?: FramedRecord; operator_regions?: readonly FramedRegion[]; require_operator_value_match?: boolean;
}
/** Shared arithmetic; only the measured operator support differs between V5 and V6. */
function receptionLoci(input: FramedReceptionInput, regional: boolean): FramedLoci {
  const { frame, components, records, span_records: spanRecords, context_epoch: contextEpoch, mask_contract: maskContract, span_contract: spanContract, contract,
    band_facts: bandFacts = {}, operator_regions: operatorRegions = [], require_operator_value_match: requireValue = true } = input;
  if (!truthy(contract) || records.length > contract.maximum_records) return [[], false];
  const measured = measureFramedMaskCorrespondences(frame, components, maskContract), [bindings, spanComplete] = measureCurrentPointSpanBindings(frame, spanRecords, contextEpoch, spanContract);
  if (!measured.framed_mask_domain_complete || !spanComplete) return [[], false];
  const classes = records.filter(r => equal(r.context_epoch, contextEpoch) && r.border_preserved === true && truthy(r.source_claim_ref));
  const occurrences: FramedRecord[] = measured.framed_mask_occurrences ?? [], typedRelations = new Map<string, { key: string[]; rows: any[][] }>();
  for (const witness of classes) {
    if (truthy(witness.marker_uniform)) continue;
    for (const pair of measured.framed_mask_pairs) for (const [first, second] of [['first', 'second'], ['second', 'first']] as const) {
      if (!(equal(pair.mask_extent, witness.mask_extent) && equal(pair[`${first}_inner_value`], witness.source_inner_value) && equal(pair[`${first}_border_value`], witness.source_border_value)
        && equal(pair[`${second}_inner_value`], witness.marker_inner_value) && equal(pair[`${second}_border_value`], witness.marker_border_value))) continue;
      const key = [pair[`${first}_component_ref`], pair[`${second}_component_ref`]], encoded = keyOf(key);
      const entry: { key: string[]; rows: any[][] } = typedRelations.get(encoded) ?? { key, rows: [] };
      entry.rows.push([pair.mask_digest, pair[`${first}_frame_bbox`], pair[`${second}_frame_bbox`], witness]); typedRelations.set(encoded, entry);
    }
  }
  const relations = [...typedRelations.values()].sort((a, b) => framedCompare(a.key, b.key));
  if (relations.reduce((total, r) => total + r.rows.length, 0) > contract.maximum_relations) return [[], false];
  const tasks: any[][] = [];
  for (const { key: [sourceRef, markerRef], rows } of relations) for (const [mask, sourceBox, markerBox, witness] of rows) {
    for (const [span, history] of bindings) {
      if (framedContains(span, sourceBox) && !framedContains(span, markerBox)) tasks.push([mask, sourceRef, markerRef, sourceBox, markerBox, witness, span, history, true, 'first']);
      if (framedContains(span, markerBox) && !framedContains(span, sourceBox)) tasks.push([mask, sourceRef, markerRef, sourceBox, markerBox, witness, span, history, true, 'second']);
    }
    for (const pocketWitness of classes) {
      if (!truthy(pocketWitness.marker_uniform) || !equal([pocketWitness.source_inner_value, pocketWitness.source_border_value, pocketWitness.mask_extent], [witness.source_inner_value, witness.source_border_value, witness.mask_extent])) continue;
      for (const pocket of occurrences) {
        if (!(truthy(pocket.inner_fills_bbox) && equal(pocket.mask_extent, pocketWitness.mask_extent) && equal(pocket.inner_value, pocketWitness.marker_inner_value) && equal(pocket.border_value, pocketWitness.marker_border_value))) continue;
        for (const [span, history] of bindings) if (framedContains(span, pocket.frame_bbox) && !framedContains(span, sourceBox)) tasks.push([mask, sourceRef, pocket.component_ref, sourceBox, pocket.frame_bbox, pocketWitness, span, history, false, 'second']);
      }
    }
  }
  if (tasks.length > contract.maximum_tasks) return [[], false];
  const output = new Map<string, { key: any[]; facts: FramedRecord }>();
  for (const [mask, sourceRef, markerRef, sourceBox, markerBox, witness, span, , typed, moving] of tasks) {
    const axis = span.axis, sourceAxis = framedCenter(sourceBox, axis), markerAxis = framedCenter(markerBox, axis), delta = moving === 'first' ? markerAxis - sourceAxis : sourceAxis - markerAxis;
    if (delta === 0) continue;
    const shift = (box: readonly number[], side: string): number[] => box.map((v, index) => v + ((axis === 'column' ? index === 1 || index === 3 : index === 0 || index === 2) && moving === side ? delta : 0));
    const shiftedSource = shift(sourceBox, 'first'), shiftedMarker = shift(markerBox, 'second'), bridgeMatches: FramedBox[] = [];
    for (const [bridgeAxis, oldBridgeBox, patch] of witness.gap_patches ?? []) {
      if (bridgeAxis !== axis) continue;
      const [st, sl, sb, sr] = shiftedSource as [number, number, number, number], [mt, ml, mb, mr] = shiftedMarker as [number, number, number, number];
      const box: FramedBox | null = axis === 'column' ? (sb < mt ? [sb + 1, ml, mt - 1, mr] : mb < st ? [mb + 1, ml, st - 1, mr] : null)
        : sr < ml ? [mt, sr + 1, mb, ml - 1] : mr < sl ? [mt, mr + 1, mb, sl - 1] : null;
      if (box === null || !inBox(frame, box) || box[2] - box[0] !== oldBridgeBox[2] - oldBridgeBox[0] || box[3] - box[1] !== oldBridgeBox[3] - oldBridgeBox[1]) continue;
      if (equal(framedPatch(frame, box), patch)) bridgeMatches.push(box);
    }
    if (!bridgeMatches.length) continue;
    const side = delta < 0 ? 'lower' : 'upper', [low, high] = span.after_interval;
    const patchSignature = (span.endpoint_patches ?? []).map(([, patch]: any[]) => patch);
    for (const prototype of spanRecords) {
      if (!equal(prototype.context_epoch, contextEpoch) || prototype.axis !== axis || prototype.point_before_side !== side || !truthy(prototype.source_claim_ref)) continue;
      const otherSignature = (prototype.endpoint_patches ?? []).map(([, patch]: any[]) => patch);
      if (!equal(otherSignature, patchSignature) || prototype.after_interval[1] - prototype.after_interval[0] !== high - low) continue;
      const offset = side === 'lower' ? prototype.point_to_lower_edge : prototype.point_to_upper_edge;
      const coordinate = side === 'lower' ? low + delta + offset : high + delta - offset;
      if (low <= coordinate && coordinate <= high || low + delta < 0 || high + delta >= (axis === 'column' ? frame.width : frame.height)) continue;
      for (const component of regional ? operatorRegions : components) {
        if (regional) {
          if (!(component as FramedRegion).supported_by_mutual_parallel_pair || requireValue && !equal(component.value, prototype.operator_value)) continue;
        } else {
          const facts = bandFacts[component.component_id] ?? {};
          if (facts.parallel_solid_band_domain_complete !== true || facts.parallel_solid_band_peer_count !== 1 || !equal(component.value, prototype.operator_value)) continue;
        }
        const point: FramedPoint = axis === 'column' ? [Math.floor((component.bbox.top + component.bbox.bottom) / 2), coordinate] : [coordinate, Math.floor((component.bbox.left + component.bbox.right) / 2)];
        const orthogonal = axis === 'column' ? point[0] : point[1];
        if (!(span.orthogonal_interval[0] <= orthogonal && orthogonal <= span.orthogonal_interval[1]) || !component.pixels.some(p => equal(p, point))) continue;
        const key = [component.component_id, point, mask, typed, sourceRef, markerRef, delta], encoded = keyOf(key);
        const fields: FramedRecord = { framed_reception_locus_complete: true, framed_reception_locus_mask_digest: mask,
          ...(regional ? { operator_value_current: component.value, operator_value_observed: prototype.operator_value, operator_value_matches_observation: equal(component.value, prototype.operator_value) } : {}),
          framed_reception_locus_same_mask_marker: typed, framed_reception_locus_expected_delta: delta, framed_reception_locus_axis: axis,
          framed_reception_locus_source_ref: sourceRef, framed_reception_locus_marker_ref: markerRef, framed_reception_locus_local_operator: equal(prototype.endpoint_refs, span.endpoint_refs),
          framed_reception_locus_premise_refs: [witness.source_claim_ref, prototype.source_claim_ref] };
        const prior = output.get(encoded);
        if (prior) {
          fields.framed_reception_locus_premise_refs = sortedUnique([...prior.facts.framed_reception_locus_premise_refs, ...fields.framed_reception_locus_premise_refs]);
          fields.framed_reception_locus_local_operator = prior.facts.framed_reception_locus_local_operator || fields.framed_reception_locus_local_operator;
        }
        output.set(encoded, { key, facts: fields });
        if (output.size > contract.maximum_loci) return [[], false];
      }
    }
  }
  return [[...output.values()].sort((a, b) => framedCompare(a.key, b.key)).map(({ key, facts }) => [key[0], key[1], facts] as FramedLocus), true];
}
export const measureFramedReceptionLoci = (input: FramedReceptionInput): FramedLoci => receptionLoci(input, false);
export const measureRegionalReceptionLoci = (input: FramedReceptionInput): FramedLoci => receptionLoci(input, true);
