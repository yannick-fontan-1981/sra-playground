/** Pinned QueuedFieldAccess own layer and the common coordinate-free wrapper. */
import { measureQueuedField, queuedFieldGrid } from './v6-queued-field-observation.ts';
import { activeQueueMemberCount, portableQueueHypothesis, acquireQueuedField } from './v6-queued-field-models.ts';
import { chooseQueuedField } from './v6-queued-field-search.ts';
import { queuedFieldReceipt } from './v6-queued-field-mechanics.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { linkedPacketDigest as finiteIdentity } from './v6-linked-packet-numeric.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import type { NativeRows } from './v6-native-types.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';

type R = Record<string, any>;
type Clock = () => number;
type BeforeMeta = { epoch: number; score: number; observation_ref: string; available: readonly string[] };
type AfterMeta = { epoch: number; score: number; state?: string };
export interface QueuedFieldState { queue_state: R | null; queue_events: R[] }
type Pending = { before: R; after: R; command: R; rows: NativeRows; later: NativeRows; portable: R | null };

export class QueuedFieldMemory {
  private queueState: R | null = null;
  private queueEvents: R[] = [];
  private pending: Pending | null = null;
  private version = 0;
  get nativeRevision(): number { return this.version; }
  currentState(): QueuedFieldState { return structuredClone({ queue_state: this.queueState, queue_events: this.queueEvents }); }
  /** Source persistence excludes the intra-receipt pending transition. */
  retainedDigest(ancestor: string): string { return identity([ancestor, this.queueState, this.queueEvents]); }
  applyEvent(event: R): void {
    if (event.kind !== 'observed_queue_field_model') throw new TypeError(`Outside queued-field layer: ${String(event.kind)}`);
    const owned = retainNativeJson(event);
    this.version++; this.queueState = owned.state; this.queueEvents.push(owned);
  }

