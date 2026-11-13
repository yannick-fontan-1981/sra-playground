/**
 * Public measurements for morphology_policy/framed_transfer/geometry.py.
 * Reference 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e; no game identifier,
 * level route, fixed palette role or oracle enters this module.
 */
import { compareUnicode } from './canonical.ts';
import { symbolicDigest } from './v6-hash.ts';
import { detectV5Components } from './v6-native-observer.ts';
import { pythonEqual as equal, pythonTruthy as truthy } from './v6-operations.ts';
import {
  framedBox, framedPatch, measureParallelSolidBands, measureCurrentPointSpanBindings, measurePointSpanLocus,
  measureFramedReceptionLoci, measureRegionalReceptionLoci, measureFramedMaskCorrespondences,
  measurePointMotionSpans, measureFramedReplacements,
} from './v6-framed-transfer-mechanics.ts';
import type { V5Component } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';
import type { FramedRecord, FramedPoint, FramedFrame, FramedScene, FramedRegion, FramedTranslation, FramedBox } from './v6-framed-transfer-mechanics.ts';

export type { FramedRecord } from './v6-framed-transfer-mechanics.ts';
export { measureParallelSolidBands, measureCurrentPointSpanBindings, measurePointSpanLocus, measureFramedReceptionLoci, measureRegionalReceptionLoci,
  measureFramedMaskCorrespondences, measurePointMotionSpans, measureFramedReplacements } from './v6-framed-transfer-mechanics.ts';
export interface FramedPolicyShape {
  readonly route: FramedRecord; readonly mask: FramedRecord; readonly policies: FramedRecord; readonly config?: FramedRecord;
}
export interface FramedOffer extends FramedRecord {
  candidate_ref: string; point_x: number; point_y: number; point: number[]; facts: FramedRecord; component_ref: string;
  patches: { bbox: number[]; value: number }[]; bbox: number[]; signature: string; point_value: number;
}
/** Source geometry.digest: compact sorted ensure_ascii JSON over exact integers. */
export const digest = symbolicDigest;
const boxModel = (component: V5Component): FramedRecord => ({ top: component.bbox.top, left: component.bbox.left, bottom: component.bbox.bottom, right: component.bbox.right });
const signature = (component: V5Component): string => digest([component.value, component.bbox.height, component.bbox.width, component.relative_pixels]);
const keyOf = (value: unknown): string => JSON.stringify(value);

export async function extract(rows: NativeRows, ref: string): Promise<readonly [FramedFrame, readonly V5Component[], FramedScene]> {
  const frame: FramedFrame = { rows, height: rows.length, width: rows[0]?.length ?? 0 }, { components } = await detectV5Components(rows, 4);
  const signatures = components.map(signature), counts = new Map<string, number>();
  for (const key of signatures) counts.set(key, (counts.get(key) ?? 0) + 1);
  const entities = components.map((component, index) => { const key = signatures[index]!;
    return { entity_id: counts.get(key) === 1 ? `shape:${key}` : `occurrence:${digest([key, boxModel(component)])}`, component }; });
  return [frame, components, { entities, frame_ref: ref }];
}

