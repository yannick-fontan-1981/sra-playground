import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProductReadinessState } from '../src/agent-product-dispatch.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import {
  BrowserAgentController,
  type BrowserAgentControllerPorts,
} from '../src/runtime/v6-browser-agent-controller.ts';
import {
  createPublicSingleActionBrowserCampaignHost,
} from '../src/runtime/v6-browser-common-campaign-host.ts';

function observation(
  availableActionIds: number[] = [1],
  overrides: Partial<GameObservation> = {},
): GameObservation {
  return {
    gameCode: 'TEST',
    frame: Array.from({ length: 64 }, () => Array(64).fill(3)),
    frames: [],
    state: 'NOT_FINISHED',
    availableActionIds,
    canUndo: false,
    canSelectLevel: false,
    level: 1,
    levelCount: 1,
    levelsCompleted: 0,
    defaultFps: 5,
    ...overrides,
  };
}

function productState(current: GameObservation, busy = false): ProductReadinessState {
  return {
    observation: current,
    selectedGameCode: current.gameCode,
    busy,
    loading: false,
    failed: false,
  };
}

function portsHarness(
  initial: GameObservation,
  action: (id: number, data?: { x: number; y: number }) => Promise<GameObservation>,
): {
  ports: BrowserAgentControllerPorts;
  current(): GameObservation;
  actions(): number;
} {
  let current = initial;
  let busy = false;
  let actions = 0;
  let clock = 0;
  return {
    current: () => current,
    actions: () => actions,
    ports: {
      readState: () => productState(current, busy),
      action: async (id, data) => {
        actions += 1;
        return action(id, data);
      },
      present: async next => { current = next; },
      now: () => clock++,
      generation: () => 1,
      setBusy: value => { busy = value; },
      yieldToBrowser: async () => {},
    },
  };
}

test('host resumes a dispatched pending return without replaying the physical action', async () => {
  const initial = observation([1]);
  const returned = observation([1, 2], {
    frame: Array.from({ length: 64 }, (_, y) =>
      Array.from({ length: 64 }, (_, x) => x === 2 && y === 3 ? 8 : 3),
    ),
  });
  const original = createPublicSingleActionBrowserCampaignHost();
  original.begin({ sessionId: 'resume-pending', observation: initial });

  let resolveReturn!: (value: GameObservation) => void;
  let markDispatched!: () => void;
  const dispatched = new Promise<void>(resolve => { markDispatched = resolve; });
  const pendingReturn = new Promise<GameObservation>(resolve => { resolveReturn = resolve; });
  const originalRun = original.run(productState(initial), {
    action: async () => {
      markDispatched();
      return pendingReturn;
    },
    present: async () => {},
    now: (() => { let value = 0; return () => value++; })(),
    generation: () => 1,
    setBusy: () => {},
  });
  await dispatched;
  const checkpoint = original.snapshot();
  const needId = checkpoint.session?.pendingReturn?.preparation.needId;
  assert.ok(needId);

  resolveReturn(returned);
  await originalRun;

  const restored = createPublicSingleActionBrowserCampaignHost();
  restored.restore(checkpoint, returned);
  let replayed = 0;
  const resumed = await restored.run(productState(returned), {
    action: async () => {
      replayed += 1;
      return returned;
    },
    present: async () => { throw new Error('already-live return must not be presented again'); },
    now: () => 0,
    generation: () => 1,
    setBusy: () => {},
  });

  assert.equal(resumed.status, 'resumed');
  assert.equal(resumed.acquisition?.needId, needId);
  assert.equal(resumed.acquisition?.routed, true);
  assert.equal(replayed, 0);
  assert.equal(restored.currentAgentObservation?.sequence, 1);
  assert.equal(restored.currentGameObservation, returned);
});

test('restored pending return remains pending while the live observation has not advanced', async () => {
  const initial = observation([1]);
  const original = createPublicSingleActionBrowserCampaignHost();
  original.begin({ sessionId: 'resume-wait', observation: initial });

  let resolveReturn!: (value: GameObservation) => void;
  let markDispatched!: () => void;
  const dispatched = new Promise<void>(resolve => { markDispatched = resolve; });
  const pendingReturn = new Promise<GameObservation>(resolve => { resolveReturn = resolve; });
  const originalRun = original.run(productState(initial), {
    action: async () => {
      markDispatched();
      return pendingReturn;
    },
    present: async () => {},
    now: (() => { let value = 0; return () => value++; })(),
    generation: () => 1,
    setBusy: () => {},
  });
  await dispatched;
  const checkpoint = original.snapshot();

  const restored = createPublicSingleActionBrowserCampaignHost();
  restored.restore(checkpoint, initial);
  let replayed = 0;
  const waiting = await restored.run(productState(initial), {
    action: async () => {
      replayed += 1;
      return initial;
    },
    present: async () => {},
    now: () => 0,
    generation: () => 1,
    setBusy: () => {},
  });
  assert.equal(waiting.status, 'pending');
  assert.equal(replayed, 0);

  resolveReturn(observation([1, 2]));
  await originalRun;
});

test('controller recreates a fresh host and restores the same settled campaign session', async () => {
  const initial = observation([1]);
  const returned = observation([1, 2]);
  const hosts: ReturnType<typeof createPublicSingleActionBrowserCampaignHost>[] = [];
  const harness = portsHarness(initial, async () => returned);
  const controller = new BrowserAgentController({
    createHost: () => {
      const host = createPublicSingleActionBrowserCampaignHost();
      hosts.push(host);
      return host;
    },
    makeSessionId: () => 'controller-resume-session',
  });

  const first = await controller.activate(initial, harness.ports);
  assert.equal(first.stopReason, 'none');
  assert.equal(first.actionsDispatched, 1);
  assert.equal(harness.actions(), 1);
  assert.equal(hosts.length, 1);
  const checkpoint = controller.retainedCheckpoint();
  assert.equal(checkpoint?.host.session?.sessionId, 'controller-resume-session');

  const second = await controller.activate(returned, harness.ports);
  assert.equal(second.stopReason, 'none');
  assert.equal(second.sessionId, 'controller-resume-session');
  assert.equal(second.actionsDispatched, 1);
  assert.equal(harness.actions(), 1);
  assert.equal(hosts.length, 2);
});

test('controller rejects a stale checkpoint and starts a new session from the live observation', async () => {
  const initial = observation([1]);
  const returned = observation([1, 2]);
  const changed = observation([2], {
    frame: Array.from({ length: 64 }, (_, y) =>
      Array.from({ length: 64 }, (_, x) => x === 1 && y === 1 ? 9 : 3),
    ),
  });
  const rejected: unknown[] = [];
  let sessionOrdinal = 0;
  const firstHarness = portsHarness(initial, async () => returned);
  const controller = new BrowserAgentController({
    createHost: () => createPublicSingleActionBrowserCampaignHost(),
    makeSessionId: (_current, ordinal) => {
      sessionOrdinal = ordinal;
      return `fresh-session:${ordinal}`;
    },
    onCheckpointRejected: error => rejected.push(error),
  });

  await controller.activate(initial, firstHarness.ports);
  assert.ok(controller.retainedCheckpoint());

  const secondHarness = portsHarness(changed, async () => observation([2, 3]));
  const result = await controller.activate(changed, secondHarness.ports);
  assert.equal(rejected.length, 1);
  assert.equal(sessionOrdinal, 2);
  assert.equal(result.sessionId, 'fresh-session:2');
  assert.equal(secondHarness.actions(), 1);
});
