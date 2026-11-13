import assert from 'node:assert/strict';
import test from 'node:test';
import { median, OFFICIAL_COST_PROTOCOL, runNativeLoopCostProtocol } from '../scripts/measure-native-loop-costs.mjs';

function runner({
  stckA = 100, stckB = 105, smlpA = 200, smlpB = 210,
  phaseA = 10, phaseB = 12, calls,
} = {}) {
  return async descriptor => {
    calls?.push(structuredClone(descriptor));
    const baseline = descriptor.game === 'STCK' ? stckA : smlpA;
    const candidate = descriptor.game === 'STCK' ? stckB : smlpB;
    const durationMs = descriptor.variant === 'A' ? baseline : candidate;
    return {
      durationMs: descriptor.kind === 'warmup' ? durationMs / 2 : durationMs,
      phases: { decision: descriptor.variant === 'A' ? phaseA : phaseB },
      metadata: { invocation: descriptor.invocationIndex },
    };
  };
}

test('median uses the middle value or mean of the two middle values', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

test('ABBA protocol executes exact historical series, sessions and actions', async () => {
  const calls = [];
  const result = await runNativeLoopCostProtocol(runner({ calls }));
  assert.deepEqual(OFFICIAL_COST_PROTOCOL.seriesOrder, ['A1', 'B1', 'B2', 'A2']);
  assert.deepEqual(result.totals, {
    invocations: 40,
    warmupSessions: 8,
    measuredSessions: 32,
    warmupActions: 24,
    measuredActions: 400,
  });
  assert.equal(calls.length, 40);
  assert.deepEqual(calls.slice(0, 5).map(call => [call.series, call.game, call.kind, call.actions]), [
    ['A1', 'STCK', 'warmup', 3],
    ['A1', 'STCK', 'measured', 10],
    ['A1', 'STCK', 'measured', 10],
    ['A1', 'STCK', 'measured', 10],
    ['A1', 'STCK', 'measured', 10],
  ]);
  assert.deepEqual(calls.slice(5, 10).map(call => [call.series, call.game, call.kind, call.actions]), [
    ['A1', 'SMLP', 'warmup', 3],
    ['A1', 'SMLP', 'measured', 15],
    ['A1', 'SMLP', 'measured', 15],
    ['A1', 'SMLP', 'measured', 15],
    ['A1', 'SMLP', 'measured', 15],
  ]);
});

test('global medians are pooled by variant across A1/A2 and B1/B2', async () => {
  const result = await runNativeLoopCostProtocol(runner());
  assert.equal(result.games.STCK.baselineMeasuredSessions, 8);
  assert.equal(result.games.STCK.candidateMeasuredSessions, 8);
  assert.equal(result.games.STCK.baselineMedianMs, 100);
  assert.equal(result.games.STCK.candidateMedianMs, 105);
  assert.equal(result.games.SMLP.baselineMedianMs, 200);
  assert.equal(result.games.SMLP.candidateMedianMs, 210);
  assert.equal(result.games.STCK.globalAccepted, true);
  assert.equal(result.games.SMLP.globalAccepted, true);
  assert.equal(result.accepted, true);
});

test('phase over 10 percent is retained but does not veto a passing game global', async () => {
  const result = await runNativeLoopCostProtocol(runner({ phaseA: 10, phaseB: 12 }));
  assert.ok(result.games.STCK.phaseOverruns.decision);
  assert.ok(result.games.SMLP.phaseOverruns.decision);
  assert.equal(result.games.STCK.globalAccepted, true);
  assert.equal(result.games.SMLP.globalAccepted, true);
  assert.equal(result.accepted, true);
});

test('exactly +10 percent fails because the threshold is strict', async () => {
  const result = await runNativeLoopCostProtocol(runner({
    stckA: 100, stckB: 110, smlpA: 200, smlpB: 220,
  }));
  assert.equal(result.games.STCK.globalAccepted, false);
  assert.equal(result.games.SMLP.globalAccepted, false);
  assert.equal(result.accepted, false);
});

test('one game cannot compensate for the other', async () => {
  const result = await runNativeLoopCostProtocol(runner({
    stckA: 100, stckB: 101, smlpA: 100, smlpB: 111,
  }));
  assert.equal(result.games.STCK.globalAccepted, true);
  assert.equal(result.games.SMLP.globalAccepted, false);
  assert.equal(result.accepted, false);
});

test('all measured samples remain present in the result', async () => {
  const result = await runNativeLoopCostProtocol(runner());
  for (const item of result.series) {
    assert.equal(item.measured.length, 4);
    assert.equal(item.warmup.descriptor.kind, 'warmup');
    assert.equal(item.measured.every(entry => entry.descriptor.kind === 'measured'), true);
  }
});

test('runner failure is propagated without hidden retry', async () => {
  let calls = 0;
  await assert.rejects(
    runNativeLoopCostProtocol(async descriptor => {
      calls += 1;
      if (descriptor.invocationIndex === 3) throw new Error('synthetic failure');
      return { durationMs: 1 };
    }),
    /synthetic failure/,
  );
  assert.equal(calls, 4);
});
