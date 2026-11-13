import assert from 'node:assert/strict';
import test from 'node:test';
import { createTemporalSourceDecisionReceipt } from '../src/logos-engine/v6-temporal-decision-receipt.ts';
import { createTemporalObservationState } from '../src/logos-engine/v6-temporal-observation-state.ts';
import { runTemporalSelectionBridge } from '../src/logos-engine/v6-temporal-selection-bridge.ts';
import type {
  TemporalSelectionRequest,
  TemporalSourceAuthority,
} from '../src/logos-engine/v6-temporal-selection-contract.ts';
import type { AgentAction, AgentObservation } from '../src/runtime/contracts.ts';
import {
  bindTemporalPreparedActionCandidate,
  createTemporalPreparedActionBindingReceipt,
  temporalPreparedActionBindingFingerprint,
  validateTemporalPreparedActionBindingReceipt,
  type TemporalPreparedActionCandidateSpec,
  type TemporalPreparedActionBindingReceipt,
} from '../src/runtime/v6-temporal-action-binding.ts';
import type { PreparedTemporalActionWitness } from '../src/runtime/v6-temporal-act-release-audit.ts';

const authority: TemporalSourceAuthority = {
  workflowRef: 'arc3.temporal_selection',
  sourceHash: 'source-hash',
  authorizedWorkflowRefs: ['arc3.temporal_selection'],
  authorizedSourceHash: 'source-hash',
};

function request(): TemporalSelectionRequest {
  return {
    workflowRef: 'arc3.temporal_selection',
    sourceHash: 'source-hash',
    identity: {
      episodeId: 'episode:1',
      levelEpoch: 2,
      observationId: 'observation:8',
      observationRevision: 8,
    },
    alternatives: [
      { ref: 'candidate:a', facts: { route: 'left' }, evidenceRefs: ['evidence:a'] },
      { ref: 'candidate:b', facts: { route: 'right' }, evidenceRefs: ['evidence:b'] },
    ],
    requirementRefs: ['requirement.current_action_is_available'],
    preserveRefs: ['candidate:a', 'candidate:b'],
  };
}

function projection(selectedRef: string | null = 'candidate:a') {
  const current = request();
  const state = createTemporalObservationState(current, authority);
  const receipt = createTemporalSourceDecisionReceipt(
    current,
    authority,
    ['drm:action-choice'],
    selectedRef,
    selectedRef === null ? ['evidence:refusal'] : [selectedRef === 'candidate:a' ? 'evidence:a' : 'evidence:b'],
  );
  return runTemporalSelectionBridge(state, authority, receipt, {
    reason: 'bind an externally prepared public action candidate without releasing it',
  });
}

function observation(overrides: Partial<AgentObservation> = {}): AgentObservation {
  return {
    protocolVersion: 1,
    sessionId: 'session:1',
    sequence: 8,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels: new Uint8Array(64 * 64),
    },
    availableActionIds: [2, 6],
    state: 'NOT_FINISHED',
    level: 2,
    levelsCompleted: 1,
    ...overrides,
  };
}

function witness(
  current = projection(),
  overrides: Partial<PreparedTemporalActionWitness> = {},
): PreparedTemporalActionWitness {
  return {
    intentRef: 'intent:8',
    selectedRef: 'candidate:a',
    decisionFingerprint: current.decisionRef,
    identity: structuredClone(current.state.identity),
    currentFrameRef: 'observation:8',
    actionWitnessRef: 'action-witness:8',
    actionFamilyRef: 'action-family:move',
    expectationRefs: ['expectation:visible-delta'],
    groundingEvidenceRefs: ['evidence:a', 'grounding:current'],
    ...overrides,
  };
}

function candidate(
  overrides: Partial<TemporalPreparedActionCandidateSpec> = {},
): TemporalPreparedActionCandidateSpec {
  return {
    actionCandidateRef: 'action-candidate:2',
    targetRef: 'target:action-2',
    target: { kind: 'action', actionId: 2 },
    candidateAction: { id: 2 },
    actionEvidenceRefs: ['action:2:available'],
    targetEvidenceRefs: ['target:action-2:current'],
    ...overrides,
  };
}

function receipt(
  current = projection(),
  prepared = witness(current),
  publicObservation = observation(),
  spec = candidate(),
): TemporalPreparedActionBindingReceipt {
  return createTemporalPreparedActionBindingReceipt(current, prepared, publicObservation, spec);
}

