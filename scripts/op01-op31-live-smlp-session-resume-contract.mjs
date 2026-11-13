const EXPECTED_ACTION = { id: 6, x: 32, y: 26 };

function stable(value) {
  return JSON.stringify(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requestTypes(worker) {
  return (worker?.requests ?? []).map(request => request.type);
}

function actionRequests(worker) {
  return (worker?.requests ?? []).filter(request => request.type === 'action');
}

function assertWorkerPath(worker, label) {
  assert(worker?.instances === 1, `${label} did not use exactly one real Worker`);
  assert(
    stable(requestTypes(worker)) === stable(['load', 'action']),
    `${label} Worker request order drifted: ${stable(requestTypes(worker))}`,
  );
  const actions = actionRequests(worker);
  assert(actions.length === 1, `${label} Worker received ${actions.length} action requests`);
  assert(
    stable({ id: actions[0]?.actionId, ...actions[0]?.data }) === stable(EXPECTED_ACTION),
    `${label} ACTION6 request drifted: ${stable(actions[0])}`,
  );
}

export function assertOp01Op31LiveSmlpSessionResumeReport(report) {
  assert(report && report.version === 1, 'live SMLP session-resume report must be version 1');
  assert(
    report.runtime === 'browser-agent-controller-game-worker-pyodide',
    `unexpected browser runtime ${report.runtime}`,
  );

  const controller = report.controller;
  assert(controller?.game === 'SMLP', `controller scenario used ${controller?.game}`);
  assert(controller?.backend === 'python-wasm', `controller backend is ${controller?.backend}`);
  assert(controller?.gameId, 'controller scenario did not expose a game id');
  assertWorkerPath(controller.worker, 'controller scenario');
  assert(controller.changedPixelCount === 9, `controller changed ${controller.changedPixelCount} pixels`);
  assert(controller.hostCount === 2, `controller created ${controller.hostCount} hosts`);
  assert(controller.physicalActionCalls === 1, `controller sent ${controller.physicalActionCalls} actions`);
  assert(controller.presentations === 1, `controller presented ${controller.presentations} returns`);
  assert(controller.acquisitions?.length === 1, `controller acquired ${controller.acquisitions?.length} returns`);
  assert(controller.acquisitions[0]?.routed === true, 'controller acquisition did not route');
  assert(controller.acquisitions[0]?.duplicate === false, 'controller acquisition was marked duplicate');
  assert(stable(controller.busyTransitions) === stable([true, false]), 'controller busy transitions drifted');
  assert(controller.stopRequest?.phase === 'stopping', 'Manual switch did not request a graceful stop');
  assert(controller.stopRequest?.stopReason === 'manual', 'Manual switch lost its stop reason');
  assert(controller.firstActivation?.stopReason === 'manual', 'first controller activation did not stop in Manual');
  assert(controller.firstActivation?.actionsDispatched === 1, 'first controller activation lost its action count');
  assert(controller.secondActivation?.stopReason === 'action-limit', 'reactivated controller did not preserve the action bound');
  assert(controller.secondActivation?.actionsDispatched === 1, 'reactivated controller changed its action count');
  assert(controller.secondActivation?.sessionId === controller.retainedSessionId, 'reactivated controller changed session id');
  assert(controller.checkpointPendingStage === null, 'settled controller checkpoint retained a pending return');
  assert(controller.initialFrameHash !== controller.finalFrameHash, 'controller scenario did not change the public frame');
  assert(
    (controller.snapshots ?? []).some(snapshot => snapshot.phase === 'stopping' && snapshot.stopReason === 'manual'),
    'controller snapshots did not expose the Manual handoff',
  );

  const pending = report.pendingReturn;
  assert(pending?.game === 'SMLP', `pending-return scenario used ${pending?.game}`);
  assert(pending?.backend === 'python-wasm', `pending-return backend is ${pending?.backend}`);
  assert(pending?.gameId, 'pending-return scenario did not expose a game id');
  assertWorkerPath(pending.worker, 'pending-return scenario');
  assert(pending.changedPixelCount === 9, `pending-return changed ${pending.changedPixelCount} pixels`);
  assert(pending.physicalActionCalls === 1, `pending-return sent ${pending.physicalActionCalls} actions`);
  assert(pending.originalPresentations === 1, `original host presented ${pending.originalPresentations} returns`);
  assert(pending.originalAcquisitions?.length === 1, `original host acquired ${pending.originalAcquisitions?.length} returns`);
  assert(stable(pending.originalBusyTransitions) === stable([true, false]), 'pending-return busy transitions drifted');
  assert(pending.checkpointStage === 'dispatched', `pending checkpoint stage is ${pending.checkpointStage}`);
  assert(pending.pendingNeedId, 'pending checkpoint lost needId');
  assert(pending.originalResult?.status === 'action', `original host returned ${pending.originalResult?.status}`);
  assert(pending.originalResult?.needId === pending.pendingNeedId, 'original acquisition changed needId');
  assert(pending.originalResult?.sequence === 1, 'original return sequence drifted');
  assert(pending.resumedResult?.status === 'resumed', `restored host returned ${pending.resumedResult?.status}`);
  assert(pending.resumedResult?.needId === pending.pendingNeedId, 'resumed acquisition changed needId');
  assert(pending.resumedResult?.sequence === 1, 'resumed return sequence drifted');
  assert(pending.replayActions === 0, 'restored host replayed the physical action');
  assert(pending.duplicatePresentations === 0, 'restored host repeated presentation');
  assert(pending.resumedAcquisitions?.length === 1, `restored host acquired ${pending.resumedAcquisitions?.length} returns`);
  assert(pending.resumedAcquisitions[0]?.needId === pending.pendingNeedId, 'resumed callback changed needId');
  assert(pending.resumedAcquisitions[0]?.routed === true, 'resumed callback did not route');
  assert(pending.resumedAcquisitions[0]?.duplicate === false, 'resumed callback was marked duplicate');
  assert(pending.initialFrameHash !== pending.finalFrameHash, 'pending-return scenario did not change the public frame');

  return {
    realWorkersQualified: 2,
    physicalActionsQualified: 2,
    controllerReactivationsQualified: 1,
    dispatchedReturnsResumed: 1,
    replayedActions: controller.physicalActionCalls - 1 + pending.replayActions,
    duplicatePresentations: controller.presentations - 1 + pending.duplicatePresentations,
    preservedNeedIds: [
      controller.acquisitions[0].needId,
      pending.pendingNeedId,
    ],
  };
}
