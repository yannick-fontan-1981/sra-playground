import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProductReadinessState } from '../src/agent-product-dispatch.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import type { BrowserCampaignHostResult } from '../src/runtime/v6-browser-common-campaign-host.ts';
import {
  BROWSER_AGENT_CONTROLLER_STATUS,
  BrowserAgentController,
  type BrowserAgentCampaignHost,
  type BrowserAgentControllerPorts,
} from '../src/runtime/v6-browser-agent-controller.ts';

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

function noAction(
  status: 'none' | 'ambiguous' | 'pending' | 'blocked' = 'none',
): BrowserCampaignHostResult {
  const preparation = status === 'none'
    ? { status: 'none', proposals: [] }
    : status === 'ambiguous'
      ? { status: 'ambiguous', proposals: [] }
      : status === 'pending'
        ? { status: 'pending', needId: 'need', ownerId: 'owner', proposalRef: 'proposal', action: { id: 1 } }
        : { status: 'blocked', need: { status: 'blocked' }, proposals: [] };
  return {
    status,
    preparation: preparation as BrowserCampaignHostResult['preparation'],
    dispatch: null,
    acquisition: null,
    returnedObservation: null,
  };
}

function controlledPorts(
  initial: GameObservation,
  onAction: (action: number, data?: { x: number; y: number }) => Promise<GameObservation>,
  events: string[] = [],
): {
  ports: BrowserAgentControllerPorts;
  current(): GameObservation;
} {
  let current = initial;
  let busy = false;
  let clock = 0;
  return {
    current: () => current,
    ports: {
      readState: () => productState(current, busy),
      action: async (action, data) => {
        events.push(`action:${action}:${JSON.stringify(data)}`);
        return onAction(action, data);
      },
      present: async next => {
        events.push(`present:${next.availableActionIds.join(',')}`);
        current = next;
      },
      now: () => clock++,
      generation: () => 1,
      setBusy: value => {
        busy = value;
        events.push(`busy:${value}`);
      },
      yieldToBrowser: async () => {
        events.push('yield');
      },
    },
  };
}

test('controller exposes one explicit browser seam and no default action policy', () => {
  assert.deepEqual(BROWSER_AGENT_CONTROLLER_STATUS, {
    available: true,
    name: 'SRA',
    status: 'bounded-browser-common-campaign',
    seam: 'browser-common-campaign',
  });
});

test('qualified OP28 browser host dispatches once then stops when the next observation is ambiguous', async () => {
  const initial = observation([1]);
  const returned = observation([1, 2]);
  const events: string[] = [];
  const harness = controlledPorts(initial, async () => returned, events);
  const snapshots: string[] = [];
  const controller = new BrowserAgentController({
    makeSessionId: () => 'controller-session',
    onStateChange: snapshot => snapshots.push(`${snapshot.phase}:${snapshot.stopReason ?? ''}:${snapshot.actionsDispatched}`),
  });

  const result = await controller.activate(initial, harness.ports);

  assert.equal(result.phase, 'stopped');
  assert.equal(result.stopReason, 'none');
  assert.equal(result.actionsDispatched, 1);
  assert.equal(result.campaignStatus, 'none');
  assert.equal(harness.current(), returned);
  assert.deepEqual(events, [
    'busy:true',
    'action:1:undefined',
    'present:1,2',
    'busy:false',
    'yield',
  ]);
  assert.equal(snapshots[0], 'running::0');
  assert.equal(snapshots.at(-1), 'stopped:none:1');
});

test('a second activation while one campaign is in flight reuses the same run', async () => {
  const initial = observation([1]);
  let resolveRun!: (result: BrowserCampaignHostResult) => void;
  const pending = new Promise<BrowserCampaignHostResult>(resolve => { resolveRun = resolve; });
  let beginCalls = 0;
  let runCalls = 0;
  let disposeCalls = 0;
  const host = {
    currentGameObservation: initial,
    begin: () => { beginCalls += 1; return {} as never; },
    run: async () => { runCalls += 1; return pending; },
    cancel: () => false,
    dispose: () => { disposeCalls += 1; },
  } as BrowserAgentCampaignHost;
  const harness = controlledPorts(initial, async () => { throw new Error('must not dispatch'); });
  const controller = new BrowserAgentController({ createHost: () => host });

  const first = controller.activate(initial, harness.ports);
  const second = controller.activate(initial, harness.ports);
  assert.equal(first, second);
  assert.equal(beginCalls, 1);
  assert.equal(runCalls, 1);

  resolveRun(noAction());
  const result = await first;
  assert.equal(result.stopReason, 'none');
  assert.equal(disposeCalls, 1);
});

