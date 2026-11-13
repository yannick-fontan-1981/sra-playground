/** Observed information/access graph: native transfer of common_frontier.py. */
import policy from './v6/frontier-policy.json' with { type: 'json' };
import { canonical, compareUnicode, digest } from './canonical.ts';
import { pythonEqual as same, pythonTruthy as truth } from './v6-operations.ts';
import { factConditionHolds } from './v6-drm-projector.ts';
import type { DrmCondition } from './v6-drm-projector.ts';
import { predictCandidateRule } from './v6-transition-learning.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { selectFrontierStrategy } from '../sic/frontier-strategy.ts';
import { defaultFrontierConfiguration, type FrontierConfiguration } from '../sic/frontier-configuration.ts';

type R = Record<string, any>;
export const FRONTIER_SCHEMA = 'prototype.observed_frontier.v1';
const FORBIDDEN = new Set(['game_id', 'game_name', 'planner_name', 'oracle', 'oracle_path', 'winning_route', 'visual_goal']);
const copy = <T>(value: T): T => structuredClone(value);
const own = (value: R, key: string) => Object.hasOwn(value, key);
const sorted = (values: Iterable<string>) => [...values].sort(compareUnicode);
const terminal = (state: string) => state === 'WIN' || state === 'GAME_OVER';

export function frontierAction(action: R): R {
  if (Object.keys(action).some(key => FORBIDDEN.has(key)) || !truth(action.action_ref)) throw new TypeError('Neutral admitted action required');
  return { action_ref: action.action_ref, ...(truth(action.data) ? { data: copy(action.data) } : {}) };
}
export const frontierActionKey = async (action: R): Promise<string> => digest(frontierAction(action));
export function frontierProtocol(obs: R): R {
  if (Object.keys(obs).some(key => FORBIDDEN.has(key))) throw new TypeError('Game/oracle labels excluded from frontier observations');
  const required = ['level_epoch', 'frame_hash', 'state', 'levels_completed', 'available_action_refs'];
  if (required.some(key => !own(obs, key))) throw new TypeError('Public protocol projection incomplete');
  return Object.fromEntries(required.map(key => [key, key === 'available_action_refs' ? sorted(obs[key]) : obs[key]]));
}
export const frontierIndex = async (obs: R): Promise<string> => `observation-index:${await digest(frontierProtocol(obs))}`;
export function frontierRef(obs: R): string {
  if (!truth(obs.observation_ref)) throw new TypeError('Observation occurrence reference required');
  return String(obs.observation_ref);
}
export function frontierRules(assessment: R): R[] {
  return [...(assessment.empirical_rules ?? []), ...(assessment.property_rules ?? [])].map(rule => {
    const conditions = rule.conditions ?? {}, action = conditions.action ?? conditions.action_template ?? {}, scope = rule.scope ?? {};
    const epochs: number[] = [];
    for (const mode of [scope.mode ?? {}, scope.observable_mode ?? {}, ...(rule.validated_contexts ?? [])]) if (own(mode, 'level_epoch')) epochs.push(mode.level_epoch);
    for (const evidence of rule.validation_evidence ?? []) if (own(evidence.observable_context ?? {}, 'level_epoch')) epochs.push(evidence.observable_context.level_epoch);
    return { rule_id: rule.rule_id, status: rule.status, action_ref: action.action_ref ?? null, scope_epochs: [...new Set(epochs)].sort((a, b) => a - b),
      counterexample_count: (rule.counterexamples ?? []).length, evidence_refs: (rule.evidence_refs ?? []).slice(-4), rule_family: rule.rule_family ?? 'unknown',
      causal_authority: 'not_inferred_from_status_or_storage' };
  });
}

export interface FrontierProposeOptions {
  prefix_evidence?: readonly R[]; experimental_probes?: readonly R[]; control_probe?: R | null;
  control_acquisition?: R | null; curiosity?: R | null; return_episode?: readonly (readonly [R, string, R])[] | null;
  sic_agenda?: boolean;
  sic_frontier?: FrontierConfiguration;
}

/** Internal checkpoint ownership. The default source-compatible object remains
 * mutable and snapshot() always returns detached values in either mode. */
export interface NativeFrontierOptions { nativeOwned?: boolean }

function sicFrontierOutcome(decision: R | undefined, expected: R | null, actual: R) {
  const status = expected === null ? 'observed' : !same(actual, expected) ? 'access_interrupted' : null;
  return decision && status ? { objective: decision.objective.id, status } : null;
}

