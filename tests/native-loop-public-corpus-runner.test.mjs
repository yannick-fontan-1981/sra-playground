import assert from 'node:assert/strict';
import test from 'node:test';
import { runNativeLoopCostProtocol } from '../scripts/measure-native-loop-costs.mjs';
import { createNativeLoopRunSession } from '../scripts/native-loop-session-adapter.mjs';
import {
  PUBLIC_CORPUS_TIMING_SCOPE,
  createPublicCorpusSessionRunner,
} from '../scripts/native-loop-public-corpus-runner.mjs';

class FakeSession {
  constructor({ terminalAfter = Infinity, onlyClick = false } = {}) {
    this.terminalAfter = terminalAfter;
    this.onlyClick = onlyClick;
    this.steps = 0;
    this.actions = [];
  }

  initialObservation() {
    return this.#observation();
  }

  action(action) {
    this.actions.push(structuredClone(action));
    this.steps += 1;
    return this.#observation();
  }

  #observation() {
    if (this.onlyClick) return { availableActionIds: [6], state: 'NOT_FINISHED' };
    if (this.steps >= this.terminalAfter) return { availableActionIds: [7], state: 'WIN' };
    return { availableActionIds: [5, 6, 7], state: 'NOT_FINISHED' };
  }
}

function descriptor(overrides = {}) {
  return {
    invocationIndex: 0,
    series: 'A1',
    variant: 'A',
    game: 'STCK',
    kind: 'measured',
    sessionIndex: 0,
    actions: 10,
    ...overrides,
  };
}

test('public corpus runner executes the exact requested action count with ACTION5', async () => {
  let created;
  const runner = createPublicCorpusSessionRunner({
    variant: 'A',
    game: 'STCK',
    sourceRef: 'source:A',
    createSession: async () => (created = new FakeSession()),
  });
  const sample = await runner(descriptor());
  assert.equal(created.actions.length, 10);
  assert.deepEqual(created.actions, Array.from({ length: 10 }, () => ({ id: 5 })));
  assert.equal(sample.metadata.sourceRef, 'source:A');
  assert.equal(sample.metadata.corpusRef, 'native-public-action-corpus-v1');
  assert.equal(sample.metadata.seed, 0);
  assert.equal(sample.metadata.timingScope, PUBLIC_CORPUS_TIMING_SCOPE);
  assert.ok(sample.durationMs >= 0);
});

test('public corpus runner falls back to ACTION7 after terminal public state', async () => {
  let created;
  const runner = createPublicCorpusSessionRunner({
    variant: 'A',
    game: 'STCK',
    sourceRef: 'source:A',
    createSession: async () => (created = new FakeSession({ terminalAfter: 2 })),
  });
  await runner(descriptor({ actions: 5 }));
  assert.deepEqual(created.actions, [{ id: 5 }, { id: 5 }, { id: 7 }, { id: 7 }, { id: 7 }]);
});

test('public corpus runner refuses a corpus step that would require invented ACTION6 coordinates', async () => {
  const runner = createPublicCorpusSessionRunner({
    variant: 'A',
    game: 'SMLP',
    sourceRef: 'source:A',
    createSession: async () => new FakeSession({ onlyClick: true }),
  });
  await assert.rejects(runner(descriptor({ game: 'SMLP', actions: 15 })), /cannot choose action/);
});

test('public corpus runner rejects variant or game mismatch', async () => {
  const runner = createPublicCorpusSessionRunner({
    variant: 'B',
    game: 'SMLP',
    sourceRef: 'source:B',
    createSession: async () => new FakeSession(),
  });
  await assert.rejects(runner(descriptor({ variant: 'A', game: 'SMLP', actions: 15 })), /cannot execute variant/);
  await assert.rejects(runner(descriptor({ variant: 'B', game: 'STCK', actions: 10 })), /cannot execute game/);
});

test('candidate hook runs once per measured action and remains inside timing scope', async () => {
  let hooks = 0;
  const runner = createPublicCorpusSessionRunner({
    variant: 'B',
    game: 'SMLP',
    sourceRef: 'source:B',
    createSession: async () => new FakeSession(),
    beforeAction: async () => { hooks += 1; },
  });
  const sample = await runner(descriptor({ variant: 'B', game: 'SMLP', actions: 15 }));
  assert.equal(hooks, 15);
  assert.ok(sample.phases.candidate_hook >= 0);
});

