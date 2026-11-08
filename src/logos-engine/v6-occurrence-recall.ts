/**
 * Native public-occurrence entry point from common_occurrence_recall.py and
 * occurrence_recall_access.py, source 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 *
 * This is the recall capability of the shared series memory. It does not claim
 * to implement every other provider inherited by ObservedCompositionConstraint.
 * The source's event reduction/digest layers are retained so recall snapshots
 * include their real observation memory rather than an unrelated display state.
 */
import { projection, rowsDigest } from './v6-native-observer.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';
import type { NativeFamily, NativePublicObservation, NativeRows, NativeProposal, NativeBeforeResult, NativeAfterResult } from './v6-native-types.ts';
import { pythonEqual } from './v6-operations.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { programIdentity } from './v6-program-identity.ts';
import { measureOccurrenceScene, occurrenceCandidates, occurrenceContextScope } from './v6-occurrence-scene.ts';
import type { OccurrenceRecord as R } from './v6-occurrence-scene.ts';
import { observeOccurrenceProgramPacket } from './v6-occurrence-program-observer.ts';

export interface OccurrenceRecallPolicy extends R {
  reference_families: readonly string[];
  comparison_families: readonly string[];
  minimum_unique_observations: Readonly<Record<'singleton_antecedent' | 'plural_antecedent', number>>;
  question: string;
  roles: readonly string[];
}

/** Exact retained ancestor event reducers; planning those providers is separate. */
class SeriesEventMemory {
  lineTrials: R = {}; lineGoals: R[] = [];
  insertSamples: R[] = []; insertOrders: R = {}; insertRejections = new Set<string>(); insertRefutedEpochs = new Set<number>();
  crossState: R | null = null; crossPairs: R[] = []; crossAxisInputs = new Map<number, Set<string>>([[0, new Set()], [1, new Set()]]); crossEvents: R[] = [];
  markedEvents: R[] = []; programEvents: R[] = [];
  programEditSamples: R[] = []; compositionModels: R[] = []; compositionContinuation: R | null = null;
  compositionRefutedEpochs = new Set<number>(); compositionEvents: R[] = []; respondentPending: R | null = null; requestedStopReason: string | null = null;
  respondentModels: R[] = []; respondentEvents: R[] = []; extensionRefusals: R[] = []; inputSupports: R[] = [];

  applyEvent(event: R): void {
    switch (event.kind) {
      case 'repeated_line_trial': this.lineTrials[event.trial] = event; break;
      case 'repeated_line_scored': this.lineGoals.push(event); break;
      case 'supported_insertion_observation': this.insertSamples.push(event); break;
      case 'supported_insertion_order': this.insertOrders[event.source] = event; break;
      case 'supported_line_refutation': this.insertRejections.add(event.trial); this.insertRefutedEpochs.add(event.epoch); break;
      case 'crossed_prefix_state': this.crossState = event.state; this.crossEvents.push(event); break;
      case 'crossed_prefix_pair': this.crossPairs.push(event); this.crossEvents.push(event); break;
      case 'crossed_prefix_input': {
        let inputs = this.crossAxisInputs.get(event.axis);
        if (!inputs) { inputs = new Set(); this.crossAxisInputs.set(event.axis, inputs); }
        inputs.add(event.action); this.crossEvents.push(event); break;
      }
      case 'marked_collection_result': this.markedEvents.push(event); break;
      case 'public_program_phase_alignment': this.programEvents.push(event); break;
      case 'program_edit_sample': this.programEditSamples.push(event); this.compositionEvents.push(event); break;
      case 'fitted_program_composition': this.compositionModels.push(event.model); this.compositionEvents.push(event); break;
      case 'program_composition_reconciled':
        this.compositionContinuation = event.continuation ?? null;
        if (event.refuted) this.compositionRefutedEpochs.add(event.epoch);
        this.compositionEvents.push(event); break;
      case 'respondent_probe_pending': this.respondentPending = event; this.compositionEvents.push(event); break;
      case 'respondent_probe_result':
        this.respondentPending = null; this.requestedStopReason = 'respondent_probe_observed_goal_model_open'; this.compositionEvents.push(event); break;
      case 'observed_respondent_order': this.respondentModels.push(event); this.respondentEvents.push(event); this.requestedStopReason = null; break;
      case 'respondent_composition_reconciled':
        this.compositionContinuation = event.continuation ?? null; this.respondentEvents.push(event);
        if (event.stop_reason) this.requestedStopReason = event.stop_reason;
        break;
      case 'exact_program_extension_refusal':
        this.extensionRefusals.push(event); this.respondentEvents.push(event); this.compositionRefutedEpochs.delete(event.epoch); break;
      case 'observed_input_support': this.inputSupports.push(event); this.respondentEvents.push(event); break;
      default: throw new TypeError(`Unexpected repeated-line event: ${String(event.kind)}`);
    }
  }

