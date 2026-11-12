/**
 * Reconstructed return-identity contract for Lot 10D.
 *
 * Derived from scheduler/contribution_contract.py::measure_return_identity.
 * This module measures identity/scope/chronology only. It does not interpret
 * the payload semantically and never grants ACT.
 */

export interface TemporalContributionRequest {
  requestRef: string;
  recipientWorkflowRef: string;
  timelineRef: string;
  requestedAtRevision: number;
  expectedProducerDefinitionRef: string;
  expectedProducerSourceHash: string;
  scopeRefs: readonly string[];
}

export interface TemporalContributionReturn {
  request: TemporalContributionRequest;
  producerDefinitionRef: string;
  producerSourceHash: string;
  returnedAtRevision: number;
  productRefs: readonly string[];
  evidenceRefs: readonly string[];
  requiresCurrentRevalidation: boolean;
  returnDigest: string;
}

export interface TemporalReturnMeasureInput {
  request: TemporalContributionRequest;
  returned: TemporalContributionReturn;
  consumerRef: string;
  timelineRef: string;
  currentScopeRefs: readonly string[];
  currentRevision: number;
  productRevisions: Readonly<Record<string, number>>;
  productDigests?: Readonly<Record<string, string>>;
  producerMatches: boolean;
  sourceTerminalMatches: boolean;
  requestOriginMatches: boolean;
  shapeErrors?: readonly string[];
}

export interface TemporalReturnMeasurement {
  requestRef: string;
  recipientWorkflowRef: string;
  returnDigest: string;
  comparisonRevision: number;
  returnShapeValid: boolean;
  returnShapeErrorFields: readonly string[];
  returnRequestMatches: boolean;
  returnRequestOriginMatches: boolean;
  returnRecipientMatches: boolean;
  returnProducerMatches: boolean;
  returnSourceTerminalMatches: boolean;
  returnTimelineMatches: boolean;
  returnScopeMatches: boolean;
  returnChronologyMatches: boolean;
  returnProductsPresent: boolean;
  returnMissingProductRefs: readonly string[];
  returnProductDigests: Readonly<Record<string, string>>;
  returnedRequiresCurrentRevalidation: boolean;
  productRefs: readonly string[];
  evidenceRefs: readonly string[];
  identityVector: readonly unknown[];
  actAuthorized: false;
}

function sameRequest(a: TemporalContributionRequest, b: TemporalContributionRequest): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function measureTemporalReturnIdentity(input: TemporalReturnMeasureInput): TemporalReturnMeasurement {
  const shapeErrors = [...(input.shapeErrors ?? [])];
  const shapeValid = shapeErrors.length === 0;
  const returned = input.returned;
  const request = input.request;

  const chronologyMatches =
    Number.isInteger(request.requestedAtRevision)
    && Number.isInteger(returned.returnedAtRevision)
    && request.requestedAtRevision >= 0
    && request.requestedAtRevision <= returned.returnedAtRevision
    && returned.returnedAtRevision <= input.currentRevision;

  const refs = shapeValid ? [...returned.productRefs] : [];
  const missing = refs.filter(ref => input.productRevisions[ref] === undefined);
  const sealedDigests: Record<string, string> = {};
  if (input.productDigests) {
    for (const ref of refs) {
      const digest = input.productDigests[ref];
      if (digest !== undefined) sealedDigests[ref] = digest;
    }
  }

  const returnRequestMatches = sameRequest(returned.request, request);
  const returnRecipientMatches = request.recipientWorkflowRef === input.consumerRef;
  const returnTimelineMatches = request.timelineRef === input.timelineRef;
  const returnScopeMatches = JSON.stringify(request.scopeRefs) === JSON.stringify(input.currentScopeRefs);

  const comparisons = {
    returnShapeValid: shapeValid,
    returnShapeErrorFields: shapeErrors,
    returnRequestMatches,
    returnRequestOriginMatches: input.requestOriginMatches,
    returnRecipientMatches,
    returnProducerMatches: input.producerMatches,
    returnSourceTerminalMatches: input.sourceTerminalMatches,
    returnTimelineMatches,
    returnScopeMatches,
    returnChronologyMatches: chronologyMatches,
    returnProductsPresent: missing.length === 0,
    returnMissingProductRefs: missing,
    returnProductDigests: sealedDigests,
  };

  const identityVector: readonly unknown[] = [
    request.requestRef,
    input.consumerRef,
    returned.returnDigest,
    input.timelineRef,
    [...input.currentScopeRefs],
    comparisons,
    refs.map(ref => [ref, input.productRevisions[ref]]),
  ];

  return {
    requestRef: request.requestRef,
    recipientWorkflowRef: input.consumerRef,
    returnDigest: returned.returnDigest,
    comparisonRevision: input.currentRevision,
    ...comparisons,
    returnedRequiresCurrentRevalidation: returned.requiresCurrentRevalidation,
    productRefs: refs,
    evidenceRefs: shapeValid ? [...returned.evidenceRefs] : [],
    identityVector,
    actAuthorized: false,
  };
}

export function sameTemporalMeasuredBoundary(
  a: TemporalReturnMeasurement,
  b: TemporalReturnMeasurement,
): boolean {
  return JSON.stringify(a.identityVector) === JSON.stringify(b.identityVector);
}

export function temporalReturnReadyForConsumption(measurement: TemporalReturnMeasurement): boolean {
  return measurement.returnShapeValid
    && measurement.returnRequestMatches
    && measurement.returnRequestOriginMatches
    && measurement.returnRecipientMatches
    && measurement.returnProducerMatches
    && measurement.returnSourceTerminalMatches
    && measurement.returnTimelineMatches
    && measurement.returnScopeMatches
    && measurement.returnChronologyMatches
    && measurement.returnProductsPresent;
}
