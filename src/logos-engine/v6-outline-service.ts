/** Strict native transfer of V6 outline_service/family.py, pinned at
 * 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. All seven source fields are owned by
 * one immutable state; historical references are not current transitions. */
import { OutlinePolicy } from './v6-outline-policy.ts';
import { OutlineMeasurementDomainError, outlineBoxes, outlineSameBox, measureOutlineControlZoneRoutes, measureOutlinePerimeterAccompaniment } from './v6-outline-geometry.ts';
import { currentOutlineRequiredServiceWitness, outlineRequiredServiceTrialCurrent, evaluateOutlineContinuationSubset, OUTLINE_CONTINUATION_SUBSET } from './v6-outline-continuation.ts';
import { currentOutlinePublicTransition, makeOutlinePublicTransition, retainOutlinePublicTransition,
  evaluateOutlinePublicOperatorSubset, outlineUniqueEffectfulLocalOperator, outlinePhysicalCommand,
  outlinePublicProposalCore, outlinePublicProposalMatchesCurrent, OUTLINE_ACCOMPANIMENT_GOAL, OUTLINE_PUBLIC_OPERATOR_SUBSET,
  OUTLINE_SOURCE_POINT_ACTION_REF } from './v6-outline-public-context.ts';
import { outlineEqual as same, outlineTruthy as truth, outlineUnique as unique } from './v6-outline-identity.ts';
import { detectV5Components } from './v6-native-observer.ts';
import { symbolicDigest } from './v6-hash.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { isJsonObject } from './canonical.ts';
import { measureOutlineRejoinAndCapture } from './v6-outline-rejoin.ts';
import { evaluateOutlineRecoverySubset, OUTLINE_RECOVERY_SUBSETS } from './v6-outline-recovery-policy.ts';
import type { OutlineRecoveryMode } from './v6-outline-recovery-policy.ts';
import { measureOutlineAnnouncedAccess } from './v6-outline-access.ts';
import { measureOutlineAccessArrival } from './v6-outline-arrival.ts';
import type { NativeFamily, NativeRows, NativeRecord, NativeObservation, NativePublicObservation,
  NativeBeforeResult, NativeAfterResult, NativeRecordResult, NativeCommand, NativeProgramRegistry } from './v6-native-types.ts';
type R = Record<string, any>;
const FIELDS = ['epoch', 'control', 'tracks', 'methods', 'attempts', 'last', 'last_event'] as const;
const FORMAT = 'native.public_outline_service.v1';
const PUBLIC_FORMAT = 'native.public_outline_service.v2';
interface OutlineState extends R { epoch: number | null; control: R | null; tracks: Record<string, R>; methods: R[]; attempts: Record<string, R>; last: R | null; last_event: R | null }
export interface OutlineServiceOptions { readonly retainDomainRefusal?: boolean; readonly currentPublicAnnouncementContext?: boolean; readonly currentRecoveryQuestions?: boolean }
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);
const vector = (value: any, size: number): boolean => Array.isArray(value) && value.length === size && value.every(integer);
const refs = (value: any): boolean => Array.isArray(value) && value.every(ref => typeof ref === 'string');
const records = (value: any): boolean => isJsonObject(value) && Object.values(value).every(isJsonObject);

/** Source-compatible partial restore is validated in a temporary merged tree.
 * Unknown nested fields are preserved; malformed native envelopes fail closed. */
function ownedState(value: R): OutlineState {
  const next = retainNativeJson(value);
  if (!isJsonObject(next) || Object.keys(next).length !== FIELDS.length || FIELDS.some(k => !Object.hasOwn(next, k))
    || next.epoch !== null && (!integer(next.epoch) || next.epoch < 0)
    || next.control !== null && !isJsonObject(next.control) || !records(next.tracks) || !records(next.attempts)
    || !Array.isArray(next.methods) || next.methods.some(v => !isJsonObject(v))
    || next.last !== null && !isJsonObject(next.last) || next.last_event !== null && !isJsonObject(next.last_event)) throw new TypeError('Invalid outline source state');
  const validBox = (v: R): boolean => vector(v.bbox, 4) && v.bbox[0] <= v.bbox[2] && v.bbox[1] <= v.bbox[3]
    && integer(v.value) && integer(v.width) && v.width > 0 && integer(v.height) && v.height > 0
    && typeof v.signature === 'string' && typeof v.component_ref === 'string'
    && Array.isArray(v.interior) && v.interior.every((row: unknown) => Array.isArray(row) && row.every(integer));
  const validControlData = (v: R): boolean => records(v.controls) && Object.values(v.controls).every((c: any) => vector(c.delta, 2) && refs(c.evidence))
    && refs(v.evidence) && typeof v.interior_contrast === 'boolean' && Array.isArray(v.transitions)
    && v.transitions.every((t: R) => isJsonObject(t) && vector(t.from, 4) && vector(t.to, 4) && vector(t.delta, 2)
      && integer(t.level_epoch) && integer(t.distinct_translated_count) && typeof t.before === 'string' && typeof t.after === 'string' && typeof t.action === 'string');
  if (next.control !== null && (!validBox(next.control as R) || !validControlData(next.control as R) || !integer((next.control as R).level_epoch)
    || typeof (next.control as R).status !== 'string')) throw new TypeError('Invalid outline controlled hypothesis');
  if (Object.values(next.tracks as R).some((track: R) => !validControlData(track) || track.current !== undefined && !validBox(track.current))) throw new TypeError('Invalid outline observation track');
  return next as OutlineState;
}

export class OutlineService implements NativeFamily<any> {
  readonly id = 'public_outline_service';
  readonly policy: OutlinePolicy;
  readonly config: R;
  private currentState: OutlineState = ownedState({ epoch: null, control: null, tracks: {}, methods: [], attempts: {}, last: null, last_event: null });
  private version = 0;
  private checkpoint: NativeRecord | null = null;
  private proposalRefusal: NativeRecord | null = null;
  private publicTransition: R | null = null;
  private readonly retainDomainRefusal: boolean;
  private readonly currentPublicAnnouncementContext: boolean;
  private readonly currentRecoveryQuestions: boolean;
  private constructor(policy: OutlinePolicy, options: OutlineServiceOptions) {
    this.policy = policy; this.config = policy.config; this.retainDomainRefusal = options.retainDomainRefusal === true;
    this.currentPublicAnnouncementContext = options.currentPublicAnnouncementContext === true;
    this.currentRecoveryQuestions = options.currentRecoveryQuestions === true;
  }
  static async create(options: OutlineServiceOptions = {}): Promise<OutlineService> { return new OutlineService(await OutlinePolicy.create(), options); }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> { await this.policy.attachPrograms(registry); }
  get nativeRevision(): number { return this.version; }
  get epoch(): number | null { return this.currentState.epoch; }
  get control(): R | null { return this.currentState.control; }
  get tracks(): Readonly<Record<string, R>> { return this.currentState.tracks; }
  get methods(): readonly R[] { return this.currentState.methods; }
  get attempts(): Readonly<Record<string, R>> { return this.currentState.attempts; }
  get last(): R | null { return this.currentState.last; }
  get last_event(): R | null { return this.currentState.last_event; }
  private commit(state: R): void {
    const next = ownedState(state);
    if (next === this.currentState) return;
    this.currentState = next; this.version++; this.checkpoint = null; this.proposalRefusal = null; this.publicTransition = null;
  }
  private setPublicTransition(value: R | null): void {
    if (value === this.publicTransition) return;
    this.publicTransition = value; this.version++; this.checkpoint = null;
  }
  state(): OutlineState { return structuredClone(this.currentState); }
  nativeState(): NativeRecord {
    this.checkpoint ??= retainNativeJson(this.currentPublicAnnouncementContext
      ? { format: PUBLIC_FORMAT, source_state: this.currentState, public_transition: this.publicTransition }
      : { format: FORMAT, source_state: this.currentState });
    return this.checkpoint;
  }
  restore(value: NativeRecord): void {
    const supplied = retainNativeJson(value);
    if (!isJsonObject(supplied)) throw new TypeError('Outline restore requires a source state mapping');
    const merged: R = { ...this.currentState };
    for (const field of FIELDS) if (Object.hasOwn(supplied, field)) merged[field] = supplied[field];
    this.commit(merged); this.setPublicTransition(null);
  }
  restoreNative(value: Readonly<NativeRecord>): void {
    if (value === this.checkpoint) return;
    const supplied = retainNativeJson(value);
    if (!isJsonObject(supplied) || !isJsonObject(supplied.source_state)
      || !(supplied.format === FORMAT && Object.keys(supplied).length === 2
        || this.currentPublicAnnouncementContext && supplied.format === PUBLIC_FORMAT && Object.keys(supplied).length === 3
          && Object.hasOwn(supplied, 'public_transition'))) throw new TypeError('Invalid native outline checkpoint');
    const next = ownedState(supplied.source_state);
    // Both trees are validated before either is committed; a source-only
    // restore cannot manufacture provenance for a preceding public frame.
    const context = supplied.format === PUBLIC_FORMAT ? retainOutlinePublicTransition(supplied.public_transition, next) : null;
    this.commit(next); this.setPublicTransition(context);
    this.checkpoint = this.currentPublicAnnouncementContext && supplied.format === FORMAT ? null : supplied;
  }

