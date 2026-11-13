import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { ProductReadinessState } from '../src/agent-product-dispatch.ts';
import {
  FieldStock,
  type RetainedAddressedFieldPrior,
} from '../src/logos-engine/field-stock.ts';
import { FIELD_STOCK_CALLER_OWNER_ID } from '../src/logos-engine/v6-field-stock-caller-adapter.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { ObservedAddressedMaterialRuntime } from '../src/runtime/observed-addressed-material-runtime.ts';
import { BrowserAgentObservationStream } from '../src/runtime/v6-browser-agent-observation.ts';
import {
  BrowserFieldStockCampaignTransport,
  createFieldStockAndPublicSingleActionBrowserCampaignHost,
} from '../src/runtime/v6-browser-common-campaign-host.ts';

const prior: RetainedAddressedFieldPrior = {
  action_ref: 'ACTION6',
  lower_squared: 4,
  upper_squared: 9,
  boundary: 'boundary',
  request_row: 1,
  goal_region: { size: [1, 1], envelope: [[0, 0]] },
  class_templates: {
    '1': { size: [1, 1], offset: [0, 0], mask: [[0, 0]], alignment_supported: true },
    '2': { size: [1, 1], offset: [0, 0], mask: [[0, 0]], alignment_supported: true },
    '3': { size: [1, 1], offset: [0, 0], mask: [[0, 0]], alignment_supported: true },
  },
  qualification: 'retained',
};

function revalidationPrior(): RetainedAddressedFieldPrior {
  return {
    action_ref: 'ACTION6',
    lower_squared: 4,
    upper_squared: 9,
    boundary: 'prior-boundary',
    request_row: 5,
    goal_region: {
      size: [3, 3],
      envelope: [
        [0, 0], [0, 1], [0, 2],
        [1, 0], [1, 1], [1, 2],
        [2, 0], [2, 1], [2, 2],
      ],
    },
    class_templates: {
      '1': { size: [1, 1], offset: [0, 0], mask: [[0, 0]], alignment_supported: true },
      '2': { size: [1, 1], offset: [0, 0], mask: [[0, 0]], alignment_supported: true },
      '3': { size: [1, 1], offset: [0, 0], mask: [[0, 0]], alignment_supported: true },
    },
    qualification: 'retained local hypothesis; new occurrence and field require revalidation',
  };
}

function blankRows(): number[][] {
  return Array.from({ length: 64 }, () => Array(64).fill(0));
}

function pointRows(x: number, y: number, palette: number): number[][] {
  const rows = blankRows();
  rows[y]![x] = palette;
  return rows;
}

function fillRect(
  rows: number[][],
  x: number,
  y: number,
  width: number,
  height: number,
  palette: number,
): void {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      rows[row]![column] = palette;
    }
  }
}

function revalidationRows(): number[][] {
  const rows = blankRows();
  fillRect(rows, 1, 1, 2, 2, 1);
  fillRect(rows, 4, 1, 2, 2, 2);
  fillRect(rows, 7, 1, 2, 2, 3);
  fillRect(rows, 1, 5, 2, 2, 2);
  for (let offset = 0; offset < 3; offset += 1) {
    rows[4]![10 + offset] = 9;
    rows[6]![10 + offset] = 9;
    rows[4 + offset]![10] = 9;
    rows[4 + offset]![12] = 9;
  }
  rows[20]![20] = 1;
  rows[20]![24] = 1;
  return rows;
}

