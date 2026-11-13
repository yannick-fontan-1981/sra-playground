import { performance } from 'node:perf_hooks';
import {
  NATIVE_PUBLIC_ACTION_CORPUS_V1,
  selectNativePublicCostAction,
} from './native-loop-public-action-corpus.mjs';

export const PUBLIC_CORPUS_TIMING_SCOPE =
  'after initial public observation, through policy/hook/action loops, ending after the returned observation of the requested final action';

function nonEmpty(value, label) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${label} must be a non-empty string`);
  return value;
}

function validateSession(session) {
  if (!session || typeof session !== 'object') throw new TypeError('native public session must be an object');
  if (typeof session.initialObservation !== 'function') throw new TypeError('native public session requires initialObservation()');
  if (typeof session.action !== 'function') throw new TypeError('native public session requires action()');
  return session;
}

/**
 * Candidate runner factory for the newly requalified public-only corpus.
 *
 * It owns timing but not game construction. The native game factory remains a
 * separate recovery dependency. Setup and the first observation are outside
 * the measured scope; the exact requested action loop is inside.
 */
export function createPublicCorpusSessionRunner({
  variant,
  game,
  sourceRef,
  seed = NATIVE_PUBLIC_ACTION_CORPUS_V1.seed,
  createSession,
  beforeAction,
  afterAction,
}) {
  nonEmpty(variant, 'variant');
  nonEmpty(game, 'game');
  nonEmpty(sourceRef, 'sourceRef');
  if (!Number.isInteger(seed)) throw new TypeError('seed must be an integer');
  if (typeof createSession !== 'function') throw new TypeError('createSession must be a function');
  if (beforeAction !== undefined && typeof beforeAction !== 'function') {
    throw new TypeError('beforeAction must be a function when provided');
  }
  if (afterAction !== undefined && typeof afterAction !== 'function') {
    throw new TypeError('afterAction must be a function when provided');
  }

  return async descriptor => {
    if (descriptor.variant !== variant) {
      throw new Error(`runner ${variant}/${game} cannot execute variant ${descriptor.variant}`);
    }
    if (descriptor.game !== game) {
      throw new Error(`runner ${variant}/${game} cannot execute game ${descriptor.game}`);
    }
    if (!Number.isInteger(descriptor.actions) || descriptor.actions < 1) {
      throw new RangeError('descriptor.actions must be a positive integer');
    }

    const session = validateSession(await createSession({
      game,
      seed,
      startLevel: NATIVE_PUBLIC_ACTION_CORPUS_V1.startLevel,
      descriptor: structuredClone(descriptor),
    }));
    let observation = await session.initialObservation();

    let policyMs = 0;
    let candidateHookMs = 0;
    let gameActionMs = 0;
    const actions = [];
    const started = performance.now();

    for (let index = 0; index < descriptor.actions; index += 1) {
      const policyStarted = performance.now();
      const action = selectNativePublicCostAction(observation);
      policyMs += performance.now() - policyStarted;
      if (!action) {
        throw new Error(`public corpus cannot choose action ${index + 1}/${descriptor.actions}`);
      }

      if (beforeAction) {
        const hookStarted = performance.now();
        await beforeAction({
          index,
          action: structuredClone(action),
          observation: structuredClone(observation),
          descriptor: structuredClone(descriptor),
        });
        candidateHookMs += performance.now() - hookStarted;
      }

      const beforeObservation = structuredClone(observation);
      const actionStarted = performance.now();
      observation = await session.action(structuredClone(action));
      gameActionMs += performance.now() - actionStarted;

      if (afterAction) {
        const hookStarted = performance.now();
        await afterAction({
          index,
          action: structuredClone(action),
          beforeObservation,
          observation: structuredClone(observation),
          descriptor: structuredClone(descriptor),
        });
        candidateHookMs += performance.now() - hookStarted;
      }

      actions.push(structuredClone(action));
    }

    const durationMs = performance.now() - started;
    return {
      durationMs,
      phases: {
        public_policy: policyMs,
        candidate_hook: candidateHookMs,
        game_action: gameActionMs,
      },
      metadata: {
        runnerKind: 'requalified-public-corpus-candidate',
        runnerRef: `public-corpus-runner:${variant}/${game}`,
        sourceRef,
        corpusRef: NATIVE_PUBLIC_ACTION_CORPUS_V1.id,
        seed,
        timingScope: PUBLIC_CORPUS_TIMING_SCOPE,
        actions,
      },
    };
  };
}
