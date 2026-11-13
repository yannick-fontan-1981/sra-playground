import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BrowserGameRuntime,
  type GameObservation,
} from '../src/runtime/browser-games.ts';

class FakeWorker {
  readonly posted: Array<{ id: number; request: unknown }> = [];
  terminated = false;
  private readonly listeners = new Map<string, Array<(event: any) => void>>();

  addEventListener(type: string, listener: (event: any) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  postMessage(message: { id: number; request: unknown }): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  respond(id: number, observation: GameObservation): void {
    for (const listener of this.listeners.get('message') ?? []) {
      listener({ data: { id, result: { ...observation, code: observation.gameCode } } });
    }
  }
}

function observation(marker: number, code = 'TEST'): GameObservation {
  return {
    gameCode: code,
    frame: [[marker]],
    frames: [[[marker]]],
    state: 'NOT_FINISHED',
    availableActionIds: [1, 2, 3, 4, 5, 6],
    canUndo: marker > 0,
    canSelectLevel: false,
    level: 1,
    levelCount: 1,
    levelsCompleted: 0,
    defaultFps: 5,
  };
}

function runtimeHarness() {
  const worker = new FakeWorker();
  const runtime = new BrowserGameRuntime({
    workerFactory: () => worker as unknown as Worker,
    requestTimeoutMs: 60_000,
  });
  return { runtime, worker };
}

async function turn(): Promise<void> {
  await new Promise<void>(resolve => setImmediate(resolve));
}

test('settled command journal replays into a fresh worker and validates every observation', async () => {
  const original = runtimeHarness();
  const load = original.runtime.load('TEST');
  original.worker.respond(1, observation(0));
  await load;
  const action = original.runtime.action(1);
  original.worker.respond(2, observation(1));
  await action;

  const checkpoint = original.runtime.snapshot();
  assert.equal(checkpoint.entries.length, 2);
  assert.equal(checkpoint.pending, null);
  assert.deepEqual(checkpoint.entries.map(entry => entry.request.type), ['load', 'action']);

  const restored = runtimeHarness();
  const replay = restored.runtime.restore(checkpoint);
  await turn();
  assert.deepEqual(restored.worker.posted[0], {
    id: 1,
    request: { type: 'load', code: 'TEST' },
  });
  restored.worker.respond(1, observation(0));
  await turn();
  assert.deepEqual(restored.worker.posted[1], {
    id: 2,
    request: { type: 'action', actionId: 1 },
  });
  restored.worker.respond(2, observation(1));

  const result = await replay;
  assert.equal(result.replayedEntries, 2);
  assert.equal(result.replayedPending, false);
  assert.deepEqual(result.observation.frame, [[1]]);
  assert.equal(restored.runtime.snapshot().entries.length, 2);
  original.runtime.dispose();
  restored.runtime.dispose();
});

test('replay aborts and terminates the reconstructed worker on the first divergence', async () => {
  const original = runtimeHarness();
  const load = original.runtime.load('TEST');
  original.worker.respond(1, observation(0));
  await load;
  const checkpoint = original.runtime.snapshot();

  const restored = runtimeHarness();
  const replay = restored.runtime.restore(checkpoint);
  await turn();
  restored.worker.respond(1, observation(9));

  await assert.rejects(replay, /diverged at journal sequence 1/);
  assert.equal(restored.worker.terminated, true);
  assert.throws(() => restored.runtime.snapshot(), /no deterministic journal/);
  original.runtime.dispose();
  restored.runtime.dispose();
});

test('one physically issued pending request is replayed exactly once after reconstruction', async () => {
  const original = runtimeHarness();
  const load = original.runtime.load('TEST');
  original.worker.respond(1, observation(0));
  await load;

  const pendingAction = original.runtime.action(6, { x: 32, y: 26 });
  const checkpoint = original.runtime.snapshot();
  assert.deepEqual(checkpoint.pending, {
    sequence: 2,
    request: { type: 'action', actionId: 6, data: { x: 32, y: 26 } },
  });

  const restored = runtimeHarness();
  const replay = restored.runtime.restore(checkpoint);
  await turn();
  restored.worker.respond(1, observation(0));
  await turn();
  assert.equal(restored.worker.posted.length, 2);
  assert.deepEqual(restored.worker.posted[1], {
    id: 2,
    request: { type: 'action', actionId: 6, data: { x: 32, y: 26 } },
  });
  restored.worker.respond(2, observation(1));

  const result = await replay;
  assert.equal(result.replayedEntries, 1);
  assert.equal(result.replayedPending, true);
  assert.deepEqual(result.observation.frame, [[1]]);
  assert.equal(restored.runtime.snapshot().pending, null);
  assert.equal(restored.runtime.snapshot().entries.length, 2);

  original.runtime.dispose();
  await assert.rejects(pendingAction, /session was closed/);
  restored.runtime.dispose();
});

test('concurrent mutation requests invalidate the journal instead of inventing an order', async () => {
  const { runtime, worker } = runtimeHarness();
  const load = runtime.load('TEST');
  worker.respond(1, observation(0));
  await load;

  const first = runtime.action(1);
  const second = runtime.action(2);
  assert.throws(() => runtime.snapshot(), /no deterministic journal/);

  worker.respond(2, observation(1));
  worker.respond(3, observation(2));
  await Promise.all([first, second]);
  runtime.dispose();
});