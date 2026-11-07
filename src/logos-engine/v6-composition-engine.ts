/**
 * Native WHY/ACT transfer of engine.py, composition.py, NeutralEngine.prepare,
 * and src_bridge.py at 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 *
 * The actual router.src tree runs through the shared V7 SRC interpreter. Its
 * callbacks inspect symbolic evidence; only their enclosing prepare/persist
 * boundaries read/write reasoning memory. This module has no game transport.
 */
import { execute, pythonEqual, pythonTruthy } from './v6-operations.ts';
import { OPERATIONS, TREE_SHA256 } from './v6-reasoning-memory.ts';
import type { ReasoningWindow } from './v6-reasoning-memory.ts';
import { NativeSrcProgram } from './v6-src-program.ts';
import type { ExecutionOptions, JsonObject, Primitive } from './ir.ts';
import type { NativeProgramHandle, NativeProgramRegistry } from './v6-native-types.ts';

export type CompositionRecord = Record<string, any>;
export interface ReasoningMemoryPort {
  get(episode: string, key: string): { value: any; evidence: string; revision: number };
  put(episode: string, key: string, value: any, evidence?: string, revision?: number): void;
  window(key: string): ReasoningWindow;
  trace(episode: string, kind: string, value: any): void;
}
export interface CompositionReport extends CompositionRecord {
  src_status: 'completed';
  src_hash: string;
  src_statement_count_last_slice: number;
  decision: CompositionRecord;
  total_ms?: number;
}
export interface CompositionEngineState {
  schema: 'logos-engine.v6.composition-engine.v1';
  tree_sha: string;
  windows: [string, ReasoningWindow][];
  last_result: CompositionRecord | null;
}
export interface CompositionBridgeState {
  schema: 'logos-engine.v6.composition-bridge.v1';
  continuous: boolean;
  sequence: number;
  engine: CompositionEngineState;
}
export type CompositionProgram = NativeProgramHandle;
/** Optional host keeps the same executable IR inside the shared editable store. */
export type CompositionProgramHost = NativeProgramRegistry;

const copy = <T>(value: T): T => structuredClone(value);
const has = (value: object, key: PropertyKey): boolean => Object.hasOwn(value, key);
function requireField(value: CompositionRecord, key: string): any {
  if (!has(value, key)) throw new TypeError(`Missing composition field: ${key}`);
  return value[key];
}
function get(value: CompositionRecord, key: string, fallback: any = null): any { return has(value, key) ? value[key] : fallback; }
function increment(value: any): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new TypeError('SRC progress requires an integer');
  return value + 1;
}
function contains(container: any, value: any): boolean {
  if (Array.isArray(container)) return container.some(item => pythonEqual(item, value));
  if (typeof container === 'string') {
    if (typeof value !== 'string') throw new TypeError('String membership requires a string');
    return container.includes(value);
  }
  if (container !== null && typeof container === 'object') {
    if (typeof value !== 'string') throw new TypeError('Symbolic map membership requires a string key');
    return has(container, value);
  }
  throw new TypeError('Outcome guard requires an iterable value');
}
function pathItem(value: any, part: any): any {
  if (Array.isArray(value) || typeof value === 'string') {
    const indexValue = typeof part === 'boolean' ? Number(part) : part;
    if (!Number.isInteger(indexValue)) throw new TypeError('Sequence guard index must be an integer');
    const items = typeof value === 'string' ? [...value] : value;
    const index = indexValue < 0 ? items.length + indexValue : indexValue;
    if (index < 0 || index >= items.length) throw new RangeError('Outcome guard index is outside the sequence');
    return items[index];
  }
  if (value === null || typeof value !== 'object' || typeof part !== 'string' || !has(value, part)) throw new TypeError('Outcome guard path is unbound');
  return value[part];
}

/** Model branches are explicitly unavailable, never simulated or replaced. */
export class NativeModelUnavailableError extends Error {
  readonly code = 'native_model_unavailable';
  readonly capability = 'laya.system_one';
  constructor() {
    super('Actual Laya is required for this model branch; no model or simulated fallback is available in the native agent');
    this.name = 'NativeModelUnavailableError';
  }
}