  async scope(obs: Pick<NativeObservation, 'level_epoch'>, rows: NativeRows): Promise<void> {
    if (this.epoch === obs.level_epoch) return;
    const prior = this.control; let control: R | null = null;
    if (truth(prior)) {
      const matches = (await outlineBoxes(rows)).filter(b => b.signature === prior!.signature);
      if (matches.length === 1) control = { ...matches[0], controls: {}, transitions: [], interior_contrast: false, evidence: [],
        recalled_method: { source_epoch: prior!.level_epoch, source_signature: prior!.signature, evidence: prior!.evidence },
        level_epoch: obs.level_epoch, status: 'recalled_outline_hypothesis_current_unique' };
    }
    // Methods and last_event intentionally retain the original source history.
    this.commit({ ...this.currentState, epoch: obs.level_epoch, tracks: {}, attempts: {}, control, last: null });
  }

  async current(_obs: R, rows: NativeRows): Promise<R | null> {
    if (!truth(this.control)) return null;
    const matches = (await outlineBoxes(rows)).filter(b => b.signature === this.control!.signature);
    return matches.length === 1 ? matches[0]! : null;
  }

  async measure(obs: R, rows: NativeRows): Promise<R | null> { return this.measureCurrent(obs, rows); }
  private async measureCurrent(obs: R, rows: NativeRows, previousRows?: NativeRows): Promise<R | null> {
    const current = await this.current(obs, rows); if (!current) return null;
    const controls = this.control!.controls ?? {}, prior = this.config.interface_prior;
    const transitions: R[] = (this.control!.transitions ?? []).filter((v: R) => v.level_epoch === obs.level_epoch);
    const [binding, bindingWorkflow] = await this.policy.bindControl({ current_outline_revalidated: true, current_transition_evidence: transitions.length > 0,
      interior_contrast_observed: truth(this.control!.interior_contrast), recalled_method_current_unique: truth(this.control!.recalled_method) });
    if (binding.status !== 'unique') return null; const role = binding.conclusions[0];
    const currentTransitions = transitions.filter(v => v.after === obs.observation_ref), currentBoxes = currentTransitions.map(v => v.to);
    const fields: R = { available_action_refs: obs.available_action_refs,
      canonical_provisional_control_term_facts: [{ term_ref: `${role.term_ref}:${current.signature}`, entity_ref: current.component_ref }],
      canonical_provisional_control_geometry_bboxes: [current.bbox], input_aligned_entity_bboxes: [current.bbox],
      current_action_conditioned_control_outline_bboxes: [current.bbox], translated_entity_bboxes: currentBoxes, observed_translated_entity_bboxes: currentBoxes,
      observed_distinct_translated_entity_count: currentTransitions.length ? currentTransitions.at(-1)!.distinct_translated_count : 0,
      observed_controlled_translation_count: transitions.length,
      known_action_translation_deltas: Object.entries(controls).map(([a, v]) => [a, (v as R).delta[1], (v as R).delta[0]]),
      interface_action_translation_deltas: Object.entries(prior.directions).map(([a, d]) => [a, (d as number[])[1], (d as number[])[0]]),
      last_action_ref: this.last?.action_ref ?? null };
    const [routes, zone] = await measureOutlineControlZoneRoutes(rows, fields, this.policy.route_config);
    const [accompaniment, relation] = await measureOutlinePerimeterAccompaniment(rows,
      previousRows === undefined ? fields : { ...fields, previous_action_observed_frame: previousRows });
    const contextKey = symbolicDigest([obs.level_epoch, current.bbox, current.interior, zone.compatible_control_zone_cell_middle_positions ?? null]);
    const facts = { current_scope_and_observation: true, exact_locus: truth(zone.current_body_exactly_occupies_compatible_control_zone_cell),
      unique_locus_route: Object.keys(routes).length === 1, unique_mobile_correspondence: Object.keys(accompaniment).length === 1,
      local_operator_observed: this.methods.some(m => m.status === 'observed_local_change'), immediate_other_contact: (relation.other_compact_body_marker_immediate_contact_count ?? 0) > 0,
      lead_on_announced_cell: truth(relation.controlled_lead_bbox_matches_cardinal_marker_cell), untried_current_context: !Object.hasOwn(this.attempts, contextKey) };
    return { control_binding: binding, control_workflow: bindingWorkflow, current_transitions: transitions, current, routes, zone, accompaniment, relation, facts, context_key: contextKey };
  }

  async proposeSource(obs: NativeObservation, rows: NativeRows, _inputs: readonly NativeCommand[], remaining: number): Promise<R | null> {
    this.proposalRefusal = null;
    await this.scope(obs, rows); if (!truth(this.control) || remaining < 1) return null;
    let measured: R | null;
    try { measured = await this.measure(obs, rows); }
    catch (error) {
      if (!this.retainDomainRefusal || !(error instanceof OutlineMeasurementDomainError)) throw error;
      this.proposalRefusal = retainNativeJson({ schema: 'logos-engine.native.outline-domain-refusal.v1',
        rule: 'native.retain_outline_measurement_domain_refusal', provider: this.id,
        observation_ref: obs.observation_ref, level_epoch: obs.level_epoch, frame_hash: obs.frame_hash,
        owner_state_ref: `outline_owner:${symbolicDigest(this.currentState)}`,
        field: error.field, value: error.value, limit: error.limit, source_error: error.message,
        evidence_refs: unique([obs.observation_ref, ...(this.control?.evidence ?? [])]),
        status: 'unknown', domain_status: 'source_contract_exceeded', release_authority: false,
        acquisition_truncated: false, impossibility_established: false,
        qualification: 'The retained observations exceed the original InteractionProbeInput count domain. All source transitions remain intact; this optional native refusal neither refutes the service nor proves a permitted action.' });
      return null;
    }
    if (!measured) return null;
    const [decision, receipt] = await this.policy.evaluate(measured.facts); if (decision.status !== 'unique') return null;
    return this.packageMeasuredProposal(obs, rows, remaining, measured, decision.conclusions[0], receipt);
  }

