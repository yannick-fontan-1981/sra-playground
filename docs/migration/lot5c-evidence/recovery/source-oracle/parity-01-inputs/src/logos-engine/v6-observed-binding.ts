/** Native owner of the original guarded_binding/family.py entry. The source
 * tracker, shared caller attention and authoritative checkpoint stay distinct.
 * Budget interruption discards an ephemeral transaction; it acquires no fact. */
import { AttentionMemory } from './v6-attention-memory.ts';
import { NativeSrcProgram, V6_DECLARATIVE_SOURCES } from './v6-src-program.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { BindingTracker, BINDING_TRACKER_FIELDS } from './v6-object-binding-tracker.ts';
import { offers } from './v6-object-binding-planning.ts';
import { digest, center, correspondence, locate } from './v6-object-binding-geometry.ts';
import { BindingWork, BindingWorkBound, bindingClone as clone, bindingCompare as compare, bindingEqual as same,
  bindingUnique as unique, type BindingRecord as R, type BindingSearchBounds } from './v6-object-binding-common.ts';
import { makeBindingCheckpoint, ownBindingCheckpoint } from './v6-observed-binding-state.ts';
import type { JsonObject, JsonValue, Primitive } from './ir.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeCommand, NativeExecution, NativeFamily, NativeObservation,
  NativeProgramHandle, NativeProgramRegistry, NativeProposal, NativePublicObservation, NativeRecord, NativeRecordResult, NativeRows } from './v6-native-types.ts';

export { OBSERVED_BINDING_NATIVE_SEARCH_BOUNDS, BindingWorkBound } from './v6-object-binding-common.ts';
export { OBSERVED_BINDING_STATE_SCHEMA } from './v6-observed-binding-state.ts';
export { locate } from './v6-object-binding-geometry.ts';
export interface ObservedBindingOptions { boundedSearch?: BindingSearchBounds }
export interface ObservedBindingCallerContext { attention: () => AttentionMemory }
interface Transaction {
  tracker: BindingTracker; attention: AttentionMemory; actualAttention: AttentionMemory; puts: any[][];
  selected: R | null; context: readonly [R, NativeRows, number] | null; work?: BindingWork; wrappedBound: BindingWorkBound | null;
}
const WORKFLOW = 'v6.observed_binding.choose';
const SOURCE = 'agents/yf_arc3_v6/morphology_policy/guarded_binding/binding.drm';
const sourceConfig = (): R => {
  const declaration = (V6_DECLARATIVE_SOURCES as unknown as R)[SOURCE];
  if (!declaration || typeof declaration.text !== 'string') throw new Error('Missing original observed binding declaration');
  return retainNativeJson(JSON.parse(declaration.text).declarations[0].configuration);
};

export class ObservedBinding implements NativeFamily {
  readonly id = 'public_observed_binding';
  readonly owner = 'object_frame_binding';
  readonly stateOwner = this;
  readonly config: R;
  readonly tracker = new BindingTracker();
  attention = new AttentionMemory();
  selected: R | null = null;
  private context: readonly [R, NativeRows, number] | null = null;
  private callerContext: ObservedBindingCallerContext | null = null;
  private readonly bounds: BindingSearchBounds | undefined;
  private program: Promise<NativeProgramHandle> | null = null;
  private active: Transaction | null = null;
  private refusal: R | null = null;
  private retained: R | null = null;
  private witness: readonly unknown[] | null = null;
  private stateRevision = 0;

