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

function validateCorpus(corpus, game) {
  if (!corpus || typeof corpus !== 'object') throw new TypeError('public corpus must be an object');
  nonEmpty(corpus.id, 'corpus.id');
  if (!Array.isArray(corpus.games) || !corpus.games.includes(game)) {
    throw new Error(`corpus ${corpus.id} does not support game ${game}`);
  }
  if (!Number.isInteger(corpus.startLevel) || corpus.startLevel < 1) {
    throw new RangeError('corpus.startLevel must be a positive integer');
  }
  return corpus;
}

function defaultSelectAction({ observation }) {
  return selectNativePublicCostAction(observation);
}

function validateHookInputMode(value) {
  if (value !== 'cloned' && value !== 'readonly') {
    throw new TypeError('hookInputMode must be cloned or readonly');
  }
  return value;
}

function hookValue(value, mode) {
  return mode === 'readonly' ? value : structuredClone(value);
}

/**
 * Candidate runner factory for a deterministic public-only corpus.
 *
 * It owns timing but not game construction. The native game factory remains a
 * separate recovery dependency. Setup and the first observation are outside
 * the measured scope; the exact requested action loop is inside.
 *
 * Hook inputs are cloned by default. The internal readonly mode is available
 * only for hooks whose contract guarantees they never mutate runner-owned data.
 */
export function createPublicCorpusSessionRunner({
  variant,
  game,
  sourceRef,
  corpus = NATIVE_PUBLIC_ACTION_CORPUS_V1,
  selectAction = defaultSelectAction,
  seed = corpus.seed,
  createSession,
  beforeAction,
  afterAction,
  hookInputMode = 'cloned',
}) {
  nonEmpty(variant, 'variant');
  nonEmpty(game, 'game');
  nonEmpty(sourceRef, 'sourceRef');
  const qualifiedCorpus = validateCorpus(corpus, game);
  const qualifiedHookInputMode = validateHookInputMode(hookInputMode);
  if (typeof selectAction !== 'function') throw new TypeError('selectAction must be a function');
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
      startLevel: qualifiedCorpus.startLevel,
      descriptor: structuredClone(descriptor),
    }));
    let observation = await session.initialObservation();

    let policyMs = 0;
    let candidateHookMs = 0;
    let gameActionMs = 0;
    const actions = [];
    const started = globalThis.performance.now();

    for (let index = 0; index < descriptor.actions; index += 1) {
      const policyStarted = globalThis.performance.now();
      const action = await selectAction({
        game,
        index,
        observation: structuredClone(observation),
        descriptor: structuredClone(descriptor),
      });
      policyMs += globalThis.performance.now() - policyStarted;
      if (!action) {
        throw new Error(`public corpus cannot choose action ${index + 1}/${descriptor.actions}`);
      }

      if (beforeAction) {
        const hookStarted = globalThis.performance.now();
        await beforeAction({
          index,
          action: hookValue(action, qualifiedHookInputMode),
          observation: hookValue(observation, qualifiedHookInputMode),
          descriptor: hookValue(descriptor, qualifiedHookInputMode),
        });
        candidateHookMs += globalThis.performance.now() - hookStarted;
      }

      const beforeObservation = afterAction
        ? hookValue(observation, qualifiedHookInputMode)
        : undefined;
      const actionStarted = globalThis.performance.now();
      observation = await session.action(structuredClone(action));
      gameActionMs += globalThis.performance.now() - actionStarted;

      if (afterAction) {
        const hookStarted = globalThis.performance.now();
        await afterAction({
          index,
          action: hookValue(action, qualifiedHookInputMode),
          beforeObservation,
          observation: hookValue(observation, qualifiedHookInputMode),
          descriptor: hookValue(descriptor, qualifiedHookInputMode),
        });
        candidateHookMs += globalThis.performance.now() - hookStarted;
      }

      actions.push(structuredClone(action));
    }

    const durationMs = globalThis.performance.now() - started;
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
        corpusRef: qualifiedCorpus.id,
        seed,
        timingScope: PUBLIC_CORPUS_TIMING_SCOPE,
        actions,
      },
    };
  };
}
