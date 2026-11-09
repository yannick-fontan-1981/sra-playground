/** Source-declared SELECT, from V5 drm/runtime.py and selection_projection.py.
 * This is a pure assessment. Physical execution still belongs to WHY/ACT.
 * Exact scalar comparisons support the native safe-integer JSON domain.
 */
import { compareUnicode, immutableJson } from './canonical.ts';
import { NativeDrmRegistry, declaredEligibilityMatches, factConditionHolds } from './v6-drm-projector.ts';
import { SrcExecutionError } from './interpreter.ts';
import { selectionReferences, validateSelectionInput, validateSelectRequest } from './v6-selection-contracts.ts';
import type { JsonObject, JsonValue, Primitive } from './ir.ts';

export { validateSelectionInput, validateSelectRequest } from './v6-selection-contracts.ts';

type R = Record<string, any>;
type Ranked = readonly [number, string, R | null];
const own = (value: object, key: string): boolean => Object.hasOwn(value, key);
const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];
const fields = (input: R, ref: string): R => {
  if (!own(input.alternative_facts, ref)) throw new TypeError(`Missing selection facts: ${ref}`);
  return { ...input.context_facts, ...input.alternative_facts[ref] };
};
const conditions = (rules: readonly R[], facts: R): boolean => rules.every(rule => factConditionHolds(rule as any, facts));
const hashReference = /(?:^|[.:_-])[0-9a-f]{8,}(?=$|[.:_-])/i;

export class DrmSelectionBlockedError extends SrcExecutionError {
  readonly selectionRefusal: JsonObject;
  constructor(result: R) {
    super('selection_blocked', 'SELECT preserved alternatives without commitment');
    this.selectionRefusal = immutableJson(result) as JsonObject;
  }
}

function compareFact(left: any, right: any): number {
  left ??= null; right ??= null;
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (typeof left !== typeof right || !['boolean', 'number', 'string'].includes(typeof left)
    || typeof left === 'number' && (!Number.isSafeInteger(left) || !Number.isSafeInteger(right) || Object.is(left, -0) || Object.is(right, -0))) {
    throw new TypeError('Declared tie-break values must be same-type exact JSON scalars');
  }
  return typeof left === 'string' ? Math.sign(compareUnicode(left, right)) : left < right ? -1 : left > right ? 1 : 0;
}
function tieOrder(rule: R, left: any, right: any): number {
  if (['alternative_ref', 'candidate_ref'].includes(rule.field)
    && [left, right].some(value => typeof value === 'string' && hashReference.test(value))) return 0;
  return compareFact(left, right);
}
function effective(rule: R, left: R, right: R): number {
  const order = tieOrder(rule, left[rule.field], right[rule.field]);
  return rule.preferred_order === 'minimize' ? order : -order;
}
function firstTier(facts: R, tiers: readonly R[]): readonly [number, R | null] {
  const index = tiers.findIndex(tier => conditions(tier.all_conditions ?? [], facts)
    && (!tier.any_conditions?.length || tier.any_conditions.some((rule: R) => factConditionHolds(rule as any, facts))));
  return index < 0 ? [tiers.length, null] : [index, tiers[index]!];
}
function compareItems(left: Ranked, right: Ranked, input: R, policy: R): number {
  const a = fields(input, left[1]), b = fields(input, right[1]);
  for (const criterion of policy.selection_precedence_criteria ?? []) {
    const order = effective(criterion, a, b); if (order) return order;
  }
  if (left[0] !== right[0]) return left[0] < right[0] ? -1 : 1;
  for (const criterion of policy.selection_tie_breakers ?? []) {
    const order = effective(criterion, a, b); if (order) return order;
  }
  return 0;
}

export function declaredLexicographicOrder(input: R, policy: R): Ranked[] {
  return input.alternative_refs.filter((ref: string) => declaredEligibilityMatches(fields(input, ref), policy as any))
    .map((ref: string) => { const [index, tier] = firstTier(fields(input, ref), policy.selection_tiers ?? []); return [index, ref, tier] as Ranked; })
    .sort((left: Ranked, right: Ranked) => compareItems(left, right, input, policy));
}

