/**
 * A public reception after an outer moving support has visibly settled.
 *
 * This native annex retains a contextual framed appearance, not a guessed
 * identity for an unframed component. Its signed observations are reserved
 * for native directed composition: do not add them to the original candidate
 * function's receipt domain, which does not preserve reception direction.
 * No packet sub-frame is assigned a command or a law of control.
 */
import { compareUnicode } from './canonical.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import { digest, extract, transition, measureFramedMaskCorrespondences } from './v6-framed-transfer-observation.ts';
import { framedGapPatches } from './v6-framed-transfer-mechanics.ts';
import type { FramedPolicyShape, FramedRecord } from './v6-framed-transfer-observation.ts';
import type { FramedBox, FramedFrame } from './v6-framed-transfer-mechanics.ts';
import type { NativeRows } from './v6-native-types.ts';
import type { PublicPacketReceptionMeasurement, PublicPacketReceptionRow } from './v6-framed-transfer-public-receptions.ts';

export const PHASED_PUBLIC_PACKET_RECEPTION_CONTRACT = Object.freeze({
  schema: 'native.framed_public_phased_reception.v1',
  maximum_frames: 64,
  maximum_total_pixels: 262144,
  maximum_tracked_signatures: 128,
  maximum_outer_spans: 32,
  maximum_work: 65536,
  maximum_receptions: 64,
  minimum_stable_frames: 2,
  stationary_collar_width: 1,
});

interface Snapshot {
  readonly index: number;
  readonly frame: FramedFrame;
  readonly ref: string;
  readonly hash: string;
  readonly occurrences: readonly FramedRecord[];
}
interface Position { readonly snapshot: number; readonly occurrence: FramedRecord }
interface StableRun { readonly start: number; readonly end: number; readonly occurrence: FramedRecord }
type Patch = readonly [FramedBox, NativeRows];
type CollarPixel = readonly [number, number, number];
interface OuterSupport {
  readonly token: string;
  readonly before_bbox: FramedBox;
  readonly after_bbox: FramedBox;
  readonly swept_bbox: FramedBox;
  readonly endpoint_refs: readonly string[];
  readonly endpoint_patches: readonly Patch[];
}

const intersects = (a: FramedBox, b: FramedBox): boolean => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const contains = (outer: FramedBox, inner: FramedBox): boolean => outer[0] <= inner[0] && outer[1] <= inner[1]
  && inner[2] <= outer[2] && inner[3] <= outer[3];
function isRows(rows: NativeRows, width: number, height: number): boolean {
  return Array.isArray(rows) && rows.length === height && rows.every(row => Array.isArray(row) && row.length === width
    && row.every(value => Number.isSafeInteger(value) && value >= 0 && value <= 255));
}
function motionBox(span: FramedRecord, which: 'before' | 'after'): FramedBox {
  const [low, high] = span[`point_span_${which}_interval`] as readonly number[];
  const [olow, ohigh] = span.point_span_orthogonal_interval as readonly number[];
  return span.point_span_axis === 'column' ? [olow!, low!, ohigh!, high!] : [low!, olow!, high!, ohigh!];
}
function validBox(box: readonly number[], width: number, height: number): box is FramedBox {
  return box.length === 4 && box.every(Number.isSafeInteger) && 0 <= box[0]! && box[0]! <= box[2]! && box[2]! < height
    && 0 <= box[1]! && box[1]! <= box[3]! && box[3]! < width;
}
function collar(frame: FramedFrame, box: FramedBox): readonly CollarPixel[] | null {
  const [top, left, bottom, right] = [box[0] - 1, box[1] - 1, box[2] + 1, box[3] + 1];
  if (top < 0 || left < 0 || bottom >= frame.height || right >= frame.width) return null;
  const pixels: CollarPixel[] = [];
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    if (y === top || y === bottom || x === left || x === right) pixels.push([y, x, frame.rows[y]![x]!]);
  }
  return pixels;
}

/**
 * The extra first snapshot is -1; all other indices are real frame_packet
 * indices. Inventory or work overflow refuses the entire annex, never a
 * partial prefix. Exact contextual appearances must remain unique throughout
 * each source-to-settlement segment, including its intermediate observations.
 */
