export type OperationTraceMode = 'executed' | 'cache_reused' | 'not_required' | 'blocked';
export type OperationCompleteness = 'complete' | 'partial' | 'unknown' | 'not_produced';
export type OperationEffectKind =
  | 'filter'
  | 'guard'
  | 'prioritize'
  | 'maintain'
  | 'revise'
  | 'stop'
  | 'information_only'
  | 'persisted_only';

export type CapabilityTraceMode = 'accepted' | 'refused' | 'blocked';
export type CapabilityEffectKind = 'project' | 'consume_evidence' | 'refuse';

export interface OperationNeedEvent {
  kind: 'need';
  needId: string;
  needKind: string;
  reason: string;
  producer: string;
  episodeId: string;
  levelEpoch: string | number;
  observationId: string;
  observationRevision: number;
  focusRef?: string;
  objectiveRef?: string;
  strategyRef?: string;
  dependencyRefs: string[];
  completeness: OperationCompleteness;
}

export interface OperationCallEvent {
  kind: 'operation';
  needId: string;
  op: `OP${string}`;
  caller: string;
  mode: OperationTraceMode;
  reason: string;
  inputRefs: string[];
  dependencyRevisions: Record<string, string | number>;
  resultStatus: OperationCompleteness;
  resultSummary?: unknown;
  prepareUs?: number;
  executeUs?: number;
  traceBytes?: number;
}

export interface OperationConsumptionEvent {
  kind: 'consumption';
  needId: string;
  op: `OP${string}`;
  consumer: string;
  decisionRef: string;
  effectKind: OperationEffectKind;
  semanticEffect: boolean | 'unknown';
  reason: string;
}

/**
 * Decision event for a bounded capability that is not an OP01-OP31 execution.
 *
 * This prevents integrations such as TemporalSelection from inventing a fake
 * OP key merely to reuse the common bounded trace sink.
 */
export interface CapabilityDecisionEvent {
  kind: 'capability';
  needId: string;
  capability: string;
  caller: string;
  mode: CapabilityTraceMode;
  reason: string;
  inputRefs: string[];
  dependencyRevisions: Record<string, string | number>;
  resultStatus: OperationCompleteness;
  resultSummary?: unknown;
  executeUs?: number;
  traceBytes?: number;
}

export interface CapabilityConsumptionEvent {
  kind: 'capability_consumption';
  needId: string;
  capability: string;
  consumer: string;
  decisionRef: string;
  effectKind: CapabilityEffectKind;
  semanticEffect: boolean | 'unknown';
  reason: string;
}

export type OperationTraceEvent =
  | OperationNeedEvent
  | OperationCallEvent
  | OperationConsumptionEvent
  | CapabilityDecisionEvent
  | CapabilityConsumptionEvent;

export interface OperationTraceSnapshot {
  readonly dropped: number;
  readonly events: readonly OperationTraceEvent[];
  readonly counters: Readonly<Record<string, number>>;
}

/**
 * Bounded, decision-neutral operation trace.
 *
 * The sink never invokes an operation or capability and never decides whether
 * one is needed. Producers/callers/consumers explicitly emit events at their
 * existing decision points. Normal mode keeps only a small bounded tail and
 * counters.
 */
export class OperationTraceSink {
  readonly #capacity: number;
  readonly #events: OperationTraceEvent[] = [];
  readonly #counters = new Map<string, number>();
  #dropped = 0;

  constructor(capacity = 128) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 4096) {
      throw new RangeError('Operation trace capacity must be an integer in [1, 4096].');
    }
    this.#capacity = capacity;
  }

  record(event: OperationTraceEvent): void {
    let counter: string;
    switch (event.kind) {
      case 'operation':
        counter = `${event.kind}:${event.op}:${event.mode}`;
        break;
      case 'consumption':
        counter = `${event.kind}:${event.op}:${event.effectKind}`;
        break;
      case 'capability':
        counter = `${event.kind}:${event.capability}:${event.mode}`;
        break;
      case 'capability_consumption':
        counter = `${event.kind}:${event.capability}:${event.effectKind}`;
        break;
      case 'need':
        counter = `${event.kind}:${event.needKind}`;
        break;
    }
    this.#counters.set(counter, (this.#counters.get(counter) ?? 0) + 1);

    if (this.#events.length === this.#capacity) {
      this.#events.shift();
      this.#dropped += 1;
    }
    this.#events.push(structuredClone(event));
  }

  snapshot(): OperationTraceSnapshot {
    return {
      dropped: this.#dropped,
      events: structuredClone(this.#events),
      counters: Object.fromEntries(this.#counters),
    };
  }

  clear(): void {
    this.#events.length = 0;
    this.#counters.clear();
    this.#dropped = 0;
  }
}

export interface OperationCacheIdentity {
  op: `OP${string}`;
  focusRef?: string;
  levelEpoch: string | number;
  observationId: string;
  observationRevision: number;
  inputRefs: readonly string[];
  dependencyRevisions: Readonly<Record<string, string | number>>;
  objectiveRef?: string;
  strategyRef?: string;
}

function sortedObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, sortedObject(item)]),
  );
}

/** Exact dependency identity; any relevant revision change invalidates reuse. */
export function operationCacheKey(identity: OperationCacheIdentity): string {
  return JSON.stringify(sortedObject({
    ...identity,
    inputRefs: [...identity.inputRefs],
  }));
}
