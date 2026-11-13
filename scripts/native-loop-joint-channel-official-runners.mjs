import { PROTOCOL_VERSION } from '../src/runtime/contracts.ts';
import {
  producePublicSmlpGateCandidate,
} from '../src/logos-engine/v6-public-addressed-joint-channels.ts';
import {
  producePublicStckTargetCandidate,
} from '../src/logos-engine/v6-public-stck-joint-channels.ts';
import {
  createOfficialJointChannelSession,
  createOfficialJointChannelStats,
} from './native-loop-joint-channel-official-hook.mjs';
import { createGameBridgeNativeSession } from './native-loop-game-bridge-session.mjs';
import { findStckVisibleStackCardCenter } from './native-loop-region-public-action6-probe.mjs';
import { createNativeLoopRunSession } from './native-loop-session-adapter.mjs';

export const LOT9C4_CORPUS = Object.freeze({
  id: 'lot9c4-strict-public-joint-corpus-v1',
  games: Object.freeze(['STCK', 'SMLP']),
  seed: 0,
  startLevel: 1,
  stck: Object.freeze({
    excludedPreludeProducer: 'region-public-action6-probe-v1',
    excludedPreludeActionsPerTarget: 3,
    excludedPreludeAction: Object.freeze({ id: 6, x: 4, y: 52 }),
    excludedPreludeChangedPixels: Object.freeze([211, 138, 95]),
    targetAction: Object.freeze({ id: 6, x: 4, y: 50 }),
    targetChangedPixels: 64,
  }),
  smlp: Object.freeze({
    targetChangedPixels: 9,
  }),
});

export const LOT9C4_TIMING_SCOPE = Object.freeze({
  STCK:
    'sum of requested strict target-action cycles only; each cycle starts after a fresh native session and its identical three-action public prelude, then includes public target selection, optional B joint prepare, the target Browser/Pyodide action, returned observation conversion and optional B acquisition',
  SMLP:
    'after initial public observation, through the requested public target selection, optional B joint prepare, Browser/Pyodide action, returned observation conversion and optional B acquisition loops',
});

const NATIVE_BROWSER_TRANSPORT =
  'BrowserGameRuntime -> game-worker.ts -> Pyodide -> game_bridge.py -> custom-games.zip';

function nonEmpty(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function validateDescriptor(descriptor, variant, game) {
  if (!descriptor || typeof descriptor !== 'object') {
    throw new TypeError('Lot 9C4 runner descriptor must be an object');
  }
  if (descriptor.variant !== variant || descriptor.game !== game) {
    throw new Error(`Lot 9C4 runner ${variant}/${game} received ${descriptor.variant}/${descriptor.game}`);
  }
  if (!Number.isInteger(descriptor.actions) || descriptor.actions < 1) {
    throw new RangeError('Lot 9C4 descriptor.actions must be positive');
  }
  return descriptor;
}

function dispatchFor(dispatchByGame, game) {
  const dispatch = dispatchByGame?.[game];
  if (typeof dispatch !== 'function') throw new TypeError(`missing Lot 9C4 ${game} dispatch`);
  return dispatch;
}

function framePixels(observation) {
  if (!Array.isArray(observation?.frame) || observation.frame.length !== 64) {
    throw new RangeError('Lot 9C4 public frame must be 64x64');
  }
  const pixels = new Uint8Array(64 * 64);
  let offset = 0;
  for (const row of observation.frame) {
    if (!Array.isArray(row) || row.length !== 64) {
      throw new RangeError('Lot 9C4 public frame must be 64x64');
    }
    for (const value of row) {
      if (!Number.isInteger(value) || value < 0 || value > 15) {
        throw new RangeError('Lot 9C4 public frame contains an invalid palette value');
      }
      pixels[offset++] = value;
    }
  }
  return pixels;
}

function agentObservation(publicObservation, sessionId, sequence) {
  if (!Array.isArray(publicObservation?.availableActionIds)) {
    throw new TypeError('Lot 9C4 observation requires availableActionIds');
  }
  if (publicObservation.state !== 'NOT_FINISHED' && publicObservation.state !== 'WIN') {
    throw new Error(`Lot 9C4 unsupported public state ${String(publicObservation.state)}`);
  }
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId,
    sequence,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels: framePixels(publicObservation),
    },
    availableActionIds: [...publicObservation.availableActionIds],
    state: publicObservation.state,
    level: publicObservation.level,
    levelsCompleted: publicObservation.levelsCompleted,
  };
}

