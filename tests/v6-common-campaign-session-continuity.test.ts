import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FieldStock,
  type RetainedAddressedFieldPrior,
} from '../src/logos-engine/field-stock.ts';
import {
  snapshotAddressedFieldRetention,
  snapshotFieldStock,
} from '../src/logos-engine/field-stock-snapshot.ts';
import {
  CommonCampaignOwner,
} from '../src/logos-engine/v6-common-campaign-owner.ts';
import {
  CommonCampaignCheckpointCoordinator,
  type CommonCampaignCheckpointParticipant,
} from '../src/logos-engine/v6-common-campaign-checkpoint.ts';
import {
  PublicSingleActionCallerOwnerAdapter,
  PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID,
} from '../src/logos-engine/v6-public-single-action-caller-adapter.ts';
import {
  PROTOCOL_VERSION,
  type AgentObservation,
} from '../src/runtime/contracts.ts';
import {
  ObservedAddressedMaterialCheckpointParticipant,
} from '../src/runtime/observed-addressed-material-checkpoint.ts';
import { ObservedAddressedMaterialRuntime } from '../src/runtime/observed-addressed-material-runtime.ts';

function observation(sequence = 0, sessionId = 'continuity-session'): AgentObservation {
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
    state: 'NOT_FINISHED',
    level: 1,
    levelsCompleted: 0,
  };
}

function prior(): RetainedAddressedFieldPrior {
  return {
    action_ref: 'ACTION6',
    lower_squared: 4,
    upper_squared: 9,
    boundary: 'continuity-boundary',
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
      '2': {
        size: [2, 2],
        offset: [1, 1],
        mask: [[0, 0], [1, 0], [0, 1], [1, 1]],
        alignment_supported: true,
      },
    },
    observed_rules: {
      '1': { product: 2, evidence: ['prior-rule'] },
    },
    type_order: [1, 2, 3],
    qualification: 'session continuity fixture',
  };
}

function stockFixture(): FieldStock {
  const stock = new FieldStock();
  stock.prior = prior();
  stock.epoch = 2;
  stock.order = [1, 2, 3];
  stock.requests = [{
    palette_value: 2,
    bbox: [1, 5, 2, 6],
    mask: [[0, 0], [1, 0], [0, 1], [1, 1]],
    rectangular: true,
  }];
  stock.demands = new Map([[2, 1]]);
  stock.zones = [{ bbox: [7, 4, 9, 6], point: [8, 5], source_ref: 'scene-2' }];
  stock.interfaceBoxes = [[1, 1, 2, 2]];
  stock.lower = 4;
  stock.upper = 9;
  stock.actionRef = 'ACTION6';
  stock.templates = structuredClone(prior().class_templates ?? {});
  stock.rules = {
    1: {
      product: 2,
      confirmations: 2,
      prior_evidence: ['prior-rule'],
      evidence: ['return-1', 'return-2'],
    },
  };
  stock.lineages = new Map([['2:4,1,5,2', ['origin-a', 'origin-b']]]);
  stock.motionTypes = new Set([2]);
  stock.minimums = new Map([[2, 1]]);
  stock.failures = new Set(['failed-fusion']);
  stock.events = [{ kind: 'material_observation_recorded', evidence: 'return-2' }];
  stock.invalid = { reason: 'temporary-test-marker' };
  stock.sceneRef = 'scene-2';
  return stock;
}

function runtimeFixture(): ObservedAddressedMaterialRuntime {
  const runtime = new ObservedAddressedMaterialRuntime();
  runtime.field.epoch = 2;
  runtime.field.model = {
    action_ref: 'ACTION6',
    palette: 2,
    size: [2, 2],
    offset: [1, 1],
    mask: [[0, 0], [1, 0], [0, 1], [1, 1]],
    exemplar: { bbox: [1, 4, 2, 5] },
    goal: {
      enclosure: {
        bbox: [7, 4, 9, 6],
        mask: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
      },
    },
  };
  runtime.field.samples = [{ moved_to_anchor: true, evidence: 'sample-a' }];
  runtime.field.indicator = { bbox: [10, 10, 12, 12] };
  runtime.field.lowerSquared = 4;
  runtime.field.upperSquared = 9;
  runtime.field.calibration = 'navigation';
  runtime.field.events = [{ kind: 'field-calibrated' }];
  runtime.field.passed = [{ score: 1, evidence: 'level-1' }];
  runtime.field.prior = prior();
  runtime.field.stock = stockFixture();
  return runtime;
}

function campaignFixture(): CommonCampaignOwner {
  return new CommonCampaignOwner([new PublicSingleActionCallerOwnerAdapter()]);
}