function comparisonTrace(input: R, policy: R, ordered: readonly Ranked[], selected: string | null): R {
  const eligible = ordered.map(item => item[1]), ineligible = input.alternative_refs.filter((ref: string) => !eligible.includes(ref));
  const runner = ordered[1]?.[1] ?? null, traces: R[] = [], failures: R[] = [];
  let first: string | null = null;
  if (selected === null) for (const ref of ineligible) {
    const facts = fields(input, ref), failed = (policy.selection_eligibility_conditions ?? [])
      .map((rule: R, index: number) => ({ rule, index })).filter(({ rule }: R) => !factConditionHolds(rule as any, facts));
    failures.push({ alternative_ref: ref, failed_condition_indices: failed.map((item: R) => item.index),
      failed_condition_fields: failed.map((item: R) => item.rule.field),
      missing_required_fields: (policy.selection_required_fact_fields ?? []).filter((field: string) => !own(facts, field) || facts[field] === null) });
  }
  if (ordered.length && runner !== null) {
    const a = ordered[0]!, b = ordered[1]!, left = fields(input, a[1]), right = fields(input, b[1]);
    const append = (criterion: string, field: string, preferred: string, l: any, r: any, order: number, reasons: string[]): void => {
      traces.push({ criterion_ref: criterion, field, preferred_order: preferred, left_ref: a[1], right_ref: b[1], left_value: l ?? null,
        right_value: r ?? null, outcome: order < 0 ? 'left_preferred' : order > 0 ? 'right_preferred' : 'equal', reason_refs: reasons });
      if (first === null && order) first = criterion;
    };
    for (const rule of policy.selection_precedence_criteria ?? []) append(rule.criterion_ref, rule.field, rule.preferred_order,
      left[rule.field], right[rule.field], effective(rule, left, right), [rule.reason_ref]);
    const reasons = unique([...(a[2] ? [a[2].reason_ref] : []), ...(b[2] ? [b[2].reason_ref] : []), ...(policy.reason_refs ?? [])]);
    if (!reasons.length) throw new TypeError('Selection tier comparison requires declared reasons');
    append(reasons[0]!, 'selection_tier_index', 'minimize', a[0], b[0], Math.sign(a[0] - b[0]), reasons);
    for (const rule of policy.selection_tie_breakers ?? []) append(rule.criterion_ref || rule.field, rule.field, rule.preferred_order,
      left[rule.field], right[rule.field], effective(rule, left, right), rule.reason_ref ? [rule.reason_ref] : policy.reason_refs);
  }
  return { selection_policy_ref: policy.id, eligible_refs: eligible, ineligible_refs: ineligible, ordered_refs: eligible,
    selected_ref: selected, runner_up_ref: runner, first_discriminating_criterion_ref: first, criterion_traces: traces,
    unresolved_equality: !!(ordered.length && runner && selected === null), eligibility_failures: failures,
    schema_version: 'yf_arc3_v5.selection_comparison_trace.v1' };
}

