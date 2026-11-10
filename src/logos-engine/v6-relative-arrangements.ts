/** Native transfer of V6 relative_arrangements/family.py at
 * 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. Acquisition is selected-only. */
import { canonical } from './canonical.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';
import { NativeSrcProgram, V6_DECLARATIVE_SOURCES, type NativeSrcReceipt } from './v6-src-program.ts';
import { relativeArrangementEffect, relativeArrangementProject, translatedRelativeArrangementTargets,
  type RelativeArrangementLayout, type RelativeArrangementModel } from './v6-relative-arrangements-geometry.ts';
import { relativeArrangementOptions, relativeArrangementTrialKey, type RelativeArrangementConfiguration,
  type RelativeArrangementOffer, type RelativeArrangementTrial } from './v6-relative-arrangements-planner.ts';
import type { JsonObject, JsonValue } from './ir.ts';
import type { NativeCommand, NativeObservation, NativeProgramHandle, NativeProgramRegistry, NativeProposal,
  NativePublicObservation, NativeRecord, NativeRows } from './v6-native-types.ts';

interface RelativeArrangementStep extends NativeRecord {
  action: NativeCommand; expected_before: { level_epoch: number; frame_hash: string }; expected_after: null;
  point_binding: { observation_ref: string; entity_ref: string; signature: string; bbox: number[];
    level_epoch: number; frame_hash: string; point: [number, number]; palette_value: number;
    source: 'measured_arrangement_participant_or_actuator' };
}
export interface RelativeArrangementProposal extends NativeProposal {
  status: 'proposed'; kind: 'public_relative_arrangement'; actions: NativeCommand[]; steps: RelativeArrangementStep[];
  facts: Record<string, boolean>; binding: { observation_ref: string; level_epoch: number; levels_completed: number; frame_hash: string };
  arrangement_plan: { offer: RelativeArrangementOffer; projection: RelativeArrangementLayout;
    workflow: Pick<NativeSrcReceipt, 'workflow' | 'src_hash' | 'src_status' | 'executed_statements'>; question: string };
  compositions: NativeRecord[]; question: { reason: string; hypothesis_refs: string[] }; route_refs: string[];
  bundle_template: { operation_key: string; composition_ref: string; objective_ref: string; preserve_refs: string[];
    purpose: string; preconditions: Record<string, boolean>; evidence: string[]; actions: NativeCommand[];
    outcome_guard: { path: string[]; contains: string } };
}
export interface RelativeArrangementState extends NativeRecord {
  models: RelativeArrangementModel[]; events: NativeRecord[]; failed: RelativeArrangementTrial[];
  selection_ref: string | null; epoch: number | null;
}
const equal = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);
const clone = <T>(value: T): T => structuredClone(value);
const json = (value: unknown): JsonValue => value as JsonValue;

export class RelativeArrangements {
  readonly id = 'relative_arrangements';
  readonly configuration: RelativeArrangementConfiguration;
  private src: Promise<NativeProgramHandle>;
  private models: RelativeArrangementModel[] = [];
  private events: NativeRecord[] = [];
  private failed = new Set<string>();
  private selection_ref: string | null = null;
  private epoch: number | null = null;
  private context: { obs: NativeObservation; rows: NativeRows; inputs: readonly NativeCommand[]; remaining: number } | null = null;
  private picked: RelativeArrangementOffer | null = null;
  /** Source diagnostics are transient and are recomputed by the next proposal. */
  last_layout: RelativeArrangementLayout | null = null;
  last: { status: 'conditional_offer' | 'no_bound_geometric_experiment'; alternatives: number } | null = null;

