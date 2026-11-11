/** Pinned WindowQuestion: observed field changes support conditional coverage
 * questions. A measured interface and a V5 projection do not establish the
 * capture law, receiver order, timing, painting law or official completion.
 */
import { WindowPolicy } from './v6-window-question-policy.ts';
import { measure, plans, plansCooperative, digest } from './v6-window-question-geometry.ts';
import { RecolorComputationInterrupted } from './v6-topological-recolor-geometry.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { isJsonObject } from './canonical.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeCommand, NativeExecution, NativeFamily, NativeObservation,
  NativeProgramRegistry, NativeProposal, NativePublicObservation, NativeRecord, NativeRecordResult, NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Search = { offers: R[]; measurement: R | null; bound: R | null };
const FIELDS = ['epoch', 'edits', 'portable', 'launches', 'attempts', 'last'] as const;
const FORMAT = 'native.public_window_question.v1';
const copy = <T>(value: T): T => structuredClone(value);

function validateState(value: R): R {
  const state = retainNativeJson(value);
  if (Object.keys(state).length !== FIELDS.length || FIELDS.some(key => !Object.hasOwn(state, key))
    || state.epoch !== null && !Number.isSafeInteger(state.epoch)
    || state.last !== null && !isJsonObject(state.last)
    || ['edits', 'portable', 'launches'].some(key => !Array.isArray(state[key]) || !state[key].every(isJsonObject))
    || !isJsonObject(state.attempts) || !Object.values(state.attempts).every(isJsonObject)) {
    throw new TypeError('Incompatible window-question source state');
  }
  return state;
}

/** Checkpoint identity is typed JSON identity, independently of Python's
 * True == 1 comparisons used by the source algorithms. No source field is
 * omitted, and a nested external mutation must create a new checkpoint.
 * Inputs have already passed retainNativeJson's descriptor/type validation.
 */
function sameState(left: any, right: any): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object'
    || Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left)) return left.length === right.length && left.every((value, index) => sameState(value, right[index]));
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every(key => Object.hasOwn(right, key) && sameState(left[key], right[key]));
}

class WindowExecutionInterrupted extends Error {
  readonly reason: 'native_abort' | 'native_deadline';
  readonly frontier: R;
  constructor(reason: 'native_abort' | 'native_deadline', frontier: R) {
    super(reason); this.name = 'WindowExecutionInterrupted'; this.reason = reason; this.frontier = frontier;
  }
}

/** Invocation-local scheduling only; no signal or deadline enters source state. */
class WindowWork {
  private readonly execution: NativeExecution;
  private visited = 0;
  private sliceStarted: number;
  constructor(execution: NativeExecution) { this.execution = execution; this.sliceStarted = this.now(); }
  private now(): number { return this.execution.now?.() ?? performance.now(); }
  check(frontier: R): void {
    if (this.execution.signal?.aborted) throw new WindowExecutionInterrupted('native_abort', frontier);
    if (this.execution.deadlineMs !== undefined && this.now() >= this.execution.deadlineMs) {
      throw new WindowExecutionInterrupted('native_deadline', frontier);
    }
  }
  shouldYield(): boolean { return ++this.visited % 32 === 0 || this.now() - this.sliceStarted >= 8; }
  async yield(frontier: R): Promise<void> {
    this.check(frontier);
    try { await this.execution.yieldControl(); }
    catch (error) {
      if (this.execution.signal?.aborted || error instanceof Error && error.name === 'AbortError') {
        throw new WindowExecutionInterrupted('native_abort', frontier);
      }
      throw error;
    }
    this.sliceStarted = this.now(); this.check(frontier);
  }
}

export class WindowQuestion implements NativeFamily<any> {
  readonly id = 'public_window_question';
  readonly policy: WindowPolicy;
  epoch: number | null = null;
  edits: R[] = [];
  portable: R[] = [];
  launches: R[] = [];
  attempts: R = {};
  last: R | null = null;
  private checkpoint: R | null = null;
  private revision = 0;
  private refusal: R | null = null;

