import type {
  TemporalObservationIdentity,
  TemporalSelectionRequest,
  TemporalSourceAuthority,
} from './v6-temporal-selection-contract.ts';

export interface TemporalSourceDecisionReceipt {
  schemaVersion: 'sra.temporal_source_decision_receipt.v1';
  workflowRef: string;
  sourceHash: string;
  drmSourceHashes: readonly string[];
  identity: TemporalObservationIdentity;
  alternativeRefs: readonly string[];
  selectedRef: string | null;
  evidenceRefs: readonly string[];
  decisionFingerprint: string;
  actAuthorized: false;
}

function canonicalStrings(values: readonly string[]): string[] {
  return [...values].sort();
}

function canonicalPayload(receipt: Omit<TemporalSourceDecisionReceipt, 'decisionFingerprint'>): string {
  return JSON.stringify({
    schemaVersion: receipt.schemaVersion,
    workflowRef: receipt.workflowRef,
    sourceHash: receipt.sourceHash,
    drmSourceHashes: canonicalStrings(receipt.drmSourceHashes),
    identity: receipt.identity,
    alternativeRefs: canonicalStrings(receipt.alternativeRefs),
    selectedRef: receipt.selectedRef,
    evidenceRefs: canonicalStrings(receipt.evidenceRefs),
    actAuthorized: false,
  });
}

/**
 * Deterministic identity seal over the exact decision payload.
 *
 * This is an identity fingerprint, not a cryptographic signature or trust root.
 * Trust still comes from matching the current Source authority and observation.
 */
export function temporalDecisionFingerprint(
  receipt: Omit<TemporalSourceDecisionReceipt, 'decisionFingerprint'>,
): string {
  const payload = canonicalPayload(receipt);
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function createTemporalSourceDecisionReceipt(
  request: TemporalSelectionRequest,
  authority: TemporalSourceAuthority,
  drmSourceHashes: readonly string[],
  selectedRef: string | null,
  evidenceRefs: readonly string[],
): TemporalSourceDecisionReceipt {
  if (
    request.workflowRef !== authority.workflowRef
    || request.sourceHash !== authority.sourceHash
    || !authority.authorizedWorkflowRefs.includes(request.workflowRef)
    || authority.authorizedSourceHash !== request.sourceHash
  ) {
    throw new Error('cannot create temporal decision receipt from mismatched Source authority');
  }
  if (drmSourceHashes.length < 1 || new Set(drmSourceHashes).size !== drmSourceHashes.length) {
    throw new Error('temporal decision receipt requires unique DRM source hashes');
  }
  const refs = request.alternatives.map(item => item.ref);
  if (selectedRef !== null && !refs.includes(selectedRef)) {
    throw new Error('temporal decision receipt selected ref is outside the Source domain');
  }
  const base: Omit<TemporalSourceDecisionReceipt, 'decisionFingerprint'> = {
    schemaVersion: 'sra.temporal_source_decision_receipt.v1',
    workflowRef: request.workflowRef,
    sourceHash: request.sourceHash,
    drmSourceHashes: [...drmSourceHashes],
    identity: structuredClone(request.identity),
    alternativeRefs: canonicalStrings(refs),
    selectedRef,
    evidenceRefs: [...evidenceRefs],
    actAuthorized: false,
  };
  return {
    ...base,
    decisionFingerprint: temporalDecisionFingerprint(base),
  };
}

export function validateTemporalSourceDecisionReceipt(
  receipt: TemporalSourceDecisionReceipt,
  request: TemporalSelectionRequest,
  authority: TemporalSourceAuthority,
): void {
  if (receipt.schemaVersion !== 'sra.temporal_source_decision_receipt.v1') {
    throw new Error('unsupported temporal decision receipt version');
  }
  if (receipt.actAuthorized !== false) {
    throw new Error('temporal decision receipt cannot carry ACT authority');
  }
  if (
    receipt.workflowRef !== request.workflowRef
    || receipt.workflowRef !== authority.workflowRef
    || receipt.sourceHash !== request.sourceHash
    || receipt.sourceHash !== authority.sourceHash
    || authority.authorizedSourceHash !== receipt.sourceHash
    || !authority.authorizedWorkflowRefs.includes(receipt.workflowRef)
  ) {
    throw new Error('temporal decision receipt Source identity mismatch');
  }
  if (JSON.stringify(receipt.identity) !== JSON.stringify(request.identity)) {
    throw new Error('temporal decision receipt observation identity mismatch');
  }
  if (receipt.drmSourceHashes.length < 1 || new Set(receipt.drmSourceHashes).size !== receipt.drmSourceHashes.length) {
    throw new Error('temporal decision receipt DRM identity is invalid');
  }
  const expectedAlternatives = canonicalStrings(request.alternatives.map(item => item.ref));
  if (JSON.stringify(canonicalStrings(receipt.alternativeRefs)) !== JSON.stringify(expectedAlternatives)) {
    throw new Error('temporal decision receipt alternative domain mismatch');
  }
  if (receipt.selectedRef !== null && !expectedAlternatives.includes(receipt.selectedRef)) {
    throw new Error('temporal decision receipt selected ref is outside the current domain');
  }
  const base: Omit<TemporalSourceDecisionReceipt, 'decisionFingerprint'> = {
    schemaVersion: receipt.schemaVersion,
    workflowRef: receipt.workflowRef,
    sourceHash: receipt.sourceHash,
    drmSourceHashes: [...receipt.drmSourceHashes],
    identity: structuredClone(receipt.identity),
    alternativeRefs: [...receipt.alternativeRefs],
    selectedRef: receipt.selectedRef,
    evidenceRefs: [...receipt.evidenceRefs],
    actAuthorized: false,
  };
  if (receipt.decisionFingerprint !== temporalDecisionFingerprint(base)) {
    throw new Error('temporal decision receipt fingerprint mismatch');
  }
}
