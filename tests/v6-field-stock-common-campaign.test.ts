import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROTOCOL_VERSION,
  type AgentObservation,
} from '../src/runtime/contracts.ts';
import {
  FieldStock,
  type FieldStockDependencies,
  type RetainedAddressedFieldPrior,
} from '../src/logos-engine/field-stock.ts';
import {
  CommonCampaignOwner,
} from '../src/logos-engine/v6-common-campaign-owner.ts';
import {
  FieldStockCallerOwnerAdapter,
  FIELD_STOCK_CALLER_OWNER_ID,
} from '../src/logos-engine/v6-field-stock-caller-adapter.ts';
import { OperationTraceSink } from '../src/logos-engine/v6-operation-trace.ts';
import type { PublicObservationLike } from '../src/logos-engine/linked-preparation.ts';
import { ObservedAddressedMaterialRuntime } from '../src/runtime/observed-addressed-material-runtime.ts';

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

function rows(point: readonly [number, number, number]): number[][] {
  const output = Array.from({ length: 64 }, () => Array(64).fill(0));
  output[point[1]]![point[0]] = point[2];
  return output;
}

function publicObservation(
  revision: number,
  ref: string,
  availableActionRefs: readonly string[] = ['ACTION6'],
  levelEpoch = 2,
): PublicObservationLike {
  return {
    observation_ref: ref,
    revision,
    level_epoch: levelEpoch,
    levels_completed: 1,
    state: 'NOT_FINISHED',
    frame_hash: ref,
    available_action_refs: availableActionRefs,
    entities: [],
  };
}

function agentObservation(
  revision: number,
  frameRows: readonly (readonly number[])[],
  sessionId = 'field-stock-campaign',
): AgentObservation {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId,
    sequence: revision,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels: Uint8Array.from(frameRows.flat()),
    },
    availableActionIds: [6],
    state: 'NOT_FINISHED',
    level: 2,
    levelsCompleted: 1,
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

const dependencies: FieldStockDependencies = {
  digest(value) {
    return `digest-${JSON.stringify(value).length.toString(16).padStart(16, '0')}`;
  },
  makeLocusWitness(observation, _rows, point, reason, evidence) {
    return {
      observation_ref: observation.observation_ref,
      point,
      reason,
      evidence,
    };
  },
};

function campaignFixture(trace = new OperationTraceSink()) {
  const runtime = new ObservedAddressedMaterialRuntime();
  runtime.field.stock = stockFixture();
  const adapter = new FieldStockCallerOwnerAdapter(runtime);
  const campaign = new CommonCampaignOwner([adapter], { trace });
  return { runtime, adapter, campaign, trace };
}