export class ObservedFrontier {
  target_levels: number; max_prefix: number;
  nodes: R = {}; observations: R = {}; edges: R = {}; rules: R = {};
  knowledge_revision = 0; sequence = 0; chain: string | null = null; pending: R | null = null;
  navigation_trials: Record<string, number> = {}; action_counts: Record<string, number> = {};
  private candidateContext: readonly [R, R] | null = null;
  private candidateChecks = new Map<string, R>();
  private deltas: R[] = [];
  private readonly nativeOwned: boolean;
  private nativeSnapshotValue: R | null = null;
  private nativeSnapshotInputs: readonly unknown[] | null = null;
  constructor(targetLevels = 3, maxPrefix = 16, state: R | null = null, options: NativeFrontierOptions = {}) {
    if (!(maxPrefix >= 1 && maxPrefix <= 16)) throw new RangeError('Prefix must be bounded by 16');
    this.nativeOwned = options.nativeOwned === true;
    this.target_levels = targetLevels; this.max_prefix = maxPrefix;
    if (state !== null) {
      if (state.schema !== FRONTIER_SCHEMA) throw new TypeError('Unsupported frontier snapshot');
      for (const key of this.stateKeys) (this as any)[key] = this.nativeOwned ? retainNativeJson(state[key]) : copy(state[key]);
    }
    if (this.nativeOwned) this.closeNativeState();
  }
  private get stateKeys(): readonly string[] { return ['target_levels', 'max_prefix', 'nodes', 'observations', 'edges', 'rules', 'knowledge_revision', 'sequence', 'chain', 'pending', 'navigation_trials', 'action_counts']; }
  private closeNativeState(): R {
    // Close the complete replacement before publishing any of it. A foreign
    // shallow freeze does not establish ownership of its mutable descendants.
    const state = retainNativeJson(Object.fromEntries(this.stateKeys.map(key => [key, (this as any)[key]])));
    Object.assign(this, state);
    return state;
  }
  private async commit(kind: string, payload: R): Promise<R> {
    const event: R = { schema: FRONTIER_SCHEMA, sequence: this.sequence + 1, previous_digest: this.chain, kind,
      payload: this.nativeOwned ? retainNativeJson(payload) : copy(payload) };
    event.digest = await digest(event);
    const owned = this.nativeOwned ? retainNativeJson(event) : event;
    await this.applyDelta(owned); this.deltas.push(owned); return owned;
  }
  async applyDelta(event: R): Promise<void> {
    // Capture both the supplied event and the working state before awaiting its
    // hash. The native path stages each change and publishes it only on success.
    const previous = this.nativeOwned ? this.closeNativeState() : null;
    if (this.nativeOwned) event = retainNativeJson(event);
    const base = Object.fromEntries(Object.entries(event).filter(([key]) => key !== 'digest'));
    if (event.schema !== FRONTIER_SCHEMA || event.sequence !== this.sequence + 1 || event.previous_digest !== this.chain || event.digest !== await digest(base)) throw new TypeError('Frontier delta chain/order mismatch');
    if (previous) { await this.applyNativeDelta(event, previous); return; }
    const p = copy(event.payload), kind = event.kind;
    if (kind === 'observation') {
      const key = p.index;
      this.nodes[key] ??= { protocol: p.protocol, composition_ref: `C_observed_${key.split(':')[1].slice(0, 16)}`, occurrences: [], actions: {}, attempts: {}, measurement_summary: p.measurement_summary };
      const node = this.nodes[key]; node.occurrences.push(p.observation_ref);
      if (p.action_candidates !== null) node.actions = await this.actionMap(p.action_candidates);
      this.observations[p.observation_ref] = { index: key, knowledge_revision: p.knowledge_revision };
    } else if (kind === 'domain') this.nodes[p.index].actions = await this.actionMap(p.actions);
    else if (kind === 'transition') {
      const node = this.nodes[p.source]; node.attempts[p.action_key] ??= { count: 0, outcomes: {}, evidence_refs: [], assessment: {} };
      const attempt = node.attempts[p.action_key]; attempt.count++; attempt.outcomes[p.target] = (attempt.outcomes[p.target] ?? 0) + 1;
      attempt.evidence_refs.push(p.transition_ref); attempt.assessment = p.assessment;
      this.edges[p.edge_id] ??= { edge_id: p.edge_id, source: p.source, target: p.target, action: p.action, action_key: p.action_key, evidence_refs: [] };
      this.edges[p.edge_id].evidence_refs.push(p.transition_ref);
      const countKey = `${node.protocol.level_epoch}:${p.action_key}`; this.action_counts[countKey] = (this.action_counts[countKey] ?? 0) + 1;
      for (const rule of p.rules) {
        const old = this.rules[rule.rule_id];
        if (!old || ['status', 'scope_epochs', 'counterexample_count'].some(key => !same(old[key], rule[key]))) this.knowledge_revision++;
        this.rules[rule.rule_id] = rule;
      }
      if (truth(p.navigation_trial)) this.navigation_trials[p.navigation_trial] = (this.navigation_trials[p.navigation_trial] ?? 0) + 1;
      if (this.pending && p.proposal_id === this.pending.proposal_id) {
        this.pending.executed++;
        if (p.sic_outcome) this.pending.sic_outcome = p.sic_outcome;
      }
    } else if (kind === 'proposal') this.pending = { ...p, executed: 0 };
    else throw new TypeError('Unknown frontier delta kind');
    this.sequence = event.sequence; this.chain = event.digest;
  }
  private async applyNativeDelta(event: R, previous: R): Promise<void> {
    const p = event.payload, kind = event.kind, next: R = { ...previous };
    if (kind === 'observation') {
      const key = p.index, old = previous.nodes[key] ?? { protocol: p.protocol,
        composition_ref: `C_observed_${key.split(':')[1].slice(0, 16)}`, occurrences: [], actions: {}, attempts: {},
        measurement_summary: p.measurement_summary };
      const actions = p.action_candidates !== null ? await this.actionMap(p.action_candidates) : old.actions;
      next.nodes = { ...previous.nodes, [key]: { ...old, occurrences: [...old.occurrences, p.observation_ref], actions } };
      next.observations = { ...previous.observations,
        [p.observation_ref]: { index: key, knowledge_revision: p.knowledge_revision } };
    } else if (kind === 'domain') {
      const old = previous.nodes[p.index];
      if (!old) throw new TypeError('Frontier domain requires an existing observation');
      next.nodes = { ...previous.nodes, [p.index]: { ...old, actions: await this.actionMap(p.actions) } };
    } else if (kind === 'transition') {
      const node = previous.nodes[p.source], oldAttempt = node.attempts[p.action_key]
        ?? { count: 0, outcomes: {}, evidence_refs: [], assessment: {} };
      const attempt = { ...oldAttempt, count: oldAttempt.count + 1,
        outcomes: { ...oldAttempt.outcomes, [p.target]: (oldAttempt.outcomes[p.target] ?? 0) + 1 },
        evidence_refs: [...oldAttempt.evidence_refs, p.transition_ref], assessment: p.assessment };
      next.nodes = { ...previous.nodes, [p.source]: { ...node, attempts: { ...node.attempts, [p.action_key]: attempt } } };
      const edge = previous.edges[p.edge_id] ?? { edge_id: p.edge_id, source: p.source, target: p.target,
        action: p.action, action_key: p.action_key, evidence_refs: [] };
      next.edges = { ...previous.edges, [p.edge_id]: { ...edge, evidence_refs: [...edge.evidence_refs, p.transition_ref] } };
      const countKey = `${node.protocol.level_epoch}:${p.action_key}`;
      next.action_counts = { ...previous.action_counts, [countKey]: (previous.action_counts[countKey] ?? 0) + 1 };
      if (p.rules.length) {
        next.rules = { ...previous.rules };
        for (const rule of p.rules) {
          const old = next.rules[rule.rule_id];
          if (!old || ['status', 'scope_epochs', 'counterexample_count'].some(key => !same(old[key], rule[key]))) next.knowledge_revision++;
          // Define own data properties, including opaque prototype-like IDs.
          Object.defineProperty(next.rules, rule.rule_id, { value: rule, enumerable: true, writable: true, configurable: true });
        }
      }
      if (truth(p.navigation_trial)) next.navigation_trials = { ...previous.navigation_trials,
        [p.navigation_trial]: (previous.navigation_trials[p.navigation_trial] ?? 0) + 1 };
      if (previous.pending && p.proposal_id === previous.pending.proposal_id) next.pending = { ...previous.pending, executed: previous.pending.executed + 1,
        ...(p.sic_outcome ? { sic_outcome: p.sic_outcome } : {}) };
    } else if (kind === 'proposal') next.pending = { ...p, executed: 0 };
    else throw new TypeError('Unknown frontier delta kind');
    next.sequence = event.sequence; next.chain = event.digest;
    const closed = retainNativeJson(next);
    if (this.stateKeys.some(key => (this as any)[key] !== previous[key])) throw new TypeError('Native frontier changed while applying a delta');
    Object.assign(this, closed);
    this.nativeSnapshotValue = null; this.nativeSnapshotInputs = null;
  }
  private async actionMap(actions: readonly R[]): Promise<R> {
    const entries: [string, R][] = []; for (const action of actions) entries.push([await frontierActionKey(action), action]); return Object.fromEntries(entries);
  }
  drainDeltas(): R[] { const events = this.deltas; this.deltas = []; return events; }
  snapshot(): R { return { schema: FRONTIER_SCHEMA, ...Object.fromEntries(this.stateKeys.map(key => [key, copy((this as any)[key])])) }; }
  /** Exact source snapshot values with immutable branch identities retained for
   * native fragmentation. All public mutable snapshots keep using snapshot(). */
  nativeSnapshot(): R {
    if (!this.nativeOwned) return retainNativeJson(this.snapshot());
    const state = this.closeNativeState(), inputs = this.stateKeys.map(key => state[key]);
    if (this.nativeSnapshotValue && this.nativeSnapshotInputs
      && inputs.every((value, index) => value === this.nativeSnapshotInputs![index])) return this.nativeSnapshotValue;
    this.nativeSnapshotInputs = inputs;
    this.nativeSnapshotValue = retainNativeJson({ schema: FRONTIER_SCHEMA, ...state });
    return this.nativeSnapshotValue;
  }

