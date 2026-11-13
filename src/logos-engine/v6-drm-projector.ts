/**
 * Native transfer of DRM project_declared_alternatives and its mechanical
 * condition/template/sequence/affine/fact-contract helpers. A projection adds
 * only source-declared facts; it neither chooses a family nor releases a game
 * action. Claim/Term instantiation and authority SELECT are separate surfaces.
 * Python reference: 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 */
import { compareUnicode, immutableJson, isJsonObject } from './canonical.ts';
import type { JsonObject, JsonValue } from './ir.ts';

export type DrmFactOperator = 'equals' | 'not_equals' | 'equals_reference_field' | 'not_equals_reference_field'
  | 'greater_than_reference_field' | 'member_of_reference_field' | 'is_present' | 'is_absent'
  | 'greater_than' | 'between_inclusive' | 'at_most_multiple_of_field';
export interface DrmCondition {
  readonly field: string; readonly operator: DrmFactOperator; readonly expected?: string | boolean | number | null;
  readonly lower?: number | null; readonly upper?: number | null; readonly reference_field?: string | null; readonly factor?: number | null;
}
export interface DrmSequenceComposition {
  readonly output_field: string; readonly source_fields: readonly string[]; readonly max_items: number;
  readonly unique_items?: boolean; readonly item_arity?: number;
}
export interface DrmAffineExpression {
  readonly output_field: string; readonly terms: readonly { readonly field: string; readonly coefficient?: number }[];
  readonly constant?: number; readonly divisor?: number; readonly max_abs_value?: number;
}
export interface DrmFactContract {
  readonly id: string; readonly required_fields: readonly string[]; readonly producer_owned_fields?: readonly string[];
  readonly preserved_fields?: readonly string[]; readonly preservation_modes?: Readonly<Record<string, 'exact' | 'contains_all'>>;
  readonly validity_field: string; readonly receipt_field: string;
}
export interface DrmProjection {
  readonly id: string; readonly all_conditions?: readonly DrmCondition[]; readonly any_conditions?: readonly DrmCondition[];
  readonly static_facts?: JsonObject; readonly bound_facts?: Readonly<Record<string, string>>; readonly templated_facts?: JsonObject;
  readonly sequence_compositions?: readonly DrmSequenceComposition[]; readonly fact_contract_refs?: readonly string[];
  readonly affine_expressions?: readonly DrmAffineExpression[];
}
export interface DrmDeclaration {
  readonly id: string; readonly kind: string; readonly declared_alternative_refs?: readonly string[];
  readonly selection_required_fact_fields?: readonly string[]; readonly selection_eligibility_conditions?: readonly DrmCondition[];
  readonly fact_projections?: readonly DrmProjection[]; readonly fact_contracts?: readonly DrmFactContract[];
  readonly configuration?: JsonObject; readonly falsifiers?: readonly string[];
  readonly [key: string]: unknown;
}
export interface DrmDocument {
  readonly module_id: string; readonly declarations: readonly DrmDeclaration[];
  readonly [key: string]: unknown;
}
export interface NativeLoadedDrm {
  readonly document: DrmDocument; readonly source_hash: string; readonly source_unit: string;
}
export interface DeclaredAlternativeFacts {
  readonly alternative_refs: readonly string[]; readonly alternative_facts: JsonObject;
  readonly projection_refs: readonly string[]; readonly empty_inventory_projection_ref?: string;
  readonly declared_eligibility_match_count: number; readonly has_declared_eligibility_matches: boolean;
  readonly schema_version: 'yf_arc3_v5.declared_alternative_facts.v1';
}
interface ProducedContract {
  contract: DrmFactContract; producer_ref: string; alternative_ref: string;
  missing_fields: readonly string[]; unowned_fields: readonly string[]; preserved_values: JsonObject;
}

const own = (object: object, key: string) => Object.hasOwn(object, key);
const valueAt = (facts: JsonObject, field: string): JsonValue => own(facts, field) ? facts[field]! : null;
const sortedEntries = <T>(value: Readonly<Record<string, T>>) => Object.entries(value).sort(([a], [b]) => compareUnicode(a, b));
const exactInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0);
const typeTag = (value: JsonValue): string => value === null ? 'none' : Array.isArray(value) ? 'sequence' : typeof value;

