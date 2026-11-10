/** Pinned V6 AxialQuestion owner. Measured orientations and selected markers
 * support one conditional input; neither projection nor recall proves forces,
 * interaction direction, transmission through walls or official completion.
 */
import { AxialPolicy } from './v6-axial-question-policy.ts';
import { measure, relations, projectedTurns, digest } from './v6-axial-question-geometry.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { isJsonObject } from './canonical.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeCommand, NativeFamily, NativeObservation,
  NativeProgramRegistry, NativeProposal, NativePublicObservation, NativeRecord, NativeRecordResult, NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const FIELDS = ['epoch', 'selection', 'rotations', 'portable', 'attempts', 'last'] as const;
const FORMAT = 'native.public_axial_question.v1';
const copy = <T>(value: T): T => structuredClone(value);
const modulo = (n: number, size: number): number => ((n % size) + size) % size;
function indexOfAxis(cycle: readonly number[][], axis: readonly number[]): number {
  const index = cycle.findIndex(item => equal(item, axis));
  if (index < 0) throw new RangeError('Axial orientation is outside the source cycle');
  return index;
}
function validateState(value: R): R {
  const state = retainNativeJson(value);
  if (Object.keys(state).length !== FIELDS.length || FIELDS.some(k => !Object.hasOwn(state, k))
    || state.epoch !== null && !Number.isSafeInteger(state.epoch)
    || ['selection', 'last'].some(k => state[k] !== null && !isJsonObject(state[k]))
    || ['rotations', 'portable'].some(k => !Array.isArray(state[k]) || !state[k].every(isJsonObject))
    || !isJsonObject(state.attempts) || !Object.values(state.attempts).every(isJsonObject)) {
    throw new TypeError('Incompatible axial-question source state');
  }
  return state;
}
function changedPixels(first: NativeRows, second: NativeRows): number[][] {
  const changed: number[][] = [];
  for (let y = 0; y < first.length; y++) for (let x = 0; x < first[y]!.length; x++) {
    if (second[y]?.[x] === undefined) throw new RangeError('Axial return is smaller than the source raster');
    if (first[y]![x] !== second[y]![x]) changed.push([x, y]);
  }
  return changed;
}

export class AxialQuestion implements NativeFamily<any> {
  readonly id = 'public_axial_question';
  readonly policy: AxialPolicy;
  epoch: number | null = null;
  selection: R | null = null;
  rotations: R[] = [];
  portable: R[] = [];
  attempts: R = {};
  last: R | null = null;
  private checkpoint: R | null = null;
  private revision = 0;

