import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProductReadinessState } from '../src/agent-product-dispatch.ts';
import type { AddressedFieldFitEntity } from '../src/logos-engine/addressed-field-fit.ts';
import {
  CommonCampaignOwner,
  type CampaignLogosActionPayload,
} from '../src/logos-engine/v6-common-campaign-owner.ts';
import { FieldStockCallerOwnerAdapter } from '../src/logos-engine/v6-field-stock-caller-adapter.ts';
import type {
  CommonCallerAcquisition,
  CommonCallerOwner,
  CommonCallerProposal,
} from '../src/logos-engine/v6-neutral-common-caller.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import type { AgentObservation } from '../src/runtime/contracts.ts';
import { ObservedAddressedMaterialRuntime } from '../src/runtime/observed-addressed-material-runtime.ts';
import {
  BrowserCommonCampaignHost,
  BrowserFieldStockCampaignTransport,
} from '../src/runtime/v6-browser-common-campaign-host.ts';
import {
  PUBLIC_ADDRESSED_FIELD_RETURN_DEPENDENCIES,
  publicResidualCorrespondences,
} from '../src/runtime/v6-public-addressed-field-learning.ts';
import {
  completePublicCampaignEntities,
  measurePublicCampaignObservation,
} from '../src/runtime/v6-public-observation-measurement.ts';

function blankRows(): number[][] {
  return Array.from({ length: 64 }, () => Array(64).fill(0));
}

function addressedScene(mobileX: number): number[][] {
  const rows = blankRows();
  rows[1]![mobileX] = 2;
  rows[4]![1] = 2;
  rows[11]![11] = 3;
  for (let offset = 0; offset < 3; offset += 1) {
    rows[10]![10 + offset] = 8;
    rows[12]![10 + offset] = 8;
    rows[10 + offset]![10] = 8;
    rows[10 + offset]![12] = 8;
  }
  return rows;
}

function agentObservation(
  rows: number[][],
  sequence: number,
  overrides: Partial<AgentObservation> = {},
): AgentObservation {
  return {
    protocolVersion: 1,
    sessionId: 'public-addressed-learning',
    sequence,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels: Uint8Array.from(rows.flat()),
    },
    availableActionIds: [6],
    state: 'NOT_FINISHED',
    level: 1,
    levelsCompleted: 0,
    ...overrides,
  };
}

function measured(
  rows: number[][],
  sequence: number,
  overrides: Partial<AgentObservation> = {},
) {
  return completePublicCampaignEntities(
    measurePublicCampaignObservation(agentObservation(rows, sequence, overrides)),
  );
}

function sameBox(
  left: readonly [number, number, number, number],
  right: readonly [number, number, number, number],
): boolean {
  return left.every((value, index) => value === right[index]);
}

function gameObservation(
  frame: number[][],
  overrides: Partial<GameObservation> = {},
): GameObservation {
  return {
    gameCode: 'TEST',
    frame,
    frames: [frame],
    state: 'NOT_FINISHED',
    availableActionIds: [6],
    canUndo: false,
    canSelectLevel: false,
    level: 1,
    levelCount: 3,
    levelsCompleted: 0,
    defaultFps: 5,
    ...overrides,
  };
}

function productState(observation: GameObservation): ProductReadinessState {
  return {
    observation,
    selectedGameCode: observation.gameCode,
    busy: false,
    loading: false,
    failed: false,
  };
}

class AddressedOwner implements CommonCallerOwner {
  readonly id = 'explicit-addressed-owner';
  readonly acquired: CommonCallerAcquisition[] = [];

