import assert from 'node:assert/strict';
import test from 'node:test';
import { createNativeLoopRunSession } from '../scripts/native-loop-session-adapter.mjs';

import { createAStckNativeRunner, createASmlpNativeRunner, createBStckNativeRunner, createBSmlpNativeRunner, EXPLICIT_NATIVE_RUNNER_IDENTITIES } from '../scripts/native-loop-explicit-runners.mjs';

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


test('B/STCK uses the same native bridge session and calls only the explicit region_intervention hook', async () => {
  const requests = [];
  const hooks = [];
  const runner = createBStckNativeRunner({
    dispatch: async request => {
      requests.push(structuredClone(request));
      return observation();
    },
    sourceRef: 'candidate:region_intervention',
    candidateHook: {
      id: 'region_intervention',
      beforeAction: async event => hooks.push(structuredClone(event)),
    },
  });

  const sample = await runner({
    invocationIndex: 0,
    series: 'B1',
    variant: 'B',
    game: 'STCK',
    kind: 'measured',
    sessionIndex: 0,
    actions: 10,
  });

  assert.deepEqual(requests[0], { type: 'load', code: 'STCK', level: 1 });
  assert.equal(requests.length, 11);
  assert.equal(hooks.length, 10);
  assert.ok(hooks.every(event => event.action.id === 5));
  assert.equal(sample.metadata.runnerRef, 'public-corpus-runner:B/STCK');
  assert.equal(sample.metadata.sourceRef, 'candidate:region_intervention');
});

test('B/SMLP uses the identical transport/corpus shape with its own game identity', async () => {
  let hooks = 0;
  const requests = [];
  const runner = createBSmlpNativeRunner({
    dispatch: async request => {
      requests.push(structuredClone(request));
      return smlpObservation();
    },
    sourceRef: 'candidate:region_intervention',
    candidateHook: {
      id: 'region_intervention',
      beforeAction: async () => { hooks += 1; },
    },
  });

  const sample = await runner({
    invocationIndex: 0,
    series: 'B1',
    variant: 'B',
    game: 'SMLP',
    kind: 'measured',
    sessionIndex: 0,
    actions: 15,
  });

  assert.deepEqual(requests[0], { type: 'load', code: 'SMLP', level: 1 });
  assert.equal(requests.length, 16);
  assert.equal(hooks, 15);
  assert.equal(sample.metadata.runnerRef, 'public-corpus-runner:B/SMLP');
});

test('B runners fail closed when the candidate hook is missing or mislabeled', () => {
  assert.throws(
    () => createBStckNativeRunner({ dispatch: async () => observation(), sourceRef: 'candidate' }),
    /requires an explicit region_intervention candidate hook/,
  );
  assert.throws(
    () => createBStckNativeRunner({
      dispatch: async () => observation(),
      sourceRef: 'candidate',
      candidateHook: { id: 'other', beforeAction() {} },
    }),
    /must be region_intervention/,
  );
});

test('all four explicit runner identities are present with A/B kept distinct', () => {
  assert.deepEqual(Object.keys(EXPLICIT_NATIVE_RUNNER_IDENTITIES).sort(), ['A_SMLP', 'A_STCK', 'B_SMLP', 'B_STCK']);
  assert.equal(EXPLICIT_NATIVE_RUNNER_IDENTITIES.B_STCK.gameId, EXPLICIT_NATIVE_RUNNER_IDENTITIES.A_STCK.gameId);
  assert.equal(EXPLICIT_NATIVE_RUNNER_IDENTITIES.B_SMLP.gameId, EXPLICIT_NATIVE_RUNNER_IDENTITIES.A_SMLP.gameId);
  assert.equal(EXPLICIT_NATIVE_RUNNER_IDENTITIES.B_STCK.backend, EXPLICIT_NATIVE_RUNNER_IDENTITIES.A_STCK.backend);
  assert.equal(EXPLICIT_NATIVE_RUNNER_IDENTITIES.B_SMLP.corpusRef, EXPLICIT_NATIVE_RUNNER_IDENTITIES.A_SMLP.corpusRef);
  assert.equal(EXPLICIT_NATIVE_RUNNER_IDENTITIES.B_STCK.candidateHook, 'region_intervention');
  assert.equal(EXPLICIT_NATIVE_RUNNER_IDENTITIES.B_SMLP.candidateHook, 'region_intervention');
});


test('native runSession routes descriptors to all four explicit runners without silent substitution', async () => {
  const seen = [];
  const makeDispatch = (variant, game) => async request => {
    seen.push(`${variant}/${game}:${request.type}`);
    return game === 'STCK' ? observation() : smlpObservation();
  };
  const candidateHook = {
    id: 'region_intervention',
    beforeAction: async () => {},
  };
  const runSession = createNativeLoopRunSession({
    A: {
      STCK: createAStckNativeRunner({ dispatch: makeDispatch('A', 'STCK'), sourceRef: 'source:A' }),
      SMLP: createASmlpNativeRunner({ dispatch: makeDispatch('A', 'SMLP'), sourceRef: 'source:A' }),
    },
    B: {
      STCK: createBStckNativeRunner({ dispatch: makeDispatch('B', 'STCK'), sourceRef: 'source:B', candidateHook }),
      SMLP: createBSmlpNativeRunner({ dispatch: makeDispatch('B', 'SMLP'), sourceRef: 'source:B', candidateHook }),
    },
  });

  await runSession({ invocationIndex: 0, series: 'A1', variant: 'A', game: 'STCK', kind: 'warmup', sessionIndex: 0, actions: 3 });
  await runSession({ invocationIndex: 1, series: 'A1', variant: 'A', game: 'SMLP', kind: 'warmup', sessionIndex: 0, actions: 3 });
  await runSession({ invocationIndex: 2, series: 'B1', variant: 'B', game: 'STCK', kind: 'warmup', sessionIndex: 0, actions: 3 });
  await runSession({ invocationIndex: 3, series: 'B1', variant: 'B', game: 'SMLP', kind: 'warmup', sessionIndex: 0, actions: 3 });

  const loads = seen.filter(item => item.endsWith(':load'));
  assert.deepEqual(loads, ['A/STCK:load', 'A/SMLP:load', 'B/STCK:load', 'B/SMLP:load']);
});
