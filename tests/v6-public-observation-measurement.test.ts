import assert from 'node:assert/strict';
import test from 'node:test';
import { PROTOCOL_VERSION, type AgentObservation } from '../src/runtime/contracts.ts';
import {
  digestPublicValue,
  measurePublicCampaignObservation,
  samePublicCampaignState,
} from '../src/runtime/v6-public-observation-measurement.ts';

function observation(
  sequence = 0,
  availableActionIds: AgentObservation['availableActionIds'] = [1, 6],
): AgentObservation {
  const pixels = new Uint8Array(64 * 64);
  pixels[10 * 64 + 11] = 9;
  pixels[10 * 64 + 12] = 9;
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'measurement-session',
    sequence,
    image: { width: 64, height: 64, pixelFormat: 'palette-index-u8', pixels },
    availableActionIds,
    state: 'NOT_FINISHED',
    level: 2,
    levelsCompleted: 1,
  };
}

test('public measurement creates visible entities and copies the worker observation', () => {
  const source = observation();
  const measured = measurePublicCampaignObservation(source);
  assert.notEqual(measured.agent.image.pixels, source.image.pixels);
  assert.notEqual(measured.rows, source.image.pixels);
  assert.equal(measured.observation.observation_ref, 'public-observation:measurement-session:0');
  assert.deepEqual(measured.observation.available_action_refs, ['ACTION1', 'ACTION6']);
  assert.deepEqual(measured.publicFrame.available_action_refs, ['ACTION1', 'ACTION6']);

  const entities = measured.observation.entities as Array<{
    palette_value: number;
    bbox: readonly [number, number, number, number];
    position: readonly [number, number];
    signature: string;
  }>;
  const colored = entities.find(entity => entity.palette_value === 9);
  assert.deepEqual(colored?.bbox, [11, 10, 12, 10]);
  assert.deepEqual(colored?.position, [11, 10]);
  assert.match(colored?.signature ?? '', /^visible-component:/);

  source.image.pixels.fill(4);
  assert.equal(measured.rows[10]?.[11], 9);
  assert.equal(measured.agent.image.pixels[10 * 64 + 11], 9);
});

test('public measurement identity changes while state equivalence remains explicit', () => {
  const first = measurePublicCampaignObservation(observation(0));
  const second = measurePublicCampaignObservation(observation(1));
  assert.notEqual(first.observation.observation_ref, second.observation.observation_ref);
  assert.equal(first.observation.frame_hash, second.observation.frame_hash);
  assert.equal(samePublicCampaignState(first, second), true);

  const changedActions = measurePublicCampaignObservation(observation(2, [6]));
  assert.equal(samePublicCampaignState(second, changedActions), false);
});

test('public digest is deterministic and sensitive to bounded visible values', () => {
  assert.equal(digestPublicValue({ b: 2, a: 1 }), digestPublicValue({ a: 1, b: 2 }));
  assert.notEqual(digestPublicValue({ a: 1 }), digestPublicValue({ a: 2 }));
});