test('explicit non-point AgentAction candidate binds without creating a permit or ACT authority', () => {
  const current = projection();
  const prepared = witness(current);
  const publicObservation = observation();
  const bound = bindTemporalPreparedActionCandidate(
    receipt(current, prepared, publicObservation),
    current,
    prepared,
    publicObservation,
  );
  assert.equal(bound.status, 'bound');
  assert.deepEqual(bound.candidateAction, { id: 2 });
  assert.equal(bound.actionCandidatePresent, true);
  assert.equal(bound.actionPermitPresent, false);
  assert.equal(bound.releaseEligible, false);
  assert.equal(bound.actionReleased, false);
  assert.equal(bound.actAuthorized, false);
});

test('point action candidate requires an exact point target with the same coordinates', () => {
  const current = projection();
  const prepared = witness(current, { actionFamilyRef: 'action-family:point' });
  const publicObservation = observation();
  const spec = candidate({
    actionCandidateRef: 'action-candidate:point',
    targetRef: 'target:point:12:13',
    target: { kind: 'point', x: 12, y: 13 },
    candidateAction: { id: 6, data: { x: 12, y: 13 } },
  });
  const bound = bindTemporalPreparedActionCandidate(
    receipt(current, prepared, publicObservation, spec),
    current,
    prepared,
    publicObservation,
  );
  assert.deepEqual(bound.candidateAction, { id: 6, data: { x: 12, y: 13 } });
  assert.deepEqual(bound.target, { kind: 'point', x: 12, y: 13 });
});

test('a refused TemporalSelection result cannot be turned into an action candidate', () => {
  const refused = projection(null);
  assert.throws(
    () => createTemporalPreparedActionBindingReceipt(
      refused,
      witness(refused, { selectedRef: 'candidate:a' }),
      observation(),
      candidate(),
    ),
    /refused TemporalSelection decision/,
  );
});

test('prepared witness must preserve the selected ref and decision fingerprint', () => {
  const current = projection();
  assert.throws(
    () => receipt(current, witness(current, { selectedRef: 'candidate:b' })),
    /selected ref mismatch/,
  );
  assert.throws(
    () => receipt(current, witness(current, { decisionFingerprint: 'decision:stale' })),
    /decision fingerprint mismatch/,
  );
});

test('prepared witness must remain bound to the exact temporal observation and frame', () => {
  const current = projection();
  assert.throws(
    () => receipt(current, witness(current, {
      identity: { ...current.state.identity, observationRevision: 9 },
    })),
    /observation identity mismatch/,
  );
  assert.throws(
    () => receipt(current, witness(current, { currentFrameRef: 'observation:7' })),
    /current frame mismatch/,
  );
});

test('binding validation rejects replay against another public session or sequence', () => {
  const current = projection();
  const prepared = witness(current);
  const firstObservation = observation();
  const boundReceipt = receipt(current, prepared, firstObservation);
  assert.throws(
    () => validateTemporalPreparedActionBindingReceipt(
      boundReceipt,
      current,
      prepared,
      observation({ sessionId: 'session:2' }),
    ),
    /public observation mismatch/,
  );
  assert.throws(
    () => validateTemporalPreparedActionBindingReceipt(
      boundReceipt,
      current,
      prepared,
      observation({ sequence: 9 }),
    ),
    /public observation mismatch/,
  );
});

test('binding validation rejects a changed public image fingerprint', () => {
  const current = projection();
  const prepared = witness(current);
  const firstObservation = observation();
  const boundReceipt = receipt(current, prepared, firstObservation);
  const changedPixels = new Uint8Array(64 * 64);
  changedPixels[17] = 4;
  assert.throws(
    () => validateTemporalPreparedActionBindingReceipt(
      boundReceipt,
      current,
      prepared,
      observation({ image: { ...firstObservation.image, pixels: changedPixels } }),
    ),
    /public observation mismatch/,
  );
});

test('candidate action must satisfy the public AgentAction contract', () => {
  const invalid = { id: 6, data: { x: -1, y: 12 } } as unknown as AgentAction;
  assert.throws(
    () => receipt(projection(), witness(), observation(), candidate({ candidateAction: invalid })),
    /not a valid public AgentAction/,
  );
});

test('candidate action must be currently available in the public observation', () => {
  const current = projection();
  const prepared = witness(current);
  const publicObservation = observation({ availableActionIds: [6] });
  const boundReceipt = createTemporalPreparedActionBindingReceipt(
    current,
    prepared,
    observation(),
    candidate(),
  );
  assert.throws(
    () => validateTemporalPreparedActionBindingReceipt(
      boundReceipt,
      current,
      prepared,
      publicObservation,
    ),
    /public observation mismatch|not currently available/,
  );
});

