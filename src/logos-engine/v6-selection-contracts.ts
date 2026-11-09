/** Shared source SELECT payload contracts, without an evaluator or interpreter dependency.
 * SelectionInput permits repeated requirements and out-of-scope witnesses;
 * SelectRequest imposes the stricter operator admission guards.
 */
import { isJsonObject } from './canonical.ts';

type R = Record<string, any>;
const own = (value: object, key: string): boolean => Object.hasOwn(value, key);

export function selectionReferences(value: unknown, name: string, nonempty = false, requireUnique = true): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim())
    || nonempty && !value.length) throw new TypeError(`Invalid ${name}`);
  // V5 Ref uses StringConstraints(strip_whitespace=True) before uniqueness.
  const values: string[] = value.map(item => item.trim());
  if (requireUnique && new Set(values).size !== values.length) throw new TypeError(`Invalid ${name}`);
  return values;
}

/** Exact JSON subset of V5 SelectionInput, independent of request admission. */
export function validateSelectionInput(value: unknown): R {
  if (!isJsonObject(value)) throw new TypeError('SELECT input must be a mapping');
  const input = structuredClone(value) as R;
  if (typeof input.goal_ref !== 'string' || !input.goal_ref.trim()) throw new TypeError('SELECT needs a goal reference');
  input.goal_ref = input.goal_ref.trim();
  input.alternative_refs = selectionReferences(input.alternative_refs, 'selection alternatives', true);
  input.requirement_refs = selectionReferences(own(input, 'requirement_refs') ? input.requirement_refs : [], 'selection requirements', false, false);
  input.preserve_refs = selectionReferences(own(input, 'preserve_refs') ? input.preserve_refs : [], 'selection preservation rules', false, false);
  input.alternative_facts ??= {}; input.context_facts ??= {};
  if (!own(input, 'dominance_witnesses')) input.dominance_witnesses = [];
  if (!isJsonObject(input.alternative_facts) || !isJsonObject(input.context_facts)) throw new TypeError('SELECT facts must be mappings');
  const factRefs = Object.keys(input.alternative_facts);
  if (factRefs.length && (factRefs.length !== input.alternative_refs.length
    || factRefs.some(ref => !input.alternative_refs.includes(ref) || !isJsonObject(input.alternative_facts[ref])))) {
    throw new TypeError('Selection facts must index every declared alternative');
  }
  if (!Array.isArray(input.dominance_witnesses)) throw new TypeError('SELECT dominance requires explicit witnesses');
  for (const witness of input.dominance_witnesses) {
    if (!isJsonObject(witness) || typeof witness.left_ref !== 'string' || !witness.left_ref.trim()
      || typeof witness.right_ref !== 'string' || !witness.right_ref.trim()
      || typeof witness.criterion_ref !== 'string' || !witness.criterion_ref.trim()
      || !['minimize', 'maximize'].includes(witness.preferred_order as string)
      || !['less_than', 'equal', 'greater_than'].includes(witness.observed_order as string)) throw new TypeError('Invalid dominance witness');
    const normalized = witness as R; // Owned by the cloned input, never the caller.
    normalized.left_ref = witness.left_ref.trim(); normalized.right_ref = witness.right_ref.trim(); normalized.criterion_ref = witness.criterion_ref.trim();
    if (normalized.left_ref === normalized.right_ref) throw new TypeError('Invalid dominance witness');
    normalized.evidence_refs = selectionReferences(witness.evidence_refs, 'dominance evidence', true);
  }
  if (!own(input, 'schema_version')) input.schema_version = 'yf_arc3_v5.authority_input.selection.v1';
  if (typeof input.schema_version !== 'string' || !input.schema_version.trim()) throw new TypeError('SELECT schema reference must be nonempty');
  input.schema_version = input.schema_version.trim();
  return input;
}

/** Source SelectRequest guards, before a declared authority may be invoked.
 * Durable operator lineage is outside this native payload transport.
 */
export function validateSelectRequest(value: unknown): R {
  const request = validateSelectionInput(value);
  if (typeof request.selection_policy_ref !== 'string' || !request.selection_policy_ref.trim()) throw new TypeError('SELECT needs a policy reference');
  request.selection_policy_ref = request.selection_policy_ref.trim();
  selectionReferences(request.requirement_refs, 'selection requirements');
  selectionReferences(request.preserve_refs, 'selection preservation rules');
  if (request.dominance_witnesses.some((w: R) => !request.alternative_refs.includes(w.left_ref) || !request.alternative_refs.includes(w.right_ref))) {
    throw new TypeError('Dominance witnesses must compare declared alternatives');
  }
  return request;
}
