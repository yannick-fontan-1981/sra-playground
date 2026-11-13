/**
 * Reconstructed TemporalSelection contract.
 *
 * This is NOT a recreation of the lost Site 109 selector implementation.
 * It captures only invariants supported by durable V5 Source/DRM code:
 * - bounded, Source-authorized selection;
 * - fail closed on unresolved selection;
 * - preserve the declared alternatives and their evidence;
 * - consume a return at most once;
 * - never turn re-entry/refusal into ACT authority.
 */

export interface TemporalSourceAuthority {
  workflowRef: string;
  sourceHash: string;
  authorizedWorkflowRefs: readonly string[];
  authorizedSourceHash: string;
}

export interface TemporalObservationIdentity {
  episodeId: string;
  levelEpoch: string | number;
  observationId: string;
  observationRevision: number;
}

export interface TemporalSelectionAlternative {
  ref: string;
  facts: Readonly<Record<string, unknown>>;
  evidenceRefs: readonly string[];
}

export interface TemporalSelectionRequest {
  workflowRef: string;
  sourceHash: string;
  identity: TemporalObservationIdentity;
  alternatives: readonly TemporalSelectionAlternative[];
  requirementRefs: readonly string[];
  preserveRefs: readonly string[];
  receiptRef?: string;
  receiptPreviouslyConsumed?: boolean;
}

export type TemporalSelectionRefusalReason =
  | 'source_authority_mismatch'
  | 'empty_alternative_domain'
  | 'duplicate_alternative_ref'
  | 'preserve_domain_mismatch'
  | 'receipt_already_consumed'
  | 'unresolved_selection'
  | 'selected_ref_outside_domain';

export interface TemporalSelectionAccepted {
  status: 'accepted';
  selectedRef: string;
  selectedFacts: Readonly<Record<string, unknown>>;
  selectedEvidenceRefs: readonly string[];
  preservedAlternativeRefs: readonly string[];
  actAuthorized: false;
}

export interface TemporalSelectionRefused {
  status: 'refused';
  reason: TemporalSelectionRefusalReason;
  preservedAlternativeRefs: readonly string[];
  actAuthorized: false;
}

export type TemporalSelectionContractResult = TemporalSelectionAccepted | TemporalSelectionRefused;

function canonicalRefs(alternatives: readonly TemporalSelectionAlternative[]): string[] {
  return [...alternatives.map(item => item.ref)].sort();
}

function refuse(
  reason: TemporalSelectionRefusalReason,
  alternatives: readonly TemporalSelectionAlternative[],
): TemporalSelectionRefused {
  return {
    status: 'refused',
    reason,
    preservedAlternativeRefs: canonicalRefs(alternatives),
    actAuthorized: false,
  };
}

/**
 * Validate only the Source-owned selection envelope.
 * No candidate is chosen here.
 */
export function validateTemporalSelectionRequest(
  request: TemporalSelectionRequest,
  authority: TemporalSourceAuthority,
): TemporalSelectionRefused | null {
  const sourceAuthorized =
    request.workflowRef === authority.workflowRef
    && request.sourceHash === authority.sourceHash
    && authority.authorizedWorkflowRefs.includes(request.workflowRef)
    && authority.authorizedSourceHash === request.sourceHash;
  if (!sourceAuthorized) return refuse('source_authority_mismatch', request.alternatives);

  if (request.alternatives.length === 0) return refuse('empty_alternative_domain', request.alternatives);

  const refs = request.alternatives.map(item => item.ref);
  if (new Set(refs).size !== refs.length) return refuse('duplicate_alternative_ref', request.alternatives);

  const preserved = [...request.preserveRefs].sort();
  const canonical = canonicalRefs(request.alternatives);
  if (JSON.stringify(preserved) !== JSON.stringify(canonical)) {
    return refuse('preserve_domain_mismatch', request.alternatives);
  }

  if (request.receiptRef && request.receiptPreviouslyConsumed) {
    return refuse('receipt_already_consumed', request.alternatives);
  }

  return null;
}

/**
 * Project a Source/DRM selection result without inventing a fallback.
 *
 * A null selection is an explicit refusal. A selected ref must belong to the
 * exact declared domain. This function never authorizes ACT.
 */
export function projectTemporalSelectionDecision(
  request: TemporalSelectionRequest,
  authority: TemporalSourceAuthority,
  selectedRef: string | null,
): TemporalSelectionContractResult {
  const invalid = validateTemporalSelectionRequest(request, authority);
  if (invalid) return invalid;

  if (selectedRef === null) return refuse('unresolved_selection', request.alternatives);

  const selected = request.alternatives.find(item => item.ref === selectedRef);
  if (!selected) return refuse('selected_ref_outside_domain', request.alternatives);

  return {
    status: 'accepted',
    selectedRef: selected.ref,
    selectedFacts: structuredClone(selected.facts),
    selectedEvidenceRefs: [...selected.evidenceRefs],
    preservedAlternativeRefs: canonicalRefs(request.alternatives),
    actAuthorized: false,
  };
}