/** Base symbolic engine, retaining all non-model branches of engine.py. */
export class NativeEngine {
  readonly memory: ReasoningMemoryPort;
  readonly tree_sha = TREE_SHA256;
  readonly windows = new Map<string, ReasoningWindow>();
  last_result: CompositionRecord | null = null;
  constructor(memory: ReasoningMemoryPort) { this.memory = memory; }

  /** Actual engine caches; reasoning facts/catalog are checkpointed by memory. */
  state(): CompositionEngineState {
    return copy({ schema: 'logos-engine.v6.composition-engine.v1', tree_sha: this.tree_sha,
      windows: [...this.windows], last_result: this.last_result });
  }
  restore(state: CompositionEngineState): void {
    const input = copy(state);
    if (input.schema !== 'logos-engine.v6.composition-engine.v1' || input.tree_sha !== this.tree_sha || !Array.isArray(input.windows)) {
      throw new TypeError('Composition engine checkpoint is not bound to this source');
    }
    const windows = new Map<string, ReasoningWindow>();
    for (const [key, window] of input.windows) {
      if (typeof key !== 'string' || windows.has(key) || window.current.key !== key || !Array.isArray(window.neighbors)) {
        throw new TypeError('Invalid composition window checkpoint');
      }
      windows.set(key, window);
    }
    if (input.last_result !== null && (typeof input.last_result !== 'object' || Array.isArray(input.last_result))) {
      throw new TypeError('Invalid composition result checkpoint');
    }
    this.windows.clear(); for (const [key, window] of windows) this.windows.set(key, window);
    this.last_result = input.last_result;
  }

  prepare(request: CompositionRecord): CompositionRecord {
    const result = copy(request);
    if (has(result, 'expected')) throw new TypeError('Evaluation label leaked into runtime');
    const episode = requireField(result, 'episode'), recalled = this.memory.get(episode, 'state');
    result.state = recalled.value; result.revision = recalled.revision; result.state_evidence = recalled.evidence;
    result.tree_sha = this.tree_sha;
    const key = get(result, 'current_key', OPERATIONS.OP01!.authority_refs[0]!);
    result.current_key = key; this.windows.set(key, this.memory.window(key));
    for (const candidate of get(result, 'navigation', [])) {
      const target = requireField(candidate, 'target'); this.windows.set(target, this.memory.window(target));
    }
    result.window = this.windows.get(key)!;
    return result;
  }
  src_begin(request: CompositionRecord): CompositionRecord {
    return { request, pending: true, done: false, progress: 0, phase: 'choice', trace: [], model_calls: [], selected: null,
      current_key: requireField(request, 'current_key'), status: 'pending', action: null };
  }
  src_context(session: CompositionRecord): CompositionRecord {
    const result = copy(session), request = result.request, policy = requireField(request, 'policy');
    result.release_phase = result.phase === 'release'; result.navigation_phase = pythonTruthy(get(request, 'navigation'));
    result.release_allowed = pythonTruthy(get(result, 'guard_satisfied', false)); result.code_only = policy === 'code_only';
    const candidates = requireField(request, 'candidates');
    result.can_force = candidates.length === 1 && policy !== 'model_only';
    if (!candidates.length || new Set(candidates).size !== candidates.length) throw new TypeError('Invalid candidate domain');
    return result;
  }
  src_unique(session: CompositionRecord): CompositionRecord {
    const candidates = session.request.candidates;
    if (candidates.length !== 1) throw new TypeError('No unique formal transition');
    return { key: candidates[0], method: 'formal_unique', model_ms: 0 };
  }
  src_abstain(_session: CompositionRecord): CompositionRecord { return { key: 'ABSTAIN', method: 'code_abstention', model_ms: 0 }; }
  src_laya(_session: CompositionRecord): never { throw new NativeModelUnavailableError(); }

