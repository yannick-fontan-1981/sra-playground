/** Exact consumed V6 OrderedReaction owner and declared material entry.
 * Ordered public animation records remain evidence of a conditional process;
 * they do not establish a complete reaction law or a terminal objective.
 */
import { ReactionPolicy } from './v6-ordered-reaction-policy.ts';
import { digest, measure, observe, measureSquareField } from './v6-ordered-reaction-measurements.ts';
import { pythonEqual as eq, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { isJsonObject } from './canonical.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeCommand, NativeFamily, NativeObservation,
  NativeProgramRegistry, NativeProposal, NativePublicObservation, NativeRecord, NativeRecordResult, NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const FIELDS = ['epoch', 'control', 'packets', 'attempts', 'progress', 'history'] as const;
const FORMAT = 'native.public_ordered_reaction.v1';

function validateState(value: R): R {
  const state = retainNativeJson(value);
  if (Object.keys(state).length !== FIELDS.length || FIELDS.some(k => !Object.hasOwn(state, k))
    || state.epoch !== null && !Number.isSafeInteger(state.epoch)
    || ['control', 'packets', 'history'].some(k => !Array.isArray(state[k]) || !state[k].every(isJsonObject))
    || !isJsonObject(state.attempts) || !Object.values(state.attempts).every(isJsonObject)
    || state.progress !== null && !isJsonObject(state.progress)) throw new TypeError('Incompatible ordered-reaction source state');
  return state;
}

export class OrderedReaction implements NativeFamily<any> {
  readonly id = 'public_ordered_reaction';
  readonly policy: ReactionPolicy;
  epoch: number | null = null;
  control: R[] = [];
  packets: R[] = [];
  attempts: R = {};
  progress: R | null = null;
  history: R[] = [];
  private checkpoint: R | null = null;
  private revision = 0;

  private constructor(policy: ReactionPolicy) { this.policy = policy; }
  static async create(): Promise<OrderedReaction> { return new OrderedReaction(await ReactionPolicy.create()); }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> { await this.policy.attachPrograms(registry); }
  get nativeRevision(): number { this.nativeState(); return this.revision; }
  state(): R { return copy(Object.fromEntries(FIELDS.map(k => [k, this[k]]))); }
  sourceState(): R { return this.state(); }
  nativeState(): NativeRecord {
    const state = validateState(Object.fromEntries(FIELDS.map(k => [k, this[k]])));
    if (this.checkpoint && eq(this.checkpoint.source_state, state)) return this.checkpoint;
    this.checkpoint = retainNativeJson({ format: FORMAT, source_state: state }); this.revision++;
    return this.checkpoint;
  }
  restore(value: NativeRecord): void {
    if (!isJsonObject(value)) throw new TypeError('Ordered-reaction restore requires a source state mapping');
    const next = validateState({ ...this.state(), ...Object.fromEntries(FIELDS.filter(k => Object.hasOwn(value, k)).map(k => [k, value[k]])) });
    for (const k of FIELDS) (this as unknown as R)[k] = copy(next[k]);
  }
  restoreNative(value: Readonly<NativeRecord>): void {
    if (value === this.checkpoint && eq(this.state(), this.checkpoint!.source_state)) return;
    const supplied = retainNativeJson(value);
    if (!isJsonObject(supplied) || supplied.format !== FORMAT || Object.keys(supplied).length !== 2 || !isJsonObject(supplied.source_state)) {
      throw new TypeError('Invalid native ordered-reaction checkpoint');
    }
    const next = validateState(supplied.source_state), changed = !this.checkpoint || !eq(this.checkpoint.source_state, next);
    for (const k of FIELDS) (this as unknown as R)[k] = copy(next[k]);
    this.checkpoint = supplied; if (changed) this.revision++;
  }
  scope(obs: R): void {
    if (this.epoch === obs.level_epoch) return;
    if (this.packets.length) this.history.push({ epoch: this.epoch, packets: copy(this.packets), authority: 'history_only_no_current_permit' });
    this.epoch = obs.level_epoch; this.control = []; this.packets = []; this.attempts = {}; this.progress = null;
  }
  measurement(rows: NativeRows): [R, R] { return measure(rows, this.packets, this.policy.config.direction_prior); }
  offers(obs: R, rows: NativeRows): R[] {
    const [facts, per] = this.measurement(rows), out: R[] = [], field = measureSquareField(rows);
    if (field === null || !truth(facts.ordered_tip_unique_ring_present) || !this.control.length) return out;
    const current = [field.stride, field.size, field.row_phase, field.col_phase], controls = this.control.filter(c => eq(c.lattice, current));
    if (!controls.length) return out;
    const ring = [...facts.ordered_tip_ring_position], process = this.policy.config.process_prior,
      context = digest([obs.level_epoch, rows]), known = this.progress && this.progress.after_hash === digest(rows) && this.progress.progress;
    const commands: [string, string][] = [];
    for (const [action, af] of Object.entries(per) as [string, R][]) if (truth(af.ordered_tip_first_shortest_route_edge)) commands.push(['cover', action]);
    commands.push(['protected', facts.ordered_tip_packet_action_ref ?? process], ['continue', truth(this.progress) ? this.progress!.action : process], ['probe', process]);
    for (const [kind, action] of commands) {
      if (!obs.available_action_refs.includes(action)) continue;
      const attempt = digest([context, action]), f = { ...facts, ...(per[action] ?? {}), candidate_ref: attempt, action_ref: action,
        current_control_translation_observed: true, current_input_bound: true, untried_current_context: !Object.hasOwn(this.attempts, attempt),
        last_action_known_to_produce_scene_effect: true, is_directional_interface_action: Object.hasOwn(this.policy.config.direction_prior, action),
        interaction_kind: 'discrete', interaction_measurement_kind: 'discrete',
        action_execution_count: Object.values(this.attempts).filter((v: any) => v.action === action).length,
        attempted_without_effect_in_current_context: Object.hasOwn(this.attempts, attempt), current_progress_without_restoration: truth(known) };
      const delta = this.policy.config.direction_prior[action], expected = kind === 'cover'
        ? [ring[0] + delta[0] * field.stride, ring[1] + delta[1] * field.stride] : null;
      out.push({ kind, action: { action_ref: action }, expected, ring, attempt, context, facts: f, lattice: current,
        evidence: [obs.observation_ref, ...controls.flatMap(c => c.evidence), ...this.packets.map(p => p.evidence_ref)], hypotheses: this.policy.config.hypotheses });
    }
    return out;
  }
  async propose(obs: NativeObservation, rows: NativeRows, _inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    this.scope(obs); if (remaining < 1) return null;
    const offers = this.offers(obs, rows), [choice, workflow] = await this.policy.choose(offers);
    if (choice.status !== 'selected') return null;
    const offer = offers[choice.index]!, focus = 'ordered_reaction:' + offer.attempt, actions = [offer.action],
      step = { action: offer.action, expected_after: offer.expected }, facts = { mechanism: 'measured_ordered_field_conditional_intervention',
        hypothesis: true, continuation: offer.kind === 'continue', projection: choice.projection_ref }, evidence = offer.evidence;
    return { status: 'proposed', kind: 'public_ordered_reaction', actions, steps: [step], facts,
      binding: Object.fromEntries(['observation_ref', 'level_epoch', 'frame_hash', 'levels_completed'].map(k => [k, obs[k]])),
      reaction_plan: { offer, choice, workflow, drm_hash: this.policy.loaded.source_hash },
      compositions: [{ id: focus, role: 'conditional_ordered_process_or_arrival_protection', observed: false,
        things: ['current_outline', 'measured_oriented_field'], properties: { hypotheses: offer.hypotheses,
          incidences: offer.facts.ordered_tip_temporal_incidences ?? [], unknown: ['phase_laws', 'quota', 'terminal_role', 'overlay_blocking'] },
        relations: ['contributes_to:G_official_completion'], open_question: choice.reason }], question: { reason: choice.reason }, route_refs: evidence,
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion', purpose: choice.reason,
        preconditions: facts, evidence, actions, preserve_refs: [], preservation_evidence: {}, outcome_guard: { path: ['value'], contains: focus } } };
  }
  async proposeInSubquestion(group: string, question: string, obs: NativeObservation, rows: NativeRows,
    inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    if (group !== 'factored_material_return' || question !== 'ordered_reaction') throw new TypeError('Unknown ordered-reaction source entry');
    const proposal = await this.propose(obs, rows, inputs, remaining);
    if (proposal) proposal.material_access_subquestion = question;
    return proposal;
  }
  bind(proposal: R, _preserve?: unknown): void {
    const offer = proposal.reaction_plan.offer;
    if (!eq(proposal.actions, [offer.action]) || !eq(proposal.steps, [{ action: offer.action, expected_after: offer.expected }])) {
      throw new TypeError('exact declared reaction input');
    }
  }
  before(proposal: R, index: number, publicPacket: NativePublicObservation, obs: NativeObservation): NativeBeforeResult {
    this.bind(proposal);
    if (index !== 0 || Object.keys(proposal.binding).some(k => !eq(obs[k], proposal.binding[k]))) return { admitted: false, reason: 'stale_scope_or_observation' };
    const offer = proposal.reaction_plan.offer, offers = this.offers(obs, publicPacket.frame_rows);
    return { admitted: offers.filter(v => digest(v) === digest(offer)).length === 1, reason: 'exact_current_outline_field_evidence_and_declared_input' };
  }
  after(proposal: R, index: number, _before: NativeObservation, _after: NativeObservation, _first: NativeRows, second: NativeRows): NativeAfterResult {
    const expected = proposal.steps[index].expected_after, [facts] = this.measurement(second),
      matched = expected === null ? null : eq(facts.ordered_tip_ring_position ?? [], expected);
    return { matched, preservation_matched: null, seal_prefix: true, reason: 'unknown_process_or_observed_outline_arrival_not_full_reaction_law' } as NativeAfterResult;
  }
  recordSource(before: NativeObservation, after: NativeObservation, command: R, first: NativeRows, second: NativeRows,
    proposal: R | null = null, _index = 0, frames?: readonly NativeRows[]): R | null {
    this.scope(before);
    const action = command.action_ref, evidence = [before.observation_ref, after.observation_ref], [fb] = this.measurement(first),
      [fa] = this.measurement(second), field = measureSquareField(first);
    let event: R | null = null;
    if (before.level_epoch !== after.level_epoch) {
      event = { status: 'official_boundary', evidence, score_delta: after.levels_completed - before.levels_completed }; this.scope(after); return event;
    }
    if (field && truth(fb.ordered_tip_unique_ring_present) && truth(fa.ordered_tip_unique_ring_present)
      && Object.hasOwn(this.policy.config.direction_prior, action)) {
      const p = fb.ordered_tip_ring_position, q = fa.ordered_tip_ring_position, delta = [q[0] - p[0], q[1] - p[1]], prior = this.policy.config.direction_prior[action];
      if (eq(delta, prior.map((v: number) => v * field.stride)) && !eq(delta, [0, 0])) {
        const item = { action, delta, lattice: [field.stride, field.size, field.row_phase, field.col_phase], evidence };
        this.control.push(item); this.control = this.control.slice(-16); event = { status: 'observed_outline_translation', ...item };
      }
    }
    const ordered = frames?.length ? frames : [second], packet = observe(first, ordered, action);
    if (packet) {
      const item = { packet, evidence_ref: after.observation_ref, before_ref: before.observation_ref, source_digest: digest([first, ordered]) };
      if (!this.packets.some(p => digest(p.packet) === digest(packet))) this.packets.push(item);
      this.packets = this.packets.slice(-4); this.progress = { action, after_hash: digest(second), progress: !eq(first, second), evidence };
      event = { status: 'ordered_marker_change_observed', evidence, packet_digest: digest(packet), frames: packet.frame_count,
        restored: eq(first, second), complete_law_acquired: false };
    } else if (!Object.hasOwn(this.policy.config.direction_prior, action)) this.progress = null;
    if (proposal && Object.hasOwn(proposal, 'reaction_plan')) {
      const offer = proposal.reaction_plan.offer;
      this.attempts[offer.attempt] = { action, evidence, event, result_unknown: event === null };
    }
    return event;
  }
  record(before: NativeObservation, after: NativeObservation, command: NativeCommand, first: NativeRows, second: NativeRows,
    proposal: R, index: number, frames: readonly NativeRows[]): NativeRecordResult {
    return { events: [this.recordSource(before, after, command, first, second, proposal, index, frames)] };
  }
}
