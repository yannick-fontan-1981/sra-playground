/** Finite conditional preparations from visible profiles and observed controls.
 * Source: ranked_workshop/preparation.py, pinned V6 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 * Costs order current questions; they do not certify a complete workshop model.
 */
import { v6Canonical } from './v6-native-observer.ts';
import { profiles, supports, relations, modeSignature } from './v6-ranked-workshop-methods.ts';
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
function modelKey(model: R): [number[], number] { return [model.rank_permutation, model.value_delta]; }
function apply(model: R, profile: readonly number[]): number[] | null {
  const [permutation, delta] = modelKey(model);
  return same([...permutation].sort((a, b) => a - b), Array.from({ length: profile.length }, (_, i) => i))
    ? permutation.map(i => profile[i]! + delta) : null;
}
function commonModels(observations: R[]): [number[], number][] {
  let keys: Map<string, [number[], number]> | null = null;
  for (const item of observations) {
    const current = new Map<string, [number[], number]>((item.models as R[]).map(m => { const key = modelKey(m); return [v6Canonical(key), key]; }));
    if (keys === null) keys = current;
    else {
      const retained = new Map<string, [number[], number]>();
      for (const [key, value] of keys as Map<string, [number[], number]>) if (current.has(key)) retained.set(key, value);
      keys = retained;
    }
  }
  return [...(keys?.values() ?? [])];
}
function observationsFor(owner: R, obs: R, glyph: R): R[] {
  return (owner.operator_observations as R[]).filter(x => x.source_epoch === obs.level_epoch
    && same(x.support.appearance_sha256, glyph.appearance_sha256) && same(x.support.bbox, glyph.bbox)
    && x.other_profiles_and_receivers_preserved);
}

export function bandIndex(scene: R, profile: R): number | null {
  const y = profile.profile.stem_relief_stem_origin[0];
  const bands = [...(scene.receiver_bindings ?? []) as R[]].sort((a, b) => compare(a.bbox, b.bbox));
  const found = bands.flatMap((r, i) => r.bbox[0] <= y && y <= r.bbox[2] ? [i] : []);
  return found.length === 1 ? found[0]! : null;
}

export function control(owner: R, obs: R, held: boolean, sign: number): R | null {
  const found: R[] = [];
  for (const item of owner.input_effects as R[]) {
    const action = item.action;
    if (item.held_before !== held || item.held_after !== held || item.vertical_sign !== sign
      || !item.same_profile_multiset || !item.changes?.marker_moved) continue;
    if (held && !item.marked_profile_preserved) continue;
    if (!obs.available_action_refs.includes(action.action_ref) || truth(action.data)) continue;
    if (item.slot_delta !== sign) continue;
    found.push(item);
  }
  return new Set(found.map(x => x.action.action_ref)).size === 1 ? found.at(-1)! : null;
}

export function grasp(owner: R, obs: R, context: R): R | null {
  const found = (owner.mode_methods as R[]).filter(m => same(m.signature, modeSignature(context))
    && (m.contrasts as R[]).some(x => same(x.change, [0, 1])) && obs.available_action_refs.includes(m.action.action_ref)
    && !truth(m.action.data) && !(owner.method_refutations as unknown[]).some(x => same(x, [m.ref, obs.level_epoch])));
  return new Set(found.map(m => m.action.action_ref)).size === 1 ? found.at(-1)! : null;
}

