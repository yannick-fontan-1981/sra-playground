import assert from 'node:assert/strict';
import test from 'node:test';

import { createAStckNativeRunner, createASmlpNativeRunner, EXPLICIT_NATIVE_RUNNER_IDENTITIES } from '../scripts/native-loop-explicit-runners.mjs';

function observation(overrides = {}) {
  return {
    code: 'STCK',
    gameId: 'stck-c0000001',
    backend: 'python-wasm',
    state: 'NOT_FINISHED',
    level: 1,
    levelCount: 6,
    availableActionIds: [5, 6, 7],
    ...overrides,
  };
}

test('A/STCK binds load level 1 and executes the exact requested native bridge actions', async () => {
  const requests = [];
  const dispatch = async request => {
    requests.push(structuredClone(request));
    return observation();
  };
  const runner = createAStckNativeRunner({
    dispatch,
    sourceRef: 'recovery/site109-reconstruction-20261112@test',
  });

  const sample = await runner({
    invocationIndex: 0,
    series: 'A1',
    variant: 'A',
    game: 'STCK',
    kind: 'measured',
    sessionIndex: 0,
    actions: 10,
  });

  assert.deepEqual(requests[0], { type: 'load', code: 'STCK', level: 1 });
  assert.deepEqual(
    requests.slice(1),
    Array.from({ length: 10 }, () => ({ type: 'action', actionId: 5 })),
  );
  assert.equal(sample.metadata.runnerRef, 'public-corpus-runner:A/STCK');
  assert.equal(sample.metadata.sourceRef, 'recovery/site109-reconstruction-20261112@test');
  assert.equal(sample.metadata.seed, 0);
  assert.equal(sample.metadata.actions.length, 10);
});

test('A/STCK refuses a transport that is not the durable python-wasm game bridge identity', async () => {
  const runner = createAStckNativeRunner({
    dispatch: async () => observation({ backend: 'fake' }),
    sourceRef: 'source:A',
  });
  await assert.rejects(
    runner({
      invocationIndex: 0,
      series: 'A1',
      variant: 'A',
      game: 'STCK',
      kind: 'warmup',
      sessionIndex: 0,
      actions: 3,
    }),
    /backend mismatch/,
  );
});

test('A/STCK refuses game identity drift instead of silently substituting a runner', async () => {
  const runner = createAStckNativeRunner({
    dispatch: async () => observation({ gameId: 'smlp-c3000001' }),
    sourceRef: 'source:A',
  });
  await assert.rejects(
    runner({
      invocationIndex: 0,
      series: 'A1',
      variant: 'A',
      game: 'STCK',
      kind: 'warmup',
      sessionIndex: 0,
      actions: 3,
    }),
    /gameId mismatch/,
  );
});

test('explicit A/STCK identity is durable and still marked pending real native execution', () => {
  assert.deepEqual(EXPLICIT_NATIVE_RUNNER_IDENTITIES.A_STCK, {
    variant: 'A',
    game: 'STCK',
    gameId: 'stck-c0000001',
    corpusRef: 'native-public-action-corpus-v1',
    seed: 0,
    startLevel: 1,
    backend: 'python-wasm',
    status: 'reconstructed-contract-pending-real-native-execution',
  });
});


function smlpObservation(overrides = {}) {
  return {
    code: 'SMLP',
    gameId: 'smlp-c3000001',
    backend: 'python-wasm',
    state: 'NOT_FINISHED',
    level: 1,
    levelCount: 6,
    availableActionIds: [5, 6, 7],
    ...overrides,
  };
}

test('A/SMLP binds load level 1 and executes the exact 15-action native bridge session', async () => {
  const requests = [];
  const runner = createASmlpNativeRunner({
    dispatch: async request => {
      requests.push(structuredClone(request));
      return smlpObservation();
    },
    sourceRef: 'recovery/site109-reconstruction-20261112@test',
  });

  const sample = await runner({
    invocationIndex: 0,
    series: 'A1',
    variant: 'A',
    game: 'SMLP',
    kind: 'measured',
    sessionIndex: 0,
    actions: 15,
  });

  assert.deepEqual(requests[0], { type: 'load', code: 'SMLP', level: 1 });
  assert.deepEqual(
    requests.slice(1),
    Array.from({ length: 15 }, () => ({ type: 'action', actionId: 5 })),
  );
  assert.equal(sample.metadata.runnerRef, 'public-corpus-runner:A/SMLP');
  assert.equal(sample.metadata.sourceRef, 'recovery/site109-reconstruction-20261112@test');
  assert.equal(sample.metadata.seed, 0);
  assert.equal(sample.metadata.actions.length, 15);
});

test('A/SMLP refuses STCK identity drift', async () => {
  const runner = createASmlpNativeRunner({
    dispatch: async () => smlpObservation({ gameId: 'stck-c0000001' }),
    sourceRef: 'source:A',
  });
  await assert.rejects(
    runner({
      invocationIndex: 0,
      series: 'A1',
      variant: 'A',
      game: 'SMLP',
      kind: 'warmup',
      sessionIndex: 0,
      actions: 3,
    }),
    /gameId mismatch/,
  );
});

test('explicit A/SMLP identity is durable and pending real native execution', () => {
  assert.deepEqual(EXPLICIT_NATIVE_RUNNER_IDENTITIES.A_SMLP, {
    variant: 'A',
    game: 'SMLP',
    gameId: 'smlp-c3000001',
    corpusRef: 'native-public-action-corpus-v1',
    seed: 0,
    startLevel: 1,
    backend: 'python-wasm',
    status: 'reconstructed-contract-pending-real-native-execution',
  });
});
