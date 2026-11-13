import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROTOCOL_VERSION,
  type AgentObservation,
} from '../src/runtime/contracts.ts';
import { AgentWorkerCore } from '../src/runtime/v6-agent-worker-core.ts';
import { V6CommonCampaignDecisionPort } from '../src/runtime/v6-common-campaign-decision-port.ts';
import {
  FieldStock,
  type RetainedAddressedFieldPrior,
} from '../src/logos-engine/field-stock.ts';
import type {
  CommonCallerAcquisition,
  CommonCallerOwner,
  CommonCallerProposal,
} from '../src/logos-engine/v6-neutral-common-caller.ts';
import { OperationTraceSink } from '../src/logos-engine/v6-operation-trace.ts';
import { ObservedAddressedMaterialRuntime } from '../src/runtime/observed-addressed-material-runtime.ts';

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

function observation(
  sequence: number,
  rows: readonly (readonly number[])[],
  availableActionIds: AgentObservation['availableActionIds'],
  level = 2,
  levelsCompleted = 1,
): AgentObservation {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'campaign-worker-session',
    sequence,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels: Uint8Array.from(rows.flat()),
    },
    availableActionIds: [...availableActionIds],
    state: 'NOT_FINISHED',
    level,
    levelsCompleted,
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

const signal = new AbortController().signal;

test('worker campaign acquires the previous OP28 return before the next decision', () => {
  const trace = new OperationTraceSink();
  const port = new V6CommonCampaignDecisionPort({ trace });
  port.initialize('campaign-worker-session', 7);

  const first = port.decide(observation(0, blankRows(), [4]), 50, signal);
  assert.deepEqual(first, { id: 4 });
  const firstPending = port.pendingDecision;
  assert.ok(firstPending?.needId);

  const second = port.decide(observation(1, blankRows(), [2]), 50, signal);
  assert.deepEqual(second, { id: 2 });
  assert.equal(port.lastAcquisition?.needId, firstPending?.needId);
  assert.equal(port.lastAcquisition?.routed, true);
  assert.notEqual(port.pendingDecision?.needId, firstPending?.needId);
  assert.deepEqual(trace.snapshot().events.map(event => event.kind), [
    'need', 'operation', 'consumption',
    'need', 'operation', 'consumption',
  ]);
});

test('terminal observation settles the pending OP28 return without another decision', async () => {
  const trace = new OperationTraceSink();
  const port = new V6CommonCampaignDecisionPort({ trace });
  const core = new AgentWorkerCore(port, { implementationRevision: 'terminal-return-test' });
  await core.handle({
    type: 'initialize',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'campaign-worker-session',
    seed: 23,
  });

  const first = await core.handle({
    type: 'observe',
    observation: observation(0, blankRows(), [4]),
    budgetMs: 50,
  });
  assert.equal(first.type, 'action');
  const pendingNeedId = port.pendingDecision?.needId;
  assert.ok(pendingNeedId);

  const terminal = observation(1, blankRows(), [], 3, 2);
  terminal.state = 'WIN';
  assert.deepEqual(await core.handle({ type: 'observe', observation: terminal, budgetMs: 50 }), {
    type: 'stopped',
    sessionId: 'campaign-worker-session',
    reason: 'complete',
  });
  assert.equal(port.lastAcquisition?.needId, pendingNeedId);
  assert.equal(port.lastAcquisition?.routed, true);
  assert.equal(port.pendingDecision, undefined);
  assert.equal(port.lastPrepare, undefined);
  assert.deepEqual(trace.snapshot().events.map(event => event.kind), [
    'need', 'operation', 'consumption',
  ]);
});

test('zero decision budget still settles the pending return before stopping', async () => {
  const trace = new OperationTraceSink();
  const port = new V6CommonCampaignDecisionPort({ trace });
  const core = new AgentWorkerCore(port, { implementationRevision: 'zero-budget-return-test' });
  await core.handle({
    type: 'initialize',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'campaign-worker-session',
    seed: 29,
  });
  await core.handle({
    type: 'observe',
    observation: observation(0, blankRows(), [4]),
    budgetMs: 50,
  });
  const pendingNeedId = port.pendingDecision?.needId;
  assert.ok(pendingNeedId);

  assert.deepEqual(await core.handle({
    type: 'observe',
    observation: observation(1, blankRows(), [2]),
    budgetMs: 0,
  }), {
    type: 'stopped',
    sessionId: 'campaign-worker-session',
    reason: 'budget',
  });
  assert.equal(port.lastAcquisition?.needId, pendingNeedId);
  assert.equal(port.pendingDecision, undefined);
  assert.equal(port.lastPrepare, undefined);
  assert.deepEqual(trace.snapshot().events.map(event => event.kind), [
    'need', 'operation', 'consumption',
  ]);
});

