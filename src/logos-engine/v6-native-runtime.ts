/**
 * Native migration runtime for explicitly registered V6 families.
 * This transfer boundary does not claim complete V6 router/V5 SRC parity.
 */
import { measureNativeObservation, ObservedInputDomain, v6Canonical } from './v6-native-observer.ts';
import type { LocusWitness, MeasuredObservation } from './v6-native-observer.ts';
import { OrderedSupportTransfer } from './v6-ordered-support.ts';
import type { OrderedSupportPolicy } from './v6-ordered-support.ts';
import { SymmetricField, WindowConstraints } from './v6-field-constraints.ts';
import type { FieldProposal, SymmetryPolicy } from './v6-field-constraints.ts';
import { VisualSequences } from './v6-visual-sequences.ts';
import { FeedbackSequences } from './v6-feedback-sequences.ts';
import type { FeedbackSequenceProposal } from './v6-feedback-sequences.ts';
import { OrbitConstraints } from './v6-orbit-constraints.ts';
import { Containment } from './v6-containment.ts';
import { SurfaceProgram } from './v6-surface-program.ts';
import { CodeProgram } from './v6-code-program.ts';
import { BandTransfer } from './v6-band-transfer.ts';
import { FramedTransfer } from './v6-framed-transfer.ts';
import { OutlineService } from './v6-outline-service.ts';
import { ReactiveContact } from './v6-reactive-contact.ts';
import { OrderedReaction } from './v6-ordered-reaction.ts';
import { ObservedInventory } from './v6-observed-inventory.ts';
import { TopologicalRecolor } from './v6-topological-recolor.ts';
import { RankedWorkshop } from './v6-ranked-workshop.ts';
import { SymbolTransactions } from './v6-symbol-transactions.ts';
import { ReductionTransport } from './v6-reduction-transport.ts';
import { retainedReductionSuccess, reductionAcquiredContinuationWitness, continuationProposalDigest,
  CONTINUATION_PROPOSAL_DIGEST_PROFILE } from './v6-acquired-continuation.ts';
import { createNativeSharedSeriesFamily, SHARED_SERIES_DIGEST_SCOPE } from './v6-shared-series.ts';
import { SupportNavigation } from './v6-support-navigation.ts';
import { JointTransport } from './v6-joint-transport.ts';
import { InvitedReduction } from './v6-invited-reduction.ts';
import { ContextualCompartments } from './v6-contextual-compartments.ts';
import { ConfiguredArrivals } from './v6-configured-arrivals.ts';
import { FixedOrigin } from './v6-fixed-origin.ts';
import { SubsetDiagnosis } from './v6-subset-diagnosis.ts';
import { PeriodicSums } from './v6-periodic-sums.ts';
import { ReflectedCover } from './v6-reflected-cover.ts';
import { OrientedCoupling } from './v6-oriented-coupling.ts';
import { MetricComposition } from './v6-metric-composition.ts';
import { SlidingCavity } from './v6-sliding-cavity.ts';
import { AnimatedContact } from './v6-animated-contact.ts';
import { LinkedTemporalPreparation, LINKED_TEMPORAL_NATIVE_SEARCH_BOUNDS } from './v6-linked-temporal-preparation.ts';
import { summaryReturnedPublicProbe, independentReturnedProbeSupport } from './v6-returned-probe-scope.ts';
import { symbolicDigest } from './v6-hash.ts';
import { TEMPORAL_FRAGMENT_NATIVE_INTERRUPTION } from './v5-temporal-fragment-match.ts';
import { createNativeInterfaceFamilies } from './v6-native-interface-families.ts';
import { NativeCallerCoordinator } from './v6-native-caller.ts';
import { NativeMorphologyFamily } from './v6-morphology-family.ts';
import { TYPED_MATERIAL_COMPOSITION_OWNER, retainTypedMaterialParent, revalidateTypedMaterialParent,
  consumeTypedMaterialParent, recordTypedMaterialParent, typedMaterialParentGuard, suspendTypedMaterialParent } from './v6-typed-material-composition.ts';
import type { VisualSequenceProposal } from './v6-visual-sequences.ts';
import { nativeProgramDescriptions } from './v6-src-program.ts';
import type { NativeSrcReceipt } from './v6-src-program.ts';
import { arrayValue, immutableJson, objectValue, stringValue } from './canonical.ts';
import { NativeKnowledgeStore, NATIVE_STORE_PROFILE } from './v6-knowledge-store.ts';
import type { NativeStoreWrite, StoredNativeProgram } from './v6-knowledge-store.ts';
import type { DeltaCause, KnowledgeMemory } from './kernel.ts';
import type { JsonValue } from './ir.ts';
import { NativeEditRejected } from './v6-native-types.ts';
import { NativeCompositionAuthority } from './v6-native-authority.ts';
import type {
  NativeAfterResult, NativeBudgets, NativeCommand, NativeExecution, NativeFamily, NativeInitialize, NativeObservation, NativeRows, NativeOutcome, NativeRecordResult,
  NativeAuthorizationIdentity, NativeGraphEdit, NativeProposal, NativePublicObservation, NativeRecord, NativeRuntimeSnapshot, NativeRuntimeYield, NativeV6Backend,
} from './v6-native-types.ts';

export const NATIVE_V6_REFERENCE_COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
export const NATIVE_V6_IMPLEMENTATION = 'logos-engine.typescript.v6.native-migration/0.53.0';
// The implementation identity and public snapshot describe the same extensions.
const NATIVE_CALLER_EXTENSIONS = ['native_feedback_search_cooperative_incompletion',
  'native_crossed_prefix_assignment_bounds', 'native_atomic_crossed_prefix_event_validation',
  'exact_crossed_prefix_zero_recolor_optimum', 'atomic_kernel_checkpoint_batching',
  'immutable_frontier_branches_with_delta_checkpoints',
  'blocking_current_proposal_refusal_preserves_selection_order',
  'bounded_linked_temporal_paths_with_current_deadline', 'single_owner_linked_temporal_passive_acquisition',
  TEMPORAL_FRAGMENT_NATIVE_INTERRUPTION,
  'atomic_framed_window_response_validation',
  'bounded_reference_population_paths_and_matching_with_current_level_deadline',
  'distinct_reception_service_and_exposed_event_owners',
  'current_epoch_reception_acquisition_and_stationary_revalidation',
  'bounded_cumulative_reception_wait_retained_as_unknown_on_exhaustion',
  'bounded_rooted_line_search_with_current_level_deadline',
  'current_observation_evidence_for_exposed_reception_proposals',
  'neutral_entity_domain_refusal_retained_as_unknown_without_registry_update',
  'retained_learned_preparation_before_unlearned_invitation', 'current_program_access_revalidation', 'measured_program_control_discovery',
  'conditional_program_relation_acquisition_and_validation', 'complete_homologous_aligned_mark_support',
  'bounded_labeled_predicate_composition_after_atomic_contradiction',
  'structural_cell_support_disambiguation_for_trace_marks',
  'immutable_linked_packet_emission_receipts',
  'current_acquired_continuation_before_unacquired_exploration',
  'kernel_correlated_official_success_for_current_continuation',
  'stationary_unlearned_contact_refusal_scope',
  'transient_returned_unlearned_contact_refusal_scope',
  'current_point_witness_rebind_for_equivalent_descriptions',
  'bounded_reduction_search_retained_as_unknown',
  'observed_stationary_reception_from_public_packet_frames',
  'current_uniform_reception_and_required_control_questions',
  'current_typed_analogy_control_prerequisite_question',
  'observed_reception_after_support_motion_settles',
  'current_directed_intermediate_receiver_composition',
  'v5_current_required_service_before_independent_contact_question',
  'untried_acquired_public_context_required_for_service_priority',
  'outline_measurement_domain_refusal_retained_as_unknown',
  'current_required_service_witness_on_every_selection_path',
  'observed_current_epoch_final_raster_effect_inventory',
  'current_public_announcement_context_and_required_local_operator',
  'source_declared_rejoin_and_capture_current_questions',
  'current_unique_announced_access_one_primitive_composition',
  'current_unique_recalled_outline_control_conditional_revalidation',
  'bounded_previous_relation_current_observed_body_access',
  'observed_access_arrival_conditional_historical_local_test',
  'retained_typed_material_request_parent',
  'explicit_current_morphology_producer_scope',
  'bounded_exposed_reception_assignment_and_push_work_retained_as_incomplete'] as const;
const SELECTION_PROGRAM = 'v6.composition_strategy.choose';
type R = Record<string, any>;
const EPISODE = 'common-observation-frontier';
const CONTACT_SCOPE_NODE = 'native_contact_probe_scope:animated_contact';
const CALLER_COMPONENTS = ['goal', 'frontier', 'view', 'attention', 'points', 'displays', 'controls', 'counters'] as const;
const CALLER_PROVIDERS = ['goal_access', 'pre_score_contact', 'scored_local_rewrite', 'factored_material_return', 'conditional_transit',
  'attention_parent_return', 'returned_branch_contrast', 'information_goal', 'acquire_control_for_target', 'view', 'view_continuity', 'observed_frontier'] as const;
