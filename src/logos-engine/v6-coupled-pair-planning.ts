/** CoupledPairAccess proposal and before-guard branches from the pinned V6.
 * An absent pair proposal leaves the inherited provider to its caller; it is
 * not a claim that the remaining alternating-graph ancestors are transferred.
 */
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { measureCoupledPairs } from './v6-coupled-pair-observation.ts';
import { jointCoupledPairRoute } from './v6-coupled-pair-route.ts';
import type { CoupledPairBox, CoupledPairDelta } from './v6-coupled-pair-observation.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
function orderedBoxes(boxes: readonly CoupledPairBox[]): CoupledPairBox[] {
  return [...boxes].sort((a, b) => {
    for (let i = 0; i < 4; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
    return 0;
  });
}

export function proposeCoupledPairGraph(state: R | null, observation: R, rows: NativeRows,
  _inputs: readonly R[], maxPrefix: number, config: R): R | null {
  const cfg = config.coupled_pair_question;
  if (!truth(cfg) || !truth(state) || state!.epoch !== observation.level_epoch || maxPrefix <= 0) return null;
  const retained = state!;
  if (truth(retained.unresolved)) return { status: 'abstained', reason: 'joint_projection_refuted_requires_new_causal_question',
    block_unrelated_probe: true, unknown: retained.unresolved };
  const pair = retained.pair;
  const current = measureCoupledPairs(rows).filter(candidate => candidate.value === pair.value && candidate.size === pair.size
    && equal(orderedBoxes(candidate.boxes), orderedBoxes(pair.boxes)));
  const controls: Record<string, CoupledPairDelta> = {}, signs = [new Set<number>(), new Set<number>()];
  for (const [action, samples] of Object.entries(retained.samples) as [string, R[]][]) {
    const translations: CoupledPairDelta[] = [];
    for (const sample of samples) {
      const delta: CoupledPairDelta = sample.deltas[0];
      if (delta.some(value => value !== 0) && !translations.some(previous => equal(previous, delta))) translations.push(delta);
    }
    if (translations.length === 1 && observation.available_action_refs.includes(action)) controls[action] = translations[0]!;
    for (const sample of samples) for (const axis of [0, 1]) {
      const first = sample.deltas[0][axis], second = sample.deltas[1][axis];
      if (first && second && Math.abs(first) === Math.abs(second)) signs[axis]!.add(first * second > 0 ? 1 : -1);
    }
  }
  if (!current.length || signs.some(values => values.size !== 1)) return null;
  const route = jointCoupledPairRoute(rows, pair, controls, retained.floors,
    signs.map(values => [...values][0]!) as [number, number], config.remaining_level_actions ?? 40,
    retained.evidence, cfg.exclude_unmatched_floor_mixtures ?? false);
  if (!route) return null;
  const actions = route.actions.slice(0, maxPrefix).map(action_ref => ({ action_ref })), expected = route.expected.slice(0, actions.length);
  const trial = identity([observation.level_epoch, rows, actions]);
  if (retained.refused.includes(trial)) return null;
  const plan = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
    initial_digest: identity(rows), pair: structuredClone(pair), commands: structuredClone(actions), expected, trial, route,
    hypotheses: cfg, evidence: retained.evidence.slice(-24) };
  const ref = `C_joint_pair_${identity(plan).slice(0, 18)}`;
  const facts = { two_current_occurrences_bound: true, shared_control_signs_measured: true, passable_support_observed: true,
    collision_and_meeting_are_conditional_hypotheses: true };
  const why = cfg.question, evidence = [observation.observation_ref, ...plan.evidence];
  return { status: 'proposed', kind: 'coupled_pair_access', proposal_id: ref, pair_access_plan: plan, actions,
    steps: actions.map((action, index) => ({ action, expected_after: { member_boxes: expected[index] } })), facts,
    compositions: [{ id: ref, observed: false, open_question: why, properties: { roles: cfg.roles }, relations: ['contributes_to:G_official_completion'] }],
    question: { reason: 'activate_existing_joint_collision_search', hypothesis_refs: evidence }, route_refs: evidence,
    binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
    bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], actions,
      purpose: why, preconditions: facts, evidence, outcome_guard: { path: ['value'], contains: ref } } };
}

function present(rows: NativeRows, box: CoupledPairBox, value: number): boolean {
  for (let row = box[0]; row <= box[2]; row++) for (let column = box[1]; column <= box[3]; column++) {
    const pixel = rows.at(row)?.at(column);
    if (pixel === undefined) throw new RangeError('Coupled-pair observation index is outside its public frame');
    if (pixel !== value) return false;
  }
  return true;
}

/** Source pair branch only; other plan kinds must be dispatched by the owner. */
export function coupledPairBefore(proposal: R, index: number, rows: NativeRows,
  meta: { epoch: number; score: number; observation_ref: string; available: readonly string[] }): R {
  const plan = proposal.pair_access_plan;
  if (!truth(plan)) throw new TypeError('Coupled-pair guard requires a pair_access_plan');
  const boxes: CoupledPairBox[] = index === 0 ? plan.pair.boxes : plan.expected[index - 1];
  let admitted = equal([meta.epoch, meta.score], [plan.epoch, plan.score])
    && equal(proposal.actions, plan.commands) && equal(proposal.bundle_template.actions, proposal.actions)
    && meta.available.includes(proposal.actions[index].action_ref) && boxes.every(box => present(rows, box, plan.pair.value));
  if (index === 0) admitted = admitted && identity(rows) === plan.initial_digest && meta.observation_ref === plan.observation_ref;
  return { admitted, reason: admitted ? 'joint_members_and_command_bound' : 'joint_context_or_payload_changed' };
}
