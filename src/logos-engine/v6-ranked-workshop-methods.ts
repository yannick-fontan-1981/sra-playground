/** Bounded V6 workshop pair explanations and current conditional experiments.
 * Source: ranked_workshop/methods.py at 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 * No fitted relation establishes a universal tool law or persistent receipt.
 */
import { v6Canonical } from './v6-native-observer.ts';
import { sha256Bytes } from './v6-hash.ts';
import { stableContext } from './v6-ranked-workshop-geometry.ts';
import { preparationOptions, supportRelationAdmissible } from './v6-ranked-workshop-preparation.ts';
import type { NativeCommand, NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const same = (a: unknown, b: unknown): boolean => v6Canonical(a ?? null) === v6Canonical(b ?? null);
function truth(value: unknown): boolean {
  if (value === null || value === undefined || value === false || value === 0 || value === '') return false;
  return typeof value !== 'object' || Object.keys(value).length > 0;
}
function compare(a: any, b: any): number {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) { const order = compare(a[i], b[i]); if (order) return order; }
    return a.length - b.length;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}
/** These two source identities use json.dumps defaults, not compact JSON.
 * Their consumed domain contains nested arrays, strings and exact integers.
 */
function pythonArrayJson(value: unknown): string {
  return Array.isArray(value) ? `[${value.map(pythonArrayJson).join(', ')}]` : v6Canonical(value);
}
function defaultArrayDigest(value: unknown): string {
  return sha256Bytes(new TextEncoder().encode(pythonArrayJson(value)));
}

export function modeSignature(context: R): R {
  return { receiver_side: context.station_profile_marked_receiver_horizontal_sign ?? null,
    corner_quartets: context.station_profile_corner_quartet_count ?? null,
    reference_packets: truth(context.station_profile_reference_packet_count) };
}

export function profiles(scene: R): R[] {
  const keep = new Set(scene.comparison_domain?.admitted_profile_refs ?? []);
  const ranksInside = (profile: R, box: readonly number[]): boolean =>
    profile.stem_relief_rank_origins.every(([row, col]: number[]) => box[0]! <= row! && row! <= box[2]!
      && box[1]! <= col! && col! + profile.stem_relief_rank_width_pixels - 1 <= box[3]!);
  return (scene.profiles ?? []).filter((p: R) => keep.has(p.component_ref)
    && !(scene.reference_packets ?? []).some((b: R) => ranksInside(p.profile, b.bbox)));
}

export function values(scene: R): unknown[][] {
  return profiles(scene).map(p => [p.bbox, p.profile.stem_relief_rank_height_pixels]).sort(compare);
}

export function changes(a: R, ca: R, b: R, cb: R): R {
  const withoutMode = (context: R): R => Object.fromEntries(Object.entries(stableContext(context))
    .filter(([key]) => key !== 'station_profile_inner_singleton_count'));
  const previousMode = ca.station_profile_inner_singleton_count, nextMode = cb.station_profile_inner_singleton_count;
  return { mode_toggle: truth(ca) && truth(cb)
      && (previousMode === 0 && nextMode === 1 || previousMode === 1 && nextMode === 0)
      && same(withoutMode(ca), withoutMode(cb)),
    marker_moved: !same(ca.station_profile_marker_bbox, cb.station_profile_marker_bbox),
    receiver_changed: !same(ca.station_profile_zero_cut_contour_agreement_count, cb.station_profile_zero_cut_contour_agreement_count),
    profile_geometry_changed: !same(values(a), values(b)) };
}

/** The consumed V5 _operator contract is a bijective rank permutation followed
 * by one uniform delta, with the current visible raster as its value domain.
 * Its visit is charged before validation, as in station_profile_workbench.py.
 */
function rankOperator(profile: readonly number[], permutation: readonly number[], delta: number,
  height: number, budget: { count: number }): [readonly number[], string | null] {
  if (++budget.count > 128) throw new Error('bounded_operator_relation_domain');
  const sorted = [...new Set(permutation)].sort((a, b) => a - b);
  if (!same(sorted, Array.from({ length: permutation.length }, (_, i) => i))) throw new Error('DECLARED_RANK_PERMUTATION_NOT_BIJECTIVE');
  if (permutation.length !== profile.length) return [profile, 'GLOBAL_RANK_LENGTH_DOMAIN_REFUSAL'];
  const transformed = permutation.map(index => profile[index]! + delta);
  if (transformed.some(value => value < 0 || value > height)) return [profile, 'GLOBAL_BOUNDED_VALUE_REFUSAL'];
  return [transformed, null];
}