/** Exact declared evaluator; input order is preserved here, as in V5. */
export function declaredSelectionResult(value: R, policy: R): R {
  const input = validateSelectionInput(value), reasons: string[] = [...(policy.reason_refs ?? [])];
  if (!reasons.length) throw new TypeError('A selection policy requires declared reasons');
  let selected: string | null = null, trace: R | null = null;
  if (policy.evaluation === 'single_admissible') selected = input.alternative_refs.length === 1 ? input.alternative_refs[0] : null;
  else if (policy.evaluation === 'declared_eligibility_single') {
    const ordered: Ranked[] = input.alternative_refs.filter((ref: string) => declaredEligibilityMatches(fields(input, ref), policy as any))
      .map((ref: string) => [0, ref, null]);
    selected = ordered.length === 1 ? ordered[0]![1] : null; trace = comparisonTrace(input, policy, ordered, selected);
  } else if (policy.evaluation === 'declared_lexicographic_order') {
    const ordered = declaredLexicographicOrder(input, policy);
    if (Object.keys(input.alternative_facts).length && ordered.length && (ordered.length === 1 || compareItems(ordered[0]!, ordered[1]!, input, policy) !== 0)) {
      selected = ordered[0]![1]; let reason: string | null = ordered[0]![2]?.reason_ref ?? null;
      if (ordered.length > 1) {
        const left = fields(input, ordered[0]![1]), right = fields(input, ordered[1]![1]);
        const precedence = (policy.selection_precedence_criteria ?? []).find((rule: R) => tieOrder(rule, left[rule.field], right[rule.field]));
        if (precedence) reason = precedence.reason_ref;
        if (reason) reasons.push(reason);
        if (policy.canonical_equivalence_tie_break_debt_ref && ordered[0]![0] === ordered[1]![0] && !precedence) {
          const deciding = (policy.selection_tie_breakers ?? []).find((rule: R) => tieOrder(rule, left[rule.field], right[rule.field]));
          if (deciding && ['candidate_ref', 'alternative_ref'].includes(deciding.field)) reasons.push(policy.canonical_equivalence_tie_break_debt_ref);
        }
      } else if (reason) reasons.push(reason);
    }
    trace = comparisonTrace(input, policy, ordered, selected);
  } else if (policy.evaluation === 'symbolic_partial_order') {
    const dominates = (left: string, right: string): boolean => {
      const comparisons = input.dominance_witnesses.filter((item: R) => [item.left_ref, item.right_ref].includes(left) && [item.left_ref, item.right_ref].includes(right));
      if (!comparisons.length) return false; let strict = false;
      for (const item of comparisons) {
        let order = item.observed_order === 'less_than' ? -1 : item.observed_order === 'greater_than' ? 1 : 0;
        if (item.left_ref !== left) order = -order;
        const favorable = item.preferred_order === 'minimize' ? -1 : 1;
        if (order === -favorable) return false; strict ||= order === favorable;
      }
      return strict;
    };
    const choices = input.alternative_refs.filter((ref: string) => input.alternative_refs.every((other: string) => other === ref || dominates(ref, other)));
    selected = choices.length === 1 ? choices[0] : null;
  } else throw new TypeError(`Unsupported selection evaluator: ${String(policy.evaluation)}`);
  return { selected_ref: selected, preserves_non_selected: policy.preserves_alternatives ?? true, reason_refs: unique(reasons),
    comparison_trace: trace, schema_version: 'yf_arc3_v5.authority_output.selection.v1' };
}

/** Mechanical operator projection, with no fallback for an unresolved tie. */
export function projectSelectionOutput(alternativeRefs: readonly string[], decision: R): R {
  const alternatives = selectionReferences(alternativeRefs, 'selection alternatives', true).sort(compareUnicode);
  if (decision.selected_ref === null) throw new DrmSelectionBlockedError(decision);
  if (!alternatives.includes(decision.selected_ref)) throw new TypeError('Selection policy chose an undeclared alternative');
  const live = decision.preserves_non_selected ? alternatives : [decision.selected_ref];
  return { output_kind: 'selection', alternatives: { selected: decision.selected_ref, live_alternatives: live,
    cardinality: live.length > 1 ? 'special' : 'singular', schema_version: 'yf_arc3_v5.alternative_set.v1' },
    preserved_non_selected: decision.preserves_non_selected ? alternatives.filter(ref => ref !== decision.selected_ref) : [],
    reason_refs: decision.reason_refs, comparison_trace: decision.comparison_trace };
}

export function createDrmSelectPrimitive(drm: NativeDrmRegistry, policyRef: string): Primitive {
  const [declaration] = drm.resolve(policyRef), policy = declaration as R;
  if (policy.kind !== 'selection_policy' || (policy.effect_class ?? 'pure') !== 'pure' || !policy.supported_operators?.includes('SELECT')
    || policy.input_contract !== 'yf_arc3_v5.authority_input.selection.v1'
    || policy.output_contract !== 'yf_arc3_v5.authority_output.selection.v1') throw new TypeError('SELECT requires its declared pure selection authority');
  return args => {
    const request = validateSelectRequest(args.request);
    if (request.selection_policy_ref !== policyRef) throw new TypeError('SELECT authority binding mismatch');
    request.alternative_refs.sort(compareUnicode); request.requirement_refs.sort(compareUnicode); request.preserve_refs.sort(compareUnicode);
    request.dominance_witnesses.sort((a: R, b: R) => compareUnicode(a.left_ref, b.left_ref) || compareUnicode(a.right_ref, b.right_ref) || compareUnicode(a.criterion_ref, b.criterion_ref));
    return immutableJson(projectSelectionOutput(request.alternative_refs, declaredSelectionResult(request, policy))) as JsonValue;
  };
}
