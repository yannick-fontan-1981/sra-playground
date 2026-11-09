/**
 * Native, opt-in observations inside one returned public frame packet.
 *
 * The pinned source only acquires a uniform reception when the receiving
 * support is the point-motion span. A packet can also display an independent
 * shape entering a stationary uniform frame. This annex measures that return;
 * it does not infer an intermediate command or a law of control. Source
 * candidates, source transition measurements and their defaults stay intact.
 */
import { compareUnicode } from './canonical.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import { digest, extract, transition, measureFramedMaskCorrespondences } from './v6-framed-transfer-observation.ts';
import { framedGapPatches } from './v6-framed-transfer-mechanics.ts';
import type { FramedPolicyShape, FramedRecord } from './v6-framed-transfer-observation.ts';
import type { FramedBox, FramedFrame } from './v6-framed-transfer-mechanics.ts';
import type { NativeRows } from './v6-native-types.ts';

export const PUBLIC_PACKET_RECEPTION_CONTRACT = Object.freeze({
  schema: 'native.framed_public_packet_reception.v1',
  maximum_frames: 64,
  maximum_total_pixels: 262144,
  maximum_tracked_signatures: 128,
  maximum_work: 65536,
  maximum_receptions: 64,
  minimum_stable_frames: 2,
  stationary_collar_width: 1,
});

export interface PublicPacketReceptionRow {
  /** One measurement row; wrap it in framed_replacement_rows for policy.record. */
  readonly facts: FramedRecord;
  /** An observation witness, never an authority for an intermediate action. */
  readonly packet_witness: FramedRecord;
}
export interface PublicPacketReceptionMeasurement {
  readonly complete: boolean;
  readonly rows: readonly PublicPacketReceptionRow[];
  readonly frame_count: number;
  readonly work_count: number;
  readonly reason?: string;
}

interface Snapshot {
  readonly index: number;
  readonly frame: FramedFrame;
  readonly ref: string;
  readonly hash: string;
  readonly occurrences: readonly FramedRecord[];
}
interface Position {
  readonly snapshot: number;
  readonly occurrence: FramedRecord;
}
interface StableRun {
  readonly start: number;
  readonly end: number;
  readonly occurrence: FramedRecord;
}

function isRows(value: NativeRows, width: number, height: number): boolean {
  return Array.isArray(value) && value.length === height && value.every(row => Array.isArray(row) && row.length === width
    && row.every(cell => Number.isSafeInteger(cell) && cell >= 0 && cell <= 255));
}
function intersects(a: FramedBox, b: FramedBox): boolean {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}
function motionBox(span: FramedRecord, which: 'before' | 'after'): FramedBox {
  const [low, high] = span[`point_span_${which}_interval`] as readonly number[];
  const [olow, ohigh] = span.point_span_orthogonal_interval as readonly number[];
  return span.point_span_axis === 'column' ? [olow!, low!, ohigh!, high!] : [low!, olow!, high!, ohigh!];
}
function collar(frame: FramedFrame, box: FramedBox): readonly (readonly [number, number, number])[] | null {
  const [top, left, bottom, right] = [box[0] - 1, box[1] - 1, box[2] + 1, box[3] + 1];
  if (top < 0 || left < 0 || bottom >= frame.height || right >= frame.width) return null;
  const pixels: [number, number, number][] = [];
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    if (y === top || y === bottom || x === left || x === right) pixels.push([y, x, frame.rows[y]![x]!]);
  }
  return pixels;
}

/**
 * All supplied frames are public observations of one actual returned action.
 * The extra first snapshot is indexed -1; frame_packet keeps its real 0-based
 * indices. A partial or over-bound inventory yields no prefix of receptions.
 */