  retainedDigest(): string {
    let digest = identity([this.lineTrials, this.lineGoals]);
    digest = identity([digest, this.insertSamples, this.insertOrders, [...this.insertRejections].sort(), [...this.insertRefutedEpochs].sort((a, b) => a - b)]);
    digest = identity([digest, this.crossState, this.crossPairs,
      Object.fromEntries([...this.crossAxisInputs].map(([key, values]) => [key, [...values].sort()])), this.crossEvents]);
    digest = identity([digest, this.markedEvents, this.programEvents]);
    digest = programIdentity([digest, this.programEditSamples, this.compositionModels, this.compositionContinuation,
      [...this.compositionRefutedEpochs].sort((a, b) => a - b), this.compositionEvents, this.respondentPending, this.requestedStopReason]);
    return programIdentity([digest, this.respondentModels, this.respondentEvents, this.extensionRefusals, this.inputSupports]);
  }
}

export class OccurrenceRecallAccess extends SeriesEventMemory {
  recallCalibration: R | null = null; recallContext: R | null = null; recallEpoch: number | null = null;
  recallHistory: R = {}; recallSeen: R[] = []; recallModels: R = {}; recallBlocked: unknown[][] = []; recallEvents: R[] = [];

  override applyEvent(event: R): void {
    if (event.kind !== 'occurrence_recall_transition') { super.applyEvent(event); return; }
    this.recallEvents.push(event); this.recallCalibration = event.calibration; this.recallModels = event.models; this.recallEpoch = event.after_epoch;
    if (event.mode === 'boundary') {
      this.recallContext = null; this.recallHistory = {}; this.recallSeen = []; this.recallBlocked = [];
    } else if (event.mode === 'forward') {
      this.recallHistory[event.before_scene.key] = event.before_context;
      this.recallContext = { previous: event.before_scene, chosen: event.chosen, evidence_ref: event.before_scene.source_ref };
      this.recallSeen.push(...event.before_scene.occurrences);
    } else if (event.mode === 'restored') this.recallContext = event.restored_context;
    else this.recallBlocked.push([event.before_scene.key, event.command]);
  }

  override retainedDigest(): string {
    return identity([super.retainedDigest(), this.recallCalibration, this.recallContext, this.recallEpoch,
      this.recallHistory, this.recallSeen, this.recallModels, this.recallBlocked, this.recallEvents]);
  }

