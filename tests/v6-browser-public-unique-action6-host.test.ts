import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { ProductReadinessState } from '../src/agent-product-dispatch.ts';
import {
  PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
  PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
} from '../src/logos-engine/v6-public-addressed-joint-channels.ts';
import { JOINT_CHANNEL_OWNER_ID } from '../src/logos-engine/v6-joint-channel-owner.ts';
import { PUBLIC_UNIQUE_STCK_ACTION6_CALLER_OWNER_ID } from '../src/logos-engine/v6-public-unique-stck-action6-caller-adapter.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { ObservedAddressedMaterialRuntime } from '../src/runtime/observed-addressed-material-runtime.ts';
import { createFieldStockPublicAction6AndPublicSingleActionBrowserCampaignHost } from '../src/runtime/v6-browser-product-campaign-host.ts';

function rows(fill = 2): number[][] {
  return Array.from({ length: 64 }, () => Array(64).fill(fill));
}

function fillRect(
  frame: number[][],
  x: number,
  y: number,
  width: number,
  height: number,
  value: number,
): void {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      frame[row]![column] = value;
    }
  }
}

function closedVerticalGate(frame: number[][], x: number, y: number): void {
  fillRect(frame, x - 1, y - 1, 3, 3, 2);
  frame[y - 1]![x] = 5;
  frame[y]![x] = 5;
  frame[y + 1]![x] = 5;
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

test('active product host uses both canonical SMLP channels before passive FieldStock observation', async () => {
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

  host.begin({ sessionId: 'browser-product-smlp-action6', observation: before });
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
  assert.equal(result.preparation.ownerId, JOINT_CHANNEL_OWNER_ID);
  assert.deepEqual(result.preparation.action, { id: 6, data: { x: 32, y: 26 } });
  assert.deepEqual(dispatched, { action: 6, data: { x: 32, y: 26 } });
  assert.equal(result.acquisition?.needId, result.preparation.needId);
  assert.equal(result.dispatch?.accepted, true);

  const jointReceipt = result.acquisition?.result as {
    channels?: Array<{ channelId: string; result: { acquired: boolean; needId: string } }>;
  } | undefined;
  assert.deepEqual(jointReceipt?.channels?.map(item => item.channelId), [
    PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
    PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
  ]);
  assert.ok(jointReceipt?.channels?.every(item => (
    item.result.acquired && item.result.needId === result.preparation?.needId
  )));

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

test('several public SMLP gates remain unresolved before Logos and dispatch', async () => {
  const frame = rows();
  closedVerticalGate(frame, 20, 20);
  closedVerticalGate(frame, 40, 40);
  const current = observation('SMLP', frame);
  const host = createFieldStockPublicAction6AndPublicSingleActionBrowserCampaignHost();
  let dispatches = 0;

  host.begin({ sessionId: 'browser-product-smlp-ambiguous', observation: current });
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

test('active product host releases one strictly unique STCK stack card', async () => {
  const beforeRows = rows(5);
  fillRect(beforeRows, 1, 49, 8, 4, 10);
  const before = observation('STCK', beforeRows);
  const after = observation('STCK', rows(5));
  const host = createFieldStockPublicAction6AndPublicSingleActionBrowserCampaignHost();

  host.begin({ sessionId: 'browser-product-stck-action6', observation: before });
  const result = await host.run(productState(before), {
    action: async (action, data) => {
      assert.equal(action, 6);
      assert.deepEqual(data, { x: 4, y: 50 });
      return after;
    },
    present: async () => {},
    now: (() => { let value = 0; return () => value++; })(),
    generation: () => 1,
    setBusy: () => {},
  });

  assert.equal(result.status, 'action');
  assert.equal(result.preparation?.status, 'action');
  if (result.preparation?.status !== 'action') return;
  assert.equal(result.preparation.ownerId, PUBLIC_UNIQUE_STCK_ACTION6_CALLER_OWNER_ID);
  assert.deepEqual(result.preparation.action, { id: 6, data: { x: 4, y: 50 } });
  assert.equal(result.acquisition?.needId, result.preparation.needId);
});

test('unsupported games do not inherit the bounded game-specific ACTION6 rules', async () => {
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

test('browser controller activates the combined product campaign composition', () => {
  const source = readFileSync(
    new URL('../src/runtime/v6-browser-agent-controller.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /v6-browser-product-campaign-host/);
  assert.match(source, /createFieldStockAndPublicSingleActionBrowserCampaignHost/);
});
