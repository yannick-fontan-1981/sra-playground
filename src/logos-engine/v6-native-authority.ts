/** Real source WHY/ACT and post-prefix acquisition, backed by common V7 nodes. */
import { NativeReasoningMemory, TREE_SHA256 } from './v6-reasoning-memory.ts';
import type { ReasoningDynamicState, ReasoningMemoryState } from './v6-reasoning-memory.ts';
import { NativeSrcBridge, NeutralEngine } from './v6-composition-engine.ts';
import type { CompositionBridgeState, CompositionReport } from './v6-composition-engine.ts';
import { CompositionTargetTree, mainObjective, postAnalysis, protocolProjection, stateCompositions } from './v6-target-binding.ts';
import { predictCandidateRule, predictPropertyRule } from './v6-transition-learning.ts';
import { assessNativeTransitionDomain } from './v6-native-transition-domain.ts';
import { pythonEqual as same } from './v6-operations.ts';
import { objectValue } from './canonical.ts';
import { symbolicDigest } from './v6-hash.ts';
import type { KnowledgeNode } from './kernel.ts';
import type { NativeKnowledgeStore, NativeStoreWrite } from './v6-knowledge-store.ts';
import type { NativeAfterResult, NativeCommand, NativeExecution, NativeObservation, NativeProposal, NativePublicObservation } from './v6-native-types.ts';
type R = Record<string, any>;
const EPISODE = 'common-observation-frontier';
const MEMORY_INDEX = 'logos-engine.v6.reasoning-memory-index.v1';
const factId = (episode: string, key: string): string => `reasoning:fact:${symbolicDigest([episode, key])}`;
const traceId = (id: number): string => `reasoning:trace:${id}`;
// Checkpoint acknowledgements compare actual stored types, including Float64
// signed zero. Python's True == 1 equality is unsuitable for this cache guard.
function sameStoredValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object'
    || Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key)
    && sameStoredValue((left as R)[key], (right as R)[key]));
}
function frozenSource<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) frozenSource(child); Object.freeze(value);
  }
  return value;
}
export interface NativeAuthorityTransition {
  command: NativeCommand; before: NativeObservation; after: NativeObservation;
  first: NativePublicObservation; second: NativePublicObservation; index: number; outcome: NativeAfterResult;
}
/** Acquisition is ordered around assessment, never performed twice by callers. */
export interface NativeAuthorityAcquisition {
  beforeAssessment(transition: NativeAuthorityTransition): Promise<R>;
  recordAssessment(transition: NativeAuthorityTransition, assessment: R | null): Promise<R>;
  boundaryWitness(transition: NativeAuthorityTransition): R;
}
function summary(observation: NativeObservation): R {
  return { ...Object.fromEntries(['revision', 'level_epoch', 'frame_hash', 'state', 'levels_completed', 'unknowns'].map(key => [key, observation[key]])),
    component_count: observation.entities.length, unambiguous_signature_components: observation.entities.filter(entity => !entity.identity_ambiguous).length };
}
export class NativeCompositionAuthority {
  readonly memory = new NativeReasoningMemory();
  readonly bridge = new NativeSrcBridge(new NeutralEngine(this.memory), { continuous: true });
  readonly target = new CompositionTargetTree();
  readonly objective: R;
  private store: NativeKnowledgeStore | null = null;
  private catalogRevision: number | null = null;
  private restoredMemoryNode: KnowledgeNode | null = null;
  private restoredNativeRevision: number | null = null;
  private retainedEntries = new Map<string, { version: number; node: KnowledgeNode }>();
  private pendingCheckpoint: { revision: number; index: R; entries: Map<string, {
    version: number; node: KnowledgeNode | undefined; written: boolean; record: unknown;
  }> } | null = null;
  private frozen: R | null = null;
  private lastRelease: CompositionReport | null = null;
  private lastAnalysis: R[] = [];
  constructor(policy: R, targetLevels: number) { this.objective = mainObjective(policy, targetLevels); }

  async initialize(store: NativeKnowledgeStore, observation: NativeObservation): Promise<void> {
    this.store = store; this.memory.importCatalog();
    this.memory.put(EPISODE, 'main_objective', this.objective, 'explicit-user-official-completion-objective', 0);
    this.memory.put(EPISODE, 'composition_target', null, 'fresh_episode', 0);
    this.memory.put(EPISODE, 'property_rules', [], observation.observation_ref, observation.revision);
    const state = this.memory.state(), { facts: _facts, traces: _traces, ...catalog } = state;
    await store.commit([{ id: 'reasoning:catalog', kind: 'reasoning_catalog', component: 'native_reasoning_memory', status: 'retained', value: catalog,
      definition: { reference_commit: '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e', tree_sha256: TREE_SHA256 } }, ...this.checkpointWrites()],
    { workflow: 'prototype.laya_router.route', step: 'initialize', statement: 'reasoning.install' });
    this.didCheckpoint();
    await this.bridge.attachPrograms(store);
  }

