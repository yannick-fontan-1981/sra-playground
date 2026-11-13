import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProductReadinessState } from '../src/agent-product-dispatch.ts';
import { OBSERVED_ADDRESSED_MATERIAL_CHECKPOINT_ID } from '../src/runtime/observed-addressed-material-checkpoint.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import {
  BrowserAgentController,
  type BrowserAgentControllerPorts,
} from '../src/runtime/v6-browser-agent-controller.ts';
import {
  createPublicSingleActionBrowserCampaignHost,
} from '../src/runtime/v6-browser-common-campaign-host.ts';
import {
  createFieldStockAndPublicSingleActionBrowserCampaignHost,
} from '../src/runtime/v6-browser-product-campaign-host.ts';

function observation(
  availableActionIds: number[] = [1],
  fill = 3,
  overrides: Partial<GameObservation> = {},
): GameObservation {
  return {
    gameCode: 'TEST',
    frame: Array.from({ length: 64 }, () => Array(64).fill(fill)),
    frames: [],
    state: 'NOT_FINISHED',
    availableActionIds,
    canUndo: false,
    canSelectLevel: false,
    level: 1,
    levelCount: 3,
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

function hostPorts(
  action: (action: number, data?: { x: number; y: number }) => Promise<GameObservation>,
  present: (observation: GameObservation) => Promise<void> = async () => {},
) {
  let busy = false;
  let clock = 0;
  return {
    action,
    present: async (next: GameObservation) => present(next),
    now: () => clock++,
    generation: () => 1,
    setBusy: (value: boolean) => { busy = value; },
    busy: () => busy,
  };
}

test('settled browser checkpoint restores the same session and next observation sequence', async () => {
  const initial = observation([1], 3);
  const returned = observation([2], 4);
  const final = observation([1, 2], 5);
  const actions: number[] = [];
  const first = createPublicSingleActionBrowserCampaignHost();
  first.begin({ sessionId: 'settled-session', observation: initial });
  await first.run(productState(initial), hostPorts(async action => {
    actions.push(action);
    return returned;
  }));

  const checkpoint = first.snapshot();
  assert.equal(checkpoint.pendingPhysicalReturn, null);
  assert.equal(checkpoint.currentAgentObservation.sequence, 1);
  assert.equal(checkpoint.nextSequence, 2);

  const restored = createPublicSingleActionBrowserCampaignHost();
  const receipt = restored.restore(checkpoint, returned);
  assert.equal(receipt.status, 'restored');
  assert.equal(receipt.sessionId, 'settled-session');
  const result = await restored.run(productState(returned), hostPorts(async action => {
    actions.push(action);
    return final;
  }));

  assert.equal(result.status, 'action');
  assert.equal(result.returnedObservation?.sequence, 2);
  assert.deepEqual(actions, [1, 2]);
});

test('sent pending action is acquired from the live return without physical replay', async () => {
  const initial = observation([1], 3);
  const returned = observation([2], 4);
  const final = observation([1, 2], 5);
  let resolveOld!: (value: GameObservation) => void;
  const oldReturn = new Promise<GameObservation>(resolve => { resolveOld = resolve; });
  let oldPresentations = 0;
  let firstActionCalls = 0;

  const oldHost = createPublicSingleActionBrowserCampaignHost();
  oldHost.begin({ sessionId: 'pending-session', observation: initial });
  const oldRun = oldHost.run(productState(initial), hostPorts(async action => {
    firstActionCalls += 1;
    assert.equal(action, 1);
    return oldReturn;
  }, async () => { oldPresentations += 1; }));

  const checkpoint = oldHost.snapshot();
  assert.equal(firstActionCalls, 1);
  assert.equal(checkpoint.pendingPhysicalReturn?.preparation.action.id, 1);
  oldHost.dispose();

  const freshHost = createPublicSingleActionBrowserCampaignHost();
  const restored = freshHost.restore(checkpoint, returned);
  assert.equal(restored.status, 'pending-return-acquired');
  assert.equal(
    restored.acquisition?.needId,
    checkpoint.pendingPhysicalReturn?.preparation.needId,
  );
  assert.equal(restored.returnedObservation.sequence, 1);

  const newActions: number[] = [];
  const next = await freshHost.run(productState(returned), hostPorts(async action => {
    newActions.push(action);
    return final;
  }));
  assert.equal(next.status, 'action');
  assert.deepEqual(newActions, [2]);

  resolveOld(returned);
  const oldResult = await oldRun;
  assert.equal(oldResult.dispatch?.stale, true);
  assert.equal(oldResult.acquisition, null);
  assert.equal(oldPresentations, 0);
  assert.equal(firstActionCalls, 1);
});

test('settled checkpoint rejects a different current public observation', () => {
  const initial = observation([1], 3);
  const host = createPublicSingleActionBrowserCampaignHost();
  host.begin({ sessionId: 'stale-checkpoint', observation: initial });
  const checkpoint = host.snapshot();
  const fresh = createPublicSingleActionBrowserCampaignHost();
  assert.throws(
    () => fresh.restore(checkpoint, observation([2], 4)),
    /does not match the current public observation/,
  );
});

test('product host checkpoint contains the explicit FieldStock participant', () => {
  const initial = observation([1], 3);
  const host = createFieldStockAndPublicSingleActionBrowserCampaignHost();
  host.begin({ sessionId: 'product-checkpoint', observation: initial });
  const checkpoint = host.snapshot();
  assert.deepEqual(
    checkpoint.campaign.participants.map(participant => participant.checkpointId),
    [OBSERVED_ADDRESSED_MATERIAL_CHECKPOINT_ID],
  );
  const fresh = createFieldStockAndPublicSingleActionBrowserCampaignHost();
  assert.equal(fresh.restore(checkpoint, initial).status, 'restored');
});

test('controller reactivation restores a fresh host and continues the same bounded session', async () => {
  const initial = observation([1], 3);
  const second = observation([2], 4);
  const final = observation([1, 2], 5);
  let current = initial;
  let busy = false;
  let clock = 0;
  let hostCreations = 0;
  const actions: number[] = [];
  let controller!: BrowserAgentController;
  let requestedManual = false;
  const ports: BrowserAgentControllerPorts = {
    readState: () => productState(current, busy),
    action: async action => {
      actions.push(action);
      return action === 1 ? second : final;
    },
    present: async next => { current = next; },
    now: () => clock++,
    generation: () => 1,
    setBusy: value => { busy = value; },
    yieldToBrowser: async () => {
      if (!requestedManual) {
        requestedManual = true;
        controller.deactivate('manual');
      }
    },
  };
  controller = new BrowserAgentController({
    createHost: () => {
      hostCreations += 1;
      return createPublicSingleActionBrowserCampaignHost();
    },
    makeSessionId: (_observation, ordinal) => `reactivation:${ordinal}`,
  });

  const first = await controller.activate(initial, ports);
  assert.equal(first.stopReason, 'manual');
  assert.equal(first.sessionId, 'reactivation:1');
  assert.equal(first.actionsDispatched, 1);
  assert.deepEqual(actions, [1]);

  const resumed = await controller.activate(current, ports);
  assert.equal(resumed.stopReason, 'none');
  assert.equal(resumed.sessionId, 'reactivation:1');
  assert.equal(resumed.actionsDispatched, 2);
  assert.deepEqual(actions, [1, 2]);
  assert.equal(hostCreations, 2);
});

test('controller discards a stale checkpoint after a Manual action and starts a new session', async () => {
  const initial = observation([1], 3);
  const firstReturned = observation([1, 2], 4);
  const manualObservation = observation([3], 6);
  const final = observation([1, 2], 7);
  let current = initial;
  let busy = false;
  let clock = 0;
  const actions: number[] = [];
  let hostCreations = 0;
  const ports: BrowserAgentControllerPorts = {
    readState: () => productState(current, busy),
    action: async action => {
      actions.push(action);
      return action === 1 ? firstReturned : final;
    },
    present: async next => { current = next; },
    now: () => clock++,
    generation: () => 1,
    setBusy: value => { busy = value; },
  };
  const controller = new BrowserAgentController({
    createHost: () => {
      hostCreations += 1;
      return createPublicSingleActionBrowserCampaignHost();
    },
    makeSessionId: (_observation, ordinal) => `stale:${ordinal}`,
  });

  const first = await controller.activate(initial, ports);
  assert.equal(first.sessionId, 'stale:1');
  assert.equal(first.stopReason, 'none');
  current = manualObservation;

  const restarted = await controller.activate(current, ports);
  assert.equal(restarted.sessionId, 'stale:2');
  assert.equal(restarted.stopReason, 'none');
  assert.equal(restarted.actionsDispatched, 1);
  assert.deepEqual(actions, [1, 3]);
  assert.equal(hostCreations, 3);
});