export function relations(profile: readonly number[], target: readonly number[], height: number): R[] {
  if (profile.length !== target.length || same(profile, target)) return [];
  const n = profile.length, permutations = new Map<string, number[]>();
  const keep = (p: number[]): void => { permutations.set(v6Canonical(p), p); };
  keep(Array.from({ length: n }, (_, i) => i));
  keep(Array.from({ length: n }, (_, i) => n - 1 - i));
  for (let i = 0; i < n; i++) keep(Array.from({ length: n }, (_, j) => (j + i) % n));
  const budget = { count: 0 }, result: R[] = [];
  for (const permutation of [...permutations.values()].sort(compare)) {
    const deltas = new Set(permutation.map((index, j) => target[j]! - profile[index]!));
    if (deltas.size !== 1) continue;
    const shift = deltas.values().next().value!;
    const [predicted, refusal] = rankOperator(profile, permutation, shift, height, budget);
    if (refusal === null && same(predicted, target)) result.push({ rank_permutation: permutation, value_delta: shift,
      domain: 'visible_raster_measurement_extent_only', law_status: 'hypothesis_for_observed_or_desired_pair' });
  }
  return result;
}

export function supports(obs: R, scene: R): R[] {
  const cohort = profiles(scene), receivers: R[] = scene.receiver_bindings ?? [], out: R[] = [];
  for (const e of obs.entities as R[]) {
    const [l, t, r, b] = e.bbox as number[], w = r! - l! + 1, h = b! - t! + 1;
    if (Math.min(w, h) < 3) continue;
    const mask = new Set((e.mask as number[][]).map(([x, y]) => `${x},${y}`));
    let perimeter = true;
    for (let x = 0; x < w && perimeter; x++) perimeter = mask.has(`${x},0`) && mask.has(`${x},${h - 1}`);
    for (let y = 0; y < h && perimeter; y++) perimeter = mask.has(`0,${y}`) && mask.has(`${w - 1},${y}`);
    if (!perimeter) continue;
    if (cohort.some(q => t! <= q.bbox[0] && q.bbox[2] <= b! && l! <= q.bbox[1] && q.bbox[3] <= r!)) continue;
    if (cohort.some(q => l! <= q.bbox[3] + 1 && q.bbox[1] <= r! + 1 && t! <= q.bbox[2] + 1 && q.bbox[0] <= b! + 1)) continue;
    if (receivers.some(q => same(e.bbox, [q.bbox[1], q.bbox[0], q.bbox[3], q.bbox[2]]))) continue;
    const bands = receivers.filter(q => q.bbox[0] <= (t! + b!) / 2 && (t! + b!) / 2 <= q.bbox[2]);
    if (bands.length !== 1) continue;
    const band = bands[0]!, matches = cohort.filter(q => band.bbox[0] <= q.profile.stem_relief_stem_origin[0]
      && q.profile.stem_relief_stem_origin[0] <= band.bbox[2]);
    if (matches.length !== 1) continue;
    const carrier = matches[0]!;
    if (r! < carrier.bbox[1] && carrier.bbox[1] < band.bbox[1]
      || band.bbox[3] < carrier.bbox[3] && carrier.bbox[3] < l!) out.push({ ref: e.id, bbox: e.bbox,
      signature: e.signature, appearance_sha256: supportAppearance(obs, e.bbox), band: band.bbox,
      evidence: obs.observation_ref, role: 'unresolved_framed_glyph_opposite_receiver' });
  }
  return out;
}

export function extensionOptions(owner: R, obs: R, rows: NativeRows, scene: R, context: R,
  inputs: readonly NativeCommand[], remaining: number): R[] {
  const cohort = profiles(scene), marked = cohort.filter(p => p.component_ref === context.station_profile_unique_marked_profile_ref);
  if (marked.length !== 1) return [];
  const current = marked[0]!, options: R[] = [];
  for (const method of owner.mode_methods as R[]) {
    const contrasts = new Set((method.contrasts as R[]).map(x => v6Canonical(x.change)));
    if (obs.available_action_refs.includes(method.action.action_ref) && !truth(method.action.data)
      && same(method.signature, modeSignature(context)) && contrasts.size === 2 && contrasts.has('[0,1]') && contrasts.has('[1,0]')
      && context.station_profile_inner_singleton_count === 0 && !owner.mode_evidence.length
      && !(owner.method_refutations as unknown[]).some(x => same(x, [method.ref, obs.level_epoch]))) {
      options.push({ kind: 'revalidate_mode', action: copy(method.action), method_ref: method.ref,
        evidence: (method.contrasts as R[]).flatMap(c => c.evidence), unknown: ['same_input_may_have_new_context_condition'], relation_models: [] });
    }
  }
  options.push(...preparationOptions(owner, obs, rows, scene, context, current, inputs, remaining));
  if (context.station_profile_inner_singleton_count !== 1 || !owner.mode_evidence.length) return options;
  const profile = current.profile.stem_relief_rank_height_pixels as number[], wanted: R[] = [];
  for (const receiver of (scene.receiver_bindings ?? []) as R[]) {
    const target = receiver.cut_measurements.signed_cut_offsets as number[];
    if (target.every(x => x === 0)) continue;
    const models = relations(profile, target, rows.length);
    if (models.length) wanted.push({ receiver_ref: receiver.enclosure_component_ref, target_profile: [...target], models, evidence: obs.observation_ref });
  }
  options.push(...preparedReceiverAccess(owner, obs, scene, context, current));
  if (!wanted.length) return options;
  if ((scene.receiver_bindings ?? []).some((x: R) => same(profile, x.cut_measurements.signed_cut_offsets))) return options;
  const glyphs = supports(obs, scene);
  const knownOther = new Set((owner.input_effects as R[]).filter(e => e.changes.mode_toggle || e.changes.marker_moved || e.changes.receiver_changed)
    .map(e => e.action.action_ref));
  const available = inputs.filter(a => !truth(a.data) && !knownOther.has(a.action_ref));
  for (const glyph of glyphs) {
    const admissible = supportRelationAdmissible(owner, obs, glyph, profile, wanted);
    const origin = current.profile.stem_relief_stem_origin[0];
    if (glyph.band[0] <= origin && origin <= glyph.band[2]) {
      for (const action of available) options.push({ kind: 'probe_transform', facts: { support_relation_admissible: admissible }, action: copy(action),
        support: glyph, consumers: wanted, relation_models: wanted, evidence: [obs.observation_ref],
        unknown: ['glyph_is_not_yet_a_transform_station', 'input_is_not_yet_a_tool_binding', 'predicted_transform_is_not_yet_observed', 'atomic_refusal_domain_unknown'] });
    } else {
      const sign = glyph.band[0] > origin ? 1 : -1;
      for (const method of owner.input_effects as R[]) {
        if (obs.available_action_refs.includes(method.action.action_ref) && !truth(method.action.data)
          && method.changes.marker_moved && method.vertical_sign === sign && method.same_profile_multiset) options.push({
          kind: 'access_transform_support', facts: { support_relation_admissible: admissible }, action: copy(method.action), support: glyph,
          consumers: wanted, relation_models: wanted, evidence: [...method.evidence, obs.observation_ref],
          unknown: ['held_motion_currently_conditional', 'glyph_is_not_yet_a_transform_station', 'this_is_access_to_an_experiment_not_an_acquired_tool_effect'] });
      }
    }
  }
  return options;
}

