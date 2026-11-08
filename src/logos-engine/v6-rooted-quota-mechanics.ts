/** Called V5 D contracts: finite integer-prefix propagation and indexed edit. */
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal } from './v6-operations.ts';

type R = Record<string, any>;
type Clock = () => number;
const MARGINAL_OPERATION = 'mechanics.coupled_value_constraints.rooted_prefix_marginals';
const STEP_OPERATION = 'mechanics.editable_configuration_graph.indexed_prefix_external_primitive';
const numeric = (a: number, b: number): number => a - b;
class Interrupted extends Error {
  readonly cause: string;
  readonly frontier: R;
  constructor(cause: string, frontier: R = {}) { super(cause); this.cause = cause; this.frontier = frontier; }
}
class Budget {
  examined = 0;
  private readonly started: number;
  readonly request: R;
  readonly now: Clock;
  constructor(request: R, now: Clock) { this.request = request; this.now = now; this.started = now(); }
  visit(frontier: R = {}): void {
    if (this.examined >= this.request.node_bound) throw new Interrupted('NODE_BOUND', frontier);
    if (this.now() - this.started >= this.request.time_bound_ms) throw new Interrupted('TIME_BOUND', frontier);
    this.examined++;
  }
  finish(): void { if (this.now() - this.started >= this.request.time_bound_ms) throw new Interrupted('TIME_BOUND'); }
}

