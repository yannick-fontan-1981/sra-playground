/** Complete target_tree.py and the public caller projections used around WHY/ACT. */
import contract from '../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/composition_target_tree.json' with { type: 'json' };
import { compareUnicode } from './canonical.ts';
import { v6Canonical } from './v6-native-observer.ts';
import { pythonEqual as same, pythonTruthy as truth } from './v6-operations.ts';
import { electInformationGoals } from './v6-information-goals.ts';
import { observedDerivations } from './v6-observed-derivations.ts';
import type { ContactEntries } from './v6-observed-derivations.ts';
import type { NativePublicObservation } from './v6-native-types.ts';
type R = Record<string, any>;
const get = (r: R, key: string, fallback: any = null): any => Object.hasOwn(r, key) ? r[key] : fallback;
const or = <T>(value: T, fallback: T): T => truth(value) ? value : fallback;
function spacedJson(value: any): string {
  if (Array.isArray(value)) return `[${value.map(spacedJson).join(', ')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort(compareUnicode).map(key => `${v6Canonical(key)}: ${spacedJson(value[key])}`).join(', ')}}`;
  return v6Canonical(value);
}
async function extensionId(scope: unknown): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(spacedJson(scope)));
  return 'C_extension_' + [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 20);
}

export class CompositionTargetTree {
  readonly contract: R = structuredClone(contract);

  informationGoals(offers: readonly R[], observation: R, remaining: number, meter: R | null, policy: R) {
    return electInformationGoals(offers, observation, remaining, meter, policy);
  }

  async extendTarget(facts: R, plans: R, contacts: ContactEntries, featureTrials: R, method: R | null, remaining: number): Promise<R | null> {
    const spec = this.contract.extensions, limits = spec.limits, facets = facts.feature_residuals ?? {};
    if (!truth(facts.homologous) || truth(facts.alignment_refuted) || remaining <= 0) return null;
    const parentRef = or(get(facets, 'prior_method_ref'), get(facts, 'single_pattern_change_observation_ref'));
    if (!truth(parentRef) || !truth(facts.pair_ref)) return null;
    const residuals: R[] = [];
    for (const rule of spec.residuals as R[]) {
      if (!same(get(facets, rule.feature), rule.open)) continue;
      residuals.push({ kind: 'remaining_alignment', facet: rule.feature, wanted: rule.desired, first_route_key: rule.route_key,
        preserve: rule.preserve, evidence: [parentRef, facts.observation_ref], falsifiers: [rule.falsifier] });
    }
    const derived = await observedDerivations(facts, plans, contacts, featureTrials, method, remaining, limits);
    let options: R[] = (derived.offers ?? []).slice(0, limits.max_candidates);
    const eligible = new Set(Object.entries(facts.routes ?? {}).filter(([, route]) => truth((route as R).actions)).map(([key]) => key));
    const access = facts.feature_reaccess;
    if (truth(access) && eligible.has('managed_access')) options = options.map(option => {
      const witnesses = new Set((option.method_evidence ?? []).flatMap((m: R) => (m.transitions ?? []).map((t: R) => JSON.stringify([t.before, t.after]))));
      if (option.unresolved_route_key === 'feature_probe' && witnesses.has(JSON.stringify([access.effect_before, access.effect_after]))
        && ['level_epoch', 'pair_ref', 'observation_ref'].every(k => same(access[k], facts[k]))) return { ...option, first_route_key: 'managed_access', bound_contribution: access };
      return option;
    });
    const facetsOpen = new Set(residuals.map(row => row.first_route_key));
    const candidates: R[] = [...options.filter(option => facetsOpen.has(get(option, 'first_route_key')) || option.relation === 'extends_target')
      .map(option => ({ ...option, kind: 'observed_derivation' })), ...residuals];
    if (!candidates.length) return null;
    const bound = candidates.filter(option => eligible.has(get(option, 'first_route_key')));
    const joint = bound.find(option => option.target_ref === 'joint_feature_agreement'), residual = residuals.find(option => eligible.has(option.first_route_key));
    const protectedAccess = bound.find(option => truth(option.bound_contribution));
    const selected = protectedAccess ?? joint ?? (facetsOpen.size > 1 ? residual : undefined) ?? bound[0] ?? candidates[0]!;
    const route = get(selected, 'first_route_key');
    const scope = [facts.level_epoch, facts.pair_ref, selected.kind, get(selected, 'facet'), get(selected, 'wanted'), get(selected, 'chain_refs', []), route];
    const alternatives = candidates.filter(option => option !== selected).map(option => ({ kind: option.kind,
      target: get(option, 'target_ref', get(option, 'facet')), route: or(get(option, 'first_route_key'), get(option, 'unresolved_route_key')),
      bound: eligible.has(get(option, 'first_route_key')), method: get(option, 'method_ref') })).slice(0, Math.max(0, limits.max_candidates - 1));
    return { id: await extensionId(scope), parent: spec.parent_family, parent_evidence: parentRef, pair_ref: facts.pair_ref,
      observation_ref: facts.observation_ref, level_epoch: facts.level_epoch, proposed: selected, open_facets: residuals.map(row => row.facet),
      first_route_key: route, currently_bound: eligible.has(route), derived_candidates: options.length, alternatives, limits, release_authority: false };
  }