  /** Every prepare/persist boundary reads the actual retained facts and cache. */
  restore(): void {
    if (!this.store) throw new Error('Native composition authority is not initialized');
    this.pendingCheckpoint = null;
    const catalogNode = this.store.node('reasoning:catalog');
    const memoryNode = this.store.node('reasoning:memory');
    // Catalog data is immutable and still comes from its real versioned node.
    // Only a revision change requires rebuilding its large validated indices.
    if (this.catalogRevision !== catalogNode.revision) {
      const catalog = objectValue(this.store.stateValue('reasoning:catalog'));
      this.memory.restore({ ...catalog, ...this.retainedDynamicState() } as unknown as ReasoningMemoryState);
      this.catalogRevision = catalogNode.revision;
      this.rememberEntries(memoryNode);
    } else if (memoryNode !== this.restoredMemoryNode || !this.retainedNodesCurrent()
      || this.memory.nativeCheckpoint().revision !== this.restoredNativeRevision) {
      this.memory.restoreDynamic(this.retainedDynamicState()); this.rememberEntries(memoryNode);
    }
    this.bridge.restore(this.store.stateValue('reasoning:bridge') as unknown as CompositionBridgeState);
    if (!same(this.memory.get(EPISODE, 'main_objective').value, this.objective)) throw new Error('Retained principal objective changed');
  }
  /** A complete source-compatible snapshot, reconstructed from current nodes. */
  retainedDynamicState(): ReasoningDynamicState {
    if (!this.store) throw new Error('Native composition authority is not initialized');
    const index = objectValue(this.store.stateValue('reasoning:memory')) as R;
    if (index.schema !== MEMORY_INDEX || !Array.isArray(index.facts) || !Array.isArray(index.traces)
      || [...index.facts, ...index.traces].some(id => typeof id !== 'string')
      || new Set(index.facts).size !== index.facts.length || new Set(index.traces).size !== index.traces.length) throw new TypeError('Invalid retained native reasoning index');
    const facts = index.facts.map((id: string) => {
      const fact = this.store!.stateValue(id) as R;
      if (id !== factId(fact.episode, fact.key)) throw new TypeError('Reasoning fact reference has a different identity');
      return fact;
    });
    const traces = index.traces.map((id: string) => {
      const trace = this.store!.stateValue(id) as R;
      if (id !== traceId(trace.id)) throw new TypeError('Reasoning trace reference has a different identity');
      return trace;
    });
    return { facts, traces } as ReasoningDynamicState;
  }
  private rememberEntries(memoryNode: KnowledgeNode): void {
    const checkpoint = this.memory.nativeCheckpoint(); this.retainedEntries.clear();
    for (const entry of checkpoint.facts) {
      const id = factId(entry.record.episode, entry.record.key);
      this.retainedEntries.set(id, { version: entry.version, node: this.store!.node(id) });
    }
    for (const entry of checkpoint.traces) {
      const id = traceId(entry.record.id); this.retainedEntries.set(id, { version: entry.version, node: this.store!.node(id) });
    }
    this.restoredMemoryNode = memoryNode; this.restoredNativeRevision = checkpoint.revision;
  }
  private retainedNodesCurrent(): boolean {
    return [...this.retainedEntries].every(([id, entry]) => this.store?.memory.nodes[id] === entry.node);
  }
  /** Called only after the containing V7 transaction succeeds. */
  didCheckpoint(): void {
    const pending = this.pendingCheckpoint; this.pendingCheckpoint = null;
    if (!pending || !this.store?.memory.nodes['reasoning:memory']
      || pending.revision !== this.memory.nativeCheckpoint().revision) return;
    const index = this.store.stateValue('reasoning:memory') as R;
    if (!sameStoredValue(index, pending.index)) return;
    const retained = new Map<string, { version: number; node: KnowledgeNode }>();
    for (const [id, entry] of pending.entries) {
      const node = this.store.memory.nodes[id];
      // Unwritten entries keep their acquired identity. Written entries are
      // acknowledged only after reading their actually committed value.
      if (!node || (entry.written ? !sameStoredValue(this.store.stateValue(id), entry.record) : node !== entry.node)) return;
      retained.set(id, { version: entry.version, node });
    }
    this.retainedEntries = retained;
    this.restoredMemoryNode = this.store.node('reasoning:memory'); this.restoredNativeRevision = pending.revision;
  }
  checkpointWrites(): NativeStoreWrite[] {
    if (this.restoredMemoryNode && (this.store?.memory.nodes['reasoning:memory'] !== this.restoredMemoryNode || !this.retainedNodesCurrent())) {
      this.pendingCheckpoint = null;
      throw new Error('Native reasoning graph changed; restore before checkpoint');
    }
    const checkpoint = this.memory.nativeCheckpoint(), writes: NativeStoreWrite[] = [];
    const facts: string[] = [], traces: string[] = [];
    const entries: NonNullable<NativeCompositionAuthority['pendingCheckpoint']>['entries'] = new Map();
    const retain = (id: string, version: number, record: unknown, component: string): void => {
      const previous = this.retainedEntries.get(id);
      const written = !previous || previous.version !== version;
      entries.set(id, { version, node: previous?.node, written, record });
      if (written) {
        writes.push({ id, kind: 'component_state', component, value: record, relations: [{ relation: 'retained_by', target: 'reasoning:memory' }] });
      }
    };
    for (const entry of checkpoint.facts) { const id = factId(entry.record.episode, entry.record.key); facts.push(id); retain(id, entry.version, entry.record, 'native_reasoning_fact'); }
    for (const entry of checkpoint.traces) { const id = traceId(entry.record.id); traces.push(id); retain(id, entry.version, entry.record, 'native_reasoning_trace'); }
    const index = { schema: MEMORY_INDEX, native_revision: checkpoint.revision, facts, traces };
    this.pendingCheckpoint = { revision: checkpoint.revision, index, entries };
    return [...writes, { id: 'reasoning:memory', kind: 'component_state', component: 'native_reasoning_memory',
      value: index,
      relations: [{ relation: 'uses_catalog', target: 'reasoning:catalog' }] },
    { id: 'reasoning:bridge', kind: 'component_state', component: 'composition_bridge', value: this.bridge.state(),
      relations: [{ relation: 'reads', target: 'reasoning:memory' }, { relation: 'executes', target: 'program:prototype.laya_router.route' }] }];
  }
  private async checkpoint(statement: string, extra: NativeStoreWrite[] = []): Promise<void> {
    if (!this.store) throw new Error('Native composition authority is not initialized');
    await this.store.commit([...extra, ...this.checkpointWrites()], { workflow: 'prototype.laya_router.route', step: 'native_memory', statement });
    this.didCheckpoint();
  }
  private async run(request: R, execution: NativeExecution): Promise<CompositionReport> {
    await this.checkpoint('before.prepare'); this.restore();
    const report = await this.bridge.run(request, { signal: execution.signal });
    await this.checkpoint('after.persist'); return report;
  }

