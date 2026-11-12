/** Pinned OrderedRecruitment: actual public returns calibrate a revisable
 * legend method; conditional queue projections never establish future success.
 */
import { RecruitmentPolicy } from './v6-ordered-recruitment-policy.ts';
import { measureOrderedRecruitment as measure, recruitmentDigest as digest } from './v6-ordered-recruitment-geometry.ts';
import { orderedRecruitmentSummary as summary, orderedRecruitmentAlternatives as alternatives,
  orderedRecruitmentAlternativesCooperative as alternativesCooperative } from './v6-ordered-recruitment-projection.ts';
import { pythonEqual as equal, pythonTruthy } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { isJsonObject } from './canonical.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeCommand, NativeExecution, NativeFamily, NativeObservation,
  NativeProgramRegistry, NativeProposal, NativePublicObservation, NativeRecord, NativeRecordResult, NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Search = { offers: R[]; measurement: R | null; bound: R | null };
const FIELDS = ['epoch', 'order', 'methods', 'portable', 'attempts', 'continuation', 'last'] as const;
const FORMAT = 'native.public_ordered_recruitment.v1';
const copy = <T>(value: T): T => structuredClone(value);

function validateState(value: R): R {
  const state = retainNativeJson(value);
  if (Object.keys(state).length !== FIELDS.length || FIELDS.some(key => !Object.hasOwn(state, key))
    || state.epoch !== null && !Number.isSafeInteger(state.epoch)
    || state.order !== null && (!Array.isArray(state.order)
      || !state.order.every((box: unknown) => Array.isArray(box) && box.length === 4 && box.every(Number.isSafeInteger)))
    || ['methods', 'portable'].some(key => !Array.isArray(state[key]) || !state[key].every(isJsonObject))
    || !isJsonObject(state.attempts) || !Object.values(state.attempts).every(isJsonObject)
    || ['continuation', 'last'].some(key => state[key] !== null && !isJsonObject(state[key]))) {
    throw new TypeError('Incompatible ordered-recruitment source state');
  }
  return state;
}

/** Complete typed JSON checkpoint identity is separate from Python equality. */
function sameState(left: any, right: any): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object'
    || Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left)) return left.length === right.length && left.every((value, index) => sameState(value, right[index]));
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every(key => Object.hasOwn(right, key) && sameState(left[key], right[key]));
}

class RecruitmentExecutionInterrupted extends Error {
  readonly reason: 'native_abort' | 'native_deadline';
  readonly frontier: R;
  constructor(reason: 'native_abort' | 'native_deadline', frontier: R) {
    super(reason); this.name = 'RecruitmentExecutionInterrupted'; this.reason = reason; this.frontier = frontier;
  }
}

/** Scheduling stays invocation-local, outside the seven original state fields. */
class RecruitmentWork {
  private readonly execution: NativeExecution;
  private visited = 0;
  private sliceStarted: number;
  constructor(execution: NativeExecution) { this.execution = execution; this.sliceStarted = this.now(); }
  private now(): number { return this.execution.now?.() ?? performance.now(); }
  check(frontier: R): void {
    if (this.execution.signal?.aborted) throw new RecruitmentExecutionInterrupted('native_abort', frontier);
    if (this.execution.deadlineMs !== undefined && this.now() >= this.execution.deadlineMs) {
      throw new RecruitmentExecutionInterrupted('native_deadline', frontier);
    }
  }
  shouldYield(): boolean { return ++this.visited % 32 === 0 || this.now() - this.sliceStarted >= 8; }
  async yield(frontier: R): Promise<void> {
    this.check(frontier);
    try { await this.execution.yieldControl(); }
    catch (error) {
      if (this.execution.signal?.aborted || error instanceof Error && error.name === 'AbortError') {
        throw new RecruitmentExecutionInterrupted('native_abort', frontier);
      }
      throw error;
    }
    this.sliceStarted = this.now(); this.check(frontier);
  }
}

export class OrderedRecruitment implements NativeFamily<any> {
  readonly id = 'public_ordered_recruitment';
  readonly policy: RecruitmentPolicy;
  epoch: number | null = null;
  order: number[][] | null = null;
  methods: R[] = [];
  portable: R[] = [];
  attempts: R = {};
  continuation: R | null = null;
  last: R | null = null;
  private checkpoint: R | null = null;
  private revision = 0;
  private refusal: R | null = null;