test('worker campaign routes the OP18 result into FieldStock before proposing again', () => {
  const trace = new OperationTraceSink();
  const port = new V6CommonCampaignDecisionPort({
    trace,
    fieldStockRuntimeFactory() {
      const runtime = new ObservedAddressedMaterialRuntime();
      runtime.field.stock = stockFixture();
      return runtime;
    },
  });
  port.initialize('campaign-worker-session', 11);

  const firstRows = pointRows(1, 1, 2);
  const first = port.decide(observation(7, firstRows, [6]), 50, signal);
  assert.deepEqual(first, { id: 6, data: { x: 3, y: 1 } });
  const firstPending = port.pendingDecision;
  assert.match(firstPending?.needId ?? '', /:OP18:/);

  const secondRows = pointRows(3, 1, 2);
  const second = port.decide(observation(8, secondRows, [6]), 50, signal);
  assert.deepEqual(second, { id: 6, data: { x: 4, y: 1 } });
  assert.equal(port.lastAcquisition?.needId, firstPending?.needId);
  const acquired = port.lastAcquisition?.result as {
    comparison: { matched: boolean | null; seal_prefix: boolean };
    record: { status: string; events: readonly Record<string, unknown>[] };
  } | undefined;
  assert.equal(acquired?.comparison.matched, true);
  assert.equal(acquired?.record.status, 'material_observation_recorded');
  assert.equal(
    acquired?.record.events.some(event => event.kind === 'typed_material_relocated_to_address'),
    true,
  );
  assert.notDeepEqual(second, first);
  assert.deepEqual(trace.snapshot().events.map(event => event.kind), [
    'need', 'operation', 'consumption',
    'need', 'operation', 'consumption',
  ]);
});

test('worker campaign materializes entities only when a retained prior needs revalidation', () => {
  const port = new V6CommonCampaignDecisionPort({
    fieldStockRuntimeFactory() {
      const runtime = new ObservedAddressedMaterialRuntime();
      runtime.field.prior = revalidationPrior();
      return runtime;
    },
  });
  port.initialize('campaign-worker-session', 13);

  port.decide(observation(0, revalidationRows(), [6]), 50, signal);
  assert.equal(port.lastRevalidation, 'revalidated_stock');
  assert.ok(port.fieldRuntime.field.stock);
  assert.equal(port.fieldRuntime.mayUseRetainedKnowledge(), true);
});

test('worker campaign does not invent ACTION6 without retained and revalidated knowledge', () => {
  const trace = new OperationTraceSink();
  const port = new V6CommonCampaignDecisionPort({ trace });
  port.initialize('campaign-worker-session', 17);
  const action = port.decide(observation(0, pointRows(1, 1, 2), [6]), 50, signal);
  assert.equal(action, undefined);
  assert.deepEqual(port.lastPrepare, { status: 'none', proposals: [] });
  assert.deepEqual(trace.snapshot().events, []);
});

class RivalOwner implements CommonCallerOwner {
  readonly id = 'rival-owner';

  propose(_context: unknown): CommonCallerProposal {
    return {
      ownerId: this.id,
      proposalRef: 'rival:proposal',
      actionRef: 'ACTION4',
      payload: {},
    };
  }

  acquire(_event: CommonCallerAcquisition): unknown {
    return null;
  }
}

test('worker campaign preserves ambiguity before any Logos operation', () => {
  const trace = new OperationTraceSink();
  const port = new V6CommonCampaignDecisionPort({
    trace,
    additionalOwners: [new RivalOwner()],
  });
  port.initialize('campaign-worker-session', 19);
  const action = port.decide(observation(0, blankRows(), [4]), 50, signal);
  assert.equal(action, undefined);
  assert.equal(port.lastPrepare?.status, 'ambiguous');
  if (port.lastPrepare?.status === 'ambiguous') {
    assert.deepEqual(port.lastPrepare.proposals.map(proposal => proposal.ownerId), [
      'public_single_action_op28',
      'rival-owner',
    ]);
  }
  assert.deepEqual(trace.snapshot().events, []);
  assert.equal(port.pendingDecision, undefined);
});