  async observe(observation: R, actionCandidates: readonly R[] | null = null): Promise<R> {
    const index = await frontierIndex(observation), ref = frontierRef(observation), protocol = frontierProtocol(observation);
    let actions: R[] | null = null, mapping: R | null = null;
    if (actionCandidates !== null) {
      if (actionCandidates.length > 256) throw new RangeError('Admitted experiment domain exceeds bound');
      actions = actionCandidates.map(frontierAction); mapping = await this.actionMap(actions);
      if (Object.keys(mapping).length !== actions.length) throw new TypeError('Duplicate admitted input');
      if (actions.some(a => !protocol.available_action_refs.includes(a.action_ref))) throw new TypeError('Input outside current public availability');
    }
    if (own(this.observations, ref)) {
      if (this.observations[ref].index !== index) throw new TypeError('Observation reference rebound to different public measurement');
      if (actions !== null && !same(this.nodes[index].actions, mapping)) await this.commit('domain', { index, actions });
    } else await this.commit('observation', { index, observation_ref: ref, protocol, knowledge_revision: this.knowledge_revision,
      action_candidates: actions, measurement_summary: { entity_count: own(observation, 'entities') ? observation.entities.length : null,
        coordinate_basis: observation.coordinate_basis ?? 'unknown', observation_ref: ref } });
    return { observation_index: index, composition_ref: this.nodes[index].composition_ref, observation_ref: ref, knowledge_revision: this.knowledge_revision,
      index_meaning: 'retrieval_of_public_projection; hidden_state_equivalence_not_established' };
  }

