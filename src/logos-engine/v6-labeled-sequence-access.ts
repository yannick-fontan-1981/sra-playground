/** LabeledSequenceAccess own layer and source common current-point wrapper. */
import { measureLabeledSequence } from './v6-labeled-sequence-observation.ts';
import { inferLabeledSequence } from './v6-labeled-sequence-mechanics.ts';
import { inferComposedLabeledSequence } from './v6-labeled-sequence-composition.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { projection, rowsDigest, type ObservedInputDomain } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Clock = () => number;
type BeforeMeta = { epoch: number; score: number; observation_ref: string; available: readonly string[] };
type AfterMeta = { epoch: number; score: number; state?: string };
export interface LabeledSequenceState { labeled_cache: R | null; labeled_events: R[] }
export interface NativeLabeledSequenceOptions {
  /** Explicit native finite composition, only after complete atomic contradiction. */
  composedPredicates?: boolean;
}

export function labeledSequenceBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta): R {
  const plan = proposal.labeled_sequence_plan;
  if (!truth(plan)) throw new TypeError('Labeled guard requires labeled_sequence_plan');
  const admitted = index === 0 && meta.epoch === plan.epoch && meta.score === plan.score && meta.observation_ref === plan.observation_ref
    && equal(proposal.actions, plan.commands) && equal(proposal.bundle_template.actions, plan.commands)
    && meta.available.includes('ACTION6') && identity(rows) === plan.frame_digest;
  return { admitted, reason: admitted ? 'current_labeled_query_and_button_bound' : 'labeled_context_or_payload_changed' };
}

export function labeledSequenceAfter(proposal: R, _index: number, _rows: NativeRows, _later: NativeRows, meta: AfterMeta): R {
  const plan = proposal.labeled_sequence_plan;
  if (!truth(plan)) throw new TypeError('Labeled outcome requires labeled_sequence_plan');
  return { matched: null, seal_prefix: true, official_progress: meta.score > plan.score,
    reason: 'classification_response_and_next_query_require_reconciliation' };
}

export class LabeledSequenceMemory {
  private cache: R | null = null;
  private events: R[] = [];
  private version = 0;
  get nativeRevision(): number { return this.version; }
  currentState(): LabeledSequenceState { return structuredClone({ labeled_cache: this.cache, labeled_events: this.events }); }
  retainedDigest(ancestor: string): string { return identity([ancestor, this.cache, this.events]); }
  applyEvent(event: R): void {
    if (event.kind !== 'labeled_sequence_submission') throw new TypeError(`Outside labeled-sequence layer: ${String(event.kind)}`);
    const owned = retainNativeJson(event);
    this.version++; this.cache = owned.cache; this.events.push(owned);
  }

