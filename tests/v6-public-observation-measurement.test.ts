import assert from 'node:assert/strict';
import test from 'node:test';
import { PROTOCOL_VERSION, type AgentObservation } from '../src/runtime/contracts.ts';
import {
  completePublicCampaignEntities,
  digestPublicValue,
  measurePublicCampaignObservation,
} from '../src/runtime/v6-public-observation-measurement.ts';

function observation(sequence = 0): AgentObservation {
  const pixels = new Uint8Array(64 * 64);
  pixels[10 * 64 + 11] = 9;
  pixels[10 * 64 + 12] = 9;
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'measurement-session',
    sequence,
    image: { width: 64, height: 64, pixelFormat: 'palette-index-u8', pixels },
    availableActionIds: [1, 6],
    state: 'NOT_FINISHED',
    level: 2,
    levelsCompleted: 1,
  };
}

test('public campaign measurement copies the worker contract and defers entities', () => {
  const source = observation();
  const measured = measurePublicCampaignObservation(source);
  assert.notEqual(measured.agent.image.pixels, source.image.pixels);
  assert.equal(measured.observation.observation_ref, 'public-observation:measurement-session:0');
  assert.deepEqual(measured.observation.available_action_refs, ['ACTION1', 'ACTION6']);
  assert.equal(measured.observation.entities, undefined);

  source.image.pixels.fill(4);
  assert.equal(measured.rows[10]?.[11], 9);
  assert.equal(measured.agent.image.pixels[10 * 64 + 11], 9);
});

test('retained FieldStock revalidation can materialize bounded visible components', () => {
  const measured = completePublicCampaignEntities(
    measurePublicCampaignObservation(observation()),
  );
  const entities = measured.observation.entities as MeasuredEntity[];
  const colored = entities.find(entity => entity.palette_value === 9);
  assert.deepEqual(colored?.bbox, [11, 10, 12, 10]);
  assert.equal(colored?.rectangular, true);
  assert.deepEqual(colored?.mask, [[0, 0], [1, 0]]);
  assert.match(colored?.component_ref ?? '', /:component:/);
});

test('public digest is deterministic and sensitive to bounded visible values', () => {
  assert.equal(digestPublicValue({ b: 2, a: 1 }), digestPublicValue({ a: 1, b: 2 }));
  assert.notEqual(digestPublicValue({ a: 1 }), digestPublicValue({ a: 2 }));
});

test('public measurement rejects palette values outside the public ARC range', () => {
  const invalid = observation();
  invalid.image.pixels[0] = 16;
  assert.throws(() => measurePublicCampaignObservation(invalid), /palette indices/);
});

interface MeasuredEntity {
  component_ref: string;
  palette_value: number;
  bbox: readonly [number, number, number, number];
  mask: readonly (readonly [number, number])[];
  rectangular: boolean;
}