export async function measureCurrentPhasedPublicPacketReceptions(
  first: NativeRows, final: NativeRows, before: FramedRecord, after: FramedRecord,
  command: FramedRecord, frames: readonly NativeRows[], policy: FramedPolicyShape,
): Promise<PublicPacketReceptionMeasurement> {
  const bound = PHASED_PUBLIC_PACKET_RECEPTION_CONTRACT;
  let work = 0;
  const refusal = (reason: string): PublicPacketReceptionMeasurement => ({ complete: false, rows: [], frame_count: frames.length, work_count: work, reason });
  const spend = (amount = 1): boolean => { work += amount; return work <= bound.maximum_work; };
  if (!frames.length) return refusal('phased_public_frame_packet_unavailable');
  if (frames.length > bound.maximum_frames) return refusal('phased_public_frame_count_bound');
  if (!Number.isSafeInteger(before.level_epoch) || before.level_epoch !== after.level_epoch
    || typeof before.observation_ref !== 'string' || typeof after.observation_ref !== 'string') return refusal('phased_public_epoch_or_observation_mismatch');
  const height = first.length, width = first[0]?.length ?? 0, pixels = height * width;
  if (!height || !width || pixels > policy.mask.maximum_frame_pixels
    || pixels * (frames.length + 1) > bound.maximum_total_pixels) return refusal('phased_public_frame_pixel_bound');
  if (!isRows(first, width, height) || !isRows(final, width, height) || frames.some(rows => !isRows(rows, width, height))) return refusal('phased_public_frame_domain_invalid');
  if (!equal(frames[frames.length - 1], final)) return refusal('phased_public_frame_packet_final_mismatch');
  if (typeof command.action_ref !== 'string' || !command.action_ref || !Number.isSafeInteger(command.data?.x) || !Number.isSafeInteger(command.data?.y)
    || command.data.x < 0 || command.data.x >= width || command.data.y < 0 || command.data.y >= height) return refusal('phased_public_point_command_invalid');
  const contract = policy.policies['policy.record_observed_framed_replacement']?.configuration?.measurement_contract;
  if (!contract || !Number.isSafeInteger(contract.maximum_replacements) || contract.maximum_replacements < 0
    || !Number.isSafeInteger(contract.maximum_components) || !Number.isSafeInteger(contract.maximum_occurrences)) return refusal('phased_replacement_contract_unavailable');

  // Only the actual outer command supplies a moving-support observation.
  const [spanFacts] = await transition(first, final, before, after, command, policy);
  if (spanFacts.point_motion_span_domain_complete !== true) return refusal('phased_outer_point_motion_domain_incomplete');
  const spans = spanFacts.point_motion_span_rows as readonly FramedRecord[];
  if (!spans.length) return refusal('phased_outer_point_motion_witness_unavailable');
  if (spans.length > bound.maximum_outer_spans) return refusal('phased_outer_point_motion_count_bound');
  const supports: OuterSupport[] = [];
  for (const span of spans) {
    const start = motionBox(span, 'before'), end = motionBox(span, 'after');
    const patches = span.point_span_endpoint_patches as readonly Patch[];
    const refs = span.point_span_endpoint_refs as readonly string[];
    if (!validBox(start, width, height) || !validBox(end, width, height) || !Array.isArray(patches) || patches.length !== 2
      || !Array.isArray(refs) || refs.length !== 2 || refs[0] === refs[1]
      || patches.some(([box, patch]) => !validBox(box, width, height) || !contains(end, box)
        || !isRows(patch, box[3] - box[1] + 1, box[2] - box[0] + 1))) return refusal('phased_outer_endpoint_inventory_invalid');
    supports.push({ token: span.point_span_token, before_bbox: start, after_bbox: end,
      swept_bbox: [Math.min(start[0], end[0]), Math.min(start[1], end[1]), Math.max(start[2], end[2]), Math.max(start[3], end[3])],
      endpoint_refs: refs, endpoint_patches: patches });
  }

  const parentTransition = `transition:${digest([before.observation_ref, after.observation_ref, command])}`;
  const snapshots: Snapshot[] = [], tracks = new Map<string, Position[]>();
  for (let position = 0; position <= frames.length; position++) {
    const index = position - 1, rows = index < 0 ? first : frames[index]!;
    const hash = digest(rows), ref = index < 0 ? before.observation_ref : `${after.observation_ref}:public_frame:${index}:rows:${hash}`;
    const [frame, , scene] = await extract(rows, ref);
    const measured = measureFramedMaskCorrespondences(frame, scene.entities, policy.mask);
    if (measured.framed_mask_domain_complete !== true) return refusal('phased_public_mask_inventory_incomplete');
    const occurrences = measured.framed_mask_occurrences as readonly FramedRecord[];
    if (scene.entities.length > contract.maximum_components || occurrences.length > contract.maximum_occurrences) return refusal('phased_public_replacement_inventory_bound');
    snapshots.push({ index, frame, hash, ref, occurrences });
    const groups = new Map<string, FramedRecord[]>();
    for (const occurrence of occurrences) {
      if (!spend()) return refusal('phased_public_reception_work_bound');
      if (occurrence.inner_fills_bbox) continue;
      const key = digest([occurrence.mask_digest, occurrence.mask_extent, occurrence.inner_value, occurrence.border_value]);
      const group = groups.get(key) ?? []; group.push(occurrence); groups.set(key, group);
    }
    for (const [key, group] of groups) {
      if (group.length !== 1) continue;
      const track = tracks.get(key) ?? []; track.push({ snapshot: position, occurrence: group[0]! }); tracks.set(key, track);
      if (tracks.size > bound.maximum_tracked_signatures) return refusal('phased_public_signature_count_bound');
    }
  }

  const rows: PublicPacketReceptionRow[] = [];
  for (const [appearanceRef, positions] of [...tracks].sort(([a], [b]) => compareUnicode(a, b))) {
    const runs: StableRun[] = [];
    let current: StableRun | null = null;
    for (const position of positions) {
      if (!spend()) return refusal('phased_public_reception_work_bound');
      if (current && position.snapshot === current.end + 1 && equal(position.occurrence.frame_bbox, current.occurrence.frame_bbox)) {
        current = { start: current.start, end: position.snapshot, occurrence: current.occurrence }; runs[runs.length - 1] = current;
      } else { current = { start: position.snapshot, end: position.snapshot, occurrence: position.occurrence }; runs.push(current); }
    }
    let previous: StableRun | null = null;
    for (const run of runs) {
      if (run.end - run.start + 1 < bound.minimum_stable_frames) continue;
      const sourceRun = previous; previous = run;
      if (!sourceRun) continue;
      const chain = positions.filter(p => sourceRun.start <= p.snapshot && p.snapshot <= run.end);
      if (chain.length !== run.end - sourceRun.start + 1) continue;
      const source = sourceRun.occurrence, displayed = run.occurrence;
      const sourceBox = source.frame_bbox as FramedBox, targetBox = displayed.frame_bbox as FramedBox;
      const dr = targetBox[0] - sourceBox[0], dc = targetBox[1] - sourceBox[1];
      if ((dr === 0) === (dc === 0) || intersects(sourceBox, targetBox)
        || displayed.border_value !== source.border_value || !equal(source.mask_extent, displayed.mask_extent)) continue;
      const sourceSupports = supports.filter(support => contains(support.after_bbox, sourceBox) && !intersects(support.after_bbox, targetBox));
      if (sourceSupports.length !== 1) continue;
      const sourceSupport = sourceSupports[0]!;
      // Other outer spans that crossed either observed region must also have
      // settled during this exact phase; an unchanged final collar alone does
      // not excuse a support excursion between the two observations.
      const relevantSupports = supports.filter(support => intersects(support.swept_bbox, sourceBox) || intersects(support.swept_bbox, targetBox));
      const old = snapshots[sourceRun.end]!, arrival = snapshots[run.start]!;
      if (!spend(old.occurrences.length)) return refusal('phased_public_reception_work_bound');
      const markers = old.occurrences.filter(r => r.inner_fills_bbox === true && equal(r.frame_bbox, targetBox) && equal(r.mask_extent, source.mask_extent));
      if (markers.length !== 1) continue;
      const marker = markers[0]!, beforeCollar = collar(old.frame, targetBox);
      if (!beforeCollar) continue;
      const lateral = (pixels: readonly CollarPixel[]): readonly CollarPixel[] => pixels.filter(([y, x]) => dr !== 0
        ? x === targetBox[1] - 1 || x === targetBox[3] + 1 : y === targetBox[0] - 1 || y === targetBox[2] + 1);
      const beforeLateral = lateral(beforeCollar);
      let settledPosition: number | null = null, afterCollar: readonly CollarPixel[] | null = null, previousProgress = 0;
      for (let position = sourceRun.start; position <= run.end; position++) {
        const snapshot = snapshots[position]!;
        const visibleBox = chain[position - sourceRun.start]!.occurrence.frame_bbox as FramedBox;
        const displacement = dr !== 0 ? visibleBox[0] - sourceBox[0] : visibleBox[1] - sourceBox[1];
        const progress = Math.sign(dr || dc) * displacement;
        const axialBox = sourceBox.map((value, index) => value + ((dr !== 0 ? index === 0 || index === 2 : index === 1 || index === 3) ? displacement : 0));
        if (!spend()) return refusal('phased_public_reception_work_bound');
        // Pauses and unequal observed increments are allowed. A detour,
        // reversal or overshoot cannot attest this directed passage merely
        // because the source and final destination happen to be aligned.
        if (!equal(visibleBox, axialBox) || progress < previousProgress || progress > Math.abs(dr || dc)) break;
        previousProgress = progress;
        let endpointsUnchanged = true;
        for (const support of relevantSupports) for (const [box, patch] of support.endpoint_patches) {
          for (let y = box[0]; y <= box[2]; y++) for (let x = box[1]; x <= box[3]; x++) {
            if (!spend()) return refusal('phased_public_reception_work_bound');
            if (snapshot.frame.rows[y]![x] !== patch[y - box[0]]![x - box[1]]) endpointsUnchanged = false;
          }
        }
        if (!endpointsUnchanged) break;
        const currentCollar = collar(snapshot.frame, targetBox);
        if (!currentCollar) break;
        if (!spend(currentCollar.length)) return refusal('phased_public_reception_work_bound');
        if (!equal(lateral(currentCollar), beforeLateral)) break;
        if (position < run.start) {
          if (!spend(snapshot.occurrences.length)) return refusal('phased_public_reception_work_bound');
          const present = snapshot.occurrences.filter(r => r.inner_fills_bbox === true && equal(r.frame_bbox, targetBox)
            && equal(r.mask_extent, marker.mask_extent) && r.inner_value === marker.inner_value && r.border_value === marker.border_value);
          if (present.length !== 1) break;
        }
        if (position < run.start + bound.minimum_stable_frames - 1 || !equal(beforeCollar, currentCollar)) continue;
        if (!spend(snapshot.occurrences.length)) return refusal('phased_public_reception_work_bound');
        if (snapshot.occurrences.some(r => r.inner_fills_bbox === true && equal(r.frame_bbox, targetBox))) continue;
        settledPosition = position; afterCollar = currentCollar; break;
      }
      if (settledPosition === null || !afterCollar) continue;
      const settled = snapshots[settledPosition]!, gaps = framedGapPatches(sourceBox, targetBox, settled.frame);
      if (!spend(gaps.reduce((total, [, , patch]) => total + patch.reduce((count: number, line: readonly number[]) => count + line.length, 0), 0))) return refusal('phased_public_reception_work_bound');
      if (gaps.length !== 1) continue;
      const segmentRef = `public_phased_reception:${digest([parentTransition, appearanceRef, old.index, arrival.index, settled.index, sourceSupport.token])}`;
      const facts: FramedRecord = {
        framed_replacement_token: digest([segmentRef, source.entity_ref, marker.entity_ref, 'settled_support_contextual_framed_appearance']),
        framed_replacement_source_ref: source.entity_ref,
        framed_replacement_current_visible_ref: displayed.entity_ref,
        framed_replacement_marker_ref: marker.entity_ref,
        framed_replacement_tracking_lineage_agrees: displayed.entity_ref === source.entity_ref,
        framed_replacement_marker_uniform: true,
        framed_replacement_gap_patches: gaps,
        framed_replacement_mask_digest: source.mask_digest,
        framed_replacement_mask_extent: source.mask_extent,
        framed_replacement_source_inner_value: source.inner_value,
        framed_replacement_source_border_value: source.border_value,
        framed_replacement_marker_inner_value: marker.inner_value,
        framed_replacement_marker_border_value: marker.border_value,
        framed_replacement_after_border_value: displayed.border_value,
        framed_replacement_border_preserved: true,
        framed_replacement_source_frame_bbox: sourceBox,
        framed_replacement_marker_frame_bbox: targetBox,
        framed_replacement_before_marker_frame_bbox: targetBox,
        framed_replacement_receiver_endpoint_refs: null,
        framed_replacement_delta: [dr, dc],
        framed_replacement_action_ref: command.action_ref,
        framed_replacement_transition_ref: segmentRef,
        framed_replacement_context_epoch: before.level_epoch,
        framed_replacement_frame_ref: settled.ref,
        framed_replacement_unique_preserved_copy: true,
        framed_replacement_marker_disappeared: true,
        framed_replacement_prior_goal_ref: null,
        framed_replacement_prior_subgoal_ref: null,
        framed_replacement_native_directed_composition_only: true,
      };
      const describe = (snapshot: Snapshot): FramedRecord => ({ packet_index: snapshot.index, frame_ref: snapshot.ref, rows_sha256: snapshot.hash });
      rows.push({ facts, packet_witness: {
        schema: bound.schema,
        epistemic_status: 'observed_contextual_framed_replacement_not_control_law',
        native_directed_composition_only: true,
        original_directionless_candidate_eligible: false,
        before_observation_ref: before.observation_ref,
        after_observation_ref: after.observation_ref,
        parent_transition_ref: parentTransition,
        actual_returned_command: command,
        causal_action_efficacy_established: false,
        intermediate_command_count: 0,
        context_epoch: before.level_epoch,
        packet_frame_count: frames.length,
        source_snapshot: describe(old), arrival_snapshot: describe(arrival), settled_snapshot: describe(settled),
        source_stable_packet_range: [snapshots[sourceRun.start]!.index, old.index],
        receiver_stable_packet_range: [arrival.index, settled.index],
        first_valid_settlement_after_minimum_stability: true,
        contextual_identity: { signature: appearanceRef, mask_digest: source.mask_digest, mask_extent: source.mask_extent,
          inner_value: source.inner_value, border_value: source.border_value, unique_in_each_observed_frame: true,
          identity_scope: 'current_framed_appearance', global_component_identity_asserted: false },
        unique_framed_appearance_trajectory: chain.filter(p => p.snapshot <= settledPosition).map(p => ({ ...describe(snapshots[p.snapshot]!),
          frame_bbox: p.occurrence.frame_bbox, component_ref: p.occurrence.component_ref, entity_ref: p.occurrence.entity_ref })),
        settled_source_support: sourceSupport,
        outer_support_phase_witnesses: relevantSupports,
        support_endpoint_patches_unchanged_in_all_observed_frames: true,
        support_observed_packet_range: [snapshots[sourceRun.start]!.index, settled.index],
        receiver_surroundings: { collar_ends_equal: true, collar_before_pixels: beforeCollar, collar_after_sha256: digest(afterCollar),
          lateral_sides: dr !== 0 ? 'left_right' : 'top_bottom', lateral_before_pixels: beforeLateral,
          lateral_unchanged_in_all_observed_frames: true, observed_packet_range: [snapshots[sourceRun.start]!.index, settled.index] },
        observed_trajectory_axial: true,
        observed_axis_progression_monotone: true,
        observed_motion_axis: dr !== 0 ? 'row' : 'column',
        observed_source_to_receiver_vector: [dr, dc],
        historical_receipt_reused: false,
        current_control_authority: false,
      } });
      if (rows.length > Math.min(bound.maximum_receptions, contract.maximum_replacements)) return refusal('phased_public_reception_count_bound');
    }
  }
  return { complete: true, rows, frame_count: frames.length, work_count: work };
}