  constructor() {
    const source = (V6_DECLARATIVE_SOURCES as unknown as Record<string, { text: string }>)['agents/yf_arc3_v6/morphology_policy/relative_arrangements/relative_arrangements.drm']!;
    this.configuration = JSON.parse(source.text).declarations[0].configuration as RelativeArrangementConfiguration;
    this.src = NativeSrcProgram.create('v6.relative_arrangements.choose', this.callbacks());
  }
  private callbacks() {
    return {
      'arrangement.measure': (_args: JsonObject) => json(this.measure()),
      'arrangement.compose': (args: JsonObject) => json(this.compose(args.measured as unknown as { qualified: boolean; remaining: number })),
      'arrangement.bind': (args: JsonObject) => json(this.select(args.composed as unknown as { options: RelativeArrangementOffer[] })),
    };
  }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> {
    this.src = registry.registerProgram('v6.relative_arrangements.choose', this.callbacks()); await this.src;
  }
  private measure(): { qualified: boolean; remaining: number } {
    const { obs, rows, remaining } = this.context!;
    if (this.epoch !== obs.level_epoch) {
      this.models = []; this.failed = new Set(); this.selection_ref = null; this.epoch = obs.level_epoch;
    }
    this.last_layout = relativeArrangementProject(obs, rows);
    return { qualified: this.last_layout !== null, remaining };
  }
  private compose(measured: { qualified: boolean; remaining: number }): { options: RelativeArrangementOffer[] } {
    if (!measured.qualified || measured.remaining < 1) return { options: [] };
    return { options: relativeArrangementOptions(this.last_layout!, translatedRelativeArrangementTargets(this.last_layout!),
      this.models, this.selection_ref, this.failed, this.configuration) };
  }
  private select(composed: { options: RelativeArrangementOffer[] }): { selected: boolean } {
    this.last = { status: composed.options.length ? 'conditional_offer' : 'no_bound_geometric_experiment', alternatives: composed.options.length };
    this.picked = composed.options[0] ?? null;
    return { selected: this.picked !== null };
  }
  /** The caller reads this only after a null offer. A recognized layout still
   * stops the source window chain if ACTION6 or a unique support is missing. */
  recognizedCurrentInterface(obs: NativeObservation): boolean {
    const layout = this.last_layout;
    return layout !== null && layout.observation_ref === obs.observation_ref
      && layout.level_epoch === obs.level_epoch && layout.frame_hash === obs.frame_hash;
  }
  async propose(obs: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number): Promise<RelativeArrangementProposal | null> {
    this.context = { obs, rows, inputs, remaining };
    const { result, receipt } = await (await this.src).run({ request: { observation_ref: obs.observation_ref } });
    const answer = result as unknown as { selected: boolean };
    if (!answer.selected || !obs.available_action_refs.includes('ACTION6')) return null;
    const offer = this.picked!, [x, y] = offer.point, action: NativeCommand = { action_ref: 'ACTION6', data: { x, y } };
    const focus = `composition:relative_arrangement:${identity([obs.observation_ref, offer.goal.target]).slice(0, 20)}`;
    const supports = obs.entities.filter(entity => entity.bbox[0] <= x && x <= entity.bbox[2] && entity.bbox[1] <= y && y <= entity.bbox[3]
      && entity.mask.some(([mx, my]) => mx === x - entity.position[0] && my === y - entity.position[1]));
    if (supports.length !== 1) return null;
    const support = supports[0]!, refs = [obs.observation_ref, ...offer.model_evidence];
    const facts = { relative_model_current: true, actuator_experiment_current: true };
    const workflow = { workflow: receipt.workflow, src_hash: receipt.src_hash, src_status: receipt.src_status, executed_statements: receipt.executed_statements };
    const plan = { offer, projection: this.last_layout!, workflow, question: this.configuration.question };
    return { status: 'proposed', kind: 'public_relative_arrangement', actions: [action],
      steps: [{ action, expected_before: { level_epoch: obs.level_epoch, frame_hash: obs.frame_hash }, expected_after: null,
        point_binding: { observation_ref: obs.observation_ref, entity_ref: support.id, signature: support.signature, bbox: [...support.bbox],
          level_epoch: obs.level_epoch, frame_hash: obs.frame_hash, point: [x, y], palette_value: rows[y]![x]!,
          source: 'measured_arrangement_participant_or_actuator' } }],
      facts, binding: { observation_ref: obs.observation_ref, level_epoch: obs.level_epoch, levels_completed: obs.levels_completed, frame_hash: obs.frame_hash },
      arrangement_plan: plan,
      compositions: [{ id: focus, role: 'information_question', observed: false, things: ['measured_participants', 'visible_relative_model', 'current_actuator'],
        properties: { target: offer.goal.target, assumptions: offer.assumptions, risks: offer.risks, falsifiers: offer.falsifiers },
        relations: ['contributes_to:G_official_completion'], open_question: this.configuration.question }],
      question: { reason: this.configuration.question, hypothesis_refs: refs }, route_refs: refs,
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion', preserve_refs: [],
        purpose: this.configuration.question, preconditions: facts, evidence: refs, actions: [action], outcome_guard: { path: ['value'], contains: focus } } };
  }
  bind(proposal: RelativeArrangementProposal, _domain: ObservedInputDomain): void {
    // Source loci already carry measured pixels and full scope; no point repair.
    if (proposal.actions.length !== proposal.steps.length) throw new Error('Unbound arrangement point');
    for (let index = 0; index < proposal.actions.length; index++) {
      const action = proposal.actions[index]!, step = proposal.steps[index]!;
      if (!equal(step.point_binding.point, [action.data.x, action.data.y])) throw new Error('Unbound arrangement point');
    }
  }
  before(proposal: RelativeArrangementProposal, index: number, publicPacket: NativePublicObservation, obs: NativeObservation) {
    const bound = proposal.binding, action = proposal.actions[index]!, step = proposal.steps[index]!, plan = proposal.arrangement_plan, point = action.data;
    const scope = publicPacket.level === bound.level_epoch && publicPacket.levels_completed === bound.levels_completed
      && publicPacket.frame_hash === bound.frame_hash && obs.observation_ref === bound.observation_ref;
    const ok = scope && equal(action, step.action) && publicPacket.available_action_refs.includes(action.action_ref)
      && equal([point.x, point.y], plan.offer.point) && publicPacket.frame_rows[point.y!]![point.x!] === step.point_binding.palette_value;
    return { admitted: ok, reason: ok ? 'current_arrangement_and_control_locus' : 'arrangement_or_control_scope_changed' };
  }
  after(_proposal: RelativeArrangementProposal, _index: number, _before: NativeObservation, _after: NativeObservation,
    _first: NativeRows, _second: NativeRows) {
    return { matched: null, seal_prefix: true, reason: 'measure_selected_participant_and_actuator_effect' };
  }
  record(before: NativeObservation, after: NativeObservation, command: NativeCommand, _first: NativeRows, second: NativeRows,
    proposal: RelativeArrangementProposal, index: number): NativeRecord {
    if (!equal(command, proposal.actions[index]) || before.observation_ref !== proposal.binding.observation_ref) throw new Error('Unbound arrangement response');
    const plan = proposal.arrangement_plan, old = plan.projection, next = relativeArrangementProject(after, second);
    let event: NativeRecord;
    if (after.levels_completed > before.levels_completed) event = { status: 'official_boundary', hypothesis: plan.offer.goal.target,
      evidence: [before.observation_ref, after.observation_ref] };
    else {
      event = relativeArrangementEffect(old, next, command);
      if (event.status === 'selection_observed') this.selection_ref = after.observation_ref;
      if (event.status === 'single_object_and_actuator_displacement') {
        event.selection_ref = this.selection_ref;
        // The source model copy precedes the event's expected/risks additions.
        this.models.push(clone(event) as RelativeArrangementModel);
      } else if (plan.offer.trial) this.failed.add(relativeArrangementTrialKey(plan.offer.trial));
    }
    event.expected = plan.offer.predictions; event.risks = plan.offer.risks; this.events.push(event); return event;
  }
  state(): RelativeArrangementState {
    // Python serializes an unordered set here. Native transport gives just this
    // field a deterministic order; no source planning consumer observes it.
    return clone({ models: this.models, events: this.events, failed: [...this.failed].sort().map(key => JSON.parse(key) as RelativeArrangementTrial),
      selection_ref: this.selection_ref, epoch: this.epoch });
  }
  restore(state: NativeRecord): void {
    if (!Array.isArray(state.models) || !Array.isArray(state.events) || !Array.isArray(state.failed)
      || !(state.selection_ref === null || typeof state.selection_ref === 'string')
      || !(state.epoch === null || typeof state.epoch === 'number')) throw new TypeError('Invalid relative-arrangement memory');
    this.models = clone(state.models) as RelativeArrangementModel[]; this.events = clone(state.events) as NativeRecord[];
    this.failed = new Set((state.failed as RelativeArrangementTrial[]).map(relativeArrangementTrialKey));
    this.selection_ref = state.selection_ref; this.epoch = state.epoch;
    // Source restore leaves transient layout/diagnostics untouched. A fresh
    // restored owner has no recognized interface until measure runs again.
  }
}