function familyCheckpoint(family: NativeFamily): NativeRecord {
  return family.nativeState && family.restoreNative ? family.nativeState() : family.state();
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
interface WitnessedTransition {
  command: NativeCommand; before: MeasuredObservation; after: MeasuredObservation;
  first: NativePublicObservation; second: NativePublicObservation; index: number; outcome: NativeAfterResult;
}
interface Prefix {
  family: NativeFamily; proposal: NativeProposal; revision: number; index: number; witnessed: WitnessedTransition[];
  released: boolean; interruption: string | null;
  nativeBindings: NativeRecord[];
}
export interface NativeSelectionGroup {
  readonly id: string;
  readonly families: readonly string[];
  /** Aligned with families, without adding duplicate memory/activation owners. */
  readonly entryPoints?: readonly (string | null)[];
}
/** Feedback alone admits source passive returns without a selected proposal. */
export interface NativeFeedbackFamily extends NativeFamily {
  record(before: NativeObservation, after: NativeObservation, command: NativeCommand,
    firstRows: NativeRows, secondRows: NativeRows, proposal?: NativeProposal, index?: number,
    frames?: readonly NativeRows[]): Promise<NativeRecordResult>;
}
export interface NativeV6RuntimeConfiguration {
  sourceDigest: string; families: readonly NativeFamily[]; maxPointOccurrences: number; now?: () => number;
  /** Source DRM groups retain their order even while some implementations are pending. */
  groups?: readonly NativeSelectionGroup[];
  /** Production supplies the original objective policy and enables the real WHY/ACT gate. */
  authorityPolicy?: { provided_objective: { definition: string } };
  /** Same source policy drives the native common caller's retained components. */
  callerStrategy?: R;
  /** The same registered instances acquire passive evidence in source order. */
  acquisitionFamilies?: { supports: SupportNavigation; recall: NativeFamily; framed?: FramedTransfer; outline?: OutlineService; inventory?: ObservedInventory; reaction?: OrderedReaction; reactive?: ReactiveContact; recolor?: TopologicalRecolor; workshop?: RankedWorkshop; symbols?: SymbolTransactions; morphology?: NativeMorphologyFamily; feedback?: NativeFeedbackFamily; preparations?: LinkedTemporalPreparation };
}

export class NativeV6Runtime implements NativeV6Backend {
  readonly sourceCommit = NATIVE_V6_REFERENCE_COMMIT;
  readonly sourceDigest: string;
  private readonly families: readonly NativeFamily[];
  private readonly groups: readonly NativeSelectionGroup[];
  private readonly domain: ObservedInputDomain;
  private readonly now: () => number;
  private readonly authorityPolicy?: { provided_objective: { definition: string } };
  private authority: NativeCompositionAuthority | null = null;
  private caller: NativeCallerCoordinator | null = null;
  private readonly callerStrategy?: R;
  private readonly acquisitionFamilies?: { supports: SupportNavigation; recall: NativeFamily; framed?: FramedTransfer; outline?: OutlineService; inventory?: ObservedInventory; reaction?: OrderedReaction; reactive?: ReactiveContact; recolor?: TopologicalRecolor; workshop?: RankedWorkshop; symbols?: SymbolTransactions; morphology?: NativeMorphologyFamily; feedback?: NativeFeedbackFamily; preparations?: LinkedTemporalPreparation };
  private callerAcquisitions = 0;
  private callerBoundaryReplays = 0;
  private sessionId = '';
  private budgets: NativeBudgets | null = null;
  private current: NativePublicObservation | null = null;
  private observation: MeasuredObservation | null = null;
  private prefix: Prefix | null = null;
  private actions = 0;
  private revision = 0;
  private cycles = 0;
  private levelActions = new Map<number, number>();
  private levelMs = new Map<number, number>();
  private elapsedMs = 0;
  private computeStart: number | null = null;
  private computeLevel = 1;
  private kind: NativeRuntimeYield['kind'] = 'boundary';
  private reason: string | null = null;
  private closed = false;
  private initialized = false;
  private editing = false;
  private trace: NativeRecord[] = [];
  // These observations are counters, not reasoning owners. The authoritative
  // acquisitions and compositions already live in the knowledge graph. Keeping
  // another complete copy here retained every old prefix for the whole session.
  private acquiredRecordCount = 0;
  private compositionIds = new Set<string>();
  private lastFamily: string | null = null;
  private knowledge: NativeKnowledgeStore | null = null;
  private executionDigest: string | null = null;
  private selectionProgram: StoredNativeProgram | null = null;
  private selectionReceipt: NativeSrcReceipt | null = null;
  private planning: { execution: NativeExecution; inputs: readonly NativeCommand[];
    offers: Map<string, { family: NativeFamily; proposal: NativeProposal } | null>;
    entryOffers: Map<string, NativeProposal | null>; coordination: R[]; refusals: R[] } | null = null;

  constructor(configuration: NativeV6RuntimeConfiguration) {
    if (!configuration.sourceDigest || !configuration.families.length
      || new Set(configuration.families.map(f => f.id)).size !== configuration.families.length
      || configuration.families.some(f => typeof f.restore !== 'function')) throw new TypeError('A native implementation identity and distinct state-restorable families are required');
    this.sourceDigest = configuration.sourceDigest;
    this.callerStrategy = configuration.callerStrategy ? structuredClone(configuration.callerStrategy) : undefined;
    this.acquisitionFamilies = configuration.acquisitionFamilies;
    if (this.callerStrategy && !configuration.authorityPolicy) throw new TypeError('The common caller requires native WHY/ACT authority');
    this.families = [...configuration.families, ...(this.callerStrategy ? nativeCallerFamilies(() => {
      if (!this.caller) throw new Error('The common caller is not initialized'); return this.caller;
    }, () => this.acquisitionFamilies?.inventory?.callerMeterForecast() ?? null,
    observation => this.acquisitionFamilies?.morphology?.currentDecision(observation) ?? null) : [])];
    if (this.acquisitionFamilies && (!this.callerStrategy || ![this.acquisitionFamilies.supports, this.acquisitionFamilies.recall,
      ...(this.acquisitionFamilies.framed ? [this.acquisitionFamilies.framed] : []),
      ...(this.acquisitionFamilies.outline ? [this.acquisitionFamilies.outline] : []),
      ...(this.acquisitionFamilies.inventory ? [this.acquisitionFamilies.inventory] : []),
      ...(this.acquisitionFamilies.reaction ? [this.acquisitionFamilies.reaction] : []),
      ...(this.acquisitionFamilies.reactive ? [this.acquisitionFamilies.reactive] : []),
      ...(this.acquisitionFamilies.recolor ? [this.acquisitionFamilies.recolor] : []),
      ...(this.acquisitionFamilies.workshop ? [this.acquisitionFamilies.workshop] : []),
      ...(this.acquisitionFamilies.symbols ? [this.acquisitionFamilies.symbols] : []),
      ...(this.acquisitionFamilies.morphology ? [this.acquisitionFamilies.morphology] : []),
      ...(this.acquisitionFamilies.feedback ? [this.acquisitionFamilies.feedback] : []),
      ...(this.acquisitionFamilies.preparations ? [this.acquisitionFamilies.preparations] : []),
      ...Object.values(this.acquisitionFamilies.supports.acquiredCompositions)].every(family => this.families.some(registered => registered.id === family.id)))) {
      throw new TypeError('Passive acquisition requires the registered common caller families');
    }
    if (this.acquisitionFamilies?.workshop && !this.families.includes(this.acquisitionFamilies.workshop)) {
      throw new TypeError('Ranked workshop passive acquisition requires its single registered owner');
    }
    if (this.acquisitionFamilies?.symbols && !this.families.includes(this.acquisitionFamilies.symbols)) {
      throw new TypeError('Symbol transaction state retention requires its single registered owner');
    }
    this.acquisitionFamilies?.inventory?.enableCallerContext(() => {
      if (!this.caller) throw new Error('Inventory context requires the initialized common caller');
      return this.caller.goal.memory.models;
    });
    this.acquisitionFamilies?.morphology?.enableCallerContext({
      goal: () => { if (!this.caller) throw new Error('Morphology requires the initialized common caller'); return this.caller.goal.memory; },
      forecast: () => this.acquisitionFamilies?.inventory?.callerMeterForecast() ?? null,
      observe: (obs, rows) => this.acquisitionFamilies?.inventory?.observeCallerContext(obs, rows),
      collection: () => this.acquisitionFamilies?.inventory?.callerCollectionEvidence() ?? null,
      targetMethod: () => this.caller?.targetMethod ?? null,
    });
    this.groups = structuredClone(configuration.groups ?? this.families.map(family => ({ id: family.id, families: [family.id] })));
    if (!this.groups.length || this.groups.length > 16 || new Set(this.groups.map(group => group.id)).size !== this.groups.length
      || this.groups.some(group => group.families.some(id => !this.families.some(family => family.id === id)))) throw new TypeError('Native selection requires 1–16 declared groups of registered families');
    if (this.groups.some(group => group.entryPoints && (group.entryPoints.length !== group.families.length
      || group.entryPoints.some((entry, index) => entry !== null && (typeof entry !== 'string' || !entry
        || !this.families.find(family => family.id === group.families[index])?.proposeInSubquestion))))) {
      throw new TypeError('Native source entries require an aligned subquestion adapter on their single family owner');
    }
    this.domain = new ObservedInputDomain(configuration.maxPointOccurrences); this.now = configuration.now ?? (() => performance.now());
    this.authorityPolicy = configuration.authorityPolicy ? structuredClone(configuration.authorityPolicy) : undefined;
  }
  private check(execution: NativeExecution): void {
    if (execution.signal?.aborted) throw new DOMException('Native reasoning cancelled', 'AbortError');
    if (this.closed) throw new Error('The native reasoning session is closed');
  }
  private note(value: NativeRecord): void { this.trace.push(freeze(structuredClone(value))); this.trace = this.trace.slice(-128); }
  private runningMs(level?: number): number {
    return this.computeStart !== null && (level === undefined || level === this.computeLevel) ? Math.max(0, this.now() - this.computeStart) : 0;
  }
  private async timed(level: number, operation: () => Promise<void>): Promise<void> {
    if (this.computeStart !== null) throw new Error('Native reasoning operations cannot overlap');
    this.computeLevel = level; this.computeStart = this.now();
    try { await operation(); }
    finally {
      const duration = Math.max(0, this.now() - this.computeStart);
      this.elapsedMs += duration; this.levelMs.set(level, (this.levelMs.get(level) ?? 0) + duration); this.computeStart = null;
    }
  }
  private budgetReason(): string | null {
    if (!this.current || !this.budgets) return 'not_initialized';
    if (this.current.levels_completed >= this.budgets.targetLevels) return 'target_levels_completed';
    if (['WIN', 'GAME_OVER', 'LEVEL_COMPLETE'].includes(this.current.state)) return `native_${this.current.state.toLowerCase()}`;
    const total = this.budgets.maxActions ?? this.budgets.levelActionCaps.reduce((sum, cap) => sum + cap, 0);
    if (this.actions >= total) return 'session_action_budget';
    const cap = this.budgets.levelActionCaps[this.current.level - 1];
    if (cap === undefined || (this.levelActions.get(this.current.level) ?? 0) >= cap) return 'level_action_budget';
    if ((this.levelMs.get(this.current.level) ?? 0) + this.runningMs(this.current.level) >= 360_000) return 'level_active_time_budget';
    return null;
  }
  private remaining(): number {
    if (!this.current || !this.budgets) return 0;
    const total = this.budgets.maxActions ?? this.budgets.levelActionCaps.reduce((sum, cap) => sum + cap, 0);
    return Math.max(0, Math.min(total - this.actions, (this.budgets.levelActionCaps[this.current.level - 1] ?? 0) - (this.levelActions.get(this.current.level) ?? 0)));
  }
  private stop(reason: string): void { this.kind = 'stopped'; this.reason = reason; this.note({ kind: 'stop', reason }); }

  async initialize(input: NativeInitialize, execution: NativeExecution): Promise<NativeRuntimeYield> {
    if (this.initialized) throw new Error('Native runtime already initialized');
    this.check(execution);
    if (input.observation.level !== 1 || input.observation.levels_completed !== 0 || input.observation.step_index !== 0) throw new Error('Native V6 must begin at level 1');
    this.initialized = true; this.sessionId = input.sessionId; this.current = freeze(structuredClone(input.observation)); this.budgets = freeze(structuredClone(input.budgets));
    await this.timed(this.current.level, async () => {
      this.knowledge = new NativeKnowledgeStore(this.sourceDigest, this.sessionId);
      await this.knowledge.commit(this.families.flatMap(family => [
        { id: `family_state:${family.id}`, kind: 'family_state' as const, family: family.id, value: familyCheckpoint(family),
          relations: [{ relation: 'controlled_by', target: `family_activation:${family.id}` }] },
        { id: `family_activation:${family.id}`, kind: 'family_activation' as const, family: family.id, status: 'active' as const, value: { enabled: true } },
      ]), { workflow: SELECTION_PROGRAM, step: 'initialize', statement: 'family.install' });
      if (this.families.some(family => family.id === 'animated_contact')) await this.knowledge.commit([
        { id: CONTACT_SCOPE_NODE, kind: 'transition_evidence', component: 'native_contact_probe_scope',
          status: 'retained', value: { status: 'unobserved' } },
      ], { workflow: SELECTION_PROGRAM, step: 'initialize', statement: 'native.contact_scope.install' });
      for (const family of this.families) await family.attachPrograms?.(this.knowledge);
      this.observation = freeze(await measureNativeObservation(this.current!, 1, this.sessionId));
      if (this.authorityPolicy) {
        this.authority = new NativeCompositionAuthority(this.authorityPolicy, input.budgets.targetLevels);
        await this.authority.initialize(this.knowledge, this.observation);
      }
      if (this.callerStrategy) {
        this.caller = new NativeCallerCoordinator(this.authority!.memory, { targetLevels: input.budgets.targetLevels,
          domain: this.domain, strategy: this.callerStrategy, informationGoal: 'accessible_view_frontier' });
        await this.caller.initialize(this.observation);
        await this.persistFamilies({ workflow: SELECTION_PROGRAM, step: 'initialize', statement: 'caller.install' }, this.authority!.checkpointWrites());
      }
      await this.plan(execution);
    });
    return this.output();
  }

  private async plan(execution: NativeExecution): Promise<void> {
    this.check(execution);
    const reason = this.budgetReason();
    if (reason) { this.stop(reason); return; }
    if (!this.current || !this.observation) throw new Error('No public native observation');
    // Family instances are working copies. Persisted nodes, not object caches,
    // determine every new plan, including across natural level transitions.
    this.restoreFamilies();
    this.authority?.restore();
    if (this.caller && this.knowledge) this.caller.restoreFrom(this.knowledge);
    const parentOwner = this.typedMaterialParentFamily();
    if (parentOwner && this.caller) {
      const validation = revalidateTypedMaterialParent(this.caller.attention, parentOwner.compositionDependencyState!(),
        this.observation, this.current.frame_rows);
      if (validation && !validation.admitted) {
        this.note({ kind: 'native_composition_dependency', ...validation });
        await this.persistFamilies({ workflow: SELECTION_PROGRAM, step: 'selection', statement: 'native.parent.suspend' }, this.authority?.checkpointWrites() ?? []);
        this.stop(`composition_dependency_${validation.reason}`); return;
      }
    }
    const inputs = this.domain.candidates(this.observation);
    const obligations = (await Promise.all(this.families.map(family => family.preservationObligations?.(this.observation!, this.current!.frame_rows) ?? []))).flat();
    let selected = await this.selectAdmittedFamily(execution, inputs);
    if (selected && this.caller) {
      let [protectedProposal, rejected] = this.caller.protect(selected.proposal, obligations, this.observation, this.current.frame_rows);
      if (rejected.length) {
        const revisionInputs = new Set(obligations.flatMap(obligation => (obligation.revision_inputs ?? []) as string[]));
        selected = await this.selectAdmittedFamily(execution, inputs.filter(command => !revisionInputs.has(command.action_ref)));
        if (selected) {
          const [alternative, conflicts] = this.caller.protect(selected.proposal, obligations, this.observation, this.current.frame_rows);
          protectedProposal = { ...alternative, preservation_rejected_candidates: rejected,
            ...(conflicts.length ? { status: 'preservation_conflict', actions: [] } : {}) };
        }
      }
      if (selected) selected = { ...selected, proposal: protectedProposal as NativeProposal };
    }
    if (selected) {
      const { family } = selected; let { proposal } = selected;
      if (proposal.status !== 'proposed') {
        await this.persistFamilies({ workflow: SELECTION_PROGRAM, step: 'selection', statement: 'source.refusal' }, this.authority?.checkpointWrites() ?? []);
        this.stop(`frontier_${proposal.status ?? 'unknown'}`); return;
      }
      // Source selection still chooses the family/entry. This explicit native
      // facade constrains its material question to the pending parent instead
      // of letting a newly matching request silently replace that obligation.
      if (this.caller && this.typedMaterialParentFamily() === family && (proposal.material_pose_plan || proposal.material_flow_plan)) {
        const replacement = await family.proposeForRetainedComposition?.(this.caller.attention.composition!.binding,
          this.observation, this.current.frame_rows, inputs, this.remaining(), execution);
        if (replacement) {
          const sourceReceipt = proposal.strategy_receipt as R | undefined;
          replacement.strategy_receipt = { ...structuredClone(sourceReceipt ?? {}), native_coordination: [
            ...(sourceReceipt?.native_coordination ?? []), {
              rule: 'retained_typed_material_request_parent', parent_ref: this.caller.attention.composition!.id,
              source_proposal_ref: proposal.proposal_id, constrained_proposal_ref: replacement.proposal_id,
              observation_ref: this.observation.observation_ref, source_family_selection_preserved: true, release_authority: false,
            }] };
          replacement.morphology = structuredClone(proposal.morphology);
        }
        const [protectedReplacement, conflicts] = replacement ? this.caller.protect(replacement, obligations, this.observation, this.current.frame_rows) : [null, []];
        if (!protectedReplacement || conflicts.length) {
          const result = suspendTypedMaterialParent(this.caller.attention, this.observation,
            conflicts.length ? 'retained_parent_preservation_conflict' : 'no_current_path_to_retained_request');
          if (result) this.note({ kind: 'native_composition_dependency', ...result });
          await this.persistFamilies({ workflow: SELECTION_PROGRAM, step: 'selection', statement: 'native.parent.suspend' }, this.authority?.checkpointWrites() ?? []);
          this.stop(`composition_dependency_${result?.reason ?? 'retained_owner_unavailable'}`); return;
        }
        proposal = protectedReplacement as NativeProposal;
      }
      if (!Array.isArray(proposal.actions) || proposal.actions.length < 1 || proposal.actions.length > Math.min(16, this.remaining())
        || !Array.isArray(proposal.steps) || proposal.steps.length !== proposal.actions.length) throw new Error(`Invalid committed prefix from ${family.id}`);
      await family.bind?.(proposal, this.domain);
      for (const step of proposal.steps) if (step.locus_witness && !step.point_binding) step.point_binding = structuredClone(step.locus_witness);
      if (this.caller && family.compositionDependencyState && (proposal.material_pose_plan
        || proposal.material_flow_plan && this.typedMaterialParentFamily() === family)) {
        const state = family.compositionDependencyState();
        const retained = await retainTypedMaterialParent(this.caller.attention, state, proposal, this.observation, this.current.frame_rows);
        const consumed = retained?.admitted === false ? retained
          : consumeTypedMaterialParent(this.caller.attention, state, proposal, this.observation, this.current.frame_rows);
        if (retained) this.note({ kind: 'native_composition_dependency', ...retained });
        if (consumed) this.note({ kind: 'native_composition_dependency', ...consumed });
        if (consumed?.admitted === false) {
          await this.persistFamilies({ workflow: SELECTION_PROGRAM, step: 'selection', statement: 'native.parent.suspend' }, this.authority?.checkpointWrites() ?? []);
          this.stop(`composition_dependency_${consumed.reason}`); return;
        }
      }
      if (this.authority) {
        await this.persistFamilies({ workflow: SELECTION_PROGRAM, step: 'selection', statement: 'caller.prepare' }, this.authority.checkpointWrites());
        const target = await this.authority.bind(proposal, this.observation);
        if (!target.admitted) { this.stop(`composition_target_${target.reason}`); return; }
      }
      this.revision = this.observation.revision;
      this.prefix = { family, proposal: freeze(structuredClone(proposal)), revision: this.revision, index: 0, witnessed: [], released: false, interruption: null, nativeBindings: [] };
      this.lastFamily = family.id;
      for (const composition of proposal.compositions ?? []) if (typeof composition.id === 'string') this.compositionIds.add(composition.id);
      this.note({ kind: 'proposal', family: family.id, revision: this.revision, actions: proposal.actions, question: proposal.question ?? null });
      if (!await this.authorize(execution)) this.stop(this.budgetReason() ?? 'no_admissible_prefix');
      return;
    }
    await this.persistFamilies({ workflow: SELECTION_PROGRAM, step: 'selection', statement: 'no_candidate' }, this.authority?.checkpointWrites() ?? []);
    this.stop('no_applicable_transferred_family');
  }

  /** The one existing attention owner retains only the parent obligation. No
   * material state is read on paths without an active material parent. */
  private typedMaterialParentFamily(): NativeFamily | null {
    const item = this.caller?.attention.composition;
    if (item?.owner !== TYPED_MATERIAL_COMPOSITION_OWNER || item.status !== 'pending') return null;
    const family = this.families.find(value => value.id === item.binding?.family_id && value.compositionDependencyState);
    if (!family) throw new Error('Retained material parent has no registered acquired owner');
    return family;
  }

  /** Every selection helper converges here before preservation/binding. A
   * marked native service cannot bypass its current trial gate through a
   * different coordination helper. A refused offer is never dispatched. */
  private async selectAdmittedFamily(execution: NativeExecution, inputs: readonly NativeCommand[]): Promise<{ family: NativeFamily; proposal: NativeProposal } | null> {
    const selected = await this.selectFamily(execution, inputs);
    if (!selected || selected.proposal.requires_current_service_witness !== true) return selected;
    const admitted = await this.admitCurrentRequiredService(selected.family, selected.proposal);
    if (admitted) return { family: selected.family, proposal: admitted.proposal };
    this.note({ kind: 'native_proposal_refusal', family: selected.family.id,
      rule: 'current_required_service_witness_on_every_selection_path', observation_ref: this.observation!.observation_ref,
      status: 'unknown', release_authority: false, reason: 'final_current_service_trial_or_guard_not_admitted' });
    return null;
  }

  /** Original V6 family-selection SRC tree, interpreted by the V7 TS engine. */
  private async selectFamily(execution: NativeExecution, inputs: readonly NativeCommand[]): Promise<{ family: NativeFamily; proposal: NativeProposal } | null> {
    if (!this.current || !this.observation) throw new Error('Missing current selection context');
    this.caller?.prepare(this.observation, this.remaining());
    this.acquisitionFamilies?.morphology?.beginDecision();
    const remainingActiveMs = Math.max(0, 360_000 - (this.levelMs.get(this.current.level) ?? 0) - this.runningMs(this.current.level));
    this.planning = { execution: { ...execution, now: this.now, deadlineMs: this.now() + remainingActiveMs },
      inputs, offers: new Map(), entryOffers: new Map(), coordination: [], refusals: [] };
    try {
      if (!this.knowledge) throw new Error('Native knowledge store is not initialized');
      this.selectionProgram ??= await this.knowledge.registerProgram(SELECTION_PROGRAM, {
        'families.begin': () => ({ pending: true, done: false, index: 0, progress: 0, visited: [] }),
        'families.offer': async (args): Promise<JsonValue> => {
          const session = objectValue(args.session), index = session.index;
          if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0 || index >= this.groups.length || !this.planning || !this.current || !this.observation) throw new Error('Invalid native family selection cursor');
          const group = this.groups[index]!;
          this.check(this.planning.execution); await this.planning.execution.yieldControl(); this.check(this.planning.execution);
          let offered: { family: NativeFamily; proposal: NativeProposal } | null = null;
          for (const [entryIndex, id] of group.families.entries()) {
            const family = this.families.find(candidate => candidate.id === id)!;
            const enabled = objectValue(this.knowledge!.value(`family_activation:${family.id}`)).enabled === true;
            const entry = group.entryPoints?.[entryIndex];
            const entryKey = `${group.id}:${family.id}:${entry}`;
            let proposal = !enabled ? null : this.planning.entryOffers.has(entryKey)
              ? this.planning.entryOffers.get(entryKey)! : entry
              ? await family.proposeInSubquestion!(group.id, entry, this.observation, this.current.frame_rows,
                this.planning.inputs, this.remaining(), this.planning.execution)
              : family.proposeInGroup
              ? await family.proposeInGroup(group.id, this.observation, this.current.frame_rows, this.planning.inputs, this.remaining(), this.planning.execution)
              : await family.propose(this.observation, this.current.frame_rows, this.planning.inputs, this.remaining(), this.planning.execution);
            if (proposal?.requires_current_service_witness === true) {
              const admitted = await this.admitCurrentRequiredService(family, proposal);
              if (!admitted) {
                const refusal = { family: family.id, group: group.id, entry: entry ?? null,
                  source_state_ref: `family_state:${family.id}`, refusal: {
                    rule: 'current_required_service_witness_on_every_selection_path',
                    observation_ref: this.observation.observation_ref, level_epoch: this.observation.level_epoch,
                    frame_hash: this.observation.frame_hash, status: 'unknown', release_authority: false,
                    reason: 'current_service_trial_or_guard_not_admitted' } };
                this.planning.refusals.push(refusal); this.note({ kind: 'native_proposal_refusal', ...refusal });
                continue;
              }
              proposal = admitted.proposal;
            }
            if (family.id === 'morphology') {
              const measured = this.acquisitionFamilies?.morphology?.currentMeasurementReceipt(this.observation);
              if (measured) this.note({ kind: 'morphology_measurement', ...measured });
            }
            if (enabled && !proposal) {
              const refusal = this.retainProposalRefusal(family, group.id, entry ?? null);
              if (refusal?.block_unrelated_probe === true) {
                // The current owner explicitly retained an unanswered bounded
                // question. Preserve its place in source order: lower-priority
                // probes cannot turn that unknown result into action authority.
                offered = { family, proposal: { ...refusal, status: 'unknown',
                  kind: 'native_current_proposal_refusal', actions: [], steps: [] } };
                break;
              }
            }
            if (proposal && group.id === 'goal_access'
              && (await this.deferUnlearnedInvitation(proposal) || await this.scopeStationaryContactRefusal(family, proposal)
                || await this.scopeReturnedContactRefusal(family, proposal))) continue;
            if (proposal) {
              const preferred = await this.preferCurrentRequiredService(index, entryIndex, family, proposal)
                ?? await this.preferAcquiredContinuation(index, entryIndex, family, proposal);
              if (preferred) {
                this.planning.offers.set(preferred.group, preferred.offer);
                return { family: preferred.group, selected: true, source_trigger_group: group.id };
              }
              offered = { family, proposal }; break;
            }
          }
          this.planning.offers.set(group.id, offered);
          return { family: group.id, selected: offered !== null };
        },
        'families.finish': args => {
          const session = objectValue(args.session), trial = objectValue(args.trial);
          return { ...session, pending: false, done: true, progress: Number(session.progress) + 1,
            selected: stringValue(trial.family), visited: [...arrayValue(session.visited), trial.source_trigger_group ?? trial.family!] };
        },
        'families.advance': args => {
          const session = objectValue(args.session), index = Number(session.index) + 1;
          return { ...session, index, progress: index, pending: index < this.groups.length, done: index === this.groups.length,
            visited: [...arrayValue(session.visited), this.groups[index - 1]!.id] };
        },
      });
      this.executionDigest ??= await this.knowledge.executionDigest();
      const selected = await this.selectionProgram.run({ request: this.observation.observation_ref }, { signal: execution.signal });
      this.selectionReceipt = selected.receipt;
      this.note({ kind: 'src_selection', workflow: selected.receipt.workflow, src_hash: selected.receipt.src_hash,
        source_definition_hash: selected.receipt.source_definition_hash, native_execution_hash: selected.receipt.native_execution_hash,
        graph_chain: this.knowledge.graphChain, edited: selected.receipt.edited,
        instructions: selected.receipt.instructions, executed_statements: selected.receipt.executed_statements });
      const result = objectValue(selected.result);
      if (typeof result.selected !== 'string') return null;
      const offered = this.planning.offers.get(result.selected);
      if (!offered) throw new Error('The SRC selection does not bind an offered native family');
      if (this.caller) {
        offered.proposal.strategy_receipt = { ...selected.receipt, visited: result.visited, selected: result.selected, deferred_curiosity: this.caller.deferredCuriosity,
          ...(this.planning.coordination.length ? { native_coordination: this.planning.coordination } : {}),
          ...(this.planning.refusals.length ? { native_proposal_refusals: this.planning.refusals } : {}),
          ...(this.caller.returnedAttention ? { attention_return: Object.fromEntries(['id', 'status', 'parent', 'pair_ref', 'returned_at'].map(key => [key, this.caller!.returnedAttention![key]])) } : {}) };
        offered.proposal.morphology = this.acquisitionFamilies?.morphology?.currentDecision(this.observation)
          ?? { status: 'not_evaluated', reason: 'prior_family_selected' };
      }
      return offered;
    } finally { this.planning = null; }
  }

  /** Retain a current computation limit without turning it into a refutation. */
  private retainProposalRefusal(family: NativeFamily, group: string, entry: string | null): R | null {
    if (!this.planning || !this.observation) return null;
    const refusal = family.currentProposalRefusal?.(this.observation);
    if (!refusal) return null;
    if (refusal.observation_ref !== this.observation.observation_ref || refusal.level_epoch !== this.observation.level_epoch
      || refusal.frame_hash !== this.observation.frame_hash || refusal.release_authority !== false) {
      throw new TypeError('A native proposal refusal must bind the current observation without action authority');
    }
    const retained = { family: family.id, group, entry, source_state_ref: `family_state:${family.id}`, refusal: structuredClone(refusal) };
    this.planning.refusals.push(retained); this.note({ kind: 'native_proposal_refusal', ...retained });
    return retained.refusal;
  }

  /**
   * Corroborate an owner's preflight reference against actual Kernel receipts.
   * Source boundary labels alone do not prove a score increase. The same owner
   * can host several entries, so the acquired prefix also binds the exact
   * entry and proposal kind. Nothing here transfers a prior coordinate law.
   */
  private acquiredContribution(family: NativeFamily, retained: R, entry: string | null): R | null {
    if (!this.knowledge || !this.current || !this.observation
      || (entry !== null && retained.source_entry !== undefined && retained.source_entry !== entry)) return null;
    const prefixes = Object.values(this.knowledge.memory.nodes).filter(node => node.kind === 'prefix_evidence' && node.family === family.id).reverse();
    for (const node of prefixes) {
      const prefix = this.knowledge.value(node.id) as R, proposal = prefix.proposal;
      if (!proposal || proposal.status !== 'proposed' || !Array.isArray(prefix.transitions)
        || !Array.isArray(prefix.composed_reconciliation?.boundary_refs)) continue;
      const sourceGroup = this.groups.find(group => group.id === proposal.strategy_receipt?.selected);
      const ownerIndices = sourceGroup?.families.flatMap((id, index) => id === family.id ? [index] : []) ?? [];
      // A single declared owner entry is unambiguous even for a provider whose
      // proposal has no subquestion field. A shared owner must name its entry.
      const sourceEntry = proposal.material_access_subquestion ?? proposal.program_subquestion ?? proposal.field_subquestion
        ?? (ownerIndices.length === 1 ? sourceGroup!.entryPoints?.[ownerIndices[0]!] ?? null : null);
      if ((entry !== null && sourceEntry !== entry)
        || (retained.source_entry !== undefined && retained.source_entry !== sourceEntry)
        || (retained.source_kind !== undefined && retained.source_kind !== proposal.kind)) continue;
      const references = prefix.composed_reconciliation.boundary_refs.filter((reference: R) => reference.after === retained.success_ref);
      if (references.length !== 1) continue;
      const reference = references[0], transitionNode = this.knowledge.memory.nodes[reference.node];
      if (!transitionNode || transitionNode.kind !== 'transition_evidence' || transitionNode.component !== 'public_transition'
        || transitionNode.status !== 'observed') continue;
      const transition = this.knowledge.value(transitionNode.id) as R, boundary = transition.boundary_witness;
      const ownedIndex = prefix.transitions.findIndex((item: R) => item.before === reference.before && item.after === reference.after);
      const owned = prefix.transitions[ownedIndex], sourceComposition = proposal.bundle_template?.composition_ref;
      if (ownedIndex < 0 || transition.status !== 'official_boundary_witness' || !boundary
        || !Number.isSafeInteger(boundary.levels_completed_before) || boundary.levels_completed_before < 0
        || !Number.isSafeInteger(boundary.levels_completed_after)
        || boundary.levels_completed_after <= boundary.levels_completed_before
        || boundary.levels_completed_after !== retained.score || retained.score !== this.current.levels_completed
        || transition.levels_completed !== boundary.levels_completed_after
        || transition.before !== reference.before || transition.after !== reference.after
        || boundary.before_observation_ref !== reference.before || boundary.after_observation_ref !== reference.after
        || !Number.isSafeInteger(prefix.decision_revision) || node.id !== `prefix_evidence:${prefix.decision_revision}`
        || boundary.committed_decision_revision !== prefix.decision_revision
        || typeof sourceComposition !== 'string' || !sourceComposition
        || boundary.released_composition !== sourceComposition
        || prefix.composed_reconciliation.released_composition_ref !== sourceComposition
        || boundary.executed_prefix_actions !== ownedIndex + 1
        || v6Canonical(transition.command) !== v6Canonical(owned.command)
        || v6Canonical(boundary.last_action) !== v6Canonical(owned.command)
        || v6Canonical(proposal.actions[ownedIndex]) !== v6Canonical(owned.command)) continue;
      return { status: 'acquired_official_contribution', family: family.id, entry: sourceEntry,
        proposal_kind: proposal.kind, source_proposal_ref: proposal.proposal_id ?? sourceComposition,
        released_composition_ref: sourceComposition, committed_decision_revision: prefix.decision_revision,
        prefix_evidence_ref: node.id, prefix_evidence_revision: node.revision,
        transition_ref: transitionNode.id, transition_revision: transitionNode.revision,
        before_observation_ref: reference.before, after_observation_ref: reference.after,
        levels_completed_before: boundary.levels_completed_before, levels_completed_after: boundary.levels_completed_after,
        acquired_command: transition.command, causal_terminal_role: 'unknown', primitive_release_authorized: false,
        qualification: 'The actual selected prefix and acquired public transition corroborate this score increase for this exact provider entry. They do not establish a general terminal rule or any current physical effect.' };
    }
    return null;
  }

  /** The same current trial gate applies to a native service question whether
   * it is considered by ordinary source order or by explicit coordination.
   * A proposed experiment cannot supply its own absence-of-trial premise. */
  private async admitCurrentRequiredService(family: NativeFamily, candidate: NativeProposal): Promise<{
    proposal: NativeProposal; witness: R; trial: R; guard: { admitted: boolean; reason: string };
  } | null> {
    if (!this.caller || !this.knowledge || !this.current || !this.observation
      || !family.currentRequiredServiceWitness || candidate.status !== 'proposed'
      || candidate.actions.length !== 1 || candidate.steps?.length !== 1) return null;
    const trial = await this.caller.currentUntriedServiceTrial(this.observation, candidate.actions[0]!);
    if (!trial) return null;
    trial.source_state_revision = this.knowledge.node('caller:frontier').revision;
    const witness = await family.currentRequiredServiceWitness(candidate, this.observation, this.current.frame_rows, trial) as R | null;
    if (!witness || witness.status !== 'current_required_service'
      || witness.observation_ref !== this.observation.observation_ref
      || witness.level_epoch !== this.observation.level_epoch || witness.frame_hash !== this.observation.frame_hash
      || witness.action_ref !== candidate.actions[0]!.action_ref || witness.release_authority !== false
      || witness.primitive_bound !== 1 || witness.replan_after_each_primitive !== true
      || v6Canonical(witness.current_trial) !== v6Canonical(trial)) return null;
    const proposal = candidate.requires_current_service_witness === true
      ? { ...candidate, native_current_service_witness: witness,
        native_current_service_admission: { rule: 'current_required_service_witness_on_every_selection_path',
          source_state_ref: `family_state:${family.id}`, source_state_revision: this.knowledge.node(`family_state:${family.id}`).revision,
          trial_state_ref: 'caller:frontier', trial_state_revision: trial.source_state_revision,
          observation_ref: this.observation.observation_ref, release_authority: false } }
      : candidate;
    const guard = await family.before(proposal, 0, this.current, this.observation);
    return guard.admitted ? { proposal, witness, trial, guard } : null;
  }

  /**
   * V5 source-declared current service, integrated as an explicit V6 native
   * coordination extension. A unique remeasured service can precede a first
   * independent contact experiment. It must own its current witness, have an
   * actual untried public context and pass the normal source guard. Only one
   * primitive is selected; preservation and WHY/ACT still decide its release.
   * There is no family-name, game, score, palette or coordinate priority.
   */
  private async preferCurrentRequiredService(sourceIndex: number, sourceEntryIndex: number, deferredFamily: NativeFamily,
    deferredProposal: NativeProposal): Promise<{ group: string; offer: { family: NativeFamily; proposal: NativeProposal } } | null> {
    if (!this.caller || !this.planning || !this.knowledge || !this.current || !this.observation
      || deferredProposal.status !== 'proposed' || !deferredFamily.unacquiredInquiryWitness) return null;
    const independent = await deferredFamily.unacquiredInquiryWitness(deferredProposal, this.observation) as R | null;
    if (!independent || independent.status !== 'unknown_effect_inquiry_with_measured_access'
      || independent.observation_ref !== this.observation.observation_ref
      || independent.level_epoch !== this.observation.level_epoch || independent.effect_status !== 'unobserved'
      || !Array.isArray(independent.contact_evidence) || independent.contact_evidence.length) return null;
    for (const group of this.groups.slice(sourceIndex + 1)) for (const [entryIndex, id] of group.families.entries()) {
      const family = this.families.find(candidate => candidate.id === id);
      if (!family?.currentRequiredServiceWitness || objectValue(this.knowledge.value(`family_activation:${id}`)).enabled !== true) continue;
      const entry = group.entryPoints?.[entryIndex], key = `${group.id}:${family.id}:${entry}`;
      let candidate: NativeProposal | null;
      if (this.planning.entryOffers.has(key)) candidate = this.planning.entryOffers.get(key)!;
      else {
        this.check(this.planning.execution); await this.planning.execution.yieldControl(); this.check(this.planning.execution);
        candidate = entry ? await family.proposeInSubquestion!(group.id, entry, this.observation,
          this.current.frame_rows, this.planning.inputs, this.remaining(), this.planning.execution)
          : family.proposeInGroup ? await family.proposeInGroup(group.id, this.observation,
            this.current.frame_rows, this.planning.inputs, this.remaining(), this.planning.execution)
          : await family.propose(this.observation, this.current.frame_rows, this.planning.inputs, this.remaining(), this.planning.execution);
        this.planning.entryOffers.set(key, candidate);
      }
      if (!candidate) this.retainProposalRefusal(family, group.id, entry ?? null);
      if (!candidate || candidate.status !== 'proposed' || candidate.actions.length !== 1
        || candidate.steps?.length !== 1) continue;
      const admitted = await this.admitCurrentRequiredService(family, candidate);
      if (!admitted) continue;
      candidate = admitted.proposal;
      const { witness, guard } = admitted;
      const stateRef = `family_state:${family.id}`;
      const receipt = { rule: 'v5_current_required_service_before_independent_contact_question',
        source_trigger_group: this.groups[sourceIndex]!.id, source_trigger_index: sourceIndex,
        source_trigger_entry: this.groups[sourceIndex]!.entryPoints?.[sourceEntryIndex] ?? null,
        selected_group: group.id, selected_group_index: this.groups.indexOf(group), selected_entry: entry ?? null,
        selected_subquestion: candidate.material_access_subquestion ?? candidate.program_subquestion ?? candidate.field_subquestion ?? entry ?? null,
        observation_ref: this.observation.observation_ref, deferred_family: deferredFamily.id,
        deferred_proposal_ref: deferredProposal.proposal_id ?? (deferredProposal as R).bundle_template?.composition_ref ?? null,
        preferred_family: family.id, preferred_proposal_ref: candidate.proposal_id ?? (candidate as R).bundle_template?.composition_ref ?? null,
        preferred_proposal_digest: continuationProposalDigest(candidate), preferred_proposal_digest_profile: CONTINUATION_PROPOSAL_DIGEST_PROFILE,
        independent_unknown_effect_question: independent, current_required_service: witness,
        source_state_ref: stateRef, source_state_revision: this.knowledge.node(stateRef).revision,
        guard_reason: guard.reason, primitive_bound: 1, replan_after_each_primitive: true, physical_action_authorized: false,
        scope: 'V5 declarative service conditions are reused within an explicit native V6 selection extension. Priority is restricted to commands never tried in the actual V6 public context. Full V5 caller-context and full V6 selection parity are not claimed. Ordinary preservation, binding and WHY/ACT still apply.' };
      this.planning.coordination.push(receipt); this.note({ kind: 'native_coordination', ...receipt });
      return { group: group.id, offer: { family, proposal: candidate } };
    }
    return null;
  }

  /**
   * Native arbitration, separate from the unchanged source ordering. A dated
   * official success can support re-examining its own current continuation
   * before a wholly unacquired exploration. The exact attested candidate is
   * selected, not an earlier offer borrowing its evidence. The source cursor
   * and the actual selected group remain distinct in the retained receipt.
   */
  private async preferAcquiredContinuation(sourceIndex: number, sourceEntryIndex: number, deferredFamily: NativeFamily,
    deferredProposal: NativeProposal): Promise<{ group: string; offer: { family: NativeFamily; proposal: NativeProposal } } | null> {
    if (!this.caller || !this.planning || !this.knowledge || !this.current || !this.observation
      || deferredProposal.status !== 'proposed' || !deferredFamily.unacquiredInquiryWitness) return null;
    const unacquired = await deferredFamily.unacquiredInquiryWitness(deferredProposal, this.observation) as R | null;
    if (!unacquired || unacquired.status !== 'unacquired_exploration'
      || unacquired.observation_ref !== this.observation.observation_ref
      || !Array.isArray(unacquired.evidence_refs) || unacquired.evidence_refs.length) return null;
    const retainedByFamily = new Map<string, R | null>();
    for (const group of this.groups.slice(sourceIndex + 1)) for (const [entryIndex, id] of group.families.entries()) {
      const family = this.families.find(candidate => candidate.id === id);
      if (!family?.retainedSuccessWitness || !family.acquiredContinuationWitness
        || objectValue(this.knowledge.value(`family_activation:${id}`)).enabled !== true) continue;
      if (!retainedByFamily.has(id)) retainedByFamily.set(id, await family.retainedSuccessWitness(this.observation) as R | null);
      const retained = retainedByFamily.get(id)!;
      const currentWitness = (witness: R | null): witness is R => Boolean(witness
        && witness.status === 'conditional_acquired_continuation'
        && witness.observation_ref === this.observation!.observation_ref
        && witness.score === this.current!.levels_completed && typeof witness.success_ref === 'string' && witness.success_ref.length
        && Array.isArray(witness.evidence_refs) && witness.evidence_refs.includes(witness.success_ref));
      if (!currentWitness(retained)) continue;
      const entry = group.entryPoints?.[entryIndex], key = `${group.id}:${family.id}:${entry}`;
      const contribution = this.acquiredContribution(family, retained, entry ?? null);
      if (!contribution) continue;
      let candidate: NativeProposal | null;
      if (entry && this.planning.entryOffers.has(key)) candidate = this.planning.entryOffers.get(key)!;
      else {
        this.check(this.planning.execution); await this.planning.execution.yieldControl(); this.check(this.planning.execution);
        candidate = entry ? await family.proposeInSubquestion!(group.id, entry, this.observation,
          this.current.frame_rows, this.planning.inputs, this.remaining(), this.planning.execution)
          : family.proposeInGroup ? await family.proposeInGroup(group.id, this.observation,
            this.current.frame_rows, this.planning.inputs, this.remaining(), this.planning.execution)
          : await family.propose(this.observation, this.current.frame_rows, this.planning.inputs, this.remaining(), this.planning.execution);
        if (entry) this.planning.entryOffers.set(key, candidate);
      }
      if (!candidate) this.retainProposalRefusal(family, group.id, entry ?? null);
      if (!candidate || candidate.status !== 'proposed' || !candidate.actions.length
        || candidate.kind !== contribution.proposal_kind
        || (candidate.material_access_subquestion ?? candidate.program_subquestion ?? candidate.field_subquestion ?? entry ?? null) !== contribution.entry) continue;
      const witness = await family.acquiredContinuationWitness(candidate, this.observation) as R | null;
      if (!currentWitness(witness) || witness.success_ref !== retained.success_ref) continue;
      const guard = await family.before(candidate, 0, this.current, this.observation);
      if (!guard.admitted) continue;
      const stateRef = `family_state:${family.id}`, deferredStateRef = `family_state:${deferredFamily.id}`;
      const receipt = { rule: 'current_acquired_continuation_before_unacquired_exploration',
        source_trigger_group: this.groups[sourceIndex]!.id, source_trigger_index: sourceIndex,
        source_trigger_entry: this.groups[sourceIndex]!.entryPoints?.[sourceEntryIndex] ?? null,
        selected_group: group.id, selected_group_index: this.groups.indexOf(group), selected_entry: entry ?? null,
        selected_subquestion: candidate.material_access_subquestion ?? candidate.program_subquestion ?? candidate.field_subquestion ?? entry ?? null,
        observation_ref: this.observation.observation_ref,
        deferred_family: deferredFamily.id, deferred_proposal_ref: deferredProposal.proposal_id ?? (deferredProposal as R).bundle_template?.composition_ref ?? null,
        preferred_family: family.id, preferred_proposal_ref: candidate.proposal_id ?? (candidate as R).bundle_template?.composition_ref ?? null,
        preferred_proposal_digest: continuationProposalDigest(candidate),
        preferred_proposal_digest_profile: CONTINUATION_PROPOSAL_DIGEST_PROFILE,
        unacquired_inquiry: unacquired, acquired_continuation: witness,
        acquired_kernel_contribution: contribution,
        source_state_ref: stateRef, source_state_revision: this.knowledge.node(stateRef).revision,
        deferred_state_ref: deferredStateRef, deferred_state_revision: this.knowledge.node(deferredStateRef).revision,
        guard_reason: guard.reason, physical_action_authorized: false,
        scope: 'Explicit native selection extension. Previous official success supports this remeasured inquiry, not a universal law or a known effect for an uncalibrated control. Ordinary binding, preservation and WHY/ACT authorization still apply.' };
      this.planning.coordination.push(receipt); this.note({ kind: 'native_coordination', ...receipt });
      return { group: group.id, offer: { family, proposal: candidate } };
    }
    return null;
  }

  /**
   * Explicit native coordination extension. The unchanged Python caller can
   * select a visual invitation despite an independently acquired preparation.
   * Inspect the next window choice in declared order. Its family must attest
   * actual acquired evidence and pass its current guard. No later learned
   * candidate can lend its priority to an earlier unsupported proposal.
   * Neither the evidence nor this deferral is an execution authorization.
   */
  private async deferUnlearnedInvitation(invitation: NativeProposal): Promise<boolean> {
    if (invitation.kind !== 'measured_animated_contact' || (invitation as R).animated_contact_plan?.mode !== 'invitation'
      || !this.planning || !this.knowledge || !this.current || !this.observation) return false;
    const group = this.groups.find(candidate => candidate.id === 'window_constraints');
    if (!group) return false;
    for (const [index, id] of group.families.entries()) {
      const family = this.families.find(candidate => candidate.id === id);
      if (!family || objectValue(this.knowledge.value(`family_activation:${id}`)).enabled !== true) continue;
      // A provider without this read-only contract remains in normal source
      // order; do not speculate past it or execute its question for arbitration.
      if (!family.learnedPreparationWitness) return false;
      const entry = group.entryPoints?.[index], key = `${group.id}:${family.id}:${entry}`;
      let candidate: NativeProposal | null;
      if (entry && this.planning.entryOffers.has(key)) candidate = this.planning.entryOffers.get(key)!;
      else {
        candidate = entry ? await family.proposeInSubquestion!(group.id, entry, this.observation,
          this.current.frame_rows, this.planning.inputs, this.remaining(), this.planning.execution)
          : family.proposeInGroup ? await family.proposeInGroup(group.id, this.observation,
            this.current.frame_rows, this.planning.inputs, this.remaining(), this.planning.execution)
          : await family.propose(this.observation, this.current.frame_rows, this.planning.inputs, this.remaining(), this.planning.execution);
        if (entry) this.planning.entryOffers.set(key, candidate);
      }
      if (!candidate) continue;
      if (candidate.status !== 'proposed') return false;
      const witness = await family.learnedPreparationWitness(candidate, this.observation);
      if (!witness || witness.status !== 'conditional_acquired_preparation'
        || witness.observation_ref !== this.observation.observation_ref
        || !witness.model_ids.length || !witness.evidence_refs.length) return false;
      const guard = await family.before(candidate, 0, this.current, this.observation);
      if (!guard.admitted) return false;
      const stateRef = `family_state:${family.id}`;
      const evidence = { rule: 'retained_learned_preparation_before_unlearned_invitation', observation_ref: this.observation.observation_ref,
        deferred_proposal_id: invitation.proposal_id, preferred_proposal_id: candidate.proposal_id,
        model_id: witness.model_ids[0], learned_preparation: witness,
        source_state_ref: stateRef, source_state_revision: this.knowledge.node(stateRef).revision,
        guard_reason: guard.reason,
        scope: 'Native coordination extension; conditional learned preparation, not an original Python selection rule.' };
      this.planning.coordination.push(evidence); this.note({ kind: 'native_coordination', ...evidence });
      return true;
    }
    return false;
  }

  /**
   * A stationary invitation without a learned contact model is a local failed
   * question. Its source refusal does not refute an independently grounded
   * current inquiry. The actual no-effect witness is read from the Kernel;
   * neither an old proposal nor an empty model alone establishes that witness.
   */
  private async scopeStationaryContactRefusal(contact: NativeFamily, refusal: NativeProposal): Promise<boolean> {
    if (contact.id !== 'animated_contact' || refusal.status !== 'unknown'
      || !refusal.block_unrelated_probe || refusal.reason !== 'measured_contact_continuation_requires_current_evidence'
      || !this.planning || !this.knowledge || !this.current || !this.observation) return false;
    if (!this.knowledge.memory.nodes[CONTACT_SCOPE_NODE]) return false;
    const state = this.knowledge.value(`family_state:${contact.id}`) as R, events: R[] = state.events;
    const scope = this.knowledge.value(CONTACT_SCOPE_NODE) as R;
    if (!scope || !Array.isArray(events) || !events.length || events.some(event => event.model || event.mode !== 'invitation')
      || scope.status !== 'stationary_unlearned_invitation' || scope.epoch !== this.observation.level_epoch
      || scope.score !== this.current.levels_completed || scope.public_state !== this.current.state
      || v6Canonical(scope.available_action_refs) !== v6Canonical(this.current.available_action_refs)) return false;
    const last = events.at(-1)!;
    if (last.epoch !== scope.epoch || last.boundary || last.after_rows_digest !== scope.frame_digest
      || v6Canonical(last.evidence) !== v6Canonical(scope.evidence) || v6Canonical(last.command) !== v6Canonical(scope.command)) return false;
    const group = this.groups.find(candidate => candidate.id === 'window_constraints');
    if (!group) return false;
    for (const [index, id] of group.families.entries()) {
      const family = this.families.find(candidate => candidate.id === id);
      if (!family || objectValue(this.knowledge.value(`family_activation:${id}`)).enabled !== true) continue;
      if (!family.groundedInquiryWitness) return false;
      const entry = group.entryPoints?.[index], key = `${group.id}:${family.id}:${entry}`;
      let candidate: NativeProposal | null;
      if (entry && this.planning.entryOffers.has(key)) candidate = this.planning.entryOffers.get(key)!;
      else {
        candidate = entry ? await family.proposeInSubquestion!(group.id, entry, this.observation,
          this.current.frame_rows, this.planning.inputs, this.remaining(), this.planning.execution)
          : family.proposeInGroup ? await family.proposeInGroup(group.id, this.observation,
            this.current.frame_rows, this.planning.inputs, this.remaining(), this.planning.execution)
          : await family.propose(this.observation, this.current.frame_rows, this.planning.inputs, this.remaining(), this.planning.execution);
        if (entry) this.planning.entryOffers.set(key, candidate);
      }
      if (!candidate) continue;
      if (candidate.status !== 'proposed') return false;
      const witness = await family.groundedInquiryWitness(candidate, this.observation);
      if (!witness || witness.status !== 'acquired_context_for_unknown_effect'
        || witness.observation_ref !== this.observation.observation_ref
        || !witness.context_model_ids.length || !witness.evidence_refs.length) return false;
      const guard = await family.before(candidate, 0, this.current, this.observation);
      if (!guard.admitted) return false;
      const stateRef = `family_state:${family.id}`;
      const receipt = { rule: 'stationary_unlearned_contact_refusal_is_local', observation_ref: this.observation.observation_ref,
        contact_scope_ref: CONTACT_SCOPE_NODE, contact_scope_revision: this.knowledge.node(CONTACT_SCOPE_NODE).revision,
        contact_evidence_refs: scope.evidence, preferred_proposal_id: candidate.proposal_id, grounded_inquiry: witness,
        source_state_ref: stateRef, source_state_revision: this.knowledge.node(stateRef).revision, guard_reason: guard.reason,
        scope: 'Native refusal-scope extension after an acquired stationary invitation. The next grounded question has an unknown effect and must still pass ordinary authorization.' };
      this.planning.coordination.push(receipt); this.note({ kind: 'native_coordination', ...receipt });
      return true;
    }
    return false;
  }

  /**
   * A transient public effect returning to its starting image remains unknown.
   * Its local refusal can leave a distinct current relation open to inquiry.
   * Cold inquiries must avoid every observed effect pixel and the probe point;
   * later inquiries need actual acquired context, not the old image alone.
   */
  private async scopeReturnedContactRefusal(contact: NativeFamily, refusal: NativeProposal): Promise<boolean> {
    if (contact.id !== 'animated_contact' || refusal.status !== 'unknown'
      || !refusal.block_unrelated_probe || refusal.reason !== 'measured_contact_continuation_requires_current_evidence'
      || !this.planning || !this.knowledge || !this.current || !this.observation) return false;
    if (!this.knowledge.memory.nodes[CONTACT_SCOPE_NODE]) return false;
    const state = this.knowledge.value(`family_state:${contact.id}`) as R, events: R[] = state.events;
    const scope = this.knowledge.value(CONTACT_SCOPE_NODE) as R;
    if (!scope || !Array.isArray(events) || !events.length || events.some(event => event.model || event.mode !== 'invitation')
      || scope.status !== 'transient_returned_unlearned_invitation' || scope.epoch !== this.observation.level_epoch
      || scope.score !== this.current.levels_completed || scope.public_state !== this.current.state
      || v6Canonical(scope.available_action_refs) !== v6Canonical(this.current.available_action_refs)
      || !scope.public_return?.first || !scope.public_return?.second) return false;
    const last = events.at(-1)!;
    if (last.epoch !== scope.epoch || last.boundary || last.after_rows_digest !== scope.frame_digest
      || v6Canonical(last.evidence) !== v6Canonical(scope.evidence) || v6Canonical(last.command) !== v6Canonical(scope.command)) return false;
    let summary: R;
    try { summary = summaryReturnedPublicProbe(scope.public_return.first, scope.public_return.second); }
    catch { return false; }
    if (Object.keys(summary).some(key => v6Canonical(summary[key]) !== v6Canonical(scope[key]))) return false;
    const returned = scope.public_return.second;
    if (returned.level !== scope.epoch || returned.levels_completed !== scope.score || returned.state !== scope.public_state
      || v6Canonical(returned.available_action_refs) !== v6Canonical(scope.available_action_refs)) return false;
    const transitionNode = this.knowledge.memory.nodes[scope.transition_ref];
    if (!transitionNode || transitionNode.kind !== 'transition_evidence' || transitionNode.component !== 'public_transition'
      || transitionNode.status !== 'observed') return false;
    const transition = this.knowledge.value(scope.transition_ref) as R;
    if (transition.status === 'official_boundary_witness' || transition.before !== scope.evidence?.[0]
      || transition.after !== scope.evidence?.[1] || v6Canonical(transition.command) !== v6Canonical(scope.command)) return false;
    const group = this.groups.find(candidate => candidate.id === 'window_constraints');
    if (!group) return false;
    for (const [index, id] of group.families.entries()) {
      const family = this.families.find(candidate => candidate.id === id);
      if (!family || objectValue(this.knowledge.value(`family_activation:${id}`)).enabled !== true) continue;
      // Respect the first non-null question in source order. A later witness
      // cannot justify skipping an earlier unsupported question.
      if (!family.currentInquiryWitness) return false;
      const entry = group.entryPoints?.[index], key = `${group.id}:${family.id}:${entry}`;
      let candidate: NativeProposal | null;
      if (entry && this.planning.entryOffers.has(key)) candidate = this.planning.entryOffers.get(key)!;
      else {
        candidate = entry ? await family.proposeInSubquestion!(group.id, entry, this.observation,
          this.current.frame_rows, this.planning.inputs, this.remaining(), this.planning.execution)
          : family.proposeInGroup ? await family.proposeInGroup(group.id, this.observation,
            this.current.frame_rows, this.planning.inputs, this.remaining(), this.planning.execution)
          : await family.propose(this.observation, this.current.frame_rows, this.planning.inputs, this.remaining(), this.planning.execution);
        if (entry) this.planning.entryOffers.set(key, candidate);
      }
      if (!candidate) continue;
      if (candidate.status !== 'proposed' || !candidate.actions.length) return false;
      const witness = await family.currentInquiryWitness(candidate, this.observation, this.current.frame_rows) as R | null;
      if (!witness || witness.observation_ref !== this.observation.observation_ref
        || witness.proposal_ref !== candidate.proposal_id || witness.effect_requires_actual_return !== true
        || !Array.isArray(witness.evidence_refs) || !witness.evidence_refs.length
        || !Array.isArray(witness.acquisition_event_refs)) return false;
      const cold = witness.status === 'current_measured_relation_for_unknown_effect';
      const acquired = witness.status === 'acquired_context_for_unknown_effect';
      if (cold ? witness.acquisition_event_refs.length !== 0 || !independentReturnedProbeSupport(scope, witness, this.current.frame_rows)
        : !acquired || !witness.acquisition_event_refs.length || !Array.isArray(witness.context_model_ids) || !witness.context_model_ids.length) return false;
      const guard = await family.before(candidate, 0, this.current, this.observation);
      if (!guard.admitted) return false;
      const stateRef = `family_state:${family.id}`;
      const receipt = { rule: 'returned_unlearned_contact_refusal_is_local', observation_ref: this.observation.observation_ref,
        contact_scope_ref: CONTACT_SCOPE_NODE, contact_scope_revision: this.knowledge.node(CONTACT_SCOPE_NODE).revision,
        contact_evidence_refs: scope.evidence, public_return_status: scope.status,
        preferred_proposal_id: candidate.proposal_id, current_inquiry: witness,
        source_state_ref: stateRef, source_state_revision: this.knowledge.node(stateRef).revision,
        guard_reason: guard.reason, physical_action_authorized: false,
        scope: 'Explicit native coordination extension. The transient effect remains unknown. A disjoint current relation or actual acquired context supports another question; ordinary binding, preservation and WHY/ACT authorization still apply.' };
      this.planning.coordination.push(receipt); this.note({ kind: 'native_coordination', ...receipt });
      return true;
    }
    return false;
  }

  private async authorize(execution: NativeExecution): Promise<boolean> {
    this.check(execution);
    if (!this.prefix || !this.current || !this.observation) throw new Error('No native prefix to authorize');
    if (this.budgetReason()) return false;
    const { family, proposal, index } = this.prefix, command = proposal.actions[index];
    if (!command || !this.current.available_action_refs.includes(command.action_ref)) return false;
    let before = await family.before(proposal, index, this.current, this.observation);
    if (this.caller && proposal.native_composition_dependency) {
      const parentGuard = typedMaterialParentGuard(this.caller.attention, family.compositionDependencyState?.() ?? {},
        proposal, index, this.observation, this.current.frame_rows);
      if (parentGuard?.admitted === false) before = { admitted: false, reason: parentGuard.reason };
    }
    const preserved = this.caller?.preservation(proposal, this.current, this.observation);
    if (preserved && !preserved.admitted) before = { admitted: false, reason: preserved.reason };
    const point = await ObservedInputDomain.pointGuard(this.current, command, proposal.steps![index] as { point_binding?: LocusWitness });
    this.note({ kind: 'before_guard', family: family.id, index, admitted: before.admitted, reason: before.reason, point_bound: point,
      ...(before.native_binding_receipt ? { native_binding_receipt: before.native_binding_receipt } : {}) });
    this.check(execution);
    if (!before.admitted || !point || this.budgetReason()) {
      this.prefix.interruption = !before.admitted ? `path_premise_changed:${before.reason}` : !point ? 'addressed_occurrence_changed' : this.budgetReason();
      return false;
    }
    if (!this.prefix.released) {
      if (this.authority && !await this.authority.release(proposal, this.observation, before, execution)) {
        this.prefix.interruption = 'src_action_set_not_released'; return false;
      }
      if (before.native_binding_receipt) this.prefix.nativeBindings.push(freeze({ index,
        observation_ref: this.observation.observation_ref, command: structuredClone(command),
        native_binding_receipt: structuredClone(before.native_binding_receipt),
        ...(this.authority ? { evidence_node: `reasoning:binding:${this.observation.revision}` } : {}) }));
      this.prefix.released = true;
      this.note({ kind: 'why_act_release', admitted: true, decision_revision: this.prefix.revision,
        native_gate: this.authority !== null, graph_chain: this.knowledge?.graphChain ?? null });
    }
    this.kind = 'action'; this.reason = null; return true;
  }

  async advance(outcome: NativeOutcome, execution: NativeExecution): Promise<NativeRuntimeYield> {
    this.check(execution);
    if (this.editing) throw new Error('A native graph edit is in progress');
    const prefix = this.prefix, first = this.current, before = this.observation;
    if (this.kind !== 'action' || !prefix || !first || !before || v6Canonical(outcome.command) !== v6Canonical(prefix.proposal.actions[prefix.index])
      || outcome.observation.step_index !== first.step_index + 1) throw new Error('Native outcome does not match the released prefix command');
    if (!Number.isFinite(outcome.executionMs) || outcome.executionMs < 0) throw new Error('Invalid native execution time');
    this.elapsedMs += outcome.executionMs; this.levelMs.set(first.level, (this.levelMs.get(first.level) ?? 0) + outcome.executionMs);
    this.actions += 1; this.levelActions.set(first.level, (this.levelActions.get(first.level) ?? 0) + 1); this.current = freeze(structuredClone(outcome.observation));
    await this.timed(first.level, async () => {
      this.observation = freeze(await measureNativeObservation(this.current!, this.actions + 1, this.sessionId));
      const after = this.observation;
      let result = await prefix.family.after(prefix.proposal, prefix.index, before, after, first.frame_rows, this.current!.frame_rows);
      const publicBoundary = first.level !== this.current!.level || first.levels_completed !== this.current!.levels_completed || ['WIN', 'GAME_OVER'].includes(this.current!.state);
      const preserved = this.caller?.preservation(prefix.proposal, this.current!, after, true, publicBoundary);
      if (preserved && !preserved.admitted) result = { matched: false, seal_prefix: true, reason: preserved.reason };
      prefix.witnessed.push({ command: freeze(structuredClone(outcome.command)), before, after, first, second: this.current!, index: prefix.index, outcome: freeze(structuredClone(result)) });
      this.note({ kind: 'actual_outcome', family: prefix.family.id, index: prefix.index, ...result, observation_ref: after.observation_ref });
      this.check(execution);
      const boundary = first.level !== this.current!.level || first.levels_completed !== this.current!.levels_completed;
      prefix.index += 1;
      if (boundary || ['WIN', 'GAME_OVER'].includes(this.current!.state)) prefix.interruption = 'official_boundary_or_terminal';
      else if (result.matched === false) prefix.interruption = 'observed_path_expectation_diverged';
      else if (result.seal_prefix && prefix.index < prefix.proposal.actions.length) prefix.interruption = 'frontier_outcome_sealed_prefix';
      else if (this.budgetReason()) prefix.interruption = this.budgetReason();
      if (result.seal_prefix || boundary || prefix.index >= prefix.proposal.actions.length || this.budgetReason()) await this.seal(execution);
      else if (!await this.authorize(execution)) await this.seal(execution);
    });
    return this.output();
  }

  /** Record every real primitive only after the committed prefix is sealed. */
  private async seal(execution: NativeExecution): Promise<void> {
    const prefix = this.prefix;
    if (!prefix) throw new Error('No native prefix to seal');
    const compositionReturns: R[] = [];
    const recordSelected = async (transition: WitnessedTransition): Promise<R | null> => {
      this.check(execution);
      const common = this.caller && CALLER_PROVIDERS.includes(prefix.family.id as typeof CALLER_PROVIDERS[number]);
      const selectedSupport = this.acquisitionFamilies && Boolean(prefix.proposal.support_plan);
      const selectedFamily = selectedSupport ? this.acquisitionFamilies!.supports : prefix.family;
      const record = common ? null : await selectedFamily.record(transition.before, transition.after, transition.command,
        transition.first.frame_rows, transition.second.frame_rows, prefix.proposal, transition.index, transition.second.frame_packet);
      // Preserve the former detached-record validation, but release that copy
      // immediately: this collection was read only for its cumulative count.
      freeze(structuredClone(record));
      this.acquiredRecordCount += 1;
      if (record && this.caller && this.authority) this.retainSelectedAcquisition(selectedFamily, record, transition);
      if (this.acquisitionFamilies) await this.acquirePassiveFamilies(transition, prefix.proposal, Boolean(selectedSupport), prefix.family.id);
      const parentFamily = this.typedMaterialParentFamily();
      if (this.caller && parentFamily) {
        const result = recordTypedMaterialParent(this.caller.attention, parentFamily.compositionDependencyState!(), prefix.proposal, transition, record);
        if (result) { compositionReturns.push(result); this.note({ kind: 'native_composition_dependency', ...result }); }
      }
      return record;
    };
    // Source ordering is per acquired transition, after physical prefix sealing:
    // Attention/View -> selected family -> Goal/Point/Control -> assessment -> Frontier.
    // A selected-family record must never be applied in an earlier separate pass.
    if (!this.caller) for (const transition of prefix.witnessed) await recordSelected(transition);
    const composed = this.authority ? await this.authority.acquire(prefix.proposal, prefix.revision, prefix.witnessed, prefix.interruption, execution,
      this.caller ? {
        beforeAssessment: transition => this.caller!.beforeAssessment(transition, prefix.proposal, () => recordSelected(transition as WitnessedTransition), () => {
          const events = this.acquisitionFamilies?.inventory?.recordCallerContext(transition.before, transition.after, transition.command,
            transition.first.frame_rows, transition.second.frame_rows, prefix.proposal, transition.index) ?? [];
          if (events.length) this.authority!.memory.put(EPISODE, `collection_events:${transition.before.revision}`, events, transition.after.observation_ref, transition.after.revision);
          this.acquisitionFamilies?.inventory?.observeCallerContext(transition.after, transition.second.frame_rows);
        }),
        recordAssessment: (transition, assessment) => this.caller!.recordAssessment(transition, assessment),
        boundaryWitness: transition => this.caller!.boundaryWitness(transition, prefix.proposal, prefix.revision,
          (method, witness) => this.acquisitionFamilies?.morphology?.stationHypothesisFor(method, witness) ?? null),
      } : undefined) : null;
    this.cycles += 1;
    // common_frontier_runtime.py checks observed program refutations after
    // OP29/30/31 and before replaying a natural boundary. Official completion
    // and GAME_OVER take precedence over an experimental stop request.
    const officialStop = this.current!.levels_completed >= this.budgets!.targetLevels
      || ['WIN', 'GAME_OVER'].includes(this.current!.state);
    const sourceStop = this.families.map(family => family.requestedStopReason?.(this.observation!) ?? null)
      .find(reason => reason !== null) ?? null;
    const parent = this.caller?.attention.composition;
    const parentStop = parent?.owner === TYPED_MATERIAL_COMPOSITION_OWNER && parent.status === 'pending' && parent.binding?.phase === 'suspended'
      ? `composition_dependency_${parent.binding.suspension_reason}` : null;
    const stopReason = officialStop ? this.budgetReason() : sourceStop ?? parentStop ?? this.budgetReason();
    let transfer: R | null = null;
    if (this.caller) {
      this.callerAcquisitions += prefix.witnessed.length;
      const last = prefix.witnessed.at(-1)!;
      const boundary = last.after.level_epoch !== last.before.level_epoch || last.after.levels_completed > last.before.levels_completed || ['WIN', 'GAME_OVER'].includes(last.after.state);
      // The source stops immediately after the requested score / GAME_OVER.
      // Replay is for continuation into the next natural level only.
      if (boundary && !sourceStop && last.after.state !== 'GAME_OVER' && last.after.levels_completed < this.budgets!.targetLevels) {
        transfer = await this.caller.replayBoundary(last.after); this.callerBoundaryReplays += 1;
      }
      if (stopReason) this.caller.close(last.after, stopReason);
    }
    this.note({ kind: 'sealed_prefix', family: prefix.family.id, revision: prefix.revision, acquired_actions: prefix.witnessed.length });
    const evidenceId = `prefix_evidence:${prefix.revision}`;
    const contactScope: NativeStoreWrite[] = [];
    if (prefix.family.id === 'animated_contact' && prefix.proposal.kind === 'measured_animated_contact' && prefix.witnessed.length === 1) {
      const transition = prefix.witnessed[0]!, first = transition.first, second = transition.second;
      const summary = summaryReturnedPublicProbe(first, second);
      if ((prefix.proposal as R).animated_contact_plan?.mode !== 'invitation') summary.status = 'outside_stationary_invitation_scope';
      contactScope.push({ id: CONTACT_SCOPE_NODE, kind: 'transition_evidence', component: 'native_contact_probe_scope', status: 'observed',
        value: { ...summary,
          epoch: transition.before.level_epoch, score: second.levels_completed, public_state: second.state,
          available_action_refs: second.available_action_refs, command: transition.command,
          evidence: [transition.before.observation_ref, transition.after.observation_ref],
          transition_ref: `reasoning:transition:${transition.before.revision}`,
          ...(summary.status === 'transient_returned_unlearned_invitation' ? { public_return: { first, second } } : {}),
          qualification: 'The complete public packet distinguishes stationary, transient-returned and changed outcomes. No hidden-state equivalence or understood effect is inferred.' },
        relations: [{ relation: 'witnesses', target: `reasoning:transition:${transition.before.revision}` }] });
    }
    await this.persistFamilies({ workflow: SELECTION_PROGRAM, step: 'sealed_prefix', statement: 'outcome.acquire' }, [{
      id: evidenceId, kind: 'prefix_evidence', family: prefix.family.id, status: 'observed',
      value: { decision_revision: prefix.revision, proposal: prefix.proposal, selection: this.selectionReceipt,
        ...(prefix.nativeBindings.length ? { native_bindings: prefix.nativeBindings } : {}),
        ...(compositionReturns.length ? { composition_dependency_returns: compositionReturns } : {}),
        composed_reconciliation: composed, caller_transfer: transfer,
        transitions: prefix.witnessed.map(transition => ({ command: transition.command,
          before: transition.before.observation_ref, after: transition.after.observation_ref, outcome: transition.outcome })) },
      relations: [{ relation: 'records', target: `family_state:${prefix.family.id}` }, { relation: 'selected_by', target: `program:${SELECTION_PROGRAM}` }],
    }, ...contactScope, ...(this.authority?.checkpointWrites() ?? [])], evidenceId);
    this.restoreFamilies();
    this.kind = 'boundary'; this.reason = null;
    const reason = stopReason ?? this.budgetReason(); if (reason) this.stop(reason);
  }

  private retainSelectedAcquisition(family: NativeFamily, record: NativeRecordResult, transition: WitnessedTransition): void {
    const memory = this.authority!.memory, after = transition.after;
    const singleEventKeys: Record<string, string> = { window_constraints: 'window_constraint', regular_field_correspondence: 'symmetric_field',
      orbit_constraints: 'orbit_constraint', containment: 'containment', surface_program: 'surface', code_program: 'codes', band_transfer: 'bands', reduction_transport: 'reduction',
      visual_sequences: 'visual_sequence_event', feedback_sequences: 'feedback_sequence_event', slot_substitution: 'slots', word_interface: 'words', port_assembly: 'ports', constellation_cover: 'constellations',
      public_framed_transfer: 'framed_transfer_event', public_outline_service: 'outline_service_event',
      public_observed_inventory: 'observed_inventory_event', public_ordered_reaction: 'reaction_event', public_reactive_contact: 'reactive_event',
      public_topological_recolor: 'topological_recolor_event', public_ranked_workshop: 'ranked_workshop_event',
      public_symbol_transaction: 'symbol_transaction_event', morphology: 'morphology_event' };
    const key = singleEventKeys[family.id];
    if (key) memory.put(EPISODE, `${key}:${transition.before.revision}`, record.events[0] ?? null, after.observation_ref, after.revision);
    // LinkedPreparation.record returns its full list, including an empty list.
    // Keep that source envelope and do not acquire the same return passively.
    if (family.id === 'linked_temporal_preparation') {
      memory.put(EPISODE, `linked_preparation_event:${transition.before.revision}`, record.events, after.observation_ref, after.revision);
    }
    // These source record methods already return their complete envelope.
    if (family.id === 'support_navigation' || family.id === 'public_occurrence_recall') {
      memory.put(EPISODE, `${family.id === 'support_navigation' ? 'support_navigation_event' : 'window_constraint'}:${transition.before.revision}`,
        record, after.observation_ref, after.revision);
      if (family.id === 'public_occurrence_recall') this.retainFamilyState(family, 'repeated_series_state', transition);
    }
    // Ordered support is a transferred subcomposition of SupportNavigation; its
    // exact state is retained without inventing the unported wrapper's event.
    if (family.id === 'ordered_support_transfer' || family.id === 'visual_sequences') {
      const state = family.state();
      memory.put(EPISODE, family.id === 'ordered_support_transfer' ? 'ordered_support_state' : 'visual_sequence_state', state, after.observation_ref, after.revision);
      family.restore(memory.get(EPISODE, family.id === 'ordered_support_transfer' ? 'ordered_support_state' : 'visual_sequence_state').value);
    }
    if ((family.id === 'window_constraints' || family.id === 'regular_field_correspondence')
      && (record.events[0] as R | null)?.status === 'official_boundary_witness') {
      const state = family.state();
      memory.put(EPISODE, family.id === 'window_constraints' ? 'window_prior' : 'symmetry_prior', state.prior, after.observation_ref, after.revision);
    }
  }

  private retainFamilyState(family: NativeFamily, key: string, transition: WitnessedTransition): void {
    const memory = this.authority!.memory, after = transition.after;
    if (family.nativeState && family.restoreNative) {
      memory.nativePut(EPISODE, key, family.nativeState(), after.observation_ref, after.revision);
      family.restoreNative(memory.nativeGet(EPISODE, key).value);
      return;
    }
    memory.put(EPISODE, key, family.state(), after.observation_ref, after.revision);
    family.restore(memory.get(EPISODE, key).value);
  }

  /** Source common_frontier_runtime.py acquisitions, once per sealed transition. */
  private async acquirePassiveFamilies(transition: WitnessedTransition, proposal: NativeProposal, selectedSupport: boolean, selectedId: string): Promise<void> {
    const { supports, recall, framed, outline, inventory, reaction, reactive, recolor, workshop, symbols, morphology, feedback, preparations } = this.acquisitionFamilies!, { before, after, command, first, second, index } = transition;
    const memory = this.authority!.memory;
    if (!selectedSupport) {
      const result = await supports.record(before, after, command, first.frame_rows, second.frame_rows, undefined, undefined, second.frame_packet);
      if (result.events.length) memory.put(EPISODE, `support_navigation_event:${before.revision}`, result, after.observation_ref, after.revision);
    }
    const retain = (id: string, key: string, when: (state: R) => boolean): void => {
      const family = supports.acquiredCompositions[id];
      if (family && when(family.state())) this.retainFamilyState(family, key, transition);
    };
    retain('joint_transport', 'joint_transport_state', state => Boolean(state.refs?.length));
    retain('invited_reduction', 'invited_reduction_state', state => Boolean(state.refs?.length || state.events?.length));
    retain('animated_contact', 'animated_contact_state', state => Boolean(state.events?.length));
    retain('periodic_sums', 'periodic_sums_state', state => Boolean(state.refs?.length || state.bootstrap_attempts?.length));
    retain('subset_diagnosis', 'subset_diagnosis_state', state => Boolean(state.method_refs?.length || state.events?.length));
    retain('fixed_origin', 'fixed_origin_state', state => state.pending != null || Boolean(state.executions?.length || state.inert?.length));
    retain('ordered_support_transfer', 'ordered_support_state', state => Boolean(state.events?.length || state.closed?.length));
    retain('sliding_cavity', 'sliding_cavity_state', state => state.body_type != null || Boolean(state.scored?.length));
    retain('metric_composition', 'metric_composition_state', state => state.current != null || Boolean(state.control_samples?.length));
    // Source order: support owners, addressed material (still a separate lot5
    // entry), LinkedPreparation, then the shared series owner. Only the actual
    // selected family acquires attributed records; foreign actions remain passive.
    if (preparations && selectedId !== preparations.id) {
      const events = preparations.recordSource(before, after, command, first.frame_rows, second.frame_rows);
      if (events.length) memory.put(EPISODE, `linked_preparation_event:${before.revision}`, events, after.observation_ref, after.revision);
    }
    // This implements recall's retained series/events closure. Other series
    // planning providers remain explicitly pending in the migration inventory.
    if (selectedId !== recall.id) {
      const result = await recall.record(before, after, command, first.frame_rows, second.frame_rows, proposal, index, second.frame_packet);
      if (result.events.length) this.retainFamilyState(recall, 'repeated_series_state', transition);
    }
    // Original caller: a foreign selected action may reveal the mode contrast.
    // The selected workshop owner already recorded above, so never repeat it.
    if (workshop && selectedId !== workshop.id) {
      const result = workshop.recordSource(before, after, command, first.frame_rows, second.frame_rows);
      if (result) memory.put(EPISODE, `ranked_workshop_event:${before.revision}`, result, after.observation_ref, after.revision);
    }
    // Source Recolor retains selected evidence before FramedTransfer. It does
    // not record foreign actions: a visible change is not a recolor experiment.
    if (recolor) {
      const state = recolor.state();
      if (state.selection.length || state.writes.length || Object.keys(state.attempts).length) {
        memory.put(EPISODE, 'topological_recolor_state', state, after.observation_ref, after.revision);
        recolor.restore(memory.get(EPISODE, 'topological_recolor_state').value);
      }
    }
    // common_frontier_runtime.py retains this independent owner after the
    // support and repeated-series acquisitions. Foreign actual actions can
    // teach a framed relation; a selected framed action is never recorded twice.
    if (framed) {
      if (selectedId !== framed.id) {
        const result = await framed.recordPublicTransition(before, after, command, first.frame_rows, second.frame_rows,
          null, index, second.frame_packet);
        if (result) memory.put(EPISODE, `framed_transfer_event:${before.revision}`, result, after.observation_ref, after.revision);
      }
      const state = framed.state();
      if (state.spans.length || state.receipts.length || Object.keys(state.attempts).length) {
        // The source reasoning fact is the six-field state; the native graph
        // owner separately carries its validated checkpoint envelope.
        memory.put(EPISODE, 'framed_transfer_state', state, after.observation_ref, after.revision);
        // persistFamilies/restoreFamilies round-trip the complete native owner.
        // Restoring this source-only projection would discard independently
        // acquired public-packet evidence from its versioned native annex.
      }
    }
    // The original common caller acquires OutlineService after FramedTransfer.
    // Actual foreign actions may establish an outline control, without being
    // relabeled as local-operator experiments owned by this family.
    if (outline) {
      if (selectedId !== outline.id) {
        const result = await outline.recordPublicTransition(before, after, command, first.frame_rows, second.frame_rows, null, index);
        if (result) memory.put(EPISODE, `outline_service_event:${before.revision}`, result, after.observation_ref, after.revision);
      }
      const state = outline.state();
      if (state.control || Object.keys(state.tracks as R).length) {
        memory.put(EPISODE, 'outline_service_state', state, after.observation_ref, after.revision);
        // The seven-field source projection stays distinct from the native
        // owner. The full checkpoint below preserves any actual public-return
        // context; restoring this projection alone would discard that context.
      }
    }
    // Original inventory acquisition sits between Outline and OrderedReaction.
    // Foreign selected actions carry no inventory proposal attribution.
    if (inventory) {
      if (selectedId !== inventory.id) {
        const result = inventory.recordSource(before, after, command, first.frame_rows, second.frame_rows, null, index);
        if (result) memory.put(EPISODE, `observed_inventory_event:${before.revision}`, result, after.observation_ref, after.revision);
      }
      const state = inventory.state();
      if (state.tracker.core || state.seen_pairs.length) {
        memory.put(EPISODE, 'observed_inventory_state', state, after.observation_ref, after.revision);
        inventory.restore(memory.get(EPISODE, 'observed_inventory_state').value);
      }
    }
    // OrderedReaction immediately follows the same acquired inventory owner.
    if (reaction) {
      if (selectedId !== reaction.id) {
        const result = reaction.recordSource(before, after, command, first.frame_rows, second.frame_rows, null, index, second.frame_packet);
        if (result) memory.put(EPISODE, `reaction_event:${before.revision}`, result, after.observation_ref, after.revision);
      }
      const state = reaction.state();
      if (state.control.length || state.packets.length || state.history.length) {
        memory.put(EPISODE, 'reaction_state', state, after.observation_ref, after.revision);
        reaction.restore(memory.get(EPISODE, 'reaction_state').value);
      }
    }
    // ReactiveContact follows OrderedReaction in the source sequence.
    // A selected reactive return is already acquired above; a foreign return
    // carries no reactive proposal or selected-contact experiment attribution.
    if (reactive) {
      if (selectedId !== reactive.id) {
        const result = await reactive.recordSource(before, after, command, first.frame_rows, second.frame_rows, null, index, second.frame_packet);
        if (result) memory.put(EPISODE, `reactive_event:${before.revision}`, result, after.observation_ref, after.revision);
      }
      const state = reactive.state();
      if (state.control || state.question) {
        memory.put(EPISODE, 'reactive_state', state, after.observation_ref, after.revision);
        reactive.restore(memory.get(EPISODE, 'reactive_state').value);
      }
    }
    // Symbols acquires only its selected proposal, already recorded above.
    // Preserve the source caller's state position after ReactiveContact and
    // before Workshop, without widening this owner to foreign returns.
    if (symbols && selectedId === symbols.id) {
      const state = symbols.state();
      memory.put(EPISODE, 'observed_symbol_transactions_state', state, after.observation_ref, after.revision);
      symbols.restore(memory.get(EPISODE, 'observed_symbol_transactions_state').value);
    }
    // Keep the original source reasoning fact separate from the native owner
    // envelope. Its methods survive scopes; current admission is remeasured.
    if (workshop && (workshop.mode_evidence.length || workshop.events.length)) {
      const state = workshop.state();
      memory.put(EPISODE, 'observed_ranked_workshop_state', state, after.observation_ref, after.revision);
      workshop.restore(memory.get(EPISODE, 'observed_ranked_workshop_state').value);
    }
    // Feedback owns its ordered interface independently of SharedSeries. The
    // source passively observes foreign actions at this position, but selected
    // Feedback returns have already been acquired above and must not be replayed.
    if (feedback) {
      if (selectedId !== feedback.id) {
        await feedback.record(before, after, command, first.frame_rows, second.frame_rows);
      }
      const state = feedback.state();
      // An official boundary clears layout while retaining the conditional
      // entry method. Both source cases require persistence and restoration.
      if (state.layout != null || state.entry_method != null) {
        this.retainFamilyState(feedback, 'feedback_sequence_state', transition);
      }
    }
    // Source passive departure acquisition occurs once after selected/family
    // returns and before the common GoalAccess transition owner.
    if (morphology) {
      const departures = await morphology.observeDepartures(before, after, first.frame_rows, second.frame_rows, command);
      if (departures.length) memory.put(EPISODE, `morphology_departure:${before.revision}`, departures, after.observation_ref, after.revision);
    }
  }

  async resume(execution: NativeExecution): Promise<NativeRuntimeYield> {
    this.check(execution);
    if (this.editing) throw new Error('A native graph edit is in progress');
    if (!this.current) throw new Error('No initialized native observation');
    if (this.kind !== 'boundary') return this.output();
    this.prefix = null; await this.timed(this.current.level, () => this.plan(execution)); return this.output();
  }

  private restoreFamilies(): void {
    if (!this.knowledge) throw new Error('Native knowledge store is not initialized');
    for (const family of this.families) {
      // stateValue validates both the root and all referenced fragments before
      // it reuses an immutable hydration. Never bypass that source of truth.
      const state = objectValue(this.knowledge.value(`family_state:${family.id}`));
      if (family.nativeState && family.restoreNative) family.restoreNative(state);
      else family.restore(structuredClone(state));
    }
  }

  private async persistFamilies(cause: DeltaCause, extra: NativeStoreWrite[] = [], evidenceId?: string): Promise<void> {
    if (!this.knowledge) throw new Error('Native knowledge store is not initialized');
    await this.knowledge.commit([...extra, ...(this.caller?.checkpointWrites() ?? []), ...(this.caller ? [{
      id: 'caller:lifecycle', kind: 'component_state' as const, component: 'common_caller.lifecycle',
      value: { acquiredTransitions: this.callerAcquisitions, boundaryReplays: this.callerBoundaryReplays },
      relations: [{ relation: 'reconciles_with', target: 'reasoning:memory' }],
    }] : []), ...this.families.map(family => ({
      id: `family_state:${family.id}`, kind: 'family_state' as const, family: family.id, value: familyCheckpoint(family),
      ...(evidenceId ? { evidence: [evidenceId] } : {}),
    }))], cause);
    this.authority?.didCheckpoint();
  }

  /** This is the real immutable Kernel graph, not a second inspection model. */
  inspectKnowledge(): KnowledgeMemory {
    if (!this.knowledge) throw new Error('Native knowledge store is not initialized');
    return this.knowledge.memory;
  }

  /** Validate the whole transaction before changing a single executable node. */
  async edit(input: NativeGraphEdit, execution: NativeExecution): Promise<NativeRuntimeYield> {
    this.check(execution);
    if (this.editing || this.kind !== 'boundary' || this.computeStart !== null || !this.knowledge) throw new NativeEditRejected('busy_edit', 'Edits require a sealed prefix with no planning or action in flight.');
    this.editing = true;
    try { return await this.applyEdit(input, execution); }
    finally { this.editing = false; }
  }

  private async applyEdit(input: NativeGraphEdit, execution: NativeExecution): Promise<NativeRuntimeYield> {
    const store = this.knowledge;
    if (!store) throw new NativeEditRejected('invalid_edit', 'Native knowledge has not been initialized.');
    let request: NativeGraphEdit;
    try { request = objectValue(immutableJson(input)) as unknown as NativeGraphEdit; }
    catch { throw new NativeEditRejected('invalid_edit', 'The edit must contain plain finite JSON data.'); }
    if (request.expectedGraphChain !== store.graphChain) throw new NativeEditRejected('stale_edit', 'The knowledge graph has changed since this edit was prepared.');
    const writes: NativeStoreWrite[] = [];
    const seen = new Set<string>();
    try {
      if (Object.keys(request).some(key => !['expectedGraphChain', 'reason', 'changes'].includes(key))
        || typeof request.reason !== 'string' || !request.reason.trim() || request.reason.length > 1000
        || !Array.isArray(request.changes) || request.changes.length < 1 || request.changes.length > 32) throw new Error('Invalid native graph edit transaction');
      for (const change of request.changes) {
        let write: NativeStoreWrite;
        if (change.type === 'set_family_enabled') {
          if (Object.keys(change).some(key => !['type', 'familyId', 'enabled'].includes(key)) || typeof change.enabled !== 'boolean'
            || !this.families.some(family => family.id === change.familyId)) throw new Error('An activation edit requires a registered family and a boolean');
          write = { id: `family_activation:${change.familyId}`, kind: 'family_activation', family: change.familyId, value: { enabled: change.enabled } };
        } else if (change.type === 'replace_program') {
          if (Object.keys(change).some(key => !['type', 'programId', 'module'].includes(key))) throw new Error('Invalid program replacement');
          write = await store.programReplacement(change.programId, change.module);
        } else throw new Error('Unsupported native knowledge edit');
        if (seen.has(write.id)) throw new Error('An edit can replace each node only once');
        seen.add(write.id); writes.push(write);
      }
    } catch (error) { throw new NativeEditRejected('invalid_edit', error instanceof Error ? error.message : String(error)); }
    this.check(execution);
    if (request.expectedGraphChain !== store.graphChain) throw new NativeEditRejected('stale_edit', 'The knowledge graph changed during edit validation.');
    const executionDigest = await store.executionDigest(writes);
    this.check(execution);
    await store.commit(writes, { workflow: 'native.graph.edit', step: 'sealed_prefix', statement: 'validated_transaction', reason: request.reason }, request.expectedGraphChain);
    this.executionDigest = executionDigest;
    this.note({ kind: 'knowledge_edit', reason: request.reason, nodes: writes.map(write => write.id),
      previous_graph_chain: request.expectedGraphChain, graph_chain: store.graphChain, native_execution_digest: executionDigest });
    return this.output();
  }

  authorizationIdentity(): NativeAuthorizationIdentity {
    const graphChain = this.knowledge?.graphChain;
    if (!graphChain || !this.executionDigest) throw new Error('Native authority is not initialized');
    // Read the live authoritative owners on every check. No ticket/result cache.
    return Object.freeze({ graphChain, nativeExecutionDigest: this.executionDigest });
  }

  snapshot(): NativeRuntimeSnapshot {
    return freeze({
      actions: this.actions, cycles: this.cycles, nodeCount: this.knowledge?.nodeCount ?? null, hypothesisCount: null, compositionCount: this.compositionIds.size,
      levelsCompleted: this.current?.levels_completed ?? 0, level: this.current?.level ?? 1,
      // note() owns and deeply freezes every entry. A fresh list preserves old
      // snapshots while sharing those immutable values. The service keeps its
      // detached copies; worker transport still copies each complete response.
      activeSeconds: (this.elapsedMs + this.runningMs()) / 1000, lastDecision: this.lastFamily, trace: this.trace.slice(), reason: this.reason,
      sourceCommit: this.sourceCommit, sourceDigest: this.sourceDigest, proposal: this.prefix?.proposal ?? null,
      implementation: NATIVE_V6_IMPLEMENTATION, coverage: { status: 'in_progress', registeredFamilies: this.families.map(f => f.id),
        sourceGroups: this.groups, emptySourceGroups: this.groups.filter(group => !group.families.length).map(group => group.id),
        partialEntryPoints: {},
        observedCompositionBranches: this.groups.some(group => group.entryPoints?.includes('observed_composition_services')) ? {
          owner: 'public_occurrence_recall', status: 'all_declared_branches_connected',
          connectedBranches: ['panel_service_plan', 'chamber_relation_plan', 'exposed_reception_plan', 'rooted_line_plan', 'reception_service_plan', 'reference_population_plan'],
          pendingBranches: [],
          qualification: 'Complete declared entry registration; inherited source closure and full original-caller parity remain partial.',
        } : null,
        sharedSeriesMemory: 'crossed_prefix_single_ancestor_owner_occurrence_recall_ancestors_observed_program_native_relations_typed_material_and_pose_radial_ports_field_service_rooted_quota_native_mark_support_framed_window_occluded_catalogue_and_view_queued_field_product_panel_labeled_sequence_trace_field_linked_packet_cell_placement_alternating_graph_coupled_support_composition_exposed_reception_relational_chamber_panel_service_rooted_line_reception_service_and_reference_population; observed_composition_services 6/6 declared branches connected; inherited ObservedCompositionConstraint source closure remains partial',
        sharedSeriesDigestScope: SHARED_SERIES_DIGEST_SCOPE,
        nativeCallerExtensions: NATIVE_CALLER_EXTENSIONS,
        supportSubcompositionsPending: this.acquisitionFamilies?.supports.pendingSubcompositions ?? null, fullV6Parity: false },
      srcDecision: this.selectionReceipt,
      whyAct: this.authority?.snapshot() ?? { enabled: false, scope: 'injected_family_test_runtime' },
      caller: this.caller ? { enabled: true, acquiredTransitions: this.callerAcquisitions, boundaryReplays: this.callerBoundaryReplays,
        goalEvents: this.caller.goalEventCount, frontierDeltas: this.caller.deltaSequence,
        components: Object.fromEntries(CALLER_COMPONENTS.map(component => {
          const id = `caller:${component}`; return [component, { id, revision: this.knowledge!.node(id).revision }];
        })), pendingSourceProviders: ['morphology'],
        morphologyProvider: { status: 'partial_current_measurements_control_attention_and_methods',
          state_owner: 'family_state:morphology', motion_owner: 'caller:goal',
          forecast_owner: 'family_state:public_observed_inventory',
          current_decision_scope: 'one_source_selection_cycle', attention_owner: 'caller:attention',
          method_owner: 'caller:counters.targetMethod', entry_return_owner: 'family_state:morphology.entry_access_return',
          connected_methods: ['retained_station_method', 'entry_access_return', 'entry_rebind',
            'entry_probe', 'managed_capacity', 'target_extension_continuation'],
          pending: ['complete_original_caller_parity_and_domain_closure'] },
        scope: 'native common acquisition and connected providers; remaining source families are still in migration' }
        : { enabled: false, scope: 'injected_family_test_runtime' },
      ...(this.knowledge?.graphChain ? { graphChain: this.knowledge.graphChain, graphRevision: this.knowledge.revision } : {}),
      ...(this.executionDigest ? { nativeExecutionDigest: this.executionDigest } : {}),
      knowledgeProfile: NATIVE_STORE_PROFILE,
      prefix: this.prefix ? { revision: this.prefix.revision, planned: this.prefix.proposal.actions.length, executed: this.prefix.witnessed.length, nextIndex: this.prefix.index } : null,
      acquiredRecords: this.acquiredRecordCount, levelActions: Object.fromEntries(this.levelActions),
      familyStateRefs: Object.fromEntries(this.families.map(f => {
        const id = `family_state:${f.id}`; return [f.id, { id, revision: this.knowledge?.memory.nodes[id]?.revision ?? null }];
      })),
    });
  }
  private output(): NativeRuntimeYield {
    const prefix = this.prefix;
    return freeze({ kind: this.kind, reason: this.reason,
      command: this.kind === 'action' && prefix ? prefix.proposal.actions[prefix.index]! : null,
      authorization: this.kind === 'action' && prefix && this.observation ? {
        observation_ref: this.observation.observation_ref, decision_revision: prefix.revision, action_index: prefix.index,
      } : null, snapshot: this.snapshot() });
  }
  close(reason: string): void { this.closed = true; this.kind = 'stopped'; this.reason = reason; }
}

