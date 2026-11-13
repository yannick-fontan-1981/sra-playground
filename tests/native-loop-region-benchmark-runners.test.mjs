import assert from 'node:assert/strict';
import test from 'node:test';

import { runNativeLoopCostProtocol } from '../scripts/measure-native-loop-costs.mjs';
import {
  NATIVE_REGION_ACTION6_CORPUS_V1,
  selectNativeRegionAction6CostAction,
} from '../scripts/native-loop-region-action6-corpus.mjs';
import {
  createNativeRegionBenchmarkRunSession,
  nativeRegionBenchmarkMethodRef,
} from '../scripts/native-loop-region-benchmark-runners.mjs';

function blank(fill = 5) {
  return Array.from({ length: 64 }, () => Array(64).fill(fill));
}

function stckFrame(color) {
  const frame = blank(4);
  for (let y = 54; y <= 58; y += 1) {
    for (let x = 2; x <= 10; x += 1) frame[y][x] = 10;
  }
  for (let y = 48; y <= 52; y += 1) {
    for (let x = 1; x <= 8; x += 1) frame[y][x] = color;
  }
  return frame;
}

function smlpFrame(open) {
  const frame = blank(2);
  const x = 20;
  const y = 30;
  if (open) {
    frame[y][x] = 3;
    frame[y - 1][x] = 12;
    frame[y + 1][x] = 12;
  } else {
    for (let yy = y - 1; yy <= y + 1; yy += 1) {
      for (let xx = x - 1; xx <= x + 1; xx += 1) frame[yy][xx] = 12;
    }
    frame[y - 1][x] = 5;
    frame[y][x] = 5;
    frame[y + 1][x] = 5;
  }
  return frame;
}

function createFakeNativeDispatch(game) {
  let step = 0;
  return async request => {
    if (request.type === 'load') step = 0;
    else if (request.type === 'action') {
      assert.equal(request.actionId, 6);
      assert.ok(request.data && Number.isInteger(request.data.x) && Number.isInteger(request.data.y));
      step += 1;
    }
    return {
      code: game,
      gameId: game === 'STCK' ? 'stck-c0000001' : 'smlp-c3000001',
      backend: 'python-wasm',
      frame: game === 'STCK' ? stckFrame(step % 2 === 0 ? 9 : 14) : smlpFrame(step % 2 === 1),
      state: 'NOT_FINISHED',
      level: 1,
      levelCount: 6,
      levelsCompleted: 0,
      availableActionIds: [5, 6, 7],
    };
  };
}

test('native Region corpus selects only public ACTION6 targets', () => {
  assert.equal(NATIVE_REGION_ACTION6_CORPUS_V1.id, 'native-region-action6-corpus-v1');
  assert.deepEqual(
    selectNativeRegionAction6CostAction({ game: 'STCK', observation: {
      frame: stckFrame(9), availableActionIds: [5, 6, 7],
    } }),
    { id: 6, x: 4, y: 52 },
  );
  assert.deepEqual(
    selectNativeRegionAction6CostAction({ game: 'SMLP', observation: {
      frame: smlpFrame(false), availableActionIds: [5, 6, 7],
    } }),
    { id: 6, x: 20, y: 30 },
  );
});

test('benchmark method refs are explicit singleton identities', () => {
  assert.equal(
    nativeRegionBenchmarkMethodRef({
      index: 3,
      descriptor: { game: 'STCK', invocationIndex: 12 },
    }),
    'native-region-singleton:STCK:12:3',
  );
});

test('full ABBA schedule uses identical ACTION6 corpus and real Region hook only on B', async () => {
  const assembled = createNativeRegionBenchmarkRunSession({
    dispatchByGame: {
      STCK: createFakeNativeDispatch('STCK'),
      SMLP: createFakeNativeDispatch('SMLP'),
    },
    referenceSourceRef: 'source:reference',
    candidateSourceRef: 'source:candidate-region',
  });

  const result = await runNativeLoopCostProtocol(assembled.runSession);
  assert.equal(result.totals.invocations, 40);
  assert.equal(result.totals.measuredSessions, 32);
  assert.equal(result.totals.measuredActions, 400);
  assert.equal(result.totals.warmupActions, 24);

  for (const series of result.series) {
    for (const entry of [series.warmup, ...series.measured]) {
      assert.equal(entry.sample.metadata.corpusRef, 'native-region-action6-corpus-v1');
      assert.ok(entry.sample.metadata.actions.every(action => action.id === 6));
      assert.equal(
        entry.sample.metadata.sourceRef,
        series.variant === 'A' ? 'source:reference' : 'source:candidate-region',
      );
    }
  }

  assert.deepEqual(assembled.hooks.STCK.stats, {
    actionsSeen: 86,
    action6Seen: 86,
    usefulAction6Evidence: 86,
    boundEvidence: 86,
    acquisitions: 86,
  });
  assert.deepEqual(assembled.hooks.SMLP.stats, {
    actionsSeen: 126,
    action6Seen: 126,
    usefulAction6Evidence: 126,
    boundEvidence: 126,
    acquisitions: 126,
  });
  assert.equal(assembled.hooks.STCK.owner.model.size, 86);
  assert.equal(assembled.hooks.SMLP.owner.model.size, 126);
});
