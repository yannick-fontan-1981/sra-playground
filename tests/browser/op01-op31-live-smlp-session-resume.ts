import type {
  ProductReadinessState,
  XYActionData,
} from '../../src/agent-product-dispatch.ts';
import {
  BrowserGameRuntime,
  type GameObservation,
  type GameRuntimeRequest,
} from '../../src/runtime/browser-games.ts';
import {
  BrowserAgentController,
  type BrowserAgentControllerPorts,
  type BrowserAgentControllerSnapshot,
} from '../../src/runtime/v6-browser-agent-controller.ts';
import {
  createFieldStockPublicAction6AndPublicSingleActionBrowserCampaignHost,
} from '../../src/runtime/v6-browser-product-campaign-host.ts';

const EXPECTED_ACTION = { id: 6, x: 32, y: 26 } as const;
const REQUEST_TIMEOUT_MS = 300_000;

type ExtendedObservation = GameObservation & {
  gameId?: string;
  backend?: string;
};

type TrackedWorkerRecord = {
  instances: number;
  requests: GameRuntimeRequest[];
};

type AcquisitionRecord = {
  needId: string;
  ownerId: string;
  proposalRef: string;
  routed: boolean;
  duplicate: boolean;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function stable(value: unknown): string {
  return JSON.stringify(value);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(settle => { resolve = settle; });
  return { promise, resolve };
}

function productState(
  observation: ExtendedObservation,
  busy: boolean,
): ProductReadinessState {
  return {
    observation,
    selectedGameCode: observation.gameCode,
    busy,
    loading: false,
    failed: false,
  };
}

function actionRecord(requests: readonly GameRuntimeRequest[]): Extract<GameRuntimeRequest, { type: 'action' }>[] {
  return requests.filter((request): request is Extract<GameRuntimeRequest, { type: 'action' }> => (
    request.type === 'action'
  ));
}

function changedPixels(before: number[][], after: number[][]): number {
  assert(before.length === 64 && after.length === 64, 'SMLP frames must be 64x64');
  let changed = 0;
  for (let y = 0; y < 64; y += 1) {
    const beforeRow = before[y];
    const afterRow = after[y];
    assert(beforeRow?.length === 64 && afterRow?.length === 64, 'SMLP frames must be 64x64');
    for (let x = 0; x < 64; x += 1) {
      if (beforeRow[x] !== afterRow[x]) changed += 1;
    }
  }
  return changed;
}

async function frameHash(frame: number[][]): Promise<string> {
  assert(frame.length === 64 && frame.every(row => row.length === 64), 'SMLP frame must be 64x64');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(frame.flat())));
  return [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
}

function createTrackedRuntime(name: string): {
  runtime: BrowserGameRuntime;
  record: TrackedWorkerRecord;
} {
  const record: TrackedWorkerRecord = { instances: 0, requests: [] };
  const runtime = new BrowserGameRuntime({
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    workerFactory: () => {
      record.instances += 1;
      const worker = new Worker(
        new URL('../../src/runtime/game-worker.ts', import.meta.url),
        { type: 'module', name },
      );
      const nativePostMessage = worker.postMessage.bind(worker) as unknown as (
        message: unknown,
        transferOrOptions?: unknown,
      ) => void;
      worker.postMessage = ((message: unknown, transferOrOptions?: unknown) => {
        const envelope = message as { request?: GameRuntimeRequest };
        if (envelope.request) record.requests.push(structuredClone(envelope.request));
        nativePostMessage(message, transferOrOptions);
      }) as Worker['postMessage'];
      return worker;
    },
  });
  return { runtime, record };
}

function acquisitionRecord(receipt: {
  needId: string;
  ownerId: string;
  proposalRef: string;
  routed: boolean;
  duplicate: boolean;
}): AcquisitionRecord {
  return {
    needId: receipt.needId,
    ownerId: receipt.ownerId,
    proposalRef: receipt.proposalRef,
    routed: receipt.routed,
    duplicate: receipt.duplicate,
  };
}

