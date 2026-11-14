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
import { compositionIdentity, registered, relativeMotion } from './v6-composition-memory.ts';
import type { Snapshot } from './v6-composition-memory.ts';
import { ObservedFrontier, frontierActionKey, frontierIndex } from './v6-observed-frontier.ts';
import { ViewFrontier } from './v6-view-frontier.ts';
import { PointExperimentMemory } from './v6-point-contrasts.ts';
import { CoupledDisplays } from './v6-coupled-displays.ts';
import { ControlDependencies, bindPreservation, checkPreservation } from './v6-transition-learning.ts';
import { electInformationGoals, pointGoal, reconcileInformationGoal } from './v6-information-goals.ts';
import { motionOffers } from './v6-motion-contrast.ts';
import { contextualTranslationExposures } from './v6-contextual-translation.ts';
import { ObservedInputDomain } from './v6-native-observer.ts';
import { recalledDirections, targetMethodAtBoundary } from './v6-target-method.ts';
import { retainNativeJson } from './v6-native-owned.ts';
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
  sicFrontier?: import('../sic/frontier-configuration.ts').FrontierConfiguration;
  sicView?: 'shadow' | 'active';
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
  private deferred: R[] = [];
  get deferredCuriosity(): R[] { return structuredClone(this.deferred); }
  private restoredValues: readonly unknown[] | null = null;
  private effectfulInventory: { frontier: ObservedFrontier; sequence: number; chain: string | null;
    knowledgeRevision: number; observationKey: string; value: R } | null = null;

  constructor(memory: NativeReasoningMemory, configuration: NativeCallerConfiguration) {
    this.memory = memory; this.configuration = configuration;
    this.frontier = new ObservedFrontier(configuration.targetLevels, 16, null, { nativeOwned: true });
    this.view = configuration.informationGoal === 'open_questions' ? null : new ViewFrontier();
    this.attention = new AttentionMemory(memory, EPISODE);
  }
  private put(key: string, value: unknown, observation: NativeObservation): void {
    this.memory.put(EPISODE, key, value, observation.observation_ref, observation.revision);
  }
  registry(): R[] {
    try { return this.memory.nativeGet(EPISODE, 'empirical_registry').value; }
    catch (error) { if (error instanceof RangeError) return []; throw error; }
  }
  graphInputs(observation: NativeObservation): NativeCommand[] {
    const inputs = this.configuration.domain.candidates(observation);
    return this.view?.hasObservedViewQuestion() ? inputs.filter(action => !truth(action.data)) : inputs;
  }
  async initialize(observation: NativeObservation): Promise<void> {
    this.restoredValues = null;
    this.effectfulInventory = null;
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
    const frontier = new ObservedFrontier(this.configuration.targetLevels, 16, state.frontier, { nativeOwned: true });
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
    Object.assign(this, counters); this.restoredValues = null; this.effectfulInventory = null; this.deferred = [];
  }
  checkpointWrites(): NativeStoreWrite[] {
    // Preserve immutable raster identities on the internal checkpoint path.
    // Public state() still returns an independent source-compatible snapshot.
    const state = { ...this.stateWithoutGoal(), goal: this.goal.nativeState() };
    return COMPONENTS.map(component => ({ id: `caller:${component}`, kind: 'component_state', component: `common_caller.${component}`, value: state[component],
      relations: [{ relation: 'reconciles_with', target: 'reasoning:memory' }] }));
  }
  private stateWithoutGoal(): Omit<NativeCallerState, 'goal'> {
    return { frontier: this.frontier.nativeSnapshot(), view: this.view?.state() ?? null,
      attention: this.attention.state(), points: this.points.state(), displays: this.displays.state(),
      controls: structuredClone({ pending: this.controls.pending, attempted: [...this.controls.attempted].sort(compareUnicode) }),
      counters: structuredClone({ goalEventCount: this.goalEventCount, deltaSequence: this.deltaSequence,
        goalReason: this.goalReason, returnedAttention: this.returnedAttention, targetMethod: this.targetMethod }) };
  }
  prepare(observation: NativeObservation, remaining: number): void {
    if (!Number.isSafeInteger(remaining) || remaining < 1) throw new TypeError('Planning requires a positive public action allowance');
    this.restoredValues = null;
    this.effectfulInventory = null;
    this.frontier.max_prefix = Math.min(16, remaining);
    this.frontier.bindCurrentCandidateContext(observation, this.registry());
    this.attention.revalidate(observation); this.returnedAttention = this.attention.takeParentReturn(observation); this.goalReason = null;
    this.deferred = [];
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

  /** An observed access model is not an acquired contact effect. This narrowly
   * identifies the source's first contact experiment, without treating other
   * learned effect questions as interchangeable exploration. */
  unacquiredInquiryWitness(proposal: NativeProposal, observation: NativeObservation): R | null {
    const plan = proposal.effect_plan as R | undefined;
    if (proposal.status !== 'proposed' || proposal.kind !== 'observed_effect_access' || !plan
      || plan.observation_ref !== observation.observation_ref || plan.epoch !== observation.level_epoch
      || plan.score !== observation.levels_completed || plan.initial_contact_acquisition !== true
      || plan.kind !== 'acquire_visible_contact_response' || plan.observed_nonlocal_contact_count !== 0
      || !Array.isArray(plan.contact_evidence) || plan.contact_evidence.length
      || !Array.isArray(plan.remote_effect_families) || plan.remote_effect_families.length
      || plan.remote_change_evidence !== null || !Array.isArray(plan.control_surface_evidence)
      || !plan.control_surface_evidence.length || !Array.isArray(plan.prefix) || !plan.prefix.length
      || plan.prefix.at(-1).effect !== 'unknown_then_observe') return null;
    return { status: 'unknown_effect_inquiry_with_measured_access', observation_ref: observation.observation_ref,
      level_epoch: observation.level_epoch, proposal_ref: proposal.proposal_id,
      contact_evidence: [], control_evidence: [...plan.control_surface_evidence],
      effect_status: 'unobserved', terminal_role: 'unknown', physical_action_authorized: false,
      qualification: 'Current measured access supports an initial contact question. No nonlocal contact effect has been acquired by this plan.' };
  }

  /** Conservative bridge for a V5 current-context premise. Only a genuinely
   * untried command in the acquired V6 public-protocol node is in this native
   * extension's domain. Any previous trial, including a changed or transient
   * return, removes priority. A final-frame self-loop is never called no-effect.
   * This is not the unported V5 caller's context-equivalence algorithm. */
  async currentUntriedServiceTrial(observation: NativeObservation, command: NativeCommand): Promise<R | null> {
    const index = await frontierIndex(observation), key = await frontierActionKey(command);
    const occurrence = this.frontier.observations[observation.observation_ref], node = this.frontier.nodes[index];
    if (!occurrence || occurrence.index !== index || !node || !node.occurrences.includes(observation.observation_ref)
      || !Object.hasOwn(node.actions, key) || Object.hasOwn(node.attempts, key)
      || !observation.available_action_refs.includes(command.action_ref)) return null;
    const effectful = this.currentObservedEffectfulActions(observation);
    if (!effectful) return null;
    return { status: 'untried_exact_public_context', observation_ref: observation.observation_ref,
      level_epoch: observation.level_epoch, frame_hash: observation.frame_hash, action_ref: command.action_ref,
      trial_key: `${index}:${key}`, action_key: key, context_index: index,
      protocol: structuredClone(node.protocol), command: structuredClone(node.actions[key]),
      domain_complete: true, attempted_without_effect_in_current_context: false,
      evidence_refs: [observation.observation_ref], prior_trial_count: 0, prior_transition_refs: [],
      source_state_ref: 'caller:frontier', source_frontier_chain: this.frontier.chain,
      source_frontier_sequence: this.frontier.sequence, context_projection: 'v6.frontierProtocol',
      v5_caller_context_parity: false,
      effectful_action_context: effectful,
      qualification: 'No acquired trial exists for this exact admitted command and public protocol. All previously tried commands are outside this narrower native priority domain; no hidden-state equivalence or transient no-effect is inferred.' };
  }

  /** Complete inventory of positive FINAL-raster changes in the actual current
   * public epoch. This is a named native producer for a consumed V5 input, not
   * the unported V5 producer. Final-equal/transient returns remain unknown here;
   * none is classified as no-effect, and unseen inputs are not assigned a role. */
  private currentObservedEffectfulActions(observation: NativeObservation): R | null {
    // Several independent guards ask this same question before a primitive is
    // dispatched. Reuse one validated inventory only while the actual frontier
    // chain and complete public scope are unchanged. No historical cache grows.
    const frontier = this.frontier;
    const observationKey = JSON.stringify([observation.observation_ref, observation.level_epoch,
      observation.levels_completed, observation.frame_hash, observation.state, observation.revision,
      observation.available_action_refs]);
    const cached = this.effectfulInventory;
    if (cached?.frontier === frontier && cached.sequence === frontier.sequence
      && cached.chain === frontier.chain && cached.knowledgeRevision === frontier.knowledge_revision
      && cached.observationKey === observationKey) return structuredClone(cached.value);
    this.effectfulInventory = null;
    const value = this.measureObservedEffectfulActions(observation);
    if (value) this.effectfulInventory = { frontier, sequence: frontier.sequence, chain: frontier.chain,
      knowledgeRevision: frontier.knowledge_revision, observationKey, value: retainNativeJson(value) };
    return value;
  }

  private measureObservedEffectfulActions(observation: NativeObservation): R | null {
    const witnesses: R[] = [], known = new Set<string>(), evidence = new Set<string>();
    let considered = 0;
    for (const edge of Object.values(this.frontier.edges) as R[]) {
      const before = this.frontier.nodes[edge.source], after = this.frontier.nodes[edge.target];
      if (!before || !after || !Array.isArray(edge.evidence_refs) || !edge.evidence_refs.length) return null;
      const first = before.protocol, second = after.protocol;
      if (first.level_epoch !== observation.level_epoch || second.level_epoch !== observation.level_epoch
        || first.levels_completed !== observation.levels_completed || second.levels_completed !== observation.levels_completed) continue;
      const attempt = before.attempts[edge.action_key];
      if (!attempt || !(attempt.outcomes[edge.target] > 0) || typeof first.frame_hash !== 'string'
        || typeof second.frame_hash !== 'string' || !first.available_action_refs.includes(edge.action.action_ref)
        || !edge.evidence_refs.every((ref: string) => attempt.evidence_refs.includes(ref))) return null;
      considered += edge.evidence_refs.length;
      if (first.frame_hash === second.frame_hash) continue;
      known.add(edge.action.action_ref);
      for (const ref of edge.evidence_refs) evidence.add(ref);
      witnesses.push({ edge_ref: edge.edge_id, command: structuredClone(edge.action), source_index: edge.source,
        target_index: edge.target, before_frame_hash: first.frame_hash, after_frame_hash: second.frame_hash,
        transition_refs: [...edge.evidence_refs], effect_status: 'observed_final_raster_change' });
    }
    return { status: 'observed_effectful_action_inventory', observation_ref: observation.observation_ref,
      level_epoch: observation.level_epoch, levels_completed: observation.levels_completed,
      available_action_refs: [...observation.available_action_refs], known_effectful_action_refs: [...known].sort(compareUnicode),
      witnesses, evidence_refs: [...evidence].sort(compareUnicode), considered_transition_count: considered,
      source_state_ref: 'caller:frontier', source_frontier_chain: this.frontier.chain,
      source_frontier_sequence: this.frontier.sequence, domain_complete: true,
      measurement_domain: 'final_public_raster_change_within_current_epoch_and_score', v5_producer_parity: false,
      level_start_checkpoint_action_ref: null,
      checkpoint_qualification: 'The admitted V6 public protocol has no checkpoint-role attribute; null retains the V5 InteractionProbeInput default and gives no action a checkpoint role.',
      qualification: 'All acquired frontier edges in this declared scope are examined. A positive final-raster change is an observed response, not a general causal law. Unseen inputs and final-equal returns, including possible transient effects, remain unknown; no effect or no-effect is inferred for them.' };
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
    return this.view ? await this.view.propose(observation, rows, inputs, this.registry(), remaining, this.configuration.sicView) as NativeProposal | null : null;
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
    const proposal = await this.frontier.propose(observation, inputs, {
      prefix_evidence: [], experimental_probes: offer ? [offer] : [], control_probe: control,
      ...(this.configuration.sicFrontier ? { sic_agenda: true, sic_frontier: this.configuration.sicFrontier } : {}),
    });
    this.persistDeltas(observation); return proposal;
  }
  /** Exact current-control questions from StrategyRouter.choose. Inspection
   * reads the frontier; only an admitted source proposal reaches common WHY/ACT.
   */
  async acquireControlForTarget(observation: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[],
    decision: R | null, options: { inspectOnly?: boolean } = {}): Promise<R | null> {
    const active = decision ?? {}, policy = this.configuration.strategy.acquire_control_for_target;
    if (!policy || active.status !== policy.requires_status || active.reason !== policy.requires_reason) return null;
    const facts = active.measured_facts, current = this.goal.memory.snapshot(observation, rows);
    const commands = inputs.filter(action => !truth(action.data)).map(action => action.action_ref).sort(compareUnicode);
    const trials = new Map<string, [Snapshot, Snapshot][]>(commands.map(command => [command, []]));
    for (const [before, command, after] of this.goal.memory.episode) {
      if (trials.has(command) && before.epoch === after.epoch && after.epoch === current.epoch) trials.get(command)!.push([before, after]);
    }
    const recalled = recalledDirections(this.targetMethod, active, current), bases: number[][] = [];
    if (truth(recalled) && policy.recall === 'prefer_an_unmeasured_axis_of_a_relocated_role') {
      for (const [command, pairs] of trials) {
        if (!Object.hasOwn(recalled, command)) continue;
        const vector = recalled[command];
        if (pairs.some(([before, after]) => registered(before, after)
          && this.targetMethod!.role_refs.every((signature: string) => same(relativeMotion(before, after, signature), vector)))
          && !bases.some(base => same(base, vector))) bases.push([...vector]);
      }
      const axisOrder = (command: string): number => {
        if (!Object.hasOwn(recalled, command)) return 2;
        const [dx, dy] = recalled[command];
        return Number(bases.some(([x, y]) => x! * dy === y! * dx));
      };
      commands.sort((first, second) => axisOrder(first) - axisOrder(second));
    }
    let exposures: R | null = null;
    const experiments = [...policy.experiments] as string[], focus = this.attention.item;
    if (focus?.status === 'pending' && focus.opened_at === observation.observation_ref && same(focus.pair_ref, facts.pair_ref)) {
      commands.sort((first, second) => Number(first !== focus.action_ref) - Number(second !== focus.action_ref));
      experiments.sort((first, second) => Number(first !== focus.experiment) - Number(second !== focus.experiment));
    }
    for (const experiment of experiments) for (const command of commands) {
      const pairs = trials.get(command)!;
      let evidence: string[] = [current.ref], contrast: R | null = null, expectedMotion: R | null = null;
      if (experiment === 'replicate_after_contextual_block') {
        exposures ??= await contextualTranslationExposures(this.goal.memory.episode, current, commands);
        contrast = Object.hasOwn(exposures, command) ? exposures[command] : null;
        if (contrast === null) continue;
        evidence = contrast.evidence;
        expectedMotion = Object.fromEntries(contrast.role_signatures.map((signature: string) => [signature, contrast!.observed_delta]));
      } else if (experiment === 'sample_unused_control') {
        if (pairs.length) continue;
      } else if (experiment === 'replicate_translation') {
        if (pairs.length !== 1) continue;
        const [before, after] = pairs[0]!;
        if (!registered(before, after) || !registered(after, current)) continue;
        const changed = Object.keys(current.roles).filter(signature => Object.hasOwn(after.roles, signature) && Object.hasOwn(before.roles, signature)
          && !same(relativeMotion(before, after, signature), [0, 0]) && !same(current.roles[signature]!.slice(0, 2), before.roles[signature]!.slice(0, 2)));
        if (!changed.length) continue;
        evidence.push(before.ref, after.ref);
        expectedMotion = Object.fromEntries(changed.map(signature => [signature, [...relativeMotion(before, after, signature)!]]));
      } else throw new TypeError('Unknown control experiment');
      const acquisition: R = { action_ref: command, experiment, evidence, pair_ref: facts.pair_ref,
        observation_ref: current.ref, objective: policy.objective };
      if (contrast !== null) acquisition.exposure_contrast = contrast;
      if (expectedMotion !== null) acquisition.expected_motion = expectedMotion;
      if (Object.hasOwn(recalled, command)) acquisition.recalled_method = { evidence: this.targetMethod!.scoring_observation,
        tested_prediction: recalled[command], current_measured_vectors: [...bases].sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!) };
      if (options.inspectOnly) {
        if (await this.frontier.canProbeHere(observation, { action_ref: command })) return acquisition;
        continue;
      }
      if (this.attention.matches(acquisition, observation)) acquisition.attention_ref = this.attention.item!.id;
      const proposal = await this.frontier.propose(observation, inputs, { control_acquisition: acquisition });
      this.persistDeltas(observation); if (proposal) return proposal;
    }
    return null;
  }
  async attentionParentReturnOffer(observation: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], decision: R | null): Promise<R | null> {
    if (!this.returnedAttention || !same(decision?.measured_facts?.pair_ref ?? null, this.returnedAttention.pair_ref)) return null;
    return this.acquireControlForTarget(observation, rows, inputs, decision);
  }
  /** Source movement contrasts consume the same acquired episode and current
   * snapshot as the other information questions. The meter is read, not advanced.
   */
  async currentMotionOffers(observation: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number,
    meter: R | null): Promise<R[]> {
    const scope = { actions: inputs, remaining_actions: remaining, remaining_meter_steps: meter?.steps_before_empty ?? null,
      preserve_cells: (observation as R).preserve_cells ?? [] };
    const current = this.goal.memory.snapshot(observation, rows);
    return (await motionOffers(this.goal.memory.episode, current, scope, observation)).map(candidate => ({ ...candidate, source: 'motion_contrast' }));
  }
  async currentInformationOffer(observation: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number,
    meter: R | null, decision: R | null = null): Promise<R | null> {
    return this.informationOffer(observation, rows, inputs, remaining, { meter, currentMotion: true, morphologyDecision: decision });
  }
  /** Elect only observed offers. Additional source producers enter as explicit inputs. */
  async informationOffer(observation: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number,
    options: { meter: R | null; additionalOffers?: readonly R[]; currentMotion?: boolean; morphologyDecision?: R | null;
      admit?: (candidate: R, receipt: R) => Promise<boolean> } = { meter: null }): Promise<R | null> {
    const policy = this.configuration.strategy.information_goal;
    const offers = (await this.points.offers(observation, inputs)).map(pointGoal);
    offers.push(...this.displays.offers(observation, rows, inputs, policy.coupled_displays), ...(options.additionalOffers ?? []));
    if (options.currentMotion) offers.push(...await this.currentMotionOffers(observation, rows, inputs, remaining, options.meter));
    const active = options.morphologyDecision ?? {};
    const pending = offers.length ? await this.acquireControlForTarget(observation, rows, inputs, active, { inspectOnly: true }) : null;
    for (const [candidate, receipt] of electInformationGoals(offers, observation, remaining, options.meter, policy)) {
      const sameControl = pending !== null && same(receipt.action, { action_ref: pending.action_ref });
      const preserveExposure = pending !== null && policy.preserve_current_exposures.includes(pending.experiment);
      if (policy.preserve_unbound_parent && receipt.return_steps === null && active.status === 'retained'
        && active.reason === this.configuration.strategy.acquire_control_for_target?.requires_reason && !sameControl && !preserveExposure) {
        this.deferred.push({ reason: 'unbound_return_from_the_current_role_acquisition_goal', proposed_action: receipt.action, parent: active.composition ?? null });
        continue;
      }
      if (pending !== null) {
        if (!sameControl && receipt.return_steps === null && preserveExposure) {
          const focus = await this.attention.open(pending, observation);
          if (focus && this.attention.matches(pending, observation)) {
            this.deferred.push({ reason: 'would_abandon_current_control_witness_without_bound_return', proposed_action: receipt.action,
              attention_ref: focus.id, preserved: pending });
            continue;
          }
        }
        if (sameControl) {
          receipt.also_tests_current_control = { ...pending };
          if (this.attention.matches(pending, observation)) receipt.also_tests_current_control.attention_ref = this.attention.item!.id;
        }
      }
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
    recordSelected: () => Promise<R | null> = async () => null, acquireBeforeView: () => void = () => {}): Promise<NativeCallerAcquisition> {
    this.restoredValues = null;
    this.effectfulInventory = null;
    const { before, after, command, first, second, index } = transition, question = proposal.question as R ?? {};
    const acquisition = question.control_acquisition ?? {}, shared = question.curiosity?.also_tests_current_control ?? {};
    const attention_result = this.attention.observe(before, after, command, acquisition.attention_ref || shared.attention_ref || null);
    acquireBeforeView();
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
    this.effectfulInventory = null;
    const receipt = await this.frontier.recordTransition(transition.before, transition.command, transition.after,
      { assessment, after_action_candidates: this.graphInputs(transition.after) });
    this.persistDeltas(transition.after); return receipt;
  }
  boundaryWitness(transition: NativeAuthorityTransition, proposal: NativeProposal, decisionRevision: number,
    stationHypothesisFor?: (method: R, witness: R) => R | null): R {
    this.restoredValues = null;
    const { before, after, command, index } = transition, template = proposal.bundle_template as R;
    const witness: R = { source_level: before.level_epoch, before_observation_ref: before.observation_ref, after_observation_ref: after.observation_ref,
      last_action: command, released_composition: template.composition_ref, committed_decision_revision: decisionRevision,
      executed_prefix_actions: index + 1, cancelled_suffix_actions: proposal.actions.length - index - 1,
      levels_completed_before: before.levels_completed, levels_completed_after: after.levels_completed, official_state: after.state,
      causal_terminal_role: 'unknown', qualification: 'observed official boundary/terminal witness, not a generalized winning recipe' };
    const method = targetMethodAtBoundary(proposal.composition_target_tree as R, witness);
    if (method) {
      const station = stationHypothesisFor?.(method, witness) ?? null;
      if (station) method.station_hypothesis = station;
      this.put('target_method', method, after); this.targetMethod = this.memory.get(EPISODE, 'target_method').value;
      witness.target_method = method;
    }
    this.put(`boundary_witness:${after.revision}`, witness, after); return witness;
  }
  /** Rebuild the original retained goal/frontier objects from verified events. */
  async replayBoundary(observation: NativeObservation): Promise<R> {
    this.restoredValues = null;
    this.effectfulInventory = null;
    const before = await compositionIdentity(this.goal.memory.retainedState()), goal = new ProspectiveContactAdapter();
    for (let sequence = 1; sequence <= this.goalEventCount; sequence += 1) {
      const record = this.memory.get(EPISODE, `goal_access_event:${sequence}`).value;
      if (await compositionIdentity(record.event) !== record.digest) throw new Error('Goal event digest changed');
      await goal.memory.applyEvent(record.event);
    }
    if (await compositionIdentity(goal.memory.retainedState()) !== before) throw new Error('Goal state did not restore from retained evidence');
    const frontier = new ObservedFrontier(this.configuration.targetLevels, 16, null, { nativeOwned: true });
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
  close(observation: NativeObservation, reason: string): void {
    this.restoredValues = null; this.effectfulInventory = null; this.attention.closePending(observation, reason);
  }
}
