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
  marker = 0,
): GameObservation {
  return {
    gameCode: 'TEST',
    frame: Array.from({ length: 64 }, (_, y) =>
      Array.from({ length: 64 }, (_, x) => x === marker && y === marker ? 8 : 3),
    ),
    frames: [],
    state: 'NOT_FINISHED',
    availableActionIds,
    canUndo: false,
    canSelectLevel: false,
    level: 1,
    levelCount: 1,
    levelsCompleted: 0,
    defaultFps: 5,
  };
}

function state(current: GameObservation, busy: boolean): ProductReadinessState {
  return {
    observation: current,
    selectedGameCode: current.gameCode,
    busy,
    loading: false,
    failed: false,
  };
}

test('controller captures one already-dispatched physical action without double counting', async () => {
  const initial = observation([1], 0);
  const returned = observation([1, 2], 1);
  let current = initial;
  let busy = false;
  let physicalActions = 0;
  let resolveReturn!: (value: GameObservation) => void;
  let markDispatched!: () => void;
  const dispatched = new Promise<void>(resolve => { markDispatched = resolve; });
  const pendingReturn = new Promise<GameObservation>(resolve => { resolveReturn = resolve; });

  const ports: BrowserAgentControllerPorts = {
    readState: () => state(current, busy),
    action: async () => {
      physicalActions += 1;
      markDispatched();
      return pendingReturn;
    },
    present: async next => { current = next; },
    now: (() => { let value = 0; return () => value++; })(),
    generation: () => 1,
    setBusy: value => { busy = value; },
    yieldToBrowser: async () => {},
  };

  const controller = new BrowserAgentController({
    createHost: () => createPublicSingleActionBrowserCampaignHost(),
    makeSessionId: () => 'live-capture-session',
  });
  const run = controller.activate(initial, ports);
  await dispatched;

  const first = controller.captureCheckpoint();
  const second = controller.captureCheckpoint();
  assert.ok(first?.host.session?.pendingReturn);
  assert.ok(second?.host.session?.pendingReturn);
  assert.equal(first.host.session.sessionId, 'live-capture-session');
  assert.equal(first.actionsDispatched, 1);
  assert.equal(first.pendingDispatchCounted, true);
  assert.equal(second.actionsDispatched, 1);
  assert.equal(second.pendingDispatchCounted, true);
  assert.equal(
    first.host.session.pendingReturn.preparation.needId,
    second.host.session.pendingReturn.preparation.needId,
  );
  assert.equal(physicalActions, 1);

  resolveReturn(returned);
  const finished = await run;
  assert.equal(finished.stopReason, 'none');
  assert.equal(finished.actionsDispatched, 1);
  assert.equal(physicalActions, 1);

  const settled = controller.retainedCheckpoint();
  assert.equal(settled?.actionsDispatched, 1);
  assert.equal(settled?.pendingDispatchCounted, false);
  assert.equal(settled?.host.session?.pendingReturn, null);
  controller.dispose();
});