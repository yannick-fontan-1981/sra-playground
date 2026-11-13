import { createGameBridgeNativeSession } from './native-loop-game-bridge-session.mjs';
import { createPublicCorpusSessionRunner } from './native-loop-public-corpus-runner.mjs';

function nonEmpty(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

/**
 * First explicit reconstructed native benchmark runner: A/STCK.
 *
 * It deliberately requires the native game_bridge transport to be injected.
 * The runner therefore cannot silently fall back to a fake, HTTP, Sites, or
 * alternate game implementation.
 */
export function createAStckNativeRunner({ dispatch, sourceRef }) {
  nonEmpty(sourceRef, 'sourceRef');
  if (typeof dispatch !== 'function') {
    throw new TypeError('A/STCK native runner requires game_bridge dispatch');
  }

  return createPublicCorpusSessionRunner({
    variant: 'A',
    game: 'STCK',
    sourceRef,
    seed: 0,
    createSession: ({ game, seed, startLevel }) => createGameBridgeNativeSession({
      dispatch,
      game,
      seed,
      startLevel,
    }),
  });
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
});