  src_apply(session: CompositionRecord, choice: CompositionRecord): CompositionRecord {
    const result = copy(session), request = result.request, selected = requireField(choice, 'key');
    result.progress = increment(result.progress); result.selected = selected;
    result.trace.push({ kind: 'choice', key: selected, method: choice.method, tree_sha: request.tree_sha, revision: request.revision });
    if (choice.method === 'laya') result.model_calls.push(choice);
    if (selected === 'ABSTAIN') { Object.assign(result, { pending: false, done: true, status: 'abstained' }); return result; }
    if (!contains(request.candidates, selected) || request.tree_sha !== this.tree_sha) throw new Error('Choice/source binding rejected');
    const navigation: CompositionRecord[] = get(request, 'navigation', []);
    if (navigation.some(candidate => candidate.id === selected)) {
      const target = navigation.find(candidate => candidate.id === selected)!;
      if (!pythonEqual(target.revision, request.revision) || !this.windows.has(target.target)) throw new Error('Stale or absent jump target');
      result.trace.push({ kind: 'cognitive_jump', from: result.current_key, to: target.target, relation: target.relation, game_undo: false });
      result.current_key = target.target; Object.assign(result, { pending: false, done: true, status: 'navigated' }); return result;
    }
    if (!has(OPERATIONS, selected)) throw new RangeError(`Unknown symbolic operation: ${selected}`);
    const target = OPERATIONS[selected]!.authority_refs[0]!;
    result.trace.push({ kind: 'cognitive_jump', from: result.current_key, to: target, relation: 'operation_reference', game_undo: false,
      scope: 'related_clause_not_production_implementation_proof' }); result.current_key = target;
    if (!has(request, 'action')) { Object.assign(result, { pending: false, done: true, status: 'operation_selected' }); return result; }
    const output = execute(selected, request.state); result.operation_result = output;
    const guard = requireField(request, 'outcome_guard'); let value: any = output, accepted = false;
    try {
      for (const part of requireField(guard, 'path')) value = pathItem(value, part);
      accepted = has(guard, 'equals') ? pythonEqual(value, guard.equals) : contains(value, requireField(guard, 'contains'));
    } catch (error) {
      if (!(error instanceof TypeError || error instanceof RangeError)) throw error;
      accepted = false;
    }
    const safety = requireField(request, 'safety');
    result.guard_satisfied = accepted && pythonTruthy(requireField(safety, 'authorized')) && pythonTruthy(requireField(safety, 'evidence'));
    result.phase = 'release'; return result;
  }
  src_navigate(session: CompositionRecord, choice: CompositionRecord): CompositionRecord {
    const result = this.src_apply(session, choice);
    result.has_continuation = result.status === 'navigated' && pythonTruthy(get(result.request, 'after_navigation')); return result;
  }
  src_resume(session: CompositionRecord): CompositionRecord {
    const result = copy(session), continuation = requireField(result.request, 'after_navigation');
    delete result.request.after_navigation; requireField(result.request, 'navigation'); delete result.request.navigation;
    Object.assign(result.request, continuation);
    const window = this.windows.get(result.current_key);
    if (!window) throw new RangeError('Navigation continuation has no recalled target window');
    result.request.window = window; Object.assign(result, { pending: true, done: false, status: 'pending', phase: 'choice' }); return result;
  }
  src_complete_navigation(session: CompositionRecord): CompositionRecord { return session; }
  src_release(session: CompositionRecord): CompositionRecord {
    if (!pythonTruthy(requireField(session, 'release_allowed'))) throw new Error('SRC release guard missing');
    const result = copy(session); result.action = requireField(result.request, 'action');
    result.symbolic_post_state = { last_action: result.action, revision: increment(result.request.revision) };
    result.trace.push({ kind: 'symbolic_action', action: result.action, guard_evidence: result.request.safety.evidence, game_io: false });
    Object.assign(result, { pending: false, done: true, status: 'symbolic_action_applied', progress: increment(result.progress) }); return result;
  }
  src_reject(session: CompositionRecord): CompositionRecord {
    const result = copy(session); Object.assign(result, { pending: false, done: true, status: 'action_guard_rejected', progress: increment(result.progress) }); return result;
  }
  src_result(session: CompositionRecord): CompositionRecord {
    this.last_result = Object.fromEntries(Object.entries(session).filter(([key]) => key !== 'request' && key !== 'window')); return this.last_result;
  }
  persist(request: CompositionRecord, report: CompositionReport): void {
    const episode = request.episode;
    this.memory.trace(episode, 'src_decision', report);
    this.memory.put(episode, 'current_key', report.decision.current_key, 'measured-src-prototype', request.revision);
    if (pythonTruthy(get(report.decision, 'action'))) this.memory.put(episode, 'symbolic_last_action', report.decision.action,
      'symbolic-guard-not-real-game', increment(request.revision));
  }
}