export function pointRegions(frame: FramedFrame, components: readonly V5Component[], bands: FramedRecord): FramedRegion[] {
  const byref = new Map(components.map(c => [c.component_id, c])), regions: FramedRegion[] = [], seen = new Set<string>();
  for (const c of components) {
    const facts = bands[c.component_id] ?? {};
    if (facts.parallel_solid_band_peer_count !== 1) continue;
    const peer = byref.get(facts.parallel_solid_band_peer_refs[0])!, peerFacts = bands[peer.component_id] ?? {};
    if (peerFacts.parallel_solid_band_peer_count !== 1 || !equal(peerFacts.parallel_solid_band_peer_refs ?? [], [c.component_id])) continue;
    const key = [c.component_id, peer.component_id].sort(compareUnicode), encoded = keyOf(key);
    if (seen.has(encoded)) continue;
    seen.add(encoded);
    let top: number, left: number, bottom: number, right: number;
    if (c.bbox.left === peer.bbox.left && c.bbox.right === peer.bbox.right) {
      top = Math.min(c.bbox.bottom, peer.bbox.bottom) + 1; bottom = Math.max(c.bbox.top, peer.bbox.top) - 1; left = c.bbox.left; right = c.bbox.right;
    } else if (c.bbox.top === peer.bbox.top && c.bbox.bottom === peer.bbox.bottom) {
      left = Math.min(c.bbox.right, peer.bbox.right) + 1; right = Math.max(c.bbox.left, peer.bbox.left) - 1; top = c.bbox.top; bottom = c.bbox.bottom;
    } else continue;
    if (top > bottom || left > right) continue;
    const values = new Set<number>();
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) values.add(frame.rows[y]![x]!);
    for (const value of [...values].sort((a, b) => a - b)) {
      const pixels: FramedPoint[] = [];
      for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) if (frame.rows[y]![x] === value) pixels.push([y, x]);
      regions.push({ component_id: `point_region:${digest([key, value])}`, value, bbox: { top, left, bottom, right }, pixels, supported_by_mutual_parallel_pair: true, support_refs: key });
    }
  }
  return regions;
}

