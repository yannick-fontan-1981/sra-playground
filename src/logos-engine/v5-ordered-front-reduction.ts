/** Consumed V5 ordered_front_reduction_d.py and mechanical_family_contracts_d.
 * Source revision: 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 * This is the real bounded head-duel mechanism, including request validation,
 * suspended consumed prefixes and immutable descriptive return scope.
 */
import { canonical, immutableJson, isJsonObject } from './canonical.ts';
import { symbolicDigest } from './v6-hash.ts';

type R = Record<string, any>;
export interface DuelOccurrenceD { occurrence_ref: string; type_ref: string; camp_ref: string; rank: number }
export interface HeadDuelRuleD {
  left_type_ref: string; right_type_ref: string; result: 'LEFT' | 'RIGHT' | 'TIE';
  winner_rank_rule: 'KEEP' | 'ADD_ONE' | 'SET'; winner_rank_value: number | null; law_evidence_ref: string;
}
export interface OrderedMechanicalScopeD {
  request_ref: string; caller_ref: string; parent_consumer_ref: string; parent_goal_ref: string;
  parent_contribution_ref: string; caller_next_item_ref: string; epoch: number;
  evidence_revision_ref: string; model_revision_ref: string; model_status_ref: string;
  event_owner_ref: string; input_domain_complete: boolean; assumption_refs: string[];
}
export interface OrderedFrontReductionRequestD {
  scope: OrderedMechanicalScopeD; operation_ref: string; mode_ref: string | null; requested_result_type: string;
  node_bound: number; depth_bound: number; domain_bound: number; time_bound_ms: number;
  observations: R[]; resume_frontier: R; schema_version: string; phase_ref: 'INTERNAL_ENGAGEMENT';
  left_queue: DuelOccurrenceD[]; right_queue: DuelOccurrenceD[]; left_camp_ref: string; right_camp_ref: string;
  head_rules: HeadDuelRuleD[]; tie_rule: 'REMOVE_BOTH' | 'KEEP_LEFT' | 'KEEP_RIGHT' | 'STOP';
  closure_scope: 'one_duel' | 'engagement'; parent_command_ref: string;
  left_queue_revision_ref: string; right_queue_revision_ref: string; completed_duel_cursor: number;
}
export interface OrderedMechanicalResultD {
  schema_version: 'yf_arc3_v5.d_mechanical_result.v1'; scope: OrderedMechanicalScopeD;
  operation_ref: string; mode_ref: string | null; status: string; cause: string; values: R;
  domain_complete: boolean; examined_count: number; frontier: R; descriptive_facts: R;
  source_disposition_ref: null; source_policy_ref: null;
}
const SCOPE_FIELDS = ['request_ref', 'caller_ref', 'parent_consumer_ref', 'parent_goal_ref', 'parent_contribution_ref', 'caller_next_item_ref',
  'epoch', 'evidence_revision_ref', 'model_revision_ref', 'model_status_ref', 'event_owner_ref', 'input_domain_complete', 'assumption_refs'];
const REQUEST_FIELDS = ['scope', 'operation_ref', 'mode_ref', 'requested_result_type', 'node_bound', 'depth_bound', 'domain_bound', 'time_bound_ms',
  'observations', 'resume_frontier', 'schema_version', 'phase_ref', 'left_queue', 'right_queue', 'left_camp_ref', 'right_camp_ref', 'head_rules',
  'tie_rule', 'closure_scope', 'parent_command_ref', 'left_queue_revision_ref', 'right_queue_revision_ref', 'completed_duel_cursor'];