  private async packageMeasuredProposal(obs: NativeObservation, rows: NativeRows, remaining: number,
    measured: R, meaning: R, receipt: R | null, operatorOverride?: boolean,
    construction?: { actionRef: string; subset: R; unknownConditions: string[] }): Promise<R | null> {
    const kind = meaning.kind, prior = this.config.interface_prior, current = measured.current;
    const operator = operatorOverride ?? ['local_operator_hypothesis', 'local_obstruction_hypothesis'].includes(kind);
    let commands: string[];
    if (construction) commands = [construction.actionRef];
    else if (operator) commands = [prior.interaction];
    else if (kind === 'locus_access_hypothesis') commands = [...(Object.values(measured.routes)[0] as R).compatible_control_zone_cell_route_action_refs];
    else commands = [Object.keys(measured.accompaniment)[0]!];
    if (commands.length > Math.min(remaining, 16) || commands.some(a => !obs.available_action_refs.includes(a))) return null;
    const actions = commands.map(action_ref => ({ action_ref })), steps: R[] = []; let position = [...current.bbox];
    commands.forEach((action, i) => {
      const before = [...position], delta = prior.directions[action];
      if (truth(delta)) {
        const actual = this.control!.controls?.[action]?.delta ?? [delta[0] * current.width, delta[1] * current.height];
        position = [position[0]! + actual[0], position[1]! + actual[1], position[2]! + actual[0], position[3]! + actual[1]];
      }
      steps.push({ action: actions[i], body_before: before, expected_after: operator ? null : { body_bbox: [...position], qualification: 'conditional_control_displacement' }, seal_after: i === commands.length - 1 });
    });
    const locusPatch: number[][] = [];
    if (kind === 'locus_access_hypothesis') {
      const locusRef = (Object.values(measured.routes)[0] as R).compatible_control_zone_cell_component_ref;
      const found = (await detectV5Components(rows, 4)).components.filter(c => c.component_id === locusRef); if (found.length !== 1) return null;
      const z = found[0]!.bbox; for (let y = z.top; y <= z.bottom; y++) for (let x = z.left; x <= z.right; x++) locusPatch.push([x, y, rows[y]![x]!]);
    }
    const evidence = unique([...this.control!.evidence, obs.observation_ref]);
    const focus = `composition:outline_service:${symbolicDigest([obs.observation_ref, meaning, measured.zone, measured.relation])}`;
    const facts = { current_outline_service_bound: true }, binding = Object.fromEntries(['observation_ref', 'level_epoch', 'levels_completed', 'frame_hash'].map(k => [k, obs[k]]));
    return { status: 'proposed', kind: 'public_outline_service', actions, steps, facts, binding,
      outline_plan: { measurement: measured, meaning, ...(receipt ? { workflow: receipt } : {
        native_construction: { status: 'pending_actual_caller_service_witness', projection_ref: (construction?.subset ?? OUTLINE_PUBLIC_OPERATOR_SUBSET).sourcePointers[0]!.id,
          unknown_conditions: construction?.unknownConditions ?? ['attempted_without_effect_in_current_context', 'candidate_is_unique_effectful_nondirectional_local_action'], release_authority: false } }),
        operator, locus_patch: locusPatch, control: structuredClone(this.control), drm_sha256: receipt ? this.policy.loaded.source_hash : (construction?.subset ?? OUTLINE_PUBLIC_OPERATOR_SUBSET).document.sha256 },
      route_refs: evidence, compositions: [{ id: focus, role: meaning.role, observed: false, things: [current.signature],
        properties: { conditional: true, current_measurement: measured, recalled_control_method: this.control!.recalled_method ?? null,
          unknown: ['local_effect', 'autonomous_policy', 'terminal_rule', 'contact_consequence'],
          falsifiers: ['outline_did_not_follow', 'locus_changed', 'ambiguous_control', 'current_preservation_violated'] },
        relations: [`contributes_to:${this.config.goal}`], open_question: meaning.question }],
      question: { reason: meaning.question, hypothesis_refs: [meaning.rule_ref, meaning.mechanism_ref] },
      bundle_template: { operation_key: meaning.operation, composition_ref: focus, objective_ref: this.config.goal, purpose: meaning.question,
        preconditions: facts, evidence, actions, preserve_refs: [], preservation_evidence: {}, outcome_guard: { path: ['value'], contains: focus } } };
  }

  async propose(obs: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number): Promise<R | null> {
    const source = await this.proposeSource(obs, rows, inputs, remaining);
    if (!this.currentPublicAnnouncementContext || !this.control || remaining < 1 || this.currentProposalRefusal(obs)) return source;
    const context = this.currentServiceContext(obs, rows);
    if (!context) return source;
    const measured = await this.measureCurrent(obs, rows, context.before_rows ?? undefined);
    const fallback = async (): Promise<R | null> => source ?? (measured && this.currentRecoveryQuestions
      ? await this.proposeCurrentRecovery(obs, rows, measured, context, source, true) : null);
    if (measured && this.currentRecoveryQuestions) {
      const recovery = await this.proposeCurrentRecovery(obs, rows, measured, context, source);
      if (recovery) return recovery;
    }
    if (!measured || !measured.facts.unique_mobile_correspondence || !measured.facts.local_operator_observed
      || measured.relation.compact_body_hollow_perimeter_marker_route_bound_reached !== false) return fallback();
    const local = this.methods.filter(value => value.scope === obs.level_epoch && value.status === 'observed_local_change'
      && value.local_count > 0 && value.action?.action_ref === this.config.interface_prior.interaction);
    if (!local.length) return fallback();
    let proposed: R | null = null, mode: string;
    if (context.selected_outline?.active_goal_ref === OUTLINE_ACCOMPANIMENT_GOAL
      && measured.relation.same_value_compact_body_hollow_perimeter_marker_triplet_count === 1
      && measured.relation.controlled_lead_covers_other_inset_on_body_target_segment === true
      && measured.relation.other_compact_body_marker_immediate_contact_count === 0) {
      mode = 'obstructing_inset_operator';
      proposed = await this.packageMeasuredProposal(obs, rows, 1, measured, {
        kind: 'native_current_obstructing_inset_operator_hypothesis', operation: 'OP18',
        role: 'controlled_outline_testing_current_overlaid_obstruction', rule_ref: OUTLINE_PUBLIC_OPERATOR_SUBSET.selectionTier.id,
        mechanism_ref: OUTLINE_PUBLIC_OPERATOR_SUBSET.sourcePointers[0]!.id,
        question: 'Ask whether the observed local operator changes the currently overlaid obstruction serving the acquired announced relation; its effect remains unknown.',
      }, null, true);
    } else {
      mode = 'announced_continuation';
      const [decision, receipt] = await this.policy.evaluate(measured.facts);
      if (decision.status !== 'unique' || decision.conclusions[0]?.kind !== 'announced_correspondence_hypothesis') return fallback();
      // When the original current-only measurement already supplies this same
      // service, preserve the unchanged source proposal and its old contracts.
      if (source?.outline_plan.meaning.kind === 'announced_correspondence_hypothesis'
        && same(source.outline_plan.measurement.accompaniment, measured.accompaniment)
        && same(source.outline_plan.measurement.relation, measured.relation)) return source;
      proposed = await this.packageMeasuredProposal(obs, rows, 1, measured, decision.conclusions[0], receipt);
    }
    if (!proposed) return fallback();
    proposed.requires_current_service_witness = true;
    proposed.native_outline_public_context = { schema: 'native.outline.current_public_context_question.v1', kind: mode,
      public_transition_ref: `outline_public_transition:${symbolicDigest(context)}`,
      before: context.before, after: context.after, prior_command: context.command,
      selected_outline: context.selected_outline, previous_rows_sha256: context.before_rows_sha256,
      current_rows_sha256: context.after_rows_sha256, source_proposal_available: source !== null,
      source_proposal_kind: source?.outline_plan.meaning.kind ?? null, actual_trial_not_yet_measured: true,
      release_authority: false, action_effect_known: false };
    return proposed;
  }

