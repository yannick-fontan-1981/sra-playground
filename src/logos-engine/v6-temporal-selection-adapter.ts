import {
  projectTemporalSelectionDecision,
  type TemporalSelectionAccepted,
  type TemporalSelectionContractResult,
  type TemporalSelectionRequest,
  type TemporalSourceAuthority,
} from './v6-temporal-selection-contract.ts';
import {
  markTemporalReturnConsumed,
  temporalReturnAlreadyConsumed,
  type TemporalObservationState,
} from './v6-temporal-observation-state.ts';
import {
  sameTemporalMeasuredBoundary,
  type TemporalReturnMeasurement,
} from './v6-temporal-return-contract.ts';

export interface ExternalTemporalSelectionResult {
  selectedRef: string | null;
  consumeReturn?: TemporalReturnMeasurement;
}

export interface TemporalSelectionConsumption {
  decision: TemporalSelectionContractResult;
  state: TemporalObservationState;
  consumedReturn: boolean;
  actAuthorized: false;
}

function requestFromState(state: TemporalObservationState): TemporalSelectionRequest {
  return {
    workflowRef: state.workflowRef,
    sourceHash: state.sourceHash,
    identity: structuredClone(state.identity),
    alternatives: state.alternatives.map(item => ({
      ref: item.ref,
      facts: structuredClone(item.facts),
      evidenceRefs: [...item.evidenceRefs],
    })),
    requirementRefs: [...state.requirementRefs],
    preserveRefs: [...state.preserveRefs],
  };
}

function selectedEvidence(decision: TemporalSelectionContractResult): readonly string[] {
  return decision.status === 'accepted' ? decision.selectedEvidenceRefs : [];
}

/**
 * Consume an externally supplied Source/DRM selection result.
 *
 * This adapter never chooses a candidate. It only projects the selected ref
 * through the reconstructed Source contract, optionally consumes one exact
 * already-qualified return boundary, and preserves ACT=false.
 */
export function consumeExternalTemporalSelection(
  state: TemporalObservationState,
  authority: TemporalSourceAuthority,
  external: ExternalTemporalSelectionResult,
): TemporalSelectionConsumption {
  const request = requestFromState(state);
  const decision = projectTemporalSelectionDecision(request, authority, external.selectedRef);

  if (decision.actAuthorized !== false) {
    throw new Error('temporal selection projection unexpectedly carried ACT authority');
  }

  let next = structuredClone(state);
  let consumedReturn = false;

  if (external.consumeReturn) {
    const stored = state.qualifiedReturns.find(item =>
      sameTemporalMeasuredBoundary(item, external.consumeReturn!)
    );
    if (!stored) {
      throw new Error('external selection references an unqualified temporal return');
    }

    const evidence = new Set(selectedEvidence(decision));
    const overlapsSelectedEvidence = stored.evidenceRefs.some(ref => evidence.has(ref));

    if (decision.status !== 'accepted') {
      throw new Error('a refused temporal selection cannot consume a return for a selected candidate');
    }
    if (!overlapsSelectedEvidence) {
      throw new Error('temporal return evidence is not linked to the selected alternative');
    }

    consumedReturn = !temporalReturnAlreadyConsumed(state, stored);
    next = markTemporalReturnConsumed(state, stored);
  }

  return {
    decision,
    state: next,
    consumedReturn,
    actAuthorized: false,
  };
}

export function acceptedTemporalSelection(
  result: TemporalSelectionConsumption,
): TemporalSelectionAccepted | null {
  return result.decision.status === 'accepted' ? result.decision : null;
}
