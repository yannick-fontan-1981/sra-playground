import {
  createASmlpNativeRunner,
  createAStckNativeRunner,
  createBSmlpNativeRunner,
  createBStckNativeRunner,
} from './native-loop-explicit-runners.mjs';
import {
  NATIVE_REGION_ACTION6_CORPUS_V1,
  selectNativeRegionAction6CostAction,
} from './native-loop-region-action6-corpus.mjs';
import { createRegionInterventionCandidateHook } from './native-loop-region-candidate-hook.mjs';
import { createNativeLoopRunSession } from './native-loop-session-adapter.mjs';

function nonEmpty(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function validateDispatches(dispatchByGame) {
  if (!dispatchByGame || typeof dispatchByGame !== 'object') {
    throw new TypeError('dispatchByGame must provide STCK and SMLP transports');
  }
  for (const game of NATIVE_REGION_ACTION6_CORPUS_V1.games) {
    if (typeof dispatchByGame[game] !== 'function') {
      throw new TypeError(`dispatchByGame.${game} must be a function`);
    }
  }
  return dispatchByGame;
}

/**
 * Singleton method identities make no cross-intervention equivalence claim.
 * Each useful public ACTION6 return is admitted as its own explicitly scoped
 * method family, which exercises Region learning without inventing reuse.
 * This producer uses only invocation/action identity and never public frames.
 */
export function nativeRegionBenchmarkMethodRef({ index, descriptor }) {
  if (!descriptor || !Number.isInteger(descriptor.invocationIndex)) {
    throw new TypeError('benchmark descriptor requires invocationIndex');
  }
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError('benchmark action index must be a non-negative integer');
  }
  return `native-region-singleton:${descriptor.game}:${descriptor.invocationIndex}:${index}`;
}

export function createNativeRegionBenchmarkRunSession({
  dispatchByGame,
  referenceSourceRef,
  candidateSourceRef,
}) {
  const dispatches = validateDispatches(dispatchByGame);
  nonEmpty(referenceSourceRef, 'referenceSourceRef');
  nonEmpty(candidateSourceRef, 'candidateSourceRef');

  const common = {
    corpus: NATIVE_REGION_ACTION6_CORPUS_V1,
    selectAction: selectNativeRegionAction6CostAction,
  };
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

  const runners = {
    A: {
      STCK: createAStckNativeRunner({
        dispatch: dispatches.STCK,
        sourceRef: referenceSourceRef,
        ...common,
      }),
      SMLP: createASmlpNativeRunner({
        dispatch: dispatches.SMLP,
        sourceRef: referenceSourceRef,
        ...common,
      }),
    },
    B: {
      STCK: createBStckNativeRunner({
        dispatch: dispatches.STCK,
        sourceRef: candidateSourceRef,
        candidateHook: hooks.STCK,
        ...common,
      }),
      SMLP: createBSmlpNativeRunner({
        dispatch: dispatches.SMLP,
        sourceRef: candidateSourceRef,
        candidateHook: hooks.SMLP,
        ...common,
      }),
    },
  };

  return {
    runSession: createNativeLoopRunSession(runners),
    runners,
    hooks,
  };
}

export const NATIVE_REGION_BENCHMARK_RUNNER_IDENTITIES = Object.freeze({
  corpusRef: NATIVE_REGION_ACTION6_CORPUS_V1.id,
  referenceVariant: 'A: same native transport and ACTION6 corpus, Region hook disabled',
  candidateVariant: 'B: same native transport and ACTION6 corpus, real region_intervention hook enabled',
  methodRefStrategy: 'one explicit singleton methodRef per invocation/action; no inferred method equivalence',
  methodRefInput: 'identity-only; public frames are not cloned for method identity',
  games: Object.freeze({
    STCK: Object.freeze({ gameId: 'stck-c0000001', seed: 0, startLevel: 1 }),
    SMLP: Object.freeze({ gameId: 'smlp-c3000001', seed: 0, startLevel: 1 }),
  }),
});
