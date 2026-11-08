/** RootedQuotaAccess own source layer and its common observed-point wrapper. */
import { measureRootedQuota, measureRootedLengths } from './v6-rooted-quota-observation.ts';
import { propagateRootedQuota, stepRootedQuota } from './v6-rooted-quota-mechanics.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { projection, rowsDigest, type ObservedInputDomain } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Clock = () => number;
type BeforeMeta = { epoch: number; score: number; observation_ref: string; available: readonly string[] };
type AfterMeta = { epoch: number; score: number; state?: string };
export interface RootedQuotaState { quota_events: R[]; quota_model: R; quota_context: R | null; requested_stop_reason: string | null }

export function rootedQuotaBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta): R {
  const plan = proposal.rooted_quota_plan;
  if (!truth(plan)) throw new TypeError('Rooted guard requires rooted_quota_plan');
  const step = proposal.steps[index], point = plan.scene.chains[step.chain].points[step.rank];
  let admitted = meta.epoch === plan.epoch && meta.score === plan.score && meta.available.includes('ACTION6')
    && equal(proposal.actions[index], { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } });
  if (index === 0) admitted = admitted && meta.observation_ref === plan.observation_ref && identity(rows) === plan.frame_digest;
  else admitted = admitted && step.prediction !== null && equal(measureRootedLengths(rows, plan.scene, plan.model), step.prediction.before);
  return { admitted, reason: admitted ? 'current_rooted_composition_bound' : 'rooted_context_or_predicted_prefix_changed' };
}

export function rootedQuotaAfter(proposal: R, index: number, _rows: NativeRows, later: NativeRows, meta: AfterMeta): R {
  const plan = proposal.rooted_quota_plan;
  if (!truth(plan)) throw new TypeError('Rooted outcome requires rooted_quota_plan');
  if (meta.epoch !== plan.epoch || meta.score > plan.score) return { matched: null, seal_prefix: true, reason: 'official_boundary', official_progress: true };
  const prediction = proposal.steps[index].prediction;
  const matched = truth(prediction) ? equal(measureRootedLengths(later, plan.scene, plan.model), prediction.after) : null;
  return { matched, seal_prefix: matched !== true, reason: matched ? 'conditional_prefix_matched' : 'unknown_or_divergent_indexed_edit', official_progress: false };
}

export class RootedQuotaMemory {
  private events: R[] = [];
  private model: R = {};
  private context: R | null = null;
  private stopReason: string | null = null;
  private version = 0;
  get nativeRevision(): number { return this.version; }
  get requestedStopReason(): string | null { return this.stopReason; }
  currentState(): RootedQuotaState {
    return structuredClone({ quota_events: this.events, quota_model: this.model, quota_context: this.context, requested_stop_reason: this.stopReason });
  }
  retainedDigest(ancestor: string): string { return identity([ancestor, this.events, this.model, this.context]); }
  applyEvent(event: R): void {
    if (event.kind !== 'rooted_quota_state') throw new TypeError(`Outside rooted-quota layer: ${String(event.kind)}`);
    const owned = retainNativeJson(event);
    this.version++; this.events.push(owned); this.model = owned.model; this.context = owned.context; this.stopReason = owned.stop_reason;
  }