/** Python equality inside containers permits bool/int equality; top-level DRM exact equality does not. */
function pythonEqual(left: JsonValue, right: JsonValue): boolean {
  if ((typeof left === 'boolean' || typeof left === 'number') && (typeof right === 'boolean' || typeof right === 'number')) return Number(left) === Number(right);
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return left === right;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => pythonEqual(value, right[index]!));
  }
  const a = left as JsonObject, b = right as JsonObject;
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => own(b, key) && pythonEqual(a[key]!, b[key]!));
}
export function exactFactEqual(left: JsonValue, right: JsonValue): boolean {
  return left !== null && right !== null && typeTag(left) === typeTag(right) && pythonEqual(left, right);
}
function pythonTruthy(value: JsonValue): boolean {
  if (value === null || value === false || value === 0 || value === '') return false;
  if (typeof value === 'object') return Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0;
  return true;
}
function recordedFactValue(facts: JsonObject, field: string, context?: JsonObject): JsonValue {
  return !own(facts, field) && context ? valueAt(context, field) : valueAt(facts, field);
}
function factValue(facts: JsonObject, field: string, context?: JsonObject): JsonValue {
  const value = recordedFactValue(facts, field, context);
  if (value === null && field === 'interaction_kind') return recordedFactValue(facts, 'interaction_measurement_kind', context);
  if (value === null && field === 'terminal_access_candidate_ref_present') return pythonTruthy(recordedFactValue(facts, 'terminal_access_candidate_ref', context));
  return value;
}
export function factConditionHolds(condition: DrmCondition, facts: JsonObject, context?: JsonObject): boolean {
  const operator = condition.operator;
  if (operator === 'is_present') return recordedFactValue(facts, condition.field, context) !== null;
  if (operator === 'is_absent') return recordedFactValue(facts, condition.field, context) === null;
  const value = factValue(facts, condition.field, context);
  if (operator === 'equals') return exactFactEqual(value, condition.expected ?? null);
  if (operator === 'not_equals') return value !== null && !exactFactEqual(value, condition.expected ?? null);
  const reference = condition.reference_field == null ? null : factValue(facts, condition.reference_field, context);
  if (operator === 'equals_reference_field') return exactFactEqual(value, reference);
  if (operator === 'not_equals_reference_field') return value !== null && reference !== null && !exactFactEqual(value, reference);
  if (operator === 'member_of_reference_field') return Array.isArray(reference) && reference.some(item => exactFactEqual(value, item));
  if (!exactInteger(value)) return false;
  if (operator === 'greater_than') return value > (condition.expected as number);
  if (operator === 'between_inclusive') return condition.lower! <= value && value <= condition.upper!;
  if (!exactInteger(reference)) return false;
  if (operator === 'greater_than_reference_field') return value > reference;
  if (operator === 'at_most_multiple_of_field') return BigInt(value) <= BigInt(condition.factor!) * BigInt(reference);
  throw new TypeError(`Unsupported DRM fact operator: ${String(operator)}`);
}
function projectionMatches(projection: DrmProjection, facts: JsonObject): boolean {
  return (projection.all_conditions ?? []).every(condition => factConditionHolds(condition, facts))
    && (!(projection.any_conditions?.length) || projection.any_conditions.some(condition => factConditionHolds(condition, facts)));
}
export function declaredEligibilityMatches(facts: JsonObject, declaration: DrmDeclaration): boolean {
  return (declaration.selection_eligibility_conditions ?? []).every(condition => factConditionHolds(condition, facts))
    && (declaration.selection_required_fact_fields ?? []).every(field => own(facts, field) && facts[field] !== null);
}

