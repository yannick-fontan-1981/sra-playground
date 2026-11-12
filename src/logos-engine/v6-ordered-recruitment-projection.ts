/** Source-ordered conditional projections for V6 ordered_recruitment.
 * Each local queue reduction calls the consumed V5 request/kernel. No plan
 * asserts actual success, a complete acquired law, or an external input right.
 * Source revision: 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 */
import { recruitmentDigest } from './v6-ordered-recruitment-geometry.ts';
import { measureOrderedFrontReductionD, normalizeHeadDuelRuleD, normalizeOrderedMechanicalScopeD } from './v5-ordered-front-reduction.ts';
import type { HeadDuelRuleD } from './v5-ordered-front-reduction.ts';
import type { NativeExecution } from './v6-native-types.ts';

type R = Record<string, any>;
export type OrderedRecruitmentAlternatives = [R[], R];
export interface OrderedRecruitmentBudget {
  /** Host bounds are separate from source cfg.search_bound and V5's 4096. */
  node_bound?: number; time_bound_ms?: number; now?: () => number;
  signal?: AbortSignal; deadlineMs?: number; yieldEvery?: number;
  /** Optional millisecond clock for deterministic source-kernel comparisons. */
  reductionNowMs?: () => number;
}
interface Progress { visited: number; completed_reductions: number; incomplete_reduction?: string }
interface SearchNode { room: number; phase: string; quota: number | null; queue: number[]; steps: R[]; trace: R[] }

export function orderedRecruitmentSummary(m: R): R {
  const room = m.rooms[m.current];
  return { room: m.current, phase: m.phase_hypothesis, quota: m.quota, queue: room.left.map((u: R) => u.type), enemy: room.right.map((u: R) => u.type) };
}

/** An explicit DFS stack preserves recursive Python visitation and tie order,
 * including visits after search_bound has first been exceeded. It only removes
 * the host call-stack limit; cached reductions remain local to this search. */