export function validateBundle(bundle: CompositionRecord, state: CompositionRecord, revision: number): boolean {
  const required = ['id', 'operation_key', 'composition_ref', 'objective_ref', 'preserve_refs', 'observation_revision', 'kind', 'actions', 'purpose', 'preconditions', 'evidence'];
  const missing = required.filter(key => !has(bundle, key)).sort();
  if (missing.length) throw new TypeError(`Incomplete composition contract: [${missing.map(key => `'${key}'`).join(', ')}]`);
  const domain = new Set(requireField(state, 'compositions').map((composition: CompositionRecord) => requireField(composition, 'id')));
  const refs = new Set([bundle.composition_ref, bundle.objective_ref, ...bundle.preserve_refs]);
  if ([...refs].some(ref => !domain.has(ref)) || !has(OPERATIONS, bundle.operation_key)) throw new TypeError('Unknown composition or operation reference');
  if (!pythonEqual(bundle.observation_revision, revision)) throw new TypeError('Stale composition contract');
  if (!['analysis', 'realize', 'probe'].includes(bundle.kind)) throw new TypeError('Unknown action-set kind');
  if (bundle.kind !== 'analysis' && !(bundle.actions.length >= 1 && bundle.actions.length <= 32)) throw new TypeError('Unbounded or empty action set');
  const facts = get(state, 'facts', {}), conditions = Object.entries(bundle.preconditions).every(([key, value]) => has(facts, key) && pythonEqual(facts[key], value));
  const evidence = get(bundle, 'preservation_evidence', {});
  const preservation = bundle.preserve_refs.every((key: string) => has(evidence, key) && pythonTruthy(evidence[key]));
  return pythonTruthy(conditions && preservation && bundle.evidence);
}
export function operationAdmission(bundle: CompositionRecord, result: CompositionRecord): CompositionRecord {
  const operation = requireField(bundle, 'operation_key');
  if (!['OP14', 'OP18', 'OP28'].includes(operation)) return { accepted: false, reason: 'physical_operation_contract_unspecified' };
  const expected = operation === 'OP28' ? bundle.id : bundle.composition_ref, guard = { path: ['value'], contains: expected };
  if (!pythonEqual(get(bundle, 'outcome_guard'), guard)) return { accepted: false, reason: 'missing_or_mismatched_outcome_guard' };
  const values = get(result, 'value');
  const accepted = result.operation === operation && result.status === 'complete_on_supplied_state' && Array.isArray(values) && contains(values, expected);
  return { accepted, reason: accepted ? 'operation_selected_reference' : 'operation_did_not_select_reference', guard };
}