export function renderDrmTemplate(pattern: string, facts: JsonObject): string {
  let rendered = pattern;
  for (let depth = 0; depth < 8; depth++) {
    const previous = rendered, fields = [...new Set([...rendered.matchAll(/\{([^{}]+)\}/g)].map(match => match[1]!))];
    for (const field of fields) {
      const value = valueAt(facts, field);
      if (typeof value === 'string' || typeof value === 'boolean' || exactInteger(value)) {
        const replacement = typeof value === 'boolean' ? value ? 'True' : 'False' : String(value);
        rendered = rendered.split(`{${field}}`).join(replacement);
      }
    }
    if (!rendered.includes('{') && !rendered.includes('}')) return rendered;
    if (rendered === previous) break;
  }
  throw new Error(`unbound DRM meaning template: ${pattern}`);
}
export function renderDrmFactValue(value: JsonValue, facts: JsonObject): JsonValue {
  if (typeof value === 'string') return renderDrmTemplate(value, facts);
  if (Array.isArray(value)) return value.map(item => renderDrmFactValue(item, facts));
  if (isJsonObject(value)) {
    if (Object.keys(value).length === 1 && own(value, '$fact')) {
      const raw = value.$fact!;
      const source = typeof raw === 'boolean' ? raw ? 'True' : 'False' : raw === null ? 'None' : String(raw);
      if (!own(facts, source)) throw new Error(`unbound DRM fact projection: ${source}`);
      return facts[source]!;
    }
    return Object.fromEntries(sortedEntries(value).map(([key, item]) => [key, renderDrmFactValue(item, facts)]));
  }
  return value;
}
export function composeDeclaredFactSequences(projection: DrmProjection, facts: JsonObject): JsonObject {
  const output: Record<string, JsonValue> = Object.create(null);
  for (const composition of projection.sequence_compositions ?? []) {
    const values: JsonValue[] = [], arity = composition.item_arity ?? 1;
    for (const field of composition.source_fields) {
      const current = { ...facts, ...output };
      if (!own(current, field)) throw new Error(`declared sequence composition source is absent: ${field}`);
      const sequence = current[field];
      if (!Array.isArray(sequence)) throw new Error(`declared sequence composition source is not a sequence: ${field}`);
      if (values.length + sequence.length > composition.max_items) throw new Error('declared sequence composition bound exceeded; no items truncated');
      for (const item of sequence) {
        if (arity === 1) {
          if (typeof item !== 'string' || !item.trim()) throw new Error(`declared Ref sequence contains a non-reference item: ${field}`);
        } else if (!Array.isArray(item) || item.length !== arity || item.some(ref => typeof ref !== 'string' || !ref.trim())) {
          throw new Error(`declared Ref pair sequence contains a malformed item: ${field}`);
        }
        values.push(item);
      }
    }
    const seen = new Set<string>();
    output[composition.output_field] = composition.unique_items ? values.filter(item => {
      const identity = JSON.stringify(item);
      if (seen.has(identity)) return false;
      seen.add(identity); return true;
    }) : values;
  }
  return output;
}
export function evaluateDeclaredAffineExpressions(projection: DrmProjection, facts: JsonObject): JsonObject {
  const output: Record<string, JsonValue> = Object.create(null);
  for (const expression of projection.affine_expressions ?? []) {
    const bound = BigInt(expression.max_abs_value ?? 2 ** 53);
    let numerator = BigInt(expression.constant ?? 0);
    for (const term of expression.terms) {
      const current = { ...facts, ...output };
      if (!own(current, term.field)) throw new Error(`declared affine input is absent: ${term.field}`);
      const value = current[term.field];
      if (!exactInteger(value)) throw new Error(`declared affine input is not an exact integer: ${term.field}`);
      if (BigInt(value) > bound || BigInt(value) < -bound) throw new Error(`declared affine input bound exceeded: ${term.field}`);
      numerator += BigInt(term.coefficient ?? 1) * BigInt(value);
      if (numerator > bound || numerator < -bound) throw new Error('declared affine intermediate bound exceeded');
    }
    const divisor = BigInt(expression.divisor ?? 1);
    if (numerator % divisor !== 0n) throw new Error('declared affine result is not exactly divisible');
    const result = numerator / divisor, number = Number(result);
    if (!Number.isSafeInteger(number)) throw new Error('declared affine result exceeds the native exact JSON integer domain');
    output[expression.output_field] = number;
  }
  return output;
}
function present(facts: JsonObject, field: string): boolean {
  const value = valueAt(facts, field);
  return value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);
}
function producedFields(projection: DrmProjection, facts: JsonObject): Set<string> {
  return new Set([...Object.keys(projection.static_facts ?? {}), ...Object.keys(projection.templated_facts ?? {}),
    ...sortedEntries(projection.bound_facts ?? {}).filter(([, source]) => own(facts, source)).map(([field]) => field),
    ...(projection.sequence_compositions ?? []).map(item => item.output_field), ...(projection.affine_expressions ?? []).map(item => item.output_field)]);
}
function captureFactContracts(projection: DrmProjection, contracts: ReadonlyMap<string, DrmFactContract>, facts: JsonObject, alternative_ref: string): ProducedContract[] {
  const produced = producedFields(projection, facts);
  return (projection.fact_contract_refs ?? []).map(ref => {
    const contract = contracts.get(ref);
    if (!contract) throw new Error(`Unknown declared fact contract: ${ref}`);
    return { contract, producer_ref: projection.id, alternative_ref,
      missing_fields: contract.required_fields.filter(field => !present(facts, field)),
      unowned_fields: (contract.producer_owned_fields ?? []).filter(field => !produced.has(field)),
      preserved_values: Object.fromEntries((contract.preserved_fields ?? []).map(field => [field, valueAt(facts, field)])) };
  });
}
export function reconcileFactContracts(receipts: readonly ProducedContract[], facts: JsonObject): JsonObject {
  const output: Record<string, JsonValue> = Object.create(null), grouped = new Map<string, JsonObject[]>();
  for (const receipt of receipts) {
    const contract = receipt.contract, missing = contract.required_fields.filter(field => !present(facts, field));
    const changed = sortedEntries(receipt.preserved_values).filter(([field, previous]) => {
      const current = valueAt(facts, field), mode = contract.preservation_modes?.[field] ?? 'exact';
      return mode === 'contains_all'
        ? !(Array.isArray(previous) && Array.isArray(current) && previous.every(item => current.some(value => pythonEqual(item, value))))
        : !pythonEqual(previous, current);
    }).map(([field]) => field);
    const valid = !(receipt.missing_fields.length || receipt.unowned_fields.length || missing.length || changed.length);
    const row: JsonObject = { contract_ref: contract.id, producer_ref: receipt.producer_ref, alternative_ref: receipt.alternative_ref,
      production_missing_fields: receipt.missing_fields, production_unowned_fields: receipt.unowned_fields,
      current_missing_fields: missing, changed_fields: changed, production_preserved_values: receipt.preserved_values,
      preserved_values: Object.fromEntries((contract.preserved_fields ?? []).map(field => [field, valueAt(facts, field)])), valid };
    const group = grouped.get(contract.receipt_field) ?? []; group.push(row); grouped.set(contract.receipt_field, group);
    output[contract.validity_field] = Boolean((output[contract.validity_field] ?? true) && valid);
  }
  for (const [field, rows] of [...grouped].sort(([a], [b]) => compareUnicode(a, b))) output[field] = rows;
  return output;
}

