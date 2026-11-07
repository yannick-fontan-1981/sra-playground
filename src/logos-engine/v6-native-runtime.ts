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
import { OrbitConstraints } from './v6-orbit-constraints.ts';
import { Containment } from './v6-containment.ts';
import { SurfaceProgram } from './v6-surface-program.ts';
import { CodeProgram } from './v6-code-program.ts';
import { BandTransfer } from './v6-band-transfer.ts';
import type { VisualSequenceProposal } from './v6-visual-sequences.ts';
import { nativeProgramDescriptions } from './v6-src-program.ts';
import type { NativeSrcReceipt } from './v6-src-program.ts';
import { arrayValue, immutableJson, objectValue, stringValue } from './canonical.ts';
import { NativeKnowledgeStore, NATIVE_STORE_PROFILE } from './v6-knowledge-store.ts';
import type { NativeStoreWrite, StoredNativeProgram } from './v6-knowledge-store.ts';
import type { DeltaCause, KnowledgeMemory } from './kernel.ts';
import { NativeEditRejected } from './v6-native-types.ts';
import { NativeCompositionAuthority } from './v6-native-authority.ts';
import type {
  NativeAfterResult, NativeBudgets, NativeCommand, NativeExecution, NativeFamily, NativeInitialize, NativeOutcome,
  NativeGraphEdit, NativeProposal, NativePublicObservation, NativeRecord, NativeRuntimeSnapshot, NativeRuntimeYield, NativeV6Backend,
} from './v6-native-types.ts';

export const NATIVE_V6_REFERENCE_COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
export const NATIVE_V6_IMPLEMENTATION = 'logos-engine.typescript.v6.native-migration/0.3.0';
const SELECTION_PROGRAM = 'v6.composition_strategy.choose';
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
}
export interface NativeV6RuntimeConfiguration {
  sourceDigest: string; families: readonly NativeFamily[]; maxPointOccurrences: number; now?: () => number;
  /** Source DRM groups retain their order even while some implementations are pending. */
  groups?: readonly { readonly id: string; readonly families: readonly string[] }[];
  /** Production supplies the original objective policy and enables the real WHY/ACT gate. */
  authorityPolicy?: { provided_objective: { definition: string } };
}

export class NativeV6Runtime implements NativeV6Backend {
  readonly sourceCommit = NATIVE_V6_REFERENCE_COMMIT;
  readonly sourceDigest: string;
  private readonly families: readonly NativeFamily[];
  private readonly groups: readonly { readonly id: string; readonly families: readonly string[] }[];
  private readonly domain: ObservedInputDomain;
  private readonly now: () => number;
  private readonly authorityPolicy?: { provided_objective: { definition: string } };
  private authority: NativeCompositionAuthority | null = null;
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
  private records: NativeRecord[] = [];
  private compositions = new Map<string, NativeRecord>();
  private lastFamily: string | null = null;
  private knowledge: NativeKnowledgeStore | null = null;
  private executionDigest: string | null = null;
  private selectionProgram: StoredNativeProgram | null = null;
  private selectionReceipt: NativeSrcReceipt | null = null;
  private planning: { execution: NativeExecution; inputs: readonly NativeCommand[]; offers: Map<string, { family: NativeFamily; proposal: NativeProposal } | null> } | null = null;