  async recordTransition(before: R, givenAction: R, after: R, options: { assessment?: R | null; after_action_candidates?: readonly R[] | null } = {}): Promise<R> {
    const source = (await this.observe(before)).observation_index, target = (await this.observe(after, options.after_action_candidates ?? null)).observation_index;
    const action = frontierAction(givenAction), key = await frontierActionKey(action);
    if (!frontierProtocol(before).available_action_refs.includes(action.action_ref)) throw new TypeError('Recorded action outside observed public availability');
    const transitionRef = `transition:${await digest([frontierRef(before), action, frontierRef(after)])}`;
    if (Object.values(this.edges).some(e => e.evidence_refs.includes(transitionRef))) return { status: 'duplicate_transition_not_counted', transition_ref: transitionRef };
    const assessment = options.assessment ?? {};
    if (truth(assessment.evidence_refs) && !same(assessment.evidence_refs, [frontierRef(before), frontierRef(after)])) throw new TypeError('Library assessment is bound to other observation occurrences');
    const library = assessment.library ?? {};
    const models = (name: string) => sorted(new Set<string>((library[name] ?? []).map((m: R) => m.model).filter(truth)));
    const summary = { library_status: library.status ?? 'unknown', compatible_models: models('compatible'), refuted_models: models('refuted'), unknown_models: models('unknown'), construction_status: assessment.construction?.status ?? 'unexplained_transition_retained' };
    let navigationTrial: string | null = null, proposalId: string | null = null;
    let sicOutcome: R | null = null;
    if (this.pending && this.pending.executed < this.pending.steps.length) {
      const expected = this.pending.steps[this.pending.executed];
      if (expected.before_index === source && await frontierActionKey(expected.action) === key) {
        proposalId = this.pending.proposal_id;
        if (this.pending.kind === 'access') navigationTrial = await digest([source, key, this.pending.question_ref]);
        if (this.pending.sic_frontier && !this.pending.sic_outcome) {
          const outcome = sicFrontierOutcome(this.pending.sic_frontier, expected.expected_after, frontierProtocol(after));
          if (outcome) sicOutcome = { ...outcome, transition: transitionRef };
        }
      }
    }
    const payload = { source, target, action, action_key: key, transition_ref: transitionRef, edge_id: `edge:${await digest([source, key, target])}`,
      assessment: summary, rules: frontierRules(assessment), proposal_id: proposalId, navigation_trial: navigationTrial,
      ...(sicOutcome ? { sic_outcome: sicOutcome } : {}) };
    await this.commit('transition', payload);
    const progress = after.levels_completed > before.levels_completed, boundary = after.level_epoch !== before.level_epoch;
    return { status: 'observed_transition_retained', transition_ref: transitionRef, edge_ref: payload.edge_id,
      public_outcome_count: Object.keys(this.nodes[source].attempts[key].outcomes).length, library_summary: summary, knowledge_revision: this.knowledge_revision,
      official_progress: progress, epoch_boundary: boundary, boundary_qualification: progress ? 'official_progress' : boundary ? 'changed_epoch_without_completion' : 'same_epoch',
      cross_epoch_mechanism_transfer: 'unestablished; prior rules recalled only as hypotheses' };
  }

