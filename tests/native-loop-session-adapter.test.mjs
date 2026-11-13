import assert from 'node:assert/strict';
import test from 'node:test';
import { runNativeLoopCostProtocol } from '../scripts/measure-native-loop-costs.mjs';
import {
  createNativeLoopRunSession,
  NATIVE_SESSION_ADAPTER_CONTRACT,
} from '../scripts/native-loop-session-adapter.mjs';

function runner(label, calls, durationMs) {
  return async descriptor => {
    calls.push({ label, descriptor: structuredClone(descriptor) });
    return {
      durationMs,
      phases: { native_loop: durationMs / 2 },
      metadata: { label },
    };
  };
}

function completeRunners(calls = []) {
  return {
    A: {
      STCK: runner('A/STCK', calls, 100),
      SMLP: runner('A/SMLP', calls, 200),
    },
    B: {
      STCK: runner('B/STCK', calls, 105),
      SMLP: runner('B/SMLP', calls, 205),
    },
  };
}

test('adapter requires all four explicit variant/game runners', () => {
  assert.throws(() => createNativeLoopRunSession({}), /A\/STCK/);
  assert.throws(() => createNativeLoopRunSession({
    A: { STCK: async () => ({ durationMs: 1 }), SMLP: async () => ({ durationMs: 1 }) },
    B: { STCK: async () => ({ durationMs: 1 }) },
  }), /B\/SMLP/);
});

test('adapter does not own timing or corpus', () => {
  assert.equal(NATIVE_SESSION_ADAPTER_CONTRACT.ownsTiming, false);
  assert.equal(NATIVE_SESSION_ADAPTER_CONTRACT.ownsCorpus, false);
  assert.deepEqual(NATIVE_SESSION_ADAPTER_CONTRACT.requiresExplicitRunners, [
    'A/STCK', 'A/SMLP', 'B/STCK', 'B/SMLP',
  ]);
});

test('A1/A2 route only to baseline runners and B1/B2 only to candidate runners', async () => {
  const calls = [];
  const runSession = createNativeLoopRunSession(completeRunners(calls));
  await runNativeLoopCostProtocol(runSession);

  assert.equal(calls.length, 40);
  for (const call of calls) {
    const expectedVariant = ['A1', 'A2'].includes(call.descriptor.series) ? 'A' : 'B';
    assert.equal(call.descriptor.variant, expectedVariant);
    assert.equal(call.label, expectedVariant + '/' + call.descriptor.game);
  }
});

test('adapter forwards exact descriptor without mutation', async () => {
  const calls = [];
  const runSession = createNativeLoopRunSession(completeRunners(calls));
  const descriptor = {
    invocationIndex: 7,
    series: 'B1',
    variant: 'B',
    game: 'STCK',
    kind: 'measured',
    sessionIndex: 2,
    actions: 10,
  };
  const before = structuredClone(descriptor);
  await runSession(descriptor);
  assert.deepEqual(descriptor, before);
  assert.deepEqual(calls[0].descriptor, before);
});

test('adapter rejects series/variant mismatch instead of silently rerouting', async () => {
  const runSession = createNativeLoopRunSession(completeRunners());
  await assert.rejects(runSession({
    invocationIndex: 0,
    series: 'A1',
    variant: 'B',
    game: 'STCK',
    kind: 'measured',
    sessionIndex: 0,
    actions: 10,
  }), /requires variant A/);
});

test('adapter rejects incorrect historical action count', async () => {
  const runSession = createNativeLoopRunSession(completeRunners());
  await assert.rejects(runSession({
    invocationIndex: 0,
    series: 'B1',
    variant: 'B',
    game: 'SMLP',
    kind: 'measured',
    sessionIndex: 0,
    actions: 10,
  }), /requires 15 actions/);
});

test('adapter validates runner sample but preserves metadata and phases', async () => {
  const runSession = createNativeLoopRunSession(completeRunners());
  const sample = await runSession({
    invocationIndex: 0,
    series: 'A1',
    variant: 'A',
    game: 'STCK',
    kind: 'warmup',
    sessionIndex: 0,
    actions: 3,
  });
  assert.deepEqual(sample, {
    durationMs: 100,
    phases: { native_loop: 50 },
    metadata: { label: 'A/STCK' },
  });
});

test('runner failure propagates without fallback to another runner', async () => {
  let otherCalls = 0;
  const runSession = createNativeLoopRunSession({
    A: {
      STCK: async () => { throw new Error('baseline STCK failed'); },
      SMLP: async () => { otherCalls += 1; return { durationMs: 1 }; },
    },
    B: {
      STCK: async () => { otherCalls += 1; return { durationMs: 1 }; },
      SMLP: async () => { otherCalls += 1; return { durationMs: 1 }; },
    },
  });
  await assert.rejects(runSession({
    invocationIndex: 0,
    series: 'A1',
    variant: 'A',
    game: 'STCK',
    kind: 'warmup',
    sessionIndex: 0,
    actions: 3,
  }), /baseline STCK failed/);
  assert.equal(otherCalls, 0);
});

test('adapter plus ABBA harness produces independent passing globals with synthetic explicit runners', async () => {
  const result = await runNativeLoopCostProtocol(
    createNativeLoopRunSession(completeRunners()),
  );
  assert.equal(result.games.STCK.globalAccepted, true);
  assert.equal(result.games.SMLP.globalAccepted, true);
  assert.equal(result.accepted, true);
});