export function preparationOptions(owner: R, obs: R, rows: NativeRows, scene: R, context: R, current: R,
  inputs: readonly NativeCommand[], remaining: number): R[] {
  const agreements = context.station_profile_zero_cut_contour_agreement_count ?? 0, receiverCount = context.station_profile_receiver_binding_count ?? 0;
  if (!(0 < agreements && agreements < receiverCount) || !owner.mode_evidence.length) return [];
  const cohort = profiles(scene), bands = [...(scene.receiver_bindings ?? []) as R[]].sort((a, b) => compare(a.bbox, b.bbox));
  const currentBand = bandIndex(scene, current), held = context.station_profile_inner_singleton_count === 1;
  if (currentBand === null) return [];
  const targets: [number, R][] = bands.flatMap((r, i) => (r.cut_measurements.signed_cut_offsets as number[]).some(x => x !== 0) ? [[i, r] as [number, R]] : []);
  const glyphs = supports(obs, scene), options: R[] = [];
  const knownOther = new Set((owner.input_effects as R[]).filter(e => e.changes.mode_toggle || e.changes.marker_moved || e.changes.receiver_changed)
    .map(e => e.action.action_ref));
  const unknownActions = inputs.filter(a => !knownOther.has(a.action_ref) && !truth(a.data)).map(a => ({ ...a }));
  for (const carrier of cohort) {
    const profile = carrier.profile.stem_relief_rank_height_pixels as number[], carrierBand = bandIndex(scene, carrier);
    if (carrierBand === null || held && carrier.component_ref !== current.component_ref) continue;
    if (targets.some(([, r]) => same(profile, r.cut_measurements.signed_cut_offsets))) continue;
    for (const [receiverBand, receiver] of targets) {
      const target = receiver.cut_measurements.signed_cut_offsets as number[], desired = relations(profile, target, rows.length);
      if (!desired.length) continue;
      for (const glyph of glyphs) {
        const siteIndices = bands.flatMap((r, i) => same(r.bbox, glyph.band) ? [i] : []);
        if (siteIndices.length !== 1) continue;
        const site = siteIndices[0]!, observations = observationsFor(owner, obs, glyph), observed = observations.length > 0;
        const toolActions = new Set(observations.map(x => x.action.action_ref));
        let tool: R[], models: R[];
        if (observed) {
          const keys = commonModels(observations);
          if (!keys.length || toolActions.size !== 1) continue;
          const predictions = new Set(keys.map(([permutation, delta]) => v6Canonical(apply({ rank_permutation: permutation, value_delta: delta }, profile))));
          if (predictions.size !== 1 || !predictions.has(v6Canonical(target))) continue;
          tool = [copy(observations.at(-1)!.action)];
          models = keys.sort(compare).map(([permutation, delta]) => ({ rank_permutation: [...permutation], value_delta: delta, status: 'observed_pairs_conditional_extension' }));
        } else { tool = unknownActions; models = desired; }
        for (const toolAction of tool) {
          if (!obs.available_action_refs.includes(toolAction.action_ref) || truth(toolAction.data)) continue;
          const focusSign = Math.sign(carrierBand - currentBand), supportSign = Math.sign(site - carrierBand), returnSign = Math.sign(receiverBand - site);
          const focusControl = focusSign ? control(owner, obs, false, focusSign) : null;
          const supportControl = supportSign ? control(owner, obs, true, supportSign) : null;
          const returnControl = returnSign ? control(owner, obs, true, returnSign) : null;
          const mode = !held ? grasp(owner, obs, context) : null;
          if (focusSign && !focusControl || supportSign && !supportControl || returnSign && !returnControl || !held && !mode) continue;
          const cost = Math.abs(carrierBand - currentBand) + (held ? 0 : 1) + Math.abs(site - carrierBand) + 1 + Math.abs(receiverBand - site) + 1;
          if (cost > remaining) continue;
          const obligations: [string, R][] = [];
          if (focusSign) obligations.push(['focus', focusControl!.action]);
          if (!held) obligations.push(['grasp', mode!.action]);
          if (supportSign) obligations.push(['access_support', supportControl!.action]);
          obligations.push(['transform', toolAction]);
          const [first, action] = obligations[0]!, evidence = [obs.observation_ref];
          for (const item of [focusControl, supportControl, returnControl]) if (item) evidence.push(...item.evidence);
          if (mode) evidence.push(...(mode.contrasts as R[]).flatMap(c => c.evidence));
          evidence.push(...observations.flatMap(item => item.evidence));
          options.push({ kind: observed ? 'prepare_observed_receiver' : 'prepare_unknown_receiver', action: copy(action), support: glyph,
            method_ref: 'conditional_preparation:' + glyph.appearance_sha256, objective_key: [carrier.component_ref, receiver.enclosure_component_ref],
            consumer: { receiver_ref: receiver.enclosure_component_ref, target_profile: [...target], evidence: obs.observation_ref },
            carrier: { ref: carrier.component_ref, profile: [...profile], band: carrierBand },
            consumers: [{ receiver_ref: receiver.enclosure_component_ref, target_profile: [...target], models }], relation_models: models,
            obligation: first, obligations: obligations.map(([kind, item]) => ({ kind, action: copy(item) })),
            estimated_actions_to_test: cost, observed_support_model: observed, evidence: [...new Set(evidence)],
            facts: { conditional_preparation_bound: true, remaining_action_cost_admissible: true },
            unknown: ['control_extension_to_current_layout', 'operator_domain_and_atomic_refusal', 'unchanged_receipts_after_carrier_transit', 'conditional_path_not_complete_workshop_model',
              ...(observed ? [] : ['support_transform_law_and_input_binding_unknown'])],
            preserve: ['other_profile_values', 'receipt_evidence', 'carrier_identity_until_transformation'] });
        }
      }
    }
  }
  return options;
}

export function supportRelationAdmissible(owner: R, obs: R, glyph: R, profile: readonly number[], targets: R[]): boolean {
  const observations = observationsFor(owner, obs, glyph);
  if (!observations.length) return true;
  const keys = commonModels(observations);
  if (!keys.length) return false;
  const predictions = new Set(keys.map(([permutation, delta]) => v6Canonical(apply({ rank_permutation: permutation, value_delta: delta }, profile))));
  return predictions.size === 1 && targets.some(t => predictions.has(v6Canonical(t.target_profile)));
}