/** Work is committed as a composition-bound action set, never a model guess. */
export class CompositionEngine extends NativeEngine {
  override prepare(request: CompositionRecord): CompositionRecord {
    let result = copy(request);
    if (Object.keys(result).some(key => key.startsWith('expected_'))) throw new TypeError('Evaluator labels must not enter runtime');
    if (!has(result, 'current_key')) {
      try { result.current_key = this.memory.get(result.episode, 'current_key').value; }
      catch (error) { if (!(error instanceof RangeError)) throw error; }
    }
    result = super.prepare(result);
    result.admissions = Object.fromEntries(Object.entries(result.bundles).map(([key, bundle]) => [key, validateBundle(bundle as CompositionRecord, result.state, result.revision)]));
    if (Object.entries(result.bundles).some(([key, bundle]) => key !== (bundle as CompositionRecord).id)) throw new TypeError('Bundle identity mismatch');
    for (const navigation of get(result, 'navigation', [])) if (!pythonEqual(navigation.revision, result.revision)) throw new TypeError('Stale navigation');
    const domain = new Set([...Object.keys(result.bundles), ...get(result, 'navigation', []).map((navigation: CompositionRecord) => navigation.id)]);
    if (result.candidates.some((key: string) => !domain.has(key))) throw new TypeError('Candidate outside declared domain');
    result.composition_context = result.state.compositions.filter((composition: CompositionRecord) => result.relevant_compositions.includes(composition.id))
      .map((composition: CompositionRecord) => Object.fromEntries(['id', 'things', 'properties', 'relations', 'context', 'knowledge_status', 'role'].map(key => [key, get(composition, key)])));
    return result;
  }
  override src_laya(_session: CompositionRecord): never { throw new NativeModelUnavailableError(); }
  override src_apply(session: CompositionRecord, choice: CompositionRecord): CompositionRecord {
    const request = session.request, key = requireField(choice, 'key');
    if (key === 'ABSTAIN' || get(request, 'navigation', []).some((navigation: CompositionRecord) => navigation.id === key)) return super.src_apply(session, choice);
    const result = copy(session);
    if (!contains(request.candidates, key) || request.tree_sha !== this.tree_sha) throw new Error('Source-bound choice rejected');
    const bundle = requireField(request.bundles, key);
    result.selected = key; result.selected_bundle = bundle; result.progress = increment(result.progress);
    result.trace.push({ kind: 'composition_choice', bundle: key, operation: bundle.operation_key, composition_ref: bundle.composition_ref, revision: request.revision });
    if (choice.method === 'laya') result.model_calls.push(choice);
    const target = OPERATIONS[bundle.operation_key]!.authority_refs[0]!;
    result.trace.push({ kind: 'cognitive_jump', from: result.current_key, to: target, game_undo: false }); result.current_key = target;
    const facts = { ...request.state, focus: bundle.composition_ref, preserve_refs: bundle.preserve_refs };
    result.operation_result = execute(bundle.operation_key, facts);
    if (bundle.kind === 'analysis') Object.assign(result, { pending: false, done: true, status: 'composition_analysis' });
    else {
      result.operation_admission = operationAdmission(bundle, result.operation_result);
      result.trace.push({ kind: 'operation_admission', bundle: key, ...result.operation_admission });
      result.guard_satisfied = pythonTruthy(requireField(request.admissions, key) && result.operation_admission.accepted); result.phase = 'release';
    }
    return result;
  }
  override src_release(session: CompositionRecord): CompositionRecord {
    if (!pythonTruthy(requireField(session, 'release_allowed'))) throw new Error('SRC release missing');
    const result = copy(session); result.action_set = requireField(result, 'selected_bundle');
    result.trace.push({ kind: 'action_set_release', bundle: result.action_set.id, actions: result.action_set.actions.length, game_io: false });
    Object.assign(result, { pending: false, done: true, status: 'action_set_released', progress: increment(result.progress) }); return result;
  }
  override persist(request: CompositionRecord, report: CompositionReport): void {
    super.persist(request, report); const decision = report.decision;
    if (pythonTruthy(get(decision, 'selected_bundle'))) this.memory.put(request.episode, 'composition_contract', decision.selected_bundle, 'SRC-selected-composition', request.revision);
    if (decision.status === 'composition_analysis' && decision.selected_bundle.operation_key === 'OP30') for (const update of decision.operation_result.value) {
      this.memory.put(request.episode, `knowledge:${update.composition_ref}:${update.property}`, update.value, update.evidence, update.revision);
    }
  }
}
export class NeutralEngine extends CompositionEngine {
  override prepare(request: CompositionRecord): CompositionRecord {
    const prepared = super.prepare(request), epoch = requireField(prepared.state, 'level_epoch');
    if (!pythonEqual(get(prepared, 'level_epoch'), epoch) || Object.values(prepared.bundles).some(bundle => !pythonEqual(get(bundle as CompositionRecord, 'level_epoch'), epoch))) {
      throw new TypeError('Neutral observation epoch binding mismatch');
    }
    if (!pythonEqual(get(prepared.state, 'observation_revision'), prepared.revision)) throw new TypeError('Neutral observation revision binding mismatch');
    return prepared;
  }
}

/** Source bridge: durable memory boundaries around the real, bounded SRC tree. */
export class NativeSrcBridge {
  readonly engine: NativeEngine;
  readonly continuous: boolean;
  sequence = 0;
  last_execution: CompositionRecord | null = null;
  private program: Promise<CompositionProgram>;
  private busy = false;
  private modelError: NativeModelUnavailableError | null = null;
  private resultCalls = 0;
  private readonly clock: () => number;
  private readonly callbacks: Readonly<Record<string, Primitive>>;