  bind(proposal: R, observation: R, objective: R, previous: R | null = null): R {
    const root = this.contract.root, epoch = observation.level_epoch, ref = observation.observation_ref;
    const template = proposal.bundle_template, focus = template.composition_ref, parent = template.objective_ref;
    const current: R = { root, level_epoch: epoch, observation_ref: ref, version: this.contract.version, retained_target: null };
    const reject = (reason: string): R => ({ ...current, admitted: false, reason });
    if (objective.id !== root || ![root, ...this.contract.objective_aliases].includes(parent)) return reject('principal_goal_unbound');
    const binding = proposal.binding ?? {};
    if (get(binding, 'level_epoch') !== epoch || get(binding, 'observation_ref') !== ref) return reject('stale_proposal');
    const matches = proposal.compositions.filter((c: R) => c.id === focus);
    if (matches.length !== 1 || !or(matches[0].relations, []).includes('contributes_to:' + parent)) return reject('missing_child_parent_relation');
    if (!same(template.actions, proposal.actions) || !(template.evidence ?? []).includes(ref)) return reject('unbound_action_set');
    if ((template.preserve_refs ?? []).some((key: string) => !Object.hasOwn(template.preservation_evidence ?? {}, key))) return reject('missing_preservation_evidence');
    const previousTarget = get(previous ?? {}, 'retained_target');
    if (truth(previous) && previous!.level_epoch === epoch && truth(previousTarget)) current.retained_target = { ...previousTarget, revalidated: false };
    const morph = proposal.morphology ?? {}, plan = get(proposal, 'morphology_plan'), status = get(morph, 'status');
    const sealed = get(previous ?? {}, 'sealed_child', {});
    if (sealed.route_key === 'peer' && sealed.after === ref && sealed.level_epoch === epoch && truth(sealed.complete) && truth(previousTarget)
      && same(sealed.pair_ref, previousTarget.pair_ref)) current.preceding_peer_access = sealed;
    if (['proposed', 'retained', 'refuted'].includes(status)) {
      if (get(morph, 'level_epoch') !== epoch || get(morph, 'observation_ref') !== ref) return reject('stale_role_or_target');
      const facts = morph.measured_facts ?? {}, pair = get(facts, 'pair_ref');
      if (status === 'refuted' && truth(pair) && truth(current.retained_target) && same(pair, current.retained_target.pair_ref)) current.retained_target = null;
      const goal = get(morph, 'composition');
      if (Object.hasOwn(this.contract.goals, goal) && truth(pair) && ['retained', 'proposed'].includes(status)) {
        current.retained_target = { composition: goal, pair_ref: pair, evidence: ref, open_condition: morph.reason, revalidated: true };
        const opened = morph.target_extension;
        if (truth(opened) && opened.level_epoch === epoch && opened.observation_ref === ref && same(opened.pair_ref, pair)) {
          current.retained_target.pending_extension = Object.fromEntries(['id', 'pair_ref', 'observation_ref', 'open_facets', 'first_route_key', 'currently_bound', 'alternatives'].map(k => [k, opened[k]]));
        }
        const sameTarget = truth(previousTarget) && same(previousTarget.pair_ref, pair) && previousTarget.composition === goal;
        if (sameTarget && previous!.level_epoch === epoch && truth(previousTarget.verified_child_effect)) current.retained_target.verified_child_effect = previousTarget.verified_child_effect;
        if (sealed.route_key === 'modifier' && same(sealed.pair_ref, pair) && sealed.level_epoch === epoch && sealed.complete === true
          && sealed.after === get(facts, 'single_pattern_change_observation_ref') && sealed.after === ref
          && facts.single_pattern_contact_change === true && facts.orientation_relation === 'aligned') current.retained_target.verified_child_effect = {
          child: sealed.composition, before: sealed.before, after: ref, effect: 'one_pattern_changed_and_orientation_aligned' };
      }
    }
    if (plan === null) {
      let curiosity = get(proposal.question ?? {}, 'curiosity');
      const intervention = get(proposal.question ?? {}, 'context_intervention');
      if (intervention !== null) {
        const offer = proposal.inventory_plan?.offer ?? {}, bound = offer.target?.context_question ?? {};
        if (curiosity !== null || offer.kind !== 'context_reconfiguration_candidate' || intervention.reconciliation_owner !== 'observed_inventory.context_intervention.record'
          || !truth(bound.association_ref) || !truth(bound.context_key) || get(intervention, 'association_ref') !== get(bound, 'association_ref')
          || get(intervention, 'context_key') !== get(bound, 'context_key') || !same(get(intervention, 'relations'), get(bound, 'relations'))
          || (proposal.steps ?? []).length !== 1 || get(proposal.steps[0], 'expected_after') !== null || proposal.steps[0].seal_after !== true) return reject('unbound_context_intervention_consumer');
        curiosity = intervention;
      }
      if (truth(curiosity)) {
        if (curiosity.observation_ref !== ref || curiosity.level_epoch !== epoch || !same(proposal.actions, [curiosity.action])
          || curiosity.distinct_outcomes < 2 || template.operation_key !== 'OP18') return reject('unbound_information_target');
        const target = get(proposal.question, 'information_target');
        const goals = proposal.compositions.filter((c: R) => c.id === target && c.role === 'information_objective');
        if (goals.length !== 1 || !truth(target) || !(matches[0].relations ?? []).includes('investigates:' + target)
          || !same(goals[0].properties.tested_relations, curiosity.relations)) return reject('information_target_not_linked_to_experiment');
        return { ...current, admitted: true, path: [root, curiosity.tree_key, target, focus], reason: 'test_selected_composition_relations', information_goal: curiosity };
      }
      const acquisition = get(proposal.question ?? {}, 'control_acquisition');
      if (acquisition !== null) {
        const target = current.retained_target;
        if (!truth(target) || !truth(target.revalidated) || !same(target.pair_ref, acquisition.pair_ref) || ref !== acquisition.observation_ref
          || !same(proposal.actions, [{ action_ref: acquisition.action_ref }]) || template.operation_key !== 'OP18') return reject('control_experiment_not_bound_to_target');
        return { ...current, admitted: true, path: [root, this.contract.goals[target.composition].family, 'composition.priority.information_value', focus],
          reason: 'acquire_missing_control', effect_to_check: acquisition.experiment };
      }
      return { ...current, admitted: true, path: [root, focus], reason: 'independent_current_contribution' };
    }
    if (status !== 'proposed' || !truth(current.retained_target) || !truth(current.retained_target.revalidated)) return reject('target_or_role_unconfirmed');
    const branch = get(morph, 'route_key'), goal = this.contract.goals[current.retained_target.composition], child = get(goal.children, branch);
    if (child === null || get(plan, 'route_key') !== branch || get(morph, 'operation') !== template.operation_key) return reject('child_not_selected');
    const facts = plan.facts ?? {};
    if (Object.hasOwn(facts, 'color_relation') && (branch === 'peer' || plan.physical_effect === 'peer') && facts.color_relation !== 'equal') return reject('open_palette_condition_before_peer_contact');
    if (!same(get(facts, 'pair_ref'), current.retained_target.pair_ref)) return reject('different_pair');
    const extension = get(morph, 'target_extension');
    if (extension !== null && extension.first_route_key === branch) {
      if (!truth(extension.currently_bound) || !same(extension.pair_ref, facts.pair_ref) || extension.observation_ref !== ref || extension.level_epoch !== epoch) return reject('stale_target_extension');
      current.retained_target.extension = extension.id;
    }
    for (const [field, expected] of Object.entries(child.requires)) if (!same(get(facts, field), expected)
      || !same(get(morph.measured_facts, field), expected)) return reject('unmet_child_condition:' + field);
    const route = facts.routes?.[branch] ?? {};
    if (get(route, 'level_epoch') !== epoch || get(route, 'observation_ref') !== ref || !same(get(route, 'actions'), proposal.actions)) return reject('child_route_changed');
    const accessReturn = branch === 'entry_probe' && truth(facts.entry_access_return) && sealed.route_key === 'entry_rebind'
      && sealed.complete === true && sealed.after === ref && same(sealed.pair_ref, facts.pair_ref) && sealed.level_epoch === epoch;
    if (branch === 'entry_probe' && !accessReturn) return reject('missing_current_access_child_return');
    const parentReturn = accessReturn || branch === 'peer' && sealed.route_key === 'modifier' && same(sealed.pair_ref, facts.pair_ref)
      && sealed.level_epoch === epoch && sealed.after === get(facts, 'single_pattern_change_observation_ref') && sealed.after === ref && sealed.complete === true;
    const path = [root, goal.family]; if (truth(current.retained_target.extension)) path.push(extension.id);
    return { ...current, admitted: true, path: [...path, child.key, focus], role_refs: plan.role_refs ?? [], motion_examples: facts.motion_examples ?? {},
      contact_in_prefix: get(plan, 'contact_in_prefix', false), goal_xy: get(plan, 'goal_xy'), route_key: or(get(plan, 'physical_effect'), branch),
      previous_child_return: parentReturn ? sealed : null, effect_to_check: child.effect_to_check, reason: 'current_child_conditions_met', requires: child.requires };
  }

