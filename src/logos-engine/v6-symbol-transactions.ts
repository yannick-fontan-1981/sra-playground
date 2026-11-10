/**
 * Pinned V6 SymbolTransactions: one material owner, an observed guide or a
 * revalidated acquired interface, and active returns only. Neither a proposal
 * nor its OP18 receipt establishes a symbol role or predicts its effect.
 * Source: morphology_policy/symbol_transactions/family.py at 786dcf51.
 */
import { NativeDrmRegistry, factConditionHolds } from './v6-drm-projector.ts';
import type { DrmCondition, NativeLoadedDrm } from './v6-drm-projector.ts';
import { NativeSrcProgram, V6_DECLARATIVE_SOURCES } from './v6-src-program.ts';
import { symbolicDigest as digest } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truthy } from './v6-operations.ts';
import { compareUnicode, isJsonObject } from './canonical.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { Interface } from './v6-symbol-interface.ts';
import { frame, project, measureDiagramTransition } from './v6-symbol-transactions-geometry.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';
import type { JsonObject, Primitive } from './ir.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeCommand, NativeFamily, NativeObservation,
  NativeProgramHandle, NativeProgramRegistry, NativeProposal, NativePublicObservation, NativeRecord,
  NativeRecordResult, NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const LOCAL = 'agents/yf_arc3_v6/morphology_policy/symbol_transactions/transactions.drm';
const WORKFLOW = 'v6.symbol_transactions.choose';
const FORMAT = 'native.public_symbol_transaction.v1';
const FIELDS = ['epoch', 'rejected', 'events', 'transition_count', 'interface_state'] as const;
const INTERFACE_FIELDS = ['epoch', 'samples', 'contrasts', 'methods', 'refutations', 'bound'] as const;
const copy = <T>(value: T): T => structuredClone(value);

export function holds(conditions: readonly R[], facts: R): boolean {
  return conditions.every(condition => factConditionHolds(condition as DrmCondition, facts));
}

/** The pinned templates use scalar named format_map fields. One replacement
 * pass preserves braces inside a candidate reference; dictionary keys are not
 * substituted. Unsupported format syntax is refused rather than reinterpreted.
 */
export function substitute(value: any, bindings: R): any {
  if (typeof value === 'string') {
    let result = '';
    for (let i = 0; i < value.length;) {
      const ch = value[i];
      if ((ch === '{' || ch === '}') && value[i + 1] === ch) { result += ch; i += 2; continue; }
      if (ch === '}') throw new TypeError('Unmatched symbol template closing brace');
      if (ch !== '{') { result += ch; i++; continue; }
      const end = value.indexOf('}', i + 1), name = value.slice(i + 1, end);
      if (end < 0 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || !Object.hasOwn(bindings, name)) {
        throw new TypeError('Outside declared symbol template binding');
      }
      const item = bindings[name];
      if (item === null) result += 'None';
      else if (typeof item === 'boolean') result += item ? 'True' : 'False';
      else if (typeof item === 'string' || typeof item === 'number' && Number.isSafeInteger(item)) result += String(item);
      else throw new TypeError('Outside declared scalar symbol template value');
      i = end + 1;
    }
    return result;
  }
  if (Array.isArray(value)) return value.map(item => substitute(item, bindings));
  if (isJsonObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, substitute(item, bindings)]));
  return value;
}

function compare(left: any, right: any): number {
  if (Array.isArray(left) && Array.isArray(right)) {
    for (let i = 0; i < Math.min(left.length, right.length); i++) { const result = compare(left[i], right[i]); if (result) return result; }
    return left.length - right.length;
  }
  if (equal(left, right)) return 0;
  if (typeof left === 'string' && typeof right === 'string') return compareUnicode(left, right);
  if (['number', 'boolean'].includes(typeof left) && ['number', 'boolean'].includes(typeof right)) return Number(left) < Number(right) ? -1 : 1;
  throw new TypeError('Symbol interface costs require the declared comparable fields');
}

/** Native ingress validation is separate from the source's partial restore.
 * It introduces no acquired fields, trims no additional history, and validates
 * the entire supplied tree before changing either owner or nested interface.
 */
