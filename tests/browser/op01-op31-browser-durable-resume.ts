import type {
  ProductReadinessState,
  XYActionData,
} from '../../src/agent-product-dispatch.ts';
import {
  BrowserGameRuntime,
  browserGameRuntimeObservationIdentity,
  type GameObservation,
  type GameRuntimeRequest,
} from '../../src/runtime/browser-games.ts';
import {
  BrowserAgentController,
  type BrowserAgentControllerPorts,
} from '../../src/runtime/v6-browser-agent-controller.ts';
import {
  BrowserDurableSessionStore,
  createBrowserDurableSessionCheckpoint,
} from '../../src/runtime/v6-browser-durable-session.ts';

const PHASE_KEY = 'op01-op31-browser-durable-resume:phase-v1';
const GAME_CODE = 'SMLP';
const EXPECTED_ACTION = { id: 6, x: 32, y: 26 } as const;

type ExtendedObservation = GameObservation & {
  code?: string;
  gameId?: string;
  backend?: string;
};

type WorkerEnvelope = {
  id: number;
  request: GameRuntimeRequest;
};

type WorkerResponse = {
  id: number;
  result?: ExtendedObservation;
  error?: string;
};

interface PhaseOneEvidence {
  version: 1;
  needId: string;
  proposalRef: string;
  action: { id: number; x?: number; y?: number };
  initialIdentity: string;
  returnedIdentity: string;
  changedPixelCount: number;
  phaseOnePostedRequests: GameRuntimeRequest[];
  runtimeCommittedEntries: number;
  runtimePendingSequence: number;
  controllerActionsDispatched: number;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function cloneRequest(request: GameRuntimeRequest): GameRuntimeRequest {
  return structuredClone(request);
}

function productState(
  observation: GameObservation,
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

async function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  timeoutMs = 300_000,
): Promise<T> {
  let timeout: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = window.setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
  }
}

class WorkerProbe {
  readonly posted: WorkerEnvelope[] = [];
  readonly actionPosted: Promise<void>;
  readonly responseHeld: Promise<void>;
  readonly #inner: Worker;
  readonly #holdFirstAction: boolean;
  #heldRequestId: number | null = null;
  #heldResponse: WorkerResponse | null = null;
  #resolveActionPosted!: () => void;
  #resolveResponseHeld!: () => void;

