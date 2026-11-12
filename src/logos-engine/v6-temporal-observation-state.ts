import {
  validateTemporalSelectionRequest,
  type TemporalObservationIdentity,
  type TemporalSelectionAlternative,
  type TemporalSelectionRequest,
  type TemporalSourceAuthority,
} from './v6-temporal-selection-contract.ts';
import {
  validateTemporalMemoryReuse,
  type TemporalMemoryIntent,
  type TemporalMemoryProof,
  type TemporalMemoryReuseContract,
} from './v6-temporal-memory-contract.ts';
import {
  sameTemporalMeasuredBoundary,
  temporalReturnReadyForConsumption,
  type TemporalReturnMeasurement,
} from './v6-temporal-return-contract.ts';

/**
 * Minimal descriptive TemporalSelection observation state.
 *
 * This state intentionally contains no policy, priority, selected candidate,
 * action proposal or ACT authority. It only composes already-qualified
 * contracts reconstructed from durable Source/V5 evidence.
 */
export interface TemporalObservationState {
  schemaVersion: 'sra.temporal_observation_state.v1';
  workflowRef: string;
  sourceHash: string;
  identity: TemporalObservationIdentity;
  alternatives: readonly TemporalSelectionAlternative[];
  requirementRefs: readonly string[];
  preserveRefs: readonly string[];
  qualifiedReturns: readonly TemporalReturnMeasurement[];
  consumedReturnIdentityKeys: readonly string[];
  memoryReuseContract: TemporalMemoryReuseContract | null;
  memoryProofRefs: readonly string[];
  actAuthorized: false;
}

const MAX_QUALIFIED_RETURNS = 32;

function cloneAlternatives(
  alternatives: readonly TemporalSelectionAlternative[],
): TemporalSelectionAlternative[] {
  return alternatives.map(item => ({
    ref: item.ref,
    facts: structuredClone(item.facts),
    evidenceRefs: [...item.evidenceRefs],
  }));
}

function returnIdentityKey(measurement: TemporalReturnMeasurement): string {
  return JSON.stringify(measurement.identityVector);
}

function uniqueStrings(values: readonly string[], label: string): string[] {
  if (new Set(values).size !== values.length) throw new Error(`${label} contains duplicate refs`);
  return [...values];
}

function selectionRequestFromState(state: TemporalObservationState): TemporalSelectionRequest {
  return {
    workflowRef: state.workflowRef,
    sourceHash: state.sourceHash,
    identity: structuredClone(state.identity),
    alternatives: cloneAlternatives(state.alternatives),
    requirementRefs: [...state.requirementRefs],
    preserveRefs: [...state.preserveRefs],
  };
}

export function createTemporalObservationState(
  request: TemporalSelectionRequest,
  authority: TemporalSourceAuthority,
): TemporalObservationState {
  const invalid = validateTemporalSelectionRequest(request, authority);
  if (invalid) throw new Error(`invalid temporal selection envelope: ${invalid.reason}`);

  return {
    schemaVersion: 'sra.temporal_observation_state.v1',
    workflowRef: request.workflowRef,
    sourceHash: request.sourceHash,
    identity: structuredClone(request.identity),
    alternatives: cloneAlternatives(request.alternatives),
    requirementRefs: uniqueStrings(request.requirementRefs, 'requirementRefs'),
    preserveRefs: uniqueStrings(request.preserveRefs, 'preserveRefs'),
    qualifiedReturns: [],
    consumedReturnIdentityKeys: [],
    memoryReuseContract: null,
    memoryProofRefs: [],
    actAuthorized: false,
  };
}

export function attachQualifiedTemporalReturn(
  state: TemporalObservationState,
  measurement: TemporalReturnMeasurement,
): TemporalObservationState {
  if (!temporalReturnReadyForConsumption(measurement)) {
    throw new Error('temporal return is not qualified for consumption');
  }
  if (measurement.recipientWorkflowRef !== state.workflowRef) {
    throw new Error('temporal return belongs to a different workflow');
  }
  if (measurement.comparisonRevision !== state.identity.observationRevision) {
    throw new Error('temporal return belongs to a different observation revision');
  }

  const existing = state.qualifiedReturns.find(item => sameTemporalMeasuredBoundary(item, measurement));
  if (existing) return structuredClone(state);
  if (state.qualifiedReturns.length >= MAX_QUALIFIED_RETURNS) {
    throw new Error('temporal qualified return bound exceeded');
  }

  return {
    ...structuredClone(state),
    qualifiedReturns: [...state.qualifiedReturns.map(item => structuredClone(item)), structuredClone(measurement)],
    actAuthorized: false,
  };
}

