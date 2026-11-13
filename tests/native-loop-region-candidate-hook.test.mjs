import assert from 'node:assert/strict';
import test from 'node:test';

import { createRegionInterventionCandidateHook } from '../scripts/native-loop-region-candidate-hook.mjs';

function frame(fill = 0) {
  return Array.from({ length: 64 }, () => Array(64).fill(fill));
}

function publicObservation(overrides = {}) {
  return {
    code: 'STCK',
    gameId: 'stck-c0000001',
    backend: 'python-wasm',
    frame: frame(0),
    state: 'NOT_FINISHED',
    level: 1,
    levelCount: 6,
    levelsCompleted: 0,
    availableActionIds: [5, 6, 7],
    ...overrides,
  };
}

function descriptor() {
  return {
    invocationIndex: 7,
    series: 'B1',
    variant: 'B',
    game: 'STCK',
    kind: 'measured',
    sessionIndex: 0,
    actions: 10,
  };
}

test('real Region candidate hook is a strict no-op for non-ACTION6 corpus actions', async () => {
  let methodCalls = 0;
  const hook = createRegionInterventionCandidateHook({
    methodRefFor: async () => {
      methodCalls += 1;
      return 'method-x';
    },
  });
  const before = publicObservation();

  hook.beforeAction({ action: { id: 5 } });
  const result = await hook.afterAction({
    index: 0,
    action: { id: 5 },
    beforeObservation: before,
    observation: before,
    descriptor: descriptor(),
  });

  assert.equal(result.status, 'not-applicable');
  assert.equal(methodCalls, 0);
  assert.equal(hook.owner.model.size, 0);
  assert.deepEqual(hook.stats, {
    actionsSeen: 1,
    action6Seen: 0,
    usefulAction6Evidence: 0,
    boundEvidence: 0,
    acquisitions: 0,
  });
});

test('real Region candidate hook binds useful ACTION6 public delta into RegionInterventionOwner', async () => {
  const hook = createRegionInterventionCandidateHook({
    methodRefFor: async ({ evidence }) => {
      assert.equal(evidence.separatorRef, 'action6:10:20');
      return 'explicit-method-1';
    },
  });
  const before = publicObservation();
  const afterFrame = frame(0);
  afterFrame[20][10] = 8;
  const after = publicObservation({ frame: afterFrame });

  hook.beforeAction({ action: { id: 6, x: 10, y: 20 } });
  const result = await hook.afterAction({
    index: 0,
    action: { id: 6, x: 10, y: 20 },
    beforeObservation: before,
    observation: after,
    descriptor: descriptor(),
  });

  assert.equal(result.status, 'learned');
  assert.equal(hook.owner.model.size, 1);
  const learned = hook.owner.model.get('explicit-method-1');
  assert.equal(learned?.actionRef, 'ACTION6');
  assert.equal(learned?.evidence.length, 1);
  assert.deepEqual(hook.stats, {
    actionsSeen: 1,
    action6Seen: 1,
    usefulAction6Evidence: 1,
    boundEvidence: 1,
    acquisitions: 1,
  });
});

test('identity-only method binding omits full observations while preserving explicit identity', async () => {
  let methodInput;
  const hook = createRegionInterventionCandidateHook({
    methodRefInput: 'identity',
    cacheFrames: true,
    methodRefFor: input => {
      methodInput = input;
      return `identity-${input.descriptor.game}-${input.descriptor.invocationIndex}-${input.index}`;
    },
  });
  const sharedBeforeFrame = frame(0);
  const afterFrame = frame(0);
  afterFrame[4][3] = 7;

  hook.beforeAction({ action: { id: 6, x: 3, y: 4 } });
  const result = await hook.afterAction({
    index: 2,
    action: { id: 6, x: 3, y: 4 },
    beforeObservation: publicObservation({ frame: sharedBeforeFrame }),
    observation: publicObservation({ frame: afterFrame }),
    descriptor: descriptor(),
  });

  assert.equal(result.status, 'learned');
  assert.deepEqual(methodInput, {
    index: 2,
    descriptor: {
      invocationIndex: 7,
      variant: 'B',
      game: 'STCK',
    },
  });
  assert.equal('beforeObservation' in methodInput, false);
  assert.equal('observation' in methodInput, false);
  assert.equal('evidence' in methodInput, false);
  assert.equal(hook.owner.model.has('identity-STCK-7-2'), true);
});

test('useful ACTION6 evidence stays unbound when no external methodRef producer is supplied', async () => {
  const hook = createRegionInterventionCandidateHook();
  const before = publicObservation();
  const afterFrame = frame(0);
  afterFrame[1][1] = 3;

  hook.beforeAction({ action: { id: 6, x: 1, y: 1 } });
  const result = await hook.afterAction({
    index: 0,
    action: { id: 6, x: 1, y: 1 },
    beforeObservation: before,
    observation: publicObservation({ frame: afterFrame }),
    descriptor: descriptor(),
  });

  assert.equal(result.status, 'unbound-method');
  assert.equal(hook.owner.model.size, 0);
  assert.equal(hook.stats.usefulAction6Evidence, 1);
  assert.equal(hook.stats.boundEvidence, 0);
});

test('real Region hook rejects invented or malformed methodRef output', async () => {
  const hook = createRegionInterventionCandidateHook({ methodRefFor: async () => '' });
  const before = publicObservation();
  const afterFrame = frame(0);
  afterFrame[2][2] = 4;

  hook.beforeAction({ action: { id: 6, x: 2, y: 2 } });
  await assert.rejects(
    hook.afterAction({
      index: 0,
      action: { id: 6, x: 2, y: 2 },
      beforeObservation: before,
      observation: publicObservation({ frame: afterFrame }),
      descriptor: descriptor(),
    }),
    /non-empty string or undefined/,
  );
});

test('Region hook rejects unsupported method input and frame-cache options', () => {
  assert.throws(
    () => createRegionInterventionCandidateHook({ methodRefInput: 'unknown' }),
    /methodRefInput/,
  );
  assert.throws(
    () => createRegionInterventionCandidateHook({ cacheFrames: 'yes' }),
    /cacheFrames/,
  );
});
