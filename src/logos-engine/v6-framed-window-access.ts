/** FramedWindowAccess's own event layer and current public point wrapper.
 * The shared owner supplies ancestor dispatch and acquires ancestor events once.
 * An equal window is a current question, never a learned transport/terminal law.
 */
import { measureFramedWindow, certifyFramedWindow } from './v6-framed-window-observation.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { projection, rowsDigest, type ObservedInputDomain } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Clock = () => number;
type BeforeMeta = { epoch: number; score: number; observation_ref: string; available: readonly string[] };
type AfterMeta = { epoch: number; score: number; state?: string };

export interface FramedWindowState { window_events: R[]; window_blocked: string[] }
export const freshFramedWindowMemory = (): FramedWindowState => ({ window_events: [], window_blocked: [] });

function pointCommand(point: readonly number[]): R {
  // Source dict(zip(('x', 'y'), point)) ignores any trailing coordinate.
  return { action_ref: 'ACTION6', data: Object.fromEntries(['x', 'y'].slice(0, point.length).map((key, i) => [key, point[i]])) };
}
function required(value: R, key: string): any {
  if (!Object.hasOwn(value, key)) throw new TypeError('Framed-window source contract requires ' + key);
  return value[key];
}

export function framedWindowBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta): R {
  const plan = proposal.framed_window_plan;
  if (!truth(plan)) throw new TypeError('Framed-window admission requires framed_window_plan');
  const expected = pointCommand(required(plan, 'point'));
  const admitted = equal(index, 0)
    && equal([required(meta, 'epoch'), required(meta, 'score'), required(meta, 'observation_ref')],
      [required(plan, 'epoch'), required(plan, 'score'), required(plan, 'observation_ref')])
    && identity(rows) === required(plan, 'frame_digest') && required(meta, 'available').includes('ACTION6')
    && equal(required(proposal, 'actions'), [expected]) && equal(required(required(proposal, 'bundle_template'), 'actions'), [expected]);
  return { admitted, reason: admitted ? 'current_window_and_point_bound' : 'window_context_or_payload_changed' };
}

export function framedWindowAfter(proposal: R, _index: number, _rows: NativeRows, _later: NativeRows, meta: AfterMeta): R {
  const plan = proposal.framed_window_plan;
  if (!truth(plan)) throw new TypeError('Framed-window outcome requires framed_window_plan');
  return { matched: null, seal_prefix: true, reason: 'window_point_effect_requires_public_reconciliation',
    official_progress: required(meta, 'score') > required(plan, 'score') };
}

export class FramedWindowMemory {
  private events: R[] = [];
  private blocked: string[] = [];
  private version = 0;
  get nativeRevision(): number { return this.version; }
  get eventCount(): number { return this.events.length; }
  currentState(): FramedWindowState { return structuredClone({ window_events: this.events, window_blocked: this.blocked }); }
  retainedDigest(ancestor: string): string { return identity([ancestor, this.events, this.blocked]); }
  applyEvent(event: R): void {
    if (event.kind !== 'framed_window_response') throw new TypeError(`Outside framed-window layer: ${String(event.kind)}`);
    const owned = retainNativeJson(event);
    // Reject malformed native journals before acquiring any partial event.
    if (!Object.hasOwn(owned, 'official_progress') || (!truth(owned.official_progress) && !Object.hasOwn(owned, 'trial_key'))) {
      throw new TypeError('Framed-window response lacks its progress or blocked-trial key');
    }
    this.events.push(owned);
    if (!truth(owned.official_progress)) this.blocked.push(owned.trial_key);
    this.version++;
  }

  /** An absent own offer delegates to the separately owned RootedQuota chain.
   * A zero limit suppresses this own question; source negative limits are truthy.
   * The common wrapper supplies positive remaining actions and current deadline.
   */
  propose(observation: R, rows: NativeRows, _inputs: readonly R[], maxPrefix: number, config: R,
    deadlineMs: number = config.level_deadline, now: Clock = () => performance.now(), base: R | null = null): R | null {
    const cfg = config.framed_window_question;
    if (truth(cfg) && truth(maxPrefix) && observation.available_action_refs.includes('ACTION6')) {
      const scene = measureFramedWindow(rows);
      if (scene && scene.matches.length === 1) {
        const key = identity([observation.level_epoch, rows, scene.matches]);
        if (!this.blocked.includes(key)) {
          if (deadlineMs === null || deadlineMs === undefined) throw new TypeError('Window comparison requires current level deadline');
          const receipt = certifyFramedWindow(scene, observation, deadlineMs, now);
          if (receipt.status === 'COMPLETE' && truth(receipt.domain_complete)) {
            return this.windowProposal(observation, rows, scene, receipt, key, cfg);
          }
        }
      }
    }
    return base;
  }