  private currentServiceContext(obs: NativeObservation, rows: NativeRows): R | null {
    const actual = currentOutlinePublicTransition(this.publicTransition, this.currentState, obs, rows);
    if (actual) return actual;
    const recalled = this.control?.recalled_method;
    if (!this.currentRecoveryQuestions || this.control?.status !== 'recalled_outline_hypothesis_current_unique'
      || this.control.level_epoch !== obs.level_epoch || !recalled?.evidence?.length
      || this.control.transitions.length || symbolicDigest(rows).slice(0, 16) !== obs.frame_hash) return null;
    return { schema: 'native.outline.recalled_current_scene.v1', before: null,
      after: Object.fromEntries(['observation_ref', 'level_epoch', 'levels_completed', 'frame_hash', 'revision'].map(key => [key, obs[key]])),
      command: null, before_rows: null, before_rows_sha256: null, after_rows_sha256: symbolicDigest(rows), selected_outline: null,
      source_state_ref: `outline_source:${symbolicDigest(this.currentState)}`,
      qualification: 'Current unique visual rebinding of a historical control method. No preceding same-epoch transition or current acquired displacement is claimed.' };
  }

  /** Source recovery and a separately declared native initial-access question.
   * Every question is one primitive, rebound to the current public relation.
   * A source method is retained as a conditional prior across epochs; it never
   * manufactures a current local effect or a future mobile trajectory. */
  private async proposeCurrentRecovery(obs: NativeObservation, rows: NativeRows, measured: R,
    context: R, source: R | null, includeInitialAccess = false): Promise<R | null> {
    const reacquired = Boolean(this.control?.interior_contrast && measured.current_transitions.length);
    const recalled = this.control?.status === 'recalled_outline_hypothesis_current_unique'
      && !measured.current_transitions.length && this.control.recalled_method?.evidence?.length > 0;
    if (!reacquired && !recalled) return null;
    if (source && ['local_operator_hypothesis', 'locus_access_hypothesis'].includes(source.outline_plan.meaning.kind)) return null;
    const prior = this.config.interface_prior;
    const fields = { canonical_provisional_control_term_facts: [{ term_ref: 'hypothesis.action_conditioned_outline', entity_ref: measured.current.component_ref }],
      canonical_provisional_control_geometry_bboxes: [measured.current.bbox], current_action_conditioned_control_outline_bboxes: [measured.current.bbox],
      available_action_refs: obs.available_action_refs, interface_action_translation_deltas: Object.entries(prior.directions).map(([a, d]) => [a, (d as number[])[1], (d as number[])[0]]),
      known_action_translation_deltas: measured.current_transitions.map((value: R) => [value.action, value.delta[1], value.delta[0]]),
      current_control_reacquired: reacquired, current_recalled_control_unique: recalled,
      historical_control_evidence_refs: recalled ? this.control!.recalled_method.evidence : [],
      current_observation_ref: obs.observation_ref, current_level_epoch: obs.level_epoch, current_revision: obs.revision,
      current_control_evidence_refs: unique([...this.control!.evidence, obs.observation_ref]),
      previous_action_observed_frame: context.before_rows, previous_public_transition: context.command ? context : null,
      last_action_ref: context.command?.action_ref ?? null, interface_local_action_ref: prior.interaction,
      interface_point_action_ref: OUTLINE_SOURCE_POINT_ACTION_REF };
    const [adjacent, summary] = await measureOutlineRejoinAndCapture(rows, fields);
    const last = context.command?.action_ref ?? null;
    const nondirectional = obs.available_action_refs.includes(last) && last !== 'ACTION6' && !Object.hasOwn(prior.directions, last);
    let mode: OutlineRecoveryMode | 'announced_access' | 'observed_body_access' | 'observed_body_arrival_local_test' | null = null, action: string | null = null, operator = false;
    let subset: R | null = null, access: R | null = null, contact: R | null = null;
    if (reacquired && nondirectional && summary.body_perimeter_marker_rejoin_count === 1
      && summary.controlled_lead_cardinally_adjacent_to_announced_cell === true && summary.body_perimeter_marker_rejoin_route_bound_reached === false) {
      mode = 'announced_rejoin'; action = summary.body_perimeter_marker_rejoin_route_first_action_ref;
    } else if (reacquired && !nondirectional && summary.controlled_lead_distinct_uniform_interior_present === true
      && summary.adjacent_compact_body_without_visible_cardinal_marker_count === 0 && summary.filled_logical_cell_opposite_last_direction_present === true
      && summary.compact_body_perimeter_cardinal_announcement_count === 1 && summary.body_perimeter_marker_rejoin_route_bound_reached === false) {
      mode = 'overlaid_capture'; action = prior.interaction; operator = true;
    } else if (reacquired && nondirectional && summary.controlled_lead_distinct_uniform_interior_present === true
      && summary.adjacent_compact_body_without_visible_cardinal_marker_count === 1 && Object.keys(adjacent).length === 1
      && summary.adjacent_unmarked_compact_body_route_bound_reached === false && summary.compact_body_perimeter_cardinal_announcement_count === 1
      && summary.body_perimeter_marker_rejoin_route_bound_reached === false) {
      mode = 'adjacent_capture'; action = Object.keys(adjacent)[0]!;
    }
    if (mode) subset = OUTLINE_RECOVERY_SUBSETS[mode];
    // Existing source offers retain their own order. Initial access is a new
    // composition only when the transferred service cannot yet be applied.
    if (!mode && includeInitialAccess && !source && this.methods.some(value => value.status === 'observed_local_change' && value.local_count > 0)) {
      contact = reacquired ? await measureOutlineAccessArrival(rows, fields) : null;
      if (contact) {
        mode = 'observed_body_arrival_local_test'; action = contact.action_ref; operator = true;
        subset = { referenceCommit: OUTLINE_CONTINUATION_SUBSET.referenceCommit,
          sourcePointers: [{ id: 'native.outline.observed_body_arrival_local_test' }],
          document: { sha256: symbolicDigest(['native.outline.observed_body_arrival_local_test.v1', 'actual_selected_access_arrival', 'current_visible_remnant', 'conditional_historical_local_method']) } };
      }
      access = !mode ? await measureOutlineAnnouncedAccess(rows, fields) : null;
      if (access) {
        mode = access.kind === 'current_observed_body_access_question' ? 'observed_body_access' : 'announced_access'; action = access.action_ref;
        subset = { referenceCommit: OUTLINE_CONTINUATION_SUBSET.referenceCommit,
          sourcePointers: [{ id: `native.outline.current_unique_${mode}` }],
          document: { sha256: symbolicDigest([`native.outline.current_unique_${mode}.v1`, 'unique_current_visual_correspondence', 'one_distance_reducing_conditional_primitive']) } };
      }
    }
    if (!mode || !action || !subset || !obs.available_action_refs.includes(action)) return null;
    // Original recovery geometry names an adjacent cell, so an observed input
    // with another displacement cannot be substituted for its one-cell step.
    const accessMode = mode === 'announced_access' || mode === 'observed_body_access';
    if (!accessMode && !operator) {
      const learned = this.control!.controls[action]?.delta, direction = prior.directions[action];
      if (!direction || learned && !same(learned, [direction[0] * measured.current.width, direction[1] * measured.current.height])) return null;
    }
    const meaning = { kind: `native_current_${mode}_hypothesis`, operation: operator ? 'OP18' : 'OP28',
      role: accessMode ? 'controlled_outline_approaching_current_reidentified_relation' : contact ? 'controlled_outline_testing_reached_prior_body_cell' : 'controlled_outline_restoring_current_announced_service',
      rule_ref: subset.selectionTier?.id ?? `native.outline.current_unique_${mode}`,
      mechanism_ref: subset.sourcePointers[0].id,
      question: accessMode
        ? 'Approach the unique currently reidentified visual relation by one conditional input, then remeasure; no absent marker, motion or usefulness is inferred.'
        : contact ? 'Test the historical local operator once at the actually reached prior body cell with current visible support; body survival and the next effect remain unknown.'
        : 'Revalidate one source-declared rejoin or capture question after the actual public return; the next effect remains unknown.' };
    const recovery = { mode, summary, adjacent_actions: adjacent, last_action_was_nondirectional_discrete: nondirectional,
      ...(access ? { access } : {}), ...(contact ? { contact } : {}),
      ...(access || contact ? { historical_local_method_evidence: this.methods.filter(value => value.status === 'observed_local_change' && value.local_count > 0) } : {}) };
    const candidate = await this.packageMeasuredProposal(obs, rows, 1, { ...measured, recovery }, meaning, null, operator,
      { actionRef: action, subset, unknownConditions: ['attempted_without_effect_in_current_context', ...(contact ? ['historical_local_method_currently_revalidated'] : operator ? ['candidate_is_unique_effectful_nondirectional_local_action'] : [])] });
    if (!candidate) return null;
    candidate.requires_current_service_witness = true;
    candidate.native_outline_public_context = { schema: 'native.outline.current_public_context_question.v1', kind: mode,
      public_transition_ref: `outline_public_transition:${symbolicDigest(context)}`, before: context.before, after: context.after,
      prior_command: context.command, context_kind: context.command ? 'actual_public_transition' : 'recalled_current_scene',
      selected_outline: context.selected_outline, previous_rows_sha256: context.before_rows_sha256,
      current_rows_sha256: context.after_rows_sha256, source_proposal_available: source !== null,
      source_proposal_kind: source?.outline_plan.meaning.kind ?? null, actual_trial_not_yet_measured: true,
      release_authority: false, action_effect_known: false };
    return candidate;
  }