export async function candidates(rows: NativeRows, obs: FramedRecord, policy: FramedPolicyShape, spans: readonly FramedRecord[] = [], receipts: readonly FramedRecord[] = [], attempts: FramedRecord = {}): Promise<FramedOffer[]> {
  const [frame, components] = await extract(rows, obs.observation_ref), bands = measureParallelSolidBands(components, policy.route.parallel_band_measurement_contract);
  const byref = new Map(components.map(c => [c.component_id, c])), offers = new Map<string, FramedOffer>();
  const [bindings, complete] = measureCurrentPointSpanBindings(frame, spans, obs.level_epoch, policy.route.point_motion_span_recall_contract);
  const add = (ref: string, point: FramedPoint, inputFacts: FramedRecord, group: readonly V5Component[]): void => {
    const patches = group.map(c => ({ bbox: [c.bbox.left, c.bbox.top, c.bbox.right, c.bbox.bottom], value: c.value })), key = digest([obs.level_epoch, point, patches, rows]);
    const facts: FramedRecord = { framed_reception_analogy: false, ...inputFacts, interaction_measurement_kind: 'point', candidate_execution_count: Number(Object.hasOwn(attempts, key)),
      attempted_without_effect_in_current_context: truthy(attempts[key]?.unchanged), candidate_ref: key };
    const box = [Math.min(...group.map(c => c.bbox.left)), Math.min(...group.map(c => c.bbox.top)), Math.max(...group.map(c => c.bbox.right)), Math.max(...group.map(c => c.bbox.bottom))];
    offers.set(keyOf([point, ref]), { candidate_ref: key, point_x: point[1], point_y: point[0], point: [...point], facts, component_ref: ref, patches, bbox: box,
      signature: digest(patches), point_value: rows[point[0]]![point[1]]! });
  };
  const seen = new Set<string>();
  for (const c of components) {
    const facts = { ...(bands[c.component_id] ?? {}) };
    if (!truthy(facts.parallel_solid_band_domain_complete) || facts.parallel_solid_band_peer_count !== 1) continue;
    const peer = byref.get(facts.parallel_solid_band_peer_refs[0])!, peerFacts = bands[peer.component_id] ?? {};
    facts.parallel_solid_band_mutually_unique = peerFacts.parallel_solid_band_peer_count === 1 && equal(peerFacts.parallel_solid_band_peer_refs ?? [], [c.component_id]);
    const pair = [c.component_id, peer.component_id].sort(compareUnicode), encoded = keyOf(pair);
    if (seen.has(encoded)) continue;
    seen.add(encoded);
    const point: FramedPoint = [Math.floor((Math.min(c.bbox.top, peer.bbox.top) + Math.max(c.bbox.bottom, peer.bbox.bottom)) / 2), Math.floor((Math.min(c.bbox.left, peer.bbox.left) + Math.max(c.bbox.right, peer.bbox.right)) / 2)];
    Object.assign(facts, measurePointSpanLocus(frame, point, bindings, complete)); add(c.component_id, point, facts, [c, peer]);
  }
  let regions = pointRegions(frame, components, bands), regionmap = new Map(regions.map(v => [v.component_id, v]));
  const measuredRecords = receipts.map(r => ({ ...r, mask_extent: [...r.mask_extent] }));
  const [bandLoci, bandComplete] = measureFramedReceptionLoci({ frame, components, records: measuredRecords, span_records: spans, context_epoch: obs.level_epoch,
    mask_contract: policy.route.framed_reception_mask_contract, span_contract: policy.route.point_motion_span_recall_contract, band_facts: bands, contract: policy.route.framed_reception_locus_contract });
  const [observedRegions, observedComplete] = measureRegionalReceptionLoci({ frame, components, records: measuredRecords, span_records: spans, context_epoch: obs.level_epoch,
    mask_contract: policy.mask, span_contract: policy.route.point_motion_span_recall_contract, operator_regions: regions, contract: policy.route.framed_reception_locus_contract });
  const loci = [...bandLoci, ...observedRegions], lociComplete = bandComplete && observedComplete;
  for (const [ref, point, facts] of loci) {
    const component = byref.get(regionmap.has(ref) ? regionmap.get(ref)!.support_refs[0]! : ref)!, bf = { ...bands[component.component_id] }, peer = byref.get(bf.parallel_solid_band_peer_refs[0])!;
    bf.parallel_solid_band_mutually_unique = (bands[peer.component_id] ?? {}).parallel_solid_band_peer_count === 1 && equal((bands[peer.component_id] ?? {}).parallel_solid_band_peer_refs ?? [], [component.component_id]);
    add(ref, point, { ...bf, ...facts, framed_reception_locus_binding_count: loci.filter(([, p]) => equal(p, point)).length, framed_reception_locus_complete: lociComplete }, [component, peer]);
  }
  // Analogues remain explicit hypotheses; only observed receipts enter memory.
  const measured = measureFramedMaskCorrespondences(frame, components, policy.mask), hypothesisSupport = new Map<string, FramedRecord>(), sourceMarkers = new Map<string, Set<string>>();
  const hypotheses = new Map<string, FramedRecord>();
  for (const witness of receipts) {
    if (!equal(witness.context_epoch, obs.level_epoch) || !truthy(witness.source_claim_ref) || !truthy(witness.marker_uniform) || witness.border_preserved !== true) continue;
    for (const pair of measured.framed_mask_pairs ?? []) for (const [first, second] of [['first', 'second'], ['second', 'first']] as const) {
      if (!equal(pair[`${first}_inner_value`], witness.source_inner_value) || !equal(pair[`${first}_border_value`], witness.source_border_value) || !equal(pair.mask_extent, witness.mask_extent)) continue;
      const markers = sourceMarkers.get(pair[`${first}_component_ref`]) ?? new Set<string>(); markers.add(pair[`${second}_component_ref`]); sourceMarkers.set(pair[`${first}_component_ref`], markers);
      const ref = `hypothesis:frame_analogy:${digest([witness.source_claim_ref, pair[`${second}_inner_value`], pair[`${second}_border_value`], pair.mask_extent])}`;
      hypotheses.set(ref, { ...witness, mask_extent: [...witness.mask_extent], marker_uniform: false, marker_inner_value: pair[`${second}_inner_value`], marker_border_value: pair[`${second}_border_value`], source_claim_ref: ref });
      hypothesisSupport.set(ref, { observed_claim: witness.source_claim_ref, source_ref: pair[`${first}_component_ref`], marker_ref: pair[`${second}_component_ref`], mask_digest: pair.mask_digest, epistemic_status: 'hypothesis_not_observed_reception' });
    }
  }
  regions = pointRegions(frame, components, bands); regionmap = new Map(regions.map(v => [v.component_id, v]));
  const [analogues, analogueComplete] = measureRegionalReceptionLoci({ frame, components, records: [...hypotheses.values()], span_records: spans, context_epoch: obs.level_epoch,
    mask_contract: policy.mask, span_contract: policy.route.point_motion_span_recall_contract, operator_regions: regions, contract: policy.route.framed_reception_locus_contract, require_operator_value_match: false });
  for (const [ref, point, inputFacts] of analogues) {
    const facts = { ...inputFacts };
    if ((sourceMarkers.get(facts.framed_reception_locus_source_ref)?.size ?? 0) !== 1) continue;
    const hyprefs = (facts.framed_reception_locus_premise_refs as string[]).filter(r => hypothesisSupport.has(r));
    if (!hyprefs.length) continue;
    const region = regionmap.get(ref)!, a = byref.get(region.support_refs[0]!)!, b = byref.get(region.support_refs[1]!)!, bf = { ...bands[a.component_id], parallel_solid_band_mutually_unique: true };
    const actualrefs = (facts.framed_reception_locus_premise_refs as string[]).map(r => hypothesisSupport.has(r) ? hypothesisSupport.get(r)!.observed_claim as string : r);
    Object.assign(facts, { framed_reception_analogy: true, framed_reception_locus_binding_count: analogues.filter(([, p]) => equal(p, point)).length, framed_reception_locus_complete: analogueComplete,
      analogy_support_refs: [...new Set(actualrefs)].sort(compareUnicode), analogy_hypotheses: hyprefs.map(r => ({ ...hypothesisSupport.get(r)!, source_ref: facts.framed_reception_locus_source_ref,
        marker_ref: facts.framed_reception_locus_marker_ref, mask_digest: facts.framed_reception_locus_mask_digest })) });
    add(ref, point, { ...bf, ...facts }, [a, b]);
  }
  return [...offers.values()];
}

