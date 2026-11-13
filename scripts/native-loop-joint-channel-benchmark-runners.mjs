import { createJointChannelCandidateHook } from './native-loop-joint-channel-candidate-hook.mjs';
import {
  NATIVE_JOINT_CHANNEL_ACTION6_CORPUS_V1,
  selectNativeJointChannelAction6CostAction,
} from './native-loop-joint-channel-action6-corpus.mjs';
import { createGameBridgeNativeSession } from './native-loop-game-bridge-session.mjs';
import { createPublicCorpusSessionRunner } from './native-loop-public-corpus-runner.mjs';
import { createNativeLoopRunSession } from './native-loop-session-adapter.mjs';

function nonEmpty(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function dispatchFor(dispatchByGame, game) {
  const dispatch = dispatchByGame?.[game];
  if (typeof dispatch !== 'function') {
    throw new TypeError(`missing native browser dispatch for ${game}`);
  }
  return dispatch;
}

function createRunner({ variant, game, sourceRef, dispatch, hook }) {
  return createPublicCorpusSessionRunner({
    variant,
    game,
    sourceRef,
    corpus: NATIVE_JOINT_CHANNEL_ACTION6_CORPUS_V1,
    selectAction: selectNativeJointChannelAction6CostAction,
    seed: NATIVE_JOINT_CHANNEL_ACTION6_CORPUS_V1.seed,
    createSession({ game: requestedGame, seed, startLevel }) {
      return createGameBridgeNativeSession({
        dispatch,
        game: requestedGame,
        seed,
        startLevel,
      });
    },
    ...(hook ? {
      beforeAction: input => hook.beforeAction(input),
      afterAction: input => hook.afterAction(input),
      hookInputMode: hook.hookInputMode,
    } : {}),
  });
}

/**
 * Build four explicit browser/Pyodide runners for Lot 9C performance.
 *
 * A and B use the same games, corpus, seed, start level, transport, action
 * sequence and timing scope. The only measured semantic difference is that B
 * reconstructs every already-selected corpus action through the real bounded
 * joint-channel decision and return path. A leaves that path disabled.
 */
export function createNativeJointChannelBenchmarkRunSession({
  dispatchByGame,
  referenceSourceRef,
  candidateSourceRef,
}) {
  nonEmpty(referenceSourceRef, 'referenceSourceRef');
  nonEmpty(candidateSourceRef, 'candidateSourceRef');

  const hooks = {
    STCK: createJointChannelCandidateHook({ game: 'STCK' }),
    SMLP: createJointChannelCandidateHook({ game: 'SMLP' }),
  };
  const runners = {
    A: {
      STCK: createRunner({
        variant: 'A',
        game: 'STCK',
        sourceRef: referenceSourceRef,
        dispatch: dispatchFor(dispatchByGame, 'STCK'),
      }),
      SMLP: createRunner({
        variant: 'A',
        game: 'SMLP',
        sourceRef: referenceSourceRef,
        dispatch: dispatchFor(dispatchByGame, 'SMLP'),
      }),
    },
    B: {
      STCK: createRunner({
        variant: 'B',
        game: 'STCK',
        sourceRef: candidateSourceRef,
        dispatch: dispatchFor(dispatchByGame, 'STCK'),
        hook: hooks.STCK,
      }),
      SMLP: createRunner({
        variant: 'B',
        game: 'SMLP',
        sourceRef: candidateSourceRef,
        dispatch: dispatchFor(dispatchByGame, 'SMLP'),
        hook: hooks.SMLP,
      }),
    },
  };

  return {
    runSession: createNativeLoopRunSession(runners),
    runners,
    hooks,
  };
}

export const NATIVE_JOINT_CHANNEL_BENCHMARK_RUNNER_IDENTITIES = Object.freeze({
  A: Object.freeze({
    STCK: Object.freeze({
      id: 'lot9c-joint-v1:A/STCK',
      hook: 'disabled',
      corpus: NATIVE_JOINT_CHANNEL_ACTION6_CORPUS_V1.id,
    }),
    SMLP: Object.freeze({
      id: 'lot9c-joint-v1:A/SMLP',
      hook: 'disabled',
      corpus: NATIVE_JOINT_CHANNEL_ACTION6_CORPUS_V1.id,
    }),
  }),
  B: Object.freeze({
    STCK: Object.freeze({
      id: 'lot9c-joint-v1:B/STCK',
      hook: 'joint_channels',
      corpus: NATIVE_JOINT_CHANNEL_ACTION6_CORPUS_V1.id,
    }),
    SMLP: Object.freeze({
      id: 'lot9c-joint-v1:B/SMLP',
      hook: 'joint_channels',
      corpus: NATIVE_JOINT_CHANNEL_ACTION6_CORPUS_V1.id,
    }),
  }),
  invariant:
    'A and B share transport, game archive, seed, public action corpus and action sequence; only B executes the real joint-channel decision and acquisition path',
});
