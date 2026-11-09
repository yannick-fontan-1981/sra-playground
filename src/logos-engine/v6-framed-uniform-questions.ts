/**
 * Native questions about an observed uniform receiver, independent of a
 * terminal same-mask marker. The pinned source measurements remain unchanged.
 * Only exact current geometry, literal directed gap patches and acquired
 * current-epoch control samples enter a reception question. When the required
 * side is unobserved, an existing source exploration point can qualify it.
 * The same bounded calibration can serve a current same-mask pair already
 * constructible by the source's explicit inter-mask reception analogy. Such a
 * prerequisite never becomes an observed receipt or a native ready reception.
 */
import { compareUnicode } from './canonical.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import { digest, extract, pointRegions, measureParallelSolidBands, measureCurrentPointSpanBindings,
  measureFramedMaskCorrespondences } from './v6-framed-transfer-observation.ts';
import { framedContains, framedCenter, framedGapPatches } from './v6-framed-transfer-mechanics.ts';
import type { FramedOffer, FramedPolicyShape, FramedRecord } from './v6-framed-transfer-observation.ts';
import type { FramedBox, FramedPoint, FramedRegion } from './v6-framed-transfer-mechanics.ts';
import type { NativeRows } from './v6-native-types.ts';
import type { V5Component } from './v6-native-observer.ts';

export const UNIFORM_RECEPTION_QUESTION_CONTRACT = Object.freeze({
  schema: 'native.current_uniform_reception_question.v1',
  maximum_work: 65536,
  maximum_existing_offers: 128,
});
export interface NativeUniformReceptionQuestion extends FramedRecord {
  readonly kind: 'calibration_dependency' | 'reception_question';
  readonly question_ref: string;
  readonly receipt_claim_refs: readonly string[];
  readonly span_claim_refs: readonly string[];
}
export interface NativeUniformReceptionOffer extends FramedOffer {
  readonly native_uniform_reception_question: NativeUniformReceptionQuestion;
}
export interface UniformReceptionQuestions {
  readonly complete: boolean;
  readonly receptionOffers: readonly NativeUniformReceptionOffer[];
  readonly calibrationOffers: readonly NativeUniformReceptionOffer[];
  readonly work_count: number;
  readonly reason?: string;
  /** Optional complete reception inventory before ambiguity filtering; never calibration points. */
  readonly occupiedReceptionPoints?: readonly { readonly point: readonly number[]; readonly raw_task_count: number; readonly task_refs: readonly string[] }[];
}
interface WitnessClass { readonly witnesses: FramedRecord[]; readonly vector: readonly number[] }
interface OfferEntry { readonly offer: FramedOffer; readonly tasks: Map<string, FramedRecord> }
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compareUnicode);
const vector = (a: readonly number[], b: readonly number[]): readonly [number, number] =>
  [(b[0]! + b[2]! - a[0]! - a[2]!) / 2, (b[1]! + b[3]! - a[1]! - a[3]!) / 2];
const patches = (span: FramedRecord): unknown[] => (span.endpoint_patches ?? []).map(([, patch]: any[]) => patch);
const samePoint = (a: readonly number[], b: readonly number[]): boolean => a[0] === b[0] && a[1] === b[1];