export type FramedTemporal = readonly [FramedFrame, FramedFrame, FramedScene, FramedScene, FramedTranslation[], FramedRecord];
export async function temporalComponents(first: NativeRows, second: NativeRows, before: FramedRecord, after: FramedRecord, records: readonly FramedRecord[] = []): Promise<FramedTemporal> {
  const [a, ac, extractedOld] = await extract(first, before.observation_ref), [b, bc, extractedCurrent] = await extract(second, after.observation_ref);
  const groups = new Map<string, [V5Component[], V5Component[]]>();
  for (const [side, components] of [[0, ac], [1, bc]] as const) for (const c of components) {
    const sig = signature(c), group = groups.get(sig) ?? [[], []]; group[side].push(c); groups.set(sig, group);
  }
  const prior = new Map<string, Set<string>>();
  for (const row of records) {
    if (!equal(row.context_epoch, before.level_epoch) || !truthy(row.source_claim_ref)) continue;
    const patches = row.endpoint_patches ?? [], refs = row.endpoint_refs ?? [];
    if (patches.length !== 2 || refs.length !== 2) continue;
    if (!patches.every(([q, patch]: [FramedBox, NativeRows]) => equal(framedPatch(a, q), patch))) continue;
    for (let index = 0; index < refs.length; index++) { const key = keyOf(patches[index][0]), values = prior.get(key) ?? new Set<string>(); values.add(refs[index]); prior.set(key, values); }
  }
  const pairs: [V5Component, V5Component, string][] = [], ambiguous: FramedRecord[] = [];
  for (const [sig, [left, right]] of groups) {
    const rightByBox = new Map(right.map(c => [keyOf(framedBox(c)), c])), stationary = new Set(left.map(c => keyOf(framedBox(c))).filter(key => rightByBox.has(key)));
    for (const c of left) if (stationary.has(keyOf(framedBox(c)))) pairs.push([c, rightByBox.get(keyOf(framedBox(c)))!, 'stationary_exact']);
    const x = left.filter(c => !stationary.has(keyOf(framedBox(c)))), y = right.filter(c => !stationary.has(keyOf(framedBox(c))));
    if (x.length === 1 && y.length === 1) pairs.push([x[0]!, y[0]!, 'unique_residual_exact_translation']);
    else if (x.length && y.length) ambiguous.push({ signature: sig, before: x.length, after: y.length });
  }
  const oldIds = new Map<string, string>(), newIds = new Map<string, string>(), translations: FramedTranslation[] = [], evidence: FramedRecord[] = [];
  for (const [x, y, kind] of pairs) {
    const refs = prior.get(keyOf(framedBox(x))) ?? new Set<string>();
    const ref = refs.size === 1 ? [...refs][0]! : `observed_endpoint:${digest([before.level_epoch, signature(x), framedBox(x)])}`;
    if (refs.size > 1) continue;
    oldIds.set(x.component_id, ref); newIds.set(y.component_id, ref);
    const delta: FramedPoint = [y.bbox.top - x.bbox.top, y.bbox.left - x.bbox.left];
    if (delta[0] !== 0 || delta[1] !== 0) translations.push({ entity_ref: ref, delta_row: delta[0], delta_col: delta[1] });
    evidence.push({ entity_ref: ref, kind, before: framedBox(x), after: framedBox(y), delta });
  }
  const old: FramedScene = { ...extractedOld, entities: ac.map(c => ({ entity_id: oldIds.get(c.component_id) ?? `unbound_before:${c.component_id}`, component: c })) };
  const current: FramedScene = { ...extractedCurrent, entities: bc.map(c => ({ entity_id: newIds.get(c.component_id) ?? `unbound_after:${c.component_id}`, component: c })) };
  if (new Set(old.entities.map(e => e.entity_id)).size !== old.entities.length || new Set(current.entities.map(e => e.entity_id)).size !== current.entities.length) {
    return [a, b, extractedOld, extractedCurrent, [], { status: 'ambiguous_historical_identity', pairs: [], ambiguous }];
  }
  return [a, b, old, current, translations, { status: 'exact_partial_correspondence', pairs: evidence, ambiguous }];
}