  bindCurrentCandidateContext(observation: R, rules: readonly R[]): void {
    this.candidateContext = [observation, Object.fromEntries(rules.map(rule => [rule.rule_id, rule]))]; this.candidateChecks.clear();
  }
  async candidateCheck(index: string, action: R, rule: R): Promise<R> {
    const cacheKey = JSON.stringify([index, await frontierActionKey(action), rule.rule_id]);
    const cached = this.candidateChecks.get(cacheKey); if (cached) return cached;
    const context = this.candidateContext, bound = !!context && await frontierIndex(context[0]) === index;
    const current = bound ? context![1][rule.rule_id] ?? null : null;
    const prediction = current !== null ? await predictCandidateRule(current, context![0] as any, action as any) : { status: 'unknown', reason: 'current_rule_or_observation_binding_missing' };
    const facts = { candidate_rule_present: current !== null, current_observation_bound: bound, current_prediction_status: prediction.status };
    const admitted = policy.selection.candidate_question_admission.conditions.every(condition => factConditionHolds(condition as DrmCondition, facts));
    const result = { rule_id: rule.rule_id, action: copy(action), observation_ref: bound ? frontierRef(context![0]) : null,
      status: prediction.status, reason: prediction.reason ?? null, admitted, facts, effect_ref: admitted ? await digest(prediction) : null,
      meaning: 'conditional_question_only_no_acquired_law' };
    this.candidateChecks.set(cacheKey, result); return result;
  }
  async question(index: string, key: string): Promise<R> {
    const node = this.nodes[index], action = node.actions[key], epoch = node.protocol.level_epoch;
    const matching = Object.values(this.rules).filter(r => r.action_ref === action.action_ref), checks: R[] = [];
    for (const rule of matching) if (rule.status === 'candidate') checks.push(await this.candidateCheck(index, action, rule));
    const refs = new Set(checks.filter(r => r.admitted).map(r => r.rule_id));
    const candidates = matching.filter(r => r.status === 'candidate' && refs.has(r.rule_id));
    const prior = matching.filter(r => r.scope_epochs.length && !r.scope_epochs.includes(epoch));
    const refuted = matching.filter(r => r.status === 'refuted'), acquired = matching.filter(r => r.status === 'mechanism_acquired' && !prior.includes(r));
    let reason: string, priority: number, basis: R[];
    if (candidates.length) { reason = 'independent_applicability_test_of_constructed_relation'; priority = 0; basis = candidates; }
    else if (prior.length) { reason = 'rebind_prior_epoch_hypothesis_without_transferring_authority'; priority = 1; basis = prior; }
    else if (refuted.length) { reason = 'missing_condition_unknown_after_retained_counterexample'; priority = 3; basis = refuted; }
    else if (acquired.length) { reason = 'test_known_relation_in_untried_local_context'; priority = 4; basis = acquired; }
    else { reason = 'unobserved_input_effect_or_unexplained_transition'; priority = 3; basis = matching; }
    return { question_ref: `Q_${(await digest([index, key])).slice(0, 20)}`, context_index: index, action, reason, priority,
      hypothesis_refs: basis.slice(0, 8).map(r => r.rule_id), authority_transferred: false, input_trials_at_context: node.attempts[key]?.count ?? 0,
      candidate_applicability: checks.slice(0, 8), candidate_applicability_total: checks.length, current_candidate_prediction_admitted: !!candidates.length };
  }
  async open(index: string, order: FrontierConfiguration['inputOrder'] = 'least_tried',
    comparePriority?: (leastTried: R | undefined, commandOrder: R | undefined) => void): Promise<R[]> {
    const node = this.nodes[index]; if (terminal(node.protocol.state)) return [];
    const questions: R[] = [];
    for (const key of Object.keys(node.actions)) if (!own(node.attempts, key)) questions.push(await this.question(index, key));
    const counts = new Map<R, number>();
    if (order === 'least_tried' || comparePriority) {
      for (const q of questions) counts.set(q, this.action_counts[`${node.protocol.level_epoch}:${await frontierActionKey(q.action)}`] ?? 0);
    }
    const byCommand = (a: R, b: R) => a.priority - b.priority || compareUnicode(canonical(a.action), canonical(b.action));
    const byUse = (a: R, b: R) => a.priority - b.priority || (counts.get(a) ?? 0) - (counts.get(b) ?? 0) || byCommand(a, b);
    const ranked = questions.sort(order === 'least_tried' ? byUse : byCommand);
    if (comparePriority) {
      const [first] = ranked, alternate = ranked.reduce<R | undefined>((best, current) =>
        !best || (order === 'least_tried' ? byCommand : byUse)(current, best) < 0 ? current : best, undefined);
      comparePriority(order === 'least_tried' ? first : alternate, order === 'command_order' ? first : alternate);
    }
    return ranked;
  }
  async canProbeHere(observation: R, command: R): Promise<boolean> {
    const node = this.nodes[await frontierIndex(observation)];
    return observation.available_action_refs.includes(command.action_ref) && (!node || !own(node.attempts, await frontierActionKey(command)));
  }
  async access(start: string, order?: FrontierConfiguration['inputOrder']): Promise<readonly [R[] | null, R | null]> {
    const epoch = this.nodes[start].protocol.level_epoch, queue: [string, R[]][] = [[start, []]], seen = new Set([start]); let head = 0;
    while (head < queue.length && head < 2048) {
      const [index, path] = queue[head++]!;
      if (path.length) for (const question of await this.open(index, order)) {
        const first = path[0]!, trial = await digest([start, first.action_key, question.question_ref]);
        if ((this.navigation_trials[trial] ?? 0) < 2) return [path, question];
      }
      const outgoing = Object.values(this.edges).filter(e => e.source === index).sort((a, b) => compareUnicode(canonical(a.action), canonical(b.action)) || compareUnicode(a.target, b.target));
      for (const edge of outgoing) {
        const target = edge.target;
        if (seen.has(target) || this.nodes[target].protocol.level_epoch !== epoch || terminal(this.nodes[target].protocol.state)) continue;
        seen.add(target); queue.push([target, [...path, edge]]);
      }
    }
    return [null, null];
  }

