const EXPECTED_ACTION = { id: 6, x: 32, y: 26 };

function stable(value) {
  return JSON.stringify(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function actionFromRequest(request) {
  if (!request || request.type !== 'action') return null;
  return {
    id: request.actionId,
    x: request.data?.x,
    y: request.data?.y,
  };
}

export function assertOp01Op31BrowserCrashResumeReport(report) {
  assert(report?.version === 1, 'crash-resume report must be version 1');
  assert(
    report.status === 'browser-crash-without-pagehide-qualified',
    `unexpected crash-resume status ${report?.status}`,
  );
  assert(
    report.qualification === 'functional-real-chrome-sigkill-pyodide-not-official-performance',
    `unexpected crash-resume qualification ${report?.qualification}`,
  );
  assert(report.runtime === 'product-main-safe-boundary-autosave', 'unexpected crash-resume runtime');
  assert(report.game === 'SMLP', `crash-resume game is ${report.game}`);
  assert(report.backend === 'python-wasm', `crash-resume backend is ${report.backend}`);
  assert(report.hardKill?.signal === 'SIGKILL', `hard crash signal is ${report.hardKill?.signal}`);
  assert(report.hardKill?.pagehideEndpointObserved === false, 'phase-one pagehide endpoint was observed');

  const first = report.phaseOne;
  assert(first?.version === 1, 'phase-one evidence is missing');
  assert(first.game === 'SMLP', `phase-one game is ${first.game}`);
  assert(first.backend === 'python-wasm', `phase-one backend is ${first.backend}`);
  assert(typeof first.sessionId === 'string' && first.sessionId.length > 0, 'phase-one sessionId is missing');
  assert(typeof first.needId === 'string' && first.needId.length > 0, 'phase-one needId is missing');
  assert(typeof first.proposalRef === 'string' && first.proposalRef.length > 0, 'phase-one proposalRef is missing');
  assert(stable(first.action) === stable(EXPECTED_ACTION), `phase-one action drifted: ${stable(first.action)}`);
  assert(first.changedPixelCount === 9, `phase-one changed ${first.changedPixelCount} pixels`);
  assert(first.runtimeCommittedEntries === 1, 'phase-one journal should contain one committed load');
  assert(first.runtimePendingSequence === 2, 'phase-one pending sequence must be 2');
  assert(first.controllerActionsDispatched === 1, 'phase-one action count must include the pending dispatch');
  assert(first.durableBytes > 0, 'phase-one durable payload size is missing');
  assert(first.pagehideObservedBeforeKill === false, 'phase-one observed pagehide before SIGKILL');
  assert(first.workerRequests?.length === 2, `phase-one emitted ${first.workerRequests?.length} requests`);
  assert(first.workerRequests[0]?.type === 'load', 'phase-one did not begin with load');
  assert(stable(actionFromRequest(first.workerRequests[1])) === stable(EXPECTED_ACTION), 'phase-one ACTION6 changed');

  const second = report.phaseTwo;
  assert(second?.pagehideMarkerPresent === false, 'pagehide marker survived the phase-one crash');
  assert(second.freshWorkerInstances === 1, `phase two created ${second.freshWorkerInstances} workers`);
  assert(second.reconstructionRequests?.length === 2, `phase two emitted ${second.reconstructionRequests?.length} requests`);
  assert(second.reconstructionRequests[0]?.type === 'load', 'phase-two replay did not begin with load');
  assert(stable(actionFromRequest(second.reconstructionRequests[1])) === stable(EXPECTED_ACTION), 'phase-two ACTION6 changed');
  assert(second.settledRuntimeEntries === 2, 'settled runtime journal must contain load plus ACTION6');
  assert(second.settledRuntimePending === false, 'settled runtime still has a pending request');
  assert(second.settledAgentPending === false, 'settled Agent still has a pending return');
  assert(second.actionsDispatched === 1, 'post-crash action count changed');
  assert(second.sessionId === first.sessionId, 'post-crash sessionId changed');
  assert(second.needIdRetained === true, 'post-crash checkpoint lost the correlated needId');
  assert(second.mode === 'manual', 'post-crash fixture did not stop in Manual');
  assert(second.canvasPresentations === 1, `returned observation had ${second.canvasPresentations} logical presentations`);
  assert(
    Number.isInteger(second.expectedReturnedObservationCanvasPaints)
      && second.expectedReturnedObservationCanvasPaints > 0,
    'expected returned-observation canvas paint count is missing',
  );
  assert(
    second.returnedObservationCanvasPaints === second.expectedReturnedObservationCanvasPaints,
    `returned observation painted ${second.returnedObservationCanvasPaints} frames; expected ${second.expectedReturnedObservationCanvasPaints}`,
  );
  assert(
    second.totalCanvasPaints >= second.returnedObservationCanvasPaints,
    'total canvas paint count is inconsistent',
  );
  assert(second.extraRequestsAfterSettlement === 0, 'Agent emitted another request after settlement');
  assert(second.extraPresentationsAfterSettlement === 0, 'returned observation was presented again');

  const causal = report.causalProofs ?? {};
  for (const key of [
    'pendingBoundaryAutosavedBeforeCrash',
    'freshChromeProcessRequired',
    'freshWorkerCreated',
    'deterministicPyodideReplay',
    'sameSessionIdPreserved',
    'sameNeedIdRetained',
    'actionCountPreserved',
    'settledBoundaryRepersisted',
  ]) {
    assert(causal[key] === true, `causal proof ${key} is missing`);
  }
  assert(causal.pagehideObservedBeforeCrash === false, 'causal proof says pagehide fired');
  assert(causal.agentPhysicalActionAfterRestore === false, 'Agent sent another physical action after restore');
  assert(causal.returnedObservationPresentedTwice === false, 'returned observation was presented twice');

  const boundary = report.proofBoundary ?? {};
  assert(boundary.rawPythonHeapSnapshot === false, 'crash proof must not claim a Python heap snapshot');
  assert(boundary.deterministicReplayRequired === true, 'deterministic replay boundary is missing');
  assert(boundary.localStorageUsed === true, 'localStorage boundary is missing');
  assert(boundary.hardProcessTerminationRequested === true, 'hard termination boundary is missing');
  assert(boundary.crossBrowserQualified === false, 'crash proof must not claim cross-browser coverage');
  assert(boundary.longJournalQualified === false, 'crash proof must not claim long-journal coverage');
  assert(boundary.allGamesQualified === false, 'crash proof must not claim all games');
  assert(boundary.performanceQualified === false, 'crash proof must not claim performance qualification');
  assert(boundary.sitePublished === false, 'crash proof must not claim Site publication');

  return {
    game: report.game,
    backend: report.backend,
    action: EXPECTED_ACTION,
    sessionId: first.sessionId,
    needId: first.needId,
    changedPixelCount: first.changedPixelCount,
    hardKillSignal: report.hardKill.signal,
    reconstructionRequests: second.reconstructionRequests.length,
    actionsDispatched: second.actionsDispatched,
    canvasPresentations: second.canvasPresentations,
    returnedObservationCanvasPaints: second.returnedObservationCanvasPaints,
  };
}