function publicAction(agentAction) {
  if (agentAction?.id !== 6 || !agentAction.data) {
    throw new Error('Lot 9C4 corpus requires addressed ACTION6');
  }
  const { x, y } = agentAction.data;
  if (![x, y].every(value => Number.isInteger(value) && value >= 0 && value < 64)) {
    throw new RangeError('Lot 9C4 ACTION6 coordinates must be in [0,63]');
  }
  return { id: 6, x, y };
}

function changedPixels(before, after) {
  const left = framePixels(before);
  const right = framePixels(after);
  let changed = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) changed += 1;
  }
  return changed;
}

function samePublicAction(left, right) {
  return left?.id === right?.id && left?.x === right?.x && left?.y === right?.y;
}

async function createSession(dispatch, game, descriptor) {
  return createGameBridgeNativeSession({
    dispatch,
    game,
    seed: LOT9C4_CORPUS.seed,
    startLevel: LOT9C4_CORPUS.startLevel,
    descriptor,
  });
}

async function prepareStrictStckCycle({ dispatch, descriptor, targetIndex }) {
  const session = await createSession(dispatch, 'STCK', descriptor);
  let publicCurrent = await session.initialObservation();
  const sessionId = [
    'lot9c4',
    descriptor.variant,
    'STCK',
    descriptor.invocationIndex,
    targetIndex,
  ].join(':');
  let sequence = 0;
  let current = agentObservation(publicCurrent, sessionId, sequence);
  let candidate = producePublicStckTargetCandidate(current);
  const prelude = [];

  for (let step = 0; !candidate && step < 16; step += 1) {
    const action = findStckVisibleStackCardCenter(publicCurrent);
    if (!action) throw new Error('Lot 9C4 STCK prelude exhausted visible cards');
    const publicNext = await session.action(action);
    const delta = changedPixels(publicCurrent, publicNext);
    prelude.push({ action: structuredClone(action), changedPixelCount: delta });
    publicCurrent = publicNext;
    sequence += 1;
    current = agentObservation(publicCurrent, sessionId, sequence);
    candidate = producePublicStckTargetCandidate(current);
  }

  if (!candidate) throw new Error('Lot 9C4 STCK prelude did not reach a unique-card state');
  if (prelude.length !== LOT9C4_CORPUS.stck.excludedPreludeActionsPerTarget) {
    throw new Error(`Lot 9C4 STCK prelude length changed to ${prelude.length}`);
  }
  for (let index = 0; index < prelude.length; index += 1) {
    if (!samePublicAction(prelude[index].action, LOT9C4_CORPUS.stck.excludedPreludeAction)) {
      throw new Error(`Lot 9C4 STCK prelude action ${index} changed`);
    }
    if (prelude[index].changedPixelCount !== LOT9C4_CORPUS.stck.excludedPreludeChangedPixels[index]) {
      throw new Error(`Lot 9C4 STCK prelude delta ${index} changed`);
    }
  }
  const selected = publicAction(candidate.action);
  if (!samePublicAction(selected, LOT9C4_CORPUS.stck.targetAction)) {
    throw new Error('Lot 9C4 strict STCK target action changed');
  }

  return {
    session,
    sessionId,
    sequence,
    publicObservation: publicCurrent,
    agentObservation: current,
    candidate,
    prelude,
  };
}

function metadataBase({ variant, game, sourceRef, descriptor, actions, timingScope }) {
  return {
    runnerKind: 'lot9c4-official-strict-joint-channel',
    runnerRef: `lot9c4:${variant}/${game}`,
    sourceRef,
    corpusRef: LOT9C4_CORPUS.id,
    seed: LOT9C4_CORPUS.seed,
    startLevel: LOT9C4_CORPUS.startLevel,
    timingScope,
    transport: NATIVE_BROWSER_TRANSPORT,
    actions,
    actionsExecuted: actions.length,
    completedRequestedActions: actions.length === descriptor.actions,
  };
}

