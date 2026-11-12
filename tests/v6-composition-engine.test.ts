import assert from 'node:assert/strict';
import test from 'node:test';
import { executeBundleOperation, operationAdmission, validateBundle, type CompositionBundle } from '../src/logos-engine/v6-composition-engine.ts';
import { OperationTraceSink } from '../src/logos-engine/v6-operation-trace.ts';
import { executeOperation } from '../src/logos-engine/v6-operations.ts';

function state() {
  return {
    compositions: [
      { id: 'A', requires: {}, effect: {}, observed: true },
      { id: 'B', requires: { free: true }, effect: {}, observed: false, open_question: 'unknown effect' },
      { id: 'G', requires: {}, effect: {}, observed: true },
    ],
    facts: { free: true },
    bundles: [{ id: 'bundle', composition_ref: 'B', admitted: true, actions: ['ACTION1'] }],
  };
}

function bundle(operation: 'OP18' | 'OP28', kind: 'probe' | 'realize' = operation === 'OP18' ? 'probe' : 'realize'): CompositionBundle {
  return {
    id: 'bundle', operation_key: operation, composition_ref: 'B', objective_ref: 'G', preserve_refs: ['A'],
    observation_revision: 1, kind, actions: ['ACTION1'], purpose: 'resolve current need',
    preconditions: { free: true }, evidence: ['obs1'], preservation_evidence: { A: 'proof' },
    outcome_guard: { path: ['value'], contains: operation === 'OP28' ? 'bundle' : 'B' },
  };
}

test('bundle validation rejects stale revision and missing preservation proof', () => {
  assert.equal(validateBundle(bundle('OP18'), state(), 1), true);
  assert.throws(() => validateBundle(bundle('OP18'), state(), 2), /Stale/);
  const missing = bundle('OP18');
  missing.preservation_evidence = {};
  assert.equal(validateBundle(missing, state(), 1), false);
});

test('operation admission consumes the actual OP18 result rather than invocation alone', () => {
  const b = bundle('OP18');
  const selected = executeOperation('OP18', { ...state(), focus: 'B' });
  assert.equal(operationAdmission(b, selected).accepted, true);
  assert.equal(operationAdmission(b, { ...selected, value: [] }).accepted, false);
});

test('OP28 release requires both bundle validation and operation result selection', () => {
  const trace = new OperationTraceSink();
  const outcome = executeBundleOperation(bundle('OP28'), state(), 1, {
    needId: 'need-realize', caller: 'release', decisionRef: 'release-1', trace,
  });
  assert.equal(outcome.bundleAdmitted, true);
  assert.equal(outcome.operationAdmission?.accepted, true);
  assert.equal(outcome.releaseAllowed, true);
  const events = trace.snapshot().events;
  assert.equal(events.length, 2);
  assert.equal(events[1]?.kind, 'consumption');
});

test('analysis operation never gains physical release authority from execution', () => {
  const analysis: CompositionBundle = { ...bundle('OP18'), operation_key: 'OP29', kind: 'analysis', actions: [], outcome_guard: undefined };
  const outcome = executeBundleOperation(analysis, { ...state(), expected_properties: { x: 1 }, observed_properties: { x: 1 } }, 1, {
    needId: 'need-analysis', caller: 'postAnalysis', decisionRef: 'analysis-1',
  });
  assert.equal(outcome.releaseAllowed, false);
  assert.equal(outcome.operationAdmission, undefined);
});


test('OP14 admits release only when the focused composition preserves the declared constraint', () => {
  const op14: CompositionBundle = {
    ...bundle('OP18'),
    operation_key: 'OP14',
    kind: 'realize',
    outcome_guard: { path: ['value'], contains: 'B' },
  };
  const preserving = state();
  preserving.facts = { free: true, color: 'blue' };
  preserving.compositions[1] = {
    id: 'B',
    requires: { free: true },
    effect: { color: 'blue' },
    observed: false,
    open_question: 'preserve color',
  };
  Object.assign(preserving, { preserve: { color: 'blue' } });

  const accepted = executeBundleOperation(op14, preserving, 1, {
    needId: 'need-preserve',
    caller: 'release',
    decisionRef: 'release-preserve',
  });
  assert.equal(accepted.operationAdmission?.accepted, true);
  assert.equal(accepted.releaseAllowed, true);

  const violating = structuredClone(preserving);
  violating.compositions[1]!.effect = { color: 'red' };
  const rejected = executeBundleOperation(op14, violating, 1, {
    needId: 'need-preserve-violation',
    caller: 'release',
    decisionRef: 'release-preserve-violation',
  });
  assert.equal(rejected.operationAdmission?.accepted, false);
  assert.equal(rejected.releaseAllowed, false);
});