function snapshotRecord(snapshot: BrowserAgentControllerSnapshot) {
  return {
    phase: snapshot.phase,
    stopReason: snapshot.stopReason,
    campaignStatus: snapshot.campaignStatus,
    sessionId: snapshot.sessionId,
    actionsDispatched: snapshot.actionsDispatched,
  };
}

function assertExpectedAction(action: number, data?: XYActionData): void {
  assert(action === EXPECTED_ACTION.id, `expected ACTION6, received ACTION${action}`);
  assert(
    data?.x === EXPECTED_ACTION.x && data.y === EXPECTED_ACTION.y,
    `expected SMLP coordinate ${stable(EXPECTED_ACTION)}, received ${stable({ id: action, ...data })}`,
  );
}

async function runControllerToggleScenario() {
  const tracked = createTrackedRuntime('op01-op31-controller-resume');
  const snapshots: ReturnType<typeof snapshotRecord>[] = [];
  let controller: BrowserAgentController | null = null;

  try {
    let current = await tracked.runtime.load('SMLP', 1) as ExtendedObservation;
    assert(current.gameCode === 'SMLP', `expected SMLP, received ${current.gameCode}`);
    assert(current.backend === 'python-wasm', `expected python-wasm, received ${current.backend}`);
    const initial = current;
    const initialHash = await frameHash(initial.frame);
    let busy = false;
    let hostCount = 0;
    let physicalActionCalls = 0;
    let presentations = 0;
    const acquisitions: AcquisitionRecord[] = [];
    const busyTransitions: boolean[] = [];
    const dispatched = deferred<void>();

    controller = new BrowserAgentController({
      maxActions: 1,
      createHost: () => {
        hostCount += 1;
        return createFieldStockPublicAction6AndPublicSingleActionBrowserCampaignHost();
      },
      makeSessionId: () => 'op01-op31-live-controller-resume',
      onStateChange: snapshot => snapshots.push(snapshotRecord(snapshot)),
    });

    const ports: BrowserAgentControllerPorts = {
      readState: () => productState(current, busy),
      action: (action, data) => {
        assertExpectedAction(action, data);
        physicalActionCalls += 1;
        const pending = tracked.runtime.action(action, data) as Promise<ExtendedObservation>;
        if (physicalActionCalls === 1) dispatched.resolve();
        return pending;
      },
      present: async next => {
        presentations += 1;
        current = next as ExtendedObservation;
      },
      now: () => performance.now(),
      generation: () => 1,
      setBusy: value => {
        busy = value;
        busyTransitions.push(value);
      },
      onCampaignAcquired: receipt => acquisitions.push(acquisitionRecord(receipt)),
      yieldToBrowser: () => delay(0),
    };

    const firstActivation = controller.activate(current, ports);
    await dispatched.promise;
    const stopRequest = controller.deactivate('manual');
    assert(stopRequest.phase === 'stopping', `manual stop did not enter stopping: ${stopRequest.phase}`);
    const first = await firstActivation;
    assert(first.stopReason === 'manual', `first activation stopped as ${first.stopReason}`);
    assert(first.actionsDispatched === 1, `first activation counted ${first.actionsDispatched} actions`);
    assert(physicalActionCalls === 1, `first activation sent ${physicalActionCalls} physical actions`);
    assert(presentations === 1, `first activation presented ${presentations} observations`);
    assert(acquisitions.length === 1, `first activation acquired ${acquisitions.length} returns`);
    assert(acquisitions[0]?.routed === true && acquisitions[0]?.duplicate === false, 'first acquisition did not route exactly once');

    const checkpoint = controller.retainedCheckpoint();
    assert(checkpoint?.host.session, 'controller did not retain a browser campaign session');
    assert(checkpoint.host.session.pendingReturn === null, 'controller retained a dispatched return after settlement');
    const retainedSessionId = checkpoint.host.session.sessionId;
    const workerRequestsBeforeResume = tracked.record.requests.length;

    const second = await controller.activate(current, ports);
    assert(second.stopReason === 'action-limit', `second activation stopped as ${second.stopReason}`);
    assert(second.sessionId === retainedSessionId, 'controller changed session id during reactivation');
    assert(second.actionsDispatched === 1, `reactivation changed action count to ${second.actionsDispatched}`);
    assert(physicalActionCalls === 1, 'reactivation replayed the physical action');
    assert(presentations === 1, 'reactivation repeated presentation');
    assert(acquisitions.length === 1, 'reactivation repeated acquisition');
    assert(tracked.record.requests.length === workerRequestsBeforeResume, 'reactivation posted a new Worker request');
    assert(hostCount === 2, `controller did not recreate a fresh host: ${hostCount}`);

    const actions = actionRecord(tracked.record.requests);
    assert(actions.length === 1, `controller Worker received ${actions.length} action requests`);
    assertExpectedAction(actions[0]!.actionId, actions[0]!.data);
    const finalHash = await frameHash(current.frame);
    const delta = changedPixels(initial.frame, current.frame);
    assert(delta === 9, `controller scenario changed ${delta} pixels instead of 9`);

    return {
      game: current.gameCode,
      gameId: String(current.gameId ?? ''),
      backend: String(current.backend ?? ''),
      worker: {
        instances: tracked.record.instances,
        requests: structuredClone(tracked.record.requests),
      },
      initialFrameHash: initialHash,
      finalFrameHash: finalHash,
      changedPixelCount: delta,
      hostCount,
      physicalActionCalls,
      presentations,
      acquisitions,
      busyTransitions,
      stopRequest: snapshotRecord(stopRequest),
      firstActivation: snapshotRecord(first),
      secondActivation: snapshotRecord(second),
      retainedSessionId,
      checkpointPendingStage: checkpoint.host.session.pendingReturn?.stage ?? null,
      snapshots: snapshots.map(snapshot => ({ ...snapshot })),
    };
  } finally {
    controller?.dispose();
    tracked.runtime.dispose();
  }
}

