import {
  browserGameRuntimeObservationIdentity,
  type GameObservation,
  type GameRuntimeRequest,
} from '../../src/runtime/browser-games.ts';
import {
  BROWSER_DURABLE_SESSION_STORAGE_KEY,
  BrowserDurableSessionStore,
} from '../../src/runtime/v6-browser-durable-session.ts';

const PHASE_KEY = 'op01-op31-browser-crash-resume:phase-v1';
const PAGEHIDE_KEY = 'op01-op31-browser-crash-resume:pagehide-v1';
const GAME_CODE = 'SMLP';
const EXPECTED_ACTION = { id: 6, x: 32, y: 26 } as const;

type ExtendedObservation = GameObservation & {
  code?: string;
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
  game: typeof GAME_CODE;
  backend: string;
  userAgent: string;
  sessionId: string;
  needId: string;
  proposalRef: string;
  action: { id: number; x?: number; y?: number };
  initialIdentity: string;
  returnedIdentity: string;
  changedPixelCount: number;
  workerRequests: GameRuntimeRequest[];
  runtimeCommittedEntries: number;
  runtimePendingSequence: number;
  controllerActionsDispatched: number;
  durableBytes: number;
  savedAtMs: number;
  pagehideObservedBeforeKill: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function status(message: string): void {
  const output = document.querySelector<HTMLPreElement>('#crash-status');
  if (output) output.textContent = message;
}

function normalizeObservation(result: ExtendedObservation): ExtendedObservation {
  const gameCode = result.code ?? result.gameCode;
  assert(typeof gameCode === 'string' && gameCode.length > 0, 'worker response has no game code');
  return { ...result, gameCode };
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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function waitFor<T>(
  read: () => T | null | undefined | false,
  label: string,
  timeoutMs = 600_000,
): Promise<T> {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    const value = read();
    if (value !== null && value !== undefined && value !== false) return value as T;
    await delay(20);
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms`);
}

async function post(path: string, payload: unknown): Promise<void> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
}

const retainedPhase = window.localStorage.getItem(PHASE_KEY);
const phase = retainedPhase ? 2 : 1;
if (phase === 1) {
  window.localStorage.removeItem(PAGEHIDE_KEY);
  window.localStorage.removeItem(BROWSER_DURABLE_SESSION_STORAGE_KEY);
  window.addEventListener('pagehide', () => {
    window.localStorage.setItem(PAGEHIDE_KEY, 'fired');
  });
}

const NativeWorker = globalThis.Worker;
const requestsById = new Map<number, GameRuntimeRequest>();
const workerRequests: GameRuntimeRequest[] = [];
let workerInstances = 0;
let heldRequestId: number | null = null;
let loadObservation: ExtendedObservation | null = null;
let heldObservation: ExtendedObservation | null = null;
let resolveHeld!: () => void;
const heldResponse = new Promise<void>(resolve => { resolveHeld = resolve; });

class InstrumentedWorker {
  readonly #inner: Worker;
  readonly #listenerMap = new Map<unknown, EventListener>();

  constructor(scriptURL: string | URL, options?: WorkerOptions) {
    workerInstances += 1;
    this.#inner = new NativeWorker(scriptURL, options);
  }

  postMessage(message: WorkerEnvelope, transferOrOptions?: Transferable[] | StructuredSerializeOptions): void {
    const envelope = structuredClone(message);
    requestsById.set(envelope.id, envelope.request);
    workerRequests.push(structuredClone(envelope.request));
    if (phase === 1 && heldRequestId === null && envelope.request.type === 'action') {
      heldRequestId = envelope.id;
    }
    if (transferOrOptions === undefined) this.#inner.postMessage(message);
    else this.#inner.postMessage(message, transferOrOptions as Transferable[]);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean): void {
    if (type !== 'message') {
      this.#inner.addEventListener(type, listener, options);
      return;
    }
    const wrapped: EventListener = event => {
      const message = (event as MessageEvent<WorkerResponse>).data;
      const request = requestsById.get(message.id);
      if (message.result && request?.type === 'load') {
        loadObservation = normalizeObservation(message.result);
      }
      if (phase === 1 && heldRequestId !== null && message.id === heldRequestId) {
        assert(!message.error, `held ACTION6 failed: ${message.error}`);
        assert(message.result, 'held ACTION6 response has no observation');
        heldObservation = normalizeObservation(message.result);
        resolveHeld();
        return;
      }
      if (typeof listener === 'function') listener.call(this, event);
      else listener.handleEvent(event);
    };
    this.#listenerMap.set(listener, wrapped);
    this.#inner.addEventListener(type, wrapped, options);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: EventListenerOptions | boolean): void {
    const wrapped = this.#listenerMap.get(listener) ?? listener;
    this.#inner.removeEventListener(type, wrapped as EventListenerOrEventListenerObject, options);
    this.#listenerMap.delete(listener);
  }

  dispatchEvent(event: Event): boolean {
    return this.#inner.dispatchEvent(event);
  }

  terminate(): void {
    this.#inner.terminate();
  }
}

(globalThis as unknown as { Worker: typeof Worker }).Worker = InstrumentedWorker as unknown as typeof Worker;

let canvasPresentations = 0;
const originalPutImageData = CanvasRenderingContext2D.prototype.putImageData;
CanvasRenderingContext2D.prototype.putImageData = function patchedPutImageData(
  this: CanvasRenderingContext2D,
  ...args: any[]
): void {
  canvasPresentations += 1;
  (originalPutImageData as any).apply(this, args);
} as CanvasRenderingContext2D['putImageData'];

let settledRaw: string | null = null;
let manualRequested = false;
const originalStorageSetItem = Storage.prototype.setItem;
Storage.prototype.setItem = function patchedSetItem(key: string, value: string): void {
  originalStorageSetItem.call(this, key, value);
  if (phase !== 2 || key !== BROWSER_DURABLE_SESSION_STORAGE_KEY || manualRequested) return;
  try {
    const checkpoint = JSON.parse(value) as any;
    const session = checkpoint?.agent?.host?.session;
    if (
      checkpoint?.runtime?.pending === null
      && checkpoint?.runtime?.entries?.length === 2
      && session?.pendingReturn === null
      && checkpoint?.agent?.actionsDispatched === 1
    ) {
      settledRaw = value;
      manualRequested = true;
      document.querySelector<HTMLButtonElement>('#manual-tab')?.click();
    }
  } catch {
    // Ignore writes that are not the durable V1 payload.
  }
};

async function waitForProductReady(): Promise<void> {
  await waitFor(() => {
    const availability = document.querySelector('#game-availability')?.textContent?.trim();
    const code = document.querySelector('#game-code')?.textContent?.trim();
    return availability === 'Ready' && code === GAME_CODE ? true : false;
  }, 'product SMLP readiness');
}

async function phaseOne(): Promise<never> {
  status('phase 1: waiting for product Agent dispatch and automatic pending autosave');
  await import('../../src/main.ts');
  await waitForProductReady();
  document.querySelector<HTMLButtonElement>('#agent-tab')?.click();
  await waitFor(() => heldRequestId !== null, 'physical ACTION6 dispatch');
  await heldResponse;

  const store = new BrowserDurableSessionStore(window.localStorage);
  const loaded = await waitFor(() => {
    const candidate = store.load(Date.now(), GAME_CODE);
    if (candidate.status !== 'ready') return false;
    const session = candidate.checkpoint.agent.host.session;
    if (!candidate.checkpoint.runtime.pending || !session?.pendingReturn) return false;
    return candidate;
  }, 'automatic in-flight durable checkpoint');

  const initial = loadObservation;
  const returned = heldObservation;
  assert(initial, 'phase one did not capture the initial SMLP observation');
  assert(returned, 'phase one did not capture the physical ACTION6 return');
  assert(String(initial.backend ?? '') === 'python-wasm', `expected Pyodide, received ${initial.backend}`);
  const session = loaded.checkpoint.agent.host.session;
  assert(session?.pendingReturn, 'automatic durable checkpoint lost the pending return');
  const preparation = session.pendingReturn.preparation;
  assert(preparation.action.id === EXPECTED_ACTION.id, `unexpected action ${preparation.action.id}`);
  assert(preparation.action.data.x === EXPECTED_ACTION.x, `unexpected x ${preparation.action.data.x}`);
  assert(preparation.action.data.y === EXPECTED_ACTION.y, `unexpected y ${preparation.action.data.y}`);
  assert(loaded.checkpoint.runtime.entries.length === 1, 'pending autosave must retain one committed load');
  assert(loaded.checkpoint.runtime.pending?.sequence === 2, 'pending autosave sequence changed');
  assert(loaded.checkpoint.agent.actionsDispatched === 1, 'pending action was not counted');

  const evidence: PhaseOneEvidence = {
    version: 1,
    game: GAME_CODE,
    backend: String(initial.backend ?? ''),
    userAgent: navigator.userAgent,
    sessionId: session.sessionId,
    needId: preparation.needId,
    proposalRef: preparation.proposalRef,
    action: {
      id: preparation.action.id,
      x: preparation.action.data.x,
      y: preparation.action.data.y,
    },
    initialIdentity: browserGameRuntimeObservationIdentity(initial),
    returnedIdentity: browserGameRuntimeObservationIdentity(returned),
    changedPixelCount: changedPixels(initial.frame, returned.frame),
    workerRequests: workerRequests.map(request => structuredClone(request)),
    runtimeCommittedEntries: loaded.checkpoint.runtime.entries.length,
    runtimePendingSequence: loaded.checkpoint.runtime.pending.sequence,
    controllerActionsDispatched: loaded.checkpoint.agent.actionsDispatched,
    durableBytes: loaded.bytes,
    savedAtMs: loaded.checkpoint.savedAtMs,
    pagehideObservedBeforeKill: window.localStorage.getItem(PAGEHIDE_KEY) !== null,
  };
  assert(evidence.changedPixelCount === 9, `SMLP ACTION6 changed ${evidence.changedPixelCount} pixels`);
  assert(evidence.workerRequests.length === 2, `phase one emitted ${evidence.workerRequests.length} worker requests`);
  window.localStorage.setItem(PHASE_KEY, JSON.stringify(evidence));

  status('phase 1 ready: external qualifier will SIGKILL Chrome without pagehide');
  await post('/__op01-op31-browser-crash-resume-phase-one', {
    status: 'phase-one-ready',
    evidence,
  });
  return await new Promise<never>(() => {});
}

async function phaseTwo(evidence: PhaseOneEvidence): Promise<void> {
  status('phase 2: restoring product session after hard Chrome termination');
  assert(window.localStorage.getItem(PAGEHIDE_KEY) === null, 'pagehide fired before the hard crash');
  await import('../../src/main.ts');

  const store = new BrowserDurableSessionStore(window.localStorage);
  const settled = await waitFor(() => {
    const candidate = store.load(Date.now(), GAME_CODE);
    if (candidate.status !== 'ready') return false;
    const session = candidate.checkpoint.agent.host.session;
    if (
      candidate.checkpoint.mode !== 'manual'
      || candidate.checkpoint.runtime.pending !== null
      || candidate.checkpoint.runtime.entries.length !== 2
      || session?.pendingReturn !== null
      || candidate.checkpoint.agent.actionsDispatched !== 1
      || candidate.checkpoint.savedAtMs <= evidence.savedAtMs
    ) return false;
    return candidate;
  }, 'settled post-crash durable checkpoint');

  const session = settled.checkpoint.agent.host.session;
  assert(session, 'post-crash checkpoint lost its Agent session');
  assert(workerInstances === 1, `post-crash page created ${workerInstances} workers`);
  assert(workerRequests.length === 2, `post-crash reconstruction emitted ${workerRequests.length} requests`);
  assert(workerRequests[0]?.type === 'load', 'post-crash reconstruction did not start with load');
  assert(workerRequests[1]?.type === 'action', 'post-crash reconstruction did not replay ACTION6');
  const replayed = workerRequests[1];
  assert(replayed.type === 'action', 'replayed request is not ACTION6');
  assert(replayed.actionId === EXPECTED_ACTION.id, 'replayed action id changed');
  assert(replayed.data?.x === EXPECTED_ACTION.x && replayed.data?.y === EXPECTED_ACTION.y, 'replayed coordinates changed');
  assert(session.sessionId === evidence.sessionId, 'post-crash session id changed');
  assert(settledRaw !== null, 'settled checkpoint was not observed synchronously');
  assert(settledRaw.includes(evidence.needId), 'settled checkpoint no longer retains the correlated needId');
  assert(canvasPresentations === 1, `post-crash returned observation was painted ${canvasPresentations} times`);
  assert(document.querySelector('#manual-tab')?.getAttribute('aria-selected') === 'true', 'controller did not stop in Manual');

  const requestsAtSettlement = workerRequests.length;
  const presentationsAtSettlement = canvasPresentations;
  await delay(150);
  assert(workerRequests.length === requestsAtSettlement, 'Agent emitted another physical action after crash recovery');
  assert(canvasPresentations === presentationsAtSettlement, 'returned observation was presented again after recovery');

  const report = {
    version: 1,
    status: 'browser-crash-without-pagehide-qualified',
    qualification: 'functional-real-chrome-sigkill-pyodide-not-official-performance',
    runtime: 'product-main-safe-boundary-autosave',
    userAgent: navigator.userAgent,
    game: GAME_CODE,
    backend: evidence.backend,
    phaseOne: evidence,
    phaseTwo: {
      pagehideMarkerPresent: window.localStorage.getItem(PAGEHIDE_KEY) !== null,
      freshWorkerInstances: workerInstances,
      reconstructionRequests: workerRequests.map(request => structuredClone(request)),
      settledRuntimeEntries: settled.checkpoint.runtime.entries.length,
      settledRuntimePending: settled.checkpoint.runtime.pending !== null,
      settledAgentPending: session.pendingReturn !== null,
      actionsDispatched: settled.checkpoint.agent.actionsDispatched,
      sessionId: session.sessionId,
      needIdRetained: settledRaw.includes(evidence.needId),
      mode: settled.checkpoint.mode,
      canvasPresentations,
      extraRequestsAfterSettlement: workerRequests.length - requestsAtSettlement,
      extraPresentationsAfterSettlement: canvasPresentations - presentationsAtSettlement,
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

  document.body.dataset.status = 'success';
  status('success');
  await post('/__op01-op31-browser-crash-resume-report', { status: 'success', report });
  store.clear();
  window.localStorage.removeItem(PHASE_KEY);
  window.localStorage.removeItem(PAGEHIDE_KEY);
}

async function main(): Promise<void> {
  try {
    if (phase === 1) await phaseOne();
    else await phaseTwo(JSON.parse(retainedPhase!) as PhaseOneEvidence);
  } catch (error) {
    const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
    document.body.dataset.status = 'failure';
    status(message);
    const path = phase === 1
      ? '/__op01-op31-browser-crash-resume-phase-one'
      : '/__op01-op31-browser-crash-resume-report';
    await post(path, { status: 'failure', error: message }).catch(() => {});
  }
}

void main();
