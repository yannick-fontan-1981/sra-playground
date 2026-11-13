import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProductReadinessState } from '../src/agent-product-dispatch.ts';
import {
  FieldStock,
  type RetainedAddressedFieldPrior,
} from '../src/logos-engine/field-stock.ts';
import {
  FieldStockCallerOwnerAdapter,
  FIELD_STOCK_CALLER_OWNER_ID,
} from '../src/logos-engine/v6-field-stock-caller-adapter.ts';
import { CommonCampaignOwner } from '../src/logos-engine/v6-common-campaign-owner.ts';
import {
  PublicSingleActionCallerOwnerAdapter,
  PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID,
} from '../src/logos-engine/v6-public-single-action-caller-adapter.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { ObservedAddressedMaterialRuntime } from '../src/runtime/observed-addressed-material-runtime.ts';
import {
  BrowserCommonCampaignHost,
  type BrowserCampaignDispatchPorts,
} from '../src/runtime/v6-browser-common-campaign-host.ts';
import {
  BrowserFieldStockOwnerTransport,
  createPublicAndFieldStockBrowserCampaignHost,
} from '../src/runtime/v6-browser-field-stock-campaign.ts';

function blankRows(): number[][] {
  return Array.from({ length: 64 }, () => Array(64).fill(0));
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

function fusedRows(): number[][] {
  const rows = revalidationRows();
  rows[20]![20] = 0;
  rows[20]![24] = 0;
  rows[20]![22] = 2;
  return rows;
}

function observation(
  rows: readonly (readonly number[])[],
  availableActionIds: number[],
  overrides: Partial<GameObservation> = {},
): GameObservation {
  return {
    gameCode: 'TEST',
    frame: rows.map(row => [...row]),
    frames: [],
    state: 'NOT_FINISHED',
    availableActionIds,
    canUndo: false,
    canSelectLevel: false,
    level: 2,
    levelCount: 3,
    levelsCompleted: 1,
    defaultFps: 5,
    ...overrides,
  };
}

function state(current: GameObservation): ProductReadinessState {
  return {
    observation: current,
    selectedGameCode: current.gameCode,
    busy: false,
    loading: false,
    failed: false,
  };
}

function ports(
  returned: GameObservation,
  events: string[] = [],
  onAction?: (action: number, data?: { x: number; y: number }) => void,
): BrowserCampaignDispatchPorts {
  let clock = 0;
  return {
    action: async (action, data) => {
      events.push(`action:${action}:${JSON.stringify(data)}`);
      onAction?.(action, data);
      return returned;
    },
    present: async next => {
      events.push(`present:${next.state}`);
    },
    now: () => clock++,
    generation: () => 1,
    setBusy: value => events.push(`busy:${value}`),
  };
}

function hostWithTransport(
  runtime: ObservedAddressedMaterialRuntime,
): { host: BrowserCommonCampaignHost; transport: BrowserFieldStockOwnerTransport } {
  const transport = new BrowserFieldStockOwnerTransport({ runtime });
  const campaign = new CommonCampaignOwner([
    new FieldStockCallerOwnerAdapter(runtime),
    new PublicSingleActionCallerOwnerAdapter(),
  ]);
  return {
    transport,
    host: new BrowserCommonCampaignHost({
      campaign,
      ownerTransports: [
        transport,
        {
          ownerId: PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID,
          context: input => ({ observation: input.agentObservation }),
          returnPayload: input => ({ observation: input.afterAgentObservation }),
        },
      ],
    }),
  };
}

function stockFixture(): FieldStock {
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

test('combined host preserves the strict OP28 fallback while FieldStock is empty', async () => {
  const runtime = new ObservedAddressedMaterialRuntime();
  const host = createPublicAndFieldStockBrowserCampaignHost({ runtime });
  const initial = observation(blankRows(), [4]);
  const returned = observation(blankRows(), [1, 2]);
  host.begin({ sessionId: 'empty-field-session', observation: initial });

  const result = await host.run(state(initial), ports(returned));

  assert.equal(result.status, 'action');
  assert.equal(result.preparation?.status, 'action');
  if (result.preparation?.status === 'action') {
    assert.equal(result.preparation.ownerId, PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID);
    assert.deepEqual(result.preparation.action, { id: 4 });
  }
  assert.equal(runtime.status(), 'empty');
});

test('ACTION6 remains absent without retained and revalidated FieldStock knowledge', async () => {
  const runtime = new ObservedAddressedMaterialRuntime();
  const host = createPublicAndFieldStockBrowserCampaignHost({ runtime });
  const initial = observation(revalidationRows(), [6]);
  let actions = 0;
  host.begin({ sessionId: 'no-prior-session', observation: initial });

  const result = await host.run(state(initial), ports(initial, [], () => { actions += 1; }));

  assert.equal(result.status, 'none');
  assert.equal(actions, 0);
  assert.equal(runtime.status(), 'empty');
});

test('retained public prior is revalidated before the browser campaign can release OP18', async () => {
  const runtime = new ObservedAddressedMaterialRuntime();
  runtime.field.prior = revalidationPrior();
  const { host, transport } = hostWithTransport(runtime);
  const initial = observation(revalidationRows(), [6]);
  const returned = observation(fusedRows(), [6]);
  const events: string[] = [];
  host.begin({ sessionId: 'revalidated-browser-stock', observation: initial });

  const result = await host.run(state(initial), ports(returned, events, (action, data) => {
    assert.equal(action, 6);
    assert.deepEqual(data, { x: 22, y: 20 });
  }));

  assert.equal(transport.lastRevalidation, 'revalidated_stock');
  assert.ok(transport.current?.observation.entities);
  assert.equal(result.status, 'action');
  if (result.preparation?.status === 'action') {
    assert.equal(result.preparation.ownerId, FIELD_STOCK_CALLER_OWNER_ID);
    assert.deepEqual(result.preparation.action, { id: 6, data: { x: 22, y: 20 } });
  }
  const acquired = result.acquisition?.result as {
    comparison?: { matched: boolean | null };
    record?: { status: string; events: readonly Record<string, unknown>[] };
  } | undefined;
  assert.equal(acquired?.comparison?.matched, null);
  assert.equal(acquired?.record?.status, 'material_observation_recorded');
  assert.equal(
    acquired?.record?.events.some(event => event.kind === 'observed_joint_material_rewrite'),
    true,
  );
  assert.equal(runtime.status(), 'revalidated_stock');
  assert.deepEqual(events, [
    'busy:true',
    'action:6:{"x":22,"y":20}',
    'present:NOT_FINISHED',
    'busy:false',
  ]);
});

test('selected return is recorded before official boundary retention and presentation', async () => {
  const runtime = new ObservedAddressedMaterialRuntime();
  runtime.field.prior = revalidationPrior();
  const { host, transport } = hostWithTransport(runtime);
  const initial = observation(revalidationRows(), [6]);
  const terminal = observation(fusedRows(), [], {
    state: 'WIN',
    level: 3,
    levelsCompleted: 2,
  });
  const events: string[] = [];
  const dispatchPorts = ports(terminal, events);
  dispatchPorts.onCampaignAcquired = receipt => {
    const acquired = receipt.result as { record?: { status: string } };
    events.push(`acquired:${acquired.record?.status}:${runtime.status()}`);
  };
  dispatchPorts.present = async () => {
    events.push(`present:${runtime.status()}`);
  };
  host.begin({ sessionId: 'boundary-browser-stock', observation: initial });

  const result = await host.run(state(initial), dispatchPorts);

  const acquired = result.acquisition?.result as {
    comparison?: { reason: string };
    record?: { status: string };
  } | undefined;
  assert.equal(acquired?.comparison?.reason, 'official_boundary');
  assert.equal(acquired?.record?.status, 'material_observation_recorded');
  assert.deepEqual(transport.lastBoundary, { crossed: true, officialBoundary: 2 });
  assert.equal(runtime.status(), 'retained_pending_revalidation');
  assert.ok(runtime.field.prior);
  assert.equal(runtime.field.stock, null);
  assert.deepEqual(events, [
    'busy:true',
    'action:6:{"x":22,"y":20}',
    'acquired:material_observation_recorded:retained_pending_revalidation',
    'present:retained_pending_revalidation',
    'busy:false',
  ]);
});

test('active stock from another browser session is demoted and cannot bypass scene revalidation', async () => {
  const runtime = new ObservedAddressedMaterialRuntime();
  runtime.field.stock = stockFixture();
  const { host, transport } = hostWithTransport(runtime);
  const mismatched = observation(blankRows(), [6]);
  host.begin({ sessionId: 'fresh-browser-session', observation: mismatched });

  const result = await host.run(state(mismatched), ports(mismatched));

  assert.equal(result.status, 'none');
  assert.equal(transport.lastRevalidation, 'retained_not_applicable');
  assert.equal(runtime.field.stock, null);
  assert.ok(runtime.field.prior);
  assert.equal(runtime.status(), 'retained_pending_revalidation');
  assert.equal(
    runtime.field.events.some(event => event.kind === 'active_stock_suspended_for_public_revalidation'),
    true,
  );
});