  private constructor(policy: RecruitmentPolicy) { this.policy = policy; }
  static async create(): Promise<OrderedRecruitment> { return new OrderedRecruitment(await RecruitmentPolicy.create()); }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> { await this.policy.attachPrograms(registry); }
  private sourceView(): R {
    return { epoch: this.epoch, order: this.order, methods: this.methods, portable: this.portable,
      attempts: this.attempts, continuation: this.continuation, last: this.last };
  }
  get nativeRevision(): number { this.nativeState(); return this.revision; }
  state(): R { return copy(this.sourceView()); }
  sourceState(): R { return this.state(); }
  /** The original common caller saves only acquired methods, portability or attempts. */
  sourceStateShouldPersist(): boolean {
    return this.methods.length > 0 || this.portable.length > 0 || Object.keys(this.attempts).length > 0;
  }
  nativeState(): NativeRecord {
    const source = validateState(this.sourceView());
    if (this.checkpoint && sameState(this.checkpoint.source_state, source)) return this.checkpoint;
    this.checkpoint = retainNativeJson({ format: FORMAT, source_state: source }); this.revision++; return this.checkpoint;
  }
  restore(value: NativeRecord): void {
    if (!isJsonObject(value)) throw new TypeError('Ordered-recruitment restore requires a source state mapping');
    const next = validateState({ ...this.sourceView(),
      ...Object.fromEntries(FIELDS.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]])) });
    for (const key of FIELDS) (this as unknown as R)[key] = copy(next[key]);
    this.refusal = null;
  }
  restoreNative(value: Readonly<NativeRecord>): void {
    if (value === this.checkpoint) {
      let current: R | null = null;
      try { current = validateState(this.sourceView()); }
      catch (error) { if (!(error instanceof TypeError)) throw error; }
      if (current && sameState(current, this.checkpoint!.source_state)) { this.refusal = null; return; }
    }
    const supplied = retainNativeJson(value);
    if (!isJsonObject(supplied) || supplied.format !== FORMAT || Object.keys(supplied).length !== 2 || !isJsonObject(supplied.source_state)) {
      throw new TypeError('Invalid native ordered-recruitment checkpoint');
    }
    const next = validateState(supplied.source_state), changed = !this.checkpoint || !sameState(this.checkpoint.source_state, next);
    for (const key of FIELDS) (this as unknown as R)[key] = copy(next[key]);
    this.checkpoint = supplied; if (changed) this.revision++; this.refusal = null;
  }
  scope(obs: R): void {
    if (equal(this.epoch, obs.level_epoch)) return;
    if (this.methods.length) this.portable.push({ source_epoch: this.epoch, methods: this.methods,
      authority: 'revisable_method_not_current_permit' });
    this.epoch = obs.level_epoch; this.order = null; this.methods = []; this.attempts = {}; this.continuation = null; this.last = null;
  }
  private *methodEntries(): Generator<R> {
    for (const method of this.methods) yield method;
    for (const portable of this.portable) for (const method of portable.methods) yield method;
  }
  private methodsFor(measurement: R): R[] {
    const methods: R[] = [];
    for (const method of this.methodEntries()) if (equal(method.signature, measurement.signature)) methods.push(method);
    return methods;
  }
  private validatedContinuation(measurement: R): R | null {
    const stored = this.continuation;
    return stored && pythonTruthy(stored.steps) && equal(stored.steps[0].expected_context, summary(measurement))
      && digest(stored.legend) === digest(measurement.legend) && digest(stored.order) === digest(measurement.order) ? stored : null;
  }
  private offerForPlan(obs: R, measurement: R, methods: R[], plan: R, search: R, kind: string, remaining: number): R | null {
    if (!plan.steps.length || plan.steps.length > remaining) return null;
    const step = plan.steps[0]; let action = step.action;
    // Source checks the projected action domain before resolving a current button.
    if (!obs.available_action_refs.includes(action.action_ref)) return null;
    if (step.kind === 'assign') {
      const buttons = measurement.buttons.filter((button: R) => equal(button.type, step.type));
      if (buttons.length !== 1) return null;
      const [x, y] = buttons[0].point;
      action = { action_ref: this.policy.config.point_action, data: { x, y } };
    }
    const key = digest([obs.level_epoch, measurement, action]);
    if (Object.hasOwn(this.attempts, key)) return null;
    return { kind, key, action, cost: plan.steps.length, survivors: plan.survivors,
      facts: { actual_interface_contrast: true, current_scene_revalidated: true, conditional_parent_survival: true, untried_context: true },
      measurement, plan, step, search,
      method_revalidation: { methods, signature: measurement.signature, current_epoch: obs.level_epoch,
        current_observation: obs.observation_ref, release_authority: false } };
  }
  private sourceOffers(obs: R, rows: NativeRows, remaining: number): Search {
    const measurement = measure(rows, this.order); if (!measurement) return { offers: [], measurement, bound: null };
    const methods = this.methodsFor(measurement); if (!methods.length) return { offers: [], measurement, bound: null };
    const stored = this.validatedContinuation(measurement), kind = stored ? 'continuation' : 'composition_question';
    const [plans, bound] = stored ? [[stored], { status: 'validated_suffix_retained_no_new_search' }] as [R[], R]
      : alternatives(measurement, this.policy.config, obs, remaining);
    const offers: R[] = [];
    for (const plan of plans) {
      const offer = this.offerForPlan(obs, measurement, methods, plan, bound, kind, remaining); if (offer) offers.push(offer);
    }
    return { offers, measurement, bound };
  }
  offers(obs: R, rows: NativeRows, remaining: number): [R[], R | null] {
    const result = this.sourceOffers(obs, rows, remaining); return [result.offers, result.measurement];
  }
  private async nativeOffers(obs: R, rows: NativeRows, remaining: number, execution?: NativeExecution): Promise<Search> {
    // Even a direct native call without a host scheduler must reject an
    // incomplete consumed reduction. Only the source APIs retain source search.
    const work = execution ? new RecruitmentWork(execution) : null; work?.check({ phase: 'measurement' });
    const measurement = measure(rows, this.order); work?.check({ phase: 'measurement' });
    if (!measurement) return { offers: [], measurement, bound: null };
    const methods: R[] = []; let examined = 0;
    for (const method of this.methodEntries()) {
      if (equal(method.signature, measurement.signature)) methods.push(method);
      examined++;
      if (work?.shouldYield()) await work.yield({ phase: 'method_revalidation', methods_examined: examined });
    }
    work?.check({ phase: 'method_revalidation', methods_examined: examined });
    if (!methods.length) return { offers: [], measurement, bound: null };
    const stored = this.validatedContinuation(measurement), kind = stored ? 'continuation' : 'composition_question';
    const [plans, bound] = stored ? [[stored], { status: 'validated_suffix_retained_no_new_search' }] as [R[], R]
      : await alternativesCooperative(measurement, this.policy.config, obs, remaining, execution);
    const offers: R[] = [];
    if (bound.truncated) return { offers, measurement, bound };
    for (const [index, plan] of plans.entries()) {
      const offer = this.offerForPlan(obs, measurement, methods, plan, bound, kind, remaining); if (offer) offers.push(offer);
      if (work?.shouldYield()) await work.yield({ phase: 'offer_construction', plans_examined: index + 1 });
    }
    work?.check({ phase: 'offer_construction', plans_examined: plans.length });
    return { offers, measurement, bound };
  }
  private async proposal(obs: NativeObservation, rows: NativeRows, remaining: number, offers: R[], measurement: R): Promise<NativeProposal | null> {
    if (!offers.length) return null;
    const [choice, workflow] = await this.policy.choose(offers); if (choice.status !== 'selected') return null;
    const offer = offers[choice.index]!, action = offer.action, step: R = { action, expected_after: null },
      focus = 'composition:ordered_replenishment:' + digest([obs.level_epoch, measurement.order, offer.plan.steps]),
      evidence = [obs.observation_ref, ...offer.method_revalidation.methods.flatMap((method: R) => method.evidence)];
    if (Object.hasOwn(action, 'data')) {
      const button = measurement.buttons.find((candidate: R) => equal(candidate.type, offer.step.type));
      if (!button) throw new TypeError('Ordered recruitment action has no current button');
      const [x, y] = button.point;
      step.point_binding = { entity_ref: 'role_button:' + digest(button.bbox), observation_ref: obs.observation_ref,
        signature: digest(button), bbox: button.bbox, level_epoch: obs.level_epoch, frame_hash: obs.frame_hash,
        point: [x, y], palette_value: rows[y]![x], source: 'current_button_and_legend_correspondence' };
    }
    const facts = { ordered_recruitment_current: true };
    return { status: 'proposed', kind: this.id, actions: [action], steps: [step], facts,
      binding: Object.fromEntries(['observation_ref', 'level_epoch', 'frame_hash', 'levels_completed'].map(key => [key, obs[key]])),
      recruitment_plan: { offer, remaining, choice, workflow, drm_hash: this.policy.loaded.source_hash },
      compositions: [{ id: focus, role: 'conditional_ordered_survival_and_replenishment', observed: false,
        things: ['rooms:' + digest(measurement.order), 'queue:' + digest(summary(measurement))],
        properties: { projection: offer.plan, method_revalidation: offer.method_revalidation,
          hypotheses: this.policy.config.hypotheses,
          unknown: ['unseen_relation_outcomes', 'tie_outcome', 'full_folded_order', 'all_future_phase_boundaries', 'final_goal_law'] },
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
    if (error instanceof RecruitmentExecutionInterrupted) {
      this.retainRefusal(obs, 'ordered_recruitment_search_incomplete', { truncated: true,
        native_search_incomplete: { reason: error.reason, frontier: error.frontier } }); return true;
    }
    return false;
  }
  async propose(obs: NativeObservation, rows: NativeRows, _inputs: readonly NativeCommand[], remaining: number,
    execution?: NativeExecution): Promise<NativeProposal | null> {
    this.refusal = null; this.scope(obs); if (remaining < 1) return null;
    try {
      const result = await this.nativeOffers(obs, rows, remaining, execution);
      if (result.bound?.truncated) {
        this.retainRefusal(obs, result.bound.native_search_incomplete ? 'ordered_recruitment_search_incomplete' : 'ordered_recruitment_configuration_bound', result.bound);
        return null;
      }
      if (!result.measurement || !result.offers.length) return null;
      const proposal = await this.proposal(obs, rows, remaining, result.offers, result.measurement);
      if (execution) new RecruitmentWork(execution).check({ phase: 'source_selection_completed' });
      return proposal;
    } catch (error) { if (this.interrupted(obs, error)) return null; throw error; }
  }
  async proposeInSubquestion(group: string, question: string, obs: NativeObservation, rows: NativeRows,
    inputs: readonly NativeCommand[], remaining: number, execution?: NativeExecution): Promise<NativeProposal | null> {
    if (group !== 'factored_material_return' || question !== 'ordered_recruitment') throw new TypeError('Unknown ordered-recruitment source entry');
    const proposal = await this.propose(obs, rows, inputs, remaining, execution);
    if (proposal) proposal.material_access_subquestion = question; return proposal;
  }
  currentProposalRefusal(obs: NativeObservation): NativeRecord | null {
    return this.refusal && ['observation_ref', 'level_epoch', 'frame_hash'].every(key => equal(this.refusal![key], obs[key]))
      ? copy(this.refusal) : null;
  }
  bind(proposal: R, _preserve?: unknown): void {
    if (proposal.actions.length !== 1 || !equal(proposal.actions, proposal.steps.map((step: R) => step.action ?? null))
      || !equal(proposal.actions, [proposal.recruitment_plan.offer.action])) throw new TypeError('ordered exact binding mismatch');
  }
  beforeSource(proposal: R, index: number, publicPacket: NativePublicObservation, obs: NativeObservation): NativeBeforeResult {
    if (index !== 0 || ['observation_ref', 'level_epoch', 'frame_hash'].some(key => !equal(obs[key], proposal.binding[key]))) {
      return { admitted: false, reason: 'scope_changed' };
    }
    this.bind(proposal); const stored = proposal.recruitment_plan, [offers] = this.offers(obs, publicPacket.frame_rows, stored.remaining),
      matches = offers.filter(offer => offer.key === stored.offer.key && digest(offer) === digest(stored.offer));
    return { admitted: matches.length === 1 && equal(matches[0]!.action, proposal.actions[0]),
      reason: 'actual_front_marker_current_queues_legend_buttons_and_exact_payload' };
  }
  async before(proposal: R, index: number, publicPacket: NativePublicObservation, obs: NativeObservation,
    execution?: NativeExecution): Promise<NativeBeforeResult> {
    this.refusal = null;
    try {
      if (index !== 0 || ['observation_ref', 'level_epoch', 'frame_hash'].some(key => !equal(obs[key], proposal.binding[key]))) {
        return { admitted: false, reason: 'scope_changed' };
      }
      this.bind(proposal);
      const stored = proposal.recruitment_plan, storedDigest = digest(stored.offer), remaining = stored.remaining,
        result = await this.nativeOffers(obs, publicPacket.frame_rows, remaining, execution);
      if (result.bound?.truncated) {
        this.retainRefusal(obs, result.bound.native_search_incomplete ? 'ordered_recruitment_search_incomplete' : 'ordered_recruitment_configuration_bound', result.bound);
        return { admitted: false, reason: 'ordered_recruitment_search_incomplete' };
      }
      const work = execution ? new RecruitmentWork(execution) : null, matches: R[] = [];
      for (const [ordinal, offer] of result.offers.entries()) {
        if (offer.key === stored.offer.key && digest(offer) === storedDigest) matches.push(offer);
        if (work?.shouldYield()) await work.yield({ phase: 'exact_guard', offers_examined: ordinal + 1 });
      }
      work?.check({ phase: 'exact_guard', offers_examined: result.offers.length });
      this.bind(proposal);
      return { admitted: stored === proposal.recruitment_plan && remaining === stored.remaining
        && storedDigest === digest(stored.offer) && matches.length === 1 && equal(matches[0]!.action, proposal.actions[0]),
        reason: 'actual_front_marker_current_queues_legend_buttons_and_exact_payload' };
    } catch (error) {
      if (this.interrupted(obs, error)) return { admitted: false, reason: 'ordered_recruitment_search_incomplete' };
      if (error instanceof TypeError || error instanceof RangeError) return { admitted: false, reason: 'invalid_ordered_recruitment_binding_or_geometry' };
      throw error;
    }
  }
  after(_proposal: R, _index: number, _before: NativeObservation, _after: NativeObservation,
    _first: NativeRows, _second: NativeRows): NativeAfterResult & R {
    return { matched: null, preservation_matched: null, seal_prefix: true,
      reason: 'conditional_append_or_engagement_requires_actual_return' };
  }
  recordSource(before: NativeObservation, after: NativeObservation, command: R, first: NativeRows, second: NativeRows,
    proposal: R | null = null, _index = 0, frames: readonly NativeRows[] | null = null): R | null {
    this.refusal = null; this.scope(before); const b = measure(first, this.order); if (!b) return null;
    if (this.order === null) this.order = b.order;
    const refs = [before.observation_ref, after.observation_ref], boundary = !equal(before.level_epoch, after.level_epoch),
      a = boundary ? null : measure(second, this.order), events: R[] = [];
    if (a && equal(a.signature, b.signature)) {
      const old = summary(b), next = summary(a);
      if (old.phase === 'COMBAT' && next.phase === 'RECRUIT' && equal(old.room, next.room) && equal(old.queue, next.queue)
        && old.enemy.length === 1 && !next.enemy.length) {
        const left = old.queue[0], right = old.enemy[0],
          relation = b.legend.relations.filter((row: R) => equal(b.types[row.left[0]], left) && equal(b.types[row.right[0]], right));
        if (relation.length === 1) {
          const receipt = { kind: 'legend_direction_calibrated_by_actual_single_enemy_return', signature: a.signature,
            command, observed_pair: [left, right], evidence: refs, source_epoch: before.level_epoch,
            unknown: ['other_relation_outcomes', 'tie_outcome', 'full_queue_order'] };
          this.methods.push(receipt); events.push(receipt);
        }
      }
      if (old.phase === 'RECRUIT' && command.action_ref === this.policy.config.point_action
        && equal(next.queue.slice(0, -1), old.queue) && next.queue.length === old.queue.length + 1) {
        events.push({ kind: 'one_current_occurrence_appended', type: next.queue[next.queue.length - 1], before: old, after: next, evidence: refs });
      }
    }
    if (proposal && Object.hasOwn(proposal, 'recruitment_plan')) {
      const offer = proposal.recruitment_plan.offer, expected = offer.step.projected_context, actual = a ? summary(a) : null,
        compatible = !boundary && equal(actual, expected);
      this.attempts[offer.key] = { evidence: refs, observed_context: actual, projected_context: expected, matched_context: compatible, boundary };
      if (compatible && offer.plan.steps.length > 1) {
        this.continuation = { ...offer.plan, steps: offer.plan.steps.slice(1), legend: a!.legend, order: a!.order, evidence: refs };
      } else this.continuation = null;
      events.push({ kind: 'conditional_plan_reconciled', matched_context: compatible, actual, expected, boundary,
        score_delta: after.levels_completed - before.levels_completed });
    }
    if (!a && !boundary) { this.order = null; this.continuation = null; }
    this.last = { status: events.length ? 'observed_ordered_interface' : 'no_supported_ordered_change',
      events, evidence: refs, boundary, returned_frames: frames?.length ?? 0 };
    const result = copy(this.last); if (boundary) this.scope(after); return result;
  }
  record(before: NativeObservation, after: NativeObservation, command: NativeCommand, first: NativeRows, second: NativeRows,
    proposal: R, index: number, frames: readonly NativeRows[]): NativeRecordResult {
    const event = this.recordSource(before, after, command, first, second, proposal, index, frames);
    return { events: event === null ? [] : [event] };
  }
}