  proposeQueue(observation: R, rows: NativeRows, inputs: readonly R[], maxPrefix: number, config: R,
    levelDeadlineMs: number, now: Clock = () => performance.now(),
    base: R | null = { status: 'abstained', reason: 'no_recurrent_line_question' }): R | null {
    const cfg = config.queued_field_question;
    const prior = this.queueState && this.queueState.epoch === observation.level_epoch ? this.queueState : null;
    const scene = truth(cfg) ? measureQueuedField(rows, prior ? prior.geometry : null, activeQueueMemberCount(prior)) : null;
    if (!scene || !scene.mark || !maxPrefix) return base;
    const key = identity([observation.level_epoch, scene.geometry]);
    let state = this.queueState && this.queueState.key === key ? this.queueState : null;
    const portable = !state && truth(cfg.reuse_prior_relations) ? portableQueueHypothesis(this.queueState, scene, observation) : null;
    if (portable) state = portable;
    if (!state && !truth(scene.preview_alternatives)) return base;
    const controls: R = state?.controls ?? {}, available = [...new Set<string>(inputs.filter(action => !truth(action.data)).map(action => action.action_ref))].sort();
    const moves = (Object.values(controls) as R[]).filter(law => law.kind === 'translate').map(law => law.delta);
    const cycles = (Object.values(controls) as R[]).filter(law => law.kind === 'reorder' && law.permutations.length === 1);
    const complete = state && Object.hasOwn(state, 'empty') && Object.hasOwn(state, 'gravity')
      && (Object.values(controls) as R[]).some(law => law.kind === 'receive') && (cycles.length > 0 || new Set(scene.mark.values).size === 1)
      && moves.some(x => x < 0) && moves.some(x => x > 0);
    let estimate: R | null = null, actions: R[], why: string, mode: string;
    if (complete) {
      estimate = chooseQueuedField(scene, state!, Math.min(config.remaining_level_actions, maxPrefix < 16 ? maxPrefix : config.remaining_level_actions),
        levelDeadlineMs, cfg.node_bound, cfg.depth_bound, now);
      if (!estimate) return { status: 'abstained', reason: 'queue_domain_or_bound_has_no_admitted_composition' };
      actions = estimate.actions; why = portable ? cfg.transfer_question : cfg.composition_question; mode = 'prepare_and_receive';
      estimate.mechanical_receipt = queuedFieldReceipt(observation, estimate.placed, estimate.model_alternatives[0], state!.evidence);
    } else {
      const ambiguous = Object.keys(controls).filter(action => controls[action].kind === 'reorder' && controls[action].permutations.length > 1 && available.includes(action));
      const untried = available.filter(action => !Object.hasOwn(controls, action));
      const choices = (ambiguous.length ? ambiguous : untried).filter(action => !state || !(state.attempts ?? []).includes(identity([scene.grid, scene.mark.column, { action_ref: action }])));
      if (!choices.length) return { status: 'abstained', reason: 'queue_control_applicability_unknown' };
      actions = [{ action_ref: choices[0] }]; why = cfg.acquisition_question; mode = 'control_experiment';
    }
    const expected: number[][] = structuredClone(scene.grid); let values: number[] = [...scene.mark.values], column: number = scene.mark.column;
    const steps: R[] = [];
    for (const command of actions) {
      const beforeGrid = structuredClone(expected), beforeColumn = column; let law = controls[command.action_ref], afterGrid: number[][] | null = null;
      if (law && ['translate', 'reorder'].includes(law.kind) && state && Object.hasOwn(state, 'empty')) {
        for (const y of scene.mark.rows as number[]) expected[y]![column] = state.empty;
        if (law.kind === 'translate') column += law.delta;
        else if (law.permutations.length === 1) values = (law.permutations[0] as number[]).map(i => values[i]!);
        else law = null;
        if (law) {
          for (const [i, y] of (scene.mark.rows as number[]).entries()) expected[y]![column] = values[i]!;
          afterGrid = structuredClone(expected);
        }
      }
      steps.push({ action: command, controlled_column_before: beforeColumn, expected_before_grid: beforeGrid, expected_after_grid: afterGrid, expected_after: null });
    }
    const plan: R = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
      frame_digest: identity(rows), geometry: scene.geometry, mode, scene, commands: structuredClone(actions), estimate, model_digest: identity(state),
      scope: 'Current control effects and received phases support conditional queue compositions; terminal quota and unseen line relations remain unknown.',
      portable_model: portable, active_control_model: Object.fromEntries(['controls', 'empty', 'key'].filter(k => state && Object.hasOwn(state, k)).map(k => [k, state![k]])) };
    // The contribution mean is an IEEE-754 estimate. Reuse the existing finite
    // native JSON digest; V7's integer canonical contract remains unchanged.
    // Python's 1.0 spelling is not asserted identical to native 1 here.
    const ref = 'C_queue_' + finiteIdentity(plan).slice(0, 20), facts = { public_repeated_cells_and_active_envelope: true,
      current_available_inputs: actions.every(action => observation.available_action_refs.includes(action.action_ref)), bounded_conditional_composition: true };
    return structuredClone({ status: 'proposed', kind: 'queued_field_experiment', queued_field_plan: plan, proposal_id: ref, actions, steps, facts,
      compositions: [{ id: ref, observed: false, open_question: why, properties: { roles: cfg.roles }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: [] }, route_refs: [observation.observation_ref],
      binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], actions, purpose: why,
        preconditions: facts, evidence: [observation.observation_ref, ...(state ? state.evidence.slice(-16) : [])], outcome_guard: { path: ['value'], contains: ref } } });
  }

  /** The inherited owner records other layers after staging this same return. */
  record(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R, _index: number): R[] {
    let portable = proposal.queued_field_plan?.portable_model ?? null;
    if (this.queueState && this.queueState.epoch === before.level_epoch) portable = null;
    this.pending = retainNativeJson({ before, after, command, rows, later, portable }); this.version++;
    return [];
  }
  recordPacket(before: R, _command: R, _after: R, _rows: NativeRows, frames: readonly NativeRows[]): R[] {
    const pending = this.pending; this.pending = null; this.version++;
    if (!pending || pending.before.observation_ref !== before.observation_ref) return [];
    const state = acquireQueuedField(pending.portable ?? this.queueState, pending.before, pending.after, pending.command, pending.rows, pending.later, frames);
    if (state === null) return [];
    const event = { kind: 'observed_queue_field_model', state, evidence: [pending.before.observation_ref, pending.after.observation_ref],
      packet_images_consumed: frames.length, scope: 'Public reception and preparation measured; retained closure alternatives are conditional, not a universal law.' };
    this.applyEvent(event); return [event];
  }
}

