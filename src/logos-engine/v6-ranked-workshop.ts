/** Pinned V6 ranked-profile workshop. Every proposed input remains a question;
 * only sealed public returns acquire mode, control and conditional tool evidence.
 * Source: morphology_policy/ranked_workshop/family.py at 786dcf51.
 */
import { NativeDrmRegistry, factConditionHolds } from './v6-drm-projector.ts';
import type { DrmCondition, NativeLoadedDrm } from './v6-drm-projector.ts';
import { NativeSrcProgram, V6_DECLARATIVE_SOURCES } from './v6-src-program.ts';
import { symbolicDigest as digest } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truthy } from './v6-operations.ts';
import { isJsonObject } from './canonical.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { project, stableContext } from './v6-ranked-workshop-geometry.ts';
import { extensionOptions, changes, modeSignature, profiles, relations } from './v6-ranked-workshop-methods.ts';
import { bandIndex } from './v6-ranked-workshop-preparation.ts';
import type { JsonObject, Primitive } from './ir.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeCommand, NativeFamily, NativeObservation,
  NativeProgramHandle, NativeProgramRegistry, NativeProposal, NativePublicObservation, NativeRecord,
  NativeRecordResult, NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const LOCAL = 'agents/yf_arc3_v6/morphology_policy/ranked_workshop/workshop.drm';
const WORKFLOW = 'v6.ranked_workshop.choose';
const FORMAT = 'native.public_ranked_workshop.v1';
const FIELDS = ['epoch', 'mode_evidence', 'rejected', 'events', 'mode_methods', 'input_effects',
  'method_refutations', 'operator_observations'] as const;
const copy = <T>(value: T): T => structuredClone(value);
function compare(a: any, b: any): number {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) { const n = compare(a[i], b[i]); if (n) return n; }
    return a.length - b.length;
  }
  return a === b ? 0 : a < b ? -1 : 1;
}
const holds = (conditions: readonly DrmCondition[], facts: R): boolean => conditions.every(c => factConditionHolds(c, facts));
const withoutSingleton = (context: R): R => Object.fromEntries(Object.entries(stableContext(context))
  .filter(([k]) => k !== 'station_profile_inner_singleton_count'));
const profileMultiset = (scene: R): any[] => profiles(scene).map((p: R) => p.profile.stem_relief_rank_height_pixels).sort(compare);

function validateState(value: R): R {
  const state = retainNativeJson(value);
  if (Object.keys(state).length !== FIELDS.length || FIELDS.some(k => !Object.hasOwn(state, k))
    || state.epoch !== null && !Number.isSafeInteger(state.epoch)
    || FIELDS.filter(k => k !== 'epoch').some(k => !Array.isArray(state[k]))
    || ['mode_evidence', 'events', 'mode_methods', 'input_effects', 'operator_observations']
      .some(k => !state[k].every(isJsonObject))
    || ['rejected', 'method_refutations'].some(k => !state[k].every((p: unknown) => Array.isArray(p) && p.length === 2))) {
    throw new TypeError('Incompatible ranked-workshop source state');
  }
  return state;
}

export class RankedWorkshop implements NativeFamily<any> {
  readonly id = 'public_ranked_workshop';
  readonly loaded: NativeLoadedDrm;
  readonly config: R;
  readonly registry: NativeDrmRegistry;
  epoch: number | null = null;
  mode_evidence: R[] = [];
  rejected: any[][] = [];
  events: R[] = [];
  mode_methods: R[] = [];
  input_effects: R[] = [];
  method_refutations: any[][] = [];
  operator_observations: R[] = [];
  selected: R | null = null;
  src_calls = 0;
  measured: R = {};
  observation: R = {};
  readonly cache = new Map<string, [R, R]>();
  private program!: NativeProgramHandle;
  private readonly callbacks: Readonly<Record<string, Primitive>>;
  private checkpoint: R | null = null;
  private revision = 0;