const WHITESPACE = /^[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/g;
const ownOr = (r: R, k: string, fallback: unknown): any => Object.hasOwn(r, k) ? r[k] : fallback;
function record(value: unknown, fields: readonly string[], name: string): R {
  if (!isJsonObject(value) || Object.keys(value).some(k => !fields.includes(k))) throw new TypeError(`${name} requires only declared fields`);
  return value;
}
function ref(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Mechanical references must be strings');
  const result = value.replace(WHITESPACE, '');
  if (!result.length) throw new TypeError('Mechanical references must not be empty');
  return result;
}
function integer(value: unknown, minimum = -Number.MAX_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER): number {
  let result: unknown = value;
  if (typeof result === 'boolean') result = Number(result);
  else if (typeof result === 'string' && /^[+-]?\d+(?:\.0+)?$/.test(result.trim())) result = Number(result.trim());
  if (typeof result !== 'number' || !Number.isSafeInteger(result) || result < minimum || result > maximum) throw new TypeError('Mechanical integer outside the exact native domain');
  return Object.is(result, -0) ? 0 : result;
}
function boolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 0 || value === 1) return value === 1;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (['0', 'off', 'f', 'false', 'n', 'no'].includes(lower)) return false;
    if (['1', 'on', 't', 'true', 'y', 'yes'].includes(lower)) return true;
  }
  throw new TypeError('Invalid mechanical boolean');
}
function sequence<T>(value: unknown, read: (item: unknown) => T, minimum = 0, maximum = 4096): T[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) throw new TypeError('Invalid mechanical sequence');
  return value.map(read);
}
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new TypeError('Unknown mechanical literal'); return value as T;
}
function frozen<T>(value: T): T { return immutableJson(value) as T; }
function descriptiveMap(value: unknown): R {
  // FrozenMap(None) is the empty mapping, including within observations.
  if (value === null) value = {};
  if (!isJsonObject(value)) throw new TypeError('Mechanical descriptive map must be a mapping');
  // Native JSON-domain qualification: exact safe integers, strings, booleans
  // and null; no claim about arbitrary Python objects or float/int tags.
  canonical(value);
  const validateKeys = (item: unknown): void => {
    if (Array.isArray(item)) { for (const child of item) validateKeys(child); }
    else if (isJsonObject(item)) for (const [k, child] of Object.entries(item)) {
      if (!k.replace(/[\u001c-\u001f]/g, '').replace(WHITESPACE, '').length) throw new TypeError('FrozenMap keys must be non-empty strings');
      validateKeys(child);
    }
  };
  validateKeys(value); return immutableJson(value) as R;
}

export function normalizeDuelOccurrenceD(value: unknown): DuelOccurrenceD {
  const r = record(value, ['occurrence_ref', 'type_ref', 'camp_ref', 'rank'], 'DuelOccurrenceD');
  return frozen({ occurrence_ref: ref(r.occurrence_ref), type_ref: ref(r.type_ref), camp_ref: ref(r.camp_ref), rank: integer(r.rank) });
}
export function normalizeHeadDuelRuleD(value: unknown): HeadDuelRuleD {
  const r = record(value, ['left_type_ref', 'right_type_ref', 'result', 'winner_rank_rule', 'winner_rank_value', 'law_evidence_ref'], 'HeadDuelRuleD');
  return frozen({ left_type_ref: ref(r.left_type_ref), right_type_ref: ref(r.right_type_ref), result: choice(r.result, ['LEFT', 'RIGHT', 'TIE']),
    winner_rank_rule: choice(r.winner_rank_rule, ['KEEP', 'ADD_ONE', 'SET']), winner_rank_value: r.winner_rank_value === null ? null : integer(r.winner_rank_value), law_evidence_ref: ref(r.law_evidence_ref) });
}
export function normalizeOrderedMechanicalScopeD(value: unknown): OrderedMechanicalScopeD {
  const r = record(value, SCOPE_FIELDS, 'DMechanicalScope');
  return frozen({ request_ref: ref(r.request_ref), caller_ref: ref(r.caller_ref), parent_consumer_ref: ref(r.parent_consumer_ref), parent_goal_ref: ref(r.parent_goal_ref),
    parent_contribution_ref: ref(r.parent_contribution_ref), caller_next_item_ref: ref(r.caller_next_item_ref), epoch: integer(r.epoch, 0),
    evidence_revision_ref: ref(r.evidence_revision_ref), model_revision_ref: ref(r.model_revision_ref), model_status_ref: ref(r.model_status_ref),
    event_owner_ref: ref(r.event_owner_ref), input_domain_complete: boolean(r.input_domain_complete), assumption_refs: sequence(ownOr(r, 'assumption_refs', []), ref, 0, 64) });
}