  constructor(engine: NativeEngine, options: { continuous?: boolean; clock?: () => number; programHost?: CompositionProgramHost } = {}) {
    this.engine = engine; this.continuous = options.continuous ?? false; this.clock = options.clock ?? (() => performance.now());
    const names = ['begin', 'context', 'unique', 'abstain', 'laya', 'apply', 'navigate', 'resume', 'complete_navigation', 'release', 'reject', 'result'] as const;
    const callbacks: Record<string, Primitive> = {};
    for (const name of names) callbacks[`prototype.${name}`] = args => {
      try {
        let value: CompositionRecord;
        if (name === 'begin') value = this.engine.src_begin(args.request as CompositionRecord);
        else if (name === 'apply' || name === 'navigate') value = this.engine[`src_${name}`](args.session as CompositionRecord, args.choice as CompositionRecord);
        else {
          if (name === 'result') this.resultCalls++;
          value = this.engine[`src_${name}`](args.session as CompositionRecord);
        }
        return value as JsonObject;
      } catch (error) {
        if (error instanceof NativeModelUnavailableError) this.modelError = error;
        throw error;
      }
    };
    this.callbacks = Object.freeze(callbacks);
    this.program = options.programHost ? options.programHost.registerProgram('prototype.laya_router.route', this.callbacks) :
      NativeSrcProgram.create('prototype.laya_router.route', this.callbacks);
  }
  /** Select the authoritative shared IR store before running a subsequent call. */
  setProgramHost(host: CompositionProgramHost): void {
    if (this.busy) throw new Error('Cannot replace the composition program host during execution');
    this.program = host.registerProgram('prototype.laya_router.route', this.callbacks);
  }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> {
    this.setProgramHost(registry); await this.program;
  }
  /** Restore alongside the same reasoning-memory revision between executions. */
  state(): CompositionBridgeState {
    if (this.busy) throw new Error('Cannot checkpoint composition reasoning during execution');
    return { schema: 'logos-engine.v6.composition-bridge.v1', continuous: this.continuous,
      sequence: this.sequence, engine: this.engine.state() };
  }
  restore(state: CompositionBridgeState): void {
    if (this.busy) throw new Error('Cannot restore composition reasoning during execution');
    if (state.schema !== 'logos-engine.v6.composition-bridge.v1' || state.continuous !== this.continuous ||
      !Number.isSafeInteger(state.sequence) || state.sequence < 0) throw new TypeError('Invalid composition bridge checkpoint');
    this.engine.restore(state.engine); this.sequence = state.sequence; this.last_execution = null;
  }
  async run(request: CompositionRecord, options: ExecutionOptions = {}): Promise<CompositionReport> {
    if (this.busy) throw new Error('Concurrent WHY/ACT evaluation is unavailable');
    this.busy = true;
    const started = this.clock(); this.modelError = null; this.resultCalls = 0;
    try {
      const prepared = this.engine.prepare(request); this.sequence++;
      const program = await this.program;
      let execution: Awaited<ReturnType<CompositionProgram['run']>>;
      try { execution = await program.run({ request: prepared } as JsonObject, { maxInstructions: 1024, yieldEvery: 128, ...options }); }
      catch (error) { if (this.modelError) throw this.modelError; throw error; }
      if (execution.receipt.src_status !== 'completed') throw new Error(`SRC prototype did not complete: ${execution.receipt.src_status}`);
      if (this.resultCalls !== 1 || this.engine.last_result === null || !pythonEqual(execution.result, this.engine.last_result)) {
        throw new Error('SRC result is not bound to the completed composition callback');
      }
      const statements = execution.receipt.all_executed_statements ?? execution.receipt.executed_statements;
      const finalSliceLength = statements.length % 128 || Math.min(statements.length, 128);
      const report: CompositionReport = { src_status: 'completed', src_hash: execution.receipt.src_hash,
        src_statement_count_last_slice: finalSliceLength, decision: this.engine.last_result };
      this.engine.persist(prepared, report);
      report.total_ms = this.clock() - started;
      this.last_execution = { sequence: this.sequence, run_id: this.continuous ? 'run:laya-continuous' : `run:laya-prototype-${this.sequence}`,
        workflow_instance_id: `instance:laya-${this.sequence}`, timeline_id: this.continuous ? 'timeline:laya-continuous' : `timeline:${this.sequence}`,
        frame_id: `frame:${this.sequence}`, receipt: execution.receipt };
      return report;
    } finally { this.busy = false; }
  }
}

export { NativeEngine as Engine, NativeSrcBridge as SrcBridge };
