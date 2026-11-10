/**
 * Exact finite-domain enumeration consumed by V6 RelationalChamberAccess.
 * Port of V5 finite_relation_network._indexed_combination/_network_domain,
 * pinned at 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 *
 * Inputs have the already validated string-Ref contracts of the original
 * RelationVariable/Component/Alternative models. This is not the full V5
 * finite-relation facade. Native portable integers must remain safe, including
 * the declared combination count. Chamber's twelve binary sources fit exactly.
 */
import { compareUnicode } from './canonical.ts';

export interface RelationVariable {
  variable_ref: string;
  values: readonly string[];
  source: boolean;
}
export interface RelationComponent {
  component_ref: string;
  model_scope_ref: string;
  signature_ref: string;
  context_ref: string;
  ordered_input_refs: readonly string[];
  output_ref: string;
}
export interface FiniteRelationRow { inputs: readonly string[]; outputs: readonly string[] }
export interface FiniteRelationAlternative {
  model_ref: string;
  model_scope_ref: string;
  signature_ref: string;
  context_ref: string;
  arity: number;
  rows: readonly FiniteRelationRow[];
  table_complete: boolean;
  deterministic: boolean;
}
export interface FiniteRelationDomainRequest {
  variables: readonly RelationVariable[];
  components: readonly RelationComponent[];
  models: readonly FiniteRelationAlternative[];
  domain_offset: number;
  maximum_states: number;
  maximum_relation_checks: number;
}
export interface FiniteRelationDomainState {
  assignment: [string, string][];
  model_refs: string[];
  unknown_rows: [string, string[], string][];
}
export interface FiniteRelationDomainResult {
  states: FiniteRelationDomainState[];
  enumerated_assignments: number;
  relation_checks: number;
  complete: boolean;
  bounded: boolean;
  frontier: { next_combination_index?: number; total_declared_combinations?: number };
}

function safeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new RangeError(`${name} is outside the native portable integer domain`);
}

/** Last domain changes fastest, including Python floor-divmod for negative indices. */
export function indexedCombination<T>(domains: readonly (readonly T[])[], index: number): T[] {
  safeInteger(index, 'Combination index');
  let remaining = BigInt(index);
  const result: T[] = [];
  for (let position = domains.length - 1; position >= 0; position--) {
    const domain = domains[position]!;
    if (domain.length === 0) throw new RangeError('Combination domain is empty');
    const radix = BigInt(domain.length), digit = ((remaining % radix) + radix) % radix;
    remaining = (remaining - digit) / radix;
    result.push(domain[Number(digit)]!);
  }
  return result.reverse();
}

function compareUnknownRows(left: [string, string[], string], right: [string, string[], string]): number {
  const model = compareUnicode(left[0], right[0]);
  if (model) return model;
  for (let i = 0; i < Math.min(left[1].length, right[1].length); i++) {
    const order = compareUnicode(left[1][i]!, right[1][i]!);
    if (order) return order;
  }
  return left[1].length - right[1].length;
}

export function networkDomain(
  request: FiniteRelationDomainRequest,
  fixed: Readonly<Record<string, string>>,
  requirements: readonly (readonly [string, readonly string[]])[] = [],
  offset: number | null = null,
): FiniteRelationDomainResult {
  const variables = request.variables;
  const domains: (readonly (string | FiniteRelationAlternative)[])[] = variables.map(variable =>
    Object.hasOwn(fixed, variable.variable_ref) ? [fixed[variable.variable_ref]!] : variable.values);
  const scopes = [...new Set(request.components.map(component => component.model_scope_ref))];
  const modelDomains = scopes.map(scope => request.models.filter(model => model.model_scope_ref === scope));
  const allDomains = [...domains, ...modelDomains];
  let declaredTotal = 1n;
  for (const domain of allDomains) declaredTotal *= BigInt(domain.length);
  if (declaredTotal > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Declared relation domain exceeds the native portable integer domain');
  const total = Number(declaredTotal), start = offset === null ? request.domain_offset : offset;
  safeInteger(start, 'Domain offset');
  safeInteger(request.maximum_states, 'Maximum states');
  safeInteger(request.maximum_relation_checks, 'Maximum relation checks');
  if (start < 0 || request.maximum_states < 1 || request.maximum_relation_checks < 1) throw new RangeError('Invalid finite relation enumeration bounds');
  const states: FiniteRelationDomainState[] = [];
  let count = 0, checks = 0, capped = false, nextIndex = start;
  const tables = new Map(request.models.map(model => [model.model_ref,
    new Map(model.rows.map(row => [JSON.stringify(row.inputs), row.outputs]))]));
  for (let index = start; index < total; index++) {
    // Source reserves the whole component count before beginning an assignment,
    // even when an earlier component would reject it. States bounds enumeration,
    // not the number of successful assignments retained below.
    if (count >= request.maximum_states || checks + request.components.length > request.maximum_relation_checks) {
      capped = true; nextIndex = index; break;
    }
    count++;
    const combination = indexedCombination(allDomains, index);
    const values = new Map(variables.map((variable, i) => [variable.variable_ref, combination[i] as string]));
    if (requirements.some(([ref, allowed]) => !allowed.includes(values.get(ref)!))) continue;
    const boundModels = new Map(scopes.map((scope, i) => [scope, combination[variables.length + i] as FiniteRelationAlternative]));
    const unknown = new Map<string, [string, string[], string]>();
    let valid = true;
    for (const component of request.components) {
      checks++;
      const model = boundModels.get(component.model_scope_ref)!;
      const inputs = component.ordered_input_refs.map(ref => values.get(ref)!);
      const output = values.get(component.output_ref)!;
      const allowed = tables.get(model.model_ref)!.get(JSON.stringify(inputs));
      if (allowed !== undefined) {
        if (!allowed.includes(output)) { valid = false; break; }
      } else if (model.table_complete) { valid = false; break; }
      else {
        const key = JSON.stringify([model.model_ref, inputs]), previous = unknown.get(key);
        if (model.deterministic && previous !== undefined && previous[2] !== output) { valid = false; break; }
        // Nondeterministic repeated rows retain the final value just as Python's
        // assignment to unknown_rows does; their alternatives stay in states.
        unknown.set(key, [model.model_ref, inputs, output]);
      }
    }
    if (valid) states.push({
      assignment: variables.map(variable => [variable.variable_ref, values.get(variable.variable_ref)!]),
      model_refs: combination.slice(variables.length).map(model => (model as FiniteRelationAlternative).model_ref),
      unknown_rows: [...unknown.values()].sort(compareUnknownRows),
    });
  }
  return { states, enumerated_assignments: count, relation_checks: checks, complete: !capped && start === 0,
    bounded: capped, frontier: capped ? { next_combination_index: nextIndex, total_declared_combinations: total } : {} };
}