  static seal(receipt: R, record: R): R {
    if (!truth(receipt.route_key)) return receipt;
    return { ...receipt, sealed_child: { route_key: receipt.route_key, pair_ref: receipt.retained_target.pair_ref,
      role_refs: receipt.role_refs, motion_examples: receipt.motion_examples, level_epoch: receipt.level_epoch,
      before: receipt.observation_ref, after: record.final_observation_ref, composition: record.released_composition_ref,
      complete: (truth(receipt.contact_in_prefix) || receipt.route_key === 'entry_rebind')
        && record.executed_prefix_count === record.released_actions_count && record.interruption === null
        && record.released_composition_ref === receipt.path.at(-1) } };
  }
}

export function protocolProjection(publicPacket: NativePublicObservation, revision: number, scope: string): R {
  return { revision, level_epoch: publicPacket.level, frame_hash: publicPacket.frame_hash,
    observation_ref: `${scope}:epoch:${publicPacket.level}:revision:${revision}:frame:${publicPacket.frame_hash}`,
    available_action_refs: [...publicPacket.available_action_refs], state: publicPacket.state, levels_completed: publicPacket.levels_completed,
    coordinate_basis: 'screen', projection_scope: 'protocol_only_between_primitives' };
}
export function mainObjective(policy: R, target: number): R {
  return { id: 'G_official_completion', things: ['official_progress'], properties: { definition: policy.provided_objective.definition,
    target_levels_completed: target, visual_terminal_composition: 'unknown' }, relations: [], role: 'objective', knowledge_status: 'explicit_user_objective_not_inferred_visual_role' };
}
export function stateCompositions(proposal: R, objective: R): R[] {
  const result = [...(proposal.compositions ?? [])]; if (!result.some(c => c.id === objective.id)) result.push(objective); return result;
}
export interface ReasoningCallerMemory { put(episode: string, key: string, value: any, evidence: string, revision: number): void }
export interface ReasoningCallerBridge { run(request: R): Promise<R> }
export async function postAnalysis(memory: ReasoningCallerMemory, bridge: ReasoningCallerBridge, episode: string, observation: R,
  revision: number, objective: R, record: R, boundary = false): Promise<R[]> {
  const focus = boundary ? 'C_terminal_witness' : 'C_observed_response';
  const compositions = [objective, { id: focus, things: ['public_before_after_observations', 'released_prefix'],
    properties: { causal_terminal_role: 'unknown', scope: boundary ? 'official_boundary_witness' : 'measured_transition',
      released_composition_ref: get(record, 'released_composition_ref') }, relations: ['contributes_to:G_official_completion'], role: 'evidence_composition' }];
  const knownChecks: R[] = (record.step_expectations ?? []).filter((check: R) => check.status !== 'unknown');
  const state = { level_epoch: observation.level_epoch, observation_revision: revision, facts: {}, compositions,
    expected_properties: Object.fromEntries(knownChecks.map(check => [`path_step_${check.action_index}`, 'matched'])),
    observed_properties: { ...Object.fromEntries(knownChecks.map(check => [`path_step_${check.action_index}`, check.status])), official_levels_completed: observation.levels_completed },
    knowledge_updates: [{ composition_ref: focus, property: 'scoped_observation_record', value: record, revision, evidence: observation.observation_ref }],
    objective_assessments: [{ composition_ref: 'G_official_completion', satisfied: observation.levels_completed >= objective.properties.target_levels_completed,
      feasible: 'unknown', new_evidence: [observation.observation_ref] }] };
  const receipts: R[] = [];
  for (const operation of ['OP29', 'OP30', 'OP31']) {
    memory.put(episode, 'state', state, observation.observation_ref, revision);
    const bundle = { id: 'R0', operation_key: operation, composition_ref: focus, objective_ref: 'G_official_completion', preserve_refs: [],
      observation_revision: revision, level_epoch: observation.level_epoch, kind: 'analysis', actions: [],
      purpose: 'Retain scoped observations and reassess official progress without inventing a visual terminal cause.', preconditions: {}, evidence: [observation.observation_ref] };
    const receipt = await bridge.run({ episode, id: `analysis-${revision}-${operation}`, level_epoch: observation.level_epoch, policy: 'code_only',
      context: bundle.purpose, bundles: { R0: bundle }, candidates: ['R0'], relevant_compositions: [focus, 'G_official_completion'] });
    if (receipt.decision.status !== 'composition_analysis') throw new Error('SRC scoped observation analysis refused');
    receipts.push({ operation, src_status: receipt.src_status, result: receipt.decision.operation_result });
  }
  return receipts;
}
