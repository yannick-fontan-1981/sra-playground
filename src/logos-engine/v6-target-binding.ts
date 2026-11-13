import { executeOperation, type OperationKey, type OperationResult, type SymbolicRecord } from './v6-operations.ts';
import type { OperationTraceSink } from './v6-operation-trace.ts';

export interface KnowledgeRecord {
  value: unknown;
  evidence: string;
  revision: number;
}

export class KnowledgeStore {
  readonly #records = new Map<string, KnowledgeRecord>();

  put(key: string, record: KnowledgeRecord): boolean {
    const current = this.#records.get(key);
    if (current && current.revision > record.revision) return false;
    if (current && current.revision === record.revision
      && current.evidence === record.evidence
      && JSON.stringify(current.value) === JSON.stringify(record.value)) return false;
    this.#records.set(key, structuredClone(record));
    return true;
  }

  get(key: string): KnowledgeRecord | undefined {
    const value = this.#records.get(key);
    return value ? structuredClone(value) : undefined;
  }

  snapshot(): Record<string, KnowledgeRecord> {
    return Object.fromEntries([...this.#records].map(([key, value]) => [key, structuredClone(value)]));
  }

  restore(snapshot: Record<string, KnowledgeRecord>): void {
    this.#records.clear();
    for (const [key, value] of Object.entries(snapshot)) this.#records.set(key, structuredClone(value));
  }
}

export interface PostAnalysisOptions {
  needId: string;
  observationRevision: number;
  decisionRef: string;
  trace?: OperationTraceSink;
  knowledge: KnowledgeStore;
}

export interface PostAnalysisReceipt {
  op: 'OP29' | 'OP30' | 'OP31';
  disposition: 'information_only' | 'persisted_only' | 'blocked' | 'not_required';
  result?: OperationResult;
  writes?: number;
}

function recordSkipped(
  op: 'OP29' | 'OP30' | 'OP31',
  mode: 'blocked' | 'not_required',
  reason: string,
  options: PostAnalysisOptions,
): PostAnalysisReceipt {
  if (options.trace?.countersOnly) options.trace.countOperation(op, mode);
  else options.trace?.record({
    kind: 'operation', needId: options.needId, op, caller: 'postAnalysis', mode, reason,
    inputRefs: [], dependencyRevisions: { observation: options.observationRevision },
    resultStatus: mode === 'blocked' ? 'unknown' : 'not_produced',
  });
  return { op, disposition: mode };
}

function executeAnalysis(
  op: 'OP29' | 'OP30' | 'OP31',
  state: SymbolicRecord,
  focusRef: string,
  options: PostAnalysisOptions,
): OperationResult {
  const started = performance.now();
  const result = executeOperation(op as OperationKey, { ...state, focus: focusRef, observation_revision: options.observationRevision });
  const executeUs = (performance.now() - started) * 1000;
  if (options.trace?.countersOnly) options.trace.countOperation(op, 'executed');
  else options.trace?.record({
    kind: 'operation', needId: options.needId, op, caller: 'postAnalysis', mode: 'executed', reason: 'post-analysis contract',
    inputRefs: [focusRef], dependencyRevisions: { observation: options.observationRevision },
    resultStatus: result.status === 'incomplete' ? 'partial' : 'complete',
    resultSummary: Array.isArray(result.value) ? { count: result.value.length } : { kind: typeof result.value },
    executeUs,
  });
  return result;
}

export function postAnalysis(
  state: SymbolicRecord,
  focusRef: string,
  options: PostAnalysisOptions,
): PostAnalysisReceipt[] {
  const receipts: PostAnalysisReceipt[] = [];

  if (!state.expected_properties || Object.keys(state.expected_properties).length === 0) {
    receipts.push(recordSkipped('OP29', 'blocked', 'expected properties unavailable', options));
  } else {
    const result = executeAnalysis('OP29', state, focusRef, options);
    if (options.trace?.countersOnly) options.trace.countConsumption('OP29', 'information_only');
    else options.trace?.record({
      kind: 'consumption', needId: options.needId, op: 'OP29', consumer: 'postAnalysisReport',
      decisionRef: options.decisionRef, effectKind: 'information_only', semanticEffect: false,
      reason: 'comparison is exposed but no decision owner consumes it',
    });
    receipts.push({ op: 'OP29', disposition: 'information_only', result });
  }

  if (!Array.isArray(state.knowledge_updates) || state.knowledge_updates.length === 0) {
    receipts.push(recordSkipped('OP30', 'not_required', 'no knowledge updates supplied', options));
  } else {
    const result = executeAnalysis('OP30', state, focusRef, options);
    let writes = 0;
    for (const update of result.value as SymbolicRecord[]) {
      const key = `knowledge:${update.composition_ref}:${update.property}`;
      if (options.knowledge.put(key, { value: update.value, evidence: String(update.evidence), revision: Number(update.revision) })) writes += 1;
    }
    if (options.trace?.countersOnly) options.trace.countConsumption('OP30', 'persisted_only');
    else options.trace?.record({
      kind: 'consumption', needId: options.needId, op: 'OP30', consumer: 'knowledgeStore',
      decisionRef: options.decisionRef, effectKind: 'persisted_only', semanticEffect: writes > 0,
      reason: writes > 0 ? 'validated knowledge updates persisted' : 'no new durable knowledge written',
    });
    receipts.push({ op: 'OP30', disposition: 'persisted_only', result, writes });
  }

  if (!Array.isArray(state.objective_assessments) || state.objective_assessments.length === 0) {
    receipts.push(recordSkipped('OP31', 'not_required', 'no objective assessments supplied', options));
  } else {
    const result = executeAnalysis('OP31', state, focusRef, options);
    if (options.trace?.countersOnly) options.trace.countConsumption('OP31', 'information_only');
    else options.trace?.record({
      kind: 'consumption', needId: options.needId, op: 'OP31', consumer: 'postAnalysisReport',
      decisionRef: options.decisionRef, effectKind: 'information_only', semanticEffect: false,
      reason: 'assessment is exposed but no objective owner consumes it',
    });
    receipts.push({ op: 'OP31', disposition: 'information_only', result });
  }

  return receipts;
}