function gameObservation(
  frame: number[][],
  availableActionIds: number[],
  overrides: Partial<GameObservation> = {},
): GameObservation {
  return {
    gameCode: 'TEST',
    frame,
    frames: [],
    state: 'NOT_FINISHED',
    availableActionIds,
    canUndo: false,
    canSelectLevel: false,
    level: 2,
    levelCount: 4,
    levelsCompleted: 1,
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

function stockFixture(): FieldStock {
  const stock = new FieldStock();
  stock.prior = structuredClone(prior);
  stock.epoch = 2;
  stock.order = [1, 2, 3];
  stock.requests = [];
  stock.demands = new Map([[2, 1]]);
  stock.zones = [{ bbox: [4, 1, 4, 1], point: [4, 1], source_ref: 'scene' }];
  stock.interfaceBoxes = [];
  stock.lower = 4;
  stock.upper = 9;
  stock.actionRef = 'ACTION6';
  stock.templates = structuredClone(prior.class_templates!);
  stock.rules = {};
  stock.motionTypes = new Set([1, 2, 3]);
  stock.sceneRef = 'scene';
  return stock;
}

test('browser product host routes OP18 return into FieldStock before the next action', async () => {
  const runtime = new ObservedAddressedMaterialRuntime();
  runtime.field.stock = stockFixture();
  const host = createFieldStockAndPublicSingleActionBrowserCampaignHost({
    fieldStockRuntime: runtime,
    fieldStockRemaining: 16,
  });
  const initial = gameObservation(pointRows(1, 1, 2), [6]);
  const firstReturn = gameObservation(pointRows(3, 1, 2), [6]);
  const secondReturn = gameObservation(pointRows(4, 1, 2), [6]);
  let current = initial;
  let clock = 0;
  const actions: Array<{ action: number; data: unknown }> = [];

  host.begin({ sessionId: 'browser-field-stock', observation: initial });
  const ports = {
    action: async (action: number, data?: { x: number; y: number }) => {
      actions.push({ action, data });
      return actions.length === 1 ? firstReturn : secondReturn;
    },
    present: async (next: GameObservation) => { current = next; },
    now: () => clock++,
    generation: () => 1,
    setBusy: () => {},
  };

  const first = await host.run(productState(current), ports);
  assert.equal(first.status, 'action');
  assert.equal(first.preparation?.status, 'action');
  if (first.preparation?.status !== 'action') return;
  assert.equal(first.preparation.ownerId, FIELD_STOCK_CALLER_OWNER_ID);
  assert.deepEqual(first.preparation.action, { id: 6, data: { x: 3, y: 1 } });
  assert.equal(first.acquisition?.needId, first.preparation.needId);

  const second = await host.run(productState(current), ports);
  assert.equal(second.status, 'action');
  assert.equal(second.preparation?.status, 'action');
  if (second.preparation?.status !== 'action') return;
  assert.equal(second.preparation.ownerId, FIELD_STOCK_CALLER_OWNER_ID);
  assert.deepEqual(second.preparation.action, { id: 6, data: { x: 4, y: 1 } });
  assert.notEqual(second.preparation.needId, first.preparation.needId);
  assert.deepEqual(actions, [
    { action: 6, data: { x: 3, y: 1 } },
    { action: 6, data: { x: 4, y: 1 } },
  ]);
});

test('retained FieldStock prior is revalidated only from the current public image', () => {
  const runtime = new ObservedAddressedMaterialRuntime();
  runtime.field.prior = revalidationPrior();
  const transport = new BrowserFieldStockCampaignTransport({ runtime, remaining: 16 });
  const visible = gameObservation(revalidationRows(), [6]);
  const stream = new BrowserAgentObservationStream({
    sessionId: 'browser-prior-revalidation',
    gameCode: visible.gameCode,
  });
  const agentObservation = stream.next(visible);

  const context = transport.context({
    sessionId: agentObservation.sessionId,
    gameObservation: visible,
    agentObservation,
  });

  assert.equal(transport.lastRevalidationStatus, 'revalidated_stock');
  assert.equal(runtime.status(), 'revalidated_stock');
  assert.ok(runtime.field.stock);
  assert.equal(runtime.field.stock?.epoch, 2);
  assert.deepEqual(runtime.field.stock?.order, [1, 2, 3]);
  assert.ok(context.observation.entities?.length);
});

test('empty browser FieldStock runtime does not invent ACTION6 coordinates', async () => {
  const host = createFieldStockAndPublicSingleActionBrowserCampaignHost();
  const initial = gameObservation(pointRows(1, 1, 2), [6]);
  host.begin({ sessionId: 'browser-empty-field-stock', observation: initial });
  let dispatches = 0;

  const result = await host.run(productState(initial), {
    action: async () => {
      dispatches += 1;
      return initial;
    },
    present: async () => {},
    now: () => 0,
    generation: () => 1,
    setBusy: () => {},
  });

  assert.deepEqual(result.preparation, { status: 'none', proposals: [] });
  assert.equal(result.status, 'none');
  assert.equal(dispatches, 0);
});

test('passive FieldStock retains but does not falsely apply knowledge after an OP28 level return', async () => {
  const runtime = new ObservedAddressedMaterialRuntime();
  const originalStock = stockFixture();
  runtime.field.stock = originalStock;
  const host = createFieldStockAndPublicSingleActionBrowserCampaignHost({
    fieldStockRuntime: runtime,
  });
  const initial = gameObservation(blankRows(), [4]);
  const nextLevel = gameObservation(revalidationRows(), [6], {
    level: 3,
    levelsCompleted: 2,
  });
  const events: string[] = [];
  host.begin({ sessionId: 'browser-passive-boundary', observation: initial });

  const result = await host.run(productState(initial), {
    action: async action => {
      events.push(`action:${action}`);
      return nextLevel;
    },
    present: async () => { events.push('present'); },
    now: (() => { let value = 0; return () => value++; })(),
    generation: () => 1,
    setBusy: () => {},
    onCampaignAcquired: () => events.push('acquired'),
  });

  assert.equal(result.status, 'action');
  assert.equal(result.preparation?.status, 'action');
  if (result.preparation?.status === 'action') {
    assert.equal(result.preparation.ownerId, 'public_single_action_op28');
    assert.deepEqual(result.preparation.action, { id: 4 });
    assert.equal(result.acquisition?.needId, result.preparation.needId);
  }
  assert.deepEqual(events, ['action:4', 'acquired', 'present']);
  assert.notEqual(runtime.field.stock, originalStock);
  assert.equal(runtime.field.stock, null);
  assert.ok(runtime.field.prior);
  assert.equal(runtime.status(), 'retained_pending_revalidation');
});

test('browser Agent controller defaults to the combined OP18 and OP28 host', () => {
  const source = readFileSync(
    new URL('../src/runtime/v6-browser-agent-controller.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /createFieldStockAndPublicSingleActionBrowserCampaignHost/);
  assert.doesNotMatch(source, /\(\(\) => createPublicSingleActionBrowserCampaignHost\(\)\)/);
});