/** Source-shaped Pydantic defaults and invariants on the admitted JSON domain.
 * Coercion does not round unsafe integers and never mutates caller input. */
export function normalizeOrderedFrontReductionRequestD(value: unknown): OrderedFrontReductionRequestD {
  const r = record(value, REQUEST_FIELDS, 'OrderedFrontReductionRequestD');
  const request: OrderedFrontReductionRequestD = {
    scope: normalizeOrderedMechanicalScopeD(r.scope), operation_ref: ref(r.operation_ref), mode_ref: r.mode_ref === null ? null : ref(r.mode_ref), requested_result_type: ref(r.requested_result_type),
    node_bound: integer(r.node_bound, 1, 100000), depth_bound: integer(r.depth_bound, 1, 4096), domain_bound: integer(r.domain_bound, 1, 4096), time_bound_ms: integer(r.time_bound_ms, 1, 300000),
    observations: sequence(ownOr(r, 'observations', []), descriptiveMap), resume_frontier: descriptiveMap(ownOr(r, 'resume_frontier', {})),
    schema_version: ref(ownOr(r, 'schema_version', 'yf_arc3_v5.ordered_front_reduction_request_d.v1')), phase_ref: choice(r.phase_ref, ['INTERNAL_ENGAGEMENT']),
    left_queue: sequence(ownOr(r, 'left_queue', []), normalizeDuelOccurrenceD), right_queue: sequence(ownOr(r, 'right_queue', []), normalizeDuelOccurrenceD),
    left_camp_ref: ref(r.left_camp_ref), right_camp_ref: ref(r.right_camp_ref), head_rules: sequence(r.head_rules, normalizeHeadDuelRuleD, 1),
    tie_rule: choice(r.tie_rule, ['REMOVE_BOTH', 'KEEP_LEFT', 'KEEP_RIGHT', 'STOP']), closure_scope: choice(r.closure_scope, ['one_duel', 'engagement']),
    parent_command_ref: ref(r.parent_command_ref), left_queue_revision_ref: ref(r.left_queue_revision_ref), right_queue_revision_ref: ref(r.right_queue_revision_ref), completed_duel_cursor: integer(r.completed_duel_cursor, 0),
  };
  const all = [...request.left_queue, ...request.right_queue];
  if (new Set(all.map(o => o.occurrence_ref)).size !== all.length || request.left_queue.some(o => o.camp_ref !== request.left_camp_ref)
    || request.right_queue.some(o => o.camp_ref !== request.right_camp_ref)) throw new TypeError('Ordered occurrences/camps must be distinct and correctly scoped');
  if (new Set(request.head_rules.map(r => JSON.stringify([r.left_type_ref, r.right_type_ref]))).size !== request.head_rules.length
    || request.head_rules.some(r => r.winner_rank_rule === 'SET' && r.winner_rank_value === null)) throw new TypeError('Head relation or supported winner-rank law is incomplete');
  return frozen(request);
}

export class OrderedFrontReductionInterrupted extends Error {
  readonly cause: string; readonly frontier: R;
  constructor(cause: string, frontier: R = {}) { super(cause); this.name = 'DComputationInterrupted'; this.cause = cause; this.frontier = descriptiveMap(frontier); }
}
/** Millisecond clock injection mirrors source monotonic() * 1000. */
export class OrderedFrontReductionWorkBudget {
  readonly request: Pick<OrderedFrontReductionRequestD, 'node_bound' | 'time_bound_ms'>;
  readonly started: number; examined = 0; private readonly now: () => number;
  constructor(request: Pick<OrderedFrontReductionRequestD, 'node_bound' | 'time_bound_ms'>, now = () => performance.now()) {
    this.request = request; this.now = now; this.started = now();
  }
  visit(frontier: R = {}): void {
    if (this.examined >= this.request.node_bound) throw new OrderedFrontReductionInterrupted('NODE_BOUND', frontier);
    if (this.now() - this.started >= this.request.time_bound_ms) throw new OrderedFrontReductionInterrupted('TIME_BOUND', frontier);
    this.examined++;
  }
  finish(): void { if (this.now() - this.started >= this.request.time_bound_ms) throw new OrderedFrontReductionInterrupted('TIME_BOUND', {}); }
}