function* search(m: R, cfg: R, obs: R, remaining: number, progress: Progress, reductionNowMs?: () => number): Generator<void, OrderedRecruitmentAlternatives> {
  if (cfg.queue_order_hypothesis !== 'front_spiral_inward' || cfg.append_hypothesis !== 'tail' || cfg.winner_hypothesis !== 'KEEP') {
    return [[], { truncated: false, cause: 'unsupported_declared_model' }];
  }
  const pairs: number[][] = m.legend.pairs, ids = new Map<number, number>();
  pairs.forEach((pair, i) => pair.forEach(v => ids.set(v, i)));
  const wins = new Set<string>(m.legend.relations.map((r: R) => `${ids.get(r.left[0])},${ids.get(r.right[0])}`)), rules: HeadDuelRuleD[] = [];
  for (let a = 0; a < pairs.length; a++) for (let b = 0; b < pairs.length; b++) {
    const outcome = a === b ? 'TIE' : wins.has(`${a},${b}`) ? 'LEFT' : wins.has(`${b},${a}`) ? 'RIGHT' : null;
    if (outcome === null) return [[], { truncated: false, cause: 'incomplete_relation_hypothesis' }];
    rules.push(normalizeHeadDuelRuleD({ left_type_ref: `type:${a}`, right_type_ref: `type:${b}`, result: outcome, winner_rank_rule: cfg.winner_hypothesis,
      winner_rank_value: null, law_evidence_ref: `hypothesis:current_legend:${recruitmentDigest(m.legend)}` }));
  }
  const scope = normalizeOrderedMechanicalScopeD({ request_ref: `ordered_projection:${obs.observation_ref}`, caller_ref: 'ordered_recruitment', parent_consumer_ref: 'G_official_completion',
    parent_goal_ref: 'G_official_completion', parent_contribution_ref: 'visible_room_survival_hypothesis', caller_next_item_ref: 'choose_current_bound_input', epoch: obs.level_epoch,
    evidence_revision_ref: obs.observation_ref, model_revision_ref: recruitmentDigest([cfg, m.legend]), model_status_ref: 'conditional_not_acquired_full_law',
    event_owner_ref: 'current_public_question', input_domain_complete: true, assumption_refs: [...cfg.hypotheses] });
  const cache = new Map<string, [number[], number[], R[]]>();
  function reduce(queue: number[], enemy: number[]): [number[], number[], R[]] | null {
    const key = JSON.stringify([queue, enemy]);
    if (cache.has(key)) return cache.get(key)!;
    const left = queue.map((t, i) => ({ occurrence_ref: `ally:${i}`, type_ref: `type:${t}`, camp_ref: 'player', rank: i }));
    const right = enemy.map((t, i) => ({ occurrence_ref: `enemy:${i}`, type_ref: `type:${t}`, camp_ref: 'enemy', rank: i }));
    const result = measureOrderedFrontReductionD({ scope, operation_ref: 'mechanics.typed_word_transduction.ordered_front_reduction', mode_ref: 'STEP_INTERNAL',
      requested_result_type: 'DMechanicalResult', node_bound: 4096, depth_bound: 4096, domain_bound: 4096, time_bound_ms: 1000,
      phase_ref: 'INTERNAL_ENGAGEMENT', left_queue: left, right_queue: right, left_camp_ref: 'player', right_camp_ref: 'enemy', head_rules: rules,
      tie_rule: cfg.tie_hypothesis, closure_scope: 'engagement', parent_command_ref: 'hypothetical_engage', left_queue_revision_ref: obs.observation_ref,
      right_queue_revision_ref: obs.observation_ref, completed_duel_cursor: 0 }, reductionNowMs);
    if (!result.domain_complete) { progress.incomplete_reduction ??= result.cause; return null; }
    progress.completed_reductions++;
    const values = result.values;
    const answer: [number[], number[], R[]] = [values.left_queue.map((u: R) => Number(u.type_ref.split(':').at(-1))),
      values.right_queue.map((u: R) => Number(u.type_ref.split(':').at(-1))), values.consumption_trace];
    cache.set(key, answer); return answer;
  }
  const plans: R[] = [], rooms: R[] = m.rooms, buttons = new Map<number, R>(m.buttons.map((b: R) => [b.type, b]));
  const buttonTypes = [...buttons.keys()].sort((a, b) => a - b), start = orderedRecruitmentSummary(m);
  const stack: SearchNode[] = [{ room: start.room, phase: start.phase, quota: start.quota, queue: start.queue, steps: [], trace: [] }];
  let truncated = false;
  while (stack.length) {
    // The driver checks native interruption before each source visit.
    yield;
    const { room, phase, quota, queue, steps, trace } = stack.pop()!;
    progress.visited++;
    if (progress.visited > cfg.search_bound) { truncated = true; continue; }
    if (steps.length > remaining) continue;
    if (phase === 'COMBAT') {
      const enemy = rooms[room]!.right.map((u: R) => u.type), result = reduce(queue, enemy);
      if (result === null || !result[0].length || result[1].length) continue;
      const [survivors, , events] = result, before = { room, phase: 'COMBAT', quota: null, queue, enemy }, final = room === rooms.length - 1, nextquota = rooms[room]!.quota_hypothesis;
      const after = final ? null : { room, phase: 'RECRUIT', quota: nextquota, queue: survivors, enemy: [] };
      const step = { action: { action_ref: cfg.engage_prior }, expected_context: before, projected_context: after, kind: 'engage', type: null }, chain = [...steps, step];
      if (final) {
        if (chain.length <= remaining) plans.push({ steps: chain, cost: chain.length, survivors: survivors.length, trace: [...trace, ...events], status: 'conditional_all_visible_stages_not_actual_success' });
      } else if (nextquota > 0) stack.push({ room, phase: 'RECRUIT', quota: nextquota, queue: survivors, steps: chain, trace: [...trace, ...events] });
    } else {
      if (quota === null || quota < 1 || quota > cfg.quota_bound) continue;
      // Reverse pushes produce exactly Python's ascending button DFS order.
      for (let index = buttonTypes.length - 1; index >= 0; index--) {
        const typ = buttonTypes[index]!, queue2 = [...queue, typ], last = quota === 1, nextroom = last ? room + 1 : room;
        if (nextroom >= rooms.length) continue;
        const after = { room: nextroom, phase: last ? 'COMBAT' : 'RECRUIT', quota: last ? null : quota - 1, queue: queue2,
          enemy: last ? rooms[nextroom]!.right.map((u: R) => u.type) : [] }, b = buttons.get(typ)!;
        const step = { action: { action_ref: cfg.point_action, data: { x: b.point[0], y: b.point[1] } }, expected_context: { room, phase: 'RECRUIT', quota, queue, enemy: [] },
          projected_context: after, kind: 'assign', type: typ };
        stack.push({ room: nextroom, phase: after.phase, quota: after.quota, queue: queue2, steps: [...steps, step], trace });
      }
    }
  }
  return [plans, { visited: progress.visited, truncated, incompleteness_is_not_impossibility: true, reused: 'measure_ordered_front_reduction_d' }];
}

