/** Native composition_curiosity.py: compare measured information questions, not game scores. */
import { compareUnicode } from './canonical.ts';
import { canonical as comparable, pythonEqual as same, pythonTruthy as truth } from './v6-operations.ts';
import { isInformationStrategy } from '../sic/information-strategy.ts';
import { informationPriority, type InformationPreference } from '../sic/information-preference.ts';
import { assessHypothesisPartition, compareSeparation, type HypothesisPartition } from '../sic/discriminating-experiment.ts';
type R = Record<string, any>;
export { comparable };
const sorted = (values: Iterable<string>) => [...values].sort(compareUnicode);

export function pointGoal(probe: R): R {
  const binding = probe.binding, predictions = probe.frozen_predictions;
  const refs: R = Object.fromEntries(probe.rivals.map((r: R) => [r.id, r]));
  const features = new Set<string>(probe.new_contrast_pairs.flatMap((pair: string[]) => pair.map(r => refs[r].feature)));
  const groups = new Set<string>();
  for (const names of probe.feature_partitions as string[][]) {
    const group = sorted(names.filter(name => features.has(name))); if (group.length) groups.add(group[0]!);
  }
  return { source: 'point_contrast', action: binding.action, predictions, relations: sorted(groups).map(field => [binding.entity_ref, 'tested_feature', field]),
    evidence: sorted(new Set([...Object.values(refs).map(r => r.source_ref), binding.observation_ref])), risks: ['local_rewrite_may_persist'], return_steps: null,
    question: probe.question, observation_ref: binding.observation_ref, level_epoch: binding.mode[0], native_probe: probe };
}
/** Python Fraction ordering is kept exact; no rounded entropy proxy is introduced. */
export function* electInformationGoals(offers: readonly R[], obs: R, remaining: number, meter: R | null, policy: R,
  openingComplexity = false, preference?: InformationPreference): Generator<readonly [R, R]> {
  type Candidate = { offer: R; relations: Set<string>; split: HypothesisPartition['eliminatedShare']; distinctOutcomes: number };
  let candidates: Candidate[] = [];
  const declined: Record<string, number> = {}, decline = (reason: string) => { declined[reason] = (declined[reason] ?? 0) + 1; };
  for (const offer of offers) {
    if (offer.level_epoch !== obs.level_epoch || offer.observation_ref !== obs.observation_ref) { decline('stale'); continue; }
    const outcomes = new Map<string, number>();
    for (const value of Object.values(offer.predictions)) { const key = comparable(value); outcomes.set(key, (outcomes.get(key) ?? 0) + 1); }
    const partition = assessHypothesisPartition(outcomes.values());
    if (!partition || partition.outcomes < 2 || !truth(offer.evidence)) { decline('no_grounded_contrast'); continue; }
    const relations = new Set<string>(offer.relations.filter((r: any[]) => r.length === 3).map(comparable));
    if (!relations.size || policy.excluded_risks.some((risk: string) => offer.risks.includes(risk))) { decline('preservation_or_missing_relation'); continue; }
    const spare = offer.return_steps, bound = truth(meter) ? Math.min(remaining, meter!.steps_before_empty) : remaining;
    if (bound < 1 + (spare || 0) || (truth(meter) && spare === null && bound <= 1)) { decline('insufficient_action_or_resource_margin'); continue; }
    candidates.push({ offer, relations, split: partition.eliminatedShare, distinctOutcomes: partition.outcomes });
  }
  while (candidates.length) {
    const engaged = candidates.filter(row => truth(row.offer.engaged_parent)), pool = engaged.length && truth(policy.continue_observed_parent) ? engaged : candidates;
    const safety = (row: Candidate) => [Number(truth(row.offer.risks)), Number(row.offer.return_steps === null)] as const;
    const safe = pool.map(safety).sort((a, b) => a[0] - b[0] || a[1] - b[1])[0]!;
    const tier = pool.filter(row => same(safety(row), safe));
    const maximal = tier.filter(row => !tier.some(other => row.relations.size < other.relations.size && [...row.relations].every(r => other.relations.has(r)) && compareSeparation(row.split, other.split) <= 0));
    const order = (a: Candidate, b: Candidate): number => {
      if (openingComplexity && !engaged.length && a.relations.size !== b.relations.size) return b.relations.size - a.relations.size;
      for (const criterion of policy.order as string[]) {
        let result: number;
        if (criterion === 'worst_case_separation') result = -compareSeparation(a.split, b.split);
        else if (criterion === 'distinct_relations') result = b.relations.size - a.relations.size;
        else if (criterion === 'recovery_cost') result = (a.offer.return_steps || 0) - (b.offer.return_steps || 0);
        else if (criterion === 'stable_binding') result = compareUnicode(comparable(a.offer.action), comparable(b.offer.action));
        else throw new TypeError(`Unknown information-goal criterion: ${criterion}`);
        if (result) return result;
      }
      return 0;
    };
    const ranked = [...maximal].sort(order);
    const baseline = ranked[0]!;
    // An editable priority only compares maximal offers in the same preservation tier.
    const preferred = preference ? ranked.find(row => isInformationStrategy(row.offer.source)
      && informationPriority({ strategy: row.offer.source, distinctOutcomes: row.distinctOutcomes }, preference)
      && (!openingComplexity || engaged.length || row.relations.size === baseline.relations.size)) : undefined;
    const picked = preference?.mode === 'active' && preferred ? preferred : baseline;
    const offer = picked.offer;
    const receipt = { ...Object.fromEntries(Object.entries(offer).filter(([key]) => key !== 'native_probe')), tree_key: 'composition.priority.information_value',
      relation_count: picked.relations.size, distinct_outcomes: picked.distinctOutcomes,
      worst_case_separation: [Number(picked.split.n), Number(picked.split.d)], admissible_offers: candidates.length, rejected: { ...declined }, primitive_cost: 1,
      ...(openingComplexity && !engaged.length ? { opening_complexity: picked.relations.size } : {}),
      ...(preference ? { sic_preference: { mode: preference.mode, strategy: preference.strategy, minimumOutcomes: preference.minimumOutcomes,
        baseline: baseline.offer.action, baselineStrategy: baseline.offer.source,
        preferred: preferred?.offer.action ?? null, preferredOutcomes: preferred?.distinctOutcomes ?? null } } : {}) };
    yield [offer, receipt]; candidates = candidates.filter(row => row.offer !== offer);
  }
}