  windowProposal(observation: R, rows: NativeRows, scene: R, receipt: R, key: string, cfg: R): R {
    const [x, y] = scene.matches[0], [left, top] = scene.image_box;
    const point = [left + 1 + x + Math.floor(scene.reference[0].length / 2), top + 1 + y + Math.floor(scene.reference.length / 2)];
    const action = pointCommand(point);
    const plan = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
      frame_digest: identity(rows), trial_key: key, reference_box: scene.reference_box, image_box: scene.image_box,
      window: scene.matches[0], point, reference_digest: identity(scene.reference), examined_windows: scene.examined_windows,
      method_receipt: receipt, action,
      scope: 'Exact equality is descriptive. Reference role and usefulness of pointing remain hypotheses; no old coordinates or transport law are inherited.' };
    const ref = 'C_window_' + identity(plan).slice(0, 20);
    if (!Object.hasOwn(cfg, 'question') || !Object.hasOwn(cfg, 'roles')) throw new TypeError('Framed-window question requires question and roles');
    const why = cfg.question;
    const facts = { unique_current_exact_window: true, reference_outside_search_domain: true, point_inside_current_window: true };
    return structuredClone({ status: 'proposed', kind: 'framed_window_experiment', proposal_id: ref, framed_window_plan: plan,
      actions: [action], steps: [{ action, expected_after: null }], facts,
      compositions: [{ id: ref, observed: false, open_question: why, properties: { roles: cfg.roles }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: 'test_current_exact_window_under_reference_role_hypothesis', hypothesis_refs: [scene.hypothesis] },
      route_refs: [observation.observation_ref], binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [],
        actions: [action], purpose: why, preconditions: facts, evidence: [observation.observation_ref], outcome_guard: { path: ['value'], contains: ref } } });
  }

  /** Ancestor acquisition precedes this own response in SharedSeries. */
  record(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R, _index: number): R[] {
    const plan = proposal.framed_window_plan;
    if (!truth(plan)) return [];
    const event = structuredClone({ kind: 'framed_window_response', trial_key: plan.trial_key,
      epoch: before.level_epoch, after_epoch: after.level_epoch, evidence: [before.observation_ref, after.observation_ref],
      reference_box: plan.reference_box, window: plan.window, point: plan.point, command,
      official_progress: after.levels_completed > before.levels_completed, canonical_changed: identity(rows) !== identity(later),
      scope: 'One actual point outcome; no universal reference, transport, or acceptance law inferred.' });
    this.applyEvent(event); return [event];
  }
}

export async function proposeFramedWindowCommon(memory: FramedWindowMemory, observation: R, rows: NativeRows,
  inputs: readonly R[], remaining: number, config: R, deadlineMs: number | null,
  now: Clock = () => performance.now(), base: R | null = null): Promise<R | null> {
  if (remaining < 1 || !observation.available_action_refs.includes('ACTION6') || measureFramedWindow(rows) === null) return null;
  if (deadlineMs === null || deadlineMs === undefined) throw new TypeError('Window comparison requires current level deadline');
  const proposal = memory.propose(observation, rows, inputs, Math.min(16, remaining),
    { ...config, level_deadline: deadlineMs, remaining_level_actions: remaining }, deadlineMs, now, base);
  if (!truth(proposal) || !Object.hasOwn(proposal!, 'framed_window_plan')) return null;
  const plan = proposal!.framed_window_plan;
  proposal!.steps = structuredClone(proposal!.steps);
  const step = proposal!.steps[0], [x, y] = plan.point, box = plan.image_box;
  step.expected_before = { level_epoch: observation.level_epoch, frame_hash: observation.frame_hash,
    levels_completed: observation.levels_completed, state: observation.state };
  step.point_support = { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref, frame_hash: observation.frame_hash,
    point: [x, y], palette_value: rows[y]![x], projection_bbox: box,
    projected_rows_digest: await rowsDigest(projection(rows, box)),
    entity_ref: 'measured-current-window:' + identity([box, plan.window, plan.reference_digest]),
    signature: identity([plan.window, plan.reference_digest]),
    scope: 'Current acquired image support and pixel-equal window, bound to full current frame; reference and pointing utility remain hypotheses.' };
  return proposal;
}

export function bindFramedWindow(proposal: R, domain: ObservedInputDomain): void {
  const first = proposal.steps[0].expected_before;
  if (!domain.bindings.has(`${first.level_epoch}:${first.frame_hash}`)) throw new TypeError('Framed-window point domain not currently observed');
  // Source zip binds only the supplied action/step pairs. Whole-envelope guards
  // remain the common caller's responsibility, not an inferred source guarantee.
  for (let index = 0; index < Math.min(proposal.actions.length, proposal.steps.length); index++) {
    const action = proposal.actions[index], step = proposal.steps[index], support = step.point_support;
    if (!equal(support.point, [action.data.x, action.data.y])) throw new TypeError('Framed-window point payload changed');
    step.point_binding = { ...support };
  }
}