  async propose(observation: R, actionCandidates: readonly R[], options: FrontierProposeOptions = {}): Promise<R | null> {
    const current = await this.observe(observation, actionCandidates), index = current.observation_index, protocol = frontierProtocol(observation);
    if (protocol.levels_completed >= this.target_levels || terminal(protocol.state)) return { status: 'terminal', actions: [], official_levels_completed: protocol.levels_completed, goal_satisfied: protocol.levels_completed >= this.target_levels, protocol_state: protocol.state };
    const curiosity = options.curiosity ?? null, acquisition = options.control_acquisition ?? null;
    const usesAgenda = options.sic_agenda === true && options.return_episode == null && curiosity === null && acquisition === null;
    const order = (usesAgenda ? options.sic_frontier : undefined)?.inputOrder ?? defaultFrontierConfiguration.inputOrder;
    const choices: { least_tried?: R; command_order?: R } = {};
    let questions = await this.open(index, order, usesAgenda ? (leastTried, commandOrder) => {
      choices.least_tried = leastTried?.action;
      choices.command_order = commandOrder?.action;
    } : undefined);
    if (curiosity !== null) {
      if (curiosity.observation_ref !== frontierRef(observation) || curiosity.level_epoch !== protocol.level_epoch) throw new TypeError('Information goal belongs to another public state');
      questions = questions.filter(q => same(frontierAction(q.action), frontierAction(curiosity.action))).map(q => ({ ...q, curiosity, reason: curiosity.question, hypothesis_refs: curiosity.evidence }));
      if (!questions.length) return null;
    }
    if (acquisition !== null) {
      if (acquisition.observation_ref !== frontierRef(observation)) throw new TypeError('Stale control acquisition experiment');
      questions = questions.filter(q => same(q.action, { action_ref: acquisition.action_ref })).map(q => ({ ...q, reason: acquisition.objective, control_acquisition: acquisition, hypothesis_refs: acquisition.evidence }));
      if (!questions.length) return null;
    }
    for (const probe of options.experimental_probes ?? []) {
      const bound = probe.binding, predictions = probe.frozen_predictions;
      if (bound.observation_ref !== frontierRef(observation) || bound.frame_hash !== observation.frame_hash || !same(bound.mode, [protocol.level_epoch, protocol.state])) throw new TypeError('Experimental probe refers to a different observed context');
      const values = Object.values(predictions);
      if (!values.some(v => same(v, false)) || !values.some(v => same(v, true)) || values.some(v => !same(v, true) && !same(v, false)) || !truth(probe.new_contrast_pairs) || !truth(probe.falsifier)) throw new TypeError('Experimental probe lacks distinct falsifiable predictions');
      for (const pair of probe.new_contrast_pairs) if (pair.length !== 2 || same(predictions[pair[0]], predictions[pair[1]])) throw new TypeError('Proposed rivals do not predict distinct outcomes');
      if (bound.action.action_ref !== 'ACTION6') throw new TypeError('Unsupported experimental binding');
      const entity = observation.entities.find((e: R) => e.id === bound.entity_ref), point = bound.action.data;
      if (!entity || !entity.mask.some((p: number[]) => same(p, [point.x - entity.position[0], point.y - entity.position[1]]))) throw new TypeError('Experimental input differs from its measured occurrence');
      const q = questions.find(q => same(frontierAction(q.action), frontierAction(bound.action)));
      if (q) { questions = [{ ...q, reason: 'discriminate_scoped_visible_support_predictions', priority: -1, hypothesis_refs: Object.keys(predictions), experiment: copy(probe) }, ...questions.filter(other => other !== q)]; break; }
    }
    const control = options.control_probe;
    if (truth(control) && !(questions.length && own(questions[0]!, 'experiment'))) {
      const bound = control!.binding;
      if (control!.kind !== 'control_after_local_change' || bound.observation_ref !== frontierRef(observation) || bound.frame_hash !== observation.frame_hash || !same(bound.mode, [protocol.level_epoch, protocol.state]) || control!.intervention.after !== frontierRef(observation) || !truth(control!.expected_receivers)) throw new TypeError('Control experiment lacks an applicable intervention or receiver forecast');
      for (const r of Object.values(control!.expected_receivers) as R[]) {
        const hits = observation.entities.filter((e: R) => e.signature === r.signature).map((e: R) => e.position);
        if (!same(hits, [r.before])) throw new TypeError('Control receiver is stale or ambiguous');
      }
      const q = questions.find(q => same(frontierAction(q.action), frontierAction(bound.action)));
      if (q) questions = [{ ...q, reason: 'test_control_after_observed_local_change', priority: -1, hypothesis_refs: [control!.rule_ref], control_experiment: copy(control) }, ...questions.filter(other => other !== q)];
    }
    const agenda = usesAgenda ? selectFrontierStrategy(questions[0], frontierRef(observation)) : null;
    let path: R[], question: R, kind: string;
    if (options.return_episode != null) {
      const contrast = await closedReturnContrast(this, options.return_episode, index, this.max_prefix);
      if (contrast === null) return null; [path, question] = contrast; kind = 'access';
    } else if (agenda?.selected?.id === 'test_local_input' || (!agenda && questions.length)) {
      path = []; question = agenda?.selected?.plan.question ?? questions[0]!; kind = 'experiment';
    }
    else {
      const accessed = await this.access(index, order);
      if (accessed[0] === null) return { status: 'frontier_exhausted', actions: [], reason: 'no_untried_admitted_input_or_observed_access_within_current_epoch_and_replay_bound',
        unresolved_multiple_outcomes: Object.values(this.nodes).reduce((sum, n) => sum + Object.values(n.attempts).filter((a: any) => Object.keys(a.outcomes).length > 1).length, 0),
        qualification: 'not_a_proof_of_game_impossibility; richer_observables_or_new_experiment_domain_may_be_required' };
      path = accessed[0]; question = accessed[1]!; kind = 'access';
    }
    const steps: R[] = [];
    for (const edge of path) {
      const outcomes = this.nodes[edge.source].attempts[edge.action_key].outcomes, uncertain = Object.keys(outcomes).length !== 1;
      steps.push({ action: copy(edge.action), before_index: edge.source, expected_before: copy(this.nodes[edge.source].protocol), expected_after: copy(this.nodes[edge.target].protocol), edge_ref: edge.edge_id,
        outcome_alternatives: Object.keys(outcomes), first_unresolved_effect: uncertain, qualification: 'provisional_observed_transition; hidden_state_equivalence_unproved' });
      if (uncertain || steps.length >= this.max_prefix) break;
    }
    if (steps.length < this.max_prefix && (!steps.length || !steps[steps.length - 1]!.first_unresolved_effect) && steps.length === path.length) steps.push({ action: copy(question.action), before_index: question.context_index,
      expected_before: copy(this.nodes[question.context_index].protocol), expected_after: null, edge_ref: null, outcome_alternatives: [], first_unresolved_effect: true, qualification: 'untried_input_effect; seal_after_observation' });
    const actions = steps.map(s => s.action), unknown = steps.some(s => s.first_unresolved_effect), op = unknown ? 'OP18' : 'OP28';
    const focus = `C_experiment_${(await digest([index, question.question_ref, this.sequence])).slice(0, 16)}`, goal = 'G_protocol_completion', preserve = 'G_current_protocol_scope';
    const facts: R = { current_observation_ref: frontierRef(observation), current_level_epoch: protocol.level_epoch, current_levels_completed: protocol.levels_completed,
      first_input_publicly_available: protocol.available_action_refs.includes(actions[0].action_ref), open_information_question: true };
    if (question.priority === 0) { if (!truth(question.current_candidate_prediction_admitted)) throw new TypeError('Candidate priority lacks current DRM admission'); facts.current_candidate_prediction_admitted = true; }
    const routeRefs = steps.filter(s => s.edge_ref).map(s => s.edge_ref);
    const compositions: R[] = [
      { id: goal, properties: { definition: 'official_level_completion_as_reported_by_protocol', target_levels: this.target_levels, observed_levels_completed: protocol.levels_completed, visual_goal: 'unknown' }, role: 'objective' },
      { id: preserve, properties: { definition: 'retain_current_epoch_and_public_input_binding; no_physical_safety_claim' }, role: 'preservation' },
      { id: this.nodes[index].composition_ref, properties: copy(this.nodes[index].measurement_summary), role: 'observed_composition' },
      { id: focus, observed: false, open_question: question.reason, properties: { question_ref: question.question_ref, hypothesis_refs: question.hypothesis_refs, candidate_applicability: question.candidate_applicability ?? [],
        candidate_refusals: [...this.candidateChecks.values()].filter(r => !r.admitted).slice(0, 8), access_refs: routeRefs, access_distance: path.length, provisional: true }, relations: [`contributes_to:${goal}`], role: 'information_or_access' },
    ];
    const template: R = { operation_key: op, composition_ref: focus, objective_ref: goal, preserve_refs: [preserve], kind: unknown ? 'probe' : 'realize',
      purpose: 'Resolve an observed information gap through an untried admitted input or a conditional remembered access; official completion remains the protocol objective.', preconditions: facts,
      preservation_evidence: { [preserve]: 'current occurrence/epoch/availability bound; every suffix has a public-projection falsifier' }, evidence: [frontierRef(observation), question.question_ref, ...routeRefs.slice(0, 16)], actions,
      outcome_guard: { path: ['value'], contains: op === 'OP18' ? focus : 'B0' } };
    if (curiosity !== null) {
      template.purpose = curiosity.question; template.discriminating_predictions = curiosity.predictions;
      const target = `C_information_${(await digest([protocol.level_epoch, curiosity.source, curiosity.relations, sorted(Object.keys(curiosity.predictions))])).slice(0, 20)}`;
      question.information_target = target; compositions[compositions.length - 1]!.relations.push(`investigates:${target}`);
      compositions.push({ id: target, role: 'information_objective', observed: false, things: curiosity.relations.map((r: any[]) => r[0]),
        properties: { status: 'sought', question: curiosity.question, tested_relations: curiosity.relations, prospective_predictions: curiosity.predictions }, relations: [`contributes_to:${goal}`] }); template.information_target = target;
    }
    if (own(question, 'experiment')) { const exp = question.experiment; template.purpose = exp.question; template.frozen_experiment = exp; template.evidence.push(...new Set(exp.rivals.map((r: R) => r.source_ref))); }
    if (own(question, 'control_experiment')) { const exp = question.control_experiment; template.purpose = exp.question; template.frozen_control_experiment = exp; template.evidence.push(...exp.evidence_refs); }
    const proposalId = `proposal:${await digest([index, question.question_ref, steps, this.sequence])}`;
    const binding = { observation_ref: frontierRef(observation), level_epoch: protocol.level_epoch, levels_completed: protocol.levels_completed, knowledge_revision: this.knowledge_revision };
    const inputRanked = !own(question, 'experiment') && !own(question, 'control_experiment');
    const sicFrontier = agenda?.selected ? { strategy: agenda.selected.id, agenda: agenda.entries, inputOrder: order, inputRanked,
      ...(inputRanked && kind === 'experiment' && choices.least_tried && choices.command_order ? { choices } : {}),
      objective: { id: question.question_ref, label: 'Observe the effect of the selected untried input', parent: goal } } : null;
    await this.commit('proposal', { proposal_id: proposalId, kind, question_ref: question.question_ref, steps, binding,
      ...(sicFrontier ? { sic_frontier: sicFrontier } : {}) });
    return { status: 'proposed', proposal_id: proposalId, kind, actions, steps, facts, compositions, bundle_template: template, binding, question, route_refs: routeRefs, planned_access_length: path.length, conditional_prefix_length: steps.length,
      ...(sicFrontier ? { sic_frontier_decision: sicFrontier } : {}),
      prefix_qualification: 'provisional_observed_path_with_per_step_falsifiers; never_global_state_certification', library_hypothesis_refs: question.hypothesis_refs,
      supplementary_evidence_refs: (options.prefix_evidence ?? []).filter(p => truth(p.evidence_ref)).map(p => p.evidence_ref).slice(0, 8), graph_transmitted_to_SRC: false, release_authority: false };
  }

