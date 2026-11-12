import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchProductAction, type ProductReadinessState } from '../src/agent-product-dispatch.ts';
import { BrowserGameRuntime, type GameObservation } from '../src/runtime/browser-games.ts';

class FakeWorker {
  readonly posted: unknown[] = [];
  terminated = false;
  private readonly listeners = new Map<string, Array<(event: any) => void>>();

  addEventListener(type: string, listener: (event: any) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  emitMessage(data: unknown): void {
    for (const listener of this.listeners.get('message') ?? []) listener({ data });
  }

  emit(type: 'error' | 'messageerror'): void {
    for (const listener of this.listeners.get(type) ?? []) listener({});
  }
}

function observation(code = 'CASC', state = 'NOT_FINISHED'): GameObservation {
  return {
    gameCode: code,
    frame: [[1]],
    frames: [[[1]]],
    state,
    availableActionIds: [1, 2, 3, 4, 5, 6],
    canUndo: true,
    canSelectLevel: false,
    level: 1,
    levelCount: 1,
    levelsCompleted: 0,
    defaultFps: 10,
  };
}

function productState(current = observation()): ProductReadinessState {
  return {
    observation: current,
    selectedGameCode: 'CASC',
    busy: false,
    loading: false,
    failed: false,
  };
}

function runtimeHarness() {
  const worker = new FakeWorker();
  const runtime = new BrowserGameRuntime({
    workerFactory: () => worker as unknown as Worker,
    setTimer: (() => {
      let nextId = 0;
      return () => ({ id: ++nextId } as unknown as ReturnType<typeof setTimeout>);
    })(),
    clearTimer: () => {},
  });
  return { runtime, worker };
}

test('ACTION6 crosses dispatch, BrowserGameRuntime and worker envelope before presentation', async () => {
  const { runtime, worker } = runtimeHarness();
  const events: string[] = [];
  let busy = false;
  let now = 10;

  const resultPromise = dispatchProductAction(productState(), 6, { x: 0, y: 9 }, {
    action: (action, data) => {
      events.push('runtime:action');
      return runtime.action(action, data);
    },
    present: async (next, generation) => {
      events.push(`present:${next.gameCode}:${generation}`);
    },
    now: () => now,
    generation: () => 3,
    setBusy: value => {
      busy = value;
      events.push(`busy:${value}`);
    },
    onDispatchMeasured: elapsed => events.push(`measured:${elapsed}`),
  });

  assert.equal(busy, true);
  assert.deepEqual(worker.posted, [{
    id: 1,
    request: { type: 'action', actionId: 6, data: { x: 0, y: 9 } },
  }]);

  now = 18;
  const workerResult = observation();
  worker.emitMessage({ id: 1, result: { ...workerResult, code: 'CASC', gameCode: '' } });

  const result = await resultPromise;
  assert.deepEqual(result, { accepted: true, stale: false, elapsedMs: 8 });
  assert.deepEqual(events, [
    'busy:true',
    'runtime:action',
    'measured:8',
    'present:CASC:3',
    'busy:false',
  ]);
  assert.equal(busy, false);
});

test('a worker response for another game is rejected before presentation', async () => {
  const { runtime, worker } = runtimeHarness();
  const events: string[] = [];

  const resultPromise = dispatchProductAction(productState(), 2, undefined, {
    action: (action, data) => runtime.action(action, data),
    present: async () => { events.push('present'); },
    now: (() => { let value = 20; return () => value++; })(),
    generation: () => 5,
    setBusy: value => events.push(`busy:${value}`),
  });

  worker.emitMessage({ id: 1, result: { ...observation('OTHER'), code: 'OTHER' } });

  const result = await resultPromise;
  assert.deepEqual(result, { accepted: false, stale: true, elapsedMs: 1 });
  assert.deepEqual(events, ['busy:true', 'busy:false']);
});

test('worker error propagates through dispatch error handling and releases current generation busy', async () => {
  const { runtime, worker } = runtimeHarness();
  const events: string[] = [];

  const resultPromise = dispatchProductAction(productState(), 4, undefined, {
    action: (action, data) => runtime.action(action, data),
    present: async () => { events.push('present'); },
    now: () => 50,
    generation: () => 7,
    setBusy: value => events.push(`busy:${value}`),
    onError: (error, generation) => events.push(`error:${(error as Error).message}:${generation}`),
  });

  worker.emitMessage({ id: 1, error: 'synthetic worker failure' });

  await assert.rejects(resultPromise, /synthetic worker failure/);
  assert.deepEqual(events, [
    'busy:true',
    'busy:false',
    'error:synthetic worker failure:7',
  ]);
});

test('generation change during presentation keeps ownership with the newer selection', async () => {
  const { runtime, worker } = runtimeHarness();
  const events: string[] = [];
  let generation = 11;

  const resultPromise = dispatchProductAction(productState(), 1, undefined, {
    action: (action, data) => runtime.action(action, data),
    present: async () => {
      events.push('present:start');
      generation = 12;
      events.push('present:new-generation');
    },
    now: (() => { let value = 100; return () => value++; })(),
    generation: () => generation,
    setBusy: value => events.push(`busy:${value}`),
  });

  worker.emitMessage({ id: 1, result: { ...observation(), code: 'CASC' } });

  const result = await resultPromise;
  assert.deepEqual(result, { accepted: false, stale: true, elapsedMs: 1 });
  assert.deepEqual(events, [
    'busy:true',
    'present:start',
    'present:new-generation',
  ]);
});