export function reconcileInformationGoal(receipt: R, before: R, after: R, pointComparison: R | null, externalMeasurement: unknown = null): R {
  let value: any = null;
  if (before.level_epoch === after.level_epoch && before.levels_completed === after.levels_completed && !['GAME_OVER', 'WIN'].includes(after.state)) {
    if (receipt.source === 'point_contrast' && truth(pointComparison)) value = pointComparison!.record.observed_local_change;
    else if (receipt.source === 'coupled_displays') value = externalMeasurement;
    else if (receipt.source === 'motion_contrast') {
      const ids = new Set<string>(receipt.role_refs), poses = (state: R): Record<string, number[]> => Object.fromEntries(state.entities.filter((e: R) => ids.has(e.signature) && !e.identity_ambiguous).map((e: R) => [e.signature, e.bbox]));
      const old = poses(before), hits = poses(after);
      if (ids.size && ids.size === Object.keys(old).length && ids.size === Object.keys(hits).length && [...ids].every(id => Object.hasOwn(old, id) && Object.hasOwn(hits, id))) {
        const displacements = new Map<string, number[]>();
        for (const id of ids) {
          if (old[id]!.length !== hits[id]!.length) throw new TypeError('Motion bounding boxes differ in length');
          const delta = hits[id]!.map((value, i) => value - old[id]![i]!); displacements.set(comparable(delta), delta);
        }
        if (displacements.size === 1) {
          const [dx, dy, right, bottom] = [...displacements.values()][0]!;
          if (dx === right && dy === bottom) value = [Math.min(...Object.values(hits).map(b => b[0]!)), Math.min(...Object.values(hits).map(b => b[1]!))];
        }
      }
    }
  }
  return { observation_ref: after.observation_ref, measured: value, hypothesis_checks: Object.fromEntries(Object.entries(receipt.predictions).map(([key, predicted]) => [key, value === null ? 'unknown' : same(predicted, value) ? 'matched' : 'contradicted'])) };
}