export async function measureCurrentUniformReceptionQuestions(
  rows: NativeRows, obs: FramedRecord, policy: FramedPolicyShape,
  spans: readonly FramedRecord[] = [], receipts: readonly FramedRecord[] = [], attempts: FramedRecord = {},
  existingOffers: readonly FramedOffer[] = [],
  includeReceptionDomain = false,
): Promise<UniformReceptionQuestions> {
  const own = UNIFORM_RECEPTION_QUESTION_CONTRACT, contract = policy.route.framed_reception_locus_contract;
  let work = 0, taskCount = 0;
  const refused = (reason: string): UniformReceptionQuestions => ({ complete: false, receptionOffers: [], calibrationOffers: [], work_count: work, reason });
  if (!contract || receipts.length > contract.maximum_records || existingOffers.length > own.maximum_existing_offers) return refused('uniform_question_inventory_bound');
  if (!Number.isSafeInteger(obs.level_epoch) || typeof obs.observation_ref !== 'string') return refused('uniform_question_observation_invalid');
  const width = rows[0]?.length ?? 0;
  if (!width || !rows.length || width * rows.length > policy.mask.maximum_frame_pixels || rows.some(row => row.length !== width
    || row.some(value => !Number.isSafeInteger(value) || value < 0 || value > 255))) return refused('uniform_question_frame_invalid');
  const [frame, components, scene] = await extract(rows, obs.observation_ref);
  const measured = measureFramedMaskCorrespondences(frame, scene.entities, policy.mask);
  const [bindings, bindingComplete] = measureCurrentPointSpanBindings(frame, spans, obs.level_epoch, policy.route.point_motion_span_recall_contract);
  if (measured.framed_mask_domain_complete !== true || !bindingComplete) return refused('uniform_question_measurement_incomplete');
  const bands = measureParallelSolidBands(components, policy.route.parallel_band_measurement_contract);
  if (Object.values(bands).some(f => (f as FramedRecord).parallel_solid_band_domain_complete !== true)) return refused('uniform_question_band_inventory_incomplete');
  const regions = pointRegions(frame, components, bands), byref = new Map(components.map(c => [c.component_id, c]));
  const occurrences = measured.framed_mask_occurrences as readonly FramedRecord[], classes = new Map<string, WitnessClass>();
  for (const witness of receipts) {
    if (++work > own.maximum_work) return refused('uniform_question_work_bound');
    if (witness.context_epoch !== obs.level_epoch || witness.marker_uniform !== true || witness.border_preserved !== true
      || typeof witness.source_claim_ref !== 'string' || !witness.source_claim_ref
      || !Array.isArray(witness.source_frame_bbox) || !Array.isArray(witness.marker_frame_bbox)) continue;
    const direction = vector(witness.source_frame_bbox, witness.marker_frame_bbox);
    const key = digest([witness.mask_digest, witness.mask_extent, witness.source_inner_value, witness.source_border_value,
      witness.marker_inner_value, witness.marker_border_value, direction,
      (witness.gap_patches ?? []).map(([axis, box, patch]: any[]) => [axis, [box[2] - box[0], box[3] - box[1]], patch])]);
    const group = classes.get(key) ?? { witnesses: [], vector: direction }; group.witnesses.push(witness); classes.set(key, group);
  }
  if (classes.size > contract.maximum_relations) return refused('uniform_question_class_bound');
  const ready = new Map<string, OfferEntry>(), calibration = new Map<string, OfferEntry>();
  const noAttempt = (candidate: FramedOffer): boolean => candidate.facts.candidate_execution_count === 0
    && candidate.facts.attempted_without_effect_in_current_context !== true && !Object.hasOwn(attempts, candidate.candidate_ref);
  const mutuallyUnique = (a: V5Component, b: V5Component): boolean => bands[a.component_id]?.parallel_solid_band_domain_complete === true
    && bands[b.component_id]?.parallel_solid_band_domain_complete === true
    && equal(bands[a.component_id]?.parallel_solid_band_peer_refs, [b.component_id])
    && equal(bands[b.component_id]?.parallel_solid_band_peer_refs, [a.component_id]);
  const register = (target: Map<string, OfferEntry>, offer: FramedOffer, task: FramedRecord): void => {
    const key = digest([offer.candidate_ref, offer.component_ref]);
    const entry = target.get(key) ?? { offer, tasks: new Map<string, FramedRecord>() };
    const prior = entry.tasks.get(task.task_ref);
    entry.tasks.set(task.task_ref, prior ? { ...prior,
      receipt_claim_refs: unique([...prior.receipt_claim_refs, ...task.receipt_claim_refs]),
      span_claim_refs: unique([...prior.span_claim_refs, ...task.span_claim_refs]),
      prototype_claim_refs: unique([...(prior.prototype_claim_refs ?? []), ...(task.prototype_claim_refs ?? [])]),
    } : task);
    target.set(key, entry);
  };
  const currentOffer = (region: FramedRegion, point: FramedPoint, facts: FramedRecord): FramedOffer | null => {
    const a = byref.get(region.support_refs[0]!)!, b = byref.get(region.support_refs[1]!)!;
    if (!a || !b || !mutuallyUnique(a, b)) return null;
    const support = [a, b], supportPatches = support.map(c => ({ bbox: [c.bbox.left, c.bbox.top, c.bbox.right, c.bbox.bottom], value: c.value }));
    const key = digest([obs.level_epoch, point, supportPatches, rows]);
    const candidate: FramedOffer = { candidate_ref: key, component_ref: region.component_id, point: [...point], point_x: point[1], point_y: point[0],
      patches: supportPatches, signature: digest(supportPatches), point_value: rows[point[0]]![point[1]]!,
      bbox: [Math.min(a.bbox.left, b.bbox.left), Math.min(a.bbox.top, b.bbox.top), Math.max(a.bbox.right, b.bbox.right), Math.max(a.bbox.bottom, b.bbox.bottom)],
      facts: { ...bands[a.component_id], parallel_solid_band_mutually_unique: true, framed_reception_analogy: false,
        ...facts, interaction_measurement_kind: 'point', candidate_execution_count: Number(Object.hasOwn(attempts, key)),
        attempted_without_effect_in_current_context: attempts[key]?.unchanged === true, candidate_ref: key } };
    return noAttempt(candidate) ? candidate : null;
  };
  const currentExplorationOffers = existingOffers.filter(offer => {
    const a = byref.get(offer.component_ref), peerRef = a && bands[a.component_id]?.parallel_solid_band_peer_refs?.[0];
    const b = typeof peerRef === 'string' ? byref.get(peerRef) : undefined;
    if (!a || !b || !mutuallyUnique(a, b)) return false;
    const currentPatches = [a, b].map(c => ({ bbox: [c.bbox.left, c.bbox.top, c.bbox.right, c.bbox.bottom], value: c.value }));
    const currentPoint = [Math.floor((Math.min(a.bbox.top, b.bbox.top) + Math.max(a.bbox.bottom, b.bbox.bottom)) / 2),
      Math.floor((Math.min(a.bbox.left, b.bbox.left) + Math.max(a.bbox.right, b.bbox.right)) / 2)];
    return equal(offer.patches, currentPatches) && equal(offer.point, currentPoint)
      && offer.signature === digest(currentPatches)
      && offer.candidate_ref === digest([obs.level_epoch, currentPoint, currentPatches, rows]);
  });

  for (const [, group] of [...classes].sort(([a], [b]) => compareUnicode(a, b))) {
    const witnesses = [...group.witnesses].sort((a, b) => compareUnicode(a.source_claim_ref, b.source_claim_ref)), witness = witnesses[0]!;
    const receiptRefs = unique(witnesses.map(w => w.source_claim_ref));
    const sources = occurrences.filter(r => r.inner_fills_bbox === false && r.mask_digest === witness.mask_digest
      && equal(r.mask_extent, witness.mask_extent) && r.inner_value === witness.source_inner_value && r.border_value === witness.source_border_value);
    if (sources.length !== 1 || !String(sources[0]!.entity_ref).startsWith('shape:')) continue;
    const source = sources[0]!, sourceBox = source.frame_bbox as FramedBox;
    for (const receiver of occurrences) {
      if (++work > own.maximum_work) return refused('uniform_question_work_bound');
      if (receiver.inner_fills_bbox !== true || !equal(receiver.mask_extent, witness.mask_extent)
        || receiver.inner_value !== witness.marker_inner_value || receiver.border_value !== witness.marker_border_value) continue;
      const receiverBox = receiver.frame_bbox as FramedBox;
      for (const [span, history] of bindings) for (const moving of ['source', 'receiver'] as const) {
        if (++work > own.maximum_work) return refused('uniform_question_work_bound');
        const sourceInside = framedContains(span, sourceBox), receiverInside = framedContains(span, receiverBox);
        if (!(moving === 'source' ? sourceInside && !receiverInside : receiverInside && !sourceInside)) continue;
        const axis = span.axis, delta = moving === 'source' ? framedCenter(receiverBox, axis) - framedCenter(sourceBox, axis)
          : framedCenter(sourceBox, axis) - framedCenter(receiverBox, axis);
        if (!delta) continue;
        const [low, high] = span.after_interval as [number, number];
        if (low + delta < 0 || high + delta >= (axis === 'column' ? frame.width : frame.height)) continue;
        const shift = (box: FramedBox, which: string): FramedBox => box.map((value, index) => value
          + (moving === which && (axis === 'column' ? index === 1 || index === 3 : index === 0 || index === 2) ? delta : 0)) as unknown as FramedBox;
        const shiftedSource = shift(sourceBox, 'source'), shiftedReceiver = shift(receiverBox, 'receiver');
        // A literal patch alone cannot turn a witnessed downward entry into an
        // upward one. The complete source-to-receiver displacement is retained.
        if (!equal(vector(shiftedSource, shiftedReceiver), group.vector)) continue;
        const gaps = framedGapPatches(shiftedSource, shiftedReceiver, frame).filter(([gapAxis]: any[]) => gapAxis === axis);
        const matchingGaps = gaps.filter(([gapAxis, box, patch]: any[]) => (witness.gap_patches ?? []).some(([oldAxis, oldBox, oldPatch]: any[]) =>
          oldAxis === gapAxis && box[2] - box[0] === oldBox[2] - oldBox[0] && box[3] - box[1] === oldBox[3] - oldBox[1] && equal(patch, oldPatch)));
        if (matchingGaps.length !== 1) continue;
        if (++taskCount > contract.maximum_tasks) return refused('uniform_question_task_bound');
        const side = delta < 0 ? 'lower' : 'upper', currentSpanRefs = unique(history.map(r => r.source_claim_ref).filter((r): r is string => typeof r === 'string' && Boolean(r)));
        const prototypeRows = spans.filter(p => p.context_epoch === obs.level_epoch && p.axis === axis && p.point_before_side === side
          && typeof p.source_claim_ref === 'string' && p.source_claim_ref && equal(patches(p), patches(span))
          && p.after_interval[1] - p.after_interval[0] === high - low);
        const base: FramedRecord = { task_ref: `uniform_reception_task:${digest([obs.observation_ref, source.component_ref, receiver.component_ref,
          span.endpoint_refs, moving, delta, matchingGaps, receiptRefs])}`,
          source: { component_ref: source.component_ref, entity_ref: source.entity_ref, frame_bbox: sourceBox, mask_digest: source.mask_digest,
            mask_extent: source.mask_extent, inner_value: source.inner_value, border_value: source.border_value },
          receiver: { component_ref: receiver.component_ref, frame_bbox: receiverBox, mask_extent: receiver.mask_extent,
            inner_value: receiver.inner_value, border_value: receiver.border_value, inner_fills_bbox: true },
          moving, axis, required_side: side, alignment_delta: delta, projected_source_bbox: shiftedSource, projected_receiver_bbox: shiftedReceiver,
          projected_span_interval: [low + delta, high + delta], literal_gap: matchingGaps[0], observed_source_to_receiver_vector: group.vector,
          orientation_preserved: true, isometry_applied: false, palette_mapping_applied: false,
          receipt_claim_refs: receiptRefs, span_claim_refs: currentSpanRefs,
          current_span: { axis, after_interval: span.after_interval, orthogonal_interval: span.orthogonal_interval,
            endpoint_refs: span.endpoint_refs, endpoint_patches: span.endpoint_patches },
        };
        for (const region of regions) {
          if (++work > own.maximum_work) return refused('uniform_question_work_bound');
          const usable = prototypeRows.filter(p => p.operator_value === region.value), offsets = unique(usable.map(p => String(side === 'lower' ? p.point_to_lower_edge : p.point_to_upper_edge)));
          if (offsets.length !== 1) continue;
          const offset = Number(offsets[0]), coordinate = side === 'lower' ? low + delta + offset : high + delta - offset;
          if (low <= coordinate && coordinate <= high) continue;
          const point: FramedPoint = axis === 'column' ? [Math.floor((region.bbox.top + region.bbox.bottom) / 2), coordinate]
            : [coordinate, Math.floor((region.bbox.left + region.bbox.right) / 2)];
          const orthogonal = axis === 'column' ? point[0] : point[1];
          if (!(span.orthogonal_interval[0] <= orthogonal && orthogonal <= span.orthogonal_interval[1]) || !region.pixels.some(p => samePoint(p, point))) continue;
          const prototypeRefs = unique(usable.map(p => p.source_claim_ref)), supportRefs = unique([...receiptRefs, ...currentSpanRefs, ...prototypeRefs]);
          const offer = currentOffer(region, point, { framed_reception_locus_complete: true, framed_reception_locus_binding_count: 1,
            framed_reception_locus_same_mask_marker: false, framed_reception_locus_mask_digest: source.mask_digest,
            framed_reception_locus_expected_delta: delta, framed_reception_locus_axis: axis,
            framed_reception_locus_source_ref: source.component_ref, framed_reception_locus_marker_ref: receiver.component_ref,
            framed_reception_locus_local_operator: usable.some(p => equal(p.endpoint_refs, span.endpoint_refs)),
            framed_reception_locus_premise_refs: supportRefs, operator_value_current: region.value,
            operator_value_observed: region.value, operator_value_matches_observation: true });
          if (offer) register(ready, offer, { ...base, prototype_status: 'observed_current_epoch', prototype_claim_refs: prototypeRefs,
            span_claim_refs: unique([...currentSpanRefs, ...prototypeRefs]), operator_value_current: region.value, observed_offset: offset, qualified_point: point });
        }
        for (const offer of currentExplorationOffers) {
          if (++work > own.maximum_work) return refused('uniform_question_work_bound');
          if (!noAttempt(offer) || offer.facts.parallel_solid_band_domain_complete !== true || offer.facts.parallel_solid_band_peer_count !== 1
            || offer.facts.parallel_solid_band_mutually_unique !== true || offer.facts.framed_reception_analogy === true) continue;
          const point = offer.point, coordinate = axis === 'column' ? point[1]! : point[0]!, orthogonal = axis === 'column' ? point[0]! : point[1]!;
          if (!(span.orthogonal_interval[0] <= orthogonal && orthogonal <= span.orthogonal_interval[1])
            || (side === 'lower' ? coordinate >= low : coordinate <= high) || offer.point_value !== rows[point[0]!]![point[1]!]!) continue;
          const related = bindings.filter(([s]) => { const c = s.axis === 'column' ? point[1]! : point[0]!, o = s.axis === 'column' ? point[0]! : point[1]!;
            return s.orthogonal_interval[0] <= o && o <= s.orthogonal_interval[1] && (c < s.after_interval[0] || c > s.after_interval[1]); });
          if (related.length !== 1 || prototypeRows.some(p => p.operator_value === offer.point_value)) continue;
          // Preserve the complete original candidate and its source facts. This
          // is a bounded control question, not a qualified reception locus.
          register(calibration, offer, { ...base, prototype_status: 'missing_for_required_side_and_current_value', prototype_claim_refs: [],
            operator_value_current: offer.point_value, existing_candidate_ref: offer.candidate_ref, existing_component_ref: offer.component_ref,
            calibration_point: offer.point, pending_alignment_is_not_an_action_plan: true });
        }
        if (ready.size + calibration.size > contract.maximum_loci) return refused('uniform_question_offer_bound');
      }
    }
  }

  // Preserve the source analogy's exact current-pair premises. Its geometry
  // only emits ready loci, so an otherwise valid relation with an unobserved
  // control side disappears. Expose that missing prerequisite without making
  // a reception claim, changing a mask, or inventing a new point.
  const byComponent = new Map(occurrences.map(occurrence => [occurrence.component_ref, occurrence]));
  const sourceMarkers = new Map<string, Set<string>>();
  const typedRelations: { group: WitnessClass; source: FramedRecord; receiver: FramedRecord }[] = [];
  for (const [, group] of [...classes].sort(([a], [b]) => compareUnicode(a, b))) {
    const witness = group.witnesses[0]!;
    for (const pair of measured.framed_mask_pairs as readonly FramedRecord[]) for (const [first, second] of [['first', 'second'], ['second', 'first']] as const) {
      if (++work > own.maximum_work) return refused('uniform_question_work_bound');
      if (!equal(pair.mask_extent, witness.mask_extent) || pair[`${first}_inner_value`] !== witness.source_inner_value
        || pair[`${first}_border_value`] !== witness.source_border_value) continue;
      const source = byComponent.get(pair[`${first}_component_ref`]), receiver = byComponent.get(pair[`${second}_component_ref`]);
      if (!source || !receiver) continue;
      const markers = sourceMarkers.get(source.component_ref) ?? new Set<string>();
      markers.add(receiver.component_ref); sourceMarkers.set(source.component_ref, markers);
      typedRelations.push({ group, source, receiver });
      if (typedRelations.length > contract.maximum_relations) return refused('typed_calibration_relation_bound');
    }
  }
  for (const { group, source, receiver } of typedRelations) {
    if (sourceMarkers.get(source.component_ref)?.size !== 1) continue;
    // Current framed appearances distinguish border contrast. No historical
    // component identity is inferred from an equal interior mask elsewhere.
    const matchingSources = occurrences.filter(r => r.mask_digest === source.mask_digest && r.inner_value === source.inner_value
      && r.border_value === source.border_value && equal(r.mask_extent, source.mask_extent));
    if (matchingSources.length !== 1) continue;
    const witnesses = [...group.witnesses].sort((a, b) => compareUnicode(a.source_claim_ref, b.source_claim_ref)), witness = witnesses[0]!;
    const receiptRefs = unique(witnesses.map(w => w.source_claim_ref)), sourceBox = source.frame_bbox as FramedBox, receiverBox = receiver.frame_bbox as FramedBox;
    for (const [span, history] of bindings) for (const moving of ['source', 'receiver'] as const) {
      if (++work > own.maximum_work) return refused('uniform_question_work_bound');
      const sourceInside = framedContains(span, sourceBox), receiverInside = framedContains(span, receiverBox);
      if (!(moving === 'source' ? sourceInside && !receiverInside : receiverInside && !sourceInside)) continue;
      const axis = span.axis, delta = moving === 'source' ? framedCenter(receiverBox, axis) - framedCenter(sourceBox, axis)
        : framedCenter(sourceBox, axis) - framedCenter(receiverBox, axis);
      if (!delta) continue;
      const [low, high] = span.after_interval as [number, number];
      if (low + delta < 0 || high + delta >= (axis === 'column' ? frame.width : frame.height)) continue;
      const shift = (box: FramedBox, which: string): FramedBox => box.map((value, index) => value
        + (moving === which && (axis === 'column' ? index === 1 || index === 3 : index === 0 || index === 2) ? delta : 0)) as unknown as FramedBox;
      const shiftedSource = shift(sourceBox, 'source'), shiftedReceiver = shift(receiverBox, 'receiver');
      if (!equal(vector(shiftedSource, shiftedReceiver), group.vector)) continue;
      const matchingGaps = framedGapPatches(shiftedSource, shiftedReceiver, frame).filter(([gapAxis, box, patch]: any[]) => gapAxis === axis
        && (witness.gap_patches ?? []).some(([oldAxis, oldBox, oldPatch]: any[]) => oldAxis === gapAxis
          && box[2] - box[0] === oldBox[2] - oldBox[0] && box[3] - box[1] === oldBox[3] - oldBox[1] && equal(patch, oldPatch)));
      if (matchingGaps.length !== 1) continue;
      if (++taskCount > contract.maximum_tasks) return refused('uniform_question_task_bound');
      const side = delta < 0 ? 'lower' : 'upper', spanRefs = unique(history.map(r => r.source_claim_ref).filter((r): r is string => typeof r === 'string' && Boolean(r)));
      const prototypes = spans.filter(p => p.context_epoch === obs.level_epoch && p.axis === axis && p.point_before_side === side
        && typeof p.source_claim_ref === 'string' && p.source_claim_ref && equal(patches(p), patches(span))
        && p.after_interval[1] - p.after_interval[0] === high - low);
      const hypotheses = witnesses.map(w => ({
        hypothesis_ref: `hypothesis:frame_analogy:${digest([w.source_claim_ref, receiver.inner_value, receiver.border_value, source.mask_extent])}`,
        observed_claim: w.source_claim_ref, observed_mask_digest: w.mask_digest, current_mask_digest: source.mask_digest,
        source_ref: source.component_ref, marker_ref: receiver.component_ref, epistemic_status: 'hypothesis_not_observed_reception',
      }));
      for (const offer of currentExplorationOffers) {
        if (++work > own.maximum_work) return refused('uniform_question_work_bound');
        if (!noAttempt(offer) || offer.facts.parallel_solid_band_domain_complete !== true || offer.facts.parallel_solid_band_peer_count !== 1
          || offer.facts.parallel_solid_band_mutually_unique !== true || offer.facts.framed_reception_analogy === true) continue;
        const point = offer.point, coordinate = axis === 'column' ? point[1]! : point[0]!, orthogonal = axis === 'column' ? point[0]! : point[1]!;
        if (!(span.orthogonal_interval[0] <= orthogonal && orthogonal <= span.orthogonal_interval[1])
          || (side === 'lower' ? coordinate >= low : coordinate <= high) || offer.point_value !== rows[point[0]!]![point[1]!]!) continue;
        const related = bindings.filter(([s]) => { const c = s.axis === 'column' ? point[1]! : point[0]!, o = s.axis === 'column' ? point[0]! : point[1]!;
          return s.orthogonal_interval[0] <= o && o <= s.orthogonal_interval[1] && (c < s.after_interval[0] || c > s.after_interval[1]); });
        if (related.length !== 1 || prototypes.some(p => p.operator_value === offer.point_value)) continue;
        register(calibration, offer, {
          task_ref: `typed_reception_calibration_task:${digest([obs.observation_ref, source.component_ref, receiver.component_ref,
            span.endpoint_refs, moving, delta, matchingGaps, hypotheses])}`,
          basis_kind: 'current_typed_analogy_prerequisite', source_reception_projection_ref: 'projection.current_observed_entry_analogy',
          source_hypotheses: hypotheses, typed_reception_observed: false,
          source: { component_ref: source.component_ref, entity_ref: source.entity_ref, frame_bbox: sourceBox, mask_digest: source.mask_digest,
            mask_extent: source.mask_extent, inner_value: source.inner_value, border_value: source.border_value },
          receiver: { component_ref: receiver.component_ref, frame_bbox: receiverBox, mask_digest: receiver.mask_digest,
            mask_extent: receiver.mask_extent, inner_value: receiver.inner_value, border_value: receiver.border_value, inner_fills_bbox: receiver.inner_fills_bbox },
          moving, axis, required_side: side, alignment_delta: delta, projected_source_bbox: shiftedSource, projected_receiver_bbox: shiftedReceiver,
          projected_span_interval: [low + delta, high + delta], literal_gap: matchingGaps[0], observed_source_to_receiver_vector: group.vector,
          orientation_preserved: true, isometry_applied: false, palette_mapping_applied: false,
          receipt_claim_refs: receiptRefs, span_claim_refs: spanRefs,
          current_span: { axis, after_interval: span.after_interval, orthogonal_interval: span.orthogonal_interval,
            endpoint_refs: span.endpoint_refs, endpoint_patches: span.endpoint_patches },
          prototype_status: 'missing_for_required_side_and_current_value', prototype_claim_refs: [],
          operator_value_current: offer.point_value, existing_candidate_ref: offer.candidate_ref, existing_component_ref: offer.component_ref,
          calibration_point: offer.point, pending_alignment_is_not_an_action_plan: true,
        });
        if (ready.size + calibration.size > contract.maximum_loci) return refused('uniform_question_offer_bound');
      }
    }
  }

  // A physical click can have several support descriptions. Count reception
  // tasks across all of them before asserting one binding on a native offer.
  // Candidate/component ids and supporting receipt ids are not task identity.
  const physicalTasks = new Map<string, Map<string, Set<string>>>(), sourceAmbiguous = new Set<string>();
  const pointKey = (point: readonly number[]): string => JSON.stringify(point);
  const taskKey = (source: unknown, receiver: unknown, mask: unknown, axis: unknown, delta: unknown, sameMask: unknown): string =>
    digest([source, receiver, mask, axis, delta, sameMask]);
  const registerPhysicalTask = (point: readonly number[], key: string, nativeTaskRef?: string): void => {
    const physical = pointKey(point), tasks = physicalTasks.get(physical) ?? new Map<string, Set<string>>();
    const currentBindings = tasks.get(key) ?? new Set<string>();
    if (nativeTaskRef !== undefined) currentBindings.add(nativeTaskRef);
    tasks.set(key, currentBindings); physicalTasks.set(physical, tasks);
  };
  for (const entry of ready.values()) for (const task of entry.tasks.values()) {
    if (++work > own.maximum_work) return refused('uniform_question_work_bound');
    registerPhysicalTask(entry.offer.point, taskKey(task.source.component_ref, task.receiver.component_ref,
      task.source.mask_digest, task.axis, task.alignment_delta, false), task.task_ref);
  }
  for (const offer of existingOffers) {
    if (++work > own.maximum_work) return refused('uniform_question_work_bound');
    const facts = offer.facts, count = facts.framed_reception_locus_binding_count;
    if (!(typeof count === 'number' && count > 0)) continue; // A plain calibration is not a reception task.
    if (['framed_reception_locus_source_ref', 'framed_reception_locus_marker_ref', 'framed_reception_locus_mask_digest',
      'framed_reception_locus_axis', 'framed_reception_locus_expected_delta', 'framed_reception_locus_same_mask_marker']
      .some(field => facts[field] === undefined)) { sourceAmbiguous.add(pointKey(offer.point)); continue; }
    registerPhysicalTask(offer.point, taskKey(facts.framed_reception_locus_source_ref, facts.framed_reception_locus_marker_ref,
      facts.framed_reception_locus_mask_digest, facts.framed_reception_locus_axis, facts.framed_reception_locus_expected_delta,
      facts.framed_reception_locus_same_mask_marker));
    // The source candidate map may overwrite another locus at [point,component].
    // Its retained multiplicity must not become a native uniqueness assertion.
    if (count !== 1 || facts.framed_reception_locus_complete !== true) sourceAmbiguous.add(pointKey(offer.point));
  }

  const finish = (entries: Map<string, OfferEntry>, kind: NativeUniformReceptionQuestion['kind']): NativeUniformReceptionOffer[] => {
    const result: NativeUniformReceptionOffer[] = [];
    for (const [, entry] of [...entries].sort(([a], [b]) => compareUnicode(a, b))) {
      const tasks = [...entry.tasks.values()].sort((a, b) => compareUnicode(a.task_ref, b.task_ref));
      const physicalCount = [...(physicalTasks.get(pointKey(entry.offer.point))?.values() ?? [])]
        .reduce((count, currentBindings) => count + Math.max(1, currentBindings.size), 0);
      if (kind === 'reception_question' && (tasks.length !== 1 || physicalCount !== 1
        || sourceAmbiguous.has(pointKey(entry.offer.point)))) continue;
      const receiptRefs = unique(tasks.flatMap(t => t.receipt_claim_refs)), spanRefs = unique(tasks.flatMap(t => t.span_claim_refs));
      const typedTasks = tasks.filter(task => task.basis_kind === 'current_typed_analogy_prerequisite');
      const witness: NativeUniformReceptionQuestion = {
        kind, question_ref: `uniform_reception_question:${digest([obs.observation_ref, kind, entry.offer.candidate_ref, entry.offer.component_ref, tasks])}`,
        ...(typedTasks.length ? { basis_kind: typedTasks.length === tasks.length ? 'current_typed_analogy_prerequisite' : 'mixed_current_reception_prerequisites' } : {}),
        schema: own.schema, current_observation_ref: obs.observation_ref, context_epoch: obs.level_epoch,
        current_frame_hash: obs.frame_hash ?? null, current_rows_sha256: digest(rows), receipt_claim_refs: receiptRefs, span_claim_refs: spanRefs,
        tasks, expected_effect_status: kind === 'calibration_dependency' ? 'control_offset_to_be_observed' : 'conditional_reception_not_terminal_law',
        historical_receipt_reused: false, terminal_completion_claimed: false, stored_action_sequence: false,
      };
      result.push({ ...entry.offer, native_uniform_reception_question: witness });
    }
    return result;
  };
  const occupied = new Map<string, { point: readonly number[]; refs: Set<string> }>();
  if (includeReceptionDomain) for (const entry of ready.values()) {
    const key = pointKey(entry.offer.point), row = occupied.get(key) ?? { point: [...entry.offer.point], refs: new Set<string>() };
    for (const ref of entry.tasks.keys()) row.refs.add(ref);
    occupied.set(key, row);
  }
  return { complete: true, receptionOffers: finish(ready, 'reception_question'), calibrationOffers: finish(calibration, 'calibration_dependency'), work_count: work,
    ...(includeReceptionDomain ? { occupiedReceptionPoints: [...occupied].sort(([a], [b]) => compareUnicode(a, b)).map(([, row]) =>
      ({ point: row.point, raw_task_count: row.refs.size, task_refs: unique([...row.refs]) })) } : {}) };
}
