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
import {
  validateTemporalSourceDecisionReceipt,
  type TemporalSourceDecisionReceipt,
} from './v6-temporal-decision-receipt.ts';

export interface ExternalTemporalSelectionResult {
  decisionReceipt: TemporalSourceDecisionReceipt;
  consumeReturn?: TemporalReturnMeasurement;
}

export interface TemporalSelectionConsumption {
  decision: TemporalSelectionContractResult;
  decisionReceipt: TemporalSourceDecisionReceipt;
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
 * Consume a fully attributed Source/DRM selection receipt.
 *
 * This adapter never chooses a candidate. It validates the external receipt
 * against the current Source envelope and observation, then projects its
 * selected ref through the reconstructed selection contract.
 */
export function consumeExternalTemporalSelection(
  state: TemporalObservationState,
  authority: TemporalSourceAuthority,
  external: ExternalTemporalSelectionResult,
): TemporalSelectionConsumption {
  const request = requestFromState(state);
  validateTemporalSourceDecisionReceipt(external.decisionReceipt, request, authority);

  const decision = projectTemporalSelectionDecision(
    request,
    authority,
    external.decisionReceipt.selectedRef,
  );

  if (decision.actAuthorized !== false || external.decisionReceipt.actAuthorized !== false) {
    throw new Error('temporal selection unexpectedly carried ACT authority');
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
    decisionReceipt: structuredClone(external.decisionReceipt),
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