export async function transition(first: NativeRows, second: NativeRows, before: FramedRecord, after: FramedRecord, command: FramedRecord, policy: FramedPolicyShape, records: readonly FramedRecord[] = []): Promise<readonly [FramedRecord, FramedRecord]> {
  const [a, b, old, current, translations, correspondence] = await temporalComponents(first, second, before, after, records);
  const point: FramedPoint = [command.data.y, command.data.x], ref = `transition:${digest([before.observation_ref, after.observation_ref, command])}`;
  const span = measurePointMotionSpans({ before: old, after: current, before_frame: a, after_frame: b, translations, point, action_ref: command.action_ref,
    transition_ref: ref, candidate_ref: digest(command), context_epoch: before.level_epoch, contract: policy.policies['policy.record_observed_point_motion_span'].configuration.measurement_contract });
  const masksBefore = measureFramedMaskCorrespondences(a, old.entities, policy.mask), masksAfter = measureFramedMaskCorrespondences(b, current.entities, policy.mask);
  const replacement = measureFramedReplacements({ pairs: masksBefore.framed_mask_pairs ?? [], before: old, after: current, after_frame: b,
    complete: masksBefore.framed_mask_domain_complete && masksAfter.framed_mask_domain_complete, action_ref: command.action_ref, transition_ref: ref, context_epoch: before.level_epoch,
    contract: policy.policies['policy.record_observed_framed_replacement'].configuration.measurement_contract, before_occurrences: masksBefore.framed_mask_occurrences ?? [],
    after_occurrences: masksAfter.framed_mask_occurrences ?? [], motion_spans: span.point_motion_span_rows });
  return [{ ...span, temporal_correspondence: correspondence }, replacement];
}