  private constructor(policy: WindowPolicy) { this.policy = policy; }
  static async create(): Promise<WindowQuestion> { return new WindowQuestion(await WindowPolicy.create()); }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> { await this.policy.attachPrograms(registry); }
  private sourceView(): R {
    return { epoch: this.epoch, edits: this.edits, portable: this.portable, launches: this.launches,
      attempts: this.attempts, last: this.last };
  }
  get nativeRevision(): number { this.nativeState(); return this.revision; }
  state(): R { return copy(this.sourceView()); }
  sourceState(): R { return this.state(); }
  /** Original common-caller save predicate; launches alone do not save state. */
  sourceStateShouldPersist(): boolean { return this.edits.length > 0 || this.portable.length > 0 || Object.keys(this.attempts).length > 0; }
  nativeState(): NativeRecord {
    // Validate and own the raw six-field view once, without a preceding state()
    // deep copy. The scan remains necessary because source fields are mutable.
    const source = validateState(this.sourceView());
    if (this.checkpoint && sameState(this.checkpoint.source_state, source)) return this.checkpoint;
    this.checkpoint = retainNativeJson({ format: FORMAT, source_state: source }); this.revision++; return this.checkpoint;
  }
  restore(value: NativeRecord): void {
    if (!isJsonObject(value)) throw new TypeError('Window-question restore requires a source state mapping');
    const next = validateState({ ...this.sourceView(),
      ...Object.fromEntries(FIELDS.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]])) });
    for (const key of FIELDS) (this as unknown as R)[key] = copy(next[key]);
    this.refusal = null;
  }
  restoreNative(value: Readonly<NativeRecord>): void {
    if (value === this.checkpoint) {
      let current: R | null = null;
      try { current = validateState(this.sourceView()); }
      catch (error) {
        // A retained valid checkpoint can restore externally damaged working
        // state. Unknown errors still propagate; no malformed input is saved.
        if (!(error instanceof TypeError)) throw error;
      }
      if (current && sameState(current, this.checkpoint!.source_state)) { this.refusal = null; return; }
    }
    const supplied = retainNativeJson(value);
    if (!isJsonObject(supplied) || supplied.format !== FORMAT || Object.keys(supplied).length !== 2 || !isJsonObject(supplied.source_state)) {
      throw new TypeError('Invalid native window-question checkpoint');
    }
    const next = validateState(supplied.source_state), changed = !this.checkpoint || !sameState(this.checkpoint.source_state, next);
    for (const key of FIELDS) (this as unknown as R)[key] = copy(next[key]);
    this.checkpoint = supplied; if (changed) this.revision++; this.refusal = null;
  }
  scope(obs: R): void {
    if (equal(this.epoch, obs.level_epoch)) return;
    if (this.edits.length) this.portable.push({ source_epoch: this.epoch, methods: this.edits,
      launches: this.launches, authority: 'method_only_not_current_permit' });
    this.epoch = obs.level_epoch; this.edits = []; this.launches = []; this.attempts = {}; this.last = null;
  }
  private *methodEntries(): Generator<R> {
    for (const edit of this.edits) yield edit;
    for (const portable of this.portable) for (const edit of portable.methods) yield edit;
  }
  private methodsFor(measurement: R): R[] {
    const methods: R[] = [];
    for (const method of this.methodEntries()) if (equal(method.signature, measurement.signature)) methods.push(method);
    return methods;
  }
  private offerForPlan(obs: R, measurement: R, methods: R[], plan: R, bound: R, remaining: number): R | null {
    if (plan.cost > remaining) return null;
    const edit = plan.edits.length ? plan.edits[0] : null,
      action: R = edit ? { action_ref: this.policy.config.point_action, data: { x: edit.point[0], y: edit.point[1] } }
        : { action_ref: this.policy.config.launch_prior };
    if (!obs.available_action_refs.includes(action.action_ref)) return null;
    const key = digest([obs.level_epoch, measurement, action]), kind = edit ? 'setting_question' : 'traversal_question';
    if (Object.hasOwn(this.attempts, key)) return null;
    return { kind, key, action, cost: plan.cost,
      facts: { field_control_observed: true, current_geometry_revalidated: true, conditional_coverage_complete: true,
        cost_admissible: true, untried_context: true },
      measurement, plan, edit, model: this.policy.config.model,
      method_revalidation: { current_epoch: obs.level_epoch, current_observation: obs.observation_ref,
        signature: measurement.signature, methods, release_authority: false }, search: bound };
  }
  private sourceOffers(obs: R, rows: NativeRows, remaining: number): Search {
    const measurement = measure(rows); if (!measurement) return { offers: [], measurement, bound: null };
    const methods = this.methodsFor(measurement); if (!methods.length) return { offers: [], measurement, bound: null };
    const [candidates, bound] = plans(measurement, this.policy.config.model), offers: R[] = [];
    for (const plan of candidates) {
      const offer = this.offerForPlan(obs, measurement, methods, plan, bound, remaining); if (offer) offers.push(offer);
    }
    return { offers, measurement, bound };
  }
  offers(obs: R, rows: NativeRows, remaining: number): [R[], R | null] {
    const result = this.sourceOffers(obs, rows, remaining); return [result.offers, result.measurement];
  }
  private async nativeOffers(obs: R, rows: NativeRows, remaining: number, execution?: NativeExecution): Promise<Search> {
    if (!execution) return this.sourceOffers(obs, rows, remaining);
    const work = new WindowWork(execution); work.check({ phase: 'measurement' });
    const measurement = measure(rows); work.check({ phase: 'measurement' });
    if (!measurement) return { offers: [], measurement, bound: null };
    const methods: R[] = []; let examined = 0;
    for (const method of this.methodEntries()) {
      if (equal(method.signature, measurement.signature)) methods.push(method);
      examined++;
      if (work.shouldYield()) await work.yield({ phase: 'method_revalidation', methods_examined: examined });
    }
    work.check({ phase: 'method_revalidation', methods_examined: examined });
    if (!methods.length) return { offers: [], measurement, bound: null };
    const [candidates, bound] = await plansCooperative(measurement, this.policy.config.model, execution), offers: R[] = [];
    if (bound.truncated) return { offers, measurement, bound };
    for (const [index, plan] of candidates.entries()) {
      const offer = this.offerForPlan(obs, measurement, methods, plan, bound, remaining); if (offer) offers.push(offer);
      if (work.shouldYield()) await work.yield({ phase: 'offer_construction', plans_examined: index + 1 });
    }
    work.check({ phase: 'offer_construction', plans_examined: candidates.length });
    return { offers, measurement, bound };
  }
  private async proposal(obs: NativeObservation, rows: NativeRows, remaining: number, offers: R[], measurement: R): Promise<NativeProposal | null> {
    if (!offers.length) return null;
    const [choice, workflow] = await this.policy.choose(offers); if (choice.status !== 'selected') return null;
    const offer = offers[choice.index]!, action = offer.action,
      focus = 'composition:window:' + digest([obs.level_epoch, measurement.signature, offer.plan.settings]),
      evidence = [obs.observation_ref, ...offer.method_revalidation.methods.flatMap((method: R) => method.evidence)],
      step: R = { action, expected_after: null };
    if (offer.edit) {
      const box = measurement.boxes[offer.edit.box], [x, y] = offer.edit.point;
      step.point_binding = { entity_ref: 'window:' + digest(box.bbox), observation_ref: obs.observation_ref,
        signature: digest(box), bbox: box.bbox, level_epoch: obs.level_epoch, frame_hash: obs.frame_hash,
        point: [x, y], palette_value: rows[y]![x], source: 'current_box_field_geometry' };
    }
    const facts = { window_question_current: true };
    return { status: 'proposed', kind: this.id, actions: [action], steps: [step], facts,
      binding: Object.fromEntries(['observation_ref', 'level_epoch', 'frame_hash', 'levels_completed'].map(key => [key, obs[key]])),
      window_question_plan: { offer, remaining, choice, workflow, drm_hash: this.policy.loaded.source_hash },
      compositions: [{ id: focus, role: 'conditional_window_coverage', observed: false,
        things: ['word:' + digest(measurement.word), ...measurement.boxes.map((box: R) => 'box:' + digest(box.bbox))],
        properties: { coverage_hypothesis: offer.plan, model_hypotheses: offer.model, method_revalidation: offer.method_revalidation,
          unknown: ['capture_role', 'first_opportunity', 'single_use', 'rail_order', 'impulse_dependencies', 'painting', 'complete_goal_law'] },
        relations: ['contributes_to:G_official_completion'], open_question: choice.reason }],
      question: { reason: choice.reason, hypothesis_refs: choice.hypotheses }, route_refs: evidence,
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion', purpose: choice.reason,
        preconditions: facts, evidence, actions: [action], preserve_refs: [], preservation_evidence: {},
        outcome_guard: { path: ['value'], contains: focus } } } as NativeProposal;
  }
  async proposeSource(obs: NativeObservation, rows: NativeRows, _inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    this.scope(obs); if (remaining < 1) return null;
    const result = this.sourceOffers(obs, rows, remaining);
    return result.measurement ? this.proposal(obs, rows, remaining, result.offers, result.measurement) : null;
  }
  private retainRefusal(obs: NativeObservation, reason: string, search: R): void {
    this.refusal = { status: 'unknown', reason, source_owner: this.id, observation_ref: obs.observation_ref,
      level_epoch: obs.level_epoch, frame_hash: obs.frame_hash, release_authority: false, domain_complete: false,
      status_is_not_an_acquired_refutation: true, search: copy(search) };
  }
  private interrupted(obs: NativeObservation, error: unknown): boolean {
    if (error instanceof WindowExecutionInterrupted) {
      this.retainRefusal(obs, 'window_question_search_incomplete', { truncated: true,
        native_search_incomplete: { reason: error.reason, frontier: error.frontier } }); return true;
    }
    if (error instanceof RecolorComputationInterrupted) {
      this.retainRefusal(obs, 'window_question_projection_budget', { truncated: true,
        source_computation_interrupted: { cause: error.cause, frontier: error.frontier } }); return true;
    }
    return false;
  }
  async propose(obs: NativeObservation, rows: NativeRows, _inputs: readonly NativeCommand[], remaining: number,
    execution?: NativeExecution): Promise<NativeProposal | null> {
    this.refusal = null; this.scope(obs); if (remaining < 1) return null;
    try {
      const result = await this.nativeOffers(obs, rows, remaining, execution);
      if (result.bound?.truncated) {
        this.retainRefusal(obs, result.bound.native_search_incomplete ? 'window_question_search_incomplete' : 'window_question_configuration_bound', result.bound);
        return null;
      }
      if (!result.measurement || !result.offers.length) return null;
      const proposal = await this.proposal(obs, rows, remaining, result.offers, result.measurement);
      if (execution) new WindowWork(execution).check({ phase: 'source_selection_completed' });
      return proposal;
    } catch (error) { if (this.interrupted(obs, error)) return null; throw error; }
  }
  async proposeInSubquestion(group: string, question: string, obs: NativeObservation, rows: NativeRows,
    inputs: readonly NativeCommand[], remaining: number, execution?: NativeExecution): Promise<NativeProposal | null> {
    if (group !== 'factored_material_return' || question !== 'window_question') throw new TypeError('Unknown window-question source entry');
    const proposal = await this.propose(obs, rows, inputs, remaining, execution);
    if (proposal) proposal.material_access_subquestion = question; return proposal;
  }
  currentProposalRefusal(obs: NativeObservation): NativeRecord | null {
    return this.refusal && ['observation_ref', 'level_epoch', 'frame_hash'].every(key => this.refusal![key] === obs[key])
      ? copy(this.refusal) : null;
  }
  bind(proposal: R, _preserve?: unknown): void {
    if (proposal.actions.length !== 1 || !equal(proposal.actions, proposal.steps.map((step: R) => step.action ?? null))
      || !equal(proposal.actions, [proposal.window_question_plan.offer.action])) throw new TypeError('window exact binding mismatch');
  }
  beforeSource(proposal: R, index: number, publicPacket: NativePublicObservation, obs: NativeObservation): NativeBeforeResult {
    if (index !== 0 || ['observation_ref', 'level_epoch', 'frame_hash'].some(key => !equal(obs[key], proposal.binding[key]))) {
      return { admitted: false, reason: 'scope_changed' };
    }
    this.bind(proposal); const stored = proposal.window_question_plan, [offers] = this.offers(obs, publicPacket.frame_rows, stored.remaining),
      matches = offers.filter(offer => offer.key === stored.offer.key && digest(offer) === digest(stored.offer));
    return { admitted: matches.length === 1 && equal(matches[0]!.action, proposal.actions[0]),
      reason: 'exact_current_geometry_method_and_payload' };
  }
  async before(proposal: R, index: number, publicPacket: NativePublicObservation, obs: NativeObservation,
    execution?: NativeExecution): Promise<NativeBeforeResult> {
    this.refusal = null;
    try {
      if (index !== 0 || ['observation_ref', 'level_epoch', 'frame_hash'].some(key => !equal(obs[key], proposal.binding[key]))) {
        return { admitted: false, reason: 'scope_changed' };
      }
      this.bind(proposal);
      const stored = proposal.window_question_plan, storedDigest = digest(stored.offer), remaining = stored.remaining,
        result = await this.nativeOffers(obs, publicPacket.frame_rows, remaining, execution);
      if (result.bound?.truncated) {
        this.retainRefusal(obs, result.bound.native_search_incomplete ? 'window_question_search_incomplete' : 'window_question_configuration_bound', result.bound);
        return { admitted: false, reason: 'window_question_search_incomplete' };
      }
      const work = execution ? new WindowWork(execution) : null, matches: R[] = [];
      for (const [ordinal, offer] of result.offers.entries()) {
        if (offer.key === stored.offer.key && digest(offer) === storedDigest) matches.push(offer);
        if (work?.shouldYield()) await work.yield({ phase: 'exact_guard', offers_examined: ordinal + 1 });
      }
      work?.check({ phase: 'exact_guard', offers_examined: result.offers.length });
      this.bind(proposal);
      return { admitted: stored === proposal.window_question_plan && remaining === stored.remaining
        && storedDigest === digest(stored.offer) && matches.length === 1 && equal(matches[0]!.action, proposal.actions[0]),
        reason: 'exact_current_geometry_method_and_payload' };
    } catch (error) {
      if (this.interrupted(obs, error)) return { admitted: false, reason: 'window_question_search_incomplete' };
      if (error instanceof TypeError || error instanceof RangeError) return { admitted: false, reason: 'invalid_window_binding_or_geometry' };
      throw error;
    }
  }
  after(_proposal: R, _index: number, _before: NativeObservation, _after: NativeObservation,
    _first: NativeRows, _second: NativeRows): NativeAfterResult & R {
    return { matched: null, preservation_matched: null, seal_prefix: true,
      reason: 'setting_or_traversal_is_conditional_and_requires_actual_return' };
  }
  recordSource(before: NativeObservation, after: NativeObservation, command: R, first: NativeRows, second: NativeRows,
    proposal: R | null = null, _index = 0, frames: readonly NativeRows[] | null = null): R | null {
    this.refusal = null; this.scope(before); const b = measure(first); if (!b) return null;
    const refs = [before.observation_ref, after.observation_ref], boundary = before.level_epoch !== after.level_epoch,
      a = boundary ? null : measure(second), events: R[] = [];
    if (a && equal(a.signature, b.signature) && equal(a.word, b.word)
      && equal(a.boxes.map((box: R) => box.bbox), b.boxes.map((box: R) => box.bbox))) {
      const changes: R[] = [];
      for (let index = 0; index < Math.min(b.boxes.length, a.boxes.length); index++) {
        const old = b.boxes[index]!, next = a.boxes[index]!;
        for (const field of ['capacity', 'filter', 'second_field'] as const) {
          if (!equal(old[field], next[field])) changes.push({ box: index, field, before: old[field], after: next[field] });
        }
      }
      if (changes.length === 1) {
        const event = { ...changes[0]!, command, signature: a.signature, source_epoch: before.level_epoch,
          evidence: refs, authority: 'observed_field_change_not_capture_law' };
        this.edits.push(event); events.push(event);
      }
    }
    if (frames && frames.length > 1) {
      const event = { command, frames: frames.length, distinct_frames: new Set(frames.map(frame => digest(frame))).size,
        signature: b.signature, evidence: refs, boundary, score_delta: after.levels_completed - before.levels_completed,
        authority: 'observed_packet_not_complete_mechanical_model' };
      this.launches.push(event); events.push(event);
    }
    if (proposal && Object.hasOwn(proposal, 'window_question_plan')) {
      this.attempts[proposal.window_question_plan.offer.key] = { evidence: refs, events };
    }
    this.last = { status: events.length ? 'observed_window_interface' : 'no_supported_window_change', events, evidence: refs, boundary };
    const result = copy(this.last); if (boundary) this.scope(after); return result;
  }
  record(before: NativeObservation, after: NativeObservation, command: NativeCommand, first: NativeRows, second: NativeRows,
    proposal: R, index: number, frames: readonly NativeRows[]): NativeRecordResult {
    const event = this.recordSource(before, after, command, first, second, proposal, index, frames);
    return { events: event === null ? [] : [event] };
  }
}