test('exact FieldStock codec preserves Maps, Sets and learned decision state', () => {
  const stock = stockFixture();
  const snapshot = snapshotFieldStock(stock);
  const runtime = runtimeFixture();
  const participant = new ObservedAddressedMaterialCheckpointParticipant(runtime);
  const restoredRuntime = new ObservedAddressedMaterialRuntime();
  const restoredParticipant = new ObservedAddressedMaterialCheckpointParticipant(restoredRuntime);

  restoredParticipant.restore(participant.snapshot());
  assert.deepEqual(snapshotFieldStock(restoredRuntime.field.stock!), snapshot);
  assert.deepEqual(
    snapshotAddressedFieldRetention(restoredRuntime.field),
    snapshotAddressedFieldRetention(runtime.field),
  );

  restoredRuntime.field.stock!.failures.add('restored-only');
  assert.equal(runtime.field.stock!.failures.has('restored-only'), false);
});

test('pending physical return survives checkpoint with the same needId and is acquired once', () => {
  const campaign = campaignFixture();
  const runtime = runtimeFixture();
  const coordinator = new CommonCampaignCheckpointCoordinator(campaign, [
    new ObservedAddressedMaterialCheckpointParticipant(runtime),
  ]);
  const current = observation();
  const prepared = campaign.prepare(current, {
    [PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID]: { observation: current },
  });
  assert.equal(prepared.status, 'action');
  if (prepared.status !== 'action') return;

  const checkpoint = coordinator.snapshot();
  const restoredCampaign = campaignFixture();
  const restoredRuntime = new ObservedAddressedMaterialRuntime();
  const restoredCoordinator = new CommonCampaignCheckpointCoordinator(restoredCampaign, [
    new ObservedAddressedMaterialCheckpointParticipant(restoredRuntime),
  ]);
  restoredCoordinator.restore(checkpoint);

  assert.deepEqual(restoredCampaign.pending(current.sessionId), {
    needId: prepared.needId,
    ownerId: prepared.ownerId,
    proposalRef: prepared.proposalRef,
    action: prepared.action,
  });
  assert.deepEqual(
    snapshotAddressedFieldRetention(restoredRuntime.field),
    checkpoint.participants[0]!.state,
  );

  const returnInput = {
    sessionId: current.sessionId,
    needId: prepared.needId,
    eventRef: 'physical-return:continuity-1',
    payload: { observation: observation(1) },
  };
  const receipt = restoredCampaign.acquire(returnInput);
  assert.equal(receipt.routed, true);
  assert.equal(receipt.duplicate, false);
  assert.equal(receipt.needId, prepared.needId);
  assert.equal(restoredCampaign.pending(current.sessionId), undefined);

  const duplicate = restoredCampaign.acquire(returnInput);
  assert.equal(duplicate.routed, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.needId, prepared.needId);

  const settledCheckpoint = restoredCoordinator.snapshot();
  const secondRestore = campaignFixture();
  const secondRuntime = new ObservedAddressedMaterialRuntime();
  new CommonCampaignCheckpointCoordinator(secondRestore, [
    new ObservedAddressedMaterialCheckpointParticipant(secondRuntime),
  ]).restore(settledCheckpoint);
  assert.equal(secondRestore.acquire(returnInput).duplicate, true);
});

class MutableParticipant implements CommonCampaignCheckpointParticipant {
  constructor(
    readonly checkpointId: string,
    public state: string,
    readonly failOn: string | null = null,
  ) {}

  snapshot(): unknown {
    return this.state;
  }

  restore(snapshot: unknown): void {
    if (typeof snapshot !== 'string') throw new TypeError('mutable state must be a string');
    this.state = snapshot;
    if (snapshot === this.failOn) throw new Error(`participant ${this.checkpointId} rejected state`);
  }
}

test('checkpoint restore rolls back campaign and all participants after a refusal', () => {
  const campaign = campaignFixture();
  const current = observation();
  const prepared = campaign.prepare(current, {
    [PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID]: { observation: current },
  });
  assert.equal(prepared.status, 'action');

  const first = new MutableParticipant('first', 'before-first');
  const second = new MutableParticipant('second', 'before-second', 'explode');
  const coordinator = new CommonCampaignCheckpointCoordinator(campaign, [first, second]);
  const before = coordinator.snapshot();
  const invalid = structuredClone(before);
  invalid.participants[0]!.state = 'changed-first';
  invalid.participants[1]!.state = 'explode';

  assert.throws(() => coordinator.restore(invalid), /participant second rejected state/);
  assert.deepEqual(coordinator.snapshot(), before);
  assert.equal(first.state, 'before-first');
  assert.equal(second.state, 'before-second');
});

test('checkpoint rejects participant order mismatch before mutating state', () => {
  const campaign = campaignFixture();
  const first = new MutableParticipant('first', 'a');
  const second = new MutableParticipant('second', 'b');
  const coordinator = new CommonCampaignCheckpointCoordinator(campaign, [first, second]);
  const snapshot = coordinator.snapshot();
  snapshot.participants.reverse();

  assert.throws(() => coordinator.restore(snapshot), /participant set\/order mismatch/);
  assert.equal(first.state, 'a');
  assert.equal(second.state, 'b');
});