async function runPendingReturnScenario() {
  const tracked = createTrackedRuntime('op01-op31-pending-resume');
  const original = createFieldStockPublicAction6AndPublicSingleActionBrowserCampaignHost();
  const restored = createFieldStockPublicAction6AndPublicSingleActionBrowserCampaignHost();

  try {
    let current = await tracked.runtime.load('SMLP', 1) as ExtendedObservation;
    assert(current.gameCode === 'SMLP', `expected SMLP, received ${current.gameCode}`);
    assert(current.backend === 'python-wasm', `expected python-wasm, received ${current.backend}`);
    const initial = current;
    const initialHash = await frameHash(initial.frame);
    const dispatched = deferred<void>();
    let busy = false;
    let physicalActionCalls = 0;
    let originalPresentations = 0;
    let replayActions = 0;
    let duplicatePresentations = 0;
    const originalAcquisitions: AcquisitionRecord[] = [];
    const resumedAcquisitions: AcquisitionRecord[] = [];
    const originalBusyTransitions: boolean[] = [];

    original.begin({
      sessionId: 'op01-op31-live-pending-resume',
      observation: current,
    });
    const originalRun = original.run(productState(current, busy), {
      action: (action, data) => {
        assertExpectedAction(action, data);
        physicalActionCalls += 1;
        const pending = tracked.runtime.action(action, data) as Promise<ExtendedObservation>;
        dispatched.resolve();
        return pending;
      },
      present: async next => {
        originalPresentations += 1;
        current = next as ExtendedObservation;
      },
      now: () => performance.now(),
      generation: () => 1,
      setBusy: value => {
        busy = value;
        originalBusyTransitions.push(value);
      },
      onCampaignAcquired: receipt => originalAcquisitions.push(acquisitionRecord(receipt)),
    });

    await dispatched.promise;
    const checkpoint = original.snapshot();
    const pendingReturn = checkpoint.session?.pendingReturn;
    assert(pendingReturn?.stage === 'dispatched', 'host did not capture a dispatched pending return');
    const pendingNeedId = pendingReturn.preparation.needId;
    const originalResult = await originalRun;
    assert(originalResult.status === 'action', `original host returned ${originalResult.status}`);
    assert(originalResult.acquisition?.needId === pendingNeedId, 'original host changed the pending need id');
    assert(physicalActionCalls === 1, `original host sent ${physicalActionCalls} physical actions`);
    assert(originalPresentations === 1, `original host presented ${originalPresentations} observations`);
    assert(originalAcquisitions.length === 1, `original host acquired ${originalAcquisitions.length} returns`);

    restored.restore(checkpoint, current);
    const resumed = await restored.run(productState(current, false), {
      action: async () => {
        replayActions += 1;
        throw new Error('restored host replayed the physical action');
      },
      present: async () => {
        duplicatePresentations += 1;
        throw new Error('restored host repeated presentation of the live return');
      },
      now: () => performance.now(),
      generation: () => 2,
      setBusy: () => {},
      onCampaignAcquired: receipt => resumedAcquisitions.push(acquisitionRecord(receipt)),
    });

    assert(resumed.status === 'resumed', `restored host returned ${resumed.status}`);
    assert(resumed.acquisition?.needId === pendingNeedId, 'resumed acquisition changed need id');
    assert(resumed.acquisition?.routed === true && resumed.acquisition.duplicate === false, 'resumed acquisition did not route exactly once');
    assert(resumed.returnedObservation?.sequence === 1, `resumed sequence is ${resumed.returnedObservation?.sequence}`);
    assert(replayActions === 0, 'restored host replayed the Worker action');
    assert(duplicatePresentations === 0, 'restored host repeated presentation');
    assert(resumedAcquisitions.length === 1, `restored host acquired ${resumedAcquisitions.length} returns`);
    assert(resumedAcquisitions[0]?.needId === pendingNeedId, 'resumed callback changed need id');

    const actions = actionRecord(tracked.record.requests);
    assert(actions.length === 1, `pending-return Worker received ${actions.length} action requests`);
    assertExpectedAction(actions[0]!.actionId, actions[0]!.data);
    const finalHash = await frameHash(current.frame);
    const delta = changedPixels(initial.frame, current.frame);
    assert(delta === 9, `pending-return scenario changed ${delta} pixels instead of 9`);

    return {
      game: current.gameCode,
      gameId: String(current.gameId ?? ''),
      backend: String(current.backend ?? ''),
      worker: {
        instances: tracked.record.instances,
        requests: structuredClone(tracked.record.requests),
      },
      initialFrameHash: initialHash,
      finalFrameHash: finalHash,
      changedPixelCount: delta,
      physicalActionCalls,
      originalPresentations,
      originalAcquisitions,
      originalBusyTransitions,
      checkpointStage: pendingReturn.stage,
      pendingNeedId,
      originalResult: {
        status: originalResult.status,
        needId: originalResult.acquisition?.needId ?? null,
        sequence: originalResult.returnedObservation?.sequence ?? null,
      },
      resumedResult: {
        status: resumed.status,
        needId: resumed.acquisition?.needId ?? null,
        sequence: resumed.returnedObservation?.sequence ?? null,
      },
      replayActions,
      duplicatePresentations,
      resumedAcquisitions,
    };
  } finally {
    original.dispose();
    restored.dispose();
    tracked.runtime.dispose();
  }
}

async function postReport(payload: unknown): Promise<void> {
  const response = await fetch('/__op01-op31-live-smlp-session-resume-report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`report endpoint returned ${response.status}`);
}

async function main(): Promise<void> {
  const status = document.querySelector<HTMLPreElement>('#status');
  try {
    if (status) status.textContent = 'running controller Manual/Agent continuity';
    const controller = await runControllerToggleScenario();
    if (status) status.textContent = 'running dispatched-return continuity';
    const pendingReturn = await runPendingReturnScenario();
    const report = {
      version: 1,
      runtime: 'browser-agent-controller-game-worker-pyodide',
      transport: 'BrowserAgentController/BrowserCommonCampaignHost -> BrowserGameRuntime -> real module Worker -> Pyodide -> game_bridge.py -> custom-games.zip',
      userAgent: navigator.userAgent,
      controller,
      pendingReturn,
    };

    document.body.dataset.status = 'success';
    if (status) status.textContent = 'success';
    await postReport({ status: 'success', report });
  } catch (error) {
    const message = error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
      : String(error);
    document.body.dataset.status = 'error';
    if (status) status.textContent = message;
    await postReport({ status: 'error', error: message });
  }
}

void main();