test('FieldStock OP18 return is correlated and changes the next campaign action', () => {
  const { campaign, trace } = campaignFixture();
  const firstRows = rows([1, 1, 2]);
  const before = publicObservation(7, 'field-observation:7');
  const firstAgentObservation = agentObservation(7, firstRows);

  const first = campaign.prepare(firstAgentObservation, {
    [FIELD_STOCK_CALLER_OWNER_ID]: {
      sessionId: firstAgentObservation.sessionId,
      observation: before,
      rows: firstRows,
      remaining: 16,
      dependencies,
    },
  });
  assert.equal(first.status, 'action');
  if (first.status !== 'action') return;
  assert.equal(first.ownerId, FIELD_STOCK_CALLER_OWNER_ID);
  assert.deepEqual(first.action, { id: 6, data: { x: 3, y: 1 } });

  const events = trace.snapshot().events;
  assert.deepEqual(events.map(event => event.kind), ['need', 'operation', 'consumption']);
  assert.equal(events[0]?.kind === 'need' && events[0].needKind, 'exploration-question');
  assert.equal(events[1]?.kind === 'operation' && events[1].op, 'OP18');
  assert.equal(events[2]?.kind === 'consumption' && events[2].consumer, 'operationAdmission');
  assert.equal(new Set(events.map(event => event.needId)).size, 1);
  assert.equal(events[0]?.needId, first.needId);

  const secondRows = rows([3, 1, 2]);
  const after = publicObservation(8, 'field-observation:8');
  const receipt = campaign.acquire({
    sessionId: firstAgentObservation.sessionId,
    needId: first.needId,
    eventRef: after.observation_ref,
    payload: { after, rows: secondRows },
  });
  assert.equal(receipt.routed, true);
  assert.equal(receipt.needId, first.needId);
  const acquired = receipt.result as {
    comparison: { matched: boolean | null; seal_prefix: boolean };
    record: { status: string; events: readonly Record<string, unknown>[] };
  };
  assert.equal(acquired.comparison.matched, true);
  assert.equal(acquired.record.status, 'material_observation_recorded');
  assert.equal(acquired.record.events.some(event => event.kind === 'typed_material_relocated_to_address'), true);

  const secondAgentObservation = agentObservation(8, secondRows);
  const second = campaign.prepare(secondAgentObservation, {
    [FIELD_STOCK_CALLER_OWNER_ID]: {
      sessionId: secondAgentObservation.sessionId,
      observation: after,
      rows: secondRows,
      remaining: 16,
      dependencies,
    },
  });
  assert.equal(second.status, 'action');
  if (second.status === 'action') {
    assert.deepEqual(second.action, { id: 6, data: { x: 4, y: 1 } });
    assert.notEqual(second.needId, first.needId);
  }
});

test('missing addressed action stops FieldStock before proposal and OP execution', () => {
  const { campaign, trace } = campaignFixture();
  const frameRows = rows([1, 1, 2]);
  const visible = publicObservation(7, 'field-observation:no-action', ['ACTION1']);
  const publicAgent = agentObservation(7, frameRows);
  publicAgent.availableActionIds = [1];

  const result = campaign.prepare(publicAgent, {
    [FIELD_STOCK_CALLER_OWNER_ID]: {
      sessionId: publicAgent.sessionId,
      observation: visible,
      rows: frameRows,
      remaining: 16,
      dependencies,
    },
  });
  assert.deepEqual(result, { status: 'none', proposals: [] });
  assert.deepEqual(trace.snapshot().events, []);
});

test('FieldStock pre-action guard rejects a proposal bound to another level epoch', () => {
  const { campaign, trace } = campaignFixture();
  const frameRows = rows([1, 1, 2]);
  const wrongEpoch = publicObservation(7, 'field-observation:wrong-epoch', ['ACTION6'], 3);
  const publicAgent = agentObservation(7, frameRows);

  const result = campaign.prepare(publicAgent, {
    [FIELD_STOCK_CALLER_OWNER_ID]: {
      sessionId: publicAgent.sessionId,
      observation: wrongEpoch,
      rows: frameRows,
      remaining: 16,
      dependencies,
    },
  });
  assert.deepEqual(result, { status: 'none', proposals: [] });
  assert.deepEqual(trace.snapshot().events, []);
});

test('FieldStock return must advance the correlated public revision', () => {
  const { campaign } = campaignFixture();
  const frameRows = rows([1, 1, 2]);
  const before = publicObservation(7, 'field-observation:7');
  const publicAgent = agentObservation(7, frameRows);
  const prepared = campaign.prepare(publicAgent, {
    [FIELD_STOCK_CALLER_OWNER_ID]: {
      sessionId: publicAgent.sessionId,
      observation: before,
      rows: frameRows,
      remaining: 16,
      dependencies,
    },
  });
  assert.equal(prepared.status, 'action');
  if (prepared.status !== 'action') return;
  assert.throws(() => campaign.acquire({
    sessionId: publicAgent.sessionId,
    needId: prepared.needId,
    eventRef: 'field-observation:stale',
    payload: {
      after: publicObservation(7, 'field-observation:stale'),
      rows: frameRows,
    },
  }), /revision must advance/);
  assert.equal(campaign.pending(publicAgent.sessionId)?.needId, prepared.needId);
});