  /** Inherited fallback is supplied by the common owner; this method acquires nothing. */
  proposeRooted(observation: R, rows: NativeRows, _inputs: readonly R[], maxPrefix: number, config: R,
    levelDeadlineMs: number, now: Clock = () => performance.now(),
    base: R | null = { status: 'abstained', reason: 'no_recurrent_line_question' }): R | null {
    const cfg = config.rooted_quota_question;
    if (!truth(cfg) || !observation.available_action_refs.includes('ACTION6')) return base;
    const scene = measureRootedQuota(rows, this.model.empty_palette ?? null);
    if (scene === null) return base;
    const model = this.model, current = measureRootedLengths(rows, scene, model);
    if (current === null) return { status: 'abstained', reason: 'rooted_content_not_a_measured_prefix' };
    const operations: { chain: number; rank: number; prediction: R | null }[] = [];
    let method: R | null = null, phase: string;
    if (!model.addition_observed) {
      let i = 0;
      for (let j = 1; j < scene.chains.length; j++) if (scene.chains[j].cells.length > scene.chains[i].cells.length) i = j;
      operations.push({ chain: i, rank: scene.chains[i].cells.length - 1, prediction: null });
      phase = 'discriminate_local_effect_from_rooted_prefix';
    } else if (!model.cut_observed) {
      const i = current.findIndex(length => length >= 2);
      if (i < 0) return { status: 'abstained', reason: 'no_observed_long_prefix_for_cut_contrast' };
      operations.push({ chain: i, rank: Math.floor(current[i]! / 2), prediction: null });
      phase = 'discriminate_truncation_from_repeated_toggle';
    } else {
      method = propagateRootedQuota(scene, observation, model, levelDeadlineMs, now);
      if (method.status !== 'COMPLETE' || !method.values.all_domains_singleton) return { status: 'abstained', reason: 'conditional_prefix_marginals_not_singleton' };
      const desired: number[] = method.values.retained_domains.map((domain: number[]) => domain[0]);
      let working = [...current]; phase = 'realize_conditional_joint_prefixes';
      for (const [i, length] of desired.entries()) {
        if (length === working[i]) continue;
        const rank = length > working[i]! ? length - 1 : length;
        const receipt = stepRootedQuota(scene, working, i, rank, observation, model, levelDeadlineMs, now);
        if (receipt.status !== 'COMPLETE') return { status: 'abstained', reason: 'conditional_indexed_step_not_complete' };
        const after = receipt.values.filled_lengths;
        operations.push({ chain: i, rank, prediction: { before: working, after, method: receipt } }); working = [...after];
        if (operations.length >= maxPrefix) break;
      }
      if (!operations.length) return { status: 'abstained', reason: 'marginals_satisfied_without_official_score' };
    }
    const actions: R[] = [], steps: R[] = [];
    for (const { chain, rank, prediction } of operations) {
      const point = scene.chains[chain].points[rank], command = { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } };
      actions.push(command); steps.push({ action: command, chain, rank, prediction, expected_after: null });
    }
    const plan = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
      frame_digest: identity(rows), scene, lengths_before: current, phase, model: structuredClone(model), method };
    const ref = 'C_rooted_' + identity(plan).slice(0, 20), why = cfg.question + ' Current question: ' + phase;
    const facts = { measured_chain_partition: true, measured_mark_units: true, scoped_edit_examples: Boolean(model.addition_observed && model.cut_observed) };
    const evidence = [observation.observation_ref, ...(model.evidence ?? [])];
    return structuredClone({ status: 'proposed', kind: 'rooted_quota_experiment', proposal_id: ref, rooted_quota_plan: plan, actions, steps, facts,
      compositions: [{ id: ref, observed: false, open_question: why, properties: { roles: cfg.roles }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: phase, hypothesis_refs: evidence }, route_refs: evidence,
      binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], actions,
        purpose: why, preconditions: facts, evidence, outcome_guard: { path: ['value'], contains: ref } } });
  }

  /** Source replaces the older record chain for this plan; the owner still records the public packet. */
  record(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R, index: number): R[] {
    const plan = proposal.rooted_quota_plan;
    if (!truth(plan)) return [];
    const model = structuredClone(this.model), step = proposal.steps[index], scene = plan.scene;
    const refs = [before.observation_ref, after.observation_ref];
    let stop: string | null = null, context: R | null = null;
    if (before.level_epoch === after.level_epoch) {
      if (!Object.hasOwn(model, 'empty_palette')) model.empty_palette = scene.empty_content_palette;
      const i = step.chain, rank = step.rank, old = measureRootedLengths(rows, scene, model), colors = new Set<number>();
      for (const chain of scene.chains as R[]) for (const [x, y] of chain.points as number[][]) if (later[y!]![x!] !== scene.empty_content_palette) colors.add(later[y!]![x!]!);
      if (!Object.hasOwn(model, 'fill_palette') && colors.size === 1) model.fill_palette = [...colors][0];
      const next = measureRootedLengths(later, scene, model), preserved = old !== null && next !== null && old.every((length, j) => j === i || length === next[j]);
      if (!preserved) stop = 'indexed_edit_owner_or_prefix_refuted';
      else if (old![i]! <= rank && next![i] === rank + 1) model.addition_observed = true;
      else if (old![i]! > rank && next![i] === rank) model.cut_observed = true;
      else stop = 'indexed_edit_response_not_supported';
      context = { epoch: after.level_epoch, lengths: next, effect_evidence: refs, owner_preserved: preserved };
    } else model.official_quota_witness = refs;
    model.evidence = [...(model.evidence ?? []), ...refs];
    const event = { kind: 'rooted_quota_state', model, context, stop_reason: stop, evidence: refs,
      scope: 'Observed current addition/cut examples. Root, numeric clue semantics and transfer remain conditional; no universal edit or terminal law.' };
    this.applyEvent(event); return [structuredClone(event)];
  }
}