export async function measureCurrentPublicPacketReceptions(
  first: NativeRows, final: NativeRows, before: FramedRecord, after: FramedRecord,
  command: FramedRecord, frames: readonly NativeRows[], policy: FramedPolicyShape,
): Promise<PublicPacketReceptionMeasurement> {
  const bound = PUBLIC_PACKET_RECEPTION_CONTRACT;
  let work = 0;
  const refusal = (reason: string): PublicPacketReceptionMeasurement => ({ complete: false, rows: [], frame_count: frames.length, work_count: work, reason });
  if (!frames.length) return refusal('public_frame_packet_unavailable');
  if (frames.length > bound.maximum_frames) return refusal('public_frame_count_bound');
  if (!Number.isSafeInteger(before.level_epoch) || before.level_epoch !== after.level_epoch
    || typeof before.observation_ref !== 'string' || typeof after.observation_ref !== 'string') return refusal('public_epoch_or_observation_mismatch');
  const height = first.length, width = first[0]?.length ?? 0, pixels = height * width;
  if (!height || !width || pixels > policy.mask.maximum_frame_pixels
    || pixels * (frames.length + 1) > bound.maximum_total_pixels) return refusal('public_frame_pixel_bound');
  if (!isRows(first, width, height) || !isRows(final, width, height) || frames.some(rows => !isRows(rows, width, height))) return refusal('public_frame_domain_invalid');
  if (!equal(frames[frames.length - 1], final)) return refusal('public_frame_packet_final_mismatch');
  if (typeof command.action_ref !== 'string' || !Number.isSafeInteger(command.data?.x) || !Number.isSafeInteger(command.data?.y)
    || command.data.x < 0 || command.data.x >= width || command.data.y < 0 || command.data.y >= height) return refusal('public_point_command_invalid');
  const contract = policy.policies['policy.record_observed_framed_replacement']?.configuration?.measurement_contract;
  if (!contract || !Number.isSafeInteger(contract.maximum_replacements) || contract.maximum_replacements < 0) return refusal('replacement_contract_unavailable');

  // These spans describe the real outer return only. They exclude a moving
  // support; they never authorize an action attributed to a packet sub-frame.
  const [spanFacts] = await transition(first, final, before, after, command, policy);
  if (spanFacts.point_motion_span_domain_complete !== true) return refusal('outer_point_motion_domain_incomplete');
  const spans = spanFacts.point_motion_span_rows as readonly FramedRecord[];
  if (!spans.length) return refusal('outer_point_motion_witness_unavailable');
  const movingSupports = spans.map(span => {
    const start = motionBox(span, 'before'), end = motionBox(span, 'after');
    const swept: FramedBox = [Math.min(start[0], end[0]), Math.min(start[1], end[1]), Math.max(start[2], end[2]), Math.max(start[3], end[3])];
    return { token: span.point_span_token, before_bbox: start, after_bbox: end, swept_bbox: swept };
  });
  const movingBoxes = movingSupports.map(span => span.swept_bbox);
  const parentTransition = `transition:${digest([before.observation_ref, after.observation_ref, command])}`;
  const snapshots: Snapshot[] = [];
  const tracks = new Map<string, Position[]>();
  for (let position = 0; position <= frames.length; position++) {
    const index = position - 1, rows = index < 0 ? first : frames[index]!;
    const hash = digest(rows), ref = index < 0 ? before.observation_ref
      : `${after.observation_ref}:public_frame:${index}:rows:${hash}`;
    const [frame, , scene] = await extract(rows, ref);
    const measured = measureFramedMaskCorrespondences(frame, scene.entities, policy.mask);
    if (measured.framed_mask_domain_complete !== true) return refusal('public_mask_inventory_incomplete');
    const occurrences = measured.framed_mask_occurrences as readonly FramedRecord[];
    if (scene.entities.length > contract.maximum_components || occurrences.length > contract.maximum_occurrences) return refusal('public_replacement_inventory_bound');
    snapshots.push({ index, frame, hash, ref, occurrences });
    const groups = new Map<string, FramedRecord[]>();
    for (const occurrence of occurrences) {
      if (++work > bound.maximum_work) return refusal('public_reception_work_bound');
      if (occurrence.inner_fills_bbox) continue;
      const key = digest([occurrence.inner_value, occurrence.mask_digest]);
      const group = groups.get(key) ?? []; group.push(occurrence); groups.set(key, group);
    }
    for (const [key, group] of groups) {
      // extract uses shape: only for a globally unique exact component. Thus a
      // repeated or unframed look-alike also prevents a guessed identity.
      if (group.length !== 1 || !String(group[0]!.entity_ref).startsWith('shape:')) continue;
      const track = tracks.get(key) ?? []; track.push({ snapshot: position, occurrence: group[0]! }); tracks.set(key, track);
      if (tracks.size > bound.maximum_tracked_signatures) return refusal('public_signature_count_bound');
    }
  }

  const rows: PublicPacketReceptionRow[] = [];
  for (const [, positions] of [...tracks].sort(([a], [b]) => compareUnicode(a, b))) {
    const runs: StableRun[] = [];
    let current: StableRun | null = null;
    for (const position of positions) {
      if (++work > bound.maximum_work) return refusal('public_reception_work_bound');
      if (current && position.snapshot === current.end + 1
        && equal(position.occurrence.frame_bbox, current.occurrence.frame_bbox)
        && position.occurrence.border_value === current.occurrence.border_value) {
        current = { start: current.start, end: position.snapshot, occurrence: current.occurrence }; runs[runs.length - 1] = current;
      } else { current = { start: position.snapshot, end: position.snapshot, occurrence: position.occurrence }; runs.push(current); }
    }
    let previous: StableRun | null = null;
    for (const run of runs) {
      if (run.end - run.start + 1 < bound.minimum_stable_frames) continue;
      const sourceRun = previous; previous = run;
      if (!sourceRun) continue;
      const chain = positions.filter(p => sourceRun.end <= p.snapshot && p.snapshot <= run.end);
      if (chain.length !== run.end - sourceRun.end + 1) continue; // disappearance or ambiguity breaks a track
      const source = sourceRun.occurrence, displayed = run.occurrence;
      const sourceBox = source.frame_bbox as FramedBox, targetBox = displayed.frame_bbox as FramedBox;
      const dr = targetBox[0] - sourceBox[0], dc = targetBox[1] - sourceBox[1];
      if ((dr === 0) === (dc === 0) || intersects(sourceBox, targetBox)
        || displayed.border_value !== source.border_value || !equal(source.mask_extent, displayed.mask_extent)) continue;
      if (movingBoxes.some(box => intersects(sourceBox, box) || intersects(targetBox, box))) continue;
      const old = snapshots[sourceRun.end]!, settled = snapshots[run.end]!, arrival = snapshots[run.start]!;
      const markers = old.occurrences.filter(r => r.inner_fills_bbox === true && equal(r.frame_bbox, targetBox) && equal(r.mask_extent, source.mask_extent));
      if (markers.length !== 1) continue;
      const marker = markers[0]!;
      if (settled.occurrences.some(r => r.inner_fills_bbox === true && equal(r.frame_bbox, targetBox))) continue;
      // A literal stationary collar rules out treating a moving carrier's
      // translated interior as an independent stationary receiving frame.
      const beforeCollar = collar(old.frame, targetBox), afterCollar = collar(settled.frame, targetBox);
      if (!beforeCollar || !afterCollar || !equal(beforeCollar, afterCollar)) continue;
      // The entering shape crosses the front of the collar. Its two lateral
      // sides are outside the observed axial trajectory and must stay literal
      // throughout the packet segment, including temporary intermediate views.
      const lateral = (pixels: readonly (readonly [number, number, number])[]): readonly (readonly [number, number, number])[] => pixels.filter(([y, x]) =>
        dr !== 0 ? x === targetBox[1] - 1 || x === targetBox[3] + 1 : y === targetBox[0] - 1 || y === targetBox[2] + 1);
      const beforeLateral = lateral(beforeCollar);
      let lateralUnchanged = true;
      for (let index = sourceRun.end; index <= run.end; index++) {
        if (++work > bound.maximum_work) return refusal('public_reception_work_bound');
        const pixels = collar(snapshots[index]!.frame, targetBox);
        if (!pixels || !equal(beforeLateral, lateral(pixels))) lateralUnchanged = false;
      }
      if (!lateralUnchanged) continue;
      let markerStayed = true;
      for (let index = sourceRun.end; index < run.start; index++) {
        if (++work > bound.maximum_work) return refusal('public_reception_work_bound');
        if (!snapshots[index]!.occurrences.some(r => r.inner_fills_bbox === true && equal(r.frame_bbox, targetBox)
          && r.inner_value === marker.inner_value && r.border_value === marker.border_value)) markerStayed = false;
      }
      if (!markerStayed) continue;
      const gaps = framedGapPatches(sourceBox, targetBox, settled.frame);
      if (gaps.length !== 1) continue;
      const segmentRef = `public_packet_reception:${digest([parentTransition, old.index, arrival.index, settled.index, source.entity_ref, marker.entity_ref])}`;
      const facts: FramedRecord = {
        framed_replacement_token: digest([segmentRef, source.entity_ref, marker.entity_ref, 'stationary_uniform_public_packet']),
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
      };
      const describe = (snapshot: Snapshot): FramedRecord => ({ packet_index: snapshot.index, frame_ref: snapshot.ref, rows_sha256: snapshot.hash });
      rows.push({ facts, packet_witness: {
        schema: bound.schema,
        epistemic_status: 'observed_replacement_not_control_law',
        before_observation_ref: before.observation_ref,
        after_observation_ref: after.observation_ref,
        parent_transition_ref: parentTransition,
        actual_returned_command: command,
        causal_action_efficacy_established: false,
        intermediate_command_count: 0,
        context_epoch: before.level_epoch,
        packet_frame_count: frames.length,
        source_snapshot: describe(old),
        arrival_snapshot: describe(arrival),
        settled_snapshot: describe(settled),
        source_stable_packet_range: [snapshots[sourceRun.start]!.index, old.index],
        receiver_stable_packet_range: [arrival.index, settled.index],
        unique_shape_trajectory: chain.map(p => ({ ...describe(snapshots[p.snapshot]!), frame_bbox: p.occurrence.frame_bbox })),
        receiver_surroundings: {
          collar_ends_equal: true, collar_before_pixels: beforeCollar, collar_after_sha256: digest(afterCollar),
          lateral_sides: dr !== 0 ? 'left_right' : 'top_bottom', lateral_before_pixels: beforeLateral,
          lateral_unchanged_in_all_observed_frames: true, observed_packet_range: [old.index, settled.index],
        },
        excluded_outer_motion_spans: movingSupports,
        historical_receipt_reused: false,
        current_control_authority: false,
      } });
      if (rows.length > Math.min(bound.maximum_receptions, contract.maximum_replacements)) return refusal('public_reception_count_bound');
    }
  }
  return { complete: true, rows, frame_count: frames.length, work_count: work };
}
