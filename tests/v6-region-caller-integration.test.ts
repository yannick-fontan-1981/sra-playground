import assert from 'node:assert/strict';
import test from 'node:test';
import { NeutralCommonCaller } from '../src/logos-engine/v6-neutral-common-caller.ts';
import { RegionCallerOwnerAdapter } from '../src/logos-engine/v6-region-caller-adapter.ts';

function observedReturn(separatorRef: string, revision: number, effectKey = 'partition-flipped') {
  return {
    observation: {
      methodRef: 'gate-method',
      separatorRef,
      actionRef: 'ACTION6',
      affectedRegions: ['left', 'right'],
      effectKey,
      levelEpoch: 1,
      observationRevision: revision,
    },
  };
}

test('Region may learn passively, propose through caller, then acquire selected return once', () => {
  const caller = new NeutralCommonCaller();
  const region = new RegionCallerOwnerAdapter();
  caller.register(region);

  const passive = caller.routePassive(
    ['public_region_intervention'],
    'return-a',
    { public_region_intervention: observedReturn('gate-a', 1) },
  );
  assert.equal(passive[0]?.routed, true);
  assert.equal(region.region.model.get('gate-method')?.evidence.length, 1);

  const proposals = caller.collect({
    public_region_intervention: {
      candidate: {
        methodRef: 'gate-method',
        separatorRef: 'gate-b',
        availableActions: ['ACTION6'],
        levelEpoch: 1,
      },
    },
  });
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0]?.ownerId, 'public_region_intervention');
  assert.equal(proposals[0]?.actionRef, 'ACTION6');

  const selection = caller.select(proposals);
  assert.equal(selection.status, 'selected');
  const selected = caller.routeSelected(selection, 'return-b', observedReturn('gate-b', 2));
  assert.equal(selected.routed, true);
  assert.equal(region.region.model.get('gate-method')?.evidence.length, 2);

  const duplicate = caller.routePassive(
    ['public_region_intervention'],
    'return-b',
    { public_region_intervention: observedReturn('gate-b', 2) },
  );
  assert.equal(duplicate[0]?.duplicate, true);
  assert.equal(region.region.model.get('gate-method')?.evidence.length, 2);
});

test('contradictory selected Region return stops future Region proposals', () => {
  const caller = new NeutralCommonCaller();
  const region = new RegionCallerOwnerAdapter();
  caller.register(region);

  caller.routePassive(
    ['public_region_intervention'],
    'return-a',
    { public_region_intervention: observedReturn('gate-a', 1) },
  );

  const selection = caller.select(caller.collect({
    public_region_intervention: {
      candidate: {
        methodRef: 'gate-method',
        separatorRef: 'gate-b',
        availableActions: ['ACTION6'],
        levelEpoch: 1,
      },
    },
  }));
  assert.equal(selection.status, 'selected');
  caller.routeSelected(selection, 'return-b', observedReturn('gate-b', 2, 'partition-unchanged'));

  const after = caller.collect({
    public_region_intervention: {
      candidate: {
        methodRef: 'gate-method',
        separatorRef: 'gate-c',
        availableActions: ['ACTION6'],
        levelEpoch: 1,
      },
    },
  });
  assert.deepEqual(after, []);
  assert.equal(region.region.model.get('gate-method')?.contradicted, true);
});

test('missing Region context yields no proposal instead of invented exploration', () => {
  const caller = new NeutralCommonCaller();
  caller.register(new RegionCallerOwnerAdapter());
  assert.deepEqual(caller.collect({}), []);
});