export async function commonRootedQuotaProposal(memory: RootedQuotaMemory, observation: R, rows: NativeRows, inputs: readonly R[],
  remaining: number, config: R, levelDeadlineMs: number | null, now: Clock = () => performance.now(), base?: R | null): Promise<R | null> {
  if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
  if (levelDeadlineMs === null || levelDeadlineMs === undefined) throw new TypeError('Rooted calculation requires current level deadline');
  const proposal = memory.proposeRooted(observation, rows, inputs, Math.min(16, remaining), config, levelDeadlineMs, now, base);
  if (!proposal || !Object.hasOwn(proposal, 'rooted_quota_plan')) return null;
  const plan = proposal.rooted_quota_plan, scene = plan.scene;
  proposal.steps = structuredClone(proposal.steps);
  proposal.steps[0].expected_before = Object.fromEntries(['level_epoch', 'frame_hash', 'levels_completed', 'state'].map(key => [key, observation[key]]));
  for (const [index, action] of (proposal.actions as R[]).entries()) {
    const step = proposal.steps[index], chain = scene.chains[step.chain], [cx, cy] = chain.cells[step.rank], [x, y] = chain.points[step.rank];
    if (!equal(action, { action_ref: 'ACTION6', data: { x, y } })) throw new TypeError('Rooted action is not its measured chain cell');
    const box = [scene.x_lines[cx] + 1, scene.y_lines[cy] + 1, scene.x_lines[cx + 1] - 1, scene.y_lines[cy + 1] - 1];
    step.point_support = { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref, frame_hash: observation.frame_hash,
      point: [x, y], palette_value: rows[y]![x], projection_bbox: box, projected_rows_digest: await rowsDigest(projection(rows, box)),
      entity_ref: 'measured-rooted-cell:' + identity([scene.geometry_ref, cx, cy]), signature: identity([chain, step.rank]),
      scope: 'Current measured cell support; initial full-frame guard and conditional prefix-state checks for released continuation. Root/mark semantics remain hypotheses and official boundary stops suffix.' };
  }
  return proposal;
}

export function bindRootedQuota(proposal: R, domain: ObservedInputDomain): void {
  const first = proposal.steps[0].expected_before;
  if (!domain.bindings.has(`${first.level_epoch}:${first.frame_hash}`)) throw new TypeError('Rooted point domain not currently observed');
  for (const [index, action] of (proposal.actions as R[]).entries()) {
    const support = proposal.steps[index].point_support;
    if (!equal(support.point, [action.data.x, action.data.y])) throw new TypeError('Rooted point payload changed');
    proposal.steps[index].point_binding = { ...support };
  }
}