function validateProjectionDeclaration(declaration: DrmDeclaration): void {
  if (typeof declaration.id !== 'string' || !declaration.id || typeof declaration.kind !== 'string') throw new TypeError('Malformed DRM declaration');
  const contracts = new Set((declaration.fact_contracts ?? []).map(contract => contract.id));
  if (contracts.size !== (declaration.fact_contracts?.length ?? 0)) throw new TypeError('Duplicate fact contract identity');
  const ids = new Set<string>();
  for (const projection of declaration.fact_projections ?? []) {
    if (!projection.id || ids.has(projection.id)) throw new TypeError('Duplicate or absent fact projection identity'); ids.add(projection.id);
    if ((projection.fact_contract_refs ?? []).some(ref => !contracts.has(ref))) throw new TypeError('Fact projection contract is not declared');
    for (const composition of projection.sequence_compositions ?? []) {
      if (!composition.output_field || !composition.source_fields.length || composition.source_fields.length > 8 ||
          !exactInteger(composition.max_items) || composition.max_items < 1 || composition.max_items > 4096 ||
          ![1, 2].includes(composition.item_arity ?? 1)) throw new TypeError('Invalid declared sequence composition');
    }
    const affine = projection.affine_expressions ?? [], outputs = affine.map(item => item.output_field);
    if (new Set(outputs).size !== outputs.length) throw new TypeError('Duplicate affine output');
    affine.forEach((expression, index) => {
      const bound = expression.max_abs_value ?? 2 ** 53, constant = expression.constant ?? 0, divisor = expression.divisor ?? 1;
      if (!Number.isInteger(bound) || bound < 1 || bound > 2 ** 53 || !Number.isInteger(constant) || Math.abs(constant) > 2 ** 53 ||
          !exactInteger(divisor) || divisor < 1 || divisor > 1024 || !expression.terms.length || expression.terms.length > 8 ||
          expression.terms.some(term => !exactInteger(term.coefficient ?? 1) || Math.abs(term.coefficient ?? 1) > 1024 || outputs.slice(index).includes(term.field))) {
        throw new TypeError('Invalid declared affine expression');
      }
    });
  }
  const conditions = [...(declaration.selection_eligibility_conditions ?? []), ...(declaration.fact_projections ?? []).flatMap(projection => [...(projection.all_conditions ?? []), ...(projection.any_conditions ?? [])])];
  for (const condition of conditions) {
    const { operator, field } = condition;
    if (typeof field !== 'string' || !field) throw new TypeError('A fact condition requires a field');
    let valid: boolean;
    const empty = (...names: (keyof DrmCondition)[]) => names.every(name => condition[name] == null);
    if (operator === 'equals' || operator === 'not_equals') valid = condition.expected != null &&
      (typeof condition.expected === 'string' || typeof condition.expected === 'boolean' || exactInteger(condition.expected)) && empty('lower', 'upper', 'reference_field', 'factor');
    else if (['equals_reference_field', 'not_equals_reference_field', 'greater_than_reference_field', 'member_of_reference_field'].includes(operator)) valid = typeof condition.reference_field === 'string' && empty('expected', 'lower', 'upper', 'factor');
    else if (operator === 'is_present' || operator === 'is_absent') valid = empty('expected', 'lower', 'upper', 'reference_field', 'factor');
    else if (operator === 'greater_than') valid = exactInteger(condition.expected) && empty('lower', 'upper', 'reference_field', 'factor');
    else if (operator === 'between_inclusive') valid = exactInteger(condition.lower) && exactInteger(condition.upper) && condition.lower <= condition.upper && empty('expected', 'reference_field', 'factor');
    else valid = operator === 'at_most_multiple_of_field' && typeof condition.reference_field === 'string' && exactInteger(condition.factor) && condition.factor >= 1 && empty('expected', 'lower', 'upper');
    if (!valid) throw new TypeError(`Invalid arguments for DRM fact operator ${operator}`);
  }
  for (const contract of declaration.fact_contracts ?? []) {
    const required = new Set(contract.required_fields), preserved = contract.preserved_fields ?? [], owned = contract.producer_owned_fields ?? [];
    if (!required.size || required.size > 32 || required.size !== contract.required_fields.length || new Set(preserved).size !== preserved.length || new Set(owned).size !== owned.length ||
        [...preserved, ...owned].some(field => !required.has(field)) || contract.receipt_field === contract.validity_field || required.has(contract.receipt_field) || required.has(contract.validity_field) ||
        Object.entries(contract.preservation_modes ?? {}).some(([field, mode]) => !preserved.includes(field) || !['exact', 'contains_all'].includes(mode))) {
      throw new TypeError('Invalid declared fact contract');
    }
  }
}