  /** A query diagnostic, separately retained by the caller graph, never an
   * acquired transition or an alternative source-state representation. */
  currentProposalRefusal(observation: NativeObservation): NativeRecord | null {
    const refusal = this.proposalRefusal;
    if (!refusal || ['observation_ref', 'level_epoch', 'frame_hash'].some(field => refusal[field] !== observation[field])
      || refusal.owner_state_ref !== `outline_owner:${symbolicDigest(this.currentState)}`) return null;
    return structuredClone(refusal);
  }

  /** Explicit native coordination surface. Strict source proposal selection
   * and before/after guards remain unchanged. Recompute from current rows and
   * require actual caller trial evidence before exposing the V5 service facts. */
  async currentRequiredServiceWitness(proposal: R, observation: NativeObservation, rows: NativeRows,
    currentTrial: NativeRecord): Promise<NativeRecord | null> {
    const state = this.currentState;
    if (!outlineRequiredServiceTrialCurrent(proposal, observation, currentTrial, state)
      || (state.control!.transitions as R[]).filter(value => value.level_epoch === observation.level_epoch).length > 64) return null;
    const current = await this.propose(observation, rows, [], 1);
    if (!current || state !== this.currentState) return null;
    const publicPacket: NativePublicObservation = { frame_rows: rows, frame_packet: [rows],
      level: observation.level_epoch, levels_completed: observation.levels_completed, state: observation.state,
      step_index: observation.revision, available_action_refs: observation.available_action_refs, frame_hash: observation.frame_hash };
    if (proposal.requires_current_service_witness === true || proposal.native_outline_public_context) {
      if (!this.currentPublicAnnouncementContext || !current.native_outline_public_context
        || !proposal.outline_plan?.measurement?.control_workflow || !Array.isArray(proposal.compositions)
        || !outlinePublicProposalMatchesCurrent(proposal, current, observation, rows)) return null;
      const context = this.currentServiceContext(observation, rows), measured = current.outline_plan.measurement;
      if (!context || current.native_outline_public_context.public_transition_ref !== `outline_public_transition:${symbolicDigest(context)}`) return null;
      if (measured.recovery) return this.currentRecoveryWitness(current, observation, publicPacket, currentTrial, context);
      const sourceGuard = this.beforeSource(current, 0, publicPacket, observation), command = current.actions[0];
      const mode = current.native_outline_public_context.kind, local = state.methods.filter(value => value.scope === observation.level_epoch
        && value.status === 'observed_local_change' && value.local_count > 0 && value.action?.action_ref === this.config.interface_prior.interaction);
      if (!sourceGuard.admitted || !local.length || !state.control!.interior_contrast || !measured.current_transitions.length
        || measured.relation.compact_body_hollow_perimeter_marker_route_bound_reached !== false) return null;
      const proposalRef = `outline_public_service:${symbolicDigest(outlinePublicProposalCore(current))}`;
      let interpreted: R, effectful: R | null = null, subset: R;
      const base = { ...measured.relation, candidate_ref: proposalRef, action_ref: command.action_ref,
        interaction_measurement_kind: 'discrete', attempted_without_effect_in_current_context: currentTrial.attempted_without_effect_in_current_context };
      if (mode === 'obstructing_inset_operator') {
        effectful = outlineUniqueEffectfulLocalOperator(currentTrial, observation, command.action_ref, Object.keys(this.config.interface_prior.directions));
        if (!effectful || context.selected_outline?.active_goal_ref !== OUTLINE_ACCOMPANIMENT_GOAL
          || current.outline_plan.operator !== true || current.steps[0].expected_after !== null) return null;
        interpreted = await evaluateOutlinePublicOperatorSubset({ ...base,
          dispatched_composition_active_goal_ref: context.selected_outline.active_goal_ref,
          candidate_is_unique_effectful_nondirectional_local_action: true });
        subset = OUTLINE_PUBLIC_OPERATOR_SUBSET;
      } else if (mode === 'announced_continuation') {
        const choices = Object.keys(measured.accompaniment);
        if (choices.length !== 1 || choices[0] !== command.action_ref || current.outline_plan.operator !== false
          || measured.relation.controlled_lead_bbox_is_compatible_with_announced_motion !== true) return null;
        interpreted = await evaluateOutlineContinuationSubset({ ...base, candidate_matches_compact_body_hollow_perimeter_marker_direction: true });
        subset = OUTLINE_CONTINUATION_SUBSET;
      } else return null;
      if (!interpreted.matched || interpreted.projected_facts.remaining_action_bound !== 1
        || interpreted.projected_facts.full_metaplan_reprojection_required_after_primitive !== true
        || interpreted.projected_facts.declared_conditional_series_authorized !== false
        || interpreted.projected_facts.declared_deterministic_series_authorized !== false) return null;
      return retainNativeJson({ schema: 'logos-engine.native.outline-required-service.v2',
        rule: 'native.current_public_announcement_service', status: 'current_required_service', mode,
        observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, frame_hash: observation.frame_hash,
        action_ref: command.action_ref, trial_key: currentTrial.trial_key, proposal_ref: proposalRef,
        current_trial: currentTrial, global_operator_evidence: effectful,
        public_transition_ref: current.native_outline_public_context.public_transition_ref,
        public_transition: { before: context.before, after: context.after, command: context.command,
          before_rows_sha256: context.before_rows_sha256, after_rows_sha256: context.after_rows_sha256,
          selected_outline: context.selected_outline, source_state_ref: context.source_state_ref },
        source_subset: { reference_commit: subset.referenceCommit, source_path: subset.sourcePath,
          source_sha256: subset.sourceSha256, subset_sha256: subset.document.sha256,
          declaration_refs: subset.sourcePointers.map((value: R) => value.id), qualification: subset.qualification,
          wrapper_qualification: subset.wrapperQualification },
        source_condition_receipt: interpreted, source_guard: sourceGuard,
        source_guard_scope: 'Only the original current-outline/action binding is shared; the new candidate and current-service admission are explicit native extensions.',
        current_measurement: measured, current_control: state.control, local_operator_evidence: local,
        evidence_refs: unique([observation.observation_ref, context.before.observation_ref, context.after.observation_ref,
          ...state.control!.evidence, ...local.flatMap(value => value.evidence), ...(currentTrial.evidence_refs as string[]), ...(effectful?.evidence_refs ?? [])]),
        primitive_bound: 1, replan_after_each_primitive: true, release_authority: false, action_effect_known: false, terminal_rule_known: false,
        unknown: ['local_effect', 'autonomous_policy', 'terminal_rule', 'contact_consequence'],
        qualification: 'An actual immediately preceding public raster completes the unchanged V5 measurement. The exact acquired dispatch and current caller trial support only one conditional question; every following action requires a new public measurement.' });
    }
    return currentOutlineRequiredServiceWitness(proposal, current, observation, rows, currentTrial, state,
      this.beforeSource(current, 0, publicPacket, observation), this.config.interface_prior.interaction, this.currentRecoveryQuestions);
  }

