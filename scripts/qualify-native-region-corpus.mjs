import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import readline from 'node:readline';

import { runNativeLoopCostProtocol } from './measure-native-loop-costs.mjs';
import { createNativeLoopRunSession } from './native-loop-session-adapter.mjs';
import { createPublicCorpusSessionRunner } from './native-loop-public-corpus-runner.mjs';
import {
  NATIVE_REGION_ACTION6_CORPUS_V1,
  selectNativeRegionAction6CostAction,
} from './native-loop-region-action6-corpus.mjs';
import { createRegionInterventionCandidateHook } from './native-loop-region-candidate-hook.mjs';
import { nativeRegionBenchmarkMethodRef } from './native-loop-region-benchmark-runners.mjs';

const child = spawn('python3', ['scripts/native-python-archive-session.py'], {
  stdio: ['pipe', 'pipe', 'inherit'],
});
const lines = readline.createInterface({ input: child.stdout });
const waiting = [];
lines.on('line', line => {
  const pending = waiting.shift();
  if (!pending) throw new Error('unexpected native archive response');
  try {
    const payload = JSON.parse(line);
    if (!payload.ok) pending.reject(new Error(payload.error));
    else pending.resolve(payload.result);
  } catch (error) {
    pending.reject(error);
  }
});

function request(payload) {
  return new Promise((resolve, reject) => {
    waiting.push({ resolve, reject });
    child.stdin.write(JSON.stringify(payload) + '\n');
  });
}

function changedPixels(a, b) {
  let count = 0;
  for (let y = 0; y < 64; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      if (a[y][x] !== b[y][x]) count += 1;
    }
  }
  return count;
}

const diagnostics = {
  A: { STCK: [], SMLP: [] },
  B: { STCK: [], SMLP: [] },
};

function createArchiveSessionFactory(variant, game) {
  return async ({ game: requestedGame }) => {
    if (requestedGame !== game) throw new Error(`archive session expected ${game}`);
    let current = await request({ type: 'load', code: game });
    const session = { deltas: [], actions: [] };
    diagnostics[variant][game].push(session);
    return {
      initialObservation() {
        return structuredClone(current);
      },
      async action(action) {
        if (!action || action.id !== 6 || !Number.isInteger(action.x) || !Number.isInteger(action.y)) {
          throw new Error(`${variant}/${game} Region corpus produced an invalid ACTION6`);
        }
        const before = current;
        current = await request({
          type: 'action',
          actionId: 6,
          data: { x: action.x, y: action.y },
        });
        const delta = changedPixels(before.frame, current.frame);
        if (delta <= 0) {
          throw new Error(`${variant}/${game} ACTION6 produced no visible delta`);
        }
        session.actions.push(structuredClone(action));
        session.deltas.push(delta);
        return structuredClone(current);
      },
    };
  };
}

function makeRunner({ variant, game, sourceRef, hook }) {
  return createPublicCorpusSessionRunner({
    variant,
    game,
    sourceRef,
    corpus: NATIVE_REGION_ACTION6_CORPUS_V1,
    selectAction: selectNativeRegionAction6CostAction,
    createSession: createArchiveSessionFactory(variant, game),
    beforeAction: hook?.beforeAction,
    afterAction: hook?.afterAction,
    hookInputMode: hook?.hookInputMode ?? 'cloned',
  });
}

const hooks = {
  STCK: createRegionInterventionCandidateHook({
    methodRefFor: nativeRegionBenchmarkMethodRef,
    methodRefInput: 'identity',
  }),
  SMLP: createRegionInterventionCandidateHook({
    methodRefFor: nativeRegionBenchmarkMethodRef,
    methodRefInput: 'identity',
  }),
};

const runSession = createNativeLoopRunSession({
  A: {
    STCK: makeRunner({ variant: 'A', game: 'STCK', sourceRef: 'archive:A:region-hook-disabled' }),
    SMLP: makeRunner({ variant: 'A', game: 'SMLP', sourceRef: 'archive:A:region-hook-disabled' }),
  },
  B: {
    STCK: makeRunner({ variant: 'B', game: 'STCK', sourceRef: 'archive:B:region-hook-enabled', hook: hooks.STCK }),
    SMLP: makeRunner({ variant: 'B', game: 'SMLP', sourceRef: 'archive:B:region-hook-enabled', hook: hooks.SMLP }),
  },
});

function verifyDeterministicSequences(protocolResult) {
  const expected = new Map();
  for (const series of protocolResult.series) {
    const entries = [series.warmup, ...series.measured];
    for (const entry of entries) {
      const descriptor = entry.descriptor;
      const key = `${descriptor.game}:${descriptor.kind}:${descriptor.sessionIndex}`;
      const actions = JSON.stringify(entry.sample.metadata.actions);
      const prior = expected.get(key);
      if (prior === undefined) expected.set(key, actions);
      else if (prior !== actions) throw new Error(`A/B action sequence drift for ${key}`);
    }
  }
  return Object.fromEntries([...expected].map(([key, value]) => [key, JSON.parse(value)]));
}

function deltaSummary(sessions) {
  const values = sessions.flatMap(session => session.deltas);
  return {
    sessions: sessions.length,
    actions: values.length,
    minChangedPixels: Math.min(...values),
    maxChangedPixels: Math.max(...values),
  };
}

try {
  const result = await runNativeLoopCostProtocol(runSession);
  if (result.totals.invocations !== 40
      || result.totals.measuredSessions !== 32
      || result.totals.measuredActions !== 400
      || result.totals.warmupActions !== 24) {
    throw new Error('native Region corpus did not execute the recovered full protocol volume');
  }

  const sequences = verifyDeterministicSequences(result);
  if (hooks.STCK.stats.acquisitions !== 86 || hooks.SMLP.stats.acquisitions !== 126) {
    throw new Error('candidate Region hook did not acquire every B-side ACTION6 return');
  }

  const report = {
    qualification: 'functional-full-protocol-non-isolated-not-official-performance',
    archive: 'public/python/custom-games.zip',
    seed: 0,
    corpusRef: NATIVE_REGION_ACTION6_CORPUS_V1.id,
    hookInputMode: 'readonly',
    methodRefInput: 'identity',
    totals: result.totals,
    deterministicSequences: sequences,
    diagnostics: {
      A: {
        STCK: deltaSummary(diagnostics.A.STCK),
        SMLP: deltaSummary(diagnostics.A.SMLP),
      },
      B: {
        STCK: deltaSummary(diagnostics.B.STCK),
        SMLP: deltaSummary(diagnostics.B.SMLP),
      },
    },
    candidateHook: {
      STCK: { stats: hooks.STCK.stats, methods: hooks.STCK.owner.model.size },
      SMLP: { stats: hooks.SMLP.stats, methods: hooks.SMLP.owner.model.size },
    },
    diagnosticTiming: result.games,
  };

  const target = process.env.LOT9B_REGION_CORPUS_REPORT || 'lot9b-native-region-corpus-report.json';
  fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  child.stdin.end();
  await once(child, 'close');
}