test('Manual mode request waits for an in-flight campaign result before disposing ownership', async () => {
  const initial = observation([1]);
  let resolveRun!: (result: BrowserCampaignHostResult) => void;
  const pending = new Promise<BrowserCampaignHostResult>(resolve => { resolveRun = resolve; });
  let disposeCalls = 0;
  const host = {
    currentGameObservation: initial,
    begin: () => ({} as never),
    run: async () => pending,
    cancel: () => false,
    dispose: () => { disposeCalls += 1; },
  } as BrowserAgentCampaignHost;
  const harness = controlledPorts(initial, async () => { throw new Error('must not dispatch'); });
  const controller = new BrowserAgentController({ createHost: () => host });

  const running = controller.activate(initial, harness.ports);
  const stopping = controller.deactivate('manual');
  assert.equal(stopping.phase, 'stopping');
  assert.equal(stopping.stopReason, 'manual');
  assert.equal(disposeCalls, 0);

  resolveRun(noAction());
  const stopped = await running;
  assert.equal(stopped.phase, 'stopped');
  assert.equal(stopped.stopReason, 'manual');
  assert.equal(disposeCalls, 1);
});

test('ambiguous or blocked symbolic results stop without dispatching a fallback action', async () => {
  for (const status of ['ambiguous', 'blocked'] as const) {
    const initial = observation([1, 2]);
    let actions = 0;
    const host = {
      currentGameObservation: initial,
      begin: () => ({} as never),
      run: async () => noAction(status),
      cancel: () => false,
      dispose: () => {},
    } as BrowserAgentCampaignHost;
    const harness = controlledPorts(initial, async () => {
      actions += 1;
      return initial;
    });
    const controller = new BrowserAgentController({ createHost: () => host });

    const result = await controller.activate(initial, harness.ports);
    assert.equal(result.stopReason, status);
    assert.equal(actions, 0);
  }
});

test('terminal and stale initial observations never create a campaign host', async () => {
  let created = 0;
  const createHost = (): BrowserAgentCampaignHost => {
    created += 1;
    throw new Error('host must not be created');
  };

  const terminalObservation = observation([1], { state: 'WIN' });
  const terminalHarness = controlledPorts(terminalObservation, async () => terminalObservation);
  const terminalController = new BrowserAgentController({ createHost });
  assert.equal((await terminalController.activate(terminalObservation, terminalHarness.ports)).stopReason, 'terminal');

  const current = observation([1]);
  const copied = observation([1]);
  const staleController = new BrowserAgentController({ createHost });
  const stalePorts: BrowserAgentControllerPorts = {
    readState: () => productState(copied),
    action: async () => copied,
    present: async () => {},
    now: () => 0,
    generation: () => 0,
    setBusy: () => {},
  };
  assert.equal((await staleController.activate(current, stalePorts)).stopReason, 'stale');
  assert.equal(created, 0);
});

test('hard action bound stops a continuing unique-action campaign', async () => {
  const initial = observation([1]);
  let actions = 0;
  const harness = controlledPorts(initial, async () => {
    actions += 1;
    return observation([1]);
  });
  const controller = new BrowserAgentController({ maxActions: 2 });

  const result = await controller.activate(initial, harness.ports);
  assert.equal(result.stopReason, 'action-limit');
  assert.equal(result.actionsDispatched, 2);
  assert.equal(actions, 2);
});

test('host failure becomes an explicit error stop and is reported once', async () => {
  const initial = observation([1]);
  const errors: unknown[] = [];
  let disposeCalls = 0;
  const host = {
    currentGameObservation: initial,
    begin: () => ({} as never),
    run: async () => { throw new Error('synthetic host failure'); },
    cancel: () => false,
    dispose: () => { disposeCalls += 1; },
  } as BrowserAgentCampaignHost;
  const harness = controlledPorts(initial, async () => initial);
  const controller = new BrowserAgentController({
    createHost: () => host,
    onError: error => errors.push(error),
  });

  const result = await controller.activate(initial, harness.ports);
  assert.equal(result.phase, 'error');
  assert.equal(result.stopReason, 'error');
  assert.equal(disposeCalls, 1);
  assert.equal(errors.length, 1);
  assert.match(String(errors[0]), /synthetic host failure/);
});