  propose(value: unknown): CommonCallerProposal | undefined {
    if (!value || typeof value !== 'object' || !('observation' in value)) return undefined;
    const current = (value as { observation: AgentObservation }).observation;
    const action = { id: 6 as const, data: { x: 2, y: 1 } };
    const observationRef = `observation:${current.sessionId}:${current.sequence}`;
    const compositionRef = `composition:${current.sessionId}:${current.sequence}`;
    const objectiveRef = `objective:${current.sessionId}`;
    const bundleId = `bundle:${current.sessionId}:${current.sequence}`;
    const payload: CampaignLogosActionPayload = {
      action,
      bundle: {
        id: bundleId,
        operation_key: 'OP28',
        composition_ref: compositionRef,
        objective_ref: objectiveRef,
        preserve_refs: [observationRef],
        observation_revision: current.sequence,
        kind: 'realize',
        actions: [action],
        purpose: 'provide one explicit addressed action for public learning',
        preconditions: { addressed_action_available: true },
        evidence: [observationRef],
        preservation_evidence: {
          [observationRef]: 'public-observation-contract-v1',
        },
        outcome_guard: { path: ['value'], contains: bundleId },
      },
      state: {
        compositions: [
          { id: observationRef, observed: true },
          { id: compositionRef, observed: true },
          { id: objectiveRef, observed: true },
        ],
        facts: { addressed_action_available: true },
        bundles: [{
          id: bundleId,
          composition_ref: compositionRef,
          admitted: true,
          actions: [action],
          evidence: observationRef,
        }],
      },
      identity: {
        episodeId: current.sessionId,
        levelEpoch: `${current.sessionId}:level:${current.level}`,
        observationId: observationRef,
        observationRevision: current.sequence,
      },
    };
    return {
      ownerId: this.id,
      proposalRef: compositionRef,
      actionRef: 'ACTION6',
      payload,
    };
  }

  acquire(event: CommonCallerAcquisition): unknown {
    this.acquired.push(structuredClone(event));
    return { acquired: true, eventRef: event.eventRef };
  }
}

test('public component identities support one strict residual movement with a stationary exemplar', () => {
  const before = measured(addressedScene(1), 0);
  const after = measured(addressedScene(2), 1);
  const beforeEntities = before.observation.entities as AddressedFieldFitEntity[];
  const mobile = beforeEntities.find(item => sameBox(item.bbox, [1, 1, 1, 1]));
  const exemplar = beforeEntities.find(item => sameBox(item.bbox, [1, 4, 1, 4]));
  assert.ok(mobile);
  assert.ok(exemplar);
  assert.equal(mobile.signature, exemplar.signature);
  assert.deepEqual(mobile.position, [1, 1]);

  const comparison = publicResidualCorrespondences(
    before.observation,
    after.observation,
    before.rows,
    after.rows,
  );
  assert.equal(comparison.candidates.length, 1);
  assert.deepEqual(comparison.candidates[0]?.before.bbox, [1, 1, 1, 1]);
  assert.deepEqual(comparison.candidates[0]?.after.bbox, [2, 1, 2, 1]);
  assert.deepEqual(
    comparison.candidates[0]?.stationary_same_signature.map(item => item.bbox),
    [[1, 4, 1, 4]],
  );
  assert.deepEqual(comparison.unresolved, []);
});

