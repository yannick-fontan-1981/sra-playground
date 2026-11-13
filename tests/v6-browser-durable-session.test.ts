import assert from 'node:assert/strict';
import test from 'node:test';
import {
  browserGameRuntimeObservationIdentity,
  type BrowserGameRuntimeCheckpointV1,
  type GameObservation,
} from '../src/runtime/browser-games.ts';
import {
  BrowserDurableSessionStore,
  createBrowserDurableSessionCheckpoint,
} from '../src/runtime/v6-browser-durable-session.ts';
import type {
  BrowserAgentControllerCheckpointV1,
} from '../src/runtime/v6-browser-agent-controller.ts';
import {
  createPublicSingleActionBrowserCampaignHost,
} from '../src/runtime/v6-browser-common-campaign-host.ts';

function observation(overrides: Partial<GameObservation> = {}): GameObservation {
  return {
    gameCode: 'TEST',
    frame: Array.from({ length: 64 }, () => Array(64).fill(3)),
    frames: [],
    state: 'NOT_FINISHED',
    availableActionIds: [1],
    canUndo: false,
    canSelectLevel: false,
    level: 1,
    levelCount: 1,
    levelsCompleted: 0,
    defaultFps: 5,
    ...overrides,
  };
}

function checkpoints(current = observation()): {
  runtime: BrowserGameRuntimeCheckpointV1;
  agent: BrowserAgentControllerCheckpointV1;
} {
  const host = createPublicSingleActionBrowserCampaignHost();
  host.begin({ sessionId: 'durable-session', observation: current });
  return {
    runtime: {
      version: 1,
      gameCode: current.gameCode,
      entries: [{
        sequence: 1,
        request: { type: 'load', code: current.gameCode },
        observationIdentity: browserGameRuntimeObservationIdentity(current),
      }],
      pending: null,
    },
    agent: {
      version: 1,
      host: host.snapshot(),
      actionsDispatched: 0,
      sessionOrdinal: 1,
      pendingDispatchCounted: false,
    },
  };
}

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

test('durable store round-trips the Agent Uint8Array and exact runtime binding', () => {
  const { runtime, agent } = checkpoints();
  const checkpoint = createBrowserDurableSessionCheckpoint({
    runtime,
    agent,
    selectionGeneration: 7,
    mode: 'agent',
    savedAtMs: 1_000,
    ttlMs: 10_000,
  });
  const storage = new MemoryStorage();
  const store = new BrowserDurableSessionStore(storage);

  const saved = store.save(checkpoint);
  assert.equal(saved.status, 'saved');
  const loaded = store.load(2_000, 'TEST');
  assert.equal(loaded.status, 'ready');
  if (loaded.status !== 'ready') return;

  assert.equal(loaded.checkpoint.selectionGeneration, 7);
  assert.equal(loaded.checkpoint.mode, 'agent');
  assert.equal(
    loaded.checkpoint.observationIdentity,
    browserGameRuntimeObservationIdentity(observation()),
  );
  const pixels = loaded.checkpoint.agent.host.session?.agentObservation.image.pixels;
  assert.ok(pixels instanceof Uint8Array);
  assert.equal(pixels.length, 64 * 64);
});

test('expired durable checkpoint is removed instead of being applied', () => {
  const storage = new MemoryStorage();
  const store = new BrowserDurableSessionStore(storage);
  const { runtime, agent } = checkpoints();
  const checkpoint = createBrowserDurableSessionCheckpoint({
    runtime,
    agent,
    selectionGeneration: 1,
    mode: 'manual',
    savedAtMs: 100,
    ttlMs: 50,
  });
  assert.equal(store.save(checkpoint).status, 'saved');

  assert.deepEqual(store.load(151), { status: 'expired' });
  assert.deepEqual(store.load(151), { status: 'empty' });
});

