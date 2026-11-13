/** ReactiveContact source owner and the two exact V6 material entry adapters.
 * Reference 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. Every proposed model
 * remains conditional; only actual returned public transitions acquire state.
 */
import { ReactiveContactPolicy } from './v6-reactive-contact-policy.ts';
import { Source81Policy } from './v6-reactive-contact-source81-policy.ts';
import * as source81 from './v6-reactive-contact-source81-execution.ts';
import * as parentReturn from './v6-reactive-contact-parent.ts';
import { digest, unique, patch, mask, movements, relative, scene, routes,
  translated_mask, support_collisions, current_body_box, current_member_scene, bound_relative_peer_row } from './v6-reactive-contact-geometry.ts';
import { supportParts } from './v6-support-measurements.ts';
import { pythonEqual as eq, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { isJsonObject } from './canonical.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeCommand, NativeFamily, NativeObservation,
  NativeProgramRegistry, NativeProposal, NativePublicObservation, NativeRecord, NativeRecordResult, NativeRows } from './v6-native-types.ts';
type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const refs = (values: string[]): string[] => [...new Set(values)];
const box = (component: R): number[] => [component.bbox.left, component.bbox.top, component.bbox.right, component.bbox.bottom];
const shifted = (value: number[], delta: number[]): number[] => value.map((v, i) => v + delta[i % 2]!);
const FIELDS = ['epoch', 'control', 'peer', 'floor', 'observations', 'question', 'trials', 'pending', 'recipe', 'last',
  'input_trials', 'source81_plan', 'prepared_source81'] as const;
const FORMAT = 'native.public_reactive_contact.v1';
const empty = (): R => ({ epoch: null, control: null, peer: null, floor: null, observations: [], question: null,
  trials: {}, pending: null, recipe: null, last: null, input_trials: {}, source81_plan: null, prepared_source81: null });

function validateState(value: R): R {
  const state = retainNativeJson(value);
  if (Object.keys(state).length !== FIELDS.length || FIELDS.some(k => !Object.hasOwn(state, k))
    || state.epoch !== null && !Number.isSafeInteger(state.epoch)
    || state.peer !== null && typeof state.peer !== 'string'
    || state.floor !== null && !Number.isSafeInteger(state.floor)
    || !Array.isArray(state.observations) || !state.observations.every(isJsonObject)
    || !isJsonObject(state.trials) || !Object.values(state.trials).every(isJsonObject)
    || !isJsonObject(state.input_trials) || !Object.values(state.input_trials).every(rows => Array.isArray(rows) && rows.every(isJsonObject))
    || ['control', 'question', 'pending', 'recipe', 'last', 'source81_plan', 'prepared_source81'].some(k => state[k] !== null && !isJsonObject(state[k]))) {
    throw new TypeError('Incompatible reactive-contact source state');
  }
  return state;
}

export class ReactiveContact implements NativeFamily<any> {
  readonly id = 'public_reactive_contact';
  readonly policy: ReactiveContactPolicy;
  readonly source81_policy: Source81Policy;
  readonly continuationPolicy: R;
  epoch: number | null = null;
  control: R | null = null;
  peer: string | null = null;
  floor: number | null = null;
  observations: R[] = [];
  question: R | null = null;
  trials: R = {};
  pending: R | null = null;
  recipe: R | null = null;
  last: R | null = null;
  input_trials: Record<string, R[]> = {};
  source81_plan: R | null = null;
  prepared_source81: R | null = null;
  private checkpoint: R | null = null;
  private revision = 0;

