import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertOp01Op31LiveSmlpSessionResumeReport,
} from '../scripts/op01-op31-live-smlp-session-resume-contract.mjs';

function workerRequests() {
  return [
    { type: 'load', code: 'SMLP', level: 1 },
    { type: 'action', actionId: 6, data: { x: 32, y: 26 } },
  ];
}

function acquisition(needId) {
  return {
    needId,
    ownerId: 'joint_channels_v1',
    proposalRef: `proposal:${needId}`,
    routed: true,
    duplicate: false,
  };
}

function validReport() {
  const controllerNeed = 'need:controller';
  const pendingNeed = 'need:pending';
  return {
    version: 1,
    runtime: 'browser-agent-controller-game-worker-pyodide',
    controller: {
      game: 'SMLP',
      gameId: 'smlp-game',
      backend: 'python-wasm',
      worker: { instances: 1, requests: workerRequests() },
      initialFrameHash: 'before-controller',
      finalFrameHash: 'after-controller',
      changedPixelCount: 9,
      hostCount: 2,
      physicalActionCalls: 1,
      presentations: 1,
      acquisitions: [acquisition(controllerNeed)],
      busyTransitions: [true, false],
      stopRequest: {
        phase: 'stopping',
        stopReason: 'manual',
        sessionId: 'session-controller',
        campaignStatus: null,
        actionsDispatched: 0,
      },
      firstActivation: {
        phase: 'stopped',
        stopReason: 'manual',
        sessionId: 'session-controller',
        campaignStatus: 'action',
        actionsDispatched: 1,
      },
      secondActivation: {
        phase: 'stopped',
        stopReason: 'action-limit',
        sessionId: 'session-controller',
        campaignStatus: null,
        actionsDispatched: 1,
      },
      retainedSessionId: 'session-controller',
      checkpointPendingStage: null,
      snapshots: [
        { phase: 'running', stopReason: null },
        { phase: 'stopping', stopReason: 'manual' },
        { phase: 'stopped', stopReason: 'manual' },
      ],
    },
    pendingReturn: {
      game: 'SMLP',
      gameId: 'smlp-game',
      backend: 'python-wasm',
      worker: { instances: 1, requests: workerRequests() },
      initialFrameHash: 'before-pending',
      finalFrameHash: 'after-pending',
      changedPixelCount: 9,
      physicalActionCalls: 1,
      originalPresentations: 1,
      originalAcquisitions: [acquisition(pendingNeed)],
      originalBusyTransitions: [true, false],
      checkpointStage: 'dispatched',
      pendingNeedId: pendingNeed,
      originalResult: { status: 'action', needId: pendingNeed, sequence: 1 },
      resumedResult: { status: 'resumed', needId: pendingNeed, sequence: 1 },
      replayActions: 0,
      duplicatePresentations: 0,
      resumedAcquisitions: [acquisition(pendingNeed)],
    },
  };
}

test('accepts real Chrome Manual/Agent continuity and dispatched-return resumption', () => {
  const report = validReport();
  assert.deepEqual(assertOp01Op31LiveSmlpSessionResumeReport(report), {
    realWorkersQualified: 2,
    physicalActionsQualified: 2,
    controllerReactivationsQualified: 1,
    dispatchedReturnsResumed: 1,
    replayedActions: 0,
    duplicatePresentations: 0,
    preservedNeedIds: ['need:controller', 'need:pending'],
  });
});

test('rejects a controller physical replay after reactivation', () => {
  const report = validReport();
  report.controller.physicalActionCalls = 2;
  assert.throws(
    () => assertOp01Op31LiveSmlpSessionResumeReport(report),
    /controller sent 2 actions/,
  );
});

test('rejects loss of the dispatched checkpoint boundary', () => {
  const report = validReport();
  report.pendingReturn.checkpointStage = null;
  assert.throws(
    () => assertOp01Op31LiveSmlpSessionResumeReport(report),
    /pending checkpoint stage is null/,
  );
});

test('rejects a resumed return with another needId', () => {
  const report = validReport();
  report.pendingReturn.resumedResult.needId = 'need:other';
  assert.throws(
    () => assertOp01Op31LiveSmlpSessionResumeReport(report),
    /resumed acquisition changed needId/,
  );
});

test('rejects duplicate presentation of an already-live return', () => {
  const report = validReport();
  report.pendingReturn.duplicatePresentations = 1;
  assert.throws(
    () => assertOp01Op31LiveSmlpSessionResumeReport(report),
    /restored host repeated presentation/,
  );
});