export function commonQueuedFieldProposal(memory: QueuedFieldMemory, observation: R, rows: NativeRows, inputs: readonly R[], remaining: number,
  config: R, levelDeadlineMs: number | null, now: Clock = () => performance.now()): R | null {
  if (remaining < 1) return null;
  if (levelDeadlineMs === null || levelDeadlineMs === undefined) throw new TypeError('Queue preparation requires current level deadline');
  const proposal = memory.proposeQueue(observation, rows, inputs, Math.min(16, remaining), { ...config, remaining_level_actions: remaining }, levelDeadlineMs, now);
  if (!proposal || !Object.hasOwn(proposal, 'queued_field_plan')) return null;
  proposal.steps[0].expected_before = Object.fromEntries(['level_epoch', 'frame_hash', 'levels_completed', 'state'].map(key => [key, observation[key]]));
  return proposal;
}

export function bindQueuedField(proposal: R, _domain?: ObservedInputDomain): void {
  if ((proposal.actions as R[]).some(action => truth(action.data))) throw new TypeError('Queued scalar command acquired unexpected point data');
}

export function queuedFieldBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta, memory?: QueuedFieldMemory): R {
  const plan = proposal.queued_field_plan;
  if (!truth(plan)) throw new TypeError('Queue guard requires queued_field_plan');
  let ok = meta.epoch === plan.epoch && meta.score === plan.score && equal(proposal.actions, plan.commands)
    && equal(proposal.bundle_template.actions, plan.commands) && index >= 0 && index < proposal.steps.length;
  if (ok) ok = meta.available.includes(proposal.actions[index].action_ref) && equal(queuedFieldGrid(rows, plan.geometry), proposal.steps[index].expected_before_grid);
  const current = Object.hasOwn(plan, 'active_control_model') ? plan.active_control_model : memory?.currentState().queue_state ?? {};
  const law = current.controls?.[proposal.actions[index]?.action_ref];
  if (ok && law?.kind === 'translate' && Object.hasOwn(current, 'empty')) {
    const column = proposal.steps[index].controlled_column_before ?? plan.scene.mark.column, destination = column + law.delta, grid = queuedFieldGrid(rows, plan.geometry);
    ok = grid !== null && 0 <= destination && destination < grid[0]!.length && (plan.scene.mark.rows as number[]).every(y => grid[y]![destination] === current.empty);
  }
  if (index === 0) ok = ok && meta.observation_ref === plan.observation_ref && identity(rows) === plan.frame_digest;
  return { admitted: Boolean(ok), reason: ok ? 'current_queue_composition_bound' : 'queue_premise_or_payload_changed' };
}

export function queuedFieldAfter(proposal: R, index: number, rows: NativeRows, later: NativeRows, meta: AfterMeta): R {
  const plan = proposal.queued_field_plan;
  if (!truth(plan)) throw new TypeError('Queue outcome requires queued_field_plan');
  const progressed = meta.score > plan.score, expected = proposal.steps[index].expected_after_grid;
  const actual = meta.epoch === plan.epoch ? queuedFieldGrid(later, plan.geometry) : null;
  let matched = expected === null ? null : equal(actual, expected);
  const [x, y] = plan.geometry.origin, [nx, ny] = plan.geometry.shape, [dx, dy] = plan.geometry.pitch, [w, h] = plan.geometry.size;
  let outside = false;
  for (let j = 0; j < rows.length && !outside; j++) for (let i = 0; i < rows[j]!.length; i++) {
    if (!(x - (dx - w) <= i && i < x + nx * dx && y - (dy - h) <= j && j < y + ny * dy) && rows[j]![i] !== later[j]?.[i]) { outside = true; break; }
  }
  if (expected !== null && outside) matched = false;
  return { matched, seal_prefix: progressed || meta.epoch !== plan.epoch || expected === null || matched === false,
    reason: matched ? 'queue_preparation_matched' : 'queue_receipt_or_divergence_requires_reconciliation', official_progress: progressed };
}