  constructor(holdFirstAction: boolean) {
    this.#holdFirstAction = holdFirstAction;
    this.actionPosted = new Promise(resolve => { this.#resolveActionPosted = resolve; });
    this.responseHeld = new Promise(resolve => { this.#resolveResponseHeld = resolve; });
    this.#inner = new Worker(
      new URL('../../src/runtime/game-worker.ts', import.meta.url),
      { type: 'module', name: holdFirstAction ? 'durable-phase-one' : 'durable-phase-two' },
    );
    if (!holdFirstAction) {
      this.#resolveActionPosted();
      this.#resolveResponseHeld();
    }
  }

  addEventListener(type: string, listener: (event: any) => void): void {
    if (type === 'message') {
      this.#inner.addEventListener('message', event => {
        const response = event.data as WorkerResponse;
        if (this.#heldRequestId !== null && response.id === this.#heldRequestId) {
          this.#heldResponse = structuredClone(response);
          this.#resolveResponseHeld();
          return;
        }
        listener(event);
      });
      return;
    }
    this.#inner.addEventListener(type, listener as EventListener);
  }

  postMessage(message: WorkerEnvelope): void {
    const envelope = structuredClone(message);
    this.posted.push(envelope);
    if (
      this.#holdFirstAction
      && this.#heldRequestId === null
      && envelope.request.type === 'action'
    ) {
      this.#heldRequestId = envelope.id;
      this.#resolveActionPosted();
    }
    this.#inner.postMessage(message);
  }

  terminate(): void {
    this.#inner.terminate();
  }

  heldObservation(): ExtendedObservation {
    const response = this.#heldResponse;
    assert(response, 'the phase-one worker did not hold a response');
    assert(!response.error, `phase-one ACTION6 failed: ${response.error}`);
    assert(response.result, 'the phase-one worker response has no observation');
    const gameCode = response.result.code ?? response.result.gameCode;
    assert(gameCode === GAME_CODE, `phase-one response changed game to ${gameCode}`);
    return { ...response.result, gameCode };
  }
}

async function postReport(payload: unknown): Promise<void> {
  const response = await fetch('/__op01-op31-browser-durable-resume-report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`report endpoint returned ${response.status}`);
}

function status(message: string): void {
  const output = document.querySelector<HTMLPreElement>('#status');
  if (output) output.textContent = message;
}

async function phaseOne(): Promise<never> {
  status('phase 1: loading SMLP under Pyodide');
  const store = new BrowserDurableSessionStore(window.localStorage);
  store.clear();
  const probe = new WorkerProbe(true);
  const runtime = new BrowserGameRuntime({
    workerFactory: () => probe as unknown as Worker,
    requestTimeoutMs: 300_000,
  });
  const controller = new BrowserAgentController({
    makeSessionId: () => 'op01-op31-durable-smlp-session',
  });

  let current = await runtime.load(GAME_CODE, 1) as ExtendedObservation;
  assert(current.gameCode === GAME_CODE, `expected ${GAME_CODE}, received ${current.gameCode}`);
  assert(String(current.backend ?? '') === 'python-wasm', `expected Pyodide backend, received ${current.backend}`);
  const initial = structuredClone(current);
  let busy = false;
  const ports: BrowserAgentControllerPorts = {
    readState: () => productState(current, busy),
    action: (action, data) => runtime.action(action, data),
    present: async next => { current = next as ExtendedObservation; },
    now: () => performance.now(),
    generation: () => 1,
    setBusy: value => { busy = value; },
    yieldToBrowser: async () => {},
  };

  void controller.activate(current, ports);
  await withTimeout(probe.actionPosted, 'phase-one ACTION6 dispatch');
  await withTimeout(probe.responseHeld, 'phase-one ACTION6 physical return');
  const held = probe.heldObservation();
  const agent = controller.captureCheckpoint();
  assert(agent?.host.session?.pendingReturn, 'Agent checkpoint did not capture the dispatched return');
  const runtimeCheckpoint = runtime.snapshot();
  assert(runtimeCheckpoint.pending, 'runtime checkpoint did not capture the pending ACTION6');
  const preparation = agent.host.session.pendingReturn.preparation;
  assert(preparation.action.id === EXPECTED_ACTION.id, `unexpected action ${preparation.action.id}`);
  assert(
    preparation.action.data.x === EXPECTED_ACTION.x
      && preparation.action.data.y === EXPECTED_ACTION.y,
    `unexpected SMLP coordinates ${JSON.stringify(preparation.action.data)}`,
  );
  assert(runtimeCheckpoint.pending.request.type === 'action', 'runtime pending request is not an action');
  assert(runtimeCheckpoint.pending.request.actionId === EXPECTED_ACTION.id, 'runtime pending action changed');
  assert(runtimeCheckpoint.pending.request.data?.x === EXPECTED_ACTION.x, 'runtime pending x changed');
  assert(runtimeCheckpoint.pending.request.data?.y === EXPECTED_ACTION.y, 'runtime pending y changed');

  const durable = createBrowserDurableSessionCheckpoint({
    runtime: runtimeCheckpoint,
    agent,
    selectionGeneration: 1,
    mode: 'agent',
    ttlMs: 60 * 60 * 1000,
  });
  const saved = store.save(durable);
  assert(saved.status === 'saved', `durable checkpoint was not saved: ${saved.status}`);

  const evidence: PhaseOneEvidence = {
    version: 1,
    needId: preparation.needId,
    proposalRef: preparation.proposalRef,
    action: {
      id: preparation.action.id,
      x: preparation.action.data.x,
      y: preparation.action.data.y,
    },
    initialIdentity: browserGameRuntimeObservationIdentity(initial),
    returnedIdentity: browserGameRuntimeObservationIdentity(held),
    changedPixelCount: changedPixels(initial.frame, held.frame),
    phaseOnePostedRequests: probe.posted.map(item => cloneRequest(item.request)),
    runtimeCommittedEntries: runtimeCheckpoint.entries.length,
    runtimePendingSequence: runtimeCheckpoint.pending.sequence,
    controllerActionsDispatched: agent.actionsDispatched,
  };
  assert(evidence.changedPixelCount === 9, `phase-one SMLP delta was ${evidence.changedPixelCount}, expected 9`);
  assert(evidence.controllerActionsDispatched === 1, 'dispatched action was not counted in Agent checkpoint');
  window.localStorage.setItem(PHASE_KEY, JSON.stringify(evidence));

  status('phase 1 complete: reloading after the physical ACTION6 return was withheld');
  window.location.reload();
  return await new Promise<never>(() => {});
}

async function phaseTwo(evidence: PhaseOneEvidence): Promise<void> {
  status('phase 2: reconstructing Pyodide runtime and Agent session');
  const store = new BrowserDurableSessionStore(window.localStorage);
  const loaded = store.load(Date.now(), GAME_CODE);
  assert(loaded.status === 'ready', `durable checkpoint is not ready: ${loaded.status}`);
  const probe = new WorkerProbe(false);
  const runtime = new BrowserGameRuntime({
    workerFactory: () => probe as unknown as Worker,
    requestTimeoutMs: 300_000,
  });
  const restored = await runtime.restore(loaded.checkpoint.runtime);
  assert(restored.replayedEntries === 1, `expected one settled load replay, received ${restored.replayedEntries}`);
  assert(restored.replayedPending, 'the physically issued ACTION6 was not replayed during reconstruction');
  assert(
    browserGameRuntimeObservationIdentity(restored.observation) === evidence.returnedIdentity,
    'reconstructed return differs from the phase-one physical return',
  );
  assert(probe.posted.length === 2, `reconstruction emitted ${probe.posted.length} requests instead of 2`);
  assert(probe.posted[0]?.request.type === 'load', 'reconstruction did not start from load');
  assert(probe.posted[1]?.request.type === 'action', 'reconstruction did not replay the pending action');

  const controller = new BrowserAgentController({
    makeSessionId: () => 'must-not-create-a-new-session',
  });
  controller.restoreCheckpoint(loaded.checkpoint.agent);
  let current = restored.observation as ExtendedObservation;
  let busy = false;
  let controllerActionCalls = 0;
  let presentationCalls = 0;
  let acquired: {
    needId: string;
    ownerId: string;
    proposalRef: string;
    routed: boolean;
    duplicate: boolean;
  } | null = null;

  const ports: BrowserAgentControllerPorts = {
    readState: () => productState(current, busy),
    action: async (action: number, data?: XYActionData) => {
      controllerActionCalls += 1;
      return runtime.action(action, data);
    },
    present: async next => {
      presentationCalls += 1;
      current = next as ExtendedObservation;
    },
    now: () => performance.now(),
    generation: () => 2,
    setBusy: value => { busy = value; },
    onCampaignAcquired: receipt => {
      acquired = {
        needId: receipt.needId,
        ownerId: receipt.ownerId,
        proposalRef: receipt.proposalRef,
        routed: receipt.routed,
        duplicate: receipt.duplicate,
      };
      queueMicrotask(() => controller.deactivate('manual'));
    },
    yieldToBrowser: async () => {},
  };

  const finished = await controller.activate(current, ports);
  assert(acquired, 'restored Agent did not acquire the reconstructed return');
  assert(acquired.needId === evidence.needId, 'restored Agent changed needId');
  assert(acquired.proposalRef === evidence.proposalRef, 'restored Agent changed proposalRef');
  assert(acquired.routed === true && acquired.duplicate === false, 'return was not routed exactly once');
  assert(controllerActionCalls === 0, `Agent replayed ${controllerActionCalls} physical actions after reconstruction`);
  assert(presentationCalls === 0, `Agent presented the already-live return ${presentationCalls} times`);
  assert(finished.stopReason === 'manual', `restored Agent stopped with ${finished.stopReason}`);
  assert(finished.campaignStatus === 'resumed', `restored Agent status was ${finished.campaignStatus}`);
  assert(finished.actionsDispatched === 1, `restored action count was ${finished.actionsDispatched}`);
  assert(finished.sessionId === 'op01-op31-durable-smlp-session', 'restored session id changed');

  const report = {
    version: 1,
    status: 'browser-durable-session-reload-qualified',
    runtime: 'chrome-reload-browser-game-runtime-pyodide',
    replayPolicy: loaded.checkpoint.replayPolicy,
    userAgent: navigator.userAgent,
    game: GAME_CODE,
    backend: String(current.backend ?? ''),
    phaseOne: evidence,
    phaseTwo: {
      replayedEntries: restored.replayedEntries,
      replayedPending: restored.replayedPending,
      reconstructionRequests: probe.posted.map(item => cloneRequest(item.request)),
      reconstructedIdentity: browserGameRuntimeObservationIdentity(restored.observation),
      controllerActionCalls,
      presentationCalls,
      acquisition: acquired,
      controller: finished,
    },
    causalProofs: {
      pageReloadOccurred: true,
      freshWorkerCreated: true,
      pyodideJournalReplayed: true,
      pendingPhysicalActionReplayedOnceToReconstructState: true,
      sameNeedIdAcquired: true,
      acquisitionRoutedOnce: true,
      agentPhysicalActionReplayedAfterRestore: false,
      returnedObservationPresentedTwice: false,
      actionCountPreserved: true,
      sessionIdPreserved: true,
      changedPixels: evidence.changedPixelCount,
    },
    proofBoundary: {
      rawPythonHeapSnapshot: false,
      deterministicReplayRequired: true,
      localStorageUsed: true,
      crossBrowserQualified: false,
      crashWithoutPagehideQualified: false,
      performanceQualified: false,
      sitePublished: false,
    },
  };

  store.clear();
  window.localStorage.removeItem(PHASE_KEY);
  controller.dispose();
  runtime.dispose();
  document.body.dataset.status = 'success';
  status('success');
  await postReport({ status: 'success', report });
}

async function main(): Promise<void> {
  const raw = window.localStorage.getItem(PHASE_KEY);
  if (!raw) return phaseOne();
  const evidence = JSON.parse(raw) as PhaseOneEvidence;
  assert(evidence.version === 1, 'unsupported durable browser fixture phase');
  await phaseTwo(evidence);
}

void main().catch(async error => {
  const message = error instanceof Error
    ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
    : String(error);
  try {
    new BrowserDurableSessionStore(window.localStorage).clear();
    window.localStorage.removeItem(PHASE_KEY);
  } catch {
    // The original error remains authoritative.
  }
  document.body.dataset.status = 'error';
  status(message);
  await postReport({ status: 'error', error: message });
});
