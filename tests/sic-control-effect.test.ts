import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateControlEffect, knowControlEffectGraph, type ControlEffectGraph,
} from '../src/sic/know-control-effect.ts';
import { readControlEffectShadow } from '../src/sic/shadow.ts';
import type { ControlModel, SituationFrame, SituationTrait } from '../src/sic/situation.ts';

const scope = { session: 'campaign', level: 1 };
const need = { scope, controlRef: 'command', subjectRef: 'subject' };
const evidence = { kind: 'public_board', ref: 'fixture:observation:1' } as const;
const known = <T>(value: T): SituationTrait<T> => ({ status: 'known', value, evidence: [evidence] });

function situation(controlModel: ControlModel, traits: SituationFrame['traits'] = {}): SituationFrame {
  return {
    schemaVersion: 1,
    scope,
    revision: 1,
    phase: 'observation',
    traits: {
      controlModel: known(controlModel),
      commandAvailable: known(true),
      subjectObservable: known(true),
      effectIsolatable: known(true),
      riskBounded: known(true),
      experimentPending: known(false),
      passiveObservationPossible: known(true),
      ...traits,
    },
  };
}

const matrix = [
  ['identified_click', 'learn-control-effect'],
  ['directional', 'learn-direction-effect'],
  ['selection_then_transform', 'learn-selected-transform-effect'],
] as const;

for (const [controlModel, expected] of matrix) {
  test(`know_control_effect selects only the experiment for ${controlModel}`, () => {
    const result = evaluateControlEffect(need, situation(controlModel));
    assert.equal(result.outcome, 'candidate');
    assert.equal(result.candidate?.id, expected);
    assert.deepEqual(result.candidate?.evidence, [evidence]);
    for (const branch of result.branches.filter(branch => branch.id !== expected)) {
      assert.equal(branch.status, 'not_applicable');
      assert.deepEqual(branch.excludedBy, ['controlModel']);
    }
  });

  test(`an unverified effect in ${controlModel} remains unknown and suspends fallback`, () => {
    const frame = situation(controlModel, { effectIsolatable: { status: 'unknown' } });
    const result = evaluateControlEffect(need, frame);
    assert.equal(result.outcome, 'needs_evidence');
    assert.deepEqual(result.missing, ['effectIsolatable']);
    assert.equal(result.branches.find(branch => branch.id === expected)?.status, 'unknown');
    assert.equal(result.branches.length, 3);
  });

  test(`unbounded risk in ${controlModel} rules out the experiment before passive fallback`, () => {
    const result = evaluateControlEffect(need, situation(controlModel, { riskBounded: known(false) }));
    assert.equal(result.branches.find(branch => branch.id === expected)?.status, 'not_applicable');
    assert.equal(result.candidate?.id, knowControlEffectGraph.fallback.id);
  });
}

test('changing the situation revises the answer under the same need identity', () => {
  const first = evaluateControlEffect(need, situation('identified_click'));
  const revised = evaluateControlEffect(need, { ...situation('directional'), revision: 2 });
  assert.equal(first.needId, revised.needId);
  assert.equal(revised.frameRevision, 2);
  assert.equal(revised.candidate?.id, 'learn-direction-effect');
  assert.notEqual(evaluateControlEffect({ ...need, subjectRef: 'another' }, situation('directional')).needId, first.needId);
  assert.equal(evaluateControlEffect(need, { ...situation('directional'), scope: { ...scope, level: 2 } }).outcome, 'stale');
  assert.equal(evaluateControlEffect(need, { ...situation('directional'), phase: 'terminal' }).outcome, 'closed');
});

test('ambiguity and an open coverage gap are explicit', () => {
  const [click] = knowControlEffectGraph.experiments;
  assert.ok(click);
  const overlapping: ControlEffectGraph = {
    ...knowControlEffectGraph, experiments: [click, { ...click, id: 'overlapping-click' }],
  };
  assert.equal(evaluateControlEffect(need, situation('identified_click'), overlapping).outcome, 'ambiguous');
  assert.equal(evaluateControlEffect(need, situation('other', { passiveObservationPossible: known(false) })).outcome, 'uncovered');
  assert.equal(evaluateControlEffect({ ...need, subjectRef: null }, situation('directional')).outcome, 'unscoped');
});

test('the native shadow only reports public availability and an in-scope checked return', () => {
  const board = { gameCode: 'FIXTURE', level: 1, state: 'NOT_FINISHED', availableActionIds: [1, 6] };
  const agent = {
    sessionId: scope.session, sequence: 1, status: 'paused', busy: false, level: 1,
    pendingAction: { id: 6, data: { x: 12, y: 24 } },
    trace: [
      { kind: 'actual_outcome', matched: false, observation_ref: 'campaign:epoch:1:revision:2:frame:current' },
      { kind: 'actual_outcome', matched: true, observation_ref: 'campaign:epoch:1:revision:1:frame:older' },
    ],
  } as const;
  const result = readControlEffectShadow(board, agent, 3);
  assert.deepEqual(result?.nextAction, agent.pendingAction);
  assert.equal(result?.returnCheck?.matched, false);
  assert.equal(result?.resolution.outcome, 'needs_evidence');
  assert.equal(result?.frame.traits.controlModel, undefined);
  assert.equal(readControlEffectShadow(board, { ...agent, busy: true }, 3), null);
  assert.equal(readControlEffectShadow(board, { ...agent, sessionId: 'replacement' }, 4)?.returnCheck, null);
  assert.equal(readControlEffectShadow({ ...board, level: 2 }, agent, 4)?.returnCheck, null);
  assert.equal(readControlEffectShadow({ ...board, state: 'WIN' }, agent, 4)?.nextAction, null);
});