  /** Planning acquires nothing; the common owner supplies inherited fallbacks. */
  proposeLabeled(observation: R, rows: NativeRows, _inputs: readonly R[], maxPrefix: number, config: R,
    levelDeadlineMs: number, now: Clock = () => performance.now(),
    base: R | null = { status: 'abstained', reason: 'no_recurrent_line_question' }, native: NativeLabeledSequenceOptions = {}): R | null {
    const cfg = config.labeled_sequence_question;
    const prior = this.cache && this.cache.epoch === observation.level_epoch ? this.cache.controls ?? null : null;
    const scene = truth(cfg) ? measureLabeledSequence(rows, prior) : null;
    if (!scene || !maxPrefix || !observation.available_action_refs.includes('ACTION6')) return base;
    const result = native.composedPredicates
      ? inferComposedLabeledSequence(scene, observation, levelDeadlineMs, cfg, this.cache, now)
      : inferLabeledSequence(scene, observation, levelDeadlineMs, cfg, this.cache, now);
    if (!result || !truth(result.induction.values.robust_answer_and_submission_agreement)
      || result.native_composition && (result.native_composition.complete !== true
        || result.induction.status !== 'COMPLETE' || result.induction.domain_complete !== true
        || result.induction.values.observation_compatible_version_space.length === 0)) {
      return { status: 'abstained', reason: 'labeled_predicate_domain_has_no_unique_current_answer' };
    }
    const labels = new Set<string>((result.induction.values.label_predictions as R[]).map(prediction => prediction.predicted_label_ref));
    if (labels.size !== 1) throw new TypeError('Robust labeled agreement requires one predicted label');
    const label = Number(labels.values().next().value!), button = (scene.buttons as R[]).find(candidate => candidate.label === label);
    if (!button) throw new TypeError('Agreed label has no currently measured control');
    const action = { action_ref: 'ACTION6', data: { x: button.point[0], y: button.point[1] } };
    if (this.events.some(event => event.epoch === observation.level_epoch && event.before_frame === observation.frame_hash && equal(event.command, action))) {
      return { status: 'abstained', reason: 'identical_labeled_submission_context_already_observed' };
    }
    const plan = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
      frame_digest: identity(rows), scene, inference: result, label, button, commands: [structuredClone(action)],
      scope: result.native_composition
        ? 'Agreement within the exhaustively examined bounded native AND/OR grammar on observed examples; labels/control correspondence remains geometric hypothesis. Next question and physical receipt unknown.'
        : 'Agreement within declared atomic/complement grammar on observed examples; labels/control correspondence remains geometric hypothesis. Next question and physical receipt unknown.' };
    const ref = 'C_labeled_' + identity(plan).slice(0, 20), why = result.native_composition
      ? 'Compare the current measured sequence with both example collections using the declared bounded native AND/OR grammar. Submit only when a nonempty set of compatible predicates unanimously predicts the current label and its visible control. Seal this one action on its unknown physical response.'
      : cfg.question;
    const facts = { measured_labeled_panel_and_scaled_query: true, finite_declared_predicate_agreement: true, current_button_bound_to_predicted_label: true };
    return structuredClone({ status: 'proposed', kind: 'labeled_sequence_experiment', labeled_sequence_plan: plan, proposal_id: ref,
      actions: [action], steps: [{ action, expected_after: null }], facts,
      compositions: [{ id: ref, observed: false, open_question: why, properties: { roles: cfg.roles }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: result.induction.values.observation_compatible_version_space.map((item: R) => item.predicate_ref) },
      route_refs: [observation.observation_ref], binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], actions: [action],
        purpose: why, preconditions: facts, evidence: [observation.observation_ref, scene.context_ref], outcome_guard: { path: ['value'], contains: ref } } });
  }

  /** The shared owner first acquires Product and older layers in source order. */
  record(before: R, command: R, after: R, _rows: NativeRows, _later: NativeRows, proposal: R, _index: number): R[] {
    const plan = proposal.labeled_sequence_plan;
    if (!truth(plan)) return [];
    const progress = after.levels_completed > before.levels_completed;
    const event = { kind: 'labeled_sequence_submission', epoch: before.level_epoch, before_frame: before.frame_hash, after_frame: after.frame_hash,
      command, before_ref: before.observation_ref, after_ref: after.observation_ref, official_progress: progress,
      label: plan.label, query: plan.scene.query.words[0].values, cache: plan.inference.training_cache,
      physical_receipt_status: progress ? 'official_boundary' : before.frame_hash !== after.frame_hash ? 'changed_public_context' : 'unchanged_public_context',
      law_uniqueness_claimed: false };
    this.applyEvent(event);
    return [structuredClone(event)];
  }
}

export async function commonLabeledSequenceProposal(memory: LabeledSequenceMemory, observation: R, rows: NativeRows, inputs: readonly R[],
  remaining: number, config: R, levelDeadlineMs: number | null, now: Clock = () => performance.now(), base?: R | null,
  native: NativeLabeledSequenceOptions = {}): Promise<R | null> {
  if (remaining < 1) return null;
  if (levelDeadlineMs === null || levelDeadlineMs === undefined) throw new TypeError('Labeled query requires current level deadline');
  const proposal = memory.proposeLabeled(observation, rows, inputs, Math.min(16, remaining), { ...config, remaining_level_actions: remaining },
    levelDeadlineMs, now, base, native);
  if (!proposal || !Object.hasOwn(proposal, 'labeled_sequence_plan')) return null;
  const plan = proposal.labeled_sequence_plan, button = plan.button, [x, y] = button.point, step = proposal.steps[0];
  step.expected_before = Object.fromEntries(['level_epoch', 'frame_hash', 'levels_completed', 'state'].map(key => [key, observation[key]]));
  step.point_support = { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref, frame_hash: observation.frame_hash,
    point: [x, y], palette_value: rows[y]![x], projection_bbox: button.bbox, projected_rows_digest: await rowsDigest(projection(rows, button.bbox)),
    entity_ref: 'measured-label-control:' + identity([button.bbox, button.label]), signature: identity([plan.scene.context_ref, button]),
    scope: 'Current complete uniform control support, revalidated from retained envelope when needed. The current query and finite predicate agreement are separately bound; no future query or stale point authority.' };
  return proposal;
}

/** The source binder checks its measured support; dispatch owns the input domain. */
export function bindLabeledSequence(proposal: R, _domain: ObservedInputDomain): void {
  const support = proposal.steps[0].point_support, action = proposal.actions[0];
  if (!equal(support.point, [action.data.x, action.data.y])) throw new TypeError('Labeled point payload changed');
  proposal.steps[0].point_binding = { ...support };
}