  /** Conditional reuse of an actually observed local method. The common
   * inventory remains explicitly current-epoch evidence; an old effect is
   * never inserted into it or relabeled as a current causal observation. */
  private historicalArrivalMethod(observation: NativeObservation, trial: NativeRecord, action: string): R | null {
    const directions = new Set(Object.keys(this.config.interface_prior.directions));
    const localInputs = unique(observation.available_action_refs.filter(ref => ref !== OUTLINE_SOURCE_POINT_ACTION_REF && !directions.has(ref)));
    if (!localInputs.includes(action) || action !== this.config.interface_prior.interaction) return null;
    const availableMethods = this.methods.filter(value => value.status === 'observed_local_change' && value.local_count > 0
      && Number.isSafeInteger(value.scope) && value.scope >= 0 && value.scope <= observation.level_epoch
      && localInputs.includes(value.action?.action_ref) && Array.isArray(value.evidence) && value.evidence.length > 0
      && value.evidence.every((ref: unknown) => typeof ref === 'string' && ref.length > 0));
    const historicalCandidates = unique(availableMethods.map(value => value.action.action_ref));
    if (historicalCandidates.length !== 1 || historicalCandidates[0] !== action) return null;
    const local = availableMethods.filter(value => value.action.action_ref === action);
    const inventory = trial.effectful_action_context;
    if (!isJsonObject(inventory) || inventory.domain_complete !== true
      || inventory.observation_ref !== observation.observation_ref || inventory.level_epoch !== observation.level_epoch
      || inventory.levels_completed !== observation.levels_completed
      || !same(inventory.available_action_refs, observation.available_action_refs)
      || !Array.isArray(inventory.known_effectful_action_refs)
      || !inventory.known_effectful_action_refs.every((ref: unknown) => typeof ref === 'string')
      || !Array.isArray(inventory.evidence_refs) || !inventory.evidence_refs.every((ref: unknown) => typeof ref === 'string')
      || inventory.level_start_checkpoint_action_ref === action) return null;
    const currentLocals = unique(inventory.known_effectful_action_refs.filter((ref: string) =>
      observation.available_action_refs.includes(ref) && ref !== OUTLINE_SOURCE_POINT_ACTION_REF && !directions.has(ref)));
    if (currentLocals.some(ref => ref !== action)) return null;
    return { status: 'conditional_local_method_revalidated_at_current_arrival', action_ref: action,
      historical_method_events: local, historical_evidence_refs: unique(local.flatMap(value => value.evidence)),
      current_available_nondirectional_action_refs: localInputs, historical_local_method_action_refs: historicalCandidates,
      other_available_input_effects: 'unknown_unless_observed_in_current_inventory', current_effect_inventory: inventory,
      current_effect_observed: currentLocals.includes(action), current_effect_guaranteed: false,
      qualification: 'Exactly one currently available nondirectional input has actual positive historical local-method evidence and matches the declared local input. Other unseen inputs keep unknown effects. The current caller inventory is retained unchanged; absence of a current-epoch local effect remains unknown.' };
  }

