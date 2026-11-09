/**
 * One current question about a carried source/ghost pair and an independent
 * uniform receiver. Directed observed reception witnesses constrain every
 * anchor. Preparation is only a measured span translation; reception and
 * competing control offsets remain conditional until an actual return.
 */
import { compareUnicode } from './canonical.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import { digest, extract, pointRegions, measureParallelSolidBands, measureCurrentPointSpanBindings,
  measurePointSpanLocus, measureFramedMaskCorrespondences, measureFramedReceptionLoci,
  measureRegionalReceptionLoci } from './v6-framed-transfer-observation.ts';
import { framedContains, framedCenter, framedGapPatches } from './v6-framed-transfer-mechanics.ts';
import type { FramedOffer, FramedPolicyShape, FramedRecord } from './v6-framed-transfer-observation.ts';
import type { FramedBox, FramedPoint, FramedRegion } from './v6-framed-transfer-mechanics.ts';
import type { NativeRows } from './v6-native-types.ts';

export const DIRECTED_RECEIVER_COMPOSITION_CONTRACT = Object.freeze({
  schema: 'native.current_directed_receiver_composition.v1', maximum_work: 131072,
  maximum_records: 128, maximum_pairs: 32, maximum_anchors: 4096, maximum_tasks: 128, maximum_offers: 128,
});
export interface DirectedReceiverOffer extends FramedOffer { readonly native_directed_receiver_question: FramedRecord }
export interface DirectedReceiverQuestions {
  readonly complete: boolean; readonly offers: readonly DirectedReceiverOffer[]; readonly work_count: number; readonly reason?: string;
}
type Group = { witnesses: FramedRecord[]; vector: readonly [number, number] };
type Entry = { offer: FramedOffer; tasks: Map<string, FramedRecord> };
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compareUnicode);
const pointKey = (point: readonly number[]): string => JSON.stringify(point);
const patchSignature = (span: FramedRecord): unknown[] => (span.endpoint_patches ?? []).map(([, patch]: any[]) => patch);
const shiftBox = (box: readonly number[], axis: string, delta: number): FramedBox => box.map((value, index) => value
  + ((axis === 'column' ? index === 1 || index === 3 : index === 0 || index === 2) ? delta : 0)) as unknown as FramedBox;
const spanBox = (span: FramedRecord): FramedBox => span.axis === 'column'
  ? [span.orthogonal_interval[0], span.after_interval[0], span.orthogonal_interval[1], span.after_interval[1]]
  : [span.after_interval[0], span.orthogonal_interval[0], span.after_interval[1], span.orthogonal_interval[1]];
const overlaps = (a: readonly number[], b: readonly number[]): boolean => a[0]! <= b[2]! && b[0]! <= a[2]!
  && a[1]! <= b[3]! && b[1]! <= a[3]!;
const spanIdentity = (span: FramedRecord): unknown[] => [span.axis, span.endpoint_refs, span.after_interval, span.orthogonal_interval];
const spanView = (span: FramedRecord): FramedRecord => ({ axis: span.axis, endpoint_refs: span.endpoint_refs,
  after_interval: span.after_interval, orthogonal_interval: span.orthogonal_interval, endpoint_patches: span.endpoint_patches,
  context_epoch: span.context_epoch, source_claim_ref: span.source_claim_ref,
  ...(span.evidence ? { evidence: span.evidence } : {}) });
const occurrenceView = (row: FramedRecord): FramedRecord => ({ component_ref: row.component_ref, entity_ref: row.entity_ref,
  frame_bbox: row.frame_bbox, mask_digest: row.mask_digest, mask_extent: row.mask_extent,
  inner_value: row.inner_value, border_value: row.border_value, inner_fills_bbox: row.inner_fills_bbox });

