/**
 * Native common caller components. They consume witnessed public transitions;
 * action release remains exclusively in the shared WHY/ACT program.
 *
 * Strategy providers whose implementations are still being transferred are
 * deliberately not represented as complete here. The common coordinator owns
 * the actual memory objects, restores them from V7 nodes, and keeps the source
 * event order for the providers that are connected to it.
 */
import { AttentionMemory } from './v6-attention-memory.ts';
import { ProspectiveContactAdapter } from './v6-prospective-contact.ts';
import { compositionIdentity } from './v6-composition-memory.ts';
import { ObservedFrontier } from './v6-observed-frontier.ts';
import { ViewFrontier } from './v6-view-frontier.ts';
import { PointExperimentMemory } from './v6-point-contrasts.ts';
import { CoupledDisplays } from './v6-coupled-displays.ts';
import { ControlDependencies, bindPreservation, checkPreservation } from './v6-transition-learning.ts';
import { electInformationGoals, pointGoal, reconcileInformationGoal } from './v6-information-goals.ts';
import { ObservedInputDomain } from './v6-native-observer.ts';
import { targetMethodAtBoundary } from './v6-target-method.ts';
import { compareUnicode } from './canonical.ts';
import { pythonEqual as same, pythonTruthy as truth } from './v6-operations.ts';
import type { NativeReasoningMemory } from './v6-reasoning-memory.ts';
import type { NativeKnowledgeStore, NativeStoreWrite } from './v6-knowledge-store.ts';
import type { NativeAuthorityTransition } from './v6-native-authority.ts';
import type { NativeCommand, NativeObservation, NativeProposal, NativePublicObservation, NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const EPISODE = 'common-observation-frontier';
const COMPONENTS = ['goal', 'frontier', 'view', 'attention', 'points', 'displays', 'controls', 'counters'] as const;
export interface NativeCallerConfiguration {
  targetLevels: number;
  domain: ObservedInputDomain;
  strategy: R;
  /** The original default mode. The disabled mode is also an explicit source option. */
  informationGoal?: 'accessible_view_frontier' | 'open_questions';
}
export interface NativeCallerState {
  goal: R; frontier: R; view: R | null; attention: R; points: R; displays: R;
  controls: { pending: ControlDependencies['pending']; attempted: string[] };
  counters: { goalEventCount: number; deltaSequence: number; goalReason: string | null; returnedAttention: R | null; targetMethod: R | null };
}
export interface NativeCallerAcquisition {
  attention_result: R | null;
  view_result: R | null;
  selected_result: R | null;
  goal_events: R[];
  point_experiment_result: R | null;
  control_experiment_result: R | null;
  information_goal_result: R | null;
}

export class NativeCallerCoordinator {
  readonly memory: NativeReasoningMemory;
  readonly configuration: NativeCallerConfiguration;
  goal = new ProspectiveContactAdapter();
  frontier: ObservedFrontier;
  view: ViewFrontier | null;
  attention: AttentionMemory;
  points = new PointExperimentMemory();
  displays = new CoupledDisplays();
  controls = new ControlDependencies();
  goalEventCount = 0;
  deltaSequence = 0;
  goalReason: string | null = null;
  returnedAttention: R | null = null;
  targetMethod: R | null = null;
  private restoredValues: readonly unknown[] | null = null;

  constructor(memory: NativeReasoningMemory, configuration: NativeCallerConfiguration) {
    this.memory = memory; this.configuration = configuration;
    this.frontier = new ObservedFrontier(configuration.targetLevels, 16);
    this.view = configuration.informationGoal === 'open_questions' ? null : new ViewFrontier();
    this.attention = new AttentionMemory(memory, EPISODE);
  }
  private put(key: string, value: unknown, observation: NativeObservation): void {
    this.memory.put(EPISODE, key, value, observation.observation_ref, observation.revision);
  }
  registry(): R[] {
    try { return this.memory.get(EPISODE, 'empirical_registry').value; }
    catch (error) { if (error instanceof RangeError) return []; throw error; }
  }
  graphInputs(observation: NativeObservation): NativeCommand[] {
    const inputs = this.configuration.domain.candidates(observation);
    return this.view?.hasObservedViewQuestion() ? inputs.filter(action => !truth(action.data)) : inputs;
  }
  async initialize(observation: NativeObservation): Promise<void> {
    this.restoredValues = null;
    await this.frontier.observe(observation, this.graphInputs(observation));
    this.persistDeltas(observation);
  }
  private persistDeltas(observation: NativeObservation): number {
    const events = this.frontier.drainDeltas();
    for (const event of events) { this.deltaSequence += 1; this.put(`frontier_delta:${String(this.deltaSequence).padStart(8, '0')}`, event, observation); }
    if (events.length) this.put('frontier_last_sequence', this.deltaSequence, observation);
    return events.length;
  }

  /** Read the actual retained source objects before a new prefix is planned. */
  restoreFrom(store: NativeKnowledgeStore): void {
    // stateValue checks the root AND every referenced fragment revision. A root
    // identity alone is not enough to authorize reuse of a fragmented state.
    const values = COMPONENTS.map(component => store.stateValue(`caller:${component}`));
    if (this.restoredValues && values.every((value, index) => value === this.restoredValues![index])) return;
    const state = Object.fromEntries(COMPONENTS.map((component, index) => [component, values[index]])) as unknown as NativeCallerState;
    this.restore(state);
    this.restoredValues = values;
  }
  state(): NativeCallerState {
    return {
      goal: this.goal.state(), frontier: this.frontier.snapshot(), view: this.view?.state() ?? null,
      attention: this.attention.state(), points: this.points.state(), displays: this.displays.state(),
      controls: structuredClone({ pending: this.controls.pending, attempted: [...this.controls.attempted].sort(compareUnicode) }),
      counters: structuredClone({ goalEventCount: this.goalEventCount, deltaSequence: this.deltaSequence,
        goalReason: this.goalReason, returnedAttention: this.returnedAttention, targetMethod: this.targetMethod }),
    };
  }
  restore(state: NativeCallerState): void {
    // Stage each component first: a bad nested digest must not leave half of
    // the coordinator restored while its peers still refer to old evidence.
    const goal = new ProspectiveContactAdapter(); goal.restore(state.goal);
    const frontier = new ObservedFrontier(this.configuration.targetLevels, 16, state.frontier);
    const view = state.view === null ? null : new ViewFrontier(); view?.restore(state.view!);
    const attention = new AttentionMemory(this.memory, EPISODE); attention.restore(state.attention);
    const points = new PointExperimentMemory(); points.restore(state.points as ReturnType<PointExperimentMemory['state']>);
    const displays = new CoupledDisplays(); displays.restore(state.displays as ReturnType<CoupledDisplays['state']>);
    const controlState = structuredClone(state.controls), counters = structuredClone(state.counters);
    if (!Array.isArray(controlState.attempted) || controlState.attempted.some(key => typeof key !== 'string')
      || new Set(controlState.attempted).size !== controlState.attempted.length
      || !Number.isSafeInteger(counters.goalEventCount) || counters.goalEventCount < 0
      || !Number.isSafeInteger(counters.deltaSequence) || counters.deltaSequence < 0) throw new TypeError('Invalid native caller checkpoint');
    const controls = new ControlDependencies(); controls.pending = controlState.pending; controls.attempted = new Set(controlState.attempted);
    this.goal = goal; this.frontier = frontier; this.view = view; this.attention = attention; this.points = points; this.displays = displays; this.controls = controls;
    Object.assign(this, counters); this.restoredValues = null;
  }
  checkpointWrites(): NativeStoreWrite[] {
    // Preserve immutable raster identities on the internal checkpoint path.
    // Public state() still returns an independent source-compatible snapshot.
    const state = { ...this.stateWithoutGoal(), goal: this.goal.nativeState() };
    return COMPONENTS.map(component => ({ id: `caller:${component}`, kind: 'component_state', component: `common_caller.${component}`, value: state[component],
      relations: [{ relation: 'reconciles_with', target: 'reasoning:memory' }] }));
  }
  private stateWithoutGoal(): Omit<NativeCallerState, 'goal'> {
    return { frontier: this.frontier.snapshot(), view: this.view?.state() ?? null,
      attention: this.attention.state(), points: this.points.state(), displays: this.displays.state(),
      controls: structuredClone({ pending: this.controls.pending, attempted: [...this.controls.attempted].sort(compareUnicode) }),
      counters: structuredClone({ goalEventCount: this.goalEventCount, deltaSequence: this.deltaSequence,
        goalReason: this.goalReason, returnedAttention: this.returnedAttention, targetMethod: this.targetMethod }) };
  }
  prepare(observation: NativeObservation, remaining: number): void {
    if (!Number.isSafeInteger(remaining) || remaining < 1) throw new TypeError('Planning requires a positive public action allowance');
    this.restoredValues = null;
    this.frontier.max_prefix = Math.min(16, remaining);
    this.frontier.bindCurrentCandidateContext(observation, this.registry());
    this.attention.revalidate(observation); this.returnedAttention = this.attention.takeParentReturn(observation); this.goalReason = null;
  }

  /** Actual registered providers; source subgroup ordering remains in the SRC caller. */
  async goalOffer(observation: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    const result = await this.goal.propose(observation, rows, inputs, Math.min(16, remaining));
    this.goalReason = result.reason ?? null; return result.status === 'proposed' ? result as NativeProposal : null;
  }
  async preScoreOffer(observation: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    const result = await this.goal.proposeEffect(observation, rows, inputs, remaining, this.configuration.strategy.pre_score_contact);
    return result.status === 'proposed' ? result as NativeProposal : null;
  }
  factoredOffer(observation: NativeObservation, inputs: readonly NativeCommand[], remaining: number): NativeProposal | null {
    return this.goal.proposeFactored(observation, inputs, remaining) as NativeProposal | null;
  }
  async scoredOffer(observation: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    const config = this.configuration.strategy;
    return await this.goal.proposeScoredRewrite(observation, rows, inputs, remaining, { ...config.pre_score_contact, ...config.scored_local_rewrite }) as NativeProposal | null;
  }
  async passageOffer(observation: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    const config = this.configuration.strategy;
    return await this.goal.proposePassageOptions(observation, rows, inputs, remaining, { ...config.pre_score_contact, ...config.conditional_transit }) as NativeProposal | null;
  }
  async viewOffer(observation: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    return this.view ? await this.view.propose(observation, rows, inputs, this.registry(), remaining) as NativeProposal | null : null;
  }
  async returnedBranchOffer(observation: NativeObservation, inputs: readonly NativeCommand[]): Promise<R | null> {
    const proposal = await this.frontier.propose(observation, inputs, { return_episode: this.goal.memory.episode });
    this.persistDeltas(observation); return proposal;
  }
  async continuityOffer(observation: NativeObservation, inputs: readonly NativeCommand[]): Promise<R | null> {
    if (!this.view?.hasObservedViewQuestion()) return null;
    const plain = inputs.filter(action => !truth(action.data));
    if (!plain.length) return { status: 'unknown_no_observed_view_access', actions: [] };
    const proposal = await this.frontier.propose(observation, plain, { prefix_evidence: [] });
    this.persistDeltas(observation); return proposal;
  }
  async frontierOffer(observation: NativeObservation, inputs: readonly NativeCommand[]): Promise<R | null> {
    const offer = this.configuration.strategy.families.includes('information_goal') ? null : await this.points.offer(observation, inputs);
    const control = await this.controls.offer(observation, inputs, this.registry());
    const proposal = await this.frontier.propose(observation, inputs, { prefix_evidence: [], experimental_probes: offer ? [offer] : [], control_probe: control });
    this.persistDeltas(observation); return proposal;
  }
  /** Elect only observed offers. Additional source producers enter as explicit inputs. */
  async informationOffer(observation: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number,
    options: { meter: R | null; additionalOffers?: readonly R[]; admit?: (candidate: R, receipt: R) => Promise<boolean> } = { meter: null }): Promise<R | null> {
    const policy = this.configuration.strategy.information_goal;
    const offers = (await this.points.offers(observation, inputs)).map(pointGoal);
    offers.push(...this.displays.offers(observation, rows, inputs, policy.coupled_displays), ...(options.additionalOffers ?? []));
    for (const [candidate, receipt] of electInformationGoals(offers, observation, remaining, options.meter, policy)) {
      if (options.admit && !await options.admit(candidate, receipt)) continue;
      const proposal = await this.frontier.propose(observation, inputs, { curiosity: receipt, experimental_probes: candidate.native_probe ? [candidate.native_probe] : [] });
      this.persistDeltas(observation); if (proposal) return proposal;
    }
    return null;
  }

  bind(proposal: NativeProposal): void { this.configuration.domain.bindProposal(proposal as unknown as Parameters<ObservedInputDomain['bindProposal']>[0]); }
  protect(proposal: R, obligations: readonly R[], observation: NativeObservation, rows: NativeRows): readonly [R, R[]] {
    return bindPreservation(proposal, obligations, observation, rows);
  }
  before(proposal: NativeProposal, index: number, packet: NativePublicObservation, observation: NativeObservation): Promise<R> | R {
    if (['goal_access_plan', 'effect_plan', 'factor_plan', 'rewrite_plan', 'passage_plan'].some(key => Object.hasOwn(proposal, key))) {
      return this.goal.before(proposal, index, packet.frame_rows, { epoch: packet.level, score: packet.levels_completed, available: packet.available_action_refs, observation_ref: observation.observation_ref });
    }
    if (proposal.view_plan && this.view) return this.view.before(proposal, index, packet, observation);
    return this.frontier.guard(proposal, observation, index);
  }
  after(proposal: NativeProposal, index: number, before: NativeObservation, after: NativeObservation, first: NativeRows, second: NativeRows): R {
    if (['goal_access_plan', 'effect_plan', 'factor_plan', 'rewrite_plan', 'passage_plan'].some(key => Object.hasOwn(proposal, key))) {
      return this.goal.after(proposal, index, first, second, { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    }
    if (proposal.view_plan && this.view) return this.view.after(proposal, index, before, after, first, second);
    return this.frontier.checkOutcome(proposal, after, index);
  }
  preservation(proposal: NativeProposal, packet: NativePublicObservation, observation: NativeObservation, after = false, boundary = false): R | null {
    return proposal.preservation ? checkPreservation(proposal, packet.frame_rows, packet.level, { after, boundary, observation }) : null;
  }

  /** This is called only while acquiring a sealed prefix of actual host outcomes. */
  async beforeAssessment(transition: NativeAuthorityTransition, proposal: NativeProposal,
    recordSelected: () => Promise<R | null> = async () => null): Promise<NativeCallerAcquisition> {
    this.restoredValues = null;
    const { before, after, command, first, second, index } = transition, question = proposal.question as R ?? {};
    const acquisition = question.control_acquisition ?? {}, shared = question.curiosity?.also_tests_current_control ?? {};
    const attention_result = this.attention.observe(before, after, command, acquisition.attention_ref || shared.attention_ref || null);
    const view_result = this.view ? await this.view.record(before, after, command, first.frame_rows, second.frame_rows, proposal, index) : null;
    if (view_result) this.put(`view_evidence:${before.revision}`, view_result, after);
    const selected_result = await recordSelected();
    const goal_events = await this.goal.record(before, first.frame_rows, command, after, second.frame_rows, { proposal, index });
    for (const event of goal_events) {
      this.goalEventCount += 1;
      this.put(`goal_access_event:${this.goalEventCount}`, { event, digest: await compositionIdentity(event) }, after);
    }
    if (goal_events.length) this.put('goal_access_event_count', this.goalEventCount, after);
    const point_experiment_result = await this.points.observe(before, command, after, first.frame_rows, second.frame_rows, index === 0 ? question.experiment ?? null : null);
    let information_goal_result: R | null = null;
    if (index === 0 && question.curiosity) {
      const curiosity = question.curiosity;
      let measuredDisplay: string | null = null;
      if (curiosity.source === 'coupled_displays') {
        measuredDisplay = this.displays.observe(curiosity, after, second.frame_rows);
        if (measuredDisplay === 'boundary') {
          this.put('coupled_display_schema', this.displays.scored_schema, after);
          this.displays.scored_schema = this.memory.get(EPISODE, 'coupled_display_schema').value;
        }
      }
      information_goal_result = reconcileInformationGoal(curiosity, before, after, point_experiment_result, measuredDisplay);
      this.put(`information_experiment:${before.revision}`, { goal: curiosity, outcome: information_goal_result }, after);
    }
    let control_experiment_result: R | null = null;
    if (index === 0 && question.control_experiment) {
      control_experiment_result = this.controls.evaluate(question.control_experiment, before, command, after);
      this.put(`control_experiment:${before.revision}`, control_experiment_result, after);
    }
    this.controls.change(before, after, point_experiment_result);
    if (point_experiment_result) this.put(`point_experiment:${before.revision}`, point_experiment_result, after);
    return { attention_result, view_result, selected_result, goal_events, point_experiment_result, control_experiment_result, information_goal_result };
  }
  async recordAssessment(transition: NativeAuthorityTransition, assessment: R | null): Promise<R> {
    this.restoredValues = null;
    const receipt = await this.frontier.recordTransition(transition.before, transition.command, transition.after,
      { assessment, after_action_candidates: this.graphInputs(transition.after) });
    this.persistDeltas(transition.after); return receipt;
  }
  boundaryWitness(transition: NativeAuthorityTransition, proposal: NativeProposal, decisionRevision: number): R {
    this.restoredValues = null;
    const { before, after, command, index } = transition, template = proposal.bundle_template as R;
    const witness: R = { source_level: before.level_epoch, before_observation_ref: before.observation_ref, after_observation_ref: after.observation_ref,
      last_action: command, released_composition: template.composition_ref, committed_decision_revision: decisionRevision,
      executed_prefix_actions: index + 1, cancelled_suffix_actions: proposal.actions.length - index - 1,
      levels_completed_before: before.levels_completed, levels_completed_after: after.levels_completed, official_state: after.state,
      causal_terminal_role: 'unknown', qualification: 'observed official boundary/terminal witness, not a generalized winning recipe' };
    const method = targetMethodAtBoundary(proposal.composition_target_tree as R, witness);
    if (method) { this.put('target_method', method, after); this.targetMethod = this.memory.get(EPISODE, 'target_method').value; witness.target_method = method; }
    this.put(`boundary_witness:${after.revision}`, witness, after); return witness;
  }
  /** Rebuild the original retained goal/frontier objects from verified events. */
  async replayBoundary(observation: NativeObservation): Promise<R> {
    this.restoredValues = null;
    const before = await compositionIdentity(this.goal.memory.retainedState()), goal = new ProspectiveContactAdapter();
    for (let sequence = 1; sequence <= this.goalEventCount; sequence += 1) {
      const record = this.memory.get(EPISODE, `goal_access_event:${sequence}`).value;
      if (await compositionIdentity(record.event) !== record.digest) throw new Error('Goal event digest changed');
      await goal.memory.applyEvent(record.event);
    }
    if (await compositionIdentity(goal.memory.retainedState()) !== before) throw new Error('Goal state did not restore from retained evidence');
    const frontier = new ObservedFrontier(this.configuration.targetLevels, 16);
    const last = this.memory.get(EPISODE, 'frontier_last_sequence').value;
    if (!Number.isSafeInteger(last) || last !== this.deltaSequence) throw new TypeError('Frontier replay sequence differs from the current source record');
    for (let sequence = 1; sequence <= last; sequence += 1) await frontier.applyDelta(this.memory.get(EPISODE, `frontier_delta:${String(sequence).padStart(8, '0')}`).value);
    if (!same(frontier.snapshot(), { ...this.frontier.snapshot(), max_prefix: 16 })) throw new Error('Frontier replay differs from the retained public graph');
    this.goal = goal; this.frontier = frontier;
    await this.frontier.observe(observation, this.graphInputs(observation)); this.persistDeltas(observation);
    return { current_level: observation.level_epoch, replayed_frontier_deltas: last, replayed_goal_events: this.goalEventCount,
      retained_goal_state_digest: before, retained_rule_count: this.registry().length,
      rule_scope: 'prior evidence retained; next-level applicability must be revalidated', visual_terminal_role: 'unknown' };
  }
  close(observation: NativeObservation, reason: string): void { this.restoredValues = null; this.attention.closePending(observation, reason); }
}