function validateState(value: R): R {
  const state = retainNativeJson(value), nested = state.interface_state;
  if (Object.keys(state).length !== FIELDS.length || FIELDS.some(key => !Object.hasOwn(state, key))
    || state.epoch !== null && !Number.isSafeInteger(state.epoch)
    || !Number.isSafeInteger(state.transition_count) || state.transition_count < 0
    || !Array.isArray(state.rejected) || !state.rejected.every((item: unknown) => typeof item === 'string')
    || !Array.isArray(state.events) || !state.events.every(isJsonObject)
    || !isJsonObject(nested) || Object.keys(nested).length !== INTERFACE_FIELDS.length
    || INTERFACE_FIELDS.some(key => !Object.hasOwn(nested, key))
    || nested.epoch !== null && !Number.isSafeInteger(nested.epoch)
    || ['samples', 'contrasts', 'methods', 'refutations'].some(key => !Array.isArray(nested[key]) || !nested[key].every(isJsonObject))
    || nested.bound !== null && !isJsonObject(nested.bound)) {
    throw new TypeError('Incompatible symbol-transactions source state');
  }
  return state;
}

export class SymbolTransactions implements NativeFamily<any> {
  readonly id = 'public_symbol_transaction';
  readonly loaded: NativeLoadedDrm;
  readonly config: R;
  readonly registry: NativeDrmRegistry;
  readonly interface: Interface;
  epoch: number | null = null;
  rejected: string[] = [];
  events: R[] = [];
  transition_count = 0;
  src_calls = 0;
  selected: R | null = null;
  measured: R = {};
  observation: R = {};
  private program!: NativeProgramHandle;
  private readonly callbacks: Readonly<Record<string, Primitive>>;
  private checkpoint: R | null = null;
  private revision = 0;