/** Shared caller providers use the same retained Goal/Frontier/View objects. */
function nativeCallerFamilies(getCaller: () => NativeCallerCoordinator, meterForecast: () => R | null = () => null,
  morphologyDecision: (observation: Parameters<NativeFamily['propose']>[0]) => R | null = () => null): NativeFamily[] {
  type Offer = (caller: NativeCallerCoordinator, observation: Parameters<NativeFamily['propose']>[0],
    rows: Parameters<NativeFamily['propose']>[1], inputs: Parameters<NativeFamily['propose']>[2], remaining: number) => Promise<NativeProposal | R | null> | NativeProposal | R | null;
  const offers: Record<typeof CALLER_PROVIDERS[number], Offer> = {
    goal_access: (caller, observation, rows, inputs, remaining) => caller.goalOffer(observation, rows, inputs, remaining),
    pre_score_contact: (caller, observation, rows, inputs, remaining) => caller.preScoreOffer(observation, rows, inputs, remaining),
    scored_local_rewrite: (caller, observation, rows, inputs, remaining) => caller.scoredOffer(observation, rows, inputs, remaining),
    factored_material_return: (caller, observation, _rows, inputs, remaining) => caller.factoredOffer(observation, inputs, remaining),
    conditional_transit: (caller, observation, rows, inputs, remaining) => caller.passageOffer(observation, rows, inputs, remaining),
    attention_parent_return: (caller, observation, rows, inputs) => caller.attentionParentReturnOffer(observation, rows, inputs, morphologyDecision(observation)),
    returned_branch_contrast: (caller, observation, _rows, inputs) => caller.returnedBranchOffer(observation, inputs),
    information_goal: (caller, observation, rows, inputs, remaining) => caller.currentInformationOffer(observation, rows, inputs, remaining, meterForecast(), morphologyDecision(observation)),
    acquire_control_for_target: (caller, observation, rows, inputs) => caller.acquireControlForTarget(observation, rows, inputs, morphologyDecision(observation)),
    view: (caller, observation, rows, inputs, remaining) => caller.viewOffer(observation, rows, inputs, remaining),
    view_continuity: (caller, observation, _rows, inputs) => caller.continuityOffer(observation, inputs),
    observed_frontier: (caller, observation, _rows, inputs) => caller.frontierOffer(observation, inputs),
  };
  return CALLER_PROVIDERS.map(id => {
    const descriptor = { schema: 'logos-engine.v6.caller-provider.v1', provider: id, state_owner: 'caller' };
    return {
      id,
      propose: async (observation, rows, inputs, remaining) => {
        const result = await offers[id](getCaller(), observation, rows, inputs, remaining);
        if (result && (id === 'factored_material_return' || id === 'conditional_transit')) result.material_access_subquestion = id;
        return result as NativeProposal | null;
      },
      bind: proposal => getCaller().bind(proposal),
      unacquiredInquiryWitness: (proposal, observation) => getCaller().unacquiredInquiryWitness(proposal, observation),
      before: async (...args) => await getCaller().before(...args) as { admitted: boolean; reason: string },
      after: (...args) => getCaller().after(...args) as NativeAfterResult,
      // Goal/View/Frontier acquisition is universal and ordered by the common
      // caller; a selected provider must not replay it a second time.
      record: () => ({ events: [] }),
      state: () => ({ ...descriptor }),
      restore: state => { if (v6Canonical(state) !== v6Canonical(descriptor)) throw new TypeError('Caller provider state must reference the common owner'); },
    } satisfies NativeFamily;
  });
}