function result(request: OrderedFrontReductionRequestD, status: string, cause: string, options: { values?: R; complete?: boolean; examined?: number; frontier?: R } = {}): OrderedMechanicalResultD {
  const complete = options.complete ?? false, examined = options.examined ?? 0, scope = request.scope;
  const facts = { request_ref: scope.request_ref, caller_ref: scope.caller_ref, parent_consumer_ref: scope.parent_consumer_ref,
    parent_goal_ref: scope.parent_goal_ref, parent_contribution_ref: scope.parent_contribution_ref, caller_next_item_ref: scope.caller_next_item_ref,
    epoch: scope.epoch, evidence_revision_ref: scope.evidence_revision_ref, model_revision_ref: scope.model_revision_ref, event_owner_ref: scope.event_owner_ref,
    operation_ref: request.operation_ref, mode_ref: request.mode_ref, status, cause, domain_complete: complete, examined_count: examined,
    primitive_release_authorized: false, retained_model_refs: [] };
  return frozen({ schema_version: 'yf_arc3_v5.d_mechanical_result.v1', scope, operation_ref: request.operation_ref, mode_ref: request.mode_ref,
    status, cause, values: options.values ?? {}, domain_complete: complete, examined_count: examined, frontier: options.frontier ?? {},
    descriptive_facts: facts, source_disposition_ref: null, source_policy_ref: null });
}
function inputDigest(request: OrderedFrontReductionRequestD): string {
  const excluded = new Set(['node_bound', 'depth_bound', 'domain_bound', 'time_bound_ms', 'resume_frontier']);
  return symbolicDigest(Object.fromEntries(Object.entries(request).filter(([k]) => !excluded.has(k))));
}
export function orderedFrontReductionInputDigest(request: unknown): string { return inputDigest(normalizeOrderedFrontReductionRequestD(request)); }
function iterable(value: unknown): any[] {
  if (Array.isArray(value)) return [...value];
  if (typeof value === 'string') return [...value];
  if (isJsonObject(value)) return Object.keys(value).sort();
  throw new TypeError('Suspended frontier member is not iterable');
}
function resumeCursor(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return integer(Math.trunc(value));
  if (typeof value === 'string') {
    const s = value.trim();
    if (!/^[+-]?\d(?:_?\d)*$/.test(s)) throw new TypeError('Invalid resumed duel cursor');
    return integer(s.replace(/_/g, ''));
  }
  return integer(value);
}

