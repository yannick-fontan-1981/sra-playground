import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { ProductReadinessState } from '../src/agent-product-dispatch.ts';
import { PUBLIC_UNIQUE_ACTION6_CALLER_OWNER_ID } from '../src/logos-engine/v6-public-unique-action6-caller-adapter.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { ObservedAddressedMaterialRuntime } from '../src/runtime/observed-addressed-material-runtime.ts';
import { createFieldStockPublicAction6AndPublicSingleActionBrowserCampaignHost } from '../src/runtime/v6-browser-product-campaign-host.ts';

function rows(fill = 2): number[][] {
  return Array.from({ length: 64 }, () => Array(64).fill(fill));
}

function closedVerticalGate(frame: number[][], x: number, y: number): void {
  for (let row = y - 1; row <= y + 1; row += 1) {
    for (let column = x - 1; column <= x + 1; column += 1) {
      frame[row]![column] = 2;
    }
    frame[row]![x] = 5;
  }
}

function observation(
  gameCode: string,
  frame: number[][],
  overrides: Partial<GameObservation> = {},
): GameObservation {
  return {
    gameCode,
    frame,
    frames: [],
    state: 'NOT_FINISHED',
    availableActionIds: [6],
    canUndo: false,
    canSelectLevel: false,
    level: 1,
    levelCount: 8,
    levelsCompleted: 0,
    defaultFps: 5,
    ...overrides,
  };
}

function productState(current: GameObservation): ProductReadinessState {
  return {
    observation: current,
    selectedGameCode: current.gameCode,
    busy: false,
    loading: false,
    failed: false,
  };
}

class TrackingAddressedRuntime extends ObservedAddressedMaterialRuntime {
  readonly events: string[];

  constructor(events: string[]) {
    super();
    this.events = events;
  }

  override observeAddressedReturn(
    ...args: Parameters<ObservedAddressedMaterialRuntime['observeAddressedReturn']>
  ): ReturnType<ObservedAddressedMaterialRuntime['observeAddressedReturn']> {
    this.events.push('passive-field-stock');
    return super.observeAddressedReturn(...args);
  }
}

test('active product host releases, dispatches, acquires and passively observes one public SMLP ACTION6', async () => {
  const beforeRows = rows();
  closedVerticalGate(beforeRows, 32, 26);
  const before = observation('SMLP', beforeRows);
  const after = observation('SMLP', rows());
  const events: string[] = [];
  const runtime = new TrackingAddressedRuntime(events);
  const host = createFieldStockPublicAction6AndPublicSingleActionBrowserCampaignHost({
    fieldStockRuntime: runtime,
  });
  let dispatched: { action: number; data?: { x: number; y: number } } | undefined;

  host.begin({ sessionId: 'browser-product-action6', observation: before });
  const result = await host.run(productState(before), {
    action: async (action, data) => {
      dispatched = { action, ...(data ? { data } : {}) };
      events.push(`action:${action}:${data?.x}:${data?.y}`);
      return after;
    },
    present: async () => { events.push('present'); },
    now: (() => { let value = 0; return () => value++; })(),
    generation: () => 1,
    setBusy: () => {},
    onCampaignAcquired: acquisition => events.push(`acquired:${acquisition.needId}`),
  });

  assert.equal(result.status, 'action');
  assert.equal(result.preparation?.status, 'action');
  if (result.preparation?.status !== 'action') return;
  assert.equal(result.preparation.ownerId, PUBLIC_UNIQUE_ACTION6_CALLER_OWNER_ID);
  assert.deepEqual(result.preparation.action, { id: 6, data: { x: 32, y: 26 } });
  assert.deepEqual(dispatched, { action: 6, data: { x: 32, y: 26 } });
  assert.equal(result.acquisition?.needId, result.preparation.needId);
  assert.equal(result.dispatch?.accepted, true);
  assert.deepEqual(events, [
    'action:6:32:26',
    'passive-field-stock',
    `acquired:${result.preparation.needId}`,
    'present',
  ]);
  assert.equal(runtime.field.model, null);
  assert.equal(runtime.field.prior, null);
  assert.equal(runtime.field.stock, null);
});

test('two public ACTION6 targets remain ambiguous before Logos and dispatch', async () => {
  const frame = rows();
  closedVerticalGate(frame, 20, 20);
  closedVerticalGate(frame, 40, 40);
  const current = observation('SMLP', frame);
  const host = createFieldStockPublicAction6AndPublicSingleActionBrowserCampaignHost();
  let dispatches = 0;

  host.begin({ sessionId: 'browser-product-action6-ambiguous', observation: current });
  const result = await host.run(productState(current), {
    action: async () => {
      dispatches += 1;
      return current;
    },
    present: async () => {},
    now: () => 0,
    generation: () => 1,
    setBusy: () => {},
  });

  assert.equal(result.status, 'none');
  assert.deepEqual(result.preparation, { status: 'none', proposals: [] });
  assert.equal(dispatches, 0);
});

test('unsupported games do not inherit the bounded game-specific ACTION6 rule', async () => {
  const frame = rows();
  closedVerticalGate(frame, 32, 26);
  const current = observation('TEST', frame);
  const host = createFieldStockPublicAction6AndPublicSingleActionBrowserCampaignHost();
  let dispatches = 0;

  host.begin({ sessionId: 'browser-product-action6-unsupported', observation: current });
  const result = await host.run(productState(current), {
    action: async () => {
      dispatches += 1;
      return current;
    },
    present: async () => {},
    now: () => 0,
    generation: () => 1,
    setBusy: () => {},
  });

  assert.equal(result.status, 'none');
  assert.equal(dispatches, 0);
});

test('browser controller activates the product composition that includes ACTION6', () => {
  const source = readFileSync(
    new URL('../src/runtime/v6-browser-agent-controller.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /v6-browser-product-campaign-host/);
  assert.match(source, /createFieldStockAndPublicSingleActionBrowserCampaignHost/);
});