function fieldFamily(field: WindowConstraints): NativeFamily {
  const proposal = (value: NativeProposal) => value as unknown as FieldProposal;
  return {
    id: field.familyId,
    propose: async (observation, rows, inputs, remaining) => await field.propose(observation, rows, inputs, remaining) as unknown as NativeProposal | null,
    bind: (value, domain) => field.bind(proposal(value), domain),
    before: (value, index, publicPacket, observation) => field.before(proposal(value), index, observation, publicPacket.frame_rows),
    after: (value, index, before, after, _firstRows, secondRows) => field.after(proposal(value), index, before, after, secondRows),
    record: async (before, after, command, firstRows, secondRows, value, index) => ({ events: [field.record(before, after, command, firstRows, secondRows, proposal(value), index)] }),
    state: () => field.state(), restore: state => field.restore(state),
  };
}

/** These original families return one event and preserve absent action data. */
function originalEventFamily(family: OrbitConstraints | Containment | SurfaceProgram | CodeProgram | BandTransfer | ReductionTransport): NativeFamily {
  return {
    id: family.familyId,
    propose: async (observation, rows, inputs, remaining) => await family.propose(observation, rows, inputs, remaining) as NativeProposal | null,
    bind: (proposal, domain) => family.bind(proposal, domain),
    before: async (proposal, index, publicPacket, observation) => await family.before(proposal, index, publicPacket, observation) as { admitted: boolean; reason: string },
    after: (proposal, index, before, after, first, second) => family.after(proposal, index, before, after, first, second) as NativeAfterResult,
    record: (before, after, command, first, second, proposal, index, frames) => ({ events: [family.record(before, after, command, first, second, proposal, index, frames)] }),
    state: () => family.state(), restore: state => family.restore(state),
  };
}