  async guard(proposal: R, observation: R, actionIndex = 0): Promise<R> {
    if (proposal.status !== 'proposed' || !(actionIndex >= 0 && actionIndex < proposal.steps.length)) return { admitted: false, reason: 'no_bound_step' };
    const protocol = frontierProtocol(observation), binding = proposal.binding, step = proposal.steps[actionIndex];
    if (protocol.level_epoch !== binding.level_epoch || protocol.levels_completed !== binding.levels_completed) return { admitted: false, reason: 'official_boundary_invalidates_suffix' };
    if (terminal(protocol.state)) return { admitted: false, reason: 'terminal_protocol_state' };
    if (actionIndex === 0 && observation.observation_ref !== binding.observation_ref) return { admitted: false, reason: 'initial_occurrence_binding_changed' };
    if (!same(protocol, step.expected_before)) return { admitted: false, reason: 'public_projection_diverged_from_conditional_path', expected_index: step.before_index, observed_index: await frontierIndex(observation) };
    if (!protocol.available_action_refs.includes(step.action.action_ref)) return { admitted: false, reason: 'input_no_longer_available' };
    if (this.knowledge_revision !== binding.knowledge_revision) return { admitted: false, reason: 'new_learning_requires_fresh_SRC_selection' };
    return { admitted: true, reason: 'current_public_premises_match_provisional_step', qualification: 'no_hidden_state_equivalence_or_global_safety_claim', effect_status: step.first_unresolved_effect ? 'unresolved_then_seal' : 'previously_observed_conditional' };
  }
  checkOutcome(proposal: R, observation: R, actionIndex: number): R {
    if (!(actionIndex >= 0 && actionIndex < (proposal.steps ?? []).length)) throw new RangeError('Outcome outside bound action set');
    const actual = frontierProtocol(observation), expected = proposal.steps[actionIndex].expected_after, progress = actual.levels_completed > proposal.binding.levels_completed;
    const outcome = sicFrontierOutcome(proposal.sic_frontier_decision, expected, actual);
    const evidence = outcome ? { sic_frontier_outcome: outcome } : {};
    if (expected === null) return { status: 'unknown_effect_observed', matched: null, seal_prefix: true, official_progress: progress, ...evidence };
    if (same(actual, expected)) return { status: 'matched_public_projection', matched: true, seal_prefix: actionIndex === proposal.steps.length - 1, official_progress: progress, qualification: 'supports_conditional_edge_only' };
    return { status: 'diverged_public_projection', matched: false, seal_prefix: true, official_progress: progress,
      differing_fields: Object.keys(expected).filter(key => !same(actual[key], expected[key])), remaining_suffix_authorized: false, ...evidence };
  }
}