export async function measureCurrentDirectedReceiverQuestions(rows: NativeRows, obs: FramedRecord, policy: FramedPolicyShape,
  spans: readonly FramedRecord[] = [], receipts: readonly FramedRecord[] = [], attempts: FramedRecord = {},
  existingSourceOffers: readonly FramedOffer[] = [], occupiedUniformReceptionPoints: readonly FramedRecord[] = []): Promise<DirectedReceiverQuestions> {
  const contract = DIRECTED_RECEIVER_COMPOSITION_CONTRACT;
  let work = 0, anchorCount = 0, taskCount = 0;
  const refused = (reason: string): DirectedReceiverQuestions => ({ complete: false, offers: [], work_count: work, reason });
  const empty = (): DirectedReceiverQuestions => ({ complete: true, offers: [], work_count: work });
  if (receipts.length > contract.maximum_records || existingSourceOffers.length > contract.maximum_offers
    || occupiedUniformReceptionPoints.length > contract.maximum_offers) return refused('directed_composition_inventory_bound');
  const groups = new Map<string, Group>();
  for (const witness of receipts) {
    if (++work > contract.maximum_work) return refused('directed_composition_work_bound');
    if (witness.context_epoch !== obs.level_epoch || witness.marker_uniform !== true || witness.border_preserved !== true
      || typeof witness.source_claim_ref !== 'string' || !witness.source_claim_ref || !Array.isArray(witness.source_frame_bbox)
      || !Array.isArray(witness.marker_frame_bbox) || !Array.isArray(witness.gap_patches) || !witness.gap_patches.length) continue;
    const a = witness.source_frame_bbox, b = witness.marker_frame_bbox;
    const vector: readonly [number, number] = [(b[0] + b[2] - a[0] - a[2]) / 2, (b[1] + b[3] - a[1] - a[3]) / 2];
    if (!vector.every(Number.isSafeInteger) || vector.every(value => value === 0)) continue;
    const key = digest([witness.mask_digest, witness.mask_extent, witness.source_inner_value, witness.source_border_value,
      witness.marker_inner_value, witness.marker_border_value, vector,
      witness.gap_patches.map(([axis, box, patch]: any[]) => [axis, [box[2] - box[0], box[3] - box[1]], patch])]);
    const group = groups.get(key) ?? { witnesses: [], vector }; group.witnesses.push(witness); groups.set(key, group);
  }
  if (!groups.size || !spans.length) return empty();
  const width = rows[0]?.length ?? 0;
  if (!Number.isSafeInteger(obs.level_epoch) || typeof obs.observation_ref !== 'string' || !width || !rows.length
    || width * rows.length > policy.mask.maximum_frame_pixels || rows.some(row => row.length !== width
      || row.some(value => !Number.isSafeInteger(value) || value < 0 || value > 255))) return refused('directed_composition_frame_invalid');
  const [frame, components, scene] = await extract(rows, obs.observation_ref);
  const measured = measureFramedMaskCorrespondences(frame, scene.entities, policy.mask);
  const [bindings, complete] = measureCurrentPointSpanBindings(frame, spans, obs.level_epoch, policy.route.point_motion_span_recall_contract);
  if (measured.framed_mask_domain_complete !== true || !complete) return refused('directed_composition_measurement_incomplete');
  if (bindings.length < 2) return empty();
  const occurrences = measured.framed_mask_occurrences as readonly FramedRecord[], byOccurrence = new Map(occurrences.map(row => [row.component_ref, row]));
  const carried: { source: FramedRecord; ghost: FramedRecord; span: FramedRecord; history: readonly FramedRecord[]; group: Group }[] = [];
  for (const pair of measured.framed_mask_pairs as readonly FramedRecord[]) for (const group of groups.values()) {
    const witness = group.witnesses[0]!;
    for (const [first, second] of [['first', 'second'], ['second', 'first']] as const) {
      if (++work > contract.maximum_work) return refused('directed_composition_work_bound');
      if (!equal(pair.mask_extent, witness.mask_extent) || pair[`${first}_inner_value`] !== witness.source_inner_value
        || pair[`${first}_border_value`] !== witness.source_border_value) continue;
      const source = byOccurrence.get(pair[`${first}_component_ref`])!, ghost = byOccurrence.get(pair[`${second}_component_ref`])!;
      const sameAppearance = (candidate: FramedRecord, match: FramedRecord): boolean => candidate.mask_digest === match.mask_digest
        && candidate.inner_value === match.inner_value && candidate.border_value === match.border_value && equal(candidate.mask_extent, match.mask_extent);
      if (occurrences.filter(row => sameAppearance(row, source)).length !== 1 || occurrences.filter(row => sameAppearance(row, ghost)).length !== 1) continue;
      const sourceGhostPairs = (measured.framed_mask_pairs as readonly FramedRecord[]).filter(row => row.first_component_ref === source.component_ref || row.second_component_ref === source.component_ref);
      if (sourceGhostPairs.length !== 1) continue;
      const joint = bindings.filter(([span]) => framedContains(span, source.frame_bbox) && framedContains(span, ghost.frame_bbox));
      if (joint.length !== 1) continue;
      carried.push({ source, ghost, span: joint[0]![0], history: joint[0]![1], group });
      if (carried.length > contract.maximum_pairs) return refused('directed_composition_pair_bound');
    }
  }
  if (!carried.length) return empty();
  const bands = measureParallelSolidBands(components, policy.route.parallel_band_measurement_contract);
  if (Object.values(bands).some(facts => facts.parallel_solid_band_domain_complete !== true)) return refused('directed_composition_support_incomplete');
  const regions = pointRegions(frame, components, bands), byComponent = new Map(components.map(component => [component.component_id, component]));
  // The original candidate map may overwrite loci. Recheck its complete bounded
  // domains before a native composition claims this physical point. Directed-
  // only packet observations never enter these directionless source measures.
  const classic = receipts.filter(record => record.native_directed_composition_only !== true
    && record.native_packet_witness?.native_directed_composition_only !== true);
  const locusInput = { frame, components, records: classic, span_records: spans, context_epoch: obs.level_epoch,
    span_contract: policy.route.point_motion_span_recall_contract, contract: policy.route.framed_reception_locus_contract };
  const [sourceBands, bandsComplete] = measureFramedReceptionLoci({ ...locusInput,
    mask_contract: policy.route.framed_reception_mask_contract, band_facts: bands });
  const [sourceRegions, regionsComplete] = measureRegionalReceptionLoci({ ...locusInput, mask_contract: policy.mask, operator_regions: regions });
  const hypotheses = new Map<string, FramedRecord>();
  for (const witness of classic) {
    if (witness.context_epoch !== obs.level_epoch || !witness.source_claim_ref || witness.marker_uniform !== true || witness.border_preserved !== true) continue;
    for (const pair of measured.framed_mask_pairs as readonly FramedRecord[]) for (const [first, second] of [['first', 'second'], ['second', 'first']] as const) {
      if (++work > contract.maximum_work) return refused('directed_composition_work_bound');
      if (!equal(pair.mask_extent, witness.mask_extent) || pair[`${first}_inner_value`] !== witness.source_inner_value
        || pair[`${first}_border_value`] !== witness.source_border_value) continue;
      const ref = `hypothesis:frame_analogy:${digest([witness.source_claim_ref, pair[`${second}_inner_value`], pair[`${second}_border_value`], pair.mask_extent])}`;
      hypotheses.set(ref, { ...witness, mask_extent: [...witness.mask_extent], marker_uniform: false,
        marker_inner_value: pair[`${second}_inner_value`], marker_border_value: pair[`${second}_border_value`], source_claim_ref: ref });
      if (hypotheses.size > policy.route.framed_reception_locus_contract.maximum_records) return refused('directed_competing_source_domain_incomplete');
    }
  }
  const [sourceAnalogues, analoguesComplete] = measureRegionalReceptionLoci({ ...locusInput, records: [...hypotheses.values()],
    mask_contract: policy.mask, operator_regions: regions, require_operator_value_match: false });
  if (!bandsComplete || !regionsComplete || !analoguesComplete) return refused('directed_competing_source_domain_incomplete');
  const competingSourcePoints = new Set([...sourceBands, ...sourceRegions, ...sourceAnalogues].map(([, point]) => pointKey(point)));
  const entries = new Map<string, Entry>();
  const inBounds = (box: readonly number[]): boolean => box[0]! >= 0 && box[1]! >= 0 && box[2]! < frame.height && box[3]! < frame.width;
  const spanFits = (span: FramedRecord, delta: number): boolean => inBounds(shiftBox(spanBox(span), span.axis, delta));
  const projectFrames = (span: FramedRecord, delta: number): FramedRecord[] => occurrences.filter(row => framedContains(span, row.frame_bbox))
    .map(row => ({ component_ref: row.component_ref, before_bbox: row.frame_bbox, projected_bbox: shiftBox(row.frame_bbox, span.axis, delta) }));
  const register = (offer: FramedOffer, key: string, task: FramedRecord): void => {
    const entryKey = digest([offer.candidate_ref, offer.component_ref]), entry = entries.get(entryKey) ?? { offer, tasks: new Map<string, FramedRecord>() };
    const prior = entry.tasks.get(key);
    if (prior) {
      const hypotheses = new Map([...prior.receipt_hypotheses, ...task.receipt_hypotheses].map((row: FramedRecord) => [row.observed_claim, row]));
      entry.tasks.set(key, { ...prior, receipt_claim_refs: unique([...prior.receipt_claim_refs, ...task.receipt_claim_refs]),
        receipt_hypotheses: [...hypotheses.values()].sort((a, b) => compareUnicode(a.observed_claim, b.observed_claim)) });
    } else entry.tasks.set(key, task);
    entries.set(entryKey, entry);
  };
  const offerFor = (region: FramedRegion, point: FramedPoint): FramedOffer | null => {
    const a = byComponent.get(region.support_refs[0]!)!, b = byComponent.get(region.support_refs[1]!)!;
    if (!a || !b || !equal(bands[a.component_id]?.parallel_solid_band_peer_refs, [b.component_id])
      || !equal(bands[b.component_id]?.parallel_solid_band_peer_refs, [a.component_id])) return null;
    const supportPatches = [a, b].map(component => ({ bbox: [component.bbox.left, component.bbox.top, component.bbox.right, component.bbox.bottom], value: component.value }));
    const key = digest([obs.level_epoch, point, supportPatches, rows]); if (Object.hasOwn(attempts, key)) return null;
    return { candidate_ref: key, component_ref: region.component_id, point: [...point], point_x: point[1], point_y: point[0],
      point_value: frame.rows[point[0]]![point[1]]!, patches: supportPatches, signature: digest(supportPatches),
      bbox: [Math.min(a.bbox.left, b.bbox.left), Math.min(a.bbox.top, b.bbox.top), Math.max(a.bbox.right, b.bbox.right), Math.max(a.bbox.bottom, b.bbox.bottom)],
      facts: { ...bands[a.component_id], parallel_solid_band_mutually_unique: true, framed_reception_analogy: false,
        ...measurePointSpanLocus(frame, point, bindings, complete), interaction_measurement_kind: 'point', candidate_execution_count: 0,
        attempted_without_effect_in_current_context: false, candidate_ref: key } };
  };
  const addQuestions = (base: FramedRecord, movingSpan: FramedRecord, delta: number): boolean => {
    if (!delta || !spanFits(movingSpan, delta)) return true;
    const side = delta < 0 ? 'lower' : 'upper', [low, high] = movingSpan.after_interval as [number, number];
    for (const region of regions) {
      if (++work > contract.maximum_work) return false;
      const prototypes = spans.filter(record => record.context_epoch === obs.level_epoch && record.axis === movingSpan.axis
        && record.point_before_side === side && record.operator_value === region.value && typeof record.source_claim_ref === 'string'
        && record.source_claim_ref && equal(patchSignature(record), patchSignature(movingSpan))
        && record.after_interval[1] - record.after_interval[0] === high - low);
      const offsets = [...new Set<number>(prototypes.map(record => side === 'lower' ? record.point_to_lower_edge : record.point_to_upper_edge))].sort((a, b) => a - b);
      for (const selectedOffset of offsets) {
        if (++work > contract.maximum_work) return false;
        const coordinate = side === 'lower' ? low + delta + selectedOffset : high + delta - selectedOffset;
        if (!Number.isSafeInteger(coordinate) || low <= coordinate && coordinate <= high) continue;
        const point: FramedPoint = movingSpan.axis === 'column' ? [Math.floor((region.bbox.top + region.bbox.bottom) / 2), coordinate]
          : [coordinate, Math.floor((region.bbox.left + region.bbox.right) / 2)];
        if (!region.pixels.some(pixel => equal(pixel, point))) continue;
        const related = bindings.filter(([span]) => {
          const axis = span.axis === 'column' ? point[1] : point[0], ortho = span.axis === 'column' ? point[0] : point[1];
          return span.orthogonal_interval[0] <= ortho && ortho <= span.orthogonal_interval[1]
            && (axis < span.after_interval[0] || axis > span.after_interval[1]);
        });
        if (related.length !== 1 || !equal(spanIdentity(related[0]![0]), spanIdentity(movingSpan))) continue;
        const offer = offerFor(region, point); if (!offer) continue;
        const predictions = offsets.map(offset => {
          const predictedDelta = side === 'lower' ? coordinate - offset - low : coordinate + offset - high;
          const projectedSpan = shiftBox(spanBox(movingSpan), movingSpan.axis, predictedDelta);
          const otherSpan = base.kind === 'prepare_uniform_receiver' ? base.co_carried_span : base.receiver_span;
          const otherPendingDelta = base.kind === 'prepare_uniform_receiver' ? base.pending_reception_geometry.source_alignment_delta : 0;
          return { offset, predicted_delta: predictedDelta,
            claim_refs: unique(prototypes.filter(record => (side === 'lower' ? record.point_to_lower_edge : record.point_to_upper_edge) === offset).map(record => record.source_claim_ref)),
            projected_span: projectedSpan, projected_frames: projectFrames(movingSpan, predictedDelta),
            within_public_bounds: spanFits(movingSpan, predictedDelta), independent_of_other_support:
              !overlaps(projectedSpan, spanBox(otherSpan)) && !overlaps(projectedSpan, shiftBox(spanBox(otherSpan), otherSpan.axis, otherPendingDelta)) };
        });
        if (predictions.some(prediction => !prediction.within_public_bounds || !prediction.independent_of_other_support)) continue;
        const selected = predictions.find(prediction => prediction.offset === selectedOffset)!;
        const sourceLocus = offer.facts;
        const exactLocus = sourceLocus.point_span_recall_domain_complete === true && sourceLocus.point_span_locus_binding_count === 1
          && sourceLocus.point_span_current_support_exact === true && sourceLocus.point_span_locus_expected_delta === delta
          && equal(sourceLocus.point_span_locus_current_endpoint_refs, movingSpan.endpoint_refs);
        const semantic = digest([base.kind, base.source.component_ref, base.ghost.component_ref, base.receiver.component_ref,
          base.receiver_anchor, base.observed_source_to_receiver_vector, spanIdentity(movingSpan), delta, selectedOffset]);
        const task = { ...base, task_ref: `directed_receiver_task:${semantic}`, moving_span: spanView(movingSpan),
          requested_translation: delta, operator_side: side, operator_value_current: region.value, selected_offset_hypothesis: selected,
          all_compatible_offset_predictions: predictions, source_point_span_measurement: measurePointSpanLocus(frame, point, bindings, complete),
          source_locus_revalidated: exactLocus, control_effect_established: false, physical_point: point,
          span_claim_refs: unique([...base.span_claim_refs, ...prototypes.map(record => record.source_claim_ref)]) };
        register(offer, semantic, task);
        if (entries.size > contract.maximum_offers) return false;
      }
    }
    return true;
  };
  for (const pair of carried) {
    const { source, ghost, span: pairSpan, history, group } = pair, witness = group.witnesses[0]!;
    for (const receiver of occurrences) {
      if (++work > contract.maximum_work) return refused('directed_composition_work_bound');
      if (receiver.inner_fills_bbox !== true || !equal(receiver.mask_extent, witness.mask_extent)
        || receiver.inner_value !== witness.marker_inner_value || receiver.border_value !== witness.marker_border_value) continue;
      const receiverBindings = bindings.filter(([span]) => framedContains(span, receiver.frame_bbox));
      if (receiverBindings.length !== 1) continue;
      const [receiverSpan, receiverHistory] = receiverBindings[0]!;
      if (receiverSpan.axis !== pairSpan.axis || equal(spanIdentity(receiverSpan), spanIdentity(pairSpan))
        || framedContains(receiverSpan, source.frame_bbox) || framedContains(receiverSpan, ghost.frame_bbox)
        || overlaps(spanBox(receiverSpan), spanBox(pairSpan))) continue;
      const axis = pairSpan.axis, axisLimit = axis === 'column' ? frame.width : frame.height;
      const receiverBox = receiver.frame_bbox as FramedBox, sourceBox = source.frame_bbox as FramedBox;
      for (let receiverDelta = -receiverSpan.after_interval[0]; receiverDelta < axisLimit - receiverSpan.after_interval[1]; receiverDelta++) {
        if (++work > contract.maximum_work || ++anchorCount > contract.maximum_anchors) return refused('directed_composition_anchor_bound');
        const anchor = shiftBox(receiverBox, axis, receiverDelta);
        const projectedSource = anchor.map((value, index) => value - group.vector[index % 2]!) as unknown as FramedBox;
        const sourceDelta = framedCenter(projectedSource, axis) - framedCenter(sourceBox, axis);
        if (!equal(shiftBox(sourceBox, axis, sourceDelta), projectedSource) || !sourceDelta || !spanFits(pairSpan, sourceDelta)) continue;
        if ([spanBox(pairSpan), shiftBox(spanBox(pairSpan), axis, sourceDelta)].some(sourceSupport =>
          [spanBox(receiverSpan), shiftBox(spanBox(receiverSpan), axis, receiverDelta)].some(receiverSupport => overlaps(sourceSupport, receiverSupport)))) continue;
        const projectedGhost = shiftBox(ghost.frame_bbox, axis, sourceDelta); if (!inBounds(projectedGhost)) continue;
        const gapMatches = framedGapPatches(projectedSource, anchor, frame).filter(([gapAxis, box, patch]: any[]) => gapAxis === axis
          && witness.gap_patches.some(([oldAxis, oldBox, oldPatch]: any[]) => oldAxis === gapAxis
            && box[2] - box[0] === oldBox[2] - oldBox[0] && box[3] - box[1] === oldBox[3] - oldBox[1] && equal(patch, oldPatch)));
        if (gapMatches.length !== 1) continue;
        const gapBox = gapMatches[0]![1];
        if ([spanBox(pairSpan), shiftBox(spanBox(pairSpan), axis, sourceDelta), spanBox(receiverSpan), shiftBox(spanBox(receiverSpan), axis, receiverDelta)]
          .some(box => overlaps(box, gapBox))) continue;
        if (++taskCount > contract.maximum_tasks) return refused('directed_composition_task_bound');
        const kind = receiverDelta === 0 ? 'test_directed_reception' : 'prepare_uniform_receiver';
        const receiptRefs = unique(group.witnesses.map(record => record.source_claim_ref));
        const base = { kind, source: occurrenceView(source), ghost: occurrenceView(ghost), receiver: occurrenceView(receiver),
          co_carried_span: spanView(pairSpan), receiver_span: spanView(receiverSpan), receiver_anchor: anchor,
          literal_gap: gapMatches[0], observed_source_to_receiver_vector: group.vector,
          receipt_claim_refs: receiptRefs, span_claim_refs: unique([...history, ...receiverHistory].map(record => record.source_claim_ref)),
          receipt_hypotheses: group.witnesses.map(record => ({ observed_claim: record.source_claim_ref,
            hypothesis_ref: `hypothesis:directed_current_reception:${digest([obs.observation_ref, record.source_claim_ref,
              source.component_ref, ghost.component_ref, receiver.component_ref, anchor, group.vector])}`,
            observed_mask_digest: record.mask_digest, current_mask_digest: source.mask_digest,
            same_mask_as_observed: record.mask_digest === source.mask_digest,
            epistemic_status: record.mask_digest === source.mask_digest ? 'observed_directed_reception_class' : 'current_shape_analogy_not_observed_reception',
            native_directed_composition_only: record.native_directed_composition_only === true,
            evidence: record.evidence ?? [], observed_source_bbox: record.source_frame_bbox, observed_receiver_bbox: record.marker_frame_bbox })),
          pending_reception_geometry: { projected_source_bbox: projectedSource, projected_ghost_bbox: projectedGhost,
            receiver_bbox: anchor, source_alignment_delta: sourceDelta, receiver_preparation_delta: receiverDelta,
            no_following_command_committed: true },
          gap_outside_current_and_projected_supports: true, reception_observed: false, expected_effect_status: 'unknown',
          isometry_applied: false, palette_mapping_applied: false, historical_receipt_reused: false, stored_action_sequence: false };
        if (!addQuestions(base, kind === 'test_directed_reception' ? pairSpan : receiverSpan, kind === 'test_directed_reception' ? sourceDelta : receiverDelta)) {
          return refused(entries.size > contract.maximum_offers ? 'directed_composition_offer_bound' : 'directed_composition_work_bound');
        }
      }
    }
  }
  const physical = new Map<string, Set<string>>(), sourceLoci = competingSourcePoints;
  for (const point of occupiedUniformReceptionPoints) if (point.raw_task_count > 0) sourceLoci.add(pointKey(point.point));
  for (const entry of entries.values()) for (const task of entry.tasks.keys()) {
    const key = pointKey(entry.offer.point), tasks = physical.get(key) ?? new Set<string>(); tasks.add(task); physical.set(key, tasks);
  }
  for (const offer of existingSourceOffers) if (Number(offer.facts.framed_reception_locus_binding_count) > 0) sourceLoci.add(pointKey(offer.point));
  const offers: DirectedReceiverOffer[] = [];
  for (const [, entry] of [...entries].sort(([a], [b]) => compareUnicode(a, b))) {
    const key = pointKey(entry.offer.point); if (physical.get(key)?.size !== 1 || sourceLoci.has(key) || entry.tasks.size !== 1) continue;
    const task = [...entry.tasks.values()][0]!;
    const question = { ...task, schema: contract.schema,
      question_ref: `directed_receiver_question:${digest([obs.observation_ref, entry.offer.candidate_ref, entry.offer.component_ref, task])}`,
      current_observation_ref: obs.observation_ref, context_epoch: obs.level_epoch, current_frame_hash: obs.frame_hash,
      current_rows_sha256: digest(rows), physical_task_count: 1, release_authority: false, terminal_completion_claimed: false };
    offers.push({ ...entry.offer, native_directed_receiver_question: question });
  }
  return { complete: true, offers, work_count: work };
}
