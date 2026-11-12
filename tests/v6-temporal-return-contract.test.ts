import assert from 'node:assert/strict';
import test from 'node:test';
import {
  measureTemporalReturnIdentity,
  sameTemporalMeasuredBoundary,
  temporalReturnReadyForConsumption,
  type TemporalContributionRequest,
  type TemporalContributionReturn,
} from '../src/logos-engine/v6-temporal-return-contract.ts';

const request: TemporalContributionRequest = {
  requestRef: 'request:1',
  recipientWorkflowRef: 'workflow:temporal',
  timelineRef: 'timeline:1',
  requestedAtRevision: 4,
  expectedProducerDefinitionRef: 'producer:def',
  expectedProducerSourceHash: 'source:hash',
  scopeRefs: ['timeline:1', 'frame:4'],
};

const returned: TemporalContributionReturn = {
  request,
  producerDefinitionRef: 'producer:def',
  producerSourceHash: 'source:hash',
  returnedAtRevision: 5,
  productRefs: ['product:a'],
  evidenceRefs: ['frame:5'],
  requiresCurrentRevalidation: true,
  returnDigest: 'return:digest',
};

function measure(overrides = {}) {
  return measureTemporalReturnIdentity({
    request,
    returned,
    consumerRef: 'workflow:temporal',
    timelineRef: 'timeline:1',
    currentScopeRefs: ['timeline:1', 'frame:4'],
    currentRevision: 5,
    productRevisions: { 'product:a': 5 },
    productDigests: { 'product:a': 'product:digest' },
    producerMatches: true,
    sourceTerminalMatches: true,
    requestOriginMatches: true,
    ...overrides,
  });
}

test('exact current return identity is consumable but never ACT authority', () => {
  const measured = measure();
  assert.equal(temporalReturnReadyForConsumption(measured), true);
  assert.equal(measured.actAuthorized, false);
  assert.deepEqual(measured.evidenceRefs, ['frame:5']);
});

test('return chronology must stay within request and current revisions', () => {
  const badReturn = { ...returned, returnedAtRevision: 7 };
  const measured = measure({ returned: badReturn, currentRevision: 6 });
  assert.equal(measured.returnChronologyMatches, false);
  assert.equal(temporalReturnReadyForConsumption(measured), false);
});

test('scope change prevents reuse of a previously accepted boundary', () => {
  const first = measure();
  const changed = measure({ currentScopeRefs: ['timeline:1', 'frame:5'] });
  assert.equal(changed.returnScopeMatches, false);
  assert.equal(sameTemporalMeasuredBoundary(first, changed), false);
});

test('comparison revision alone does not create a different measured boundary', () => {
  const first = measure();
  const later = measure({ currentRevision: 6 });
  assert.equal(sameTemporalMeasuredBoundary(first, later), true);
});

test('product revision change creates a different measured boundary', () => {
  const first = measure();
  const changed = measure({ productRevisions: { 'product:a': 6 } });
  assert.equal(sameTemporalMeasuredBoundary(first, changed), false);
});

test('missing product prevents consumption and remains explicit', () => {
  const measured = measure({ productRevisions: {} });
  assert.equal(measured.returnProductsPresent, false);
  assert.deepEqual(measured.returnMissingProductRefs, ['product:a']);
  assert.equal(temporalReturnReadyForConsumption(measured), false);
});

test('shape errors suppress product/evidence binding', () => {
  const measured = measure({ shapeErrors: ['product_refs'] });
  assert.equal(measured.returnShapeValid, false);
  assert.deepEqual(measured.productRefs, []);
  assert.deepEqual(measured.evidenceRefs, []);
  assert.equal(temporalReturnReadyForConsumption(measured), false);
});

test('producer or Source terminal mismatch fails closed', () => {
  assert.equal(temporalReturnReadyForConsumption(measure({ producerMatches: false })), false);
  assert.equal(temporalReturnReadyForConsumption(measure({ sourceTerminalMatches: false })), false);
});