/** Direct native return_fork.py: a repeated return is a contrast question, never undo. */
export async function closedReturnContrast(graph: ObservedFrontier, episode: readonly (readonly [R, string, R])[], index: string, capacity: number): Promise<[R[], R] | null> {
  if (episode.length < 2 || capacity < 2) return null;
  const entry = episode[0]![0];
  if (graph.nodes[index].protocol.frame_hash !== entry.frame_hash || episode[episode.length - 1]![2].frame_hash !== entry.frame_hash) return null;
  const path: (readonly [R, string, R])[] = [];
  for (const part of [...episode].reverse()) {
    const [before, , after] = part;
    if (before.epoch !== entry.epoch || after.epoch !== entry.epoch || before.score !== after.score) return null;
    path.push(part); if (before.frame_hash === entry.frame_hash) break;
  }
  path.reverse();
  if (!(path.length >= 2 && path.length <= capacity) || new Set(path.map(p => p[1])).size !== 1 || new Set(path.map(p => p[0].frame_hash)).size !== path.length) return null;
  const edges: R[] = [];
  for (const [before, key, after] of path) {
    const origin = graph.observations[before.ref]?.index, dest = graph.observations[after.ref]?.index;
    if (origin == null || dest == null) return null;
    const candidates = Object.values(graph.edges).filter(edge => edge.source === origin && edge.target === dest && edge.action.action_ref === key && !truth(edge.action.data));
    if (candidates.length !== 1) return null; const edge = candidates[0]!;
    if (!same(Object.keys(graph.nodes[origin].attempts[edge.action_key].outcomes), [dest])) return null;
    edges.push(edge);
  }
  const last = edges[edges.length - 1]!, questions = await graph.open(last.source); if (!questions.length) return null;
  const evidence = edges.map(edge => edge.evidence_refs[edge.evidence_refs.length - 1]);
  return [edges.slice(0, -1), { ...questions[0], reason: 'contrast_an_untried_continuation_at_the_last_fork_before_observed_return', hypothesis_refs: evidence,
    return_focus: { entry_ref: entry.ref, return_ref: path[path.length - 1]![2].ref, observed_repeated_command: path[path.length - 1]![1], access_steps: path.length - 1,
      falsifier: 'A different intermediate public projection cancels the suffix; the alternate input may also return without score.' } }];
}
export function closedObservedPathReturn(path: readonly R[]): R | null {
  if (path.length < 2) return null;
  const end = path[path.length - 1]!.after_key, starts = path.slice(0, -1).map((e, i) => e.before_key === end ? i : -1).filter(i => i >= 0);
  for (const i of starts.reverse()) {
    const cycle = path.slice(i); if (new Set(cycle.map(e => e.before_key)).size !== cycle.length) continue;
    if (cycle.slice(0, -1).some((e, j) => e.after_key !== cycle[j + 1]!.before_key)) continue;
    return { path: cycle, return_key: end, evidence_refs: cycle.map(e => e.after_ref), scope: 'Observed return of the selected public projection without score; individual actions and local effects are not refuted.' };
  }
  return null;
}