class NativeGuard {
  private readonly now: () => number; private readonly started: number;
  private readonly budget: OrderedRecruitmentBudget; private readonly execution?: NativeExecution;
  constructor(budget: OrderedRecruitmentBudget, execution?: NativeExecution) {
    this.budget = budget; this.execution = execution;
    this.now = execution?.now ?? budget.now ?? (() => performance.now()); this.started = this.now();
    for (const key of ['node_bound', 'time_bound_ms', 'yieldEvery'] as const) if (budget[key] !== undefined
      && (!Number.isSafeInteger(budget[key]) || budget[key]! < 1)) throw new TypeError(`Invalid recruitment native ${key}`);
    if (budget.deadlineMs !== undefined && !Number.isFinite(budget.deadlineMs)) throw new TypeError('Invalid recruitment native deadline');
  }
  reason(progress: Progress, finishing = false): string | null {
    if (this.execution?.signal?.aborted || this.budget.signal?.aborted) return 'native_abort';
    const now = this.now(), deadline = this.execution?.deadlineMs ?? this.budget.deadlineMs;
    if (deadline !== undefined && now >= deadline) return 'native_deadline';
    if (this.budget.time_bound_ms !== undefined && now - this.started >= this.budget.time_bound_ms) return 'native_time_bound';
    if (!finishing && this.budget.node_bound !== undefined && progress.visited >= this.budget.node_bound) return 'native_node_bound';
    if (progress.incomplete_reduction) return 'native_reduction_incomplete';
    return null;
  }
}
function incomplete(progress: Progress, reason: string): OrderedRecruitmentAlternatives {
  return [[], { visited: progress.visited, truncated: true, incompleteness_is_not_impossibility: true, reused: 'measure_ordered_front_reduction_d',
    native_search_incomplete: { reason, frontier: { visited: progress.visited, completed_reductions: progress.completed_reductions,
      ...(progress.incomplete_reduction ? { reduction_cause: progress.incomplete_reduction } : {}) } } }];
}

/** No host budget: exact source alternatives, including retained partial plans
 * and source truncated/search count. An explicit native budget fails closed. */
export function orderedRecruitmentAlternatives(m: R, cfg: R, obs: R, remaining: number, budget?: OrderedRecruitmentBudget): OrderedRecruitmentAlternatives {
  const progress: Progress = { visited: 0, completed_reductions: 0 }, iterator = search(m, cfg, obs, remaining, progress, budget?.reductionNowMs), guard = budget ? new NativeGuard(budget) : null;
  for (;;) {
    const reason = guard?.reason(progress); if (reason) { iterator.return([[], {}]); return incomplete(progress, reason); }
    const step = iterator.next();
    if (step.done) { const endReason = guard?.reason(progress, true); return endReason ? incomplete(progress, endReason) : step.value; }
  }
}

/** Bounded cooperative host adaptation. Yielding never drops a source branch;
 * interruption does drop all candidate plans and carries an explicit frontier.
 * Each V5 reduction independently keeps its original 1000 ms / 4096 bounds. */
export async function orderedRecruitmentAlternativesCooperative(m: R, cfg: R, obs: R, remaining: number, execution?: NativeExecution, budget: OrderedRecruitmentBudget = {}): Promise<OrderedRecruitmentAlternatives> {
  const limits = { node_bound: 50_000, time_bound_ms: 1_000, yieldEvery: 32, ...budget }, progress: Progress = { visited: 0, completed_reductions: 0 };
  const guard = new NativeGuard(limits, execution), iterator = search(m, cfg, obs, remaining, progress, budget.reductionNowMs); let visitsSinceYield = 0;
  for (;;) {
    const reason = guard.reason(progress); if (reason) { iterator.return([[], {}]); return incomplete(progress, reason); }
    const step = iterator.next();
    if (step.done) { const endReason = guard.reason(progress, true); return endReason ? incomplete(progress, endReason) : step.value; }
    if (++visitsSinceYield >= limits.yieldEvery && execution) {
      visitsSinceYield = 0;
      try { await execution.yieldControl(); }
      catch (error) {
        if (execution.signal?.aborted || error instanceof Error && error.name === 'AbortError') { iterator.return([[], {}]); return incomplete(progress, 'native_abort'); }
        throw error;
      }
    }
  }
}
