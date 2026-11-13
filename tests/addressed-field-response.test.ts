import assert from 'node:assert/strict';
import test from 'node:test';
import {
  recordAddressedFieldResponse,
  type AddressedFieldResponseDependencies,
  type AddressedFieldResponseEntity,
  type AddressedFieldResponseState,
} from '../src/logos-engine/addressed-field-response.ts';
import type { PublicObservationLike } from '../src/logos-engine/linked-preparation.ts';

const rows = [[0, 0, 0, 0, 0]] as const;

const entity = (
  position: readonly [number, number],
  bbox: readonly [number, number, number, number] = [position[0], position[1], position[0], position[1]],
): AddressedFieldResponseEntity => ({
  signature: 'body',
  position,
  bbox,
  mask: [[0, 0]],
});

const observation = (ref: string, entities: readonly AddressedFieldResponseEntity[]): PublicObservationLike => ({
  observation_ref: ref,
  revision: 1,
  level_epoch: 1,
  levels_completed: 0,
  state: 'NOT_FINISHED',
  frame_hash: ref,
  available_action_refs: ['ACTION6'],
  entities,
});

function state(position: readonly [number, number] = [1, 0]): AddressedFieldResponseState {
  return {
    model: { signature: 'body', offset: [0, 0], position, action_ref: 'ACTION6' },
    lowerSquared: 0,
    upperSquared: null,
    calibration: 'different_offset',
    indicator: null,
    samples: [],
    events: [],
  };
}

function deps(options: {
  unchanged?: boolean;
  residual?: readonly { before: AddressedFieldResponseEntity; after: AddressedFieldResponseEntity }[];
} = {}): AddressedFieldResponseDependencies {
  return {
    unchanged: () => options.unchanged ?? false,
    residualCorrespondences: () => ({ candidates: options.residual ?? [] }),
  };
}

test('aligned addressed response raises the accepted distance bound and advances the model position', () => {
  const s = state();
  const old = entity([1, 0]);
  const next = entity([3, 0]);
  const result = recordAddressedFieldResponse(
    s,
    observation('before', [old]),
    observation('after', [next]),
    { action_ref: 'ACTION6', data: { x: 3, y: 0 } },
    rows,
    rows,
    deps({ residual: [{ before: old, after: next }] }),
    { field_plan: { experiment: 'different_offset' } },
  );

  assert.equal(result.status, 'field_response_recorded');
  assert.equal(s.lowerSquared, 4);
  assert.equal(s.upperSquared, null);
  assert.deepEqual(s.model?.position, [3, 0]);
  assert.equal(s.samples[0]?.moved_to_anchor, true);
  assert.equal(s.calibration, 'navigation');
  assert.equal(s.events[0]?.kind, 'addressed_field_response');
});

test('stationary response beyond the accepted bound records the nearest rejected distance', () => {
  const s = state();
  s.lowerSquared = 1;
  const old = entity([1, 0]);
  const same = entity([1, 0]);
  const result = recordAddressedFieldResponse(
    s,
    observation('before', [old]),
    observation('after', [same]),
    { action_ref: 'ACTION6', data: { x: 4, y: 0 } },
    rows,
    rows,
    deps({ unchanged: true }),
    { field_plan: { experiment: 'outside_indicator' } },
  );

  assert.equal(result.status, 'field_response_recorded');
  assert.equal(s.upperSquared, 9);
  assert.equal(s.samples[0]?.stationary, true);
  assert.equal(s.calibration, 'indicator_edge');
});

test('a moved response that misses the requested anchor refutes and clears the model', () => {
  const s = state();
  const old = entity([1, 0]);
  const next = entity([2, 0]);
  const result = recordAddressedFieldResponse(
    s,
    observation('before', [old]),
    observation('after', [next]),
    { action_ref: 'ACTION6', data: { x: 4, y: 0 } },
    rows,
    rows,
    deps({ residual: [{ before: old, after: next }] }),
  );

  assert.equal(result.status, 'field_refuted');
  assert.equal(s.model, null);
  assert.equal(s.events[0]?.kind, 'addressed_field_counterexample');
  assert.equal(s.events[0]?.scope, 'alignment_hypothesis_refuted');
});

test('ambiguous occurrence correspondence remains unresolved without mutating the model', () => {
  const s = state();
  const old = entity([1, 0]);
  const result = recordAddressedFieldResponse(
    s,
    observation('before', [old, entity([1, 0], [1, 0, 2, 0])]),
    observation('after', []),
    { action_ref: 'ACTION6', data: { x: 2, y: 0 } },
    rows,
    rows,
    deps({ residual: [] }),
  );

  assert.equal(result.status, 'occurrence_unresolved');
  assert.notEqual(s.model, null);
  assert.deepEqual(s.events, []);
});

test('rival predictions are classified against the actually observed anchor', () => {
  const s = state();
  const old = entity([1, 0]);
  const next = entity([3, 0]);
  recordAddressedFieldResponse(
    s,
    observation('before', [old]),
    observation('after', [next]),
    { action_ref: 'ACTION6', data: { x: 3, y: 0 } },
    rows,
    rows,
    deps({ residual: [{ before: old, after: next }] }),
    { field_plan: { rival_predictions: { alignment: [3, 0], fixed: [2, 0] } } },
  );

  assert.deepEqual(s.events[1], {
    kind: 'field_rival_comparison',
    observation: 'after',
    actual_anchor: [3, 0],
    compatible: ['alignment'],
    refuted_here: ['fixed'],
  });
});