test('correlated public ACTION6 returns acquire calibrate and retain the first addressed prior', () => {
  const runtime = new ObservedAddressedMaterialRuntime();
  const first = measured(addressedScene(1), 0);
  const second = measured(addressedScene(2), 1);
  const third = measured(addressedScene(3), 2);
  const stationary = measured(addressedScene(3), 3);

  const acquired = runtime.observeAddressedReturn(
    first.observation,
    second.observation,
    { action_ref: 'ACTION6', data: { x: 2, y: 1 } },
    first.rows,
    second.rows,
    null,
    PUBLIC_ADDRESSED_FIELD_RETURN_DEPENDENCIES,
  );
  assert.equal(acquired.status, 'field_model_acquired');
  assert.equal(acquired.responseStatus, 'field_response_recorded');
  assert.equal(acquired.sampleCount, 1);
  assert.equal(runtime.status(), 'active_local_model');
  assert.deepEqual(runtime.field.model?.position, [2, 1]);
  assert.equal(runtime.field.lowerSquared, 1);

  const confirmed = runtime.observeAddressedReturn(
    second.observation,
    third.observation,
    { action_ref: 'ACTION6', data: { x: 3, y: 1 } },
    second.rows,
    third.rows,
    null,
    PUBLIC_ADDRESSED_FIELD_RETURN_DEPENDENCIES,
  );
  assert.equal(confirmed.status, 'field_response_recorded');
  assert.equal(confirmed.sampleCount, 2);
  assert.deepEqual(runtime.field.model?.position, [3, 1]);

  const bounded = runtime.observeAddressedReturn(
    third.observation,
    stationary.observation,
    { action_ref: 'ACTION6', data: { x: 7, y: 1 } },
    third.rows,
    stationary.rows,
    null,
    PUBLIC_ADDRESSED_FIELD_RETURN_DEPENDENCIES,
  );
  assert.equal(bounded.status, 'field_response_recorded');
  assert.equal(runtime.field.upperSquared, 16);
  assert.equal(runtime.field.samples.filter(sample => sample.moved_to_anchor).length, 2);

  const nextLevel = measured(blankRows(), 4, { level: 2, levelsCompleted: 1 });
  assert.deepEqual(
    runtime.boundary(stationary.observation, nextLevel.observation),
    { crossed: true, officialBoundary: 1 },
  );
  assert.equal(runtime.field.model, null);
  assert.equal(runtime.status(), 'retained_pending_revalidation');
  assert.equal(runtime.field.prior?.lower_squared, 1);
  assert.equal(runtime.field.prior?.upper_squared, 16);
  assert.equal(runtime.field.prior?.class_templates?.['2']?.alignment_supported, true);
});

test('browser host learns only after the explicit ACTION6 owner acquires its own return', async () => {
  const runtime = new ObservedAddressedMaterialRuntime();
  const fieldOwner = new FieldStockCallerOwnerAdapter(runtime);
  const addressedOwner = new AddressedOwner();
  const fieldTransport = new BrowserFieldStockCampaignTransport({ runtime });
  const campaign = new CommonCampaignOwner([fieldOwner, addressedOwner]);
  const host = new BrowserCommonCampaignHost({
    campaign,
    ownerTransports: [
      fieldTransport,
      {
        ownerId: addressedOwner.id,
        context: input => ({ observation: input.agentObservation }),
        returnPayload: input => ({ observation: input.afterAgentObservation }),
      },
    ],
  });
  const initial = gameObservation(addressedScene(1));
  const returned = gameObservation(addressedScene(2));
  host.begin({ sessionId: 'public-addressed-learning', observation: initial });
  const order: string[] = [];

  const result = await host.run(productState(initial), {
    action: async (action, data) => {
      order.push(`action:${action}:${JSON.stringify(data)}`);
      return returned;
    },
    present: async () => { order.push('present'); },
    now: (() => { let value = 0; return () => value++; })(),
    generation: () => 1,
    setBusy: () => {},
    onCampaignAcquired: () => { order.push('campaign-acquired'); },
  });

  assert.equal(result.status, 'action');
  assert.equal(result.preparation?.status, 'action');
  if (result.preparation?.status !== 'action') return;
  assert.equal(result.preparation.ownerId, addressedOwner.id);
  assert.equal(addressedOwner.acquired.length, 1);
  assert.equal(result.acquisition?.ownerId, addressedOwner.id);
  assert.equal(fieldTransport.lastAddressedLearningStatus?.status, 'field_model_acquired');
  assert.equal(runtime.status(), 'active_local_model');
  assert.equal(runtime.field.samples.length, 1);
  assert.deepEqual(order, [
    'action:6:{"x":2,"y":1}',
    'campaign-acquired',
    'present',
  ]);
});