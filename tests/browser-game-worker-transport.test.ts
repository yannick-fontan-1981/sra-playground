import assert from 'node:assert/strict';
import test from 'node:test';
import { BrowserGameRuntime } from '../src/runtime/browser-games.ts';

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

function result(code = 'CASC') {
  return {
    code,
    frame: [[0]],
    frames: [[[0]]],
    state: 'NOT_FINISHED',
    availableActionIds: [1, 2, 3, 4, 5, 6],
    canUndo: true,
    canSelectLevel: false,
    level: 1,
    levelCount: 1,
    levelsCompleted: 0,
    defaultFps: 10,
  };
}

function harness() {
  const worker = new FakeWorker();
  const timers: Array<{ callback: () => void; cleared: boolean; delayMs: number }> = [];
  const runtime = new BrowserGameRuntime({
    workerFactory: () => worker as unknown as Worker,
    setTimer: (callback, delayMs) => {
      const timer = { callback, cleared: false, delayMs };
      timers.push(timer);
      return timer as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: timeout => {
      (timeout as unknown as { cleared: boolean }).cleared = true;
    },
    requestTimeoutMs: 321,
  });
  return { runtime, worker, timers };
}

test('runtime sends an id-correlated worker envelope and normalizes code to gameCode', async () => {
  const { runtime, worker, timers } = harness();
  const pending = runtime.action(6, { x: 0, y: 5 });

  assert.deepEqual(worker.posted, [{
    id: 1,
    request: { type: 'action', actionId: 6, data: { x: 0, y: 5 } },
  }]);
  assert.equal(timers[0]?.delayMs, 321);

  worker.emitMessage({ id: 1, result: result('CASC') });
  const observation = await pending;

  assert.equal(observation.gameCode, 'CASC');
  assert.equal(timers[0]?.cleared, true);
});

test('responses resolve only the matching request id even when returned out of order', async () => {
  const { runtime, worker } = harness();
  const first = runtime.action(1);
  const second = runtime.action(2);

  let firstResolved = false;
  void first.then(() => { firstResolved = true; });

  worker.emitMessage({ id: 2, result: result('SECOND') });
  assert.equal((await second).gameCode, 'SECOND');
  await Promise.resolve();
  assert.equal(firstResolved, false);

  worker.emitMessage({ id: 999, result: result('IGNORED') });
  await Promise.resolve();
  assert.equal(firstResolved, false);

  worker.emitMessage({ id: 1, result: result('FIRST') });
  assert.equal((await first).gameCode, 'FIRST');
});

test('worker error payload rejects only its matching pending request', async () => {
  const { runtime, worker, timers } = harness();
  const pending = runtime.action(4);

  worker.emitMessage({ id: 1, error: 'synthetic failure' });

  await assert.rejects(pending, /synthetic failure/);
  assert.equal(timers[0]?.cleared, true);
  assert.equal(worker.terminated, false);
});

test('invalid worker response rejects the matching pending request', async () => {
  const { runtime, worker } = harness();
  const pending = runtime.action(5);

  worker.emitMessage({ id: 1 });

  await assert.rejects(pending, /invalid response/);
});

test('worker transport errors reject all pending requests and terminate the failed worker', async () => {
  const { runtime, worker, timers } = harness();
  const first = runtime.action(1);
  const second = runtime.action(2);

  worker.emit('messageerror');

  await assert.rejects(first, /could not be read/);
  await assert.rejects(second, /could not be read/);
  assert.equal(worker.terminated, true);
  assert.equal(timers.every(timer => timer.cleared), true);
});

test('request timeout rejects pending work, terminates the worker and ignores a late response', async () => {
  const { runtime, worker, timers } = harness();
  const pending = runtime.action(3);

  timers[0]?.callback();

  await assert.rejects(pending, /Loading took too long/);
  assert.equal(worker.terminated, true);

  worker.emitMessage({ id: 1, result: result('TOO_LATE') });
  await Promise.resolve();
});
