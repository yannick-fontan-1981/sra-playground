import { executeOperation, pythonTruthy, type OperationKey, type OperationResult, type SymbolicRecord } from './v6-operations.ts';
import { type OperationCacheIdentity, type OperationTraceSink } from './v6-operation-trace.ts';
import type { OperationResultCache } from './v6-operation-cache.ts';

export interface CompositionBundle extends SymbolicRecord {
  id: string;
  operation_key: OperationKey;
  composition_ref: string;
  objective_ref: string;
  preserve_refs: string[];
  observation_revision: number;
  kind: 'analysis' | 'realize' | 'probe';
  actions: unknown[];
  purpose: string;
  preconditions: SymbolicRecord;
  evidence: unknown[];
  preservation_evidence?: Record<string, unknown>;
  outcome_guard?: { path: ['value']; contains: string };
}

export interface OperationAdmission {
  accepted: boolean;
  reason: string;
  guard?: { path: ['value']; contains: string };
}

export function validateBundle(bundle: CompositionBundle, state: SymbolicRecord, revision: number): boolean {
  const domain = new Set(((state.compositions ?? []) as SymbolicRecord[]).map(composition => String(composition.id)));
  const refs = [bundle.composition_ref, bundle.objective_ref, ...bundle.preserve_refs];
  if (!refs.every(ref => domain.has(ref))) throw new Error('Unknown composition reference');
  if (bundle.observation_revision !== revision) throw new Error('Stale composition contract');
  if (bundle.kind !== 'analysis' && (bundle.actions.length < 1 || bundle.actions.length > 32)) {
    throw new Error('Unbounded or empty action set');
  }
  const facts = (state.facts ?? {}) as SymbolicRecord;
  const conditions = Object.entries(bundle.preconditions).every(([key, expected]) =>
    Object.hasOwn(facts, key) && JSON.stringify(facts[key]) === JSON.stringify(expected));
  const preservation = bundle.preserve_refs.every(ref => pythonTruthy(bundle.preservation_evidence?.[ref]));
  return Boolean(conditions && preservation && bundle.evidence.length > 0);
}

export function operationAdmission(bundle: CompositionBundle, result: OperationResult): OperationAdmission {
  const operation = bundle.operation_key;
  if (!['OP14', 'OP18', 'OP28'].includes(operation)) {
    return { accepted: false, reason: 'physical_operation_contract_unspecified' };
  }
  const expected = operation === 'OP28' ? bundle.id : bundle.composition_ref;
  const guard = { path: ['value'] as ['value'], contains: expected };
  if (JSON.stringify(bundle.outcome_guard) !== JSON.stringify(guard)) {
    return { accepted: false, reason: 'missing_or_mismatched_outcome_guard' };
  }
  const values = result.value;
  const accepted = result.operation === operation
    && result.status === 'complete_on_supplied_state'
    && Array.isArray(values)
    && values.includes(expected);
  return { accepted, reason: accepted ? 'operation_selected_reference' : 'operation_did_not_select_reference', guard };
}

export interface ExecuteBundleOptions {
  needId: string;
  caller: string;
  decisionRef: string;
  trace?: OperationTraceSink;
  cache?: OperationResultCache;
  cacheIdentity?: OperationCacheIdentity;
}

/** Execute the existing bundle contract without changing its decision semantics. */
export function executeBundleOperation(
  bundle: CompositionBundle,
  state: SymbolicRecord,
  revision: number,
  options: ExecuteBundleOptions,
): { result: OperationResult; bundleAdmitted: boolean; operationAdmission?: OperationAdmission; releaseAllowed: boolean } {
  const bundleAdmitted = validateBundle(bundle, state, revision);
  const cached = options.cache && options.cacheIdentity ? options.cache.get(options.cacheIdentity) : undefined;
  const started = performance.now();
  const result = cached ?? executeOperation(bundle.operation_key, { ...state, focus: bundle.composition_ref, preserve_refs: bundle.preserve_refs });
  const executeUs = (performance.now() - started) * 1000;
  if (!cached && options.cache && options.cacheIdentity) options.cache.set(options.cacheIdentity, result);
  const operationMode = cached ? 'cache_reused' : 'executed';
  if (options.trace?.countersOnly) options.trace.countOperation(bundle.operation_key, operationMode);
  else options.trace?.record({
    kind: 'operation', needId: options.needId, op: bundle.operation_key, caller: options.caller, mode: operationMode,
    reason: cached ? 'valid dependency-identical operation result reused' : bundle.purpose,
    inputRefs: [bundle.id, bundle.composition_ref], dependencyRevisions: { observation: revision },
    resultStatus: result.status === 'incomplete' ? 'partial' : 'complete',
    resultSummary: Array.isArray(result.value) ? { count: result.value.length } : { kind: typeof result.value }, executeUs,
  });

  if (bundle.kind === 'analysis') {
    return { result, bundleAdmitted, releaseAllowed: false };
  }

  const admission = operationAdmission(bundle, result);
  const releaseAllowed = bundleAdmitted && admission.accepted;
  if (options.trace?.countersOnly) options.trace.countConsumption(bundle.operation_key, 'guard');
  else options.trace?.record({
    kind: 'consumption', needId: options.needId, op: bundle.operation_key, consumer: 'operationAdmission',
    decisionRef: options.decisionRef, effectKind: 'guard', semanticEffect: true,
    reason: releaseAllowed ? 'bundle and operation result admit release' : 'bundle or operation result rejects release',
  });
  return { result, bundleAdmitted, operationAdmission: admission, releaseAllowed };
}