  private async currentRecoveryWitness(current: R, observation: NativeObservation, packet: NativePublicObservation,
    currentTrial: NativeRecord, context: R): Promise<NativeRecord | null> {
    const reacquired = this.control?.interior_contrast && this.control.evidence.length
      && this.control.transitions.some((value: R) => value.level_epoch === observation.level_epoch);
    const recalled = this.control?.status === 'recalled_outline_hypothesis_current_unique'
      && this.control.level_epoch === observation.level_epoch && this.control.recalled_method?.evidence?.length > 0;
    if (!this.currentRecoveryQuestions || !reacquired && !recalled) return null;
    const measured = current.outline_plan.measurement, recovery = measured.recovery, mode = recovery.mode;
    const command = current.actions[0], sourceGuard = this.beforeSource(current, 0, packet, observation);
    if (!sourceGuard.admitted || current.steps.length !== 1 || current.steps[0].seal_after !== true
      || mode !== current.native_outline_public_context.kind) return null;
    const proposalRef = `outline_recovery:${symbolicDigest(outlinePublicProposalCore(current))}`;
    let interpreted: R, subset: R | null = null, effectful: R | null = null;
    const accessMode = mode === 'announced_access' || mode === 'observed_body_access';
    const arrivalMode = mode === 'observed_body_arrival_local_test';
    if (arrivalMode) {
      const contact = recovery.contact, historical = this.historicalArrivalMethod(observation, currentTrial, command.action_ref);
      if (!reacquired || !contact || contact.action_ref !== command.action_ref || !historical
        || current.outline_plan.operator !== true || current.steps[0].expected_after !== null) return null;
      // This is intentionally not the original completed-BFS projection:
      // only a selected one-step access arrival has actually been observed.
      interpreted = { matched: true, interpretation_kind: 'explicit_native_composition',
        rule: 'native.outline.observed_body_arrival_local_test',
        projected_facts: { active_goal_ref: 'goal.reveal_action_conditioned_structure', active_terminal_goal_ref: OUTLINE_ACCOMPANIMENT_GOAL,
          remaining_action_bound: 1, full_metaplan_reprojection_required_after_primitive: true,
          original_completed_bfs_endpoint_premise_reused: false, current_complete_body_asserted: false },
        current_measurement: contact, local_method_evidence: historical,
        qualification: 'Native conditional local test at an actual selected access endpoint with currently visible support. Historical local response is a revisable method hypothesis, not a current effect or body-survival claim.' };
    } else if (accessMode) {
      const access = recovery.access;
      if (!access || access.action_ref !== command.action_ref || current.outline_plan.operator !== false
        || !same(current.steps[0].expected_after?.body_bbox, access.expected_body_bbox)
        || !recovery.historical_local_method_evidence?.length) return null;
      interpreted = { matched: true, interpretation_kind: 'explicit_native_composition',
        rule: `native.outline.current_unique_${mode}`,
        projected_facts: { active_goal_ref: OUTLINE_ACCOMPANIMENT_GOAL, active_terminal_goal_ref: OUTLINE_ACCOMPANIMENT_GOAL,
          remaining_action_bound: 1, full_metaplan_reprojection_required_after_primitive: true,
          source_rejoin_last_nondirectional_premise_reused: false },
        current_measurement: access, control_evidence_status: reacquired ? 'current_reacquired_control' : 'historical_control_current_unique_hypothesis',
        method_evidence_status: 'historical_conditional_prior_revalidated_against_current_outline',
        qualification: 'Native initial-access experiment composed from the V5 geometric announcement motif and reacquired V6 outline control. This is not a match of the narrower original post-intervention rejoin rule.' };
    } else {
      if (!reacquired || !['announced_rejoin', 'adjacent_capture', 'overlaid_capture'].includes(mode)) return null;
      subset = OUTLINE_RECOVERY_SUBSETS[mode as OutlineRecoveryMode];
      const operator = mode === 'overlaid_capture';
      if (operator) {
        effectful = outlineUniqueEffectfulLocalOperator(currentTrial, observation, command.action_ref, Object.keys(this.config.interface_prior.directions));
        if (!effectful || current.outline_plan.operator !== true || current.steps[0].expected_after !== null) return null;
      } else if (current.outline_plan.operator !== false) return null;
      interpreted = await evaluateOutlineRecoverySubset(mode as OutlineRecoveryMode, { ...recovery.summary,
        candidate_ref: proposalRef, action_ref: command.action_ref, interaction_kind: 'discrete', interaction_measurement_kind: 'discrete',
        last_action_was_nondirectional_discrete: recovery.last_action_was_nondirectional_discrete,
        candidate_is_body_perimeter_marker_rejoin_route_first_action: recovery.summary.body_perimeter_marker_rejoin_count === 1
          && command.action_ref === recovery.summary.body_perimeter_marker_rejoin_route_first_action_ref,
        candidate_is_adjacent_unmarked_compact_body_route_first_action: Object.keys(recovery.adjacent_actions).length === 1
          && Object.hasOwn(recovery.adjacent_actions, command.action_ref),
        candidate_is_unique_effectful_nondirectional_local_action: effectful !== null,
        attempted_without_effect_in_current_context: currentTrial.attempted_without_effect_in_current_context });
      if (!interpreted.matched) return null;
    }
    if (interpreted.projected_facts.remaining_action_bound !== 1
      || interpreted.projected_facts.full_metaplan_reprojection_required_after_primitive !== true) return null;
    return retainNativeJson({ schema: 'logos-engine.native.outline-required-service.v3', status: 'current_required_service',
      rule: accessMode ? `native.current_unique_${mode}` : arrivalMode ? 'native.current_observed_body_arrival_local_test' : 'native.current_source_recovery_service', mode,
      observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, frame_hash: observation.frame_hash,
      action_ref: command.action_ref, trial_key: currentTrial.trial_key, proposal_ref: proposalRef, current_trial: currentTrial,
      source_guard: sourceGuard, source_condition_receipt: interpreted, global_operator_evidence: effectful,
      source_subset: subset ? { reference_commit: subset.referenceCommit, source_path: subset.sourcePath,
        source_sha256: subset.sourceSha256, subset_sha256: subset.document.sha256,
        declaration_refs: subset.sourcePointers.map((value: R) => value.id), qualification: subset.qualification } : null,
      public_transition_ref: current.native_outline_public_context.public_transition_ref,
      public_transition: { before: context.before, after: context.after, command: context.command,
        before_rows_sha256: context.before_rows_sha256, after_rows_sha256: context.after_rows_sha256 },
      current_measurement: measured, current_control: this.control,
      evidence_refs: unique([observation.observation_ref, ...(context.before ? [context.before.observation_ref] : []), context.after.observation_ref,
        ...this.control!.evidence, ...(recalled ? this.control!.recalled_method.evidence : []), ...(currentTrial.evidence_refs as string[]), ...(effectful?.evidence_refs ?? [])]),
      primitive_bound: 1, replan_after_each_primitive: true, release_authority: false, action_effect_known: false,
      terminal_rule_known: false, unknown: ['next_displacement', 'mobile_next_announcement', 'local_effect', 'contact_consequence', 'terminal_rule', ...(arrivalMode ? ['current_complete_body_survival'] : [])],
      qualification: 'Only the next current primitive is proposed. Actual caller trial, current geometry and ordinary guards remain necessary. No future route, palette role or game identity is supplied.' });
  }

  bind(proposal: R, _preserve: unknown): void {
    if (!proposal.steps?.length || !same(proposal.steps.map((step: R) => step.action ?? null), proposal.actions)) throw new TypeError('outline actions/steps mismatch');
  }
  locusCurrent(proposal: R, rows: NativeRows, body: readonly number[]): boolean {
    const [l, t, r, b] = body as [number, number, number, number];
    return (proposal.outline_plan.locus_patch ?? []).every(([x, y, value]: number[]) => (l <= x! && x! <= r && t <= y! && y! <= b && (x === l || x === r || y === t || y === b)) || rows[y!]![x!] === value);
  }
  beforeSource(proposal: R, index: number, publicPacket: NativePublicObservation, obs: NativeObservation): NativeBeforeResult {
    if (obs.level_epoch !== proposal.binding.level_epoch) return { admitted: false, reason: 'scope_changed' };
    if (index === 0 && obs.frame_hash !== proposal.binding.frame_hash) return { admitted: false, reason: 'stale_frame' };
    if (!same((proposal.steps ?? []).map((step: R) => step.action ?? null), proposal.actions) || !Number.isInteger(index) || index < 0 || index >= proposal.steps.length) return { admitted: false, reason: 'action_step_binding_changed' };
    const step = proposal.steps[index], value = proposal.outline_plan.measurement.current.value;
    const okay = outlineSameBox(publicPacket.frame_rows, step.body_before, value) && this.locusCurrent(proposal, publicPacket.frame_rows, step.body_before) && obs.available_action_refs.includes(step.action.action_ref);
    return { admitted: okay, reason: okay ? 'current_outline_and_sealed_action' : 'outline_or_command_changed' };
  }
  async before(proposal: R, index: number, publicPacket: NativePublicObservation, obs: NativeObservation): Promise<NativeBeforeResult> {
    const source = this.beforeSource(proposal, index, publicPacket, obs);
    if (!proposal.native_outline_public_context && proposal.requires_current_service_witness !== true) return source;
    if (!source.admitted || !this.currentPublicAnnouncementContext || index !== 0 || proposal.requires_current_service_witness !== true
      || !isJsonObject(proposal.native_current_service_witness) || !isJsonObject(proposal.native_current_service_witness.current_trial)) return {
      admitted: false, reason: 'current_public_service_witness_required' };
    const current = await this.currentRequiredServiceWitness(proposal, obs, publicPacket.frame_rows, proposal.native_current_service_witness.current_trial);
    if (!current || !same(current, proposal.native_current_service_witness)) return { admitted: false, reason: 'current_public_service_witness_changed' };
    return { admitted: true, reason: 'current_public_announcement_service_and_trial', native_binding_receipt: {
      schema: 'logos-engine.native.current-outline-public-binding.v1', rule: 'native.current_public_announcement_service',
      observation_ref: obs.observation_ref, level_epoch: obs.level_epoch, frame_hash: obs.frame_hash,
      source_guard: source, current_service_witness: current, common_preservation_revalidated: Boolean(proposal.preservation),
      release_authority: false, action_effect_known: false } };
  }
  afterSource(proposal: R, index: number, before: NativeObservation, after: NativeObservation, _first: NativeRows, second: NativeRows): NativeAfterResult & R {
    if (before.level_epoch !== after.level_epoch) return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    const expected = proposal.steps[index].expected_after, value = proposal.outline_plan.measurement.current.value;
    if (expected === null) return { matched: null, preservation_matched: null, seal_prefix: true, reason: 'unknown_local_operator_effect_compare_public_return' };
    const match = outlineSameBox(second, expected.body_bbox, value), locus = this.locusCurrent(proposal, second, expected.body_bbox);
    return { matched: match, preservation_matched: locus, seal_prefix: !(match && locus), reason: 'conditional_outline_translation_compared' };
  }
  after(proposal: R, index: number, before: NativeObservation, after: NativeObservation, first: NativeRows, second: NativeRows): NativeAfterResult & R { return this.afterSource(proposal, index, before, after, first, second); }