/** Preserve the original strategy wrapper's semantic subquestion on the offer. */
function subquestionFamily(family: NativeFamily<any>, field: string, subquestion: string): NativeFamily {
  return {
    id: family.id,
    ...(family.attachPrograms ? { attachPrograms: (registry: Parameters<NonNullable<NativeFamily['attachPrograms']>>[0]) => family.attachPrograms!(registry) } : {}),
    propose: async (...args) => { const proposal = await family.propose(...args); if (proposal) proposal[field] = subquestion; return proposal; },
    ...(family.proposeInGroup ? { proposeInGroup: async (...args: Parameters<NonNullable<NativeFamily['proposeInGroup']>>) => {
      const proposal = await family.proposeInGroup!(...args); if (proposal) proposal[field] = subquestion; return proposal;
    } } : {}),
    ...(family.proposeInSubquestion ? { proposeInSubquestion: (...args: Parameters<NonNullable<NativeFamily['proposeInSubquestion']>>) => family.proposeInSubquestion!(...args) } : {}),
    ...(family.currentProposalRefusal ? { currentProposalRefusal: (...args: Parameters<NonNullable<NativeFamily['currentProposalRefusal']>>) => family.currentProposalRefusal!(...args) } : {}),
    ...(family.currentRequiredServiceWitness ? { currentRequiredServiceWitness: (...args: Parameters<NonNullable<NativeFamily['currentRequiredServiceWitness']>>) => family.currentRequiredServiceWitness!(...args) } : {}),
    ...(family.preservationObligations ? { preservationObligations: (...args: Parameters<NonNullable<NativeFamily['preservationObligations']>>) => family.preservationObligations!(...args) } : {}),
    ...(family.retainedSuccessWitness ? { retainedSuccessWitness: (...args: Parameters<NonNullable<NativeFamily['retainedSuccessWitness']>>) => family.retainedSuccessWitness!(...args) } : {}),
    ...(family.acquiredContinuationWitness ? { acquiredContinuationWitness: (...args: Parameters<NonNullable<NativeFamily['acquiredContinuationWitness']>>) => family.acquiredContinuationWitness!(...args) } : {}),
    ...(family.unacquiredInquiryWitness ? { unacquiredInquiryWitness: (...args: Parameters<NonNullable<NativeFamily['unacquiredInquiryWitness']>>) => family.unacquiredInquiryWitness!(...args) } : {}),
    ...(family.bind ? { bind: (proposal: NativeProposal, domain: ObservedInputDomain) => family.bind!(proposal, domain) } : {}),
    before: (...args) => family.before(...args), after: (...args) => family.after(...args), record: (...args) => family.record(...args),
    state: () => family.state(), restore: state => family.restore(state),
    ...(family.nativeState ? { nativeState: () => family.nativeState!() } : {}),
    ...(family.restoreNative ? { restoreNative: (state: Readonly<NativeRecord>) => family.restoreNative!(state) } : {}),
  };
}