function createStckRunner({ variant, sourceRef, dispatch, stats }) {
  return async descriptor => {
    validateDescriptor(descriptor, variant, 'STCK');
    let durationMs = 0;
    let policyMs = 0;
    let candidateHookMs = 0;
    let gameActionMs = 0;
    const actions = [];
    const excludedPrelude = [];
    const targetDeltas = [];

    for (let targetIndex = 0; targetIndex < descriptor.actions; targetIndex += 1) {
      const setup = await prepareStrictStckCycle({ dispatch, descriptor, targetIndex });
      excludedPrelude.push(setup.prelude);
      if (variant === 'B') {
        stats.STCK.excludedPreludeActions += setup.prelude.length;
      }

      const cycleStarted = globalThis.performance.now();
      const policyStarted = globalThis.performance.now();
      const candidate = producePublicStckTargetCandidate(setup.agentObservation);
      policyMs += globalThis.performance.now() - policyStarted;
      if (!candidate) throw new Error('Lot 9C4 strict STCK target disappeared before timing');
      const selectedAction = publicAction(candidate.action);

      let joint;
      if (variant === 'B') {
        joint = createOfficialJointChannelSession({
          game: 'STCK',
          sessionId: setup.sessionId,
          stats: stats.STCK,
        });
        const hookStarted = globalThis.performance.now();
        joint.prepare(setup.agentObservation, candidate.action);
        candidateHookMs += globalThis.performance.now() - hookStarted;
      }

      const actionStarted = globalThis.performance.now();
      const publicAfter = await setup.session.action(selectedAction);
      gameActionMs += globalThis.performance.now() - actionStarted;
      const after = agentObservation(publicAfter, setup.sessionId, setup.sequence + 1);

      if (joint) {
        const hookStarted = globalThis.performance.now();
        joint.acquire(after);
        candidateHookMs += globalThis.performance.now() - hookStarted;
      }
      durationMs += globalThis.performance.now() - cycleStarted;

      const delta = changedPixels(setup.publicObservation, publicAfter);
      if (delta !== LOT9C4_CORPUS.stck.targetChangedPixels) {
        throw new Error(`Lot 9C4 strict STCK target delta changed to ${delta}`);
      }
      if (producePublicStckTargetCandidate(after) !== undefined) {
        throw new Error('Lot 9C4 strict STCK cycle unexpectedly exposes another unique card');
      }
      actions.push(selectedAction);
      targetDeltas.push(delta);
      if (variant === 'B') stats.STCK.targetCycles += 1;
    }

    if (variant === 'B') stats.STCK.completedProtocolSessions += 1;
    return {
      durationMs,
      phases: {
        public_policy: policyMs,
        candidate_hook: candidateHookMs,
        game_action: gameActionMs,
      },
      metadata: {
        ...metadataBase({
          variant,
          game: 'STCK',
          sourceRef,
          descriptor,
          actions,
          timingScope: LOT9C4_TIMING_SCOPE.STCK,
        }),
        excludedSetup: {
          freshNativeSessions: descriptor.actions,
          actionsPerTarget: LOT9C4_CORPUS.stck.excludedPreludeActionsPerTarget,
          actionCount: descriptor.actions * LOT9C4_CORPUS.stck.excludedPreludeActionsPerTarget,
          prelude: excludedPrelude,
        },
        targetDeltas,
      },
    };
  };
}