export function measureOrderedFrontReductionD(raw: unknown, nowMs = () => performance.now()): OrderedMechanicalResultD {
  const request = normalizeOrderedFrontReductionRequestD(raw);
  if (request.operation_ref !== 'mechanics.typed_word_transduction.ordered_front_reduction' || request.mode_ref !== 'STEP_INTERNAL'
    || request.requested_result_type !== 'DMechanicalResult') return result(request, 'NOT_APPLICABLE', 'SIGNATURE_MISMATCH');
  if (!request.scope.input_domain_complete) return result(request, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_INCOMPLETE');
  if (![request.scope.evidence_revision_ref, request.scope.model_revision_ref, request.scope.event_owner_ref, request.scope.caller_next_item_ref].every(Boolean)) return result(request, 'NEEDS_EVIDENCE', 'REQUEST_SCOPE_INCOMPLETE');
  if (Math.max(request.left_queue.length + request.right_queue.length, request.head_rules.length) > request.domain_bound) return result(request, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_BOUND');
  let left = [...request.left_queue], right = [...request.right_queue], trace: R[] = [], cursor = request.completed_duel_cursor;
  if (Object.keys(request.resume_frontier).length) {
    const f = request.resume_frontier;
    if (f.input_digest !== inputDigest(request) || f.parent_command_ref !== request.parent_command_ref) return result(request, 'NEEDS_EVIDENCE', 'RESUME_COMMAND_OR_REVISION_MISMATCH');
    left = iterable(ownOr(f, 'left_queue', [])).map(normalizeDuelOccurrenceD); right = iterable(ownOr(f, 'right_queue', [])).map(normalizeDuelOccurrenceD);
    trace = iterable(ownOr(f, 'consumption_trace', [])); cursor = resumeCursor(ownOr(f, 'completed_duel_cursor', request.completed_duel_cursor));
    for (const [current, original] of [[left, request.left_queue], [right, request.right_queue]]) {
      const refs = current!.map(o => o.occurrence_ref), expected = refs.length ? original!.slice(-refs.length).map(o => o.occurrence_ref) : [];
      if (refs.length !== expected.length || refs.some((v, i) => v !== expected[i])) return result(request, 'NEEDS_EVIDENCE', 'RESUME_ORDERED_SUFFIX_MISMATCH');
    }
    if (cursor !== request.completed_duel_cursor + trace.length) return result(request, 'NEEDS_EVIDENCE', 'RESUME_DUEL_CURSOR_MISMATCH');
  }
  const budget = new OrderedFrontReductionWorkBudget(request, nowMs), rules = new Map(request.head_rules.map(r => [JSON.stringify([r.left_type_ref, r.right_type_ref]), r]));
  let cause = 'EMPTY_QUEUE_STOP', li = 0, ri = 0;
  try {
    while (li < left.length && ri < right.length) {
      if (request.closure_scope === 'one_duel' && trace.length) { cause = 'ONE_DUEL_CLOSED'; break; }
      if (trace.length >= request.depth_bound) throw new OrderedFrontReductionInterrupted('ENGAGEMENT_DEPTH_BOUND', {});
      budget.visit({ stage: 'current_heads', duel_cursor: cursor });
      const a = left[li]!, b = right[ri]!, rule = rules.get(JSON.stringify([a.type_ref, b.type_ref]));
      if (!rule) throw new OrderedFrontReductionInterrupted('HEAD_RELATION_NOT_BOUND', { left_type_ref: a.type_ref, right_type_ref: b.type_ref });
      const outcome = rule.result === 'TIE' ? ({ REMOVE_BOTH: 'BOTH', KEEP_LEFT: 'LEFT', KEEP_RIGHT: 'RIGHT', STOP: 'STOP' } as const)[request.tie_rule] : rule.result;
      const removed: string[] = [];
      if (outcome === 'RIGHT' || outcome === 'BOTH') removed.push(left[li++]!.occurrence_ref);
      if (outcome === 'LEFT' || outcome === 'BOTH') removed.push(right[ri++]!.occurrence_ref);
      const winner = outcome === 'LEFT' ? left : outcome === 'RIGHT' ? right : null, wi = outcome === 'LEFT' ? li : ri;
      if (winner) {
        const body = winner[wi]!, rank = rule.winner_rank_rule === 'ADD_ONE' ? integer(body.rank + 1) : rule.winner_rank_rule === 'SET' ? rule.winner_rank_value! : body.rank;
        winner[wi] = { ...body, rank };
      }
      trace.push({ duel_cursor: cursor, left_head_ref: a.occurrence_ref, right_head_ref: b.occurrence_ref, law_evidence_ref: rule.law_evidence_ref, outcome, consumed_occurrence_refs: removed });
      cursor = integer(cursor + 1);
      if (outcome === 'STOP') { cause = 'SUPPORTED_TIE_STOP'; break; }
      if (request.closure_scope === 'one_duel') { cause = 'ONE_DUEL_CLOSED'; break; }
    }
    budget.finish();
    return result(request, 'COMPLETE', cause, { complete: true, examined: budget.examined, values: {
      left_queue: left.slice(li), right_queue: right.slice(ri), consumption_trace: trace, completed_duel_cursor: cursor,
      left_queue_empty: li === left.length, right_queue_empty: ri === right.length, parent_command_ref: request.parent_command_ref, new_external_inputs: 0, new_external_debits: 0 } });
  } catch (error) {
    if (!(error instanceof OrderedFrontReductionInterrupted)) throw error;
    return result(request, 'NEEDS_EVIDENCE', error.cause, { examined: budget.examined, frontier: {
      input_digest: inputDigest(request), parent_command_ref: request.parent_command_ref, left_queue: left.slice(li), right_queue: right.slice(ri), consumption_trace: trace,
      completed_duel_cursor: cursor, work: error.frontier, restart_engagement: false, new_external_debit: false } });
  }
}