  async bind(proposal: NativeProposal, observation: NativeObservation): Promise<R> {
    const receipt = this.target.bind(proposal, observation, this.objective, this.memory.get(EPISODE, 'composition_target').value);
    proposal.composition_target_tree = receipt;
    this.memory.put(EPISODE, 'composition_target', receipt, observation.observation_ref, observation.revision);
    await this.checkpoint('target.bind');
    return receipt;
  }

  async release(proposal: NativeProposal, observation: NativeObservation, guard: { admitted: boolean; reason: string; native_binding_receipt?: R }, execution: NativeExecution): Promise<boolean> {
    const template = proposal.bundle_template as R, target = proposal.composition_target_tree as R;
    if (!target?.admitted || !guard.admitted) return false;
    if (!template || !['OP18', 'OP28'].includes(template.operation_key)) throw new Error('Unsupported physical frontier operation');
    if (!proposal.steps || proposal.steps.length !== proposal.actions.length || proposal.steps.some(step => !Object.hasOwn(step, 'expected_after'))) {
      throw new Error('Committed prefix lacks an explicit known/unknown expectation for each step');
    }
    const revision = observation.revision, ref = template.composition_ref;
    const bundle: R = { ...template, id: 'B0', observation_revision: revision, level_epoch: observation.level_epoch,
      target_tree_path: target.path, target_tree_observation: target.observation_ref, kind: template.operation_key === 'OP18' ? 'probe' : 'realize',
      actions: proposal.actions, preserve_refs: template.preserve_refs ?? [], outcome_guard: { path: ['value'], contains: template.operation_key === 'OP18' ? ref : 'B0' } };
    const claims: R[] = proposal.steps.flatMap((step, index) => Object.hasOwn(step, 'point_binding') ? [{ index, ...step.point_binding as R }] : []);
    if (claims.length) { bundle.point_bindings = claims; bundle.evidence = [...bundle.evidence, ...claims.map(claim => `${claim.observation_ref}/${claim.entity_ref}`)]; }
    let registry: R[] = [], registryRevision: number | null = null;
    try { const remembered = this.memory.nativeGet(EPISODE, 'empirical_registry'); registry = remembered.value; registryRevision = remembered.revision; } catch (error) { if (!(error instanceof RangeError)) throw error; }
    const properties: R[] = this.memory.nativeGet(EPISODE, 'property_rules').value;
    const first = proposal.actions[0]!;
    this.frozen = frozenSource({ before_observation_ref: observation.observation_ref, prior_rules: registry, prior_property_rules: properties,
      first_action: first, candidate_predictions: await Promise.all(registry.map(rule => predictCandidateRule(rule, observation, first))),
      addressed_predictions: first.action_ref === 'ACTION6' ? await Promise.all(properties.map(async rule => ({ action: first, prediction: await predictPropertyRule(rule, observation, first) }))) : [],
      selected_experiment: (proposal.question as R)?.experiment ?? null, selected_control: (proposal.question as R)?.control_experiment ?? null,
      scope: 'first-action mechanism predictions are conditional; later path steps use frozen historical protocol expectations from the committed proposal' });
    this.memory.put(EPISODE, 'state', { level_epoch: observation.level_epoch, observation_revision: revision, facts: proposal.facts ?? {},
      compositions: stateCompositions(proposal, this.objective), bundles: [{ id: 'B0', composition_ref: ref, admitted: guard.admitted, actions: proposal.actions }],
      memory_hint: { current_observation: summary(observation), main_objective_memory_revision: this.memory.get(EPISODE, 'main_objective').revision,
        path_refs: proposal.route_refs ?? [], library_registry_revision: registryRevision } }, observation.observation_ref, revision);
    await this.checkpoint('prediction.freeze', [{ id: `reasoning:prediction:${revision}`, kind: 'component_state', component: 'prospective_predictions', value: this.frozen,
      evidence: [observation.observation_ref], relations: [{ relation: 'tests', target: 'reasoning:memory' }] },
      ...(guard.native_binding_receipt ? [{ id: `reasoning:binding:${revision}`, kind: 'transition_evidence' as const,
        component: 'native_current_input_binding', status: 'observed' as const,
        value: { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, frame_hash: observation.frame_hash,
          command: first, guard: structuredClone(guard), qualification: 'Current public input binding retained before ordinary WHY/ACT release; no physical effect or terminal role is inferred.' },
        evidence: [observation.observation_ref], relations: [{ relation: 'supports', target: 'reasoning:memory' }] }] : [])]);
    const report = await this.run({ episode: EPISODE, id: `frontier-${revision}`, level_epoch: observation.level_epoch, policy: 'code_only', context: bundle.purpose,
      bundles: { B0: bundle }, candidates: ['B0'], relevant_compositions: stateCompositions(proposal, this.objective).map(composition => composition.id) }, execution);
    this.lastRelease = report;
    if (report.decision.model_calls?.length) throw new Error('Unexpected neural selection');
    return report.decision.status === 'action_set_released' && same(report.decision.action_set, bundle);
  }