test('checkpoint for another selected game is removed', () => {
  const storage = new MemoryStorage();
  const store = new BrowserDurableSessionStore(storage);
  const { runtime, agent } = checkpoints();
  const checkpoint = createBrowserDurableSessionCheckpoint({
    runtime,
    agent,
    selectionGeneration: 2,
    mode: 'manual',
    savedAtMs: 100,
    ttlMs: 500,
  });
  assert.equal(store.save(checkpoint).status, 'saved');

  assert.deepEqual(store.load(120, 'OTHER'), {
    status: 'game-mismatch',
    gameCode: 'TEST',
  });
  assert.deepEqual(store.load(120, 'OTHER'), { status: 'empty' });
});

test('runtime and Agent observations must have the same public identity', () => {
  const { runtime, agent } = checkpoints();
  runtime.entries[0]!.observationIdentity = 'browser-game-observation:wrong';
  assert.throws(() => createBrowserDurableSessionCheckpoint({
    runtime,
    agent,
    selectionGeneration: 1,
    mode: 'agent',
  }), /different observations/);
});

test('runtime pending request and Agent pending return must agree exactly', async () => {
  const current = observation();
  const host = createPublicSingleActionBrowserCampaignHost();
  host.begin({ sessionId: 'durable-pending', observation: current });

  let markDispatched!: () => void;
  let resolveReturn!: (value: GameObservation) => void;
  const dispatched = new Promise<void>(resolve => { markDispatched = resolve; });
  const returned = new Promise<GameObservation>(resolve => { resolveReturn = resolve; });
  const run = host.run({
    observation: current,
    selectedGameCode: current.gameCode,
    busy: false,
    loading: false,
    failed: false,
  }, {
    action: async () => {
      markDispatched();
      return returned;
    },
    present: async () => {},
    now: () => 0,
    generation: () => 1,
    setBusy: () => {},
  });
  await dispatched;

  const hostCheckpoint = host.snapshot();
  const preparation = hostCheckpoint.session?.pendingReturn?.preparation;
  assert.ok(preparation);
  const runtime: BrowserGameRuntimeCheckpointV1 = {
    version: 1,
    gameCode: current.gameCode,
    entries: [{
      sequence: 1,
      request: { type: 'load', code: current.gameCode },
      observationIdentity: browserGameRuntimeObservationIdentity(current),
    }],
    pending: {
      sequence: 2,
      request: {
        type: 'action',
        actionId: preparation.action.id,
        ...(preparation.action.id === 6 ? { data: preparation.action.data } : {}),
      },
    },
  };
  const agent: BrowserAgentControllerCheckpointV1 = {
    version: 1,
    host: hostCheckpoint,
    actionsDispatched: 0,
    sessionOrdinal: 1,
  };
  const durable = createBrowserDurableSessionCheckpoint({
    runtime,
    agent,
    selectionGeneration: 3,
    mode: 'agent',
  });
  assert.equal(durable.agent.actionsDispatched, 1);
  assert.equal(durable.agent.pendingDispatchCounted, true);

  runtime.pending = {
    sequence: 2,
    request: { type: 'action', actionId: preparation.action.id === 1 ? 2 : 1 },
  };
  assert.throws(() => createBrowserDurableSessionCheckpoint({
    runtime,
    agent,
    selectionGeneration: 3,
    mode: 'agent',
  }), /does not match/);

  resolveReturn(observation({ availableActionIds: [1, 2] }));
  await run;
});

test('oversized checkpoint is rejected and removed', () => {
  const storage = new MemoryStorage();
  const store = new BrowserDurableSessionStore(storage, { maxBytes: 20 });
  const { runtime, agent } = checkpoints();
  const checkpoint = createBrowserDurableSessionCheckpoint({
    runtime,
    agent,
    selectionGeneration: 1,
    mode: 'manual',
  });
  const saved = store.save(checkpoint);
  assert.equal(saved.status, 'too-large');
  assert.equal(storage.values.size, 0);
});