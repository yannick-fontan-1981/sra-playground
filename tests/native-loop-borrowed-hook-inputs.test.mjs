import assert from 'node:assert/strict';
import test from 'node:test';

import { createPublicCorpusSessionRunner } from '../scripts/native-loop-public-corpus-runner.mjs';
import { createRegionInterventionCandidateHook } from '../scripts/native-loop-region-candidate-hook.mjs';

function descriptor(overrides = {}) {
  return {
    invocationIndex: 3,
    series: 'B1',
    variant: 'B',
    game: 'STCK',
    kind: 'measured',
    sessionIndex: 0,
    actions: 1,
    ...overrides,
  };
}

function simpleObservation(step) {
  return {
    availableActionIds: [5, 6, 7],
    state: 'NOT_FINISHED',
    step,
  };
}

test('public corpus runner passes exact borrowed snapshots only when explicitly requested', async () => {
  const initial = simpleObservation(0);
  const next = simpleObservation(1);
  const selected = { id: 5 };
  const inputDescriptor = descriptor();
  let beforeEvent;
  let afterEvent;

  const runner = createPublicCorpusSessionRunner({
    variant: 'B',
    game: 'STCK',
    sourceRef: 'candidate:borrowed',
    hookInputMode: 'borrowed-readonly',
    selectAction: async () => selected,
    createSession: async () => ({
      initialObservation: () => initial,
      action: async () => next,
    }),
    beforeAction: async event => { beforeEvent = event; },
    afterAction: async event => { afterEvent = event; },
  });

  await runner(inputDescriptor);
  assert.strictEqual(beforeEvent.action, selected);
  assert.strictEqual(beforeEvent.observation, initial);
  assert.strictEqual(beforeEvent.descriptor, inputDescriptor);
  assert.strictEqual(afterEvent.action, selected);
  assert.strictEqual(afterEvent.beforeObservation, initial);
  assert.strictEqual(afterEvent.observation, next);
  assert.strictEqual(afterEvent.descriptor, inputDescriptor);
});

test('public corpus runner keeps defensive clones as the default hook contract', async () => {
  const initial = simpleObservation(0);
  const next = simpleObservation(1);
  const selected = { id: 5 };
  const inputDescriptor = descriptor();
  let beforeEvent;
  let afterEvent;

  const runner = createPublicCorpusSessionRunner({
    variant: 'B',
    game: 'STCK',
    sourceRef: 'candidate:cloned',
    selectAction: async () => selected,
    createSession: async () => ({
      initialObservation: () => initial,
      action: async () => next,
    }),
    beforeAction: async event => { beforeEvent = event; },
    afterAction: async event => { afterEvent = event; },
  });

  await runner(inputDescriptor);
  assert.notStrictEqual(beforeEvent.action, selected);
  assert.notStrictEqual(beforeEvent.observation, initial);
  assert.notStrictEqual(beforeEvent.descriptor, inputDescriptor);
  assert.deepEqual(beforeEvent.action, selected);
  assert.deepEqual(beforeEvent.observation, initial);
  assert.notStrictEqual(afterEvent.beforeObservation, initial);
  assert.notStrictEqual(afterEvent.observation, next);
  assert.deepEqual(afterEvent.observation, next);
});

test('public corpus runner rejects an unknown hook input ownership contract', () => {
  assert.throws(
    () => createPublicCorpusSessionRunner({
      variant: 'B',
      game: 'STCK',
      sourceRef: 'candidate:invalid',
      hookInputMode: 'unsafe',
      createSession: async () => ({
        initialObservation: () => simpleObservation(0),
        action: async () => simpleObservation(1),
      }),
    }),
    /hookInputMode/,
  );
});

test('the real Region hook explicitly declares borrowed read-only public inputs', () => {
  const hook = createRegionInterventionCandidateHook();
  assert.equal(hook.id, 'region_intervention');
  assert.equal(hook.inputMode, 'borrowed-readonly');
});