export function attachTemporalMemoryReuse(
  state: TemporalObservationState,
  intent: TemporalMemoryIntent,
  proofs: Readonly<Record<string, TemporalMemoryProof>>,
): TemporalObservationState {
  if (intent.frameId !== state.identity.observationId) {
    throw new Error('temporal memory intent belongs to a different observation');
  }
  validateTemporalMemoryReuse(intent, proofs, state.identity.observationId);

  const contract = intent.memoryReuseContract;
  const refs = contract
    ? [...contract.recalledClaimRefs, ...contract.currentSupportClaimRefs]
    : [];

  return {
    ...structuredClone(state),
    memoryReuseContract: contract ? structuredClone(contract) : null,
    memoryProofRefs: [...new Set(refs)].sort(),
    actAuthorized: false,
  };
}

export function markTemporalReturnConsumed(
  state: TemporalObservationState,
  measurement: TemporalReturnMeasurement,
): TemporalObservationState {
  const stored = state.qualifiedReturns.find(item => sameTemporalMeasuredBoundary(item, measurement));
  if (!stored) throw new Error('cannot consume an unqualified temporal return');

  const key = returnIdentityKey(stored);
  if (state.consumedReturnIdentityKeys.includes(key)) return structuredClone(state);

  return {
    ...structuredClone(state),
    consumedReturnIdentityKeys: [...state.consumedReturnIdentityKeys, key],
    actAuthorized: false,
  };
}

export function temporalReturnAlreadyConsumed(
  state: TemporalObservationState,
  measurement: TemporalReturnMeasurement,
): boolean {
  return state.consumedReturnIdentityKeys.includes(returnIdentityKey(measurement));
}

export function snapshotTemporalObservationState(
  state: TemporalObservationState,
): TemporalObservationState {
  return structuredClone(state);
}

export function restoreTemporalObservationState(
  snapshot: TemporalObservationState,
  authority: TemporalSourceAuthority,
): TemporalObservationState {
  if (snapshot.schemaVersion !== 'sra.temporal_observation_state.v1') {
    throw new Error('unsupported temporal observation state version');
  }
  if (snapshot.actAuthorized !== false) {
    throw new Error('temporal observation state cannot carry ACT authority');
  }
  if (snapshot.qualifiedReturns.length > MAX_QUALIFIED_RETURNS) {
    throw new Error('temporal qualified return bound exceeded');
  }

  const request = selectionRequestFromState(snapshot);
  const invalid = validateTemporalSelectionRequest(request, authority);
  if (invalid) throw new Error(`invalid restored temporal selection envelope: ${invalid.reason}`);

  const returnKeys = snapshot.qualifiedReturns.map(item => {
    if (!temporalReturnReadyForConsumption(item)) {
      throw new Error('restored temporal return is not qualified');
    }
    if (item.recipientWorkflowRef !== snapshot.workflowRef) {
      throw new Error('restored temporal return belongs to a different workflow');
    }
    if (item.comparisonRevision !== snapshot.identity.observationRevision) {
      throw new Error('restored temporal return belongs to a different observation revision');
    }
    return returnIdentityKey(item);
  });
  if (new Set(returnKeys).size !== returnKeys.length) {
    throw new Error('restored temporal state contains duplicate measured returns');
  }

  uniqueStrings(snapshot.requirementRefs, 'requirementRefs');

  if (snapshot.memoryReuseContract === null) {
    if (snapshot.memoryProofRefs.length !== 0) {
      throw new Error('restored temporal state has memory proof refs without a memory contract');
    }
  } else {
    if (snapshot.memoryReuseContract.observationRef !== snapshot.identity.observationId) {
      throw new Error('restored temporal memory belongs to a different observation');
    }
    const memoryRefs = [
      ...snapshot.memoryReuseContract.recalledClaimRefs,
      ...snapshot.memoryReuseContract.currentSupportClaimRefs,
    ];
    if (
      snapshot.memoryReuseContract.recalledClaimRefs.length < 1
      || snapshot.memoryReuseContract.recalledClaimRefs.length > 32
      || snapshot.memoryReuseContract.currentSupportClaimRefs.length < 1
      || snapshot.memoryReuseContract.currentSupportClaimRefs.length > 32
      || new Set(memoryRefs).size !== memoryRefs.length
    ) {
      throw new Error('restored temporal memory contract has an invalid bounded proof domain');
    }
    const expectedProofRefs = [...memoryRefs].sort();
    const restoredProofRefs = uniqueStrings(snapshot.memoryProofRefs, 'memoryProofRefs').sort();
    if (JSON.stringify(expectedProofRefs) !== JSON.stringify(restoredProofRefs)) {
      throw new Error('restored temporal memory proof refs differ from the memory contract');
    }
    if (memoryRefs.some(ref => typeof snapshot.memoryReuseContract?.claimDigests[ref] !== 'string')) {
      throw new Error('restored temporal memory contract is missing a proof digest');
    }
  }

  const consumed = uniqueStrings(snapshot.consumedReturnIdentityKeys, 'consumedReturnIdentityKeys');
  const available = new Set(returnKeys);
  if (consumed.some(key => !available.has(key))) {
    throw new Error('restored consumed return has no qualified measured boundary');
  }

  return structuredClone({
    ...snapshot,
    consumedReturnIdentityKeys: consumed,
    actAuthorized: false,
  });
}
