import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertOp01Op31BrowserCrashResumeReport,
} from '../scripts/op01-op31-browser-crash-resume-contract.mjs';

function validReport() {
  const needId = 'need:crash-resume:1';
  const sessionId = 'browser-agent:SMLP:1';
  const action = { id: 6, x: 32, y: 26 };
  const requests = [
    { type: 'load', code: 'SMLP', level: 1 },
    { type: 'action', actionId: 6, data: { x: 32, y: 26 } },
  ];
  return {
    version: 1,
    status: 'browser-crash-without-pagehide-qualified',
    qualification: 'functional-real-chrome-sigkill-pyodide-not-official-performance',
    runtime: 'product-main-safe-boundary-autosave',
    game: 'SMLP',
    backend: 'python-wasm',
    hardKill: {
      signal: 'SIGKILL',
      pagehideEndpointObserved: false,
    },
    phaseOne: {
      version: 1,
      game: 'SMLP',
      backend: 'python-wasm',
      userAgent: 'HeadlessChrome',
      sessionId,
      needId,
      proposalRef: 'proposal:crash-resume',
      action,
      initialIdentity: 'before',
      returnedIdentity: 'after',
      changedPixelCount: 9,
      workerRequests: structuredClone(requests),
      runtimeCommittedEntries: 1,
      runtimePendingSequence: 2,
      controllerActionsDispatched: 1,
      durableBytes: 1024,
      savedAtMs: 1,
      pagehideObservedBeforeKill: false,
    },
    phaseTwo: {
      pagehideMarkerPresent: false,
      freshWorkerInstances: 1,
      reconstructionRequests: structuredClone(requests),
      settledRuntimeEntries: 2,
      settledRuntimePending: false,
      settledAgentPending: false,
      actionsDispatched: 1,
      sessionId,
      needIdRetained: true,
      mode: 'manual',
      canvasPresentations: 1,
      returnedObservationCanvasPaints: 3,
      expectedReturnedObservationCanvasPaints: 3,
      totalCanvasPaints: 5,
      extraRequestsAfterSettlement: 0,
      extraPresentationsAfterSettlement: 0,
    },
    causalProofs: {
      pendingBoundaryAutosavedBeforeCrash: true,
      pagehideObservedBeforeCrash: false,
      freshChromeProcessRequired: true,
      freshWorkerCreated: true,
      deterministicPyodideReplay: true,
      sameSessionIdPreserved: true,
      sameNeedIdRetained: true,
      actionCountPreserved: true,
      agentPhysicalActionAfterRestore: false,
      returnedObservationPresentedTwice: false,
      settledBoundaryRepersisted: true,
    },
    proofBoundary: {
      rawPythonHeapSnapshot: false,
      deterministicReplayRequired: true,
      localStorageUsed: true,
      hardProcessTerminationRequested: true,
      crossBrowserQualified: false,
      longJournalQualified: false,
      allGamesQualified: false,
      performanceQualified: false,
      sitePublished: false,
    },
  };
}

test('hard-crash resume report accepts the exact bounded proof', () => {
  const report = validReport();
  const summary = assertOp01Op31BrowserCrashResumeReport(report);
  assert.equal(summary.hardKillSignal, 'SIGKILL');
  assert.equal(summary.changedPixelCount, 9);
  assert.equal(summary.actionsDispatched, 1);
  assert.equal(summary.canvasPresentations, 1);
  assert.equal(summary.returnedObservationCanvasPaints, 3);
});

test('hard-crash resume report rejects a graceful page lifecycle', () => {
  const report = validReport();
  report.phaseOne.pagehideObservedBeforeKill = true;
  assert.throws(
    () => assertOp01Op31BrowserCrashResumeReport(report),
    /pagehide/u,
  );
});

test('hard-crash resume report rejects a second Agent action or logical presentation', () => {
  const actionReplay = validReport();
  actionReplay.phaseTwo.extraRequestsAfterSettlement = 1;
  assert.throws(
    () => assertOp01Op31BrowserCrashResumeReport(actionReplay),
    /another request/u,
  );

  const duplicatePresentation = validReport();
  duplicatePresentation.phaseTwo.canvasPresentations = 2;
  assert.throws(
    () => assertOp01Op31BrowserCrashResumeReport(duplicatePresentation),
    /2 logical presentations/u,
  );
});

test('hard-crash resume report rejects missing or duplicate animation paints', () => {
  const missingPaint = validReport();
  missingPaint.phaseTwo.returnedObservationCanvasPaints = 2;
  assert.throws(
    () => assertOp01Op31BrowserCrashResumeReport(missingPaint),
    /painted 2 frames; expected 3/u,
  );

  const duplicatePaint = validReport();
  duplicatePaint.phaseTwo.returnedObservationCanvasPaints = 6;
  assert.throws(
    () => assertOp01Op31BrowserCrashResumeReport(duplicatePaint),
    /painted 6 frames; expected 3/u,
  );
});

test('hard-crash resume report rejects widened proof claims', () => {
  const report = validReport();
  report.proofBoundary.crossBrowserQualified = true;
  assert.throws(
    () => assertOp01Op31BrowserCrashResumeReport(report),
    /cross-browser/u,
  );
});