function createSmlpRunner({ variant, sourceRef, dispatch, stats }) {
  return async descriptor => {
    validateDescriptor(descriptor, variant, 'SMLP');
    const session = await createSession(dispatch, 'SMLP', descriptor);
    let publicCurrent = await session.initialObservation();
    const sessionId = [
      'lot9c4',
      descriptor.variant,
      'SMLP',
      descriptor.invocationIndex,
    ].join(':');
    const joint = variant === 'B'
      ? createOfficialJointChannelSession({ game: 'SMLP', sessionId, stats: stats.SMLP })
      : undefined;

    let policyMs = 0;
    let candidateHookMs = 0;
    let gameActionMs = 0;
    const actions = [];
    const targetDeltas = [];
    const started = globalThis.performance.now();

    for (let index = 0; index < descriptor.actions; index += 1) {
      const current = agentObservation(publicCurrent, sessionId, index);
      const policyStarted = globalThis.performance.now();
      const candidate = producePublicSmlpGateCandidate(current);
      policyMs += globalThis.performance.now() - policyStarted;
      if (!candidate) throw new Error(`Lot 9C4 SMLP target missing at action ${index}`);
      const selectedAction = publicAction(candidate.action);

      if (joint) {
        const hookStarted = globalThis.performance.now();
        joint.prepare(current, candidate.action);
        candidateHookMs += globalThis.performance.now() - hookStarted;
      }

      const actionStarted = globalThis.performance.now();
      const publicAfter = await session.action(selectedAction);
      gameActionMs += globalThis.performance.now() - actionStarted;
      const after = agentObservation(publicAfter, sessionId, index + 1);

      if (joint) {
        const hookStarted = globalThis.performance.now();
        joint.acquire(after);
        candidateHookMs += globalThis.performance.now() - hookStarted;
      }

      const delta = changedPixels(publicCurrent, publicAfter);
      if (delta !== LOT9C4_CORPUS.smlp.targetChangedPixels) {
        throw new Error(`Lot 9C4 SMLP target delta changed to ${delta}`);
      }
      actions.push(selectedAction);
      targetDeltas.push(delta);
      publicCurrent = publicAfter;
      if (variant === 'B') stats.SMLP.targetCycles += 1;
    }

    const durationMs = globalThis.performance.now() - started;
    if (variant === 'B') stats.SMLP.completedProtocolSessions += 1;
    return {
      durationMs,
      phases: {
        public_policy: policyMs,
        candidate_hook: candidateHookMs,
        game_action: gameActionMs,
      },
      metadata: {
        ...metadataBase({
          variant,
          game: 'SMLP',
          sourceRef,
          descriptor,
          actions,
          timingScope: LOT9C4_TIMING_SCOPE.SMLP,
        }),
        excludedSetup: {
          freshNativeSessions: 1,
          actionCount: 0,
        },
        targetDeltas,
      },
    };
  };
}

/** Build the four explicit A/B x STCK/SMLP runners required by the ABBA adapter. */
export function createOfficialJointChannelBenchmarkRunSession({
  dispatchByGame,
  referenceSourceRef,
  candidateSourceRef,
}) {
  nonEmpty(referenceSourceRef, 'referenceSourceRef');
  nonEmpty(candidateSourceRef, 'candidateSourceRef');
  const stats = createOfficialJointChannelStats();
  const runners = {
    A: {
      STCK: createStckRunner({
        variant: 'A',
        sourceRef: referenceSourceRef,
        dispatch: dispatchFor(dispatchByGame, 'STCK'),
        stats,
      }),
      SMLP: createSmlpRunner({
        variant: 'A',
        sourceRef: referenceSourceRef,
        dispatch: dispatchFor(dispatchByGame, 'SMLP'),
        stats,
      }),
    },
    B: {
      STCK: createStckRunner({
        variant: 'B',
        sourceRef: candidateSourceRef,
        dispatch: dispatchFor(dispatchByGame, 'STCK'),
        stats,
      }),
      SMLP: createSmlpRunner({
        variant: 'B',
        sourceRef: candidateSourceRef,
        dispatch: dispatchFor(dispatchByGame, 'SMLP'),
        stats,
      }),
    },
  };
  return {
    runSession: createNativeLoopRunSession(runners),
    runners,
    stats,
  };
}

export const LOT9C4_RUNNER_IDENTITIES = Object.freeze({
  A: Object.freeze({
    STCK: Object.freeze({ id: 'lot9c4:A/STCK', jointChannels: 'disabled' }),
    SMLP: Object.freeze({ id: 'lot9c4:A/SMLP', jointChannels: 'disabled' }),
  }),
  B: Object.freeze({
    STCK: Object.freeze({ id: 'lot9c4:B/STCK', jointChannels: 'strict-unique-card' }),
    SMLP: Object.freeze({ id: 'lot9c4:B/SMLP', jointChannels: 'qualified-row-major-gate' }),
  }),
  corpusRef: LOT9C4_CORPUS.id,
  stckPrelude:
    'three identical public setup actions per measured strict target action, excluded from both A and B timing and retained in metadata',
  invariant:
    'A and B use the same checkout, Browser/Pyodide transport, archive, seed, setup policy and target actions; only B executes the qualified joint owner, OP28 and two-channel acquisition',
});