export class NativeDrmRegistry {
  private readonly modules = new Map<string, NativeLoadedDrm>();
  private readonly declarations = new Map<string, readonly [DrmDeclaration, NativeLoadedDrm]>();
  private sealed = false;
  seal(): void { this.sealed = true; }
  get declarationIds(): readonly string[] { return [...this.declarations.keys()].sort(compareUnicode); }
  async registerSource(text: string, expectedHash: string): Promise<NativeLoadedDrm> {
    const bytes = new TextEncoder().encode(text), hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
    if (hash !== expectedHash) throw new Error('DRM source hash differs from its declared bytes');
    const raw = immutableJson(JSON.parse(text));
    if (!isJsonObject(raw) || typeof raw.module_id !== 'string' || !Array.isArray(raw.declarations)) throw new TypeError('Invalid DRM document');
    const document = raw as unknown as DrmDocument;
    const existing = this.modules.get(document.module_id);
    if (existing) {
      if (existing.source_hash !== hash) throw new Error(`DRM module already registered: ${document.module_id}`);
      return existing;
    }
    if (this.sealed) throw new Error(`DRM registration is closed: ${document.module_id}`);
    const local = new Set<string>();
    for (const declaration of document.declarations) {
      validateProjectionDeclaration(declaration);
      if (this.declarations.has(declaration.id) || local.has(declaration.id)) throw new Error(`Duplicate DRM declaration identity: ${declaration.id}`);
      local.add(declaration.id);
    }
    const loaded = Object.freeze({ document, source_hash: hash, source_unit: `drm.${document.module_id}` });
    this.modules.set(document.module_id, loaded);
    for (const declaration of document.declarations) this.declarations.set(declaration.id, Object.freeze([declaration, loaded]));
    return loaded;
  }
  resolve(id: string): readonly [DrmDeclaration, NativeLoadedDrm] {
    const entry = this.declarations.get(id);
    if (!entry) throw new Error(`unregistered DRM declaration: ${id}`);
    return entry;
  }
  factProjectionsFor(id: string, stableFacts?: JsonObject): readonly DrmProjection[] {
    const [declaration] = this.resolve(id), projections = declaration.fact_projections ?? [];
    if (!stableFacts) return projections;
    // Reproduce the original stable index's gate, including fields authored by
    // any later projection. Ordered semantic dependencies are never prefiltered.
    const authored = new Set(projections.flatMap(projection => [...Object.keys(projection.static_facts ?? {}),
      ...Object.keys(projection.bound_facts ?? {}), ...Object.keys(projection.templated_facts ?? {}),
      ...(projection.sequence_compositions ?? []).map(item => item.output_field), ...(projection.affine_expressions ?? []).map(item => item.output_field)]));
    return projections.filter(projection => {
      const condition = (projection.all_conditions ?? []).find(item => item.operator === 'equals' && !authored.has(item.field));
      return !condition || pythonEqual(valueAt(stableFacts, condition.field), condition.expected ?? null);
    });
  }
}

