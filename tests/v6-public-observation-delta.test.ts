import assert from 'node:assert/strict';
import test from 'node:test';
import { PROTOCOL_VERSION, type AgentObservation } from '../src/runtime/contracts.ts';
import { RegionInterventionOwner } from '../src/logos-engine/v6-region-intervention-owner.ts';
import { comparePublicObservations } from '../src/logos-engine/v6-public-observation-delta.ts';
import { bindRegionMethod, regionPublicEffectEvidence } from '../src/logos-engine/v6-region-public-evidence.ts';

function observation(
  sequence: number,
  changes: Array<[x: number, y: number, color: number]> = [],
  overrides: Partial<AgentObservation> = {},
): AgentObservation {
  const pixels = new Uint8Array(64 * 64);
  for (const [x, y, color] of changes) pixels[y * 64 + x] = color;
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'session-1',
    sequence,
    image: { width: 64, height: 64, pixelFormat: 'palette-index-u8', pixels },
    availableActionIds: [6],
    state: 'NOT_FINISHED',
    level: 1,
    levelsCompleted: 0,
    ...overrides,
  };
}

test('unchanged public images produce no changed regions', () => {
  const delta = comparePublicObservations(observation(0), observation(1));
  assert.equal(delta.changedPixelCount, 0);
  assert.deepEqual(delta.regions, []);
  assert.equal(delta.effectKey, 'no-change');
});

test('orthogonally connected changed pixels form one measured region', () => {
  const delta = comparePublicObservations(
    observation(0),
    observation(1, [[2, 3, 4], [3, 3, 4], [3, 4, 4]]),
  );
  assert.equal(delta.changedPixelCount, 3);
  assert.equal(delta.regions.length, 1);
  assert.deepEqual(delta.regions[0]?.transitions, [{ from: 0, to: 4, count: 3 }]);
  assert.deepEqual(
    [delta.regions[0]?.minX, delta.regions[0]?.minY, delta.regions[0]?.maxX, delta.regions[0]?.maxY],
    [2, 3, 3, 4],
  );
});

test('diagonal-only changes remain separate under 4-connectivity', () => {
  const delta = comparePublicObservations(
    observation(0),
    observation(1, [[1, 1, 2], [2, 2, 2]]),
  );
  assert.equal(delta.regions.length, 2);
  assert.deepEqual(delta.regions.map(region => [region.minX, region.minY]), [[1, 1], [2, 2]]);
});

test('horizontal frame edges never wrap into one connected component', () => {
  const delta = comparePublicObservations(
    observation(0),
    observation(1, [[63, 0, 2], [0, 1, 2]]),
  );
  assert.equal(delta.changedPixelCount, 2);
  assert.deepEqual(delta.regions.map(region => [region.minX, region.minY]), [[63, 0], [0, 1]]);
});

test('region ordering and effect signature are deterministic', () => {
  const first = comparePublicObservations(
    observation(0),
    observation(1, [[10, 10, 3], [1, 1, 2]]),
  );
  const second = comparePublicObservations(
    observation(0),
    observation(1, [[1, 1, 2], [10, 10, 3]]),
  );
  assert.deepEqual(first, second);
});

test('mixed palette transitions are counted independently', () => {
  const before = observation(0, [[5, 5, 1], [6, 5, 2]]);
  const after = observation(1, [[5, 5, 3], [6, 5, 3]]);
  const delta = comparePublicObservations(before, after);
  assert.deepEqual(delta.regions[0]?.transitions, [
    { from: 1, to: 3, count: 1 },
    { from: 2, to: 3, count: 1 },
  ]);
});

test('transition ordering remains ascending across the bounded palette domain', () => {
  const before = observation(0, [[0, 0, 9], [1, 0, 2], [2, 0, 1]]);
  const after = observation(1, [[0, 0, 1], [1, 0, 3], [3, 0, 15]]);
  const delta = comparePublicObservations(before, after);
  assert.deepEqual(delta.regions[0]?.transitions, [
    { from: 0, to: 15, count: 1 },
    { from: 1, to: 0, count: 1 },
    { from: 2, to: 3, count: 1 },
    { from: 9, to: 1, count: 1 },
  ]);
});

