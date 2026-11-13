import type { OperationTraceSink } from './v6-operation-trace.ts';
import {
  consumeExternalTemporalSelection,
  type TemporalSelectionConsumption,
} from './v6-temporal-selection-adapter.ts';
import type { TemporalSourceDecisionReceipt } from './v6-temporal-decision-receipt.ts';
import type { TemporalObservationState } from './v6-temporal-observation-state.ts';
import type { TemporalSourceAuthority } from './v6-temporal-selection-contract.ts';
import type { TemporalReturnMeasurement } from './v6-temporal-return-contract.ts';

export interface TemporalSelectionBridgeOptions {
  reason: string;
  trace?: OperationTraceSink;
  consumeReturn?: TemporalReturnMeasurement;
  producer?: string;
  caller?: string;
  consumer?: string;
}

export interface TemporalSelectionBridgeResult extends TemporalSelectionConsumption {
  needId: string;
  decisionRef: string;
}

const CAPABILITY = 'temporal-selection';

function needId(state: TemporalObservationState, receipt: TemporalSourceDecisionReceipt): string {
  const identity = state.identity;
  return [
    'need',
    CAPABILITY,
    identity.episodeId,
    String(identity.levelEpoch),
    identity.observationId,
    receipt.decisionFingerprint,
  ].join(':');
}

function dependencyRefs(
  state: TemporalObservationState,
  receipt: TemporalSourceDecisionReceipt,
): string[] {
  return [...new Set([
    receipt.decisionFingerprint,
    ...state.alternatives.map(item => item.ref),
    ...receipt.evidenceRefs,
    ...state.memoryProofRefs,
  ])];
}

function errorReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 512);
}

/**
 * Trace a verified externally produced TemporalSelection decision through the
 * existing bounded Logos trace sink.
 *
 * This bridge does not execute OP01-OP31, does not choose a candidate and does
 * not release ACT. It records a capability chain instead of inventing a fake OP.
 */
export function runTemporalSelectionBridge(
  state: TemporalObservationState,
  authority: TemporalSourceAuthority,
  decisionReceipt: TemporalSourceDecisionReceipt,
  options: TemporalSelectionBridgeOptions,
): TemporalSelectionBridgeResult {
  const producer = options.producer ?? 'temporalSelectionBridge';
  const caller = options.caller ?? 'temporalSelectionBridge';
  const consumer = options.consumer ?? 'temporalSelectionBridge';
  const id = needId(state, decisionReceipt);
  const refs = dependencyRefs(state, decisionReceipt);

  options.trace?.record({
    kind: 'need',
    needId: id,
    needKind: CAPABILITY,
    reason: options.reason,
    producer,
    episodeId: state.identity.episodeId,
    levelEpoch: state.identity.levelEpoch,
    observationId: state.identity.observationId,
    observationRevision: state.identity.observationRevision,
    dependencyRefs: refs,
    completeness: 'complete',
  });

  const started = performance.now();
  try {
    const consumption = consumeExternalTemporalSelection(state, authority, {
      decisionReceipt,
      consumeReturn: options.consumeReturn,
    });
    const executeUs = (performance.now() - started) * 1000;
    const accepted = consumption.decision.status === 'accepted';

    options.trace?.record({
      kind: 'capability',
      needId: id,
      capability: CAPABILITY,
      caller,
      mode: accepted ? 'accepted' : 'refused',
      reason: accepted
        ? 'Source/DRM decision receipt verified and projected into the current domain'
        : `Source/DRM decision receipt verified with refusal: ${consumption.decision.reason}`,
      inputRefs: refs,
      dependencyRevisions: {
        observation: state.identity.observationRevision,
      },
      resultStatus: 'complete',
      resultSummary: {
        selectedRef: accepted ? consumption.decision.selectedRef : null,
        refusalReason: accepted ? null : consumption.decision.reason,
        decisionFingerprint: decisionReceipt.decisionFingerprint,
        alternativeCount: state.alternatives.length,
        actAuthorized: false,
      },
      executeUs,
    });

    options.trace?.record({
      kind: 'capability_consumption',
      needId: id,
      capability: CAPABILITY,
      consumer,
      decisionRef: decisionReceipt.decisionFingerprint,
      effectKind: accepted ? 'project' : 'refuse',
      semanticEffect: accepted,
      reason: accepted
        ? 'verified external selection projected without granting ACT'
        : 'verified refusal preserved without fallback or ACT',
    });

    if (options.consumeReturn) {
      options.trace?.record({
        kind: 'capability_consumption',
        needId: id,
        capability: CAPABILITY,
        consumer,
        decisionRef: decisionReceipt.decisionFingerprint,
        effectKind: 'consume_evidence',
        semanticEffect: consumption.consumedReturn,
        reason: consumption.consumedReturn
          ? 'exact qualified return boundary consumed once'
          : 'exact qualified return boundary was already consumed',
      });
    }

    return {
      ...consumption,
      needId: id,
      decisionRef: decisionReceipt.decisionFingerprint,
      actAuthorized: false,
    };
  } catch (error) {
    const executeUs = (performance.now() - started) * 1000;
    const reason = errorReason(error);

    options.trace?.record({
      kind: 'capability',
      needId: id,
      capability: CAPABILITY,
      caller,
      mode: 'blocked',
      reason,
      inputRefs: refs,
      dependencyRevisions: {
        observation: state.identity.observationRevision,
      },
      resultStatus: 'unknown',
      resultSummary: {
        decisionFingerprint: decisionReceipt.decisionFingerprint,
        actAuthorized: false,
      },
      executeUs,
    });
    options.trace?.record({
      kind: 'capability_consumption',
      needId: id,
      capability: CAPABILITY,
      consumer,
      decisionRef: decisionReceipt.decisionFingerprint,
      effectKind: 'refuse',
      semanticEffect: false,
      reason: `temporal selection bridge blocked: ${reason}`,
    });
    throw error;
  }
}