  private constructor(policy: ReactiveContactPolicy, sourcePolicy: Source81Policy, continuationPolicy: R) {
    this.policy = policy; this.source81_policy = sourcePolicy; this.continuationPolicy = retainNativeJson(continuationPolicy);
  }
  static async create(continuationPolicy: R): Promise<ReactiveContact> {
    const [policy, sourcePolicy] = await Promise.all([ReactiveContactPolicy.create(), Source81Policy.create()]);
    return new ReactiveContact(policy, sourcePolicy, continuationPolicy);
  }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> {
    await this.policy.attachPrograms(registry); await this.source81_policy.attachPrograms(registry);
  }
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
    if (!isJsonObject(value)) throw new TypeError('Reactive restore requires a source state mapping');
    const next = validateState({ ...this.state(), ...Object.fromEntries(FIELDS.filter(k => Object.hasOwn(value, k)).map(k => [k, value[k]])) });
    for (const k of FIELDS) (this as unknown as R)[k] = copy(next[k]);
  }
  restoreNative(value: Readonly<NativeRecord>): void {
    if (value === this.checkpoint && eq(this.state(), this.checkpoint!.source_state)) return;
    const supplied = retainNativeJson(value);
    if (!isJsonObject(supplied) || supplied.format !== FORMAT || Object.keys(supplied).length !== 2 || !isJsonObject(supplied.source_state)) {
      throw new TypeError('Invalid native reactive-contact checkpoint');
    }
    const next = validateState(supplied.source_state);
    const changed = !this.checkpoint || !eq(this.checkpoint.source_state, next);
    for (const k of FIELDS) (this as unknown as R)[k] = copy(next[k]);
    this.checkpoint = supplied; if (changed) this.revision++;
  }
  scope(obs: R): void {
    if (this.epoch === obs.level_epoch) return;
    const next = empty(); next.epoch = obs.level_epoch;
    for (const k of FIELDS) (this as unknown as R)[k] = next[k];
  }
  current(obs: R, rows: NativeRows): R | null {
    return truth(this.control) && truth(this.peer) ? scene(obs, rows, this.control!, this.peer!, this.floor) : null;
  }

  async offers(obs: R, rows: NativeRows, remaining: number): Promise<[R[], R | null]> {
    const s = this.current(obs, rows); let out: R[] = [];
    if (s === null || !truth(this.question)) return [[], s];
    const directions = this.policy.config.direction_prior as Record<string, number[]>, [_paths, _calc] = routes(s, directions, [s.peerkey]),
      body = s.body, pitch = s.pitch;
    if (truth(this.pending)) {
      const pending = this.pending!, matches = (s.current_entities ?? []).filter((entity: R) => pending.epoch === obs.level_epoch
        && pending.control_signature === this.control!.signature && eq(entity.bbox, pending.subject_box)
        && eq(entity.palette_value, pending.subject_value) && entity.area === pending.before_shape.area
        && digest(entity.mask ?? null) === digest(pending.before_shape.mask ?? null));
      if (matches.length === 1) {
        const subject = matches[0], offset = [subject.bbox[0] - body.bbox[0], subject.bbox[1] - body.bbox[1]],
          terrain = new Map<string, [string, string]>();
        for (const k of s.admitted) for (let y = s.tiles[k].box[1]; y <= s.tiles[k].box[3]; y++) {
          for (let x = s.tiles[k].box[0]; x <= s.tiles[k].box[2]; x++) terrain.set(`${x},${y}`, ['SUPPORTED', obs.observation_ref]);
        }
        for (const point of mask(subject)) terrain.set(point.join(','), ['SUPPORTED', obs.observation_ref]);
        const obstacles = [...s.stones.filter((stone: R) => !eq(stone.bbox, subject.bbox)).flatMap((stone: R) => mask(stone)), ...mask(s.peer)];
        for (const [action, d] of Object.entries(directions)) {
          const delta = d.map(v => v * pitch); if (eq(delta, offset)) continue;
          const carrier = translated_mask(mask(body), delta), part = translated_mask(mask(subject), delta),
            [blocked, unknown] = support_collisions(carrier, part, terrain, obstacles);
          if (!truth(blocked) && !truth(unknown)) out.push({ kind: 'binding_followup', subject, route: [],
            actions: [{ action_ref: action }], expected: [shifted(body.bbox, delta)], expected_subject: shifted(subject.bbox, delta),
            peer_distance: [0, 1].reduce((sum, i) => sum + Math.abs(subject.bbox[i] - s.peer.bbox[i]), 0), cost: 1,
            calculation: { calculator: 'rigid_grasp_geometry.support_collisions', nonpushing: true, attachment_still_unknown: true } });
        }
      }
    } else {
      const [candidate, _diagnostic] = await source81.offer(this, obs, rows, remaining, s);
      if (candidate) out = [candidate];
    }
    for (const offer of out) {
      offer.facts = { ...(offer.facts ?? {}), retained_contact_dependency: truth(this.pending) || truth(this.recipe),
        current_control_bound: true, counteracted_approach_observed: truth(this.question),
        current_scope_and_input: offer.actions.every((action: R) => obs.available_action_refs.includes(action.action_ref)),
        subject_current_unique: obs.entities.filter((entity: R) => eq(entity.bbox, offer.subject.bbox)
          && eq(entity.palette_value, offer.subject.palette_value)).length === 1, retreat_exists: true };
      offer.guard_tiles = Object.fromEntries(Object.entries(s.tiles as Record<string, R>).map(([k, v]) => [k, { box: v.box }]));
      offer.guard_support_value = this.floor; offer.guard_other_entities = s.stones.filter((stone: R) => !eq(stone.bbox, offer.subject.bbox));
      offer.pitch = pitch; offer.body = body; offer.peer = s.peer;
      offer.evidence = refs([...(offer.evidence ?? []), obs.observation_ref, ...this.control!.evidence, ...this.question!.evidence]);
      offer.context ??= digest([obs.level_epoch, body.bbox, offer.subject.bbox, offer.subject.palette_value, s.grid]);
      offer.parent = copy(this.question); offer.preserved_subjects = s.stones.filter((stone: R) => !eq(stone.bbox, offer.subject.bbox))
        .map((stone: R) => ({ bbox: stone.bbox, value: stone.palette_value }));
    }
    for (const offer of out) if (offer.kind === 'source81_composition') source81.decorate(offer, s, obs);
    return [out, s];
  }

  async propose(obs: NativeObservation, rows: NativeRows, _inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    this.scope(obs); const [offers, _scene] = await this.offers(obs, rows, remaining), [choice, workflow] = await this.policy.choose(offers);
    if (choice.status !== 'selected') return null;
    const offer = offers[choice.index]!, actions = offer.actions.slice(0, 16),
      steps = actions.map((action: R, i: number) => ({ action, expected_after: offer.expected[i] })), focus = 'reactive_contact:' + digest(offer.context),
      facts = { hypothesis: true, mechanism: 'reactive_peer_contact_dependency', parent_goal: 'capture_contact_hypothesis' };
    return { status: 'proposed', kind: 'public_reactive_contact', actions, steps, facts,
      binding: Object.fromEntries(['observation_ref', 'level_epoch', 'frame_hash', 'levels_completed'].map(k => [k, obs[k]])),
      reactive_plan: { offer, remaining, choice, workflow, drm_hash: this.policy.loaded.source_hash },
      compositions: [{ id: focus, role: 'information_child_of_capture_hypothesis', observed: false,
        things: [this.control!.signature, this.peer, digest(offer.subject.bbox)],
        properties: { parent: offer.parent, unknown: ['manipulability', 'complete_escape_domain', 'capture_law', 'response_order'],
          alternatives: ['guide_into_existing_dead_end', 'modify_escape_options'], calculation: offer.calculation },
        relations: ['contributes_to:G_official_completion'], open_question: choice.reason }],
      question: { reason: choice.reason, hypothesis_refs: choice.hypotheses }, route_refs: offer.evidence,
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion', purpose: choice.reason,
        preconditions: facts, evidence: offer.evidence, actions, preserve_refs: [], preservation_evidence: {}, outcome_guard: { path: ['value'], contains: focus } } };
  }

  async proposeInSubquestion(group: string, question: string, obs: NativeObservation, rows: NativeRows,
    inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    if (group !== 'factored_material_return' || !['reactive_contact_continuation', 'reactive_contact'].includes(question)) {
      throw new TypeError('Unknown reactive-contact source entry');
    }
    let proposal: R | null;
    if (question === 'reactive_contact_continuation') {
      if (![this.pending, this.recipe, this.source81_plan, this.prepared_source81].some(truth)) return null;
      proposal = await this.propose(obs, rows, inputs, remaining);
      if (proposal) {
        const offer = proposal.reactive_plan.offer, policy = this.continuationPolicy;
        if (!policy.kinds.includes(offer.kind) || !this.policy.holds(policy.conditions, offer.facts)) return null;
        proposal.retained_dependency_continuation = { reason: policy.meaning, parent: offer.parent.id, evidence: offer.evidence, scope: obs.level_epoch };
      }
    } else proposal = await this.propose(obs, rows, inputs, remaining);
    if (proposal) proposal.material_access_subquestion = question;
    return proposal as NativeProposal | null;
  }

  bind(proposal: R, _preserve?: unknown): void {
    const offer = proposal.reactive_plan.offer;
    if (!eq(proposal.actions, offer.actions.slice(0, 16))
      || !eq(proposal.steps, proposal.actions.map((action: R, i: number) => ({ action, expected_after: offer.expected[i] })))) {
      throw new TypeError('exact reactive contact binding');
    }
  }
  async before(proposal: R, index: number, publicPacket: NativePublicObservation, obs: NativeObservation): Promise<NativeBeforeResult> {
    this.bind(proposal); const offer = proposal.reactive_plan.offer, rows = publicPacket.frame_rows;
    if (obs.level_epoch !== proposal.binding.level_epoch) return { admitted: false, reason: 'scope_changed' };
    if (offer.kind === 'source81_composition') return await source81.before(this, proposal, index, rows, obs) as NativeBeforeResult;
    const expected = index === 0 ? offer.body.bbox : offer.expected[index - 1], body = current_body_box(rows, offer.body), subject = offer.subject,
      partBox = index === 0 || offer.kind !== 'parent_escape_configuration_access' ? subject.bbox : offer.expected_subjects[index - 1],
      components = supportParts(rows), matches = components.filter(c => eq(box(c), partBox) && c.value === subject.palette_value && c.area === subject.area);
    let ok = eq(body, expected) && matches.length === 1 && obs.available_action_refs.includes(proposal.actions[index].action_ref);
    if (index === 0) {
      const [offers] = await this.offers(obs, rows, proposal.reactive_plan.remaining);
      ok = ok && Object.keys(proposal.binding).every(k => eq(obs[k], proposal.binding[k])) && offers.filter(v => digest(v) === digest(offer)).length === 1;
    }
    ok = ok && (offer.preserved_subjects ?? []).every((entity: R) => patch(rows, entity.bbox).every((row: readonly number[]) => row.every(v => v === entity.value)));
    const target = proposal.steps[index].expected_after;
    if (offer.kind === 'parent_escape_configuration_access') {
      const memberScene = current_member_scene(rows, offer, partBox), guard = parentReturn.validate_current(memberScene, offer, index, obs.level_epoch);
      ok = ok && guard.admitted;
      const old = new Set<string>();
      for (const b of [body, partBox]) if (truth(b)) for (let y = b[1]; y <= b[3]; y++) for (let x = b[0]; x <= b[2]; x++) old.add(`${x},${y}`);
      ok = ok && [target, offer.expected_subjects[index]].every(b => {
        for (let y = b[1]; y <= b[3]; y++) for (let x = b[0]; x <= b[2]; x++) if (rows[y]![x] !== this.floor && !old.has(`${x},${y}`)) return false;
        return true;
      });
      return { admitted: Boolean(ok), reason: 'parent_current_members_support_and_conditional_peer_binding' };
    }
    if (target !== null) {
      if (offer.kind === 'parent_capture_contact_question') {
        const occupied = new Set([...mask(offer.body), ...mask(offer.subject)].map(p => p.join(',')));
        ok = ok && eq(current_body_box(rows, offer.peer), target);
        for (let y = offer.expected_subject[1]; y <= offer.expected_subject[3]; y++) for (let x = offer.expected_subject[0]; x <= offer.expected_subject[2]; x++) {
          ok = ok && (rows[y]![x] === this.floor || occupied.has(`${x},${y}`));
        }
      } else if (offer.kind !== 'binding_followup') {
        for (let y = target[1]; y <= target[3]; y++) for (let x = target[0]; x <= target[2]; x++) ok = ok && rows[y]![x] === this.floor;
      }
    } else {
      const adjacent = truth(body) ? components.filter(c => c.area === subject.area && c.value !== offer.body.palette_value
        && Math.abs(c.bbox.left - body![0]!) + Math.abs(c.bbox.top - body![1]!) === offer.pitch) : [];
      ok = ok && body !== null && Math.abs(partBox[0] - body[0]!) + Math.abs(partBox[1] - body[1]!) === offer.pitch && adjacent.length === 1;
    }
    return { admitted: Boolean(ok), reason: 'current_measured_masks_support_scope_and_exact_input' };
  }

  async after(proposal: R, index: number, _before: NativeObservation, _after: NativeObservation,
    first: NativeRows, second: NativeRows): Promise<NativeAfterResult> {
    const offer = proposal.reactive_plan.offer;
    if (offer.kind === 'source81_composition') return await source81.after(this, proposal, index, first, second) as NativeAfterResult;
    const target = proposal.steps[index].expected_after, body = current_body_box(second, offer.body), matched = target === null ? null : eq(body, target),
      preserved = (offer.preserved_subjects ?? []).every((entity: R) => patch(second, entity.bbox).every((row: readonly number[]) => row.every(v => v === entity.value)));
    if (offer.kind === 'parent_capture_contact_question') return { matched: null, preservation_matched: preserved, seal_prefix: true,
      reason: 'capture_contact_outcome_unknown_official_boundary_only' } as NativeAfterResult;
    if (offer.kind === 'parent_escape_configuration_access') {
      const members = current_member_scene(second, offer, offer.expected_subjects[index]), part = members?.stones?.length ? members.stones[0].bbox : null,
        rigid = Boolean(matched && eq(part, offer.expected_subjects[index])), peerSame = Boolean(members && eq(members.peer.bbox, offer.expected_peer));
      return { matched: rigid && peerSame, body_position_matched: matched, rigid_translation_matched: rigid,
        preservation_matched: preserved, seal_prefix: !rigid || !peerSame || !preserved || index + 1 === proposal.actions.length,
        reason: 'local_transport_and_peer_response_separate_no_capture_claim' } as NativeAfterResult;
    }
    return { matched, preservation_matched: preserved, seal_prefix: !preserved || matched !== true || offer.kind === 'binding_followup',
      reason: 'current_body_arrival_separate_from_unknown_interaction_and_peer_response' } as NativeAfterResult;
  }

  async recordSource(before: NativeObservation, after: NativeObservation, command: R, first: NativeRows, second: NativeRows,
    proposal: R | null = null, index = 0, _frames?: readonly NativeRows[]): Promise<R | null> {
    this.scope(before); const evidence = [before.observation_ref, after.observation_ref], action = command.action_ref,
      relevant = truth(proposal) && Object.hasOwn(proposal!, 'reactive_plan');
    if (before.level_epoch !== after.level_epoch) { this.scope(after); return { status: 'official_boundary', evidence }; }
    const context = digest([before.level_epoch, first]), trial = { action: copy(command), directional: Object.hasOwn(this.policy.config.direction_prior, action),
      changed: !eq(first, second), evidence };
    (this.input_trials[context] ??= []).push(trial);
    const motions = movements(before, after), prior = this.policy.config.direction_prior[action],
      compatible = motions.filter((motion: R) => truth(prior) && motion.delta[0] * prior[1] === motion.delta[1] * prior[0]
        && motion.delta.reduce((sum: number, v: number, i: number) => sum + v * prior[i], 0) > 0);
    if (!truth(this.control) && compatible.length === 1) {
      const motion = compatible[0]!, [binding, workflow] = await this.policy.bindControl({ unique_input_compatible_motion: true,
        current_exact_shape: true, positive_axial_displacement: true });
      if (binding.status === 'conditional_control_bound') this.control = { signature: motion.signature, commands: {}, evidence: [], binding, workflow };
    }
    let event: R | null = null;
    if (truth(this.control)) {
      const control = this.control!, matching = motions.filter((motion: R) => motion.signature === control.signature);
      if (matching.length === 1 && truth(prior)) {
        const motion = matching[0]!;
        if (motion.delta[0] * prior[1] !== motion.delta[1] * prior[0]
          || motion.delta.reduce((sum: number, v: number, i: number) => sum + v * prior[i], 0) <= 0) {
          this.control = null; this.pending = null; this.recipe = null; this.question = null; return { status: 'control_contradiction', evidence };
        }
        control.last_motion = { after_ref: after.observation_ref, translation: [action, motion.delta[1], motion.delta[0]], evidence };
        control.commands[action] = motion.delta; control.evidence = refs([...control.evidence, ...evidence]);
        const values = new Set(patch(second, motion.before.bbox).flat()), value = [...values][0];
        if (values.size === 1 && (this.floor === null || this.floor === value)) {
          this.floor = value!; control.support_evidence = refs([...(control.support_evidence ?? []), ...evidence]);
        } else if (values.size === 1) control.latest_changed_departure_underlay = { value, evidence, status: 'not_a_replacement_support_law' };
        const other = motions.filter((item: R) => item.signature !== control.signature && item.after.area === motion.after.area);
        if (this.peer === null && other.length === 1) this.peer = other[0]!.signature;
        const quantum = Math.max(...motion.delta.map((v: number) => Math.abs(v))), measured = relative(before, after, first, second, control.signature, quantum);
        if (truth(measured)) { this.observations.push({ measure: measured, evidence }); this.observations = this.observations.slice(-16); }
        if (truth(measured) && measured!.relative_escape_counteracted_approach_count > 0) {
          this.question ??= { id: 'capture_question:' + digest([this.epoch, control.signature, this.peer]), goal: 'capture_contact_hypothesis',
            status: 'active_missing_manipulability', alternatives: ['guide_into_existing_dead_end', 'modify_escape_options'], evidence: [] };
          if (!Object.hasOwn(this.question, 'origin_measurement')) {
            const origin = bound_relative_peer_row(measured!, after, second, this.peer as string);
            if (origin !== null) {
              this.question.origin_measurement = copy(origin); this.question.origin_measurement_evidence = [...evidence];
              this.question.origin_peer_signature = this.peer; this.question.origin_body_signature = control.signature;
            }
          }
          this.question.evidence = refs([...this.question.evidence, ...evidence]);
          event = { status: 'counteracted_approach_question_retained', evidence, measurement: measured };
        }
      }
    }
    if (relevant) {
      const p = proposal!, offer = p.reactive_plan.offer;
      if (offer.kind === 'source81_composition' && offer.phase !== 'grasp_probe') {
        event = await source81.record(this, offer, index, before, after, command, first, second);
      } else if (offer.kind === 'parent_capture_contact_question') {
        this.current(after, second); const body = unique(after)[this.control!.signature], parts = after.entities.filter(entity => eq(entity.bbox, offer.expected_subject)
          && eq(entity.palette_value, offer.subject.palette_value));
        if (body && eq(body.bbox, offer.expected[0]) && parts.length === 1) {
          this.recipe!.subject_box = parts[0]!.bbox; this.recipe!.offset = [0, 1].map(i => parts[0]!.bbox[i]! - body.bbox[i]);
          this.recipe!.evidence = refs([...this.recipe!.evidence, ...evidence]);
        }
        this.question!.last_capture_contact = { evidence, official_completion: false, effect_unknown_without_boundary: true };
        event = { status: 'capture_contact_return_parent_still_open', evidence };
      } else if (offer.kind === 'parent_escape_configuration_access') {
        const current = this.current(after, second), returned = parentReturn.reconcile(this.question!, this.recipe!, offer, index, current,
          after.observation_ref, after.level_epoch);
        this.question = returned.question; this.recipe = returned.recipe;
        if (returned.receipt.rigid_translation_matched && current) this.recipe!.offset = [0, 1].map(i => this.recipe!.subject_box[i] - current.body.bbox[i]);
        event = { status: 'capture_parent_configuration_return', receipt: returned.receipt, evidence };
      } else if (p.steps[index].expected_after === null) {
        if (offer.kind === 'source81_composition') this.source81_plan = null;
        const measured = relative(before, before, first, first, this.control!.signature, offer.pitch) ?? {}, contactFacts = { ...measured,
          relative_escape_candidate_contact_input_available: before.available_action_refs.includes(action), interaction_measurement_kind: 'discrete',
          is_directional_interface_action: Object.hasOwn(this.policy.config.direction_prior, action),
          candidate_previously_executed_in_current_configuration: Object.hasOwn(this.trials, offer.attempt),
          incoming_declared_route_engagement_present: truth(offer.route), incoming_declared_route_lease_consumed: index === p.steps.length - 1,
          candidate_ref: offer.attempt, relative_motion_controlled_approach_counteracted: truth(this.question),
          relative_escape_transition_rows: this.observations.flatMap(item => item.measure.relative_escape_transition_rows ?? []) };
        let [projection, projectionWorkflow] = await this.policy.contact(contactFacts);
        if (projection.status !== 'contact_question_projected') {
          if (offer.kind === 'source81_composition' && offer.phase === 'grasp_probe' && offer.publication.adaptation?.status === 'admitted_experiment') {
            projection = { status: 'contact_question_projected', source: 'returned_declared_ready_operator_question', authority: copy(offer.publication),
              historical_projection_refusal: projection, effect_unknown_until_measurement: true };
          } else return { status: 'contact_return_without_current_projection', projection, evidence, parent_preserved: copy(this.question) };
        }
        this.question!.contact_projection = { result: projection, workflow: projectionWorkflow, evidence };
        const subjectBox = offer.subject.bbox, values = new Set(patch(second, subjectBox).flat()), body = unique(after)[this.control!.signature],
          changed = !eq(patch(first, subjectBox), patch(second, subjectBox));
        this.trials[offer.attempt] = { evidence, local_changed: changed, attachment_confirmed: false };
        if (values.size === 1 && changed && body && eq(body.bbox, index ? offer.expected[index - 1] : offer.body.bbox)) {
          this.pending = { epoch: this.epoch, control_signature: this.control!.signature, subject_box: subjectBox, subject_value: [...values][0],
            evidence, before_shape: offer.subject, operator: action };
          event = { status: 'local_contact_change_binding_unknown', evidence };
        }
      } else if (offer.kind === 'binding_followup') {
        const body = unique(after)[this.control!.signature], oldbody = unique(before)[this.control!.signature],
          oldparts = before.entities.filter(entity => eq(entity.bbox, offer.subject.bbox) && eq(entity.palette_value, offer.subject.palette_value)
            && digest(entity.mask ?? null) === digest(offer.subject.mask ?? null)),
          matches = after.entities.filter(entity => eq(entity.bbox, offer.expected_subject) && eq(entity.palette_value, offer.subject.palette_value)
            && entity.area === offer.subject.area && digest(entity.mask ?? null) === digest(offer.subject.mask ?? null)),
          bodyDelta = body && oldbody ? [0, 1].map(i => body.bbox[i] - oldbody.bbox[i]) : null,
          partDelta = matches.length === 1 && oldparts.length === 1 ? [0, 1].map(i => matches[0]!.bbox[i]! - oldparts[0]!.bbox[i]!) : null;
        const facts = { same_current_scope: Boolean(this.pending && this.pending.epoch === before.level_epoch && before.level_epoch === after.level_epoch),
          body_and_part_distinct: Boolean(oldbody && oldparts.length === 1 && !eq(oldbody.bbox, oldparts[0]!.bbox) && oldparts[0]!.signature !== this.peer),
          current_unique_shapes: Boolean(body && oldbody && matches.length === 1 && oldparts.length === 1 && digest(body.mask ?? null) === digest(oldbody.mask ?? null)),
          same_nonzero_translation: Boolean(bodyDelta && bodyDelta.some(v => truth(v)) && eq(bodyDelta, partDelta) && eq(body.bbox, offer.expected[0])),
          nonpushing_translation: Boolean(oldbody && oldparts.length === 1 && !eq(bodyDelta, [0, 1].map(i => oldparts[0]!.bbox[i]! - oldbody.bbox[i]))),
          other_declared_subjects_preserved: (offer.preserved_subjects ?? []).every((entity: R) => patch(second, entity.bbox).every((row: readonly number[]) => row.every(v => v === entity.value))),
          actual_operator_receipt_present: Boolean(this.pending && truth(this.pending.operator) && truth(this.pending.evidence)) };
        const receipt = { epoch: this.epoch, body_signature: this.control!.signature,
          subject_mask_digest: matches.length === 1 ? digest(matches[0]!.mask) : null, subject_area: matches.length === 1 ? matches[0]!.area : null,
          operator_action_ref: this.pending?.operator ?? null, operator_observation_refs: copy(this.pending?.evidence ?? []),
          transition_refs: evidence, body_delta_xy: bodyDelta, part_delta_xy: partDelta };
        const [claimResult, claimWorkflow] = await this.policy.reconcileBinding(facts, receipt);
        if (claimResult.status === 'observed_method_claim') {
          const claim = claimResult.claim;
          this.recipe = { status: claim.status, subject_box: matches[0]!.bbox, subject_value: matches[0]!.palette_value,
            subject_mask_digest: receipt.subject_mask_digest, subject_area: receipt.subject_area,
            offset: [matches[0]!.bbox[0] - body.bbox[0], matches[0]!.bbox[1] - body.bbox[1]], evidence: [...this.pending!.evidence, ...evidence],
            scope: this.epoch, operator_action_ref: receipt.operator_action_ref, operator_observation_refs: receipt.operator_observation_refs,
            method_claim_refs: [claim.ref], method_claim: claim, method_workflow: claimWorkflow };
          this.pending = null; this.question!.status = 'active_with_observed_rigid_transport_method'; this.question!.available_method = copy(this.recipe);
          event = { status: 'transport_method_acquired_parent_consumer_pending', evidence, recipe: copy(this.recipe), parent: copy(this.question),
            remaining_unknown: 'current_escape_configuration_consumer_required' };
        } else {
          this.pending = null; event = { status: 'binding_followup_unresolved_or_refuted', evidence, claim_result: claimResult, claim_workflow: claimWorkflow };
        }
      }
    }
    this.last = { before: before.observation_ref, after: after.observation_ref }; return event;
  }
  async record(before: NativeObservation, after: NativeObservation, command: NativeCommand, first: NativeRows, second: NativeRows,
    proposal: R, index: number, frames: readonly NativeRows[]): Promise<NativeRecordResult> {
    return { events: [await this.recordSource(before, after, command, first, second, proposal, index, frames)] };
  }
}