export function preparedReceiverAccess(owner: R, obs: R, scene: R, context: R, current: R): R[] {
  if (context.station_profile_inner_singleton_count !== 1) return [];
  const profile = current.profile.stem_relief_rank_height_pixels as number[], origin = current.profile.stem_relief_stem_origin[0], offers: R[] = [];
  const receivers: R[] = scene.receiver_bindings ?? [];
  if (receivers.some(r => same(r.cut_measurements.signed_cut_offsets, profile) && r.bbox[0] <= origin && origin <= r.bbox[2])) return [];
  for (const receiver of receivers) {
    const target = receiver.cut_measurements.signed_cut_offsets, band = receiver.bbox;
    if (!same(target, profile) || band[0] <= origin && origin <= band[2]) continue;
    const sign = band[0] > origin ? 1 : -1;
    for (const method of owner.input_effects as R[]) {
      if (!(method.changes.marker_moved && method.vertical_sign === sign && method.same_profile_multiset
        && method.held_before && method.held_after && method.marked_profile_preserved)) continue;
      const action = method.action, methodRef = 'held_direction:' + defaultArrayDigest([action.action_ref, sign]);
      if ((owner.method_refutations as unknown[]).some(x => same(x, [methodRef, obs.level_epoch]))) continue;
      if (!obs.available_action_refs.includes(action.action_ref) || truth(action.data)) continue;
      offers.push({ kind: 'access_prepared_receiver', method_ref: methodRef, action: copy(action),
        support: { ref: receiver.enclosure_component_ref, bbox: [band[1], band[0], band[3], band[2]], role: 'current_exact_profile_receiver', evidence: obs.observation_ref },
        consumers: [{ receiver_ref: receiver.enclosure_component_ref, current_profile: [...profile], target_profile: [...target], equality_current: true, evidence: obs.observation_ref }],
        relation_models: [], facts: { exact_receiver_match: true, held_direction_evidence_present: true, current_same_band_receiver_match: false },
        evidence: [...method.evidence, obs.observation_ref], control_evidence: copy(method),
        unknown: ['adjacent_control_extension_to_current_layout', 'intermediate_band_is_access_not_authentication', 'receiver_acceptance_still_requires_a_separate_test'],
        preserve: ['held_profile', 'other_profile_multiset', 'current_receipts_if_present'] });
    }
  }
  return offers;
}

export function supportAppearance(obs: R, bbox: readonly number[]): string {
  const [l, t, r, b] = bbox, pixels: number[][] = [];
  for (const e of obs.entities as R[]) {
    const [x0, y0, x1, y1] = e.bbox as number[];
    if (x1! < l! || r! < x0! || y1! < t! || b! < y0!) continue;
    for (const [x, y] of e.mask as number[][]) if (l! <= x0! + x! && x0! + x! <= r! && t! <= y0! + y! && y0! + y! <= b!)
      pixels.push([x0! + x! - l!, y0! + y! - t!, e.palette_value]);
  }
  return defaultArrayDigest(pixels.sort(compare));
}
