import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REGION_INTERVENTION_LIMITS,
  RegionInterventionModel,
} from '../src/logos-engine/v6-region-intervention.ts';

function observation(overrides: Partial<Parameters<RegionInterventionModel['observe']>[0]> = {}) {
  return {
    methodRef: 'gate-method',
    separatorRef: 'gate-a',
    actionRef: 'ACTION6',
    affectedRegions: ['left', 'right'],
    effectKey: 'partition-flipped',
    levelEpoch: 1,
    observationRevision: 1,
    ...overrides,
  };
}

test('Region does not propose before an observed regional effect', () => {
  const model = new RegionInterventionModel();
  assert.equal(model.propose({
    methodRef: 'gate-method',
    separatorRef: 'gate-b',
    availableActions: ['ACTION6'],
    levelEpoch: 1,
  }), undefined);
});

test('first useful observation learns a reusable explicit method', () => {
  const model = new RegionInterventionModel();
  assert.deepEqual(model.observe(observation()), {
    status: 'learned',
    methodRef: 'gate-method',
  });
  assert.deepEqual(model.propose({
    methodRef: 'gate-method',
    separatorRef: 'gate-b',
    availableActions: ['ACTION6'],
    levelEpoch: 1,
  }), {
    methodRef: 'gate-method',
    separatorRef: 'gate-b',
    actionRef: 'ACTION6',
    expectedEffectKey: 'partition-flipped',
    expectedAffectedRegions: ['left', 'right'],
    evidenceCount: 1,
  });
});

test('affected-region input order does not create a contradiction', () => {
  const model = new RegionInterventionModel();
  model.observe(observation());
  assert.equal(model.observe(observation({
    separatorRef: 'gate-c',
    affectedRegions: ['right', 'left'],
    observationRevision: 2,
  })).status, 'confirmed');
  assert.equal(model.get('gate-method')?.contradicted, false);
});

test('stale evidence does not overwrite current evidence', () => {
  const model = new RegionInterventionModel();
  model.observe(observation({ observationRevision: 4 }));
  assert.equal(model.observe(observation({
    effectKey: 'different',
    observationRevision: 3,
  })).status, 'stale');
  assert.equal(model.get('gate-method')?.contradicted, false);
});

test('contrary observed effect invalidates the learned continuation', () => {
  const model = new RegionInterventionModel();
  model.observe(observation());
  assert.equal(model.observe(observation({
    separatorRef: 'gate-b',
    effectKey: 'partition-unchanged',
    observationRevision: 2,
  })).status, 'contradicted');
  assert.equal(model.propose({
    methodRef: 'gate-method',
    separatorRef: 'gate-c',
    availableActions: ['ACTION6'],
    levelEpoch: 1,
  }), undefined);
  assert.equal(model.get('gate-method')?.contradictions.length, 1);
});

test('contrary affected-region set invalidates the method', () => {
  const model = new RegionInterventionModel();
  model.observe(observation());
  assert.equal(model.observe(observation({
    separatorRef: 'gate-b',
    affectedRegions: ['left'],
    observationRevision: 2,
  })).status, 'contradicted');
});

test('unavailable action blocks proposal', () => {
  const model = new RegionInterventionModel();
  model.observe(observation());
  assert.equal(model.propose({
    methodRef: 'gate-method',
    separatorRef: 'gate-b',
    availableActions: ['ACTION1'],
    levelEpoch: 1,
  }), undefined);
});

test('different methodRef is never inferred as equivalent', () => {
  const model = new RegionInterventionModel();
  model.observe(observation());
  assert.equal(model.propose({
    methodRef: 'visually-similar-but-unproved',
    separatorRef: 'gate-b',
    availableActions: ['ACTION6'],
    levelEpoch: 1,
  }), undefined);
});

test('method scope is limited to its level epoch', () => {
  const model = new RegionInterventionModel();
  model.observe(observation());
  assert.equal(model.propose({
    methodRef: 'gate-method',
    separatorRef: 'gate-b',
    availableActions: ['ACTION6'],
    levelEpoch: 2,
  }), undefined);
});

test('a separator already used as evidence is not proposed again', () => {
  const model = new RegionInterventionModel();
  model.observe(observation());
  assert.equal(model.propose({
    methodRef: 'gate-method',
    separatorRef: 'gate-a',
    availableActions: ['ACTION6'],
    levelEpoch: 1,
  }), undefined);
});

test('snapshot and restore preserve exact decision state', () => {
  const original = new RegionInterventionModel();
  original.observe(observation());
  original.observe(observation({
    separatorRef: 'gate-c',
    observationRevision: 2,
  }));

  const snapshot = original.snapshot();
  const restored = new RegionInterventionModel();
  restored.restore(snapshot);

  assert.deepEqual(restored.snapshot(), snapshot);
  assert.deepEqual(restored.propose({
    methodRef: 'gate-method',
    separatorRef: 'gate-b',
    availableActions: ['ACTION6'],
    levelEpoch: 1,
  }), original.propose({
    methodRef: 'gate-method',
    separatorRef: 'gate-b',
    availableActions: ['ACTION6'],
    levelEpoch: 1,
  }));
});

test('empty and oversized affected-region evidence is rejected', () => {
  const model = new RegionInterventionModel();
  assert.throws(() => model.observe(observation({ affectedRegions: [] })), /at least one region/);
  assert.throws(() => model.observe(observation({
    affectedRegions: Array.from(
      { length: REGION_INTERVENTION_LIMITS.maxAffectedRegions + 1 },
      (_, index) => `r-${index}`,
    ),
  })), /exceeds/);
});

test('invalid snapshot is rejected without mutating existing state', () => {
  const model = new RegionInterventionModel();
  model.observe(observation());
  const before = model.snapshot();

  assert.throws(() => model.restore({
    version: 1,
    methods: [
      ...before.methods,
      structuredClone(before.methods[0]!),
    ],
  }), /duplicate Region method/);

  assert.deepEqual(model.snapshot(), before);
});
