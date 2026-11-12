import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RegionInterventionOwner,
  type RegionAcquisitionEvent,
} from '../src/logos-engine/v6-region-intervention-owner.ts';

function event(overrides: Partial<RegionAcquisitionEvent> = {}): RegionAcquisitionEvent {
  return {
    eventRef: 'event-1',
    source: 'selected',
    observation: {
      methodRef: 'gate-method',
      separatorRef: 'gate-a',
      actionRef: 'ACTION6',
      affectedRegions: ['left', 'right'],
      effectKey: 'partition-flipped',
      levelEpoch: 1,
      observationRevision: 1,
    },
    ...overrides,
  };
}

test('selected return is acquired once and enables a Region proposal', () => {
  const owner = new RegionInterventionOwner();
  assert.deepEqual(owner.acquire(event()), {
    acquired: true,
    duplicate: false,
    eventRef: 'event-1',
    source: 'selected',
    status: 'learned',
  });

  assert.deepEqual(owner.propose({
    methodRef: 'gate-method',
    separatorRef: 'gate-b',
    availableActions: ['ACTION6'],
    levelEpoch: 1,
  }), {
    owner: 'public_region_intervention',
    methodRef: 'gate-method',
    separatorRef: 'gate-b',
    actionRef: 'ACTION6',
    expectedEffectKey: 'partition-flipped',
    expectedAffectedRegions: ['left', 'right'],
    evidenceCount: 1,
  });
});

test('passive return can teach Region without claiming Region selected the action', () => {
  const owner = new RegionInterventionOwner();
  const receipt = owner.acquire(event({
    eventRef: 'passive-1',
    source: 'passive',
  }));
  assert.equal(receipt.acquired, true);
  assert.equal(receipt.source, 'passive');
  assert.equal(owner.propose({
    methodRef: 'gate-method',
    separatorRef: 'gate-b',
    availableActions: ['ACTION6'],
    levelEpoch: 1,
  })?.owner, 'public_region_intervention');
});

test('same physical return is never acquired twice even through another path', () => {
  const owner = new RegionInterventionOwner();
  assert.equal(owner.acquire(event()).acquired, true);
  assert.deepEqual(owner.acquire(event({ source: 'passive' })), {
    acquired: false,
    duplicate: true,
    eventRef: 'event-1',
    source: 'passive',
  });
  assert.equal(owner.acquiredCount, 1);
  assert.equal(owner.model.get('gate-method')?.evidence.length, 1);
});

test('contradictory acquired return invalidates future proposals', () => {
  const owner = new RegionInterventionOwner();
  owner.acquire(event());
  owner.acquire(event({
    eventRef: 'event-2',
    source: 'passive',
    observation: {
      ...event().observation,
      separatorRef: 'gate-b',
      effectKey: 'partition-unchanged',
      observationRevision: 2,
    },
  }));

  assert.equal(owner.propose({
    methodRef: 'gate-method',
    separatorRef: 'gate-c',
    availableActions: ['ACTION6'],
    levelEpoch: 1,
  }), undefined);
});

test('owner snapshot restores both Region state and acquisition dedupe state', () => {
  const first = new RegionInterventionOwner();
  first.acquire(event());
  const snapshot = first.snapshot();

  const restored = new RegionInterventionOwner();
  restored.restore(snapshot);
  assert.deepEqual(restored.snapshot(), snapshot);
  assert.equal(restored.hasAcquired('event-1'), true);
  assert.equal(restored.acquire(event()).duplicate, true);
});

test('invalid owner snapshot does not destroy existing Region state', () => {
  const owner = new RegionInterventionOwner();
  owner.acquire(event());
  const before = owner.snapshot();

  assert.throws(() => owner.restore({
    ...before,
    acquiredEventRefs: ['event-1', 'event-1'],
  }), /duplicate acquired Region event ref/);

  assert.deepEqual(owner.snapshot(), before);
});