  private constructor(registry: NativeDrmRegistry, loaded: NativeLoadedDrm) {
    this.registry = registry; this.loaded = loaded;
    const config = loaded.document.declarations[0]?.configuration;
    if (!config) throw new TypeError('Missing symbol transactions configuration');
    this.config = retainNativeJson(config);
    this.interface = new Interface(this.config, holds);
    this.callbacks = Object.freeze({
      'symbols.measure': args => this.measure(args.request as R) as JsonObject,
      'symbols.select': args => this.select(args.measured as R) as JsonObject,
    });
  }
  static async create(): Promise<SymbolTransactions> {
    const source = (V6_DECLARATIVE_SOURCES as R)[LOCAL];
    if (!source) throw new TypeError('Missing original symbol transactions DRM');
    const registry = new NativeDrmRegistry(), loaded = await registry.registerSource(source.text, source.sha256);
    registry.seal();
    const owner = new SymbolTransactions(registry, loaded);
    owner.program = await NativeSrcProgram.create(WORKFLOW, owner.callbacks); return owner;
  }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> {
    this.program = await registry.registerProgram(WORKFLOW, this.callbacks);
  }
  get nativeRevision(): number { this.nativeState(); return this.revision; }
  state(): R {
    return copy({ epoch: this.epoch, rejected: this.rejected.slice(-32), events: this.events.slice(-32),
      transition_count: this.transition_count, interface_state: this.interface.state() });
  }
  sourceState(): R { return this.state(); }
  nativeState(): NativeRecord {
    const source = validateState(this.state());
    if (this.checkpoint && equal(this.checkpoint.source_state, source)) return this.checkpoint;
    this.checkpoint = retainNativeJson({ format: FORMAT, source_state: source }); this.revision++; return this.checkpoint;
  }
  restore(value: NativeRecord): void {
    if (!isJsonObject(value)) throw new TypeError('Symbol-transactions restore requires a source state mapping');
    // A partial source restore must retain the full live rejection ledger;
    // state() is its bounded export and is not the live source value.
    const merged = { epoch: this.epoch, rejected: this.rejected, events: this.events, transition_count: this.transition_count,
      interface_state: this.interface.state(),
      ...Object.fromEntries(FIELDS.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]])) };
    if (Object.hasOwn(value, 'interface_state')) {
      if (!isJsonObject(value.interface_state)) throw new TypeError('Symbol interface restore requires a source state mapping');
      merged.interface_state = { ...this.interface.state(), ...Object.fromEntries(INTERFACE_FIELDS
        .filter(key => Object.hasOwn(value.interface_state as object, key)).map(key => [key, (value.interface_state as R)[key]])) };
    }
    const next = validateState(merged);
    this.interface.restore(copy(next.interface_state));
    for (const key of FIELDS) if (key !== 'interface_state') (this as unknown as R)[key] = copy(next[key]);
    this.clearTransient();
  }
  restoreNative(value: Readonly<NativeRecord>): void {
    if (value === this.checkpoint && equal(this.state(), this.checkpoint!.source_state)) { this.clearTransient(); return; }
    const supplied = retainNativeJson(value);
    if (!isJsonObject(supplied) || supplied.format !== FORMAT || Object.keys(supplied).length !== 2 || !isJsonObject(supplied.source_state)) {
      throw new TypeError('Invalid native symbol-transactions checkpoint');
    }
    const next = validateState(supplied.source_state), changed = !this.checkpoint || !equal(this.checkpoint.source_state, next);
    this.interface.restore(copy(next.interface_state));
    for (const key of FIELDS) if (key !== 'interface_state') (this as unknown as R)[key] = copy(next[key]);
    this.checkpoint = supplied; if (changed) this.revision++;
    this.clearTransient();
  }
  private clearTransient(): void { this.selected = null; this.measured = {}; this.observation = {}; }
  scope(obs: R): void {
    if (!equal(this.epoch, obs.level_epoch)) { this.epoch = obs.level_epoch; this.rejected = []; this.transition_count = 0; }
  }
  measure(_request: R): R { return this.measured; }
  select(measured: R): R {
    // SRC arguments are immutable native values. Python adds alternative rows
    // to the nested selected offer, so give that local projection owned input.
    measured = copy(measured);
    let offers: R[] = [];
    const usingInterface = measured.mode === 'interface';
    for (const option of measured.options) {
      const facts = { ...this.config.initial_facts, ...option.facts }, rules: string[] = [];
      for (const rule of this.config[usingInterface ? 'interface_projection_rules' : 'projection_rules']) {
        if (holds(rule.all_conditions, facts)) {
          Object.assign(facts, copy(rule.static_facts), substitute(rule.templated_facts ?? {}, { candidate_ref: option.point_entity.id }));
          rules.push(rule.id);
        }
      }
      const key = digest([this.observation.frame_hash, option.action]);
      if (holds(this.config[usingInterface ? 'interface_candidate_admission' : 'candidate_admission'], facts) && !this.rejected.includes(key)) {
        offers.push({ ...option, conclusions: facts, rules, rejection_key: key });
      }
    }
    if (usingInterface && offers.length) {
      const order: string[] = this.config.interface_choice_order;
      if (offers.some(offer => !order.includes(offer.facts.offer_kind))) throw new TypeError('Symbol interface offer kind is absent from source choice_order');
      const rank = Math.min(...offers.map(offer => order.indexOf(offer.facts.offer_kind)));
      offers = offers.filter(offer => order.indexOf(offer.facts.offer_kind) === rank);
      const fields: string[] = this.config.interface_choice_fields, cost = offers.map(offer => fields.map(key => offer.facts[key])).sort(compare)[0];
      offers = offers.filter(offer => equal(fields.map(key => offer.facts[key]), cost));
    }
    // Map has Python dict-comprehension semantics: first key position, last value.
    const grouped = new Map<string, R>();
    for (const offer of offers) grouped.set(digest(offer.action), offer);
    for (const [key, item] of grouped) if (Object.hasOwn(item, 'interface_offer')) {
      item.interface_offer.alternative_displayed_rows = offers.filter(offer => digest(offer.action) === key)
        .map(offer => offer.interface_offer.displayed_row ?? null);
    }
    this.selected = grouped.size === 1 ? grouped.values().next().value! : null;
    return { selected: this.selected !== null, alternatives: grouped.size };
  }
  async proposeSource(obs: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    this.scope(obs); if (remaining < 1) return null;
    let measured: R | null = project(obs, rows, inputs, this.config, this.transition_count);
    if (!truthy(measured) || !holds(this.config.activation, measured!.context)) {
      const options = this.interface.options(obs, rows, inputs, remaining);
      if (!options.length) return null;
      measured = { mode: 'interface', context: {}, options };
    }
    this.measured = measured!; this.observation = obs; this.src_calls++;
    const { result, receipt } = await this.program.run({ request: { observation_ref: obs.observation_ref } });
    if (!isJsonObject(result)) throw new TypeError('Symbol transactions SRC returned no mapping');
    if (!result.selected) return null;
    const selected = this.selected!, entity = selected.entities[0], action = copy(selected.action), facts = { symbol_transaction_current_bound: true };
    const usingInterface = measured!.mode === 'interface', question = this.config[usingInterface ? 'interface_question' : 'question'],
      hypotheses = this.config[usingInterface ? 'interface_hypotheses' : 'hypotheses'];
    const focus = 'composition:symbol_transaction:' + digest([obs.observation_ref, action]),
      evidence = [...new Set([obs.observation_ref, ...(selected.interface_offer?.evidence ?? [])])];
    const workflow = { workflow: receipt.workflow, src_hash: receipt.src_hash, src_status: receipt.src_status, executed_statements: receipt.executed_statements };
    const plan = { interface_offer: copy(selected.interface_offer ?? null), mode: measured!.mode ?? 'guide', measured_facts: selected.facts,
      conclusions: selected.conclusions, rule_refs: selected.rules, entity_ref: entity.id, entity_signature: entity.signature,
      rejection_key: selected.rejection_key, workflow, drm_sha256: this.loaded.source_hash, origin_drm_sha256: this.config.origin_drm_sha256,
      hypotheses, expected_effect: this.config.expected_effect, falsifiers: this.config.falsifiers,
      authority: 'current_revisable_experiment_not_acquired_role', preserve: this.config.preserve, effect_status: 'unknown_until_sealed_observation' };
    const pointEntity = selected.point_entity;
    const pointBinding = { observation_ref: obs.observation_ref, entity_ref: pointEntity.id, signature: pointEntity.signature, bbox: pointEntity.bbox,
      level_epoch: obs.level_epoch, frame_hash: obs.frame_hash, point: [action.data.x, action.data.y], palette_value: pointEntity.palette_value,
      source: 'measured_current_symbol_interface_point' };
    return { status: 'proposed', kind: this.id, actions: [action], steps: [{ action,
      expected_before: { level_epoch: obs.level_epoch, frame_hash: obs.frame_hash }, expected_after: null, point_binding: pointBinding }], facts,
      binding: Object.fromEntries(['observation_ref', 'level_epoch', 'levels_completed', 'frame_hash'].map(key => [key, obs[key]])),
      symbol_transaction_plan: plan, compositions: [{ id: focus, role: this.config.composition_role, observed: false, things: [entity.id],
        properties: { target: selected.conclusions.active_goal_ref, conditional: true, hypotheses, falsifiers: this.config.falsifiers,
          roles_remain_revisable: true, interface_dependency: copy(selected.interface_offer ?? null) },
        relations: ['contributes_to:' + this.config.goal], open_question: question }],
      question: { reason: question, hypothesis_refs: hypotheses }, route_refs: evidence,
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: this.config.goal, purpose: question,
        preconditions: facts, evidence, actions: [action], preserve_refs: [], preservation_evidence: {}, outcome_guard: { path: ['value'], contains: focus } } };
  }
  async propose(obs: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    return this.proposeSource(obs, rows, inputs, remaining);
  }
  async proposeInSubquestion(group: string, question: string, obs: NativeObservation, rows: NativeRows,
    inputs: readonly NativeCommand[], remaining: number): Promise<NativeProposal | null> {
    if (group !== 'factored_material_return' || question !== 'observed_symbol_transaction') throw new TypeError('Unknown symbol transactions source entry');
    const proposal = await this.propose(obs, rows, inputs, remaining);
    if (proposal) proposal.material_access_subquestion = question; return proposal;
  }
  bind(proposal: R, domain?: ObservedInputDomain | null): void {
    if (proposal.actions.length !== 1 || !equal(proposal.actions, proposal.steps.map((step: R) => step.action))
      || proposal.steps.some((step: R) => !Object.hasOwn(step, 'expected_after') || !Object.hasOwn(step.point_binding ?? {}, 'entity_ref'))) {
      throw new TypeError('Unbound symbol transaction probe');
    }
    if (domain != null) domain.bindProposal(proposal as any);
  }
  before(proposal: R, index: number, publicPacket: NativePublicObservation, obs: NativeObservation): NativeBeforeResult {
    let ok = index === 0 && ['observation_ref', 'level_epoch', 'levels_completed', 'frame_hash'].every(key => equal(obs[key], proposal.binding[key]))
      && publicPacket.frame_hash === proposal.binding.frame_hash && publicPacket.level === proposal.binding.level_epoch
      && publicPacket.available_action_refs.includes(proposal.actions[0].action_ref);
    if (ok) {
      let options: R[];
      const plan = proposal.symbol_transaction_plan;
      if (plan.mode === 'interface') {
        options = this.interface.options(obs, publicPacket.frame_rows, proposal.actions, 1)
          .filter((option: R) => digest(option.facts) === digest(plan.measured_facts));
      } else {
        const measured = project(obs, publicPacket.frame_rows, proposal.actions, this.config, this.transition_count);
        options = truthy(measured) ? measured!.options : [];
      }
      ok = options.length > 0 && options.every(option => equal(option.action, proposal.actions[0]) && equal(option.entities, options[0]!.entities))
        && options[0]!.entities.length === 1 && options[0]!.entities[0].id === plan.entity_ref && options[0]!.entities[0].signature === plan.entity_signature
        && digest(options[0]!.facts) === digest(plan.measured_facts);
    }
    return { admitted: Boolean(ok), reason: ok ? 'current_symbol_frame_and_exact_discriminating_input' : 'symbol_frame_binding_changed' };
  }
  after(_proposal: R, _index: number, _before: NativeObservation, _after: NativeObservation, _first: NativeRows, _second: NativeRows): NativeAfterResult {
    return { matched: null, seal_prefix: true, reason: 'unknown_interaction_requires_sealed_observation' };
  }
  recordSource(before: NativeObservation, after: NativeObservation, command: R, first: NativeRows, second: NativeRows,
    proposal: R | null = null, index = 0): R | null {
    if (!truthy(proposal) || !Object.hasOwn(proposal!, 'symbol_transaction_plan')) return null;
    this.scope(before);
    if (!equal(proposal!.actions[index], command)) return { status: 'command_proposal_mismatch', evidence: [before.observation_ref] };
    const evidence = [before.observation_ref, after.observation_ref],
      interfaceEvent = this.interface.record(before, after, command, first, second, proposal!);
    let event: R;
    if (!equal(before.level_epoch, after.level_epoch)) {
      event = { status: 'official_boundary', evidence, acquired_roles: false }; this.scope(after);
    } else {
      let changed = 0;
      for (let y = 0; y < Math.min(first.length, second.length); y++) {
        for (let x = 0; x < Math.min(first[y]!.length, second[y]!.length); x++) if (!equal(first[y]![x], second[y]![x])) changed++;
      }
      const matches = changed ? measureDiagramTransition(frame(first), frame(second)) : 0;
      this.transition_count += matches;
      if (!changed) this.rejected.push(proposal!.symbol_transaction_plan.rejection_key);
      event = { status: changed ? 'observed_change_requires_role_reconciliation' : 'no_discriminating_change', evidence, action: copy(command),
        changed_pixels: changed, diagram_operand_removal_result_appearance_matches: matches,
        conclusions_before: copy(proposal!.symbol_transaction_plan.conclusions), hypotheses: copy(proposal!.symbol_transaction_plan.hypotheses),
        preservation_status: changed ? 'unknown_until_typed_role_acquisition' : 'all_pixels_preserved', universal_law_confirmed: false, source_epoch: before.level_epoch };
    }
    event.interface_event = interfaceEvent; this.events.push(event); this.events = this.events.slice(-32); return event;
  }
  record(before: NativeObservation, after: NativeObservation, command: NativeCommand, first: NativeRows, second: NativeRows,
    proposal: R, index: number, _frames: readonly NativeRows[]): NativeRecordResult {
    return { events: [this.recordSource(before, after, command, first, second, proposal, index)] };
  }
}