/** A source child can be offered by goal access and material access without
 * carrying the latter wrapper's annotation into the former proposal. */
function groupedSubquestionFamily(family: NativeFamily<any>, group: string, field: string, subquestion: string): NativeFamily {
  const wrapped = subquestionFamily(family, field, subquestion);
  return { ...wrapped, propose: (...args) => family.propose(...args),
    proposeInGroup: async (selectedGroup, ...args) => {
      const proposal = family.proposeInGroup ? await family.proposeInGroup(selectedGroup, ...args) : await family.propose(...args);
      if (proposal && selectedGroup === group) proposal[field] = subquestion;
      return proposal;
    } };
}

/** Explicit adapter: the original visual family records one event, not a list. */
export function visualSequenceFamily(visual = new VisualSequences(), minimumRows?: number): NativeFamily {
  const proposal = (value: NativeProposal) => value as VisualSequenceProposal;
  return {
    id: 'visual_sequences',
    attachPrograms: registry => visual.attachPrograms(registry),
    propose: (observation, rows, inputs, remaining) => visual.propose(observation, rows, inputs, remaining),
    proposeInGroup: (group, observation, rows, inputs, remaining) => group === 'scored_local_rewrite'
      ? minimumRows ? visual.proposeContinuation(observation, rows, inputs, remaining, minimumRows) : null
      : visual.propose(observation, rows, inputs, remaining),
    bind: (value, domain) => visual.bind(proposal(value), domain),
    before: (value, index, publicPacket, observation) => visual.before(proposal(value), index, publicPacket, observation),
    after: (value, index, before, after, firstRows, secondRows) => visual.after(proposal(value), index, before, after, firstRows, secondRows),
    record: (before, after, command, firstRows, secondRows, value, index) => ({ events: [visual.record(before, after, command, firstRows, secondRows, proposal(value), index)] }),
    state: () => visual.state(), restore: state => visual.restore(state),
  };
}