  async recordSource(before: NativeObservation, after: NativeObservation, action: R, first: NativeRows, second: NativeRows, proposal: R | null = null, _index = 0): Promise<R | null> {
    await this.scope(before, first);
    const earlier = await outlineBoxes(first), later = await outlineBoxes(second), command = action.action_ref, evidence = [before.observation_ref, after.observation_ref];
    if (before.level_epoch !== after.level_epoch) { await this.scope(after, second); return { status: 'boundary', evidence }; }
    const state = this.state(), prior = this.config.interface_prior.directions;
    const beforeComponents = (await detectV5Components(first, 4)).components, afterComponents = (await detectV5Components(second, 4)).components;
    let translatedCount = 0;
    for (const component of beforeComponents) {
      const identity = (c: typeof component): boolean => c.value === component.value && same(c.relative_pixels, component.relative_pixels);
      const next = afterComponents.filter(identity), old = beforeComponents.filter(identity);
      if (next.length === 1 && old.length === 1 && !same(component.bbox, next[0]!.bbox)) translatedCount++;
    }
    if (Object.hasOwn(prior, command)) {
      for (const old of earlier) {
        const matches = later.filter(v => v.signature === old.signature), previous = earlier.filter(v => v.signature === old.signature);
        if (matches.length !== 1 || previous.length !== 1) continue;
        const current = matches[0]!, dx = current.bbox[0]! - old.bbox[0]!, dy = current.bbox[1]! - old.bbox[1]!;
        if (!(dx || dy) || dx !== 0 && dy !== 0) continue;
        const direction = prior[command]; if (dx && (direction[0] === 0 || dx * direction[0] < 0) || dy && (direction[1] === 0 || dy * direction[1] < 0)) continue;
        const track = state.tracks[old.signature] ??= { evidence: [], controls: {}, interior_contrast: false, transitions: [] };
        track.evidence = unique([...track.evidence, ...evidence]); track.controls[command] = { delta: [dx, dy], evidence };
        track.interior_contrast ||= !same(old.interior, current.interior); track.current = current;
        track.transitions.push({ before: before.observation_ref, after: after.observation_ref, action: command, from: old.bbox, to: current.bbox, delta: [dx, dy], level_epoch: before.level_epoch, distinct_translated_count: translatedCount });
      }
      const eligible = Object.values(state.tracks).filter(t => t.interior_contrast && t.evidence.length >= 3);
      if (eligible.length === 1) {
        const track = eligible[0]!; state.control = { ...track.current, controls: structuredClone(track.controls), transitions: structuredClone(track.transitions),
          interior_contrast: track.interior_contrast, evidence: track.evidence, level_epoch: state.epoch, status: 'translated_perimeter_with_observed_interior_contrast' };
      }
    }
    let event: R | null = null;
    if (truth(proposal) && truth(proposal!.outline_plan) && truth(proposal!.outline_plan.operator)) {
      const plan = proposal!.outline_plan, [l, t, r, b] = plan.measurement.current.bbox, changes: number[][] = [];
      for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (first[y]![x] !== second[y]![x]) changes.push([x, y, first[y]![x]!, second[y]![x]!]);
      let remote = 0;
      // Pinned family.py:135 binds `(a,b)` to the two pixels inside its
      // comprehension, shadowing the bbox bottom `b` in `t <= y <= b`.
      // Preserve that exact source expression; this field is not a corrected
      // geometric count of changes outside the controlled outline.
      for (let y = 0; y < Math.min(first.length, second.length); y++) for (let x = 0; x < Math.min(first[y]!.length, second[y]!.length); x++) {
        const sourceBeforePixel = first[y]![x]!, sourceAfterPixel = second[y]![x]!;
        if (!(l <= x && x <= r && t <= y && y <= sourceAfterPixel) && sourceBeforePixel !== sourceAfterPixel) remote++;
      }
      event = { status: changes.length ? 'observed_local_change' : 'no_visible_local_change', evidence, action,
        local_delta_sha256: symbolicDigest(changes), local_count: changes.length, remote_change_count: remote, scope: state.epoch,
        unknown: ['effect_cause', 'delayed_effect', 'autonomous_policy', 'terminal_rule'] };
      state.attempts[plan.measurement.context_key] = event; state.methods.push(event); state.methods = state.methods.slice(-32);
    }
    state.last = structuredClone(action); state.last_event = event; this.commit(state); return structuredClone(event);
  }

  /** Called once for each actual public return, selected or passive. Only a
   * genuinely selected, guarded proposal may contribute a dispatched goal.
   * The unchanged source record still owns exactly its seven source fields. */
  async recordPublicTransition(before: NativeObservation, after: NativeObservation, command: R,
    first: NativeRows, second: NativeRows, proposal: R | null = null, index = 0): Promise<R | null> {
    if (!this.currentPublicAnnouncementContext) return this.recordSource(before, after, command, first, second, proposal, index);
    await this.scope(before, first);
    let selected: R | null = null;
    if (proposal && proposal.actions?.[index] && same(outlinePhysicalCommand(proposal.actions[index]), outlinePhysicalCommand(command))) {
      const packet: NativePublicObservation = { frame_rows: first, frame_packet: [first], level: before.level_epoch,
        levels_completed: before.levels_completed, state: before.state, step_index: before.revision,
        available_action_refs: before.available_action_refs, frame_hash: before.frame_hash };
      const guard = await this.before(proposal, index, packet, before);
      if (guard.admitted) {
        const meaning = proposal.outline_plan?.meaning, projected = proposal.native_current_service_witness?.source_condition_receipt?.projected_facts;
        let goal: string | null = null, terminal: string | null = null;
        if (proposal.requires_current_service_witness === true && projected) {
          goal = typeof projected.active_goal_ref === 'string' ? projected.active_goal_ref : null;
          terminal = typeof projected.active_terminal_goal_ref === 'string' ? projected.active_terminal_goal_ref : null;
        } else if (meaning?.kind === 'announced_correspondence_hypothesis'
          && meaning.rule_ref === 'outline_service.announced_accompaniment' && meaning.mechanism_ref === OUTLINE_ACCOMPANIMENT_GOAL) {
          goal = OUTLINE_ACCOMPANIMENT_GOAL; terminal = OUTLINE_ACCOMPANIMENT_GOAL;
        }
        selected = { proposal_ref: `outline_dispatched:${symbolicDigest(outlinePublicProposalCore(proposal))}`,
          meaning_kind: meaning.kind, active_goal_ref: goal, active_terminal_goal_ref: terminal,
          observation_ref: before.observation_ref, frame_hash: before.frame_hash, level_epoch: before.level_epoch,
          action_index: index, command: structuredClone(command), guard_admitted: true,
          provenance: 'actual_selected_outline_prefix_before_guard' };
        const access = proposal.outline_plan?.measurement?.recovery?.access;
        if (access) {
          selected.access_relation = structuredClone(access);
          selected.access_relation_ref = `outline_access:${symbolicDigest(access)}`;
        }
      }
    }
    // Validate public bytes/scope before mutating acquired source memory.
    const pending = makeOutlinePublicTransition(before, after, command, first, second, this.currentState, selected);
    const event = await this.recordSource(before, after, command, first, second, proposal, index);
    const complete = pending ? retainOutlinePublicTransition({ ...pending,
      source_state_ref: `outline_source:${symbolicDigest(this.currentState)}` }, this.currentState) : null;
    this.setPublicTransition(complete);
    return event;
  }
  async record(before: NativeObservation, after: NativeObservation, command: NativeCommand, first: NativeRows, second: NativeRows, proposal: R, index: number, _frames: readonly NativeRows[]): Promise<NativeRecordResult> {
    return { events: [await this.recordPublicTransition(before, after, command, first, second, proposal, index)] };
  }
}