  recallQuestion(observation: R, rows: NativeRows, config: OccurrenceRecallPolicy): R | null {
    if (!observation.available_action_refs.includes('ACTION6')) return null;
    const scene = measureOccurrenceScene(rows, observation, this.recallCalibration);
    if (!scene || !scene.occurrences.length) return null;
    const context = this.recallEpoch === observation.level_epoch ? this.recallContext : null;
    const marked = (scene.occurrences as R[]).filter(part => part.marked), predictions: R[] = [], support: [string, string][] = [];
    let selected: R | null = null, reason: string | null = null;
    if (marked.length === 1) { selected = marked[0]!; reason = 'test_observed_enclosing_emphasis'; }
    else if (context === null && scene.occurrences.length === 1) {
      selected = scene.occurrences[0]; reason = 'test_unique_measured_occurrence';
    }
    if (context !== null) {
      const scope = occurrenceContextScope(context);
      for (const relation of config.reference_families) for (const comparison of config.comparison_families) {
        const key = `${scope}:${relation}:${comparison}`, predicted = occurrenceCandidates(scene, context, this.recallSeen, relation, comparison);
        const model: R = this.recallModels[key] ?? { unique_support: 0, counterexamples: [] };
        predictions.push({ model: key, candidates: predicted, unique_support: model.unique_support, counterexamples: model.counterexamples.length });
        if (predicted.length === 1 && model.unique_support >= config.minimum_unique_observations[scope] && !model.counterexamples.length) support.push([key, predicted[0]!]);
      }
      if (selected === null && support.length && new Set(support.map(item => item[1])).size === 1) {
        selected = (scene.occurrences as R[]).find(part => part.id === support[0]![1])!; reason = 'test_retained_occurrence_correspondence';
      }
    }
    if (selected === null) return null;
    const action = { action_ref: 'ACTION6', data: { x: selected.point[0], y: selected.point[1] } };
    if (this.recallBlocked.some(pair => pythonEqual(pair, [scene.key, action]))) return null;
    const plan: R = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
      frame_digest: identity(rows), scene, context, selected, action, predictions, configuration: config, selection_reason: reason,
      supporting_models: support.filter(item => item[1] === selected!.id).map(item => item[0]),
      scope: 'Current occurrence is measured. Emphasis and retained relations authorize an experiment only; scene progression, restoration and official score remain separate observations.' };
    const ref = `C_occurrence_recall_${identity(plan).slice(0, 20)}`;
    const facts = { current_occurrence_measured: true, one_experimental_choice_bound: true };
    const why = `${config.question} Selection: ${reason}. Preserve competing relations and the exact current point; no scene from an animation becomes a new antecedent.`;
    const evidence = [observation.observation_ref, ...(context ? [context.evidence_ref] : [])];
    return { status: 'proposed', kind: 'public_occurrence_recall', proposal_id: ref, occurrence_recall_plan: plan, actions: [action],
      steps: [{ action, expected_after: { public_progression: 'hypothesis', same_scene_or_restoration: 'falsifier_or_unknown', official_score_required: true } }],
      facts, compositions: [{ id: ref, observed: false, open_question: why, properties: { roles: config.roles, selected_occurrence: selected.id }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason, hypothesis_refs: predictions.map(item => item.model) }, route_refs: evidence,
      binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], actions: [action],
        purpose: why, preconditions: facts, evidence, outcome_guard: { path: ['value'], contains: ref } } };
  }

  before(proposal: R, index: number, rows: NativeRows, meta: R): R {
    const plan = proposal.occurrence_recall_plan;
    if (!plan) return { admitted: false, reason: 'missing_series_plan' };
    const admitted = index === 0 && pythonEqual([meta.epoch, meta.score, meta.observation_ref], [plan.epoch, plan.score, plan.observation_ref])
      && identity(rows) === plan.frame_digest && meta.available.includes(plan.action.action_ref)
      && pythonEqual(proposal.actions[0], plan.action) && pythonEqual([plan.action.data.x, plan.action.data.y], plan.selected.point);
    return { admitted, reason: admitted ? 'public_occurrence_bound' : 'occurrence_context_or_payload_changed' };
  }

  after(proposal: R, _index: number, _rows: NativeRows, _later: NativeRows, meta: R): R {
    if (!proposal.occurrence_recall_plan) return { matched: null, seal_prefix: true, reason: 'missing_series_plan' };
    return { matched: null, seal_prefix: true, reason: 'canonical_scene_reconciliation_required', official_progress: meta.score > proposal.occurrence_recall_plan.score };
  }

  record(before: R, command: R, after: R, _rows: NativeRows, later: NativeRows, proposal: R, _index: number): R[] {
    const plan = proposal.occurrence_recall_plan;
    if (!plan) return [];
    const scene = plan.scene, nextScene = measureOccurrenceScene(later, after, scene.calibration);
    const boundary = after.level_epoch !== before.level_epoch || after.levels_completed > before.levels_completed;
    let mode: string, restored: R | null = null;
    if (boundary) mode = 'boundary';
    else if (nextScene && Object.hasOwn(this.recallHistory, nextScene.key)) { mode = 'restored'; restored = this.recallHistory[nextScene.key]; }
    else if (nextScene && nextScene.key !== scene.key && nextScene.indicators.length === scene.indicators.length
      && (nextScene.indicators as R[]).filter((item, index) => !pythonEqual(item, scene.indicators[index])).length === 1) mode = 'forward';
    else mode = 'unknown_or_no_effect';
    const models: R = Object.fromEntries(Object.entries(this.recallModels).map(([key, model]: [string, any]) =>
      [key, { ...model, evidence: [...model.evidence], counterexamples: [...model.counterexamples] }]));
    if ((mode === 'forward' || mode === 'boundary') && plan.context) {
      for (const prediction of plan.predictions) {
        const key = prediction.model, model: R = models[key] ??= { unique_support: 0, evidence: [], counterexamples: [] };
        const evidence = [before.observation_ref, after.observation_ref];
        if (!prediction.candidates.includes(plan.selected.id)) model.counterexamples.push(evidence);
        else if (prediction.candidates.length === 1) { model.unique_support += 1; model.evidence.push(evidence); }
      }
    } else if (mode === 'restored') {
      for (const key of plan.supporting_models) if (Object.hasOwn(models, key)) models[key].counterexamples.push([before.observation_ref, after.observation_ref]);
    }
    const event: R = { kind: 'occurrence_recall_transition', before_scene: scene, before_context: plan.context,
      chosen: plan.selected.id, command, mode, restored_context: restored, after_scene_key: nextScene?.key ?? null, after_epoch: after.level_epoch,
      calibration: scene.calibration, models, evidence: [before.observation_ref, after.observation_ref],
      scope: 'One canonical scene per external command. Meter-direction interpretation remains conditional until official progression; exact masks and occurrence choice are retained.' };
    this.applyEvent(event); return [event];
  }

  recordPacket(before: R, command: R, after: R, rows: NativeRows, packet: readonly NativeRows[]): R[] {
    const events = observeOccurrenceProgramPacket(before, command, after, rows, packet);
    for (const event of events) this.applyEvent(event);
    return events;
  }
}

