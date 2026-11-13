import { createGameBridgeNativeSession } from './native-loop-game-bridge-session.mjs';
import { createPublicCorpusSessionRunner } from './native-loop-public-corpus-runner.mjs';

function nonEmpty(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function corpusOptions(corpus, selectAction) {
  return {
    ...(corpus === undefined ? {} : { corpus, seed: corpus.seed }),
    ...(selectAction === undefined ? {} : { selectAction }),
  };
}

/**
 * First explicit reconstructed native benchmark runner: A/STCK.
 *
 * It deliberately requires the native game_bridge transport to be injected.
 * The runner therefore cannot silently fall back to a fake, HTTP, Sites, or
 * alternate game implementation.
 */
export function createAStckNativeRunner({ dispatch, sourceRef, corpus, selectAction }) {
  nonEmpty(sourceRef, 'sourceRef');
  if (typeof dispatch !== 'function') {
    throw new TypeError('A/STCK native runner requires game_bridge dispatch');
  }

  return createPublicCorpusSessionRunner({
    variant: 'A',
    game: 'STCK',
    sourceRef,
    ...corpusOptions(corpus, selectAction),
    createSession: ({ game, seed, startLevel }) => createGameBridgeNativeSession({
      dispatch,
      game,
      seed,
      startLevel,
    }),
  });
}

export function createASmlpNativeRunner({ dispatch, sourceRef, corpus, selectAction }) {
  nonEmpty(sourceRef, 'sourceRef');
  if (typeof dispatch !== 'function') {
    throw new TypeError('A/SMLP native runner requires game_bridge dispatch');
  }

  return createPublicCorpusSessionRunner({
    variant: 'A',
    game: 'SMLP',
    sourceRef,
    ...corpusOptions(corpus, selectAction),
    createSession: ({ game: requestedGame, seed, startLevel }) => createGameBridgeNativeSession({
      dispatch,
      game: requestedGame,
      seed,
      startLevel,
    }),
  });
}

function requireRegionCandidateHook(candidateHook) {
  if (!candidateHook || typeof candidateHook !== 'object') {
    throw new TypeError('B native runner requires an explicit region_intervention candidate hook');
  }
  if (candidateHook.id !== 'region_intervention') {
    throw new Error('B native runner candidate hook id must be region_intervention');
  }
  if (candidateHook.inputMode !== 'borrowed-readonly') {
    throw new Error('region_intervention candidate hook must declare borrowed-readonly inputs');
  }
  if (typeof candidateHook.beforeAction !== 'function') {
    throw new TypeError('region_intervention candidate hook requires beforeAction()');
  }
  if (typeof candidateHook.afterAction !== 'function') {
    throw new TypeError('region_intervention candidate hook requires afterAction()');
  }
  return candidateHook;
}

function createCandidateRunner({
  dispatch,
  sourceRef,
  game,
  candidateHook,
  corpus,
  selectAction,
}) {
  nonEmpty(sourceRef, 'sourceRef');
  if (typeof dispatch !== 'function') {
    throw new TypeError(`B/${game} native runner requires game_bridge dispatch`);
  }
  const hook = requireRegionCandidateHook(candidateHook);
  return createPublicCorpusSessionRunner({
    variant: 'B',
    game,
    sourceRef,
    ...corpusOptions(corpus, selectAction),
    createSession: ({ game: requestedGame, seed, startLevel }) => createGameBridgeNativeSession({
      dispatch,
      game: requestedGame,
      seed,
      startLevel,
    }),
    beforeAction: hook.beforeAction,
    afterAction: hook.afterAction,
    hookInputMode: hook.inputMode,
  });
}

export function createBStckNativeRunner(options) {
  return createCandidateRunner({ ...options, game: 'STCK' });
}

export function createBSmlpNativeRunner(options) {
  return createCandidateRunner({ ...options, game: 'SMLP' });
}

export const EXPLICIT_NATIVE_RUNNER_IDENTITIES = Object.freeze({
  A_STCK: Object.freeze({
    variant: 'A',
    game: 'STCK',
    gameId: 'stck-c0000001',
    corpusRef: 'native-public-action-corpus-v1',
    seed: 0,
    startLevel: 1,
    backend: 'python-wasm',
    status: 'reconstructed-contract-pending-real-native-execution',
  }),
  A_SMLP: Object.freeze({
    variant: 'A',
    game: 'SMLP',
    gameId: 'smlp-c3000001',
    corpusRef: 'native-public-action-corpus-v1',
    seed: 0,
    startLevel: 1,
    backend: 'python-wasm',
    status: 'reconstructed-contract-pending-real-native-execution',
  }),
  B_STCK: Object.freeze({
    variant: 'B',
    game: 'STCK',
    gameId: 'stck-c0000001',
    corpusRef: 'native-public-action-corpus-v1',
    seed: 0,
    startLevel: 1,
    backend: 'python-wasm',
    candidateHook: 'region_intervention',
    status: 'reconstructed-contract-pending-real-region-hook-and-native-execution',
  }),
  B_SMLP: Object.freeze({
    variant: 'B',
    game: 'SMLP',
    gameId: 'smlp-c3000001',
    corpusRef: 'native-public-action-corpus-v1',
    seed: 0,
    startLevel: 1,
    backend: 'python-wasm',
    candidateHook: 'region_intervention',
    status: 'reconstructed-contract-pending-real-region-hook-and-native-execution',
  }),
});