  constructor(options: ObservedBindingOptions = {}) {
    this.config = sourceConfig(); this.bounds = options.boundedSearch ? { ...options.boundedSearch } : undefined;
    if (this.bounds) new BindingWork(this.bounds);
  }
  static async create(options: ObservedBindingOptions = {}): Promise<ObservedBinding> {
    const owner = new ObservedBinding(options); await owner.sourceProgram(); return owner;
  }
  enableCallerContext(context: ObservedBindingCallerContext): void {
    // The ordinary factory registers this before constructing its caller.
    if (typeof context.attention !== 'function') throw new TypeError('Binding caller attention must be a getter');
    this.callerContext = context;
  }
  private sourceProgram(): Promise<NativeProgramHandle> {
    return this.program ??= NativeSrcProgram.create(WORKFLOW, this.callbacks());
  }
  private callbacks(): Readonly<Record<string, Primitive>> {
    const observed = (operation: () => R): JsonValue => {
      try { return operation() as JsonValue; }
      catch (error) { if (error instanceof BindingWorkBound && this.active) this.active.wrappedBound = error; throw error; }
    };
    return { 'binding.measure': (args: JsonObject) => observed(() => this.measure(args.request)),
      'binding.bind': (args: JsonObject) => observed(() => this.select(args.measured as R)) };
  }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> {
    this.program = registry.registerProgram(WORKFLOW, this.callbacks()); await this.program;
  }
  measure(_request: unknown): R {
    const transaction = this.active, context = transaction?.context ?? this.context;
    if (!context) throw new Error('Observed binding source context is absent');
    const [observation, rows, remaining] = context;
    return { offers: offers(transaction?.tracker ?? this.tracker, observation, rows, remaining, this.config, transaction?.work) };
  }
  select(measured: R): R {
    const transaction = this.active, context = transaction?.context ?? this.context;
    if (!context) throw new Error('Observed binding source context is absent');
    let plans: R[] = measured.offers.filter((plan: R) => this.config.order.includes(plan.kind));
    const attention = transaction?.attention ?? this.attention, focus = attention.compositionFor(this.owner, context[0]);
    transaction?.work?.check();
    if (focus && this.config.continuity?.retain_selected_frame_until_effect_or_refutation)
      plans = plans.filter(plan => plan.target.frame.ref === focus.target_ref);
    const order = (plan: R): unknown[] => [this.config.order.indexOf(plan.kind), plan.residual_distance ?? plan.distance,
      plan.actions.length, plan.target.ref, plan.actions[0].action_ref];
    let selected: R | null = null;
    for (const plan of plans) { transaction?.work?.tick(); if (selected === null || compare(order(plan), order(selected)) < 0) selected = plan; }
    if (transaction) transaction.selected = selected; else this.selected = selected;
    return { selected: selected !== null };
  }
  private scopedAttention(explicit?: AttentionMemory): AttentionMemory {
    const attention = this.callerContext ? this.callerContext.attention() : explicit ?? this.attention;
    if (!(attention instanceof AttentionMemory)) throw new TypeError('Observed binding requires the actual common AttentionMemory');
    this.attention = attention; return attention;
  }
  private stage(attention: AttentionMemory): Transaction {
    const puts: any[][] = [], memory = attention.memory;
    const proxy = memory ? {
      get: (...args: Parameters<NonNullable<typeof memory>['get']>) => memory.get(...args),
      put: (...args: Parameters<NonNullable<typeof memory>['put']>) => { puts.push(clone(args)); },
    } : null;
    const staged = new AttentionMemory(proxy, attention.episode);
    // Source attention operations replace these records; they never mutate a
    // retained item's children. Only writes are replayed after a final check.
    staged.item = attention.item; staged.composition = attention.composition;
    return { tracker: this.tracker.fork(), attention: staged, actualAttention: attention, puts,
      selected: this.selected, context: this.context, wrappedBound: null };
  }
  private sameWitness(witness: readonly unknown[] | null): boolean {
    const current = this.tracker.references(); return witness !== null && current.length === witness.length && current.every((value, i) => value === witness[i]);
  }
  private commit(transaction: Transaction): void {
    const before = this.tracker.references(), after = transaction.tracker.references();
    const changed = before.length !== after.length || before.some((value, i) => value !== after[i]);
    let checkpoint = this.retained, source: R | null = null;
    if (changed) {
      const references = transaction.tracker.sourceReferences();
      const sourceOnlyExtras = Object.keys(references).some(name => !(BINDING_TRACKER_FIELDS as readonly string[]).includes(name));
      if (sourceOnlyExtras) { source = retainNativeJson(references); checkpoint = null; }
      else { checkpoint = makeBindingCheckpoint(references); source = checkpoint.source; }
    }
    transaction.work?.check();
    if (this.callerContext && this.callerContext.attention() !== transaction.actualAttention)
      throw new BindingWorkBound('caller_attention_replaced', transaction.work?.nodes ?? 0, transaction.work?.work ?? 0);
    // No await/check inside this commit: each actual source put occurs once,
    // synchronously and in order, before publishing the corresponding state.
    for (const args of transaction.puts) transaction.actualAttention.memory!.put(...args as Parameters<NonNullable<AttentionMemory['memory']>['put']>);
    transaction.actualAttention.item = transaction.attention.item;
    transaction.actualAttention.composition = transaction.attention.composition;
    if (changed) {
      transaction.tracker.installSourceReferences(source!); this.tracker.install(transaction.tracker);
      this.stateRevision++; this.retained = checkpoint; this.witness = this.tracker.references();
    }
    this.selected = transaction.selected; this.context = transaction.context;
  }
  private workRefusal(observation: R, error: BindingWorkBound, execution: NativeExecution | undefined, acquisition: boolean): void {
    this.refusal = { status: 'unknown', reason: acquisition ? 'observed_binding_acquisition_work_bound' : 'observed_binding_search_work_bound',
      observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, frame_hash: observation.frame_hash,
      release_authority: false, block_unrelated_probe: true, exhausted_bound: error.bound,
      frontier: { complete: false, nodes: error.nodes, work: error.work, maximum_nodes: this.bounds?.maximumNodes ?? null,
        maximum_work: this.bounds?.maximumWork ?? null, deadline_ms: execution?.deadlineMs ?? null,
        scope: acquisition ? 'Incomplete binding acquisition; no partial tracker, attention or source-memory fact is retained.'
          : 'Incomplete binding question; no action, refutation or acquired impossibility is inferred.' } };
  }
  private async transact(observation: R, explicit: AttentionMemory | undefined, execution: NativeExecution | undefined,
    acquisition: boolean, operation: (transaction: Transaction) => Promise<R | null>): Promise<R | null> {
    if (this.active) throw new Error('Observed binding source operations must be sequential');
    this.refusal = null;
    const transaction = this.stage(this.scopedAttention(explicit));
    try {
      transaction.work = this.bounds || execution ? new BindingWork(this.bounds, execution) : undefined;
      this.active = transaction; await transaction.work?.yield();
      const result = await operation(transaction);
      await transaction.work?.yield(); this.commit(transaction); return result;
    } catch (error) {
      let bound = error instanceof BindingWorkBound ? error : transaction.wrappedBound;
      if (!bound && transaction.work) { try { transaction.work.check(); } catch (current) { if (current instanceof BindingWorkBound) bound = current; else throw current; } }
      if (!bound) throw error;
      this.workRefusal(observation, bound, execution, acquisition); return null;
    } finally { this.active = null; }
  }
  async proposeSource(obs: R, rows: NativeRows, _inputs: readonly R[], remaining: number,
    attention?: AttentionMemory, execution?: NativeExecution): Promise<R | null> {
    return this.transact(obs, attention, execution, false, async transaction => {
      const tracker = transaction.tracker, memory = transaction.attention, work = transaction.work;
      const focus = memory.compositionFor(this.owner, obs); work?.check();
      const admitted = tracker.admit_context(obs, rows, work);
      if (focus) {
        const frame = focus.binding?.frame, measured = frame ? tracker.frame_contradiction(frame, obs, rows, work) : null,
          contradictions = tracker.context_refutations.filter(item => item.frame_ref === focus.target_ref);
        if (measured) contradictions.push({ evidence: [obs.observation_ref], changed_corners: measured });
        if (contradictions.length) memory.returnComposition(this.owner, focus.target_ref, 'refuted',
          [obs.observation_ref, ...contradictions.flatMap(item => item.evidence)], obs);
      }
      work?.check(); if (!admitted || tracker.core === null) return null;
      transaction.context = [obs, rows, remaining];
      const program = await this.sourceProgram(); work?.check();
      const { result, receipt } = await program.run({ request: { observation_ref: obs.observation_ref } }, { signal: execution?.signal });
      work?.check(); if (!(result as R).selected) return null;
      const plan = clone(transaction.selected!), actions: R[] = plan.actions, steps: R[] = [];
      const currentFocus = memory.compositionFor(this.owner, obs); work?.check();
      plan.composition_attention = clone(currentFocus);
      plan.target_revalidation = { frame_ref: plan.target.frame.ref, observation_ref: obs.observation_ref, level_epoch: obs.level_epoch,
        current_offer_bound: true, release_authority: false };
      plan.preservation_regions = correspondence(obs, rows, tracker.core.signature, Object.values(tracker.observed_frames), work)
        .filter(pair => pair.ref !== plan.target.ref && (!tracker.held || pair.object.palette_value !== tracker.held.palette_value)).map(pair => pair.object.bbox);
      for (const [index, action] of actions.entries()) {
        work?.tick(); const expected = Object.hasOwn(plan, 'delta') ? { level_epoch: obs.level_epoch,
          body_center: plan.poses[index].map((value: number, i: number) => value + plan.delta[i]), conditional_model: 'local_displacement_extension' } : null;
        steps.push({ action, body_before: plan.poses[index], expected_before: { level_epoch: obs.level_epoch,
          ...(index === 0 ? { frame_hash: obs.frame_hash } : {}) }, expected_after: expected });
      }
      const composition = 'composition:binding:' + digest([obs.observation_ref, plan.target.ref, plan.kind]),
        facts = { current_object_frame_context_bound: true, current_controlled_body_bound: true }, evidence = plan.evidence;
      const preserved: R[] = plan.preserve.map((constraint: string) => ({ id: 'preserve:' + digest([composition, constraint]),
        role: 'preservation_constraint', observed: true, things: [plan.target.ref, tracker.core!.signature],
        properties: { constraint, guard: 'compare_current_body_and_nonselected_objects' }, relations: ['contributes_to:G_official_completion'] }));
      const workflow = { workflow: receipt.workflow, src_hash: receipt.src_hash, src_status: receipt.src_status, executed_statements: receipt.executed_statements };
      return { status: 'proposed', kind: this.id, actions, steps, facts,
        binding: Object.fromEntries(['observation_ref', 'level_epoch', 'levels_completed', 'frame_hash'].map(name => [name, obs[name]])),
        binding_plan: { offer: plan, workflow, core: clone(tracker.core), evidence, drm_hash: digest(this.config), portable_methods: clone(tracker.methods) },
        compositions: [{ id: composition, role: 'information_question', observed: false,
          things: [tracker.core.signature, plan.target.ref, plan.target.frame.ref], properties: {
            target: 'object_bound_then_reception_correspondence_realized', hypotheses: plan.hypotheses, unknown: plan.unknown,
            risks: plan.risks, falsifiers: plan.falsifiers, conditional: true, composition_attention: plan.composition_attention,
            target_revalidation: plan.target_revalidation, reception_evidence: plan.pending_reception ?? null, secondary_access: plan.secondary_access ?? null },
          relations: ['contributes_to:G_official_completion'], open_question: this.config.question }, ...preserved],
        question: { reason: this.config.question, hypothesis_refs: evidence }, route_refs: evidence,
        bundle_template: { operation_key: 'OP18', composition_ref: composition, objective_ref: 'G_official_completion', purpose: this.config.question,
          preconditions: facts, evidence, actions, preserve_refs: preserved.map(item => item.id),
          preservation_evidence: Object.fromEntries(preserved.map(item => [item.id, { observation_ref: obs.observation_ref, guard: item.properties.guard, evidence }])),
          outcome_guard: { path: ['value'], contains: composition } } };
    });
  }
  async propose(observation: NativeObservation | R, rows: NativeRows, inputs: readonly NativeCommand[] | readonly R[], remaining: number,
    execution?: NativeExecution): Promise<NativeProposal | null> {
    return await this.proposeSource(observation, rows, inputs, remaining, undefined, execution) as NativeProposal | null;
  }
  async proposeInSubquestion(group: string, subquestion: string, observation: NativeObservation | R, rows: NativeRows,
    inputs: readonly NativeCommand[] | readonly R[], remaining: number, execution?: NativeExecution): Promise<NativeProposal | null> {
    if (group !== 'factored_material_return' || subquestion !== 'observed_object_binding') return null;
    const proposal = await this.propose(observation, rows, inputs, remaining, execution);
    if (proposal !== null) proposal.material_access_subquestion = subquestion;
    return proposal;
  }
  bind(proposal: R, _domain: unknown): void {
    if (!same(proposal.actions, proposal.steps.map((step: R) => step.action)) || proposal.steps.some((step: R) => !Object.hasOwn(step, 'expected_after')))
      throw new TypeError('Unbound binding action set');
  }
  before(proposal: R, index: number, publicPacket: NativePublicObservation | R, observation: NativeObservation | R): NativeBeforeResult {
    const step = proposal.steps[index], core = this.tracker.core, box = core ? locate(publicPacket.frame_rows, core) : null;
    let admitted = box !== null && same(center(box), step.body_before) && publicPacket.level === proposal.binding.level_epoch
      && publicPacket.levels_completed === proposal.binding.levels_completed && publicPacket.available_action_refs.includes(step.action.action_ref);
    if (index === 0) admitted = admitted && publicPacket.frame_hash === proposal.binding.frame_hash && observation.observation_ref === proposal.binding.observation_ref;
    return { admitted, reason: admitted ? 'body_current_scope_and_exact_prefix_bound' : 'binding_changed' };
  }
  after(proposal: R, index: number, _before: NativeObservation | R, _after: NativeObservation | R, first: NativeRows, second: NativeRows): NativeAfterResult {
    const expected = proposal.steps[index].expected_after;
    if (expected === null) return { matched: null, seal_prefix: true, reason: 'unknown_interaction_reconciles_before_continuation' };
    const box = locate(second, proposal.binding_plan.core); let matched = box !== null && same(center(box), expected.body_center);
    if (matched) outer: for (const [l, t, r, b] of proposal.binding_plan.offer.preservation_regions as number[][])
      for (let y = t!; y <= b!; y++) for (let x = l!; x <= r!; x++) if (first[y]![x] !== second[y]![x]) { matched = false; break outer; }
    return { matched, seal_prefix: !matched, reason: 'conditional_displacement_compared_nonlocal_effect_seals_prefix' };
  }
  async recordSource(before: R, after: R, command: R, first: NativeRows, second: NativeRows,
    proposal?: R | null, index = 0, execution?: NativeExecution): Promise<R | null> {
    return this.transact(after, undefined, execution, true, async transaction => {
      const event = transaction.tracker.record(before, after, command, first, second, proposal, index, transaction.work), memory = transaction.attention;
      const focus = memory.compositionFor(this.owner, before); transaction.work?.check();
      if (event?.status === 'reception_confirmed_by_separation') {
        memory.returnComposition(this.owner, event.frame_ref, 'achieved', event.evidence, after); return event;
      }
      if (before.level_epoch !== after.level_epoch || after.levels_completed > before.levels_completed) {
        if (focus) memory.returnComposition(this.owner, focus.target_ref, 'boundary', [before.observation_ref, after.observation_ref], after);
      } else if (proposal?.binding_plan && this.config.continuity?.retain_selected_frame_until_effect_or_refutation) {
        const plan = proposal.binding_plan.offer;
        await memory.retainComposition(this.owner, plan.target.frame.ref, this.config.question,
          unique([...plan.evidence, before.observation_ref, after.observation_ref]), after, { frame: clone(plan.target.frame) });
      }
      transaction.work?.check(); return event;
    });
  }
  async record(before: NativeObservation | R, after: NativeObservation | R, command: NativeCommand | R, first: NativeRows, second: NativeRows,
    proposal?: NativeProposal | R, index = 0, _frames: readonly NativeRows[] = [], execution?: NativeExecution): Promise<NativeRecordResult> {
    const result = await this.recordSource(before, after, command, first, second, proposal, index, execution), refusal = this.currentProposalRefusal(after);
    if (refusal) return { events: [], native_acquisition_incomplete: true, native_acquisition_refusal: refusal };
    return { events: result ? [result] : [] };
  }
  currentProposalRefusal(observation: NativeObservation | R): NativeRecord | null {
    return this.refusal && ['observation_ref', 'level_epoch', 'frame_hash'].every(name => this.refusal![name] === observation[name]) ? clone(this.refusal) : null;
  }
  sourceState(): R { return this.tracker.sourceState(); }
  state(): R { return this.sourceState(); }
  restore(state: NativeRecord): void {
    this.tracker.restore(state); this.stateRevision++; this.retained = null; this.witness = null; this.refusal = null;
  }
  nativeState(): R {
    if (this.retained && this.sameWitness(this.witness)) return this.retained;
    const checkpoint = makeBindingCheckpoint(this.tracker.sourceReferences());
    this.tracker.installSourceReferences(checkpoint.source); this.retained = checkpoint; this.witness = this.tracker.references(); return checkpoint;
  }
  restoreNative(state: Readonly<NativeRecord>): void {
    if (state === this.retained && this.sameWitness(this.witness)) { this.refusal = null; return; }
    const checkpoint = ownBindingCheckpoint(state);
    const tracker = new BindingTracker(); tracker.installSourceReferences(checkpoint.source);
    this.tracker.install(tracker); this.stateRevision++; this.retained = checkpoint; this.witness = this.tracker.references(); this.refusal = null;
  }
  get revision(): number { return this.stateRevision; }
  get nativeRevision(): number { return this.stateRevision; }
}
