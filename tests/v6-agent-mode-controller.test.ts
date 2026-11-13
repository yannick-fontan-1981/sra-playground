import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProductReadinessState } from '../src/agent-product-dispatch.ts';
import {
  PROTOCOL_VERSION,
  type AgentObservation,
} from '../src/runtime/contracts.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import {
  type BrowserCampaignDispatchPorts,
  type BrowserCampaignHostResult,
  type BrowserCampaignSessionInput,
} from '../src/runtime/v6-browser-common-campaign-host.ts';
import {
  V6AgentModeController,
  isTerminalGameObservation,
  type AgentModeBrowserHost,
} from '../src/runtime/v6-agent-mode-controller.ts';

function gameObservation(
  state = 'NOT_FINISHED',
  overrides: Partial<GameObservation> = {},
): GameObservation {
  return {
    gameCode: 'TEST',
    frame: Array.from({ length: 64 }, () => Array(64).fill(3)),
    frames: [],
    state,
    availableActionIds: [1],
    canUndo: false,
    canSelectLevel: false,
    level: 1,
    levelCount: 1,
    levelsCompleted: state === 'WIN' ? 1 : 0,
    defaultFps: 5,
    ...overrides,
  };
}

function agentObservation(
  sessionId: string,
  sequence = 0,
  state: AgentObservation['state'] = 'NOT_FINISHED',
): AgentObservation {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId,
    sequence,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels: new Uint8Array(64 * 64),
    },
    availableActionIds: [1],
    state,
    level: 1,
    levelsCompleted: state === 'WIN' ? 1 : 0,
  };
}

function productState(
  observation: GameObservation,
  overrides: Partial<ProductReadinessState> = {},
): ProductReadinessState {
  return {
    observation,
    selectedGameCode: observation.gameCode,
    busy: false,
    loading: false,
    failed: false,
    ...overrides,
  };
}

function statusResult(
  status: Exclude<BrowserCampaignHostResult['status'], 'action'>,
  reason?: BrowserCampaignHostResult['reason'],
): BrowserCampaignHostResult {
  return {
    status,
    ...(reason ? { reason } : {}),
    preparation: null,
    dispatch: null,
    acquisition: null,
    returnedObservation: null,
  };
}

function actionResult(
  returnedState: AgentObservation['state'] = 'NOT_FINISHED',
): BrowserCampaignHostResult {
  return {
    status: 'action',
    preparation: null,
    dispatch: { accepted: true, stale: false, elapsedMs: 1 },
    acquisition: null,
    returnedObservation: agentObservation('session', 1, returnedState),
  } as unknown as BrowserCampaignHostResult;
}

type RunStep = BrowserCampaignHostResult | ((
  state: ProductReadinessState,
  ports: BrowserCampaignDispatchPorts,
) => Promise<BrowserCampaignHostResult>);

class FakeBrowserHost implements AgentModeBrowserHost {
  readonly beginCalls: BrowserCampaignSessionInput[] = [];
  runCalls = 0;
  cancelCalls = 0;
  disposeCalls = 0;
  activeSession: string | null = null;

  constructor(readonly steps: RunStep[] = []) {}

  begin(input: BrowserCampaignSessionInput): AgentObservation {
    this.beginCalls.push(input);
    this.activeSession = input.sessionId;
    return agentObservation(
      input.sessionId,
      input.initialSequence ?? 0,
      input.observation.state === 'WIN' ? 'WIN' : 'NOT_FINISHED',
    );
  }

  async run(
    state: ProductReadinessState,
    ports: BrowserCampaignDispatchPorts,
  ): Promise<BrowserCampaignHostResult> {
    this.runCalls += 1;
    const step = this.steps.shift() ?? statusResult('none');
    return typeof step === 'function' ? step(state, ports) : step;
  }

  cancel(): boolean {
    this.cancelCalls += 1;
    const active = this.activeSession !== null;
    this.activeSession = null;
    return active;
  }

  dispose(): void {
    this.disposeCalls += 1;
    this.activeSession = null;
  }
}

function dispatchPorts(
  busyEvents: boolean[] = [],
  generation: () => number = () => 1,
): BrowserCampaignDispatchPorts {
  return {
    action: async () => gameObservation(),
    present: async () => {},
    now: () => 0,
    generation,
    setBusy: value => busyEvents.push(value),
  };
}

function controller(host: AgentModeBrowserHost, maxSteps = 8): V6AgentModeController {
  return new V6AgentModeController({
    seam: 'browser-common-campaign',
    host,
    maxSteps,
  });
}

test('controller owns one explicit browser seam and stops on none without fallback', async () => {
  const host = new FakeBrowserHost([actionResult(), statusResult('none')]);
  const owner = controller(host);
  const current = gameObservation();
  const first = owner.begin({ sessionId: 'agent-session', observation: current });
  assert.equal(first.sessionId, 'agent-session');
  assert.equal(owner.seam, 'browser-common-campaign');

  const result = await owner.runUntilStop({
    state: () => productState(current),
    ports: dispatchPorts(),
  });

  assert.equal(result.status, 'stopped');
  assert.equal(result.reason, 'none');
  assert.equal(result.steps, 1);
  assert.equal(host.runCalls, 2);
  assert.equal(host.cancelCalls, 1);
  assert.equal(owner.phase, 'stopped');
  assert.equal(owner.sessionId, null);
});

test('controller enforces its hard campaign action bound', async () => {
  const host = new FakeBrowserHost([
    actionResult(),
    actionResult(),
    actionResult(),
  ]);
  const owner = controller(host, 2);
  const current = gameObservation();
  owner.begin({ sessionId: 'bounded-session', observation: current });

  const result = await owner.runUntilStop({
    state: () => productState(current),
    ports: dispatchPorts(),
  });

  assert.equal(result.reason, 'max-steps');
  assert.equal(result.steps, 2);
  assert.equal(host.runCalls, 2);
});