export function projectDeclaredAlternatives(options: {
  drm: NativeDrmRegistry; selection_policy_ref: string; alternative_refs: readonly string[]; descriptive_facts: JsonObject;
}): DeclaredAlternativeFacts {
  const { drm, selection_policy_ref, descriptive_facts } = options;
  const [policy] = drm.resolve(selection_policy_ref);
  const refs = options.alternative_refs.length ? options.alternative_refs : policy.declared_alternative_refs ?? [];
  if (!refs.length) {
    const empty = policy.configuration?.empty_inventory_projection_ref;
    if (Object.keys(descriptive_facts).length === 0 && typeof empty === 'string' && empty) return {
      alternative_refs: [], alternative_facts: {}, projection_refs: [empty], empty_inventory_projection_ref: empty,
      declared_eligibility_match_count: 0, has_declared_eligibility_matches: false, schema_version: 'yf_arc3_v5.declared_alternative_facts.v1' };
    throw new Error(`${selection_policy_ref} declares no alternatives to project`);
  }
  const keys = Object.keys(descriptive_facts), keyed = keys.length === new Set(refs).size && keys.every(key => refs.includes(key)) && refs.every(ref => isJsonObject(descriptive_facts[ref]));
  const contracts = new Map((policy.fact_contracts ?? []).map(contract => [contract.id, contract]));
  const projected: Record<string, JsonValue> = Object.create(null), used: string[] = [];
  for (const ref of refs) {
    const raw = keyed ? descriptive_facts[ref] : descriptive_facts;
    if (!isJsonObject(raw)) throw new Error(`descriptive facts missing for ${ref}`);
    const facts: Record<string, JsonValue> = Object.assign(Object.create(null), raw, { alternative_ref: ref }), receipts: ProducedContract[] = [];
    for (const projection of drm.factProjectionsFor(selection_policy_ref, facts)) {
      if (!projectionMatches(projection, facts)) continue;
      Object.assign(facts, projection.static_facts ?? {});
      // Each comprehension reads the pre-update mapping, exactly as Python.
      Object.assign(facts, Object.fromEntries(sortedEntries(projection.bound_facts ?? {}).filter(([, source]) => own(facts, source)).map(([field, source]) => [field, facts[source]!])));
      Object.assign(facts, Object.fromEntries(sortedEntries(projection.templated_facts ?? {}).map(([field, value]) => [field, renderDrmFactValue(value, facts)])));
      used.push(projection.id);
      Object.assign(facts, composeDeclaredFactSequences(projection, facts));
      Object.assign(facts, evaluateDeclaredAffineExpressions(projection, facts));
      receipts.push(...captureFactContracts(projection, contracts, facts, ref));
    }
    Object.assign(facts, reconcileFactContracts(receipts, facts));
    projected[ref] = immutableJson(facts);
  }
  const count = refs.filter(ref => declaredEligibilityMatches(projected[ref] as JsonObject, policy)).length;
  return immutableJson({ alternative_refs: [...refs], alternative_facts: projected, projection_refs: [...new Set(used)],
    declared_eligibility_match_count: count, has_declared_eligibility_matches: count > 0,
    schema_version: 'yf_arc3_v5.declared_alternative_facts.v1' }) as unknown as DeclaredAlternativeFacts;
}