test('a dense full-frame transition remains one bounded measured region', () => {
  const after = observation(1);
  after.image.pixels.fill(5);
  const delta = comparePublicObservations(observation(0), after);
  assert.equal(delta.changedPixelCount, 64 * 64);
  assert.equal(delta.regions.length, 1);
  assert.deepEqual(delta.regions[0], {
    ref: 'delta:0,0-63,63:4096:0>5x4096',
    minX: 0,
    minY: 0,
    maxX: 63,
    maxY: 63,
    pixelCount: 4096,
    transitions: [{ from: 0, to: 5, count: 4096 }],
  });
});

test('session mismatch and non-increasing sequence are rejected', () => {
  assert.throws(() => comparePublicObservations(
    observation(0),
    observation(1, [], { sessionId: 'session-2' }),
  ), /same session/);
  assert.throws(() => comparePublicObservations(observation(1), observation(1)), /greater than before/);
});

test('palette values above public range are rejected', () => {
  const after = observation(1);
  after.image.pixels[0] = 16;
  assert.throws(() => comparePublicObservations(observation(0), after), /palette index above 15/);
});

test('non-ACTION6 return is not treated as Region separator evidence', () => {
  assert.equal(regionPublicEffectEvidence({ id: 1 }, observation(0), observation(1, [[1, 1, 2]])), undefined);
});

test('ACTION6 no-change remains explicit but not useful for Region learning', () => {
  const evidence = regionPublicEffectEvidence({ id: 6, data: { x: 21, y: 20 } }, observation(0), observation(1));
  assert.equal(evidence?.useful, false);
  assert.equal(evidence?.separatorRef, 'action6:21:20');
  assert.equal(bindRegionMethod(evidence!, 'gate-method'), undefined);
});

test('ACTION6 changed return becomes bindable explicit Region observation', () => {
  const evidence = regionPublicEffectEvidence(
    { id: 6, data: { x: 21, y: 20 } },
    observation(0),
    observation(1, [[3, 3, 4], [4, 3, 4]]),
  )!;
  assert.equal(evidence.useful, true);
  assert.equal(evidence.separatorRef, 'action6:21:20');
  assert.equal(evidence.actionRef, 'ACTION6');
  assert.equal(evidence.levelEpoch, 'session-1:level:1');
  const bound = bindRegionMethod(evidence, 'gate-method')!;
  assert.equal(bound.methodRef, 'gate-method');
  assert.deepEqual(bound.affectedRegions, evidence.affectedRegions);
});

test('public evidence can teach Region only after explicit method binding', () => {
  const before = observation(0);
  const after = observation(1, [[3, 3, 4], [4, 3, 4]]);
  const evidence = regionPublicEffectEvidence({ id: 6, data: { x: 21, y: 20 } }, before, after)!;
  const owner = new RegionInterventionOwner();
  const bound = bindRegionMethod(evidence, 'gate-method')!;
  owner.acquire({ eventRef: 'public-return-a', source: 'passive', observation: bound });

  const proposal = owner.propose({
    methodRef: 'gate-method',
    separatorRef: 'action6:42:20',
    availableActions: ['ACTION6'],
    levelEpoch: evidence.levelEpoch,
  });
  assert.equal(proposal?.actionRef, 'ACTION6');
  assert.equal(proposal?.separatorRef, 'action6:42:20');
  assert.equal(proposal?.expectedEffectKey, evidence.effectKey);
});

test('method binding rejects missing identity rather than inventing one', () => {
  const evidence = regionPublicEffectEvidence(
    { id: 6, data: { x: 21, y: 20 } },
    observation(0),
    observation(1, [[1, 1, 2]]),
  )!;
  assert.throws(() => bindRegionMethod(evidence, ''), /methodRef/);
});