  async acquire(proposal: NativeProposal, decisionRevision: number, transitions: readonly NativeAuthorityTransition[], interruption: string | null,
    execution: NativeExecution, caller?: NativeAuthorityAcquisition): Promise<R> {
    if (!transitions.length || !this.store) throw new Error('Only an observed native prefix can be acquired');
    const transitionRefs: R[] = [], boundaryRefs: R[] = [], writes: NativeStoreWrite[] = [];
    let boundary = false;
    for (const transition of transitions) {
      const { before, after, command } = transition;
      const acquired = caller ? await caller.beforeAssessment(transition) : null;
      const id = `reasoning:transition:${before.revision}`;
      boundary = after.level_epoch !== before.level_epoch || after.levels_completed > before.levels_completed || ['WIN', 'GAME_OVER'].includes(after.state);
      let record: R;
      if (boundary) {
        record = { status: 'official_boundary_witness', before: before.observation_ref, after: after.observation_ref,
          command, source_level: before.level_epoch, levels_completed: after.levels_completed, visual_terminal_cause: 'unknown' };
        if (caller) {
          record.boundary_witness = caller.boundaryWitness(transition);
          record.frontier_acquisition = await caller.recordAssessment(transition, null);
        }
        boundaryRefs.push({ node: id, before: before.observation_ref, after: after.observation_ref });
      } else {
        let prior: R[] = this.frozen?.prior_rules ?? [];
        if (transition.index !== 0) { try { prior = this.memory.nativeGet(EPISODE, 'empirical_registry').value; } catch (error) { if (!(error instanceof RangeError)) throw error; } }
        const priorProperties = command.action_ref === 'ACTION6'
          ? transition.index === 0 ? this.frozen?.prior_property_rules ?? [] : this.memory.nativeGet(EPISODE, 'property_rules').value : [];
        const { assessment, predictionChecks: checks, updateRegistries } = await assessNativeTransitionDomain(
          before, after, command, prior, priorProperties, transition.index === 0);
        if (updateRegistries && command.action_ref === 'ACTION6') {
          this.memory.nativePut(EPISODE, 'property_rules', assessment.property_rules, after.observation_ref, after.revision);
        }
        record = { before: before.observation_ref, after: after.observation_ref, command, assessment,
          prospective_prediction_checks: checks, prospective_prediction_node: transition.index === 0 ? `reasoning:prediction:${decisionRevision}` : null,
          prospective_claim: transition.index === 0 ? 'first-action candidates frozen before dispatch' : 'mechanism fitting retrospective; only committed path-protocol expectation tested prospectively' };
        if (!updateRegistries) {
          // Retain the complete unassessed witness for later reasoning. The
          // V7 fragment store shares immutable rasters/measurements, including
          // the observation reused by adjacent transitions. Nothing is clipped.
          record.unassessed_public_transition = frozenSource({
            before: { measurement: before, packet: transition.first },
            after: { measurement: after, packet: transition.second },
          });
        }
        if (caller) record.frontier_acquisition = await caller.recordAssessment(transition, assessment);
        if (updateRegistries) this.memory.nativePut(EPISODE, 'empirical_registry', assessment.empirical_rules, after.observation_ref, after.revision);
        transitionRefs.push({ node: id, before: before.observation_ref, after: after.observation_ref });
      }
      if (caller) record.caller_acquisition = acquired;
      writes.push({ id, kind: 'transition_evidence', component: 'public_transition', status: 'observed', value: record,
        evidence: [before.observation_ref, after.observation_ref], relations: [{ relation: 'updates', target: 'reasoning:memory' }] });
    }
    const after = transitions.at(-1)!.after, template = proposal.bundle_template as R;
    const record: R = { decision_revision: decisionRevision, released_composition_ref: template.composition_ref, released_operation: template.operation_key,
      executed_actions: transitions.map(transition => transition.command), released_actions_count: proposal.actions.length, executed_prefix_count: transitions.length,
      transition_refs: transitionRefs, boundary_refs: boundaryRefs, interruption,
      step_expectations: transitions.map(transition => ({ action_index: transition.index, status: transition.outcome.matched === true ? 'matched' : transition.outcome.matched === false ? 'diverged' : 'unknown',
        expected: proposal.steps![transition.index]!.expected_after, observed: protocolProjection(transition.second, transition.after.revision, this.store!.scope),
        frontier_outcome: transition.outcome, scope: 'conditional public projection comparison; unknown effect is not confirmation' })),
      final_observation_ref: after.observation_ref, scope: 'one composed reconciliation after sealed set; transition extraction is mechanical evidence only',
      evidence_storage: 'versioned_kernel_nodes' };
    const target = proposal.composition_target_tree as R;
    if (target.route_key) this.memory.put(EPISODE, 'composition_target', CompositionTargetTree.seal(target, record), after.observation_ref, after.revision);
    await this.checkpoint('transition.acquire', writes);
    this.lastAnalysis = await postAnalysis(this.memory, { run: request => this.run(request, execution) }, EPISODE, after, after.revision, this.objective, record, boundary);
    this.frozen = null; return record;
  }

  snapshot(): R {
    return { enabled: true, program: 'prototype.laya_router.route', decision: this.lastRelease,
      analysis: this.lastAnalysis, memory: this.memory.stats(), bridgeSequence: this.bridge.sequence,
      target: this.memory.get(EPISODE, 'composition_target').value };
  }
}