test('a second run cannot start while the selected seam already owns the campaign', async () => {
  let resolveRun!: (result: BrowserCampaignHostResult) => void;
  const pending = new Promise<BrowserCampaignHostResult>(resolve => {
    resolveRun = resolve;
  });
  const busyEvents: boolean[] = [];
  const host = new FakeBrowserHost([
    async (_state, ports) => {
      ports.setBusy(true);
      return pending;
    },
  ]);
  const owner = controller(host);
  const current = gameObservation();
  owner.begin({ sessionId: 'single-owner-session', observation: current });

  const first = owner.runUntilStop({
    state: () => productState(current),
    ports: dispatchPorts(busyEvents),
  });
  await Promise.resolve();

  const duplicate = await owner.runUntilStop({
    state: () => productState(current),
    ports: dispatchPorts(),
  });
  assert.equal(duplicate.status, 'busy');
  assert.equal(host.runCalls, 1);

  assert.equal(owner.stop('manual'), true);
  resolveRun(actionResult());
  const stopped = await first;
  assert.equal(stopped.reason, 'manual');
  assert.deepEqual(busyEvents, [true, false]);
});

test('manual cancellation does not release busy state owned by a newer game generation', async () => {
  let resolveRun!: (result: BrowserCampaignHostResult) => void;
  const pending = new Promise<BrowserCampaignHostResult>(resolve => {
    resolveRun = resolve;
  });
  const busyEvents: boolean[] = [];
  let generation = 4;
  const host = new FakeBrowserHost([
    async (_state, ports) => {
      ports.setBusy(true);
      return pending;
    },
  ]);
  const owner = controller(host);
  const current = gameObservation();
  owner.begin({ sessionId: 'old-generation', observation: current });

  const running = owner.runUntilStop({
    state: () => productState(current),
    ports: dispatchPorts(busyEvents, () => generation),
  });
  await Promise.resolve();
  owner.stop('game-change');
  generation = 5;
  resolveRun(actionResult());

  const stopped = await running;
  assert.equal(stopped.reason, 'game-change');
  assert.deepEqual(busyEvents, [true]);
});

test('terminal product state stops before asking the host for another action', async () => {
  const host = new FakeBrowserHost([actionResult()]);
  const owner = controller(host);
  const complete = gameObservation('WIN');
  owner.begin({ sessionId: 'complete-session', observation: complete });

  const result = await owner.runUntilStop({
    state: () => productState(complete),
    ports: dispatchPorts(),
  });

  assert.equal(result.reason, 'complete');
  assert.equal(result.steps, 0);
  assert.equal(host.runCalls, 0);
});

test('waiting keeps the same session ready for an explicit retry', async () => {
  const host = new FakeBrowserHost([
    statusResult('not-ready', 'product-not-ready'),
    statusResult('none'),
  ]);
  const owner = controller(host);
  const current = gameObservation();
  owner.begin({ sessionId: 'waiting-session', observation: current });

  const waiting = await owner.runUntilStop({
    state: () => productState(current),
    ports: dispatchPorts(),
  });
  assert.equal(waiting.status, 'waiting');
  assert.equal(waiting.reason, 'product-not-ready');
  assert.equal(owner.phase, 'ready');
  assert.equal(owner.sessionId, 'waiting-session');

  const retried = await owner.runUntilStop({
    state: () => productState(current),
    ports: dispatchPorts(),
  });
  assert.equal(retried.reason, 'none');
  assert.equal(host.runCalls, 2);
});

test('a redundant stop cannot overwrite the owner that actually ended the session', () => {
  const host = new FakeBrowserHost();
  const owner = controller(host);
  owner.begin({ sessionId: 'reason-session', observation: gameObservation() });

  assert.equal(owner.stop('game-change'), true);
  assert.equal(owner.stop('manual'), false);
  assert.equal(owner.stopReason, 'game-change');
  assert.equal(owner.phase, 'stopped');
  assert.equal(host.cancelCalls, 1);
});

test('errors stop the selected seam and disposal prevents another session', async () => {
  const failure = new Error('host failed');
  const host = new FakeBrowserHost([
    async () => { throw failure; },
  ]);
  const owner = controller(host);
  const current = gameObservation();
  owner.begin({ sessionId: 'failure-session', observation: current });

  const result = await owner.runUntilStop({
    state: () => productState(current),
    ports: dispatchPorts(),
  });
  assert.equal(result.reason, 'error');
  assert.equal(result.error, failure);
  assert.equal(host.cancelCalls, 1);

  owner.dispose();
  assert.equal(owner.phase, 'disposed');
  assert.equal(host.disposeCalls, 1);
  const disposed = await owner.runUntilStop({
    state: () => productState(current),
    ports: dispatchPorts(),
  });
  assert.equal(disposed.status, 'disposed');
  assert.throws(
    () => owner.begin({ sessionId: 'late-session', observation: current }),
    /disposed/,
  );
});

test('terminal helper recognizes completion and game-over states only', () => {
  assert.equal(isTerminalGameObservation(gameObservation('WIN')), true);
  assert.equal(isTerminalGameObservation(gameObservation('LEVEL_COMPLETE')), true);
  assert.equal(isTerminalGameObservation(gameObservation('GAME_OVER')), true);
  assert.equal(isTerminalGameObservation(gameObservation('GAMEOVER')), true);
  assert.equal(isTerminalGameObservation(gameObservation('NOT_FINISHED')), false);
  assert.equal(isTerminalGameObservation(null), false);
});
