const SERIES_TO_VARIANT = Object.freeze({ A1: 'A', B1: 'B', B2: 'B', A2: 'A' });
const GAME_ACTIONS = Object.freeze({
  STCK: Object.freeze({ warmup: 3, measured: 10 }),
  SMLP: Object.freeze({ warmup: 3, measured: 15 }),
});

function validateRunner(runner, label) {
  if (typeof runner !== 'function') {
    throw new TypeError(`Missing native session runner for ${label}`);
  }
  return runner;
}

function validateDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== 'object') {
    throw new TypeError('native session descriptor must be an object');
  }
  if (!Object.hasOwn(SERIES_TO_VARIANT, descriptor.series)) {
    throw new RangeError(`unknown ABBA series ${String(descriptor.series)}`);
  }
  const expectedVariant = SERIES_TO_VARIANT[descriptor.series];
  if (descriptor.variant !== expectedVariant) {
    throw new Error(`series ${descriptor.series} requires variant ${expectedVariant}`);
  }
  if (!Object.hasOwn(GAME_ACTIONS, descriptor.game)) {
    throw new RangeError(`unknown benchmark game ${String(descriptor.game)}`);
  }
  if (descriptor.kind !== 'warmup' && descriptor.kind !== 'measured') {
    throw new RangeError(`unknown session kind ${String(descriptor.kind)}`);
  }
  const expectedActions = GAME_ACTIONS[descriptor.game][descriptor.kind];
  if (descriptor.actions !== expectedActions) {
    throw new Error(
      `${descriptor.series}/${descriptor.game}/${descriptor.kind} requires ${expectedActions} actions`,
    );
  }
  if (!Number.isInteger(descriptor.invocationIndex) || descriptor.invocationIndex < 0) {
    throw new RangeError('invocationIndex must be a non-negative integer');
  }
  if (!Number.isInteger(descriptor.sessionIndex) || descriptor.sessionIndex < 0) {
    throw new RangeError('sessionIndex must be a non-negative integer');
  }
  if (descriptor.kind === 'warmup' && descriptor.sessionIndex !== 0) {
    throw new Error('warmup sessionIndex must be 0');
  }
  if (descriptor.kind === 'measured' && descriptor.sessionIndex > 3) {
    throw new RangeError('measured sessionIndex must be in [0, 3]');
  }
}

function validateSample(sample, descriptor) {
  if (!sample || typeof sample !== 'object') {
    throw new TypeError(
      `native runner returned no sample for ${descriptor.series}/${descriptor.game}/${descriptor.kind}`,
    );
  }
  if (!Number.isFinite(sample.durationMs) || sample.durationMs < 0) {
    throw new RangeError('native runner sample durationMs must be a non-negative finite number');
  }
  if (sample.phases !== undefined) {
    if (!sample.phases || typeof sample.phases !== 'object' || Array.isArray(sample.phases)) {
      throw new TypeError('native runner sample phases must be an object');
    }
    for (const [name, value] of Object.entries(sample.phases)) {
      if (!name || !Number.isFinite(value) || value < 0) {
        throw new RangeError('native runner phase durations must be non-negative finite numbers');
      }
    }
  }
  return structuredClone(sample);
}

/**
 * Create the runSession callback expected by measure-native-loop-costs.mjs.
 *
 * This adapter deliberately performs no timing and owns no game corpus.
 * Each explicit A/B × STCK/SMLP runner is responsible for the qualified
 * native-session measurement scope and for returning durationMs/phases.
 */
export function createNativeLoopRunSession(runners) {
  if (!runners || typeof runners !== 'object') {
    throw new TypeError('native session runners must be provided');
  }

  const table = {
    A: {
      STCK: validateRunner(runners.A?.STCK, 'A/STCK'),
      SMLP: validateRunner(runners.A?.SMLP, 'A/SMLP'),
    },
    B: {
      STCK: validateRunner(runners.B?.STCK, 'B/STCK'),
      SMLP: validateRunner(runners.B?.SMLP, 'B/SMLP'),
    },
  };

  return async descriptor => {
    validateDescriptor(descriptor);
    const runner = table[descriptor.variant][descriptor.game];
    const forwarded = structuredClone(descriptor);
    const sample = await runner(forwarded);
    return validateSample(sample, descriptor);
  };
}

export const NATIVE_SESSION_ADAPTER_CONTRACT = Object.freeze({
  seriesToVariant: SERIES_TO_VARIANT,
  gameActions: GAME_ACTIONS,
  ownsTiming: false,
  ownsCorpus: false,
  requiresExplicitRunners: Object.freeze(['A/STCK', 'A/SMLP', 'B/STCK', 'B/SMLP']),
});
