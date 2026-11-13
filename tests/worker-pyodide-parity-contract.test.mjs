import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertWorkerPyodideParity,
  WORKER_PYODIDE_PARITY_PLAN,
} from '../scripts/worker-pyodide-parity-contract.mjs';

function sample(overrides = {}) {
  return {
    game: 'STCK',
    actionsRequested: 1,
    gameId: 'stck-c0000001',
    backend: 'runtime-specific',
    initial: {
      frameHash: 'initial-hash',
      availableActionIds: [5, 6, 7],
      state: 'NOT_FINISHED',
      level: 1,
      levelsCompleted: 0,
    },
    steps: [{
      action: { id: 6, x: 4, y: 52 },
      changedPixelCount: 211,
      frameHash: 'after-hash',
      availableActionIds: [5, 6, 7],
      state: 'NOT_FINISHED',
      level: 1,
      levelsCompleted: 0,
    }],
    ...overrides,
  };
}

function report(runtime, value = sample()) {
  return { version: 1, runtime, samples: [value] };
}

test('parity plan covers warmup and measured lengths for both games', () => {
  assert.deepEqual(WORKER_PYODIDE_PARITY_PLAN, [
    { game: 'STCK', actions: 3 },
    { game: 'STCK', actions: 10 },
    { game: 'SMLP', actions: 3 },
    { game: 'SMLP', actions: 15 },
  ]);
});

test('parity accepts identical public semantics while runtime backend labels differ', () => {
  const reference = report('cpython', sample({ backend: 'python-native-archive' }));
  const candidate = report('pyodide', sample({ backend: 'python-wasm' }));
  assert.deepEqual(assertWorkerPyodideParity(reference, candidate), {
    samplesCompared: 1,
    stepsCompared: 1,
    plan: WORKER_PYODIDE_PARITY_PLAN.map(item => ({ ...item })),
  });
});

test('parity fails closed on action or public-frame drift', () => {
  const reference = report('cpython');
  const candidate = report('pyodide', sample({
    steps: [{
      ...sample().steps[0],
      action: { id: 6, x: 6, y: 56 },
      frameHash: 'different-frame',
    }],
  }));
  assert.throws(
    () => assertWorkerPyodideParity(reference, candidate),
    /steps\[0\]\.action[\s\S]*steps\[0\]\.frameHash/,
  );
});

test('parity rejects malformed reports', () => {
  assert.throws(() => assertWorkerPyodideParity({}, report('pyodide')), /version 1/);
  assert.throws(() => assertWorkerPyodideParity(report('cpython'), { version: 1 }), /samples/);
});