  constructor(configuration: NativeV6RuntimeConfiguration) {
    if (!configuration.sourceDigest || !configuration.families.length
      || new Set(configuration.families.map(f => f.id)).size !== configuration.families.length
      || configuration.families.some(f => typeof f.restore !== 'function')) throw new TypeError('A native implementation identity and distinct state-restorable families are required');
    this.sourceDigest = configuration.sourceDigest; this.families = [...configuration.families];
    this.groups = structuredClone(configuration.groups ?? this.families.map(family => ({ id: family.id, families: [family.id] })));
    if (!this.groups.length || this.groups.length > 16 || new Set(this.groups.map(group => group.id)).size !== this.groups.length
      || this.groups.some(group => group.families.some(id => !this.families.some(family => family.id === id)))) throw new TypeError('Native selection requires 1–16 declared groups of registered families');
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
        { id: `family_state:${family.id}`, kind: 'family_state' as const, family: family.id, value: family.state(),
          relations: [{ relation: 'controlled_by', target: `family_activation:${family.id}` }] },
        { id: `family_activation:${family.id}`, kind: 'family_activation' as const, family: family.id, status: 'active' as const, value: { enabled: true } },
      ]), { workflow: SELECTION_PROGRAM, step: 'initialize', statement: 'family.install' });
      for (const family of this.families) await family.attachPrograms?.(this.knowledge);
      this.observation = freeze(await measureNativeObservation(this.current!, 1, this.sessionId));
      if (this.authorityPolicy) {
        this.authority = new NativeCompositionAuthority(this.authorityPolicy, input.budgets.targetLevels);
        await this.authority.initialize(this.knowledge, this.observation);
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
    const selected = await this.selectFamily(execution);
    if (selected) {
      const { family, proposal } = selected;
      if (proposal.status !== 'proposed' || !Array.isArray(proposal.actions) || proposal.actions.length < 1 || proposal.actions.length > Math.min(16, this.remaining())
        || !Array.isArray(proposal.steps) || proposal.steps.length !== proposal.actions.length) throw new Error(`Invalid committed prefix from ${family.id}`);
      await family.bind?.(proposal, this.domain);
      for (const step of proposal.steps) if (step.locus_witness && !step.point_binding) step.point_binding = structuredClone(step.locus_witness);
      if (this.authority) {
        const target = await this.authority.bind(proposal, this.observation);
        if (!target.admitted) { this.stop(`composition_target_${target.reason}`); return; }
      }
      this.revision = this.observation.revision;
      this.prefix = { family, proposal: freeze(structuredClone(proposal)), revision: this.revision, index: 0, witnessed: [], released: false, interruption: null };
      this.lastFamily = family.id;
      for (const composition of proposal.compositions ?? []) if (typeof composition.id === 'string') this.compositions.set(composition.id, freeze(structuredClone(composition)));
      this.note({ kind: 'proposal', family: family.id, revision: this.revision, actions: proposal.actions, question: proposal.question ?? null });
      if (!await this.authorize(execution)) this.stop(this.budgetReason() ?? 'no_admissible_prefix');
      return;
    }
    await this.persistFamilies({ workflow: SELECTION_PROGRAM, step: 'selection', statement: 'no_candidate' });
    this.stop('no_applicable_transferred_family');
  }

  /** Original V6 family-selection SRC tree, interpreted by the V7 TS engine. */
  private async selectFamily(execution: NativeExecution): Promise<{ family: NativeFamily; proposal: NativeProposal } | null> {
    if (!this.current || !this.observation) throw new Error('Missing current selection context');
    this.planning = { execution, inputs: this.domain.candidates(this.observation), offers: new Map() };
    try {
      if (!this.knowledge) throw new Error('Native knowledge store is not initialized');
      this.selectionProgram ??= await this.knowledge.registerProgram(SELECTION_PROGRAM, {
        'families.begin': () => ({ pending: true, done: false, index: 0, progress: 0, visited: [] }),
        'families.offer': async args => {
          const session = objectValue(args.session), index = session.index;
          if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0 || index >= this.groups.length || !this.planning || !this.current || !this.observation) throw new Error('Invalid native family selection cursor');
          const group = this.groups[index]!;
          this.check(this.planning.execution); await this.planning.execution.yieldControl(); this.check(this.planning.execution);
          let offered: { family: NativeFamily; proposal: NativeProposal } | null = null;
          for (const id of group.families) {
            const family = this.families.find(candidate => candidate.id === id)!;
            const enabled = objectValue(this.knowledge!.value(`family_activation:${family.id}`)).enabled === true;
            const proposal = enabled ? await family.propose(this.observation, this.current.frame_rows, this.planning.inputs, this.remaining(), this.planning.execution) : null;
            if (proposal) { offered = { family, proposal }; break; }
          }
          this.planning.offers.set(group.id, offered);
          return { family: group.id, selected: offered !== null };
        },
        'families.finish': args => {
          const session = objectValue(args.session), trial = objectValue(args.trial);
          return { ...session, pending: false, done: true, progress: Number(session.progress) + 1,
            selected: stringValue(trial.family), visited: [...arrayValue(session.visited), trial.family!] };
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
      return offered;
    } finally { this.planning = null; }
  }

  private async authorize(execution: NativeExecution): Promise<boolean> {
    this.check(execution);
    if (!this.prefix || !this.current || !this.observation) throw new Error('No native prefix to authorize');
    if (this.budgetReason()) return false;
    const { family, proposal, index } = this.prefix, command = proposal.actions[index];
    if (!command || !this.current.available_action_refs.includes(command.action_ref)) return false;
    const before = await family.before(proposal, index, this.current, this.observation);
    const point = await ObservedInputDomain.pointGuard(this.current, command, proposal.steps![index] as { point_binding?: LocusWitness });
    this.note({ kind: 'before_guard', family: family.id, index, admitted: before.admitted, reason: before.reason, point_bound: point });
    this.check(execution);
    if (!before.admitted || !point || this.budgetReason()) {
      this.prefix.interruption = !before.admitted ? `path_premise_changed:${before.reason}` : !point ? 'addressed_occurrence_changed' : this.budgetReason();
      return false;
    }
    if (!this.prefix.released) {
      if (this.authority && !await this.authority.release(proposal, this.observation, before, execution)) {
        this.prefix.interruption = 'src_action_set_not_released'; return false;
      }
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
      const result = await prefix.family.after(prefix.proposal, prefix.index, before, after, first.frame_rows, this.current!.frame_rows);
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
    for (const transition of prefix.witnessed) {
      this.check(execution);
      const record = await prefix.family.record(transition.before, transition.after, transition.command,
        transition.first.frame_rows, transition.second.frame_rows, prefix.proposal, transition.index, transition.second.frame_packet);
      this.records.push(freeze(structuredClone({ family: prefix.family.id, revision: prefix.revision, index: transition.index, record })));
    }
    this.cycles += 1;
    const composed = this.authority ? await this.authority.acquire(prefix.proposal, prefix.revision, prefix.witnessed, prefix.interruption, execution) : null;
    this.note({ kind: 'sealed_prefix', family: prefix.family.id, revision: prefix.revision, acquired_actions: prefix.witnessed.length });
    const evidenceId = `prefix_evidence:${prefix.revision}`;
    await this.persistFamilies({ workflow: SELECTION_PROGRAM, step: 'sealed_prefix', statement: 'outcome.acquire' }, [{
      id: evidenceId, kind: 'prefix_evidence', family: prefix.family.id, status: 'observed',
      value: { decision_revision: prefix.revision, proposal: prefix.proposal, selection: this.selectionReceipt,
        composed_reconciliation: composed,
        transitions: prefix.witnessed.map(transition => ({ command: transition.command,
          before: transition.before.observation_ref, after: transition.after.observation_ref, outcome: transition.outcome })) },
      relations: [{ relation: 'records', target: `family_state:${prefix.family.id}` }, { relation: 'selected_by', target: `program:${SELECTION_PROGRAM}` }],
    }, ...(this.authority?.checkpointWrites() ?? [])], evidenceId);
    this.restoreFamilies();
    this.kind = 'boundary'; this.reason = null;
    const reason = this.budgetReason(); if (reason) this.stop(reason);
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
    for (const family of this.families) family.restore(structuredClone(objectValue(this.knowledge.value(`family_state:${family.id}`))));
  }

  private async persistFamilies(cause: DeltaCause, extra: NativeStoreWrite[] = [], evidenceId?: string): Promise<void> {
    if (!this.knowledge) throw new Error('Native knowledge store is not initialized');
    await this.knowledge.commit([...extra, ...this.families.map(family => ({
      id: `family_state:${family.id}`, kind: 'family_state' as const, family: family.id, value: family.state(),
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

  snapshot(): NativeRuntimeSnapshot {
    return freeze({
      actions: this.actions, cycles: this.cycles, nodeCount: this.knowledge?.nodeCount ?? null, hypothesisCount: null, compositionCount: this.compositions.size,
      levelsCompleted: this.current?.levels_completed ?? 0, level: this.current?.level ?? 1,
      activeSeconds: (this.elapsedMs + this.runningMs()) / 1000, lastDecision: this.lastFamily, trace: structuredClone(this.trace), reason: this.reason,
      sourceCommit: this.sourceCommit, sourceDigest: this.sourceDigest, proposal: this.prefix?.proposal ?? null,
      implementation: NATIVE_V6_IMPLEMENTATION, coverage: { status: 'in_progress', registeredFamilies: this.families.map(f => f.id),
        sourceGroups: this.groups, emptySourceGroups: this.groups.filter(group => !group.families.length).map(group => group.id), fullV6Parity: false },
      srcDecision: this.selectionReceipt,
      whyAct: this.authority?.snapshot() ?? { enabled: false, scope: 'injected_family_test_runtime' },
      ...(this.knowledge?.graphChain ? { graphChain: this.knowledge.graphChain, graphRevision: this.knowledge.revision } : {}),
      ...(this.executionDigest ? { nativeExecutionDigest: this.executionDigest } : {}),
      knowledgeProfile: NATIVE_STORE_PROFILE,
      prefix: this.prefix ? { revision: this.prefix.revision, planned: this.prefix.proposal.actions.length, executed: this.prefix.witnessed.length, nextIndex: this.prefix.index } : null,
      acquiredRecords: this.records.length, levelActions: Object.fromEntries(this.levelActions),
      familyStates: Object.fromEntries(this.families.map(f => [f.id, this.knowledge ? this.knowledge.value(`family_state:${f.id}`) : structuredClone(f.state())])),
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
function originalEventFamily(family: OrbitConstraints | Containment | SurfaceProgram | CodeProgram | BandTransfer): NativeFamily {
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
function subquestionFamily(family: NativeFamily, field: string, subquestion: string): NativeFamily {
  return {
    id: family.id,
    ...(family.attachPrograms ? { attachPrograms: (registry: Parameters<NonNullable<NativeFamily['attachPrograms']>>[0]) => family.attachPrograms!(registry) } : {}),
    propose: async (...args) => { const proposal = await family.propose(...args); if (proposal) proposal[field] = subquestion; return proposal; },
    ...(family.bind ? { bind: (proposal: NativeProposal, domain: ObservedInputDomain) => family.bind!(proposal, domain) } : {}),
    before: (...args) => family.before(...args), after: (...args) => family.after(...args), record: (...args) => family.record(...args),
    state: () => family.state(), restore: state => family.restore(state),
  };
}

/** Explicit adapter: the original visual family records one event, not a list. */
export function visualSequenceFamily(visual = new VisualSequences()): NativeFamily {
  const proposal = (value: NativeProposal) => value as VisualSequenceProposal;
  return {
    id: 'visual_sequences',
    attachPrograms: registry => visual.attachPrograms(registry),
    propose: (observation, rows, inputs, remaining) => visual.propose(observation, rows, inputs, remaining),
    bind: (value, domain) => visual.bind(proposal(value), domain),
    before: (value, index, publicPacket, observation) => visual.before(proposal(value), index, publicPacket, observation),
    after: (value, index, before, after, firstRows, secondRows) => visual.after(proposal(value), index, before, after, firstRows, secondRows),
    record: (before, after, command, firstRows, secondRows, value, index) => ({ events: [visual.record(before, after, command, firstRows, secondRows, proposal(value), index)] }),
    state: () => visual.state(), restore: state => visual.restore(state),
  };
}
export interface NativeV6Declarations {
  common: { provided_objective: { definition: string }; input_domain: { max_point_occurrences: number }; ordered_support_transfer: OrderedSupportPolicy };
  strategy: { declarations: { configuration: {
    families: readonly string[]; regular_field_correspondence: SymmetryPolicy; information_goal?: { visual_sequences_first?: boolean };
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
export async function createNativeV6Runtime(declarations?: NativeV6Declarations): Promise<NativeV6Runtime> {
  const loaded = declarations ?? await loadNativeV6Declarations();
  const symmetry = loaded.strategy.declarations[0]?.configuration.regular_field_correspondence;
  if (!symmetry || !loaded.common.ordered_support_transfer || !loaded.common.input_domain) throw new Error('Incomplete native V6 declarations');
  // Each selected proposal is returned only to the family that created it.
  const configuration = loaded.strategy.declarations[0]!.configuration;
  const ordered = subquestionFamily(new OrderedSupportTransfer(loaded.common.ordered_support_transfer) as unknown as NativeFamily,
    'material_access_subquestion', 'ordered_support_transfer');
  const visualFirst = configuration.information_goal?.visual_sequences_first === true;
  const windows = subquestionFamily(fieldFamily(new WindowConstraints()), 'field_subquestion', 'multiscale_constraints'), symmetric = fieldFamily(new SymmetricField(symmetry));
  const orbit = originalEventFamily(new OrbitConstraints()), containment = originalEventFamily(new Containment());
  const surface = subquestionFamily(originalEventFamily(new SurfaceProgram()), 'program_subquestion', 'surface_rewrite');
  const code = subquestionFamily(originalEventFamily(new CodeProgram()), 'program_subquestion', 'learned_code_program');
  const band = subquestionFamily(originalEventFamily(new BandTransfer()), 'material_access_subquestion', 'conserved_band_transfer');
  const visual = visualFirst ? visualSequenceFamily() : null;
  const families: NativeFamily[] = [windows, symmetric, orbit, containment, surface, code, band, ordered, ...(visual ? [visual] : [])];
  const registeredSubquestions = (order: readonly string[], registered: Record<string, NativeFamily>): string[] =>
    order.flatMap(question => registered[question] ? [registered[question].id] : []);
  const groupMembers: Record<string, readonly string[]> = {
    window_constraints: [...registeredSubquestions(configuration.window_constraints.ordered_subquestions, { multiscale_constraints: windows }), symmetric.id],
    orbit_constraints: [orbit.id], containment: [containment.id],
    surface: registeredSubquestions(configuration.program_construction.ordered_subquestions, { surface_rewrite: surface, learned_code_program: code }),
    factored_material_return: registeredSubquestions(configuration.factored_material_return.ordered_subquestions, { conserved_band_transfer: band, ordered_support_transfer: ordered }),
    information_goal: visual ? [visual.id] : [],
  };
  const groups = loaded.strategy.declarations[0]!.configuration.families.map(id => ({ id, families: groupMembers[id] ?? [] }));
  // Some original policy declarations contain non-integer thresholds. This
  // implementation manifest uses explicit JSON.stringify encoding, as does the
  // existing V7 implementation manifest; it is not a V7 portable-JSON datum.
  const manifest = { sourceEncoding: 'json-stringify-v1', implementation: NATIVE_V6_IMPLEMENTATION, referenceCommit: NATIVE_V6_REFERENCE_COMMIT,
    declarations: loaded, families: families.map(f => f.id), groups, authority: 'native_original_why_act',
    selectionProgram: nativeProgramDescriptions().find(program => program.id === 'v6.composition_strategy.choose')?.transitiveSourceHash ?? null,
    fullV6Parity: false };
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(manifest)));
  const sourceDigest = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  return new NativeV6Runtime({ sourceDigest, families, groups, authorityPolicy: loaded.common, maxPointOccurrences: loaded.common.input_domain.max_point_occurrences });
}