test('four explicit public-corpus runners satisfy the native adapter and full ABBA schedule on fake ports', async () => {
  const make = (variant, game) => createPublicCorpusSessionRunner({
    variant,
    game,
    sourceRef: `source:${variant}`,
    createSession: async () => new FakeSession(),
  });
  const runSession = createNativeLoopRunSession({
    A: { STCK: make('A', 'STCK'), SMLP: make('A', 'SMLP') },
    B: { STCK: make('B', 'STCK'), SMLP: make('B', 'SMLP') },
  });
  const result = await runNativeLoopCostProtocol(runSession);
  assert.equal(result.totals.invocations, 40);
  assert.equal(result.totals.measuredSessions, 32);
  assert.equal(result.totals.measuredActions, 400);
});

test('candidate post-action hook receives both public observations and stays inside candidate timing', async () => {
  const calls = [];
  const runner = createPublicCorpusSessionRunner({
    variant: 'B',
    game: 'STCK',
    sourceRef: 'source:B',
    createSession: async () => new FakeSession(),
    beforeAction: async () => {},
    afterAction: async event => {
      calls.push(event);
    },
  });
  const sample = await runner(descriptor({ variant: 'B', actions: 3 }));
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0].action, { id: 5 });
  assert.ok(calls[0].beforeObservation);
  assert.ok(calls[0].observation);
  assert.ok(sample.phases.candidate_hook >= 0);
});

test('cloned hook mode remains the safe default', async () => {
  const initial = { availableActionIds: [5], state: 'NOT_FINISHED', marker: { step: 0 } };
  const after = { availableActionIds: [5], state: 'NOT_FINISHED', marker: { step: 1 } };
  let beforeEvent;
  let afterEvent;
  const runner = createPublicCorpusSessionRunner({
    variant: 'B',
    game: 'STCK',
    sourceRef: 'source:B',
    createSession: async () => ({
      initialObservation: () => initial,
      action: async () => after,
    }),
    beforeAction: event => { beforeEvent = event; },
    afterAction: event => { afterEvent = event; },
  });

  await runner(descriptor({ variant: 'B', actions: 1 }));
  assert.notEqual(beforeEvent.observation, initial);
  assert.notEqual(beforeEvent.observation.marker, initial.marker);
  assert.notEqual(afterEvent.beforeObservation, initial);
  assert.notEqual(afterEvent.observation, after);
  assert.deepEqual(initial.marker, { step: 0 });
  assert.deepEqual(after.marker, { step: 1 });
});

test('readonly hook mode passes runner-owned observations without redundant cloning', async () => {
  const initial = { availableActionIds: [5], state: 'NOT_FINISHED', marker: { step: 0 } };
  const after = { availableActionIds: [5], state: 'NOT_FINISHED', marker: { step: 1 } };
  let beforeEvent;
  let afterEvent;
  const runner = createPublicCorpusSessionRunner({
    variant: 'B',
    game: 'STCK',
    sourceRef: 'source:B',
    hookInputMode: 'readonly',
    createSession: async () => ({
      initialObservation: () => initial,
      action: async () => after,
    }),
    beforeAction: event => { beforeEvent = event; },
    afterAction: event => { afterEvent = event; },
  });

  await runner(descriptor({ variant: 'B', actions: 1 }));
  assert.equal(beforeEvent.observation, initial);
  assert.equal(afterEvent.beforeObservation, initial);
  assert.equal(afterEvent.observation, after);
  assert.deepEqual(initial.marker, { step: 0 });
  assert.deepEqual(after.marker, { step: 1 });
});

test('public corpus runner rejects unknown hook input modes', () => {
  assert.throws(
    () => createPublicCorpusSessionRunner({
      variant: 'B',
      game: 'STCK',
      sourceRef: 'source:B',
      hookInputMode: 'unsafe',
      createSession: async () => new FakeSession(),
    }),
    /hookInputMode must be cloned or readonly/,
  );
});