test('target shape and public action payload must agree exactly', () => {
  assert.throws(
    () => receipt(
      projection(),
      witness(),
      observation(),
      candidate({ target: { kind: 'action', actionId: 2 }, candidateAction: { id: 6, data: { x: 2, y: 3 } } }),
    ),
    /target does not match/,
  );
  assert.throws(
    () => receipt(
      projection(),
      witness(),
      observation(),
      candidate({ target: { kind: 'point', x: 2, y: 4 }, candidateAction: { id: 6, data: { x: 2, y: 3 } } }),
    ),
    /target does not match/,
  );
});

test('intent expectation and grounding domains cannot change after receipt creation', () => {
  const current = projection();
  const prepared = witness(current);
  const publicObservation = observation();
  const original = receipt(current, prepared, publicObservation);
  const changedExpectation = { ...original, expectationRefs: ['expectation:other'] };
  assert.throws(
    () => validateTemporalPreparedActionBindingReceipt(
      changedExpectation,
      current,
      prepared,
      publicObservation,
    ),
    /changed the frozen intent evidence|fingerprint mismatch/,
  );
  const changedGrounding = { ...original, groundingEvidenceRefs: ['grounding:current'] };
  assert.throws(
    () => validateTemporalPreparedActionBindingReceipt(
      changedGrounding,
      current,
      prepared,
      publicObservation,
    ),
    /changed the frozen intent evidence|does not preserve selected evidence|fingerprint mismatch/,
  );
});

test('selected evidence must survive into the prepared action binding', () => {
  const current = projection();
  assert.throws(
    () => receipt(
      current,
      witness(current, { groundingEvidenceRefs: ['grounding:current'] }),
    ),
    /lost selected evidence during grounding/,
  );
});

test('candidate action and target evidence domains are explicit, unique and bounded', () => {
  assert.throws(
    () => receipt(projection(), witness(), observation(), candidate({ actionEvidenceRefs: [] })),
    /identity or evidence domain is invalid/,
  );
  assert.throws(
    () => receipt(projection(), witness(), observation(), candidate({
      targetEvidenceRefs: ['target:one', 'target:one'],
    })),
    /identity or evidence domain is invalid/,
  );
});

test('binding fingerprint detects payload tampering', () => {
  const current = projection();
  const prepared = witness(current);
  const publicObservation = observation();
  const original = receipt(current, prepared, publicObservation);
  const tampered = {
    ...original,
    actionCandidateRef: 'action-candidate:tampered',
  };
  assert.throws(
    () => validateTemporalPreparedActionBindingReceipt(
      tampered,
      current,
      prepared,
      publicObservation,
    ),
    /fingerprint mismatch/,
  );
});

test('binding fingerprint is canonical across evidence set ordering', () => {
  const current = projection();
  const prepared = witness(current, {
    groundingEvidenceRefs: ['grounding:current', 'evidence:a'],
  });
  const publicObservation = observation();
  const first = receipt(current, prepared, publicObservation, candidate({
    actionEvidenceRefs: ['action:2:available', 'action:2:source'],
    targetEvidenceRefs: ['target:current', 'target:visible'],
  }));
  const second = receipt(current, prepared, publicObservation, candidate({
    actionEvidenceRefs: ['action:2:source', 'action:2:available'],
    targetEvidenceRefs: ['target:visible', 'target:current'],
  }));
  assert.equal(first.bindingFingerprint, second.bindingFingerprint);
  const { bindingFingerprint: _ignored, ...base } = second;
  assert.equal(first.bindingFingerprint, temporalPreparedActionBindingFingerprint(base));
});

test('bound candidate output is detached and still carries no permit', () => {
  const current = projection();
  const prepared = witness(current, { actionFamilyRef: 'action-family:point' });
  const publicObservation = observation();
  const boundReceipt = receipt(current, prepared, publicObservation, candidate({
    actionCandidateRef: 'action-candidate:point',
    targetRef: 'target:point:7:8',
    target: { kind: 'point', x: 7, y: 8 },
    candidateAction: { id: 6, data: { x: 7, y: 8 } },
  }));
  const bound = bindTemporalPreparedActionCandidate(
    boundReceipt,
    current,
    prepared,
    publicObservation,
  );
  if (bound.candidateAction.id !== 6) throw new Error('expected point action');
  bound.candidateAction.data.x = 31;
  assert.deepEqual(boundReceipt.candidateAction, { id: 6, data: { x: 7, y: 8 } });
  assert.equal(bound.actionPermitPresent, false);
  assert.equal(bound.actionReleased, false);
  assert.equal(bound.actAuthorized, false);
});