export class OccurrenceRecallConstraint {
  readonly id = 'public_occurrence_recall';
  memory = new OccurrenceRecallAccess(); events: R[] = [];
  readonly config: OccurrenceRecallPolicy;
  constructor(config: OccurrenceRecallPolicy) { this.config = config; }

  async propose(observation: R, rows: NativeRows, _inputs: readonly R[], remaining: number): Promise<R | null> {
    if (remaining < 1) return null;
    const proposal = this.memory.recallQuestion(observation, rows, this.config); if (!proposal) return null;
    const selected = proposal.occurrence_recall_plan.selected, [x, y] = selected.point, box = selected.bbox, step = proposal.steps[0];
    step.expected_before = Object.fromEntries(['level_epoch', 'frame_hash', 'levels_completed', 'state'].map(key => [key, observation[key]]));
    step.point_support = { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref, frame_hash: observation.frame_hash,
      point: [x, y], palette_value: rows[y]![x], projection_bbox: box, projected_rows_digest: await rowsDigest(projection(rows, box)),
      entity_ref: `measured-occurrence:${selected.id}`, signature: identity(selected),
      scope: 'Current measured support plus full recall hypothesis/context guard. No role inferred from position alone.' };
    return proposal;
  }

  bind(proposal: R, domain: ObservedInputDomain): void {
    const step = proposal.steps[0], before = step.expected_before;
    if (!domain.bindings.has(`${before.level_epoch}:${before.frame_hash}`)) throw new TypeError('Current occurrence input domain has not been observed');
    if (!pythonEqual(step.point_support.point, [proposal.actions[0].data.x, proposal.actions[0].data.y])) throw new TypeError('Occurrence point payload differs from its measured support');
    step.point_binding = { ...step.point_support };
  }

  before(proposal: R, index: number, packet: NativePublicObservation, observation: R): R {
    return this.memory.before(proposal, index, packet.frame_rows, { epoch: packet.level, score: packet.levels_completed,
      observation_ref: observation.observation_ref, available: packet.available_action_refs });
  }
  after(proposal: R, index: number, _before: R, after: R, first: NativeRows, second: NativeRows): R {
    return this.memory.after(proposal, index, first, second, { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
  }
  record(before: R, after: R, command: R, first: NativeRows, second: NativeRows, proposal: R, index: number, frames: readonly NativeRows[] = []): R {
    const events = this.memory.record(before, command, after, first, second, proposal, index);
    events.push(...this.memory.recordPacket(before, command, after, first, frames)); this.events.push(...events);
    return { status: after.levels_completed > before.levels_completed ? 'official_boundary_witness' : 'measured_series_or_insertion_response',
      events, transfer_authority: 'hypothesis_only' };
  }
  state(): R { return { events: structuredClone(this.events), digest: this.memory.retainedDigest() }; }
  restore(state: R): void {
    if (!Array.isArray(state.events) || typeof state.digest !== 'string') throw new TypeError('Incomplete occurrence recall memory');
    const events = structuredClone(state.events), rebuilt = new OccurrenceRecallAccess();
    for (const event of events) rebuilt.applyEvent(event);
    if (rebuilt.retainedDigest() !== state.digest) throw new TypeError('Occurrence/program memory changed during recall');
    this.memory = rebuilt; this.events = events;
  }
}

/** The caller keeps this in original `window_constraints` subquestion order. */
export function createNativeOccurrenceRecallFamily(config: OccurrenceRecallPolicy): NativeFamily {
  return asNativeOccurrenceRecallFamily(new OccurrenceRecallConstraint(config));
}

/** Shared-series acquisition can extend the same guarded recall entry point. */
export function asNativeOccurrenceRecallFamily(family: OccurrenceRecallConstraint): NativeFamily {
  return {
    id: family.id,
    propose: async (observation, rows, inputs, remaining) => {
      const proposal = await family.propose(observation, rows, inputs, remaining);
      if (!proposal) return null;
      proposal.field_subquestion = 'observed_occurrence_recall'; return proposal as NativeProposal;
    },
    bind: (proposal, domain) => family.bind(proposal, domain),
    before: (proposal, index, packet, observation) => family.before(proposal, index, packet, observation) as NativeBeforeResult,
    after: (proposal, index, before, after, first, second) => family.after(proposal, index, before, after, first, second) as NativeAfterResult,
    record: (before, after, command, first, second, proposal, index, frames) => family.record(before, after, command, first, second, proposal, index, frames) as { events: unknown[] },
    state: () => family.state(), restore: state => family.restore(state),
  };
}