function result(q: R, status: string, cause: string, values: R = {}, complete = false, examined = 0, frontier: R = {}): R {
  const facts: R = {};
  for (const key of ['request_ref', 'caller_ref', 'parent_consumer_ref', 'parent_goal_ref', 'parent_contribution_ref',
    'caller_next_item_ref', 'epoch', 'evidence_revision_ref', 'model_revision_ref', 'event_owner_ref']) facts[key] = q.scope[key];
  Object.assign(facts, { operation_ref: q.operation_ref, mode_ref: q.mode_ref, status, cause, domain_complete: complete,
    examined_count: examined, primitive_release_authorized: false, retained_model_refs: [] });
  return { schema_version: 'yf_arc3_v5.d_mechanical_result.v1', scope: structuredClone(q.scope), operation_ref: q.operation_ref,
    mode_ref: q.mode_ref, status, cause, values, domain_complete: complete, examined_count: examined, frontier,
    descriptive_facts: facts, source_disposition_ref: null, source_policy_ref: null };
}
function integer(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) throw new TypeError('Rooted mechanic requires an exact bounded integer');
}
function normalize(input: R, indexed: boolean): R {
  const q: R = { schema_version: indexed ? 'yf_arc3_v5.indexed_prefix_primitive_request_d.v1' : 'yf_arc3_v5.rooted_prefix_marginals_request_d.v1',
    observations: [], resume_frontier: {}, ...(indexed ? { quotas: [], bound_rank: null, native_focus_rank: null, reset_lengths: [] } : {}), ...structuredClone(input),
    scope: { assumption_refs: [], ...structuredClone(input.scope) } };
  for (const [key, maximum] of [['node_bound', 100000], ['depth_bound', 4096], ['domain_bound', 4096], ['time_bound_ms', 300000]] as const) integer(q[key], 1, maximum);
  integer(q.scope.epoch, 0);
  if (!Array.isArray(q.chains) || !q.chains.length || q.chains.length > 4096 || !Array.isArray(q.quotas)
    || q.quotas.length > 64 || !indexed && !q.quotas.length) throw new TypeError('Rooted chain/quota domain bounds');
  q.chains = q.chains.map((chain: R) => ({ ...(indexed ? {} : { evaluated_length: null }), ...chain,
    cells: chain.cells.map((cell: R) => ({ marginal_refs: [], ...cell })) }));
  const ids = q.chains.map((chain: R) => chain.chain_ref), cells = q.chains.flatMap((chain: R) => chain.cells.map((cell: R) => cell.cell_ref));
  if (new Set(ids).size !== ids.length || new Set(cells).size !== cells.length
    || new Set(q.quotas.map((quota: R) => quota.marginal_ref)).size !== q.quotas.length) throw new TypeError('Rooted identities must be distinct');
  for (const chain of q.chains as R[]) {
    if (!Array.isArray(chain.cells) || !chain.cells.length || chain.cells.length > 4096) throw new TypeError('Rooted cell domain bounds');
    for (const cell of chain.cells as R[]) if (!Array.isArray(cell.marginal_refs) || cell.marginal_refs.length > 64
      || new Set(cell.marginal_refs).size !== cell.marginal_refs.length) throw new TypeError('Duplicate or invalid cell marginal');
    if (indexed) integer(chain.filled_length, 0, chain.cells.length);
    else {
      if (!Array.isArray(chain.length_domain) || !chain.length_domain.length || chain.length_domain.length > 4096
        || new Set(chain.length_domain).size !== chain.length_domain.length) throw new TypeError('Length domain must contain distinct prefixes');
      for (const length of chain.length_domain) integer(length, 0, chain.cells.length);
      if (chain.evaluated_length !== null) {
        integer(chain.evaluated_length, 0);
        if (!chain.length_domain.includes(chain.evaluated_length)) throw new TypeError('Evaluated length outside admitted domain');
      }
    }
  }
  for (const quota of q.quotas) integer(quota.required_count, 0);
  if (indexed) {
    if (q.phase_ref !== 'EXTERNAL_COMMAND' || !['CLICK', 'FOCUS', 'ACTIVATE', 'RESET'].includes(q.channel)
      || !['REFUSE', 'CLAMP', 'WRAP'].includes(q.focus_boundary_rule)) throw new TypeError('Invalid indexed prefix phase/channel');
    for (const [ref, rank] of [[q.bound_chain_ref, q.bound_rank], [q.native_focus_chain_ref, q.native_focus_rank]]) {
      if ((ref === null) !== (rank === null)) throw new TypeError('Chain and rank must be jointly bound');
      if (ref !== null) { integer(rank, 0); if (!ids.includes(ref) || rank >= q.chains[ids.indexOf(ref)].cells.length) throw new TypeError('Bound chain/rank outside input domain'); }
    }
    if (!Number.isSafeInteger(q.focus_delta)) throw new TypeError('Invalid focus delta');
    if (q.reset_lengths.length) {
      if (q.reset_lengths.length !== ids.length) throw new TypeError('Reset vector outside rooted domain');
      q.reset_lengths.forEach((length: number, index: number) => integer(length, 0, q.chains[index].cells.length));
    }
    for (const key of ['submitted_cost', 'selection_cost', 'mutation_cost']) integer(q[key], 0);
  } else if (q.phase_ref !== 'INTEGER_QUOTA_CONSTRAINTS') throw new TypeError('Invalid marginal phase');
  return q;
}
function validate(q: R, operation: string, modes: string[]): R | null {
  if (q.operation_ref !== operation || !modes.includes(q.mode_ref) || q.requested_result_type !== 'DMechanicalResult') return result(q, 'NOT_APPLICABLE', 'SIGNATURE_MISMATCH');
  if (!q.scope.input_domain_complete) return result(q, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_INCOMPLETE');
  if (['evidence_revision_ref', 'model_revision_ref', 'event_owner_ref', 'caller_next_item_ref'].some(key => !q.scope[key])) return result(q, 'NEEDS_EVIDENCE', 'REQUEST_SCOPE_INCOMPLETE');
  return null;
}
function inputDigest(q: R): string {
  return identity(Object.fromEntries(Object.entries(q).filter(([key]) => !['node_bound', 'depth_bound', 'domain_bound', 'time_bound_ms', 'resume_frontier'].includes(key))));
}
function sumDomain(left: Set<number>, right: Set<number>, q: R, budget: Budget, frontier: R): Set<number> {
  const values = new Set<number>();
  for (const a of [...left].sort(numeric)) for (const b of [...right].sort(numeric)) {
    budget.visit(frontier); values.add(a + b);
    if (values.size > q.domain_bound) throw new Interrupted('FINITE_SUM_DOMAIN_BOUND', frontier);
  }
  return values;
}

export function measureRootedPrefixMarginals(input: R, now: Clock = () => performance.now()): R {
  const q = normalize(input, false), refusal = validate(q, MARGINAL_OPERATION, ['EVALUATE', 'PROPAGATE']);
  if (refusal) return refusal;
  if (q.chains.reduce((sum: number, chain: R) => sum + chain.cells.length + chain.length_domain.length, 0) > q.domain_bound) return result(q, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_BOUND');
  const budget = new Budget(q, now);
  let domains: number[][] = q.chains.map((chain: R) => [...chain.length_domain].sort(numeric)), removals: R[] = [], rounds = 0;
  if (Object.keys(q.resume_frontier).length) {
    const frontier = q.resume_frontier;
    if (frontier.input_digest !== inputDigest(q)) return result(q, 'NEEDS_EVIDENCE', 'RESUME_INPUT_OR_REVISION_MISMATCH');
    const saved = frontier.retained_domains ?? [];
    if (saved.length !== domains.length || saved.some((domain: number[], index: number) => domain.some(value => !domains[index]!.includes(value)))) return result(q, 'NEEDS_EVIDENCE', 'RESUME_DOMAIN_MISMATCH');
    domains = saved.map((domain: number[]) => [...domain]); removals = [...(frontier.removal_certificates ?? [])]; rounds = Number(frontier.completed_rounds ?? 0);
  }
  try {
    const contributions: R[][] = [];
    for (const chain of q.chains as R[]) {
      const counts: R = Object.fromEntries(q.quotas.map((quota: R) => [quota.marginal_ref, 0])), table: R[] = [{ ...counts }];
      for (const [rank, cell] of (chain.cells as R[]).entries()) {
        budget.visit({ stage: 'prefix_incidence', chain_ref: chain.chain_ref, length: rank + 1 });
        for (const marginal of cell.marginal_refs) if (Object.hasOwn(counts, marginal)) counts[marginal]++;
        table.push({ ...counts });
      }
      contributions.push(table);
    }
    if (q.mode_ref === 'EVALUATE') {
      if (q.chains.some((chain: R) => chain.evaluated_length === null)) return result(q, 'NEEDS_EVIDENCE', 'EVALUATED_LENGTH_VECTOR_MISSING', {}, false, budget.examined);
      const totals: R = Object.fromEntries(q.quotas.map((quota: R) => [quota.marginal_ref,
        q.chains.reduce((sum: number, chain: R, index: number) => sum + contributions[index]![chain.evaluated_length]![quota.marginal_ref], 0)]));
      budget.finish();
      return result(q, 'COMPLETE', 'INTEGER_MARGINALS_EVALUATED', { marginal_values: totals,
        residual_demands: Object.fromEntries(q.quotas.map((quota: R) => [quota.marginal_ref, quota.required_count - totals[quota.marginal_ref]])),
        all_quotas_equal: q.quotas.every((quota: R) => totals[quota.marginal_ref] === quota.required_count) }, true, budget.examined);
    }
    if (domains.some(domain => !domain.length)) return result(q, 'COMPLETE', 'EMPTY_DOMAIN_CONTRADICTION', { retained_domains: domains, removal_certificates: removals }, true, budget.examined);
    for (;;) {
      if (rounds >= q.depth_bound) throw new Interrupted('PROPAGATION_ROUND_BOUND');
      const pending = new Map<string, { index: number; length: number; certificate: R }>();
      for (const quota of q.quotas as R[]) {
        const ref = quota.marginal_ref, perChain = domains.map((domain, index) => new Set<number>(domain.map(length => contributions[index]![length]![ref])));
        const prefix: Set<number>[] = [new Set([0])], suffix: Set<number>[] = Array.from({ length: domains.length + 1 }, () => new Set([0]));
        for (const [index, values] of perChain.entries()) prefix.push(sumDomain(prefix.at(-1)!, values, q, budget, { stage: 'forward_support', quota_ref: ref, chain_index: index }));
        for (let i = domains.length - 1; i >= 0; i--) suffix[i] = sumDomain(perChain[i]!, suffix[i + 1]!, q, budget, { stage: 'backward_support', quota_ref: ref, chain_index: i });
        for (const [index, domain] of domains.entries()) {
          const others = sumDomain(prefix[index]!, suffix[index + 1]!, q, budget, { stage: 'other_chain_support', quota_ref: ref, chain_index: index });
          for (const length of domain) {
            budget.visit({ stage: 'length_support', quota_ref: ref, chain_index: index, length });
            const own = contributions[index]![length]![ref], key = `${index}:${length}`;
            if (!others.has(quota.required_count - own) && !pending.has(key)) pending.set(key, { index, length,
              certificate: { chain_ref: q.chains[index].chain_ref, length, quota_ref: ref, own_contribution: own,
                required_other_sum: quota.required_count - own, reachable_other_sums: [...others].sort(numeric), round: rounds } });
          }
        }
      }
      if (!pending.size) {
        budget.finish();
        return result(q, 'COMPLETE', 'QUOTA_LOCAL_FIXED_POINT', { chain_refs: q.chains.map((chain: R) => chain.chain_ref), retained_domains: domains,
          removal_certificates: removals, completed_rounds: rounds, all_domains_singleton: domains.every(domain => domain.length === 1),
          joint_assignment_witness_present: false, nonsingleton_is_contradiction: false }, true, budget.examined);
      }
      const next = domains.map((domain, index) => domain.filter(length => !pending.has(`${index}:${length}`)));
      removals.push(...[...pending.values()].sort((a, b) => a.index - b.index || a.length - b.length).map(item => item.certificate));
      domains = next; rounds++;
      if (domains.some(domain => !domain.length)) {
        budget.finish();
        return result(q, 'COMPLETE', 'EMPTY_DOMAIN_CONTRADICTION', { chain_refs: q.chains.map((chain: R) => chain.chain_ref),
          retained_domains: domains, removal_certificates: removals, completed_rounds: rounds }, true, budget.examined);
      }
    }
  } catch (error) {
    if (!(error instanceof Interrupted)) throw error;
    return result(q, 'NEEDS_EVIDENCE', error.cause, {}, false, budget.examined,
      { input_digest: inputDigest(q), retained_domains: domains, removal_certificates: removals, completed_rounds: rounds,
        restart_unfinished_round: true, work: error.frontier });
  }
}

export function measureIndexedPrefixPrimitive(input: R, now: Clock = () => performance.now()): R {
  const q = normalize(input, true), refusal = validate(q, STEP_OPERATION, ['STEP']);
  if (refusal) return refusal;
  if (q.chains.reduce((sum: number, chain: R) => sum + chain.cells.length, 0) > q.domain_bound) return result(q, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_BOUND');
  if (Object.keys(q.resume_frontier).length) return result(q, 'NEEDS_EVIDENCE', 'ATOMIC_COMMAND_REQUIRES_RESTART_FROM_BOUND_INPUT');
  const budget = new Budget(q, now), original: number[] = q.chains.map((chain: R) => chain.filled_length);
  let lengths = [...original], selected = [q.native_focus_chain_ref, q.native_focus_rank], target = [q.bound_chain_ref, q.bound_rank], cause = 'UNCHANGED';
  try {
    budget.visit({ stage: 'decode_bound_input' });
    const ids = new Map<string, number>(q.chains.map((chain: R, index: number) => [chain.chain_ref, index]));
    if (q.channel === 'RESET') {
      if (!q.reset_lengths.length) return result(q, 'NEEDS_EVIDENCE', 'RESET_LAW_MISSING', {}, false, budget.examined);
      lengths = [...q.reset_lengths]; cause = 'RESTORED_LENGTH_VECTOR';
    } else if (q.channel === 'FOCUS') {
      if (selected[0] === null) {
        if (!q.focus_initial_selection_supported || target[0] === null) return result(q, 'NEEDS_EVIDENCE', 'INITIAL_FOCUS_BINDING_MISSING', {}, false, budget.examined);
        selected = [...target];
      } else {
        const chain = q.chains[ids.get(selected[0])!], rank = selected[1] + q.focus_delta;
        if (0 <= rank && rank < chain.cells.length) selected = [selected[0], rank];
        else if (q.focus_boundary_rule === 'CLAMP') selected = [selected[0], Math.min(Math.max(rank, 0), chain.cells.length - 1)];
        else if (q.focus_boundary_rule === 'WRAP') selected = [selected[0], ((rank % chain.cells.length) + chain.cells.length) % chain.cells.length];
        else cause = 'FOCUS_BOUNDARY_REFUSAL';
      }
    } else {
      if (q.channel === 'ACTIVATE') target = [...selected];
      if (target[0] === null) cause = 'NO_BOUND_PREFIX_CELL';
      else if (!q.inclusive_fill_exclusive_cut_supported) return result(q, 'NEEDS_EVIDENCE', 'PREFIX_EDIT_LAW_MISSING', {}, false, budget.examined);
      else { const i = ids.get(target[0])!, rank = target[1]; lengths[i] = rank >= lengths[i]! ? rank + 1 : rank; selected = [...target]; cause = 'PREFIX_MUTATION'; }
    }
    const beforeCounts: R = {}, afterCounts: R = {};
    for (const [i, chain] of (q.chains as R[]).entries()) for (const [rank, cell] of (chain.cells as R[]).entries()) {
      budget.visit({ stage: 'marginals', chain_ref: chain.chain_ref, rank });
      for (const marginal of cell.marginal_refs) {
        beforeCounts[marginal] = (beforeCounts[marginal] ?? 0) + Number(rank < original[i]!);
        afterCounts[marginal] = (afterCounts[marginal] ?? 0) + Number(rank < lengths[i]!);
      }
    }
    const changed = !equal(lengths, original), selectionChanged = !equal(selected, [q.native_focus_chain_ref, q.native_focus_rank]);
    const acceptance = q.quota_acceptance_supported ? q.quotas.every((quota: R) => (afterCounts[quota.marginal_ref] ?? 0) === quota.required_count) : null;
    budget.finish();
    return result(q, 'COMPLETE', cause, { chain_refs: q.chains.map((chain: R) => chain.chain_ref), filled_lengths: lengths,
      native_focus_chain_ref: selected[0], native_focus_rank: selected[1], prefix_mutation_count: Number(changed), accepted_selection_count: Number(selectionChanged),
      changed_cell_count: original.reduce((sum, value, i) => sum + Math.abs(value - lengths[i]!), 0), submitted_command_count: 1,
      submitted_cost: q.submitted_cost, selection_cost: selectionChanged ? q.selection_cost : 0, mutation_cost: changed ? q.mutation_cost : 0,
      marginal_counts: afterCounts, marginal_deltas: Object.fromEntries([...new Set([...Object.keys(beforeCounts), ...Object.keys(afterCounts)])].sort()
        .map(key => [key, (afterCounts[key] ?? 0) - (beforeCounts[key] ?? 0)])), quota_predicate_satisfied: acceptance,
      complete_response_boundary_count: 1, quota_overshoot_causes_reset: false }, true, budget.examined);
  } catch (error) {
    if (!(error instanceof Interrupted)) throw error;
    return result(q, 'NEEDS_EVIDENCE', error.cause, {}, false, budget.examined, { restart_atomic_command: true, work: error.frontier });
  }
}

export function rootedQuotaCells(scene: R): R[] {
  return scene.chains.map((chain: R, i: number) => ({ chain_ref: `chain:${i}`, cells: chain.cells.map(([x, y]: number[]) =>
    ({ cell_ref: `cell:${x}:${y}`, marginal_refs: [`row:${y}`, `column:${x}`] })) }));
}
export function rootedQuotaQuotas(scene: R): R[] {
  return [['row', scene.row_marks], ['column', scene.column_marks]].flatMap(([axis, values]) =>
    (values as number[]).map((value, i) => ({ marginal_ref: `${axis}:${i}`, required_count: value })));
}
export function rootedQuotaRequestBase(observation: R, model: R, contribution: string, deadlineMs: number, now: Clock): R {
  return { scope: { request_ref: 'request:' + identity([observation.observation_ref, contribution]), caller_ref: 'public_rooted_quota_composition',
    parent_consumer_ref: 'SRC_composition', parent_goal_ref: 'G_official_completion', parent_contribution_ref: contribution,
    caller_next_item_ref: observation.observation_ref, epoch: observation.level_epoch, evidence_revision_ref: observation.observation_ref,
    model_revision_ref: identity(model), model_status_ref: 'conditional_public_hypothesis_with_observed_edit_examples', event_owner_ref: 'SRC',
    input_domain_complete: true, assumption_refs: ['measured_marks_as_required_integer_marginals', 'wider_endpoint_as_root', 'scoped_prefix_edit_transfer'] },
  requested_result_type: 'DMechanicalResult', node_bound: 100000, depth_bound: 4096, domain_bound: 4096,
  time_bound_ms: Math.max(1, Math.min(300000, Math.trunc(deadlineMs - now()))) };
}
export function propagateRootedQuota(scene: R, observation: R, model: R, deadlineMs: number, now: Clock = () => performance.now()): R {
  return measureRootedPrefixMarginals({ ...rootedQuotaRequestBase(observation, model, 'conditional_joint_marginals', deadlineMs, now),
    operation_ref: MARGINAL_OPERATION, mode_ref: 'PROPAGATE', phase_ref: 'INTEGER_QUOTA_CONSTRAINTS',
    chains: rootedQuotaCells(scene).map(chain => ({ ...chain, length_domain: Array.from({ length: chain.cells.length + 1 }, (_, i) => i) })),
    quotas: rootedQuotaQuotas(scene) }, now);
}
export function stepRootedQuota(scene: R, lengths: number[], chain: number, rank: number, observation: R, model: R,
  deadlineMs: number, now: Clock = () => performance.now()): R {
  if (!model.addition_observed || !model.cut_observed) throw new TypeError('Indexed edit requires observed addition and cut');
  return measureIndexedPrefixPrimitive({ ...rootedQuotaRequestBase(observation, model, 'conditional_indexed_edit', deadlineMs, now),
    operation_ref: STEP_OPERATION, mode_ref: 'STEP', phase_ref: 'EXTERNAL_COMMAND',
    chains: rootedQuotaCells(scene).map((value, i) => ({ ...value, filled_length: lengths[i] })), quotas: rootedQuotaQuotas(scene),
    channel: 'CLICK', bound_chain_ref: `chain:${chain}`, bound_rank: rank, native_focus_chain_ref: null, native_focus_rank: null,
    inclusive_fill_exclusive_cut_supported: true, focus_initial_selection_supported: false, focus_boundary_rule: 'REFUSE', focus_delta: 0,
    submitted_cost: 1, selection_cost: 0, mutation_cost: 0, quota_acceptance_supported: false }, now);
}
