import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { ProductReadinessState } from '../src/agent-product-dispatch.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import {
  BrowserAgentController,
  type BrowserAgentControllerPorts,
} from '../src/runtime/v6-browser-agent-controller.ts';

function observation(
  availableActionIds: number[],
  overrides: Partial<GameObservation> = {},
): GameObservation {
  return {
    gameCode: 'TEST',
    frame: Array.from({ length: 64 }, () => Array(64).fill(0)),
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

function state(current: GameObservation, busy: boolean): ProductReadinessState {
  return {
    observation: current,
    selectedGameCode: current.gameCode,
    busy,
    loading: false,
    failed: false,
  };
}

test('default controller registers the combined public and FieldStock host', () => {
  const source = readFileSync(
    new URL('../src/runtime/v6-browser-agent-controller.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /createPublicAndFieldStockBrowserCampaignHost/);
  assert.doesNotMatch(source, /createPublicSingleActionBrowserCampaignHost/);
});

test('default empty FieldStock runtime cannot invent ACTION6 coordinates', async () => {
  const initial = observation([6]);
  let current = initial;
  let busy = false;
  let actions = 0;
  const ports: BrowserAgentControllerPorts = {
    readState: () => state(current, busy),
    action: async () => {
      actions += 1;
      return current;
    },
    present: async next => {
      current = next;
    },
    now: () => 0,
    generation: () => 1,
    setBusy: value => {
      busy = value;
    },
  };
  const controller = new BrowserAgentController({ maxActions: 1 });

  const result = await controller.activate(initial, ports);

  assert.equal(result.phase, 'stopped');
  assert.equal(result.stopReason, 'none');
  assert.equal(result.actionsDispatched, 0);
  assert.equal(actions, 0);
  assert.equal(busy, false);
});