  private constructor(policy: AxialPolicy) { this.policy = policy; }
  static async create(): Promise<AxialQuestion> { return new AxialQuestion(await AxialPolicy.create()); }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> { await this.policy.attachPrograms(registry); }
  get nativeRevision(): number { this.nativeState(); return this.revision; }
  state(): R { return copy(Object.fromEntries(FIELDS.map(k => [k, this[k]]))); }
  sourceState(): R { return this.state(); }
  nativeState(): NativeRecord {
    const source = validateState(Object.fromEntries(FIELDS.map(k => [k, this[k]])));
    if (this.checkpoint && equal(this.checkpoint.source_state, source)) return this.checkpoint;
    this.checkpoint = retainNativeJson({ format: FORMAT, source_state: source }); this.revision++; return this.checkpoint;
  }
  restore(value: NativeRecord): void {
    if (!isJsonObject(value)) throw new TypeError('Axial-question restore requires a source state mapping');
    const next = validateState({ ...this.state(), ...Object.fromEntries(FIELDS.filter(k => Object.hasOwn(value, k)).map(k => [k, value[k]])) });
    for (const k of FIELDS) (this as unknown as R)[k] = copy(next[k]);
  }
  restoreNative(value: Readonly<NativeRecord>): void {
    if (value === this.checkpoint && equal(this.state(), this.checkpoint!.source_state)) return;
    const supplied = retainNativeJson(value);
    if (!isJsonObject(supplied) || supplied.format !== FORMAT || Object.keys(supplied).length !== 2 || !isJsonObject(supplied.source_state)) {
      throw new TypeError('Invalid native axial-question checkpoint');
    }
    const next = validateState(supplied.source_state), changed = !this.checkpoint || !equal(this.checkpoint.source_state, next);
    for (const k of FIELDS) (this as unknown as R)[k] = copy(next[k]);
    this.checkpoint = supplied; if (changed) this.revision++;
  }
  scope(obs: R): void {
    if (this.epoch === obs.level_epoch) return;
    if (this.rotations.length) this.portable.push({ source_epoch: this.epoch, methods: this.rotations,
      authority: 'revisable_method_not_current_permit' });
    this.epoch = obs.level_epoch; this.selection = null; this.rotations = []; this.attempts = {}; this.last = null;
  }
  methodSignature(m: R): R {
    return { size: m.quantum, opposed_distinct_bars: true, core_side_distinct: m.bodies[0].core !== m.bodies[0].side };
  }
  offers(obs: R, rows: NativeRows): [R[], R | null] {
    const m = measure(rows);
    if (!m || !m.selected || m.ambiguous_selection || !this.selection) return [[], m];
    const actor = m.selected, selected = this.selection;
    if (selected.epoch !== obs.level_epoch || !equal(actor.center, selected.center) || actor.marker !== selected.marker
      || !equal(this.methodSignature(m), selected.signature)) return [[], m];
    const cfg = this.policy.config, cycle = cfg.cycle as number[][], projections = projectedTurns(m, actor, cycle), out: R[] = [],
      methods: R[] = [...this.portable.flatMap(p => p.methods), ...this.rotations];
    for (const measuredRelation of relations(m, actor)) {
      const declared = cfg.desired_axis_relation[measuredRelation.kind], relation = { ...measuredRelation,
        // Python integer multiplication never introduces IEEE negative zero.
        desired_axis: measuredRelation.peer.axis.map(v => declared.multiplier * v + 0), direction_hypothesis: declared.hypothesis };
      if (equal(relation.desired_axis, actor.axis)) continue;
      for (const prior of cfg.rotation_priors as R[]) {
        if (!obs.available_action_refs.includes(prior.action)) continue;
        let turn = prior.turn;
        const method = [...methods].reverse().find(r => r.action === prior.action && equal(r.signature, this.methodSignature(m))
          && r.evidence.length >= 2) ?? null;
        if (method) turn = method.turn;
        const projected = projections.find(p => p.turn === turn);
        if (!projected) throw new RangeError('Axial recalled turn is outside the source pivot domain');
        const distance = modulo((indexOfAxis(cycle, relation.desired_axis) - indexOfAxis(cycle, actor.axis)) * turn, cycle.length),
          key = digest([obs.level_epoch, m.target, m.bodies.map(b => [b.center, b.axis, b.marker]), prior.action, relation.kind]);
        if (!distance || Object.hasOwn(this.attempts, key)) continue;
        out.push({ kind: relation.kind, facts: { selection_attested_current: true, goal_marker_unique: true, scope_current: true },
          quarter_distance: distance, recalled_control_first: method ? 0 : 1, action: prior.action, turn, projection: projected,
          relation, measurement: m, actor, key, selection_evidence: selected.evidence,
          method_revalidation: method ? { method, current_observation_ref: obs.observation_ref, current_epoch: obs.level_epoch,
            current_frame_hash: obs.frame_hash, current_signature: this.methodSignature(m),
            status: 'current_support_and_command_match', release_authority: false } : null });
      }
    }
    return [out, m];
  }
  async proposeSource(obs: NativeObservation, rows: NativeRows, _inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    this.scope(obs); if (remaining < 1) return null;
    const [offers, m] = this.offers(obs, rows); if (!offers.length || !m) return null;
    const [choice, workflow] = await this.policy.choose(offers); if (choice.status !== 'selected') return null;
    const s = offers[choice.index]!, action: R = { action_ref: s.action },
      focus = 'composition:axial:' + digest([obs.level_epoch, this.selection!.evidence[0], m.target, s.kind]),
      facts = { axial_question_current: true }, evidence = [obs.observation_ref, ...s.selection_evidence,
        ...(s.method_revalidation ? s.method_revalidation.method.evidence : [])];
    // The original non-pointed command has no data member. Preserve its source
    // identity; the common public transport normalizes commands at execution.
    const proposal: R = { status: 'proposed', kind: this.id, actions: [action], steps: [{ action, expected_after: null }], facts,
      binding: Object.fromEntries(['observation_ref', 'level_epoch', 'frame_hash', 'levels_completed'].map(k => [k, obs[k]])),
      axial_plan: { offer: s, choice, workflow, drm_hash: this.policy.loaded.source_hash },
      compositions: [{ id: focus, role: 'conditional_axial_configuration', observed: false,
        things: ['selected:' + digest(s.actor.center), 'peer:' + digest(s.relation.peer.center)],
        properties: { relation: s.relation, orientation_projection: s.projection, method_revalidation: s.method_revalidation,
          goal_hypothesis: true, unknown: ['command_rotation_until_observed', 'interaction_direction_until_observed',
            'wall_transmission', 'force_law', 'terminal_stability', 'recipient_identity'] },
        relations: ['contributes_to:' + this.policy.config.goal], open_question: choice.reason }],
      question: { reason: choice.reason, hypothesis_refs: choice.hypotheses }, route_refs: evidence,
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: this.policy.config.goal,
        purpose: choice.reason, preconditions: facts, evidence, actions: [action], preserve_refs: [], preservation_evidence: {},
        outcome_guard: { path: ['value'], contains: focus } } };
    return proposal as NativeProposal;
  }
  async propose(obs: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    return this.proposeSource(obs, rows, inputs, remaining);
  }
  async proposeInSubquestion(group: string, question: string, obs: NativeObservation, rows: NativeRows,
    inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    if (group !== 'factored_material_return' || question !== 'axial_question') throw new TypeError('Unknown axial-question source entry');
    const proposal = await this.propose(obs, rows, inputs, remaining);
    if (proposal) proposal.material_access_subquestion = question; return proposal;
  }
  bind(proposal: R, _preserve?: unknown): void {
    if (proposal.actions.length !== 1 || !equal(proposal.actions, proposal.steps.map((s: R) => s.action ?? null))) {
      throw new TypeError('axial exact action set mismatch');
    }
  }
  before(proposal: R, index: number, publicPacket: NativePublicObservation, obs: NativeObservation): NativeBeforeResult {
    if (index !== 0 || ['observation_ref', 'level_epoch', 'frame_hash'].some(k => !equal(obs[k], proposal.binding[k]))) {
      return { admitted: false, reason: 'scope_changed' };
    }
    this.bind(proposal); const s = proposal.axial_plan.offer, [offers] = this.offers(obs, publicPacket.frame_rows),
      matches = offers.filter(o => o.key === s.key && equal(o.measurement, s.measurement));
    return { admitted: matches.length === 1 && equal(proposal.actions, [{ action_ref: s.action }]),
      reason: 'selected_marker_body_peer_target_and_command_current' };
  }
  after(_proposal: R, _index: number, _before: NativeObservation, _after: NativeObservation,
    _first: NativeRows, _second: NativeRows): NativeAfterResult & R {
    return { matched: null, preservation_matched: null, seal_prefix: true,
      reason: 'conditional_rotation_and_global_effect_require_sealed_public_return' };
  }
  recordSource(before: NativeObservation, after: NativeObservation, command: R, first: NativeRows, second: NativeRows,
    proposal: R | null = null, _index = 0, frames: readonly NativeRows[] | null = null): R | null {
    return this.recordImpl(before, after, command, first, second, proposal, frames, false);
  }
  /** Native adaptation: a packet from a level transition does not label each
   * frame's epoch. Its new terminal scene cannot witness the preceding action.
   * If old and new scenes share all source attribution anchors, the packet is
   * ambiguous and no physical contrast is acquired. Official score and scope
   * transitions remain observed, independently of this conservative refusal.
   */
  recordObserved(before: NativeObservation, after: NativeObservation, command: R, first: NativeRows, second: NativeRows,
    proposal: R | null = null, _index = 0, frames: readonly NativeRows[] | null = null): R | null {
    return this.recordImpl(before, after, command, first, second, proposal, frames, true);
  }
  private recordImpl(before: NativeObservation, after: NativeObservation, command: R, first: NativeRows, second: NativeRows,
    proposal: R | null, frames: readonly NativeRows[] | null, nativeAttribution: boolean): R | null {
    this.scope(before); const b = measure(first); if (!b) return null;
    const refs = [before.observation_ref, after.observation_ref], boundary = before.level_epoch !== after.level_epoch,
      relevant = proposal !== null && Object.hasOwn(proposal, 'axial_plan');
    let a = measure(second), ordinal = 0, physical = second;
    const sameSceneAnchors = (sample: NonNullable<ReturnType<typeof measure>>): boolean => equal(sample.grid_bounds, b.grid_bounds)
      && equal(sample.target, b.target) && sample.bodies.length === b.bodies.length;
    const guardedBoundary = nativeAttribution && boundary, ambiguousEpoch = guardedBoundary && a !== null && sameSceneAnchors(a),
      packet = guardedBoundary ? frames ?? [] : frames?.length ? frames : [second];
    const observed: { ordinal: number; measured: NonNullable<ReturnType<typeof measure>>; physical: NativeRows }[] = [];
    for (const [frameOrdinal, frame] of packet.entries()) {
      // Keep original packet indices. Filtering/reindexing would misattribute
      // the returned-frame ordinal retained in a learned rotation receipt.
      if (guardedBoundary && (ambiguousEpoch || equal(frame, second))) continue;
      let sample: ReturnType<typeof measure>;
      try { sample = measure(frame); } catch (error) { if (error instanceof TypeError || error instanceof RangeError) continue; throw error; }
      if (sample && sameSceneAnchors(sample)) {
        observed.push({ ordinal: frameOrdinal, measured: sample, physical: frame });
      }
    }
    if (observed.length) {
      const last = observed.at(-1)!; ordinal = last.ordinal; a = last.measured; physical = last.physical;
    } else if (boundary) a = null;
    const events: unknown[] = [];
    if (a) {
      const changes = changedPixels(first, physical);
      if (b.selected === null && a.selected && !a.ambiguous_selection && changes.length === 1
        && equal(changes[0], a.selected.center)
        && equal(a.bodies.map(z => [z.center, z.axis, z.signature]), b.bodies.map(z => [z.center, z.axis, z.signature]))) {
        this.selection = { center: a.selected.center, marker: a.selected.marker, signature: this.methodSignature(a),
          epoch: before.level_epoch, evidence: refs, source_action: command };
        events.push('selection_marker_changed_under_input');
      }
      if (relevant && b.selected && a.selected && equal(this.methodSignature(a), this.methodSignature(b))) {
        const cycle = this.policy.config.cycle as number[][],
          delta = modulo(indexOfAxis(cycle, a.selected.axis) - indexOfAxis(cycle, b.selected.axis), cycle.length);
        if (delta === 1 || delta === cycle.length - 1) {
          const turn = delta === 1 ? 1 : -1;
          this.rotations.push({ action: command.action_ref, turn, signature: this.methodSignature(a), source_epoch: before.level_epoch,
            evidence: [...refs, 'returned-frame:' + digest(physical)], frame_ordinal: ordinal, boundary,
            unknown: ['quantitative_interaction', 'wall_transmission', 'complete_goal_law'] });
          events.push('quarter_rotation_observed');
        }
        if (this.selection) this.selection = { ...this.selection, center: a.selected.center, marker: a.selected.marker, current_evidence: refs };
        events.push({ joint_positions_before: b.bodies.map(z => z.center), joint_positions_after: a.bodies.map(z => z.center),
          sealed_score_delta: after.levels_completed - before.levels_completed });
      }
      if (!a.selected) this.selection = null;
    }
    if (relevant) this.attempts[proposal!.axial_plan.offer.key] = { evidence: refs, events };
    this.last = { status: events.length ? 'observed_axial_contrast' : 'no_supported_axial_contrast', events, evidence: refs,
      boundary, goal_supported_only_by_official_score: after.levels_completed > before.levels_completed };
    const result = copy(this.last);
    if (boundary) this.scope(after);
    if (guardedBoundary) result.native_packet_attribution = {
      extension: 'current_epoch_axial_packet_attribution',
      status: ambiguousEpoch ? 'ambiguous_old_and_new_scene_anchors_no_physical_contrast'
        : observed.length ? 'old_scene_frames_only' : 'no_attributable_old_scene_frame',
      accepted_frame_ordinals: observed.map(sample => sample.ordinal),
      new_scene_is_old_effect_evidence: false,
    };
    return result;
  }
  record(before: NativeObservation, after: NativeObservation, command: NativeCommand, first: NativeRows, second: NativeRows,
    proposal: R, index: number, frames: readonly NativeRows[]): NativeRecordResult {
    return { events: [this.recordObserved(before, after, command, first, second, proposal, index, frames)] };
  }
}
