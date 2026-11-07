/** Bounded transfer from an actually scored sequence, matching target_method.py. */
import { pythonEqual as same, pythonTruthy as truth } from './v6-operations.ts';
type R = Record<string, any>;

export function targetMethodAtBoundary(tree: R, witness: R): R | null {
  const target = truth(tree.retained_target) ? tree.retained_target : {}, approach = truth(tree.preceding_peer_access) ? tree.preceding_peer_access : {};
  const effect = target.verified_child_effect;
  if (!truth(effect) || !truth(approach.complete) || !same(approach.pair_ref, target.pair_ref)) return null;
  if (!same(witness.levels_completed_after, witness.levels_completed_before + 1) || !same(witness.source_level, approach.level_epoch) ||
      !same(approach.after, tree.observation_ref) || !same(witness.before_observation_ref, tree.observation_ref)) return null;
  return { composition: target.composition, source_scope: approach.level_epoch, role_refs: approach.role_refs, motion_examples: approach.motion_examples,
    verified_selective_change: effect, peer_approach_return: approach.after, scoring_observation: witness.after_observation_ref,
    qualification: 'observed_sequence_possible_goal; necessity_and_sufficiency_open' };
}

export function recalledDirections(method: R | null, decision: R, current: R): R {
  if (!truth(method) || same(method!.source_scope, current.epoch) || !same(method!.composition, decision.composition ?? null)) return {};
  const facts = decision.measured_facts;
  if (!(truth(facts.framed_pair) && truth(facts.homologous) && truth(facts.asymmetric) && !truth(facts.alignment_refuted))) return {};
  const roles = method!.role_refs as string[];
  if (!truth(roles) || !roles.every(role => Object.hasOwn(current.roles, role))) return {};
  return method!.motion_examples;
}