  private constructor(registry: NativeDrmRegistry, loaded: NativeLoadedDrm) {
    this.registry = registry; this.loaded = loaded;
    const config = loaded.document.declarations[0]?.configuration;
    if (!config) throw new TypeError('Missing ranked workshop configuration');
    this.config = retainNativeJson(config);
    this.callbacks = Object.freeze({
      'workshop.measure': args => this.measure(args.request as R) as JsonObject,
      'workshop.select': args => this.select(args.measured as R) as JsonObject,
    });
  }
  static async create(): Promise<RankedWorkshop> {
    const source = (V6_DECLARATIVE_SOURCES as R)[LOCAL];
    if (!source) throw new TypeError('Missing original ranked workshop DRM');
    const registry = new NativeDrmRegistry(), loaded = await registry.registerSource(source.text, source.sha256);
    registry.seal();
    const owner = new RankedWorkshop(registry, loaded);
    owner.program = await NativeSrcProgram.create(WORKFLOW, owner.callbacks); return owner;
  }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> {
    this.program = await registry.registerProgram(WORKFLOW, this.callbacks);
  }
  get nativeRevision(): number { this.nativeState(); return this.revision; }
  state(): R {
    return copy({ epoch: this.epoch, mode_evidence: this.mode_evidence, rejected: this.rejected, events: this.events.slice(-32),
      mode_methods: this.mode_methods, input_effects: this.input_effects, method_refutations: this.method_refutations,
      operator_observations: this.operator_observations });
  }
  sourceState(): R { return this.state(); }
  nativeState(): NativeRecord {
    const source = validateState(this.state());
    if (this.checkpoint && equal(this.checkpoint.source_state, source)) return this.checkpoint;
    this.checkpoint = retainNativeJson({ format: FORMAT, source_state: source }); this.revision++; return this.checkpoint;
  }
  restore(value: NativeRecord): void {
    if (!isJsonObject(value)) throw new TypeError('Ranked-workshop restore requires a source state mapping');
    const next = validateState({ ...this.state(), ...Object.fromEntries(FIELDS.filter(k => Object.hasOwn(value, k)).map(k => [k, value[k]])) });
    for (const k of FIELDS) (this as unknown as R)[k] = copy(next[k]);
    this.clearTransient();
  }
  restoreNative(value: Readonly<NativeRecord>): void {
    if (value === this.checkpoint && equal(this.state(), this.checkpoint!.source_state)) return;
    const supplied = retainNativeJson(value);
    if (!isJsonObject(supplied) || supplied.format !== FORMAT || Object.keys(supplied).length !== 2 || !isJsonObject(supplied.source_state)) {
      throw new TypeError('Invalid native ranked-workshop checkpoint');
    }
    const next = validateState(supplied.source_state), changed = !this.checkpoint || !equal(this.checkpoint.source_state, next);
    for (const k of FIELDS) (this as unknown as R)[k] = copy(next[k]);
    this.checkpoint = supplied; if (changed) this.revision++;
    this.clearTransient();
  }
  private clearTransient(): void {
    this.cache.clear(); this.selected = null; this.measured = {}; this.observation = {};
  }
  scope(obs: R): void {
    if (this.epoch !== obs.level_epoch) { this.epoch = obs.level_epoch; this.mode_evidence = []; this.rejected = []; }
  }
  projected(obs: R, rows: NativeRows): [R, R] {
    const key = JSON.stringify([obs.level_epoch, obs.revision, obs.frame_hash]);
    if (!this.cache.has(key)) {
      this.cache.set(key, project(obs, rows, this.config));
      while (this.cache.size > 2) this.cache.delete(this.cache.keys().next().value!);
    }
    return this.cache.get(key)!;
  }
  measure(_request: R): R { return this.measured; }
  select(measured: R): R {
    const context = measured.context, offers: R[] = [], contextHash = digest(stableContext(context));
    for (const action of this.observation.available_action_refs) {
      const facts = { ...context, action_ref: action, committed_plan_present: false };
      for (const rule of this.config.rules) if (holds(rule.all_conditions, facts)
        && !this.rejected.some(r => equal(r, [rule.id, contextHash]))) {
        offers.push({ rule, action: { action_ref: action }, kind: 'legacy' });
      }
    }
    for (const option of measured.extensions ?? []) {
      if (!this.observation.available_action_refs.includes(option.action.action_ref) || truthy(option.action.data)) continue;
      const facts = { ...context, option_kind: option.kind, ...(option.facts ?? {}) };
      for (const rule of this.config.extension_rules) if (holds(rule.all_conditions, facts)
        && !this.rejected.some(r => equal(r, [rule.id, contextHash]))) {
        offers.push({ rule, action: option.action, kind: option.kind, extension: option });
      }
    }
    const order: string[] = this.config.choice_order;
    if (offers.some(o => !order.includes(o.kind))) throw new TypeError('Ranked workshop offer kind is absent from source choice_order');
    const rank = offers.length ? Math.min(...offers.map(o => order.indexOf(o.kind))) : null;
    let selected = offers.filter(o => order.indexOf(o.kind) === rank);
    const fields: string[] = selected.length ? (this.config.option_cost_fields?.[selected[0]!.kind] ?? []) : [];
    if (fields.length) {
      const costs = selected.map(o => fields.map(k => o.extension[k])).sort(compare), cost = costs[0];
      selected = selected.filter(o => equal(fields.map(k => o.extension[k]), cost));
    }
    const grouped = new Map<string, R>();
    for (const offer of selected) grouped.set(digest([offer.action, offer.rule.id,
      offer.extension?.support?.ref ?? null, offer.extension?.objective_key ?? null]), offer);
    this.selected = grouped.size === 1 ? grouped.values().next().value! : null;
    return { selected: this.selected !== null, alternatives: grouped.size };
  }
  async proposeSource(obs: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    this.scope(obs); if (remaining < 1) return null;
    const [scene, context] = this.projected(obs, rows), extensions = truthy(context)
      ? extensionOptions(this, obs, rows, scene, context, inputs, remaining) : [];
    const activation = { public_mode_toggle_contrast_observed: this.mode_evidence.length > 0,
      portable_mode_question_present: extensions.some((o: R) => o.kind === 'revalidate_mode') };
    if (!truthy(context) || !(holds(this.config.activation, activation) || activation.portable_mode_question_present)) return null;
    this.measured = { context, extensions }; this.observation = obs; this.src_calls++;
    const { result, receipt } = await this.program.run({ request: { observation_ref: obs.observation_ref } });
    if (!isJsonObject(result)) throw new TypeError('Ranked workshop SRC returned no mapping');
    if (!result.selected) return null;
    const chosen = this.selected!, rule = chosen.rule, action = chosen.action,
      stage = rule.static_facts.station_profile_question_stage, extension = chosen.extension ?? null,
      evidence = [...new Set([obs.observation_ref, ...this.mode_evidence.flatMap(e => e.evidence), ...(extension?.evidence ?? [])])];
    const focus = 'composition:ranked_workshop:' + digest([obs.observation_ref, rule.id]),
      facts = { ranked_workshop_current_bound: true, observed_control_mode_contrast_bound: this.mode_evidence.length > 0 };
    const workflow = { workflow: receipt.workflow, src_hash: receipt.src_hash,
      src_status: receipt.src_status, executed_statements: receipt.executed_statements };
    const plan = { extension: copy(extension), projection_origin: extension ? 'current_DRM_extension' : 'V5_conditional_projection',
      profile_domain: copy(scene.comparison_domain ?? {}), rule_ref: rule.id, rule: copy(rule), stage, context,
      context_sha256: digest(stableContext(context)), evidence, workflow,
      source_drm_sha256: this.config.origin_drm_sha256, current_drm_sha256: this.loaded.source_hash,
      control_status: extension?.kind === 'revalidate_mode' ? 'portable_method_to_revalidate'
        : 'conditional_library_input_hypothesis; current_marker_toggle_observed',
      unknown: ['held_move_effect_until_current_probe', 'authenticating_input_until_effect', 'receipt_persistence_until_departure',
        'tools_and_their_domains', ...(extension?.unknown ?? [])],
      falsifiers: ['current_profile_or_marker_changed', 'other_profiles_change_unpredicted',
        'selected_control_does_not_produce_discriminating_effect', 'scope_changed'] };
    return { status: 'proposed', kind: this.id, actions: [action], steps: [{ action,
      expected_before: { level_epoch: obs.level_epoch, frame_hash: obs.frame_hash }, expected_after: null }], facts,
      binding: Object.fromEntries(['observation_ref', 'level_epoch', 'levels_completed', 'frame_hash'].map(k => [k, obs[k]])),
      workshop_plan: plan, compositions: [{ id: focus, role: 'information_question', observed: false,
        things: [context.station_profile_unique_marked_profile_ref], properties: {
          consumer_dependencies: copy(extension?.consumers ?? []), method_ref: extension?.method_ref ?? null,
          support: copy(extension?.support ?? null), target: stage, conditional: true, unknown: plan.unknown,
          falsifiers: plan.falsifiers, principle_ref: rule.static_facts.selection_principle_ref, receipts_are_not_occupancy: true },
        relations: ['contributes_to:G_official_completion'], open_question: this.config.question }],
      question: { reason: this.config.question, hypothesis_refs: evidence }, route_refs: evidence,
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion',
        purpose: this.config.question, preconditions: facts, evidence, actions: [action], preserve_refs: [],
        preservation_evidence: {}, outcome_guard: { path: ['value'], contains: focus } } };
  }
  async propose(obs: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    return this.proposeSource(obs, rows, inputs, remaining);
  }
  async proposeInSubquestion(group: string, question: string, obs: NativeObservation, rows: NativeRows,
    inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    if (group !== 'factored_material_return' || question !== 'observed_ranked_workshop') throw new TypeError('Unknown ranked workshop source entry');
    const proposal = await this.propose(obs, rows, inputs, remaining);
    if (proposal) proposal.material_access_subquestion = question; return proposal;
  }
  bind(proposal: R, _domain?: unknown): void {
    if (proposal.actions.length !== 1 || !equal(proposal.actions, proposal.steps.map((s: R) => s.action))
      || proposal.steps.some((s: R) => !Object.hasOwn(s, 'expected_after'))) throw new TypeError('Unbound ranked workshop probe');
  }
  before(proposal: R, index: number, publicPacket: NativePublicObservation, obs: NativeObservation): NativeBeforeResult {
    let ok = index === 0 && ['observation_ref', 'level_epoch', 'levels_completed', 'frame_hash'].every(k => equal(obs[k], proposal.binding[k]))
      && publicPacket.frame_hash === proposal.binding.frame_hash && publicPacket.level === proposal.binding.level_epoch
      && publicPacket.available_action_refs.includes(proposal.actions[index].action_ref);
    if (ok) { const [, context] = project(obs, publicPacket.frame_rows, this.config); ok = digest(stableContext(context)) === proposal.workshop_plan.context_sha256; }
    return { admitted: Boolean(ok), reason: ok ? 'current_ranked_profile_scope_mode_and_exact_probe' : 'ranked_profile_binding_changed' };
  }
  after(_proposal: R, _index: number, _before: NativeObservation, _after: NativeObservation, _first: NativeRows, _second: NativeRows): NativeAfterResult {
    return { matched: null, seal_prefix: true, reason: 'conditional_input_requires_sealed_observation' };
  }
  recordSource(before: NativeObservation, after: NativeObservation, command: R, first: NativeRows, second: NativeRows,
    proposal: R | null = null, index = 0): R | null {
    this.scope(before);
    if (truthy(proposal) && !equal(proposal!.actions[index], command)) return { status: 'command_proposal_mismatch', evidence: [before.observation_ref] };
    if (before.level_epoch !== after.level_epoch) {
      const event = { status: 'official_boundary', evidence: [before.observation_ref, after.observation_ref], prior_mode_evidence: copy(this.mode_evidence) };
      this.events.push(event); this.scope(after); return event;
    }
    const [a, ca] = this.projected(before, first), [b, cb] = this.projected(after, second);
    if (!truthy(ca) || !truthy(cb)) return null;
    const effect = changes(a, ca, b, cb), evidence = [before.observation_ref, after.observation_ref];
    if (Object.values(effect).some(truthy)) {
      const beforeY = truthy(ca.station_profile_marker_bbox) ? (ca.station_profile_marker_bbox[0] + ca.station_profile_marker_bbox[2]) / 2 : null,
        afterY = truthy(cb.station_profile_marker_bbox) ? (cb.station_profile_marker_bbox[0] + cb.station_profile_marker_bbox[2]) / 2 : null;
      const direction = beforeY === null || afterY === null || beforeY === afterY ? 0 : afterY > beforeY ? 1 : -1;
      const item: R = { action: copy(command), changes: effect, vertical_sign: direction,
        held_before: ca.station_profile_inner_singleton_count === 1, held_after: cb.station_profile_inner_singleton_count === 1,
        marked_profile_preserved: equal(ca.station_profile_marked_profile_heights ?? null, cb.station_profile_marked_profile_heights ?? null),
        same_profile_multiset: equal(profileMultiset(a), profileMultiset(b)), evidence, source_epoch: before.level_epoch };
      const am = profiles(a).filter((p: R) => p.component_ref === ca.station_profile_unique_marked_profile_ref),
        bm = profiles(b).filter((p: R) => p.component_ref === cb.station_profile_unique_marked_profile_ref),
        ia = am.length === 1 ? bandIndex(a, am[0]!) : null, ib = bm.length === 1 ? bandIndex(b, bm[0]!) : null;
      item.slot_delta = ia !== null && ib !== null ? ib - ia : null;
      this.input_effects.push(item); this.input_effects = this.input_effects.slice(-64);
    }
    if (effect.mode_toggle) {
      const signature = modeSignature(ca), ref = 'mode_method:' + digest([signature, command]);
      let method = this.mode_methods.find(m => m.ref === ref);
      if (!method) { method = { ref, signature, action: copy(command), contrasts: [], law_status: 'observed_mode_toggle; new_scope_requires_probe' }; this.mode_methods.push(method); }
      method.contrasts.push({ change: [ca.station_profile_inner_singleton_count, cb.station_profile_inner_singleton_count], evidence, source_epoch: before.level_epoch });
      method.contrasts = method.contrasts.slice(-8);
    }
    const extension = proposal?.workshop_plan?.extension ?? null;
    if (extension?.kind === 'revalidate_mode' && !effect.mode_toggle) this.method_refutations.push([extension.method_ref, before.level_epoch]);
    if (extension?.kind === 'access_prepared_receiver') {
      const preserved = ca.station_profile_inner_singleton_count === 1 && cb.station_profile_inner_singleton_count === 1
        && equal(ca.station_profile_marked_profile_heights ?? null, cb.station_profile_marked_profile_heights ?? null)
        && equal(profileMultiset(a), profileMultiset(b));
      if (!(effect.marker_moved && preserved)) {
        this.method_refutations.push([extension.method_ref, before.level_epoch]);
        this.events.push({ status: 'current_held_direction_refuted', method_ref: extension.method_ref, evidence, scope: before.level_epoch });
      }
    }
    const pa = profiles(a).filter((p: R) => p.component_ref === ca.station_profile_unique_marked_profile_ref),
      pb = profiles(b).filter((p: R) => p.component_ref === cb.station_profile_unique_marked_profile_ref);
    if (extension && (extension.kind === 'probe_transform' || extension.obligation === 'transform') && pa.length === 1 && pb.length === 1 && !effect.marker_moved) {
      const previous = [...pa[0]!.profile.stem_relief_rank_height_pixels], obtained = [...pb[0]!.profile.stem_relief_rank_height_pixels],
        othersBefore = profiles(a).filter((p: R) => p.component_ref !== pa[0]!.component_ref).map((p: R) => [p.bbox, p.profile.stem_relief_rank_height_pixels]).sort(compare),
        othersAfter = profiles(b).filter((p: R) => p.component_ref !== pb[0]!.component_ref).map((p: R) => [p.bbox, p.profile.stem_relief_rank_height_pixels]).sort(compare),
        preserved = equal(othersBefore, othersAfter) && !effect.receiver_changed,
        models = preserved ? relations(previous, obtained, second.length) : [];
      this.operator_observations.push({ support: extension.support, action: copy(command), before_profile: previous, after_profile: obtained,
        models, evidence, source_epoch: before.level_epoch, status: models.length ? 'observed_pair_with_conditional_models' : 'no_identified_transform',
        other_profiles_and_receivers_preserved: preserved, global_domain_known: false });
      this.operator_observations = this.operator_observations.slice(-32);
    }
    if (equal(withoutSingleton(ca), withoutSingleton(cb)) && ((ca.station_profile_inner_singleton_count === 0 && cb.station_profile_inner_singleton_count === 1)
      || (ca.station_profile_inner_singleton_count === 1 && cb.station_profile_inner_singleton_count === 0))) {
      this.mode_evidence = [{ action: copy(command), evidence, same_profiles_and_marker_position: true,
        observed_change: [ca.station_profile_inner_singleton_count, cb.station_profile_inner_singleton_count] }];
    }
    if (proposal && Object.hasOwn(proposal, 'workshop_plan')) {
      const changed = !equal(stableContext(ca), stableContext(cb));
      if (!changed) this.rejected.push([proposal.workshop_plan.rule_ref, proposal.workshop_plan.context_sha256]);
      const event = { status: changed ? 'current_geometric_effect' : 'no_discriminating_change', rule_ref: proposal.workshop_plan.rule_ref,
        evidence, before: stableContext(ca), after: stableContext(cb), universal_law_confirmed: false };
      this.events.push(event); return event;
    }
    return this.mode_evidence.length && this.mode_evidence.at(-1)!.evidence.at(-1) === after.observation_ref
      ? { status: 'mode_marker_contrast', evidence: this.mode_evidence.at(-1)!.evidence } : null;
  }
  record(before: NativeObservation, after: NativeObservation, command: NativeCommand, first: NativeRows, second: NativeRows,
    proposal: R, index: number, _frames: readonly NativeRows[]): NativeRecordResult {
    return { events: [this.recordSource(before, after, command, first, second, proposal, index)] };
  }
}