/** One Feedback owner serves both source selection paths and passive returns. */
export function feedbackSequenceFamily(feedback = new FeedbackSequences()): NativeFeedbackFamily {
  const proposal = (value: NativeProposal) => value as FeedbackSequenceProposal;
  return {
    id: 'feedback_sequences',
    attachPrograms: registry => feedback.attachPrograms(registry),
    propose: (...args) => feedback.propose(...args),
    proposeInSubquestion: (_group, entry, ...args) => entry === 'observed_feedback_sequence'
      ? feedback.propose(...args) : null,
    currentProposalRefusal: observation => feedback.currentProposalRefusal(observation),
    bind: (value, domain) => feedback.bind(proposal(value), domain),
    before: (value, index, publicPacket, observation) => feedback.before(proposal(value), index, publicPacket, observation),
    after: (value, index, before, after, firstRows, secondRows) => feedback.after(proposal(value), index, before, after, firstRows, secondRows),
    record: async (before, after, command, firstRows, secondRows, value, index) => ({
      events: [await feedback.record(before, after, command, firstRows, secondRows,
        value ? proposal(value) : undefined, index)],
    }),
    state: () => feedback.state(), restore: state => feedback.restore(state),
  };
}
export interface NativeV6Declarations {
  common: { provided_objective: { definition: string }; input_domain: { max_point_occurrences: number }; ordered_support_transfer: OrderedSupportPolicy };
  strategy: { declarations: { configuration: R & {
    families: readonly string[]; regular_field_correspondence: SymmetryPolicy; information_goal?: { visual_sequences_first?: boolean; feedback_sequences_first?: boolean };
    program_construction: { ordered_subquestions: readonly string[] };
    factored_material_return: { ordered_subquestions: readonly string[] };
    window_constraints: { ordered_subquestions: readonly string[] };
  } }[] };
}
export async function loadNativeV6Declarations(): Promise<NativeV6Declarations> {
  const commonUrl = new URL('../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/common_frontier_policy.drm.json', import.meta.url);
  const strategyUrl = new URL('../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm', import.meta.url);
  const load = async (url: URL) => { const response = await fetch(url); if (!response.ok) throw new Error(`Native V6 declarations could not be loaded (${response.status})`); return response.json(); };
  const [common, strategy] = await Promise.all([load(commonUrl), load(strategyUrl)]); return { common, strategy };
}
/** Identifies native declarations/version, not a Python runtime or source binary. */
export async function createNativeV6Runtime(declarations?: NativeV6Declarations, options: { now?: () => number } = {}): Promise<NativeV6Runtime> {
  const loaded = declarations ?? await loadNativeV6Declarations();
  const symmetry = loaded.strategy.declarations[0]?.configuration.regular_field_correspondence;
  if (!symmetry || !loaded.common.ordered_support_transfer || !loaded.common.input_domain) throw new Error('Incomplete native V6 declarations');
  // Each selected proposal is returned only to the family that created it.
  const configuration = loaded.strategy.declarations[0]!.configuration;
  const ordered = subquestionFamily(new OrderedSupportTransfer(loaded.common.ordered_support_transfer) as unknown as NativeFamily,
    'material_access_subquestion', 'ordered_support_transfer');
  const visualFirst = configuration.information_goal?.visual_sequences_first === true;
  const feedbackFirst = configuration.information_goal?.feedback_sequences_first === true;
  const feedback = feedbackSequenceFamily();
  const windows = subquestionFamily(fieldFamily(new WindowConstraints()), 'field_subquestion', 'multiscale_constraints'), symmetric = fieldFamily(new SymmetricField(symmetry));
  const orbit = originalEventFamily(new OrbitConstraints()), containment = originalEventFamily(new Containment());
  const surface = subquestionFamily(originalEventFamily(new SurfaceProgram()), 'program_subquestion', 'surface_rewrite');
  const code = subquestionFamily(originalEventFamily(new CodeProgram()), 'program_subquestion', 'learned_code_program');
  const band = subquestionFamily(originalEventFamily(new BandTransfer()), 'material_access_subquestion', 'conserved_band_transfer');
  const framed = await FramedTransfer.create({ currentPointWitnessBinding: true, currentPublicPacketReceptions: true,
    currentUniformReceptionQuestions: true, currentSettledSupportReceptions: true,
    currentDirectedReceptionComposition: true });
  const outlineOwner = await OutlineService.create({ retainDomainRefusal: true, currentPublicAnnouncementContext: true, currentRecoveryQuestions: true });
  const outline = subquestionFamily(outlineOwner, 'material_access_subquestion', 'observed_outline_service');
  const reactive = await ReactiveContact.create(configuration.reactive_contact_continuation);
  const reaction = await OrderedReaction.create();
  const inventory = await ObservedInventory.create();
  const recolor = await TopologicalRecolor.create();
  const workshop = await RankedWorkshop.create();
  const symbols = await SymbolTransactions.create();
  const morphology = await NativeMorphologyFamily.create();
  const reductionOwner = new ReductionTransport({ boundedSearch: { maximumStates: 8192, maximumFrontier: 16384 } });
  const reduction = subquestionFamily({ ...originalEventFamily(reductionOwner),
    propose: async (observation, rows, inputs, remaining, execution) => await reductionOwner.propose(observation, rows, inputs, remaining, execution) as NativeProposal | null,
    currentProposalRefusal: observation => reductionOwner.currentProposalRefusal(observation),
    retainedSuccessWitness: observation => retainedReductionSuccess(reductionOwner.state(), observation),
    acquiredContinuationWitness: (proposal, observation) => reductionAcquiredContinuationWitness(reductionOwner.state(), proposal, observation),
  }, 'material_access_subquestion', 'supported_ternary_reduction');
  const visualContinuation = configuration.scored_local_rewrite.minimum_completed_rows_for_visual_continuation as number | undefined;
  const visual = visualFirst || visualContinuation ? visualSequenceFamily(new VisualSequences(), visualContinuation) : null;
  const interfaces = createNativeInterfaceFamilies();
  const recall = createNativeSharedSeriesFamily((configuration.window_constraints as R).occurrence_recall,
    configuration.coupled_support_composition, configuration.alternating_graph_composition,
    (configuration.window_constraints as R).cell_patch_composition,
    { currentProgramAccess: true, programControlDiscovery: true, programRelationLearning: true, extendedRootedMarkSupport: true,
      composedLabeledPredicates: true, distinguishTraceCellSupport: true },
    (configuration.window_constraints as R).radial_port_composition, (configuration.window_constraints as R).rooted_quota_composition,
    (configuration.window_constraints as R).product_panel_composition, (configuration.window_constraints as R).labeled_sequence_composition,
    (configuration.window_constraints as R).trace_field_composition, (configuration.window_constraints as R).linked_packet_composition,
    (configuration.window_constraints as R).queued_field_composition, (configuration.window_constraints as R).occluded_catalogue_composition,
    (configuration.window_constraints as R).typed_material_flow, (configuration.window_constraints as R).field_service_composition,
    configuration.observed_composition_services, (configuration.window_constraints as R).framed_window_composition,
    configuration.window_constraints as R, configuration.window_constraints as R);
  const policy = loaded.common as R;
  const preparations = new LinkedTemporalPreparation(policy.linked_contact,
    { boundedSearch: LINKED_TEMPORAL_NATIVE_SEARCH_BOUNDS });
  const linkedTemporal = subquestionFamily(preparations, 'program_subquestion', 'linked_temporal_preparation');
  const supportChildren: Record<string, NativeFamily<any>> = {
    ordered_support_transfer: ordered,
    joint_transport: new JointTransport(policy.joint_transport_question),
    invited_reduction: groupedSubquestionFamily(new InvitedReduction(policy.invited_reduction), 'factored_material_return', 'material_access_subquestion', 'invited_reduction'),
    contextual_compartments: subquestionFamily(new ContextualCompartments(policy.contextual_compartments), 'material_access_subquestion', 'contextual_compartments'),
    configured_arrivals: subquestionFamily(new ConfiguredArrivals(policy.configured_arrivals), 'program_subquestion', 'configured_arrivals'),
    fixed_origin: subquestionFamily(new FixedOrigin(policy), 'program_subquestion', 'fixed_origin'),
    subset_diagnosis: new SubsetDiagnosis(policy.subset_diagnosis),
    periodic_sums: subquestionFamily(new PeriodicSums(policy.periodic_sums), 'field_subquestion', 'periodic_sums'),
    reflected_cover: subquestionFamily(new ReflectedCover(policy.reflected_cover), 'field_subquestion', 'reflected_cover'),
    oriented_coupling: subquestionFamily(new OrientedCoupling(policy.oriented_coupling), 'material_access_subquestion', 'oriented_coupling'),
    metric_composition: subquestionFamily(new MetricComposition(policy.metric_composition), 'material_access_subquestion', 'metric_composition'),
    sliding_cavity: subquestionFamily(new SlidingCavity(policy), 'material_access_subquestion', 'sliding_cavity'),
    animated_contact: new AnimatedContact(policy.animated_contact_question),
  };
  const supports = new SupportNavigation(supportChildren, policy);
  const families: NativeFamily[] = [windows, symmetric, orbit, containment, surface, code, band, framed, outline, inventory, reactive, reaction, recolor, workshop, symbols, morphology, reduction, recall, supports, feedback, linkedTemporal, ...Object.values(supportChildren), ...(visual ? [visual] : []), ...Object.values(interfaces)];
  const registeredSubquestions = (order: readonly string[], registered: Record<string, NativeFamily>): string[] =>
    order.flatMap(question => registered[question] ? [registered[question].id] : []);
  // The cell, occurrence and program source entries share one acquired journal, but
  // each is consulted only at its own position in the original DRM order.
  const windowProviders: Record<string, NativeFamily> = {
    multiscale_constraints: windows, occluded_catalogue_composition: recall, queued_field_composition: recall, product_panel_composition: recall, labeled_sequence_composition: recall,
    linked_packet_composition: recall, trace_field_composition: recall,
    cell_patch_composition: recall, observed_occurrence_recall: recall,
    observed_program_composition: recall, typed_material_flow: recall, radial_port_composition: recall, observed_framed_analogy: framed,
    field_service_composition: recall, rooted_quota_composition: recall, framed_window_composition: recall, coupled_prefix_reference: recall, recurrent_series: recall, ...supportChildren,
  };
  const windowEntries = (configuration.window_constraints.ordered_subquestions as string[])
    .filter(question => windowProviders[question]);
  const groupMembers: Record<string, readonly string[]> = {
    goal_access: (configuration.goal_access_subquestions as string[]).flatMap(question => {
      if (['observed_composition_services', 'coupled_support_composition', 'alternating_graph_composition'].includes(question)) return [recall.id];
      if (question === 'scored_relation_access') return ['goal_access'];
      if (question === 'observed_support_access') return [supports.id];
      if (question === 'observed_feedback_sequence') return [feedback.id];
      return supportChildren[question] ? [supportChildren[question]!.id] : [];
    }),
    window_constraints: [...windowEntries.map(question => windowProviders[question]!.id), symmetric.id],
    orbit_constraints: [orbit.id], containment: [containment.id],
    surface: registeredSubquestions(configuration.program_construction.ordered_subquestions, { surface_rewrite: surface, learned_code_program: code, linked_temporal_preparation: linkedTemporal, ...interfaces, ...supportChildren }),
    pre_score_contact: ['pre_score_contact'],
    scored_local_rewrite: ['scored_local_rewrite', ...(visual && visualContinuation ? [visual.id] : [])],
    factored_material_return: configuration.factored_material_return.ordered_subquestions.flatMap(question => {
      const registered: Record<string, string> = { factored_material_return: 'factored_material_return', conditional_transit: 'conditional_transit',
        conserved_band_transfer: band.id, supported_ternary_reduction: reduction.id, ordered_support_transfer: ordered.id,
        observed_framed_transfer: framed.id, observed_outline_service: outline.id, observed_inventory_composition: inventory.id,
        reactive_contact_continuation: reactive.id, reactive_contact: reactive.id, ordered_reaction: reaction.id, topological_recolor: recolor.id,
        observed_ranked_workshop: workshop.id, observed_symbol_transaction: symbols.id };
      return registered[question] ? [registered[question]!] : supportChildren[question] ? [supportChildren[question]!.id] : [];
    }),
    returned_branch_contrast: ['returned_branch_contrast'],
    morphology: [morphology.id],
    attention_parent_return: ['attention_parent_return'],
    information_goal: [...(visual && visualFirst ? [visual.id] : []), ...(feedbackFirst ? [feedback.id] : []), 'information_goal'],
    acquire_control_for_target: ['acquire_control_for_target'],
    view: ['view', recall.id], view_continuity: ['view_continuity'], observed_frontier: ['observed_frontier'],
  };
  const goalEntryPoints = (configuration.goal_access_subquestions as string[]).flatMap<string | null>(question => {
    if (['observed_composition_services', 'coupled_support_composition', 'alternating_graph_composition'].includes(question)) return [question];
    if (question === 'observed_feedback_sequence') return [question];
    return ['scored_relation_access', 'observed_support_access'].includes(question) || supportChildren[question] ? [null] : [];
  });
  const materialEntryPoints = configuration.factored_material_return.ordered_subquestions.flatMap<string | null>(question => {
    if (['observed_framed_transfer', 'observed_inventory_composition', 'reactive_contact_continuation', 'reactive_contact', 'ordered_reaction', 'topological_recolor', 'observed_ranked_workshop', 'observed_symbol_transaction'].includes(question)) return [question];
    return ['factored_material_return', 'conditional_transit', 'conserved_band_transfer', 'supported_ternary_reduction', 'ordered_support_transfer', 'observed_outline_service'].includes(question)
      || supportChildren[question] ? [null] : [];
  });
  const groups: NativeSelectionGroup[] = loaded.strategy.declarations[0]!.configuration.families.map(id => ({
    id, families: groupMembers[id] ?? [], ...(id === 'goal_access' ? { entryPoints: goalEntryPoints }
      : id === 'window_constraints' ? { entryPoints: [...windowEntries.map(question => [recall, framed].includes(windowProviders[question]!) ? question : null), null] }
      : id === 'factored_material_return' ? { entryPoints: materialEntryPoints } : {}),
  }));
  // Some original policy declarations contain non-integer thresholds. This
  // implementation manifest uses explicit JSON.stringify encoding, as does the
  // existing V7 implementation manifest; it is not a V7 portable-JSON datum.
  const manifest = { sourceEncoding: 'json-stringify-v1', implementation: NATIVE_V6_IMPLEMENTATION, referenceCommit: NATIVE_V6_REFERENCE_COMMIT,
    declarations: loaded, families: [...families.map(f => f.id), ...CALLER_PROVIDERS], groups, authority: 'native_original_why_act', caller: 'native_common_coordinator',
    selectionProgram: nativeProgramDescriptions().find(program => program.id === 'v6.composition_strategy.choose')?.transitiveSourceHash ?? null,
    nativeCallerExtensions: NATIVE_CALLER_EXTENSIONS,
    fullV6Parity: false };
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(manifest)));
  const sourceDigest = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  return new NativeV6Runtime({ sourceDigest, families, groups, authorityPolicy: loaded.common, callerStrategy: configuration, acquisitionFamilies: { supports, recall, framed, outline: outlineOwner, inventory, reaction, reactive, recolor, workshop, symbols, morphology, feedback, preparations },
    maxPointOccurrences: loaded.common.input_domain.max_point_occurrences, ...(options.now ? { now: options.now } : {}) });
}
