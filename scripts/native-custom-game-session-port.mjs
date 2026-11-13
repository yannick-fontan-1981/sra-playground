export const NATIVE_CUSTOM_GAME_SESSION_CONTRACT = Object.freeze({
  supportedGames: Object.freeze(['STCK', 'SMLP']),
  seed: 0,
  startLevel: 1,
  bridgeRef: 'public/python/game_bridge.py',
  sourceArchiveRef: 'public/python/custom-games.zip',
  isolatedBridgePerSession: true,
});

function assertGame(game) {
  if (!NATIVE_CUSTOM_GAME_SESSION_CONTRACT.supportedGames.includes(game)) {
    throw new RangeError(`unsupported native cost game ${String(game)}`);
  }
  return game;
}

function validateObservation(observation, game) {
  if (!observation || typeof observation !== 'object') {
    throw new TypeError('native custom bridge returned no observation');
  }
  const code = observation.gameCode ?? observation.code;
  if (code !== game) {
    throw new Error(`native custom bridge returned game ${String(code)} instead of ${game}`);
  }
  if (!Array.isArray(observation.availableActionIds)) {
    throw new TypeError('native custom observation must expose availableActionIds');
  }
  if (typeof observation.state !== 'string') {
    throw new TypeError('native custom observation must expose state');
  }
  return structuredClone(observation);
}

function validateAction(action, observation) {
  if (!action || typeof action !== 'object' || !Number.isInteger(action.id)) {
    throw new TypeError('native custom action must contain an integer id');
  }
  if (!observation.availableActionIds.includes(action.id)) {
    throw new Error(`native custom action ${action.id} is unavailable`);
  }
  if (action.id === 6) {
    const data = action.data;
    if (
      !data
      || !Number.isInteger(data.x)
      || !Number.isInteger(data.y)
      || data.x < 0 || data.x > 63
      || data.y < 0 || data.y > 63
    ) {
      throw new Error('ACTION6 requires integer x/y coordinates in [0, 63]');
    }
  }
}

export function createNativeCustomGameSessionFactory({ createBridge }) {
  if (typeof createBridge !== 'function') {
    throw new TypeError('createBridge must be a function');
  }

  return async function createSession({
    game,
    seed,
    startLevel,
    descriptor,
  }) {
    assertGame(game);
    if (seed !== NATIVE_CUSTOM_GAME_SESSION_CONTRACT.seed) {
      throw new Error(`native custom bridge contract requires seed ${NATIVE_CUSTOM_GAME_SESSION_CONTRACT.seed}`);
    }
    if (startLevel !== NATIVE_CUSTOM_GAME_SESSION_CONTRACT.startLevel) {
      throw new Error(`native cost reconstruction currently requires level ${NATIVE_CUSTOM_GAME_SESSION_CONTRACT.startLevel}`);
    }
    if (!descriptor || descriptor.game !== game) {
      throw new Error('native session descriptor/game mismatch');
    }

    const bridge = await createBridge({ game, seed, startLevel, descriptor: structuredClone(descriptor) });
    if (!bridge || typeof bridge.dispatch !== 'function') {
      throw new TypeError('createBridge must return an object with dispatch(request)');
    }

    let observation;
    let loaded = false;

    return {
      async initialObservation() {
        if (loaded) return structuredClone(observation);
        observation = validateObservation(
          await bridge.dispatch({ type: 'load', code: game, level: startLevel }),
          game,
        );
        loaded = true;
        return structuredClone(observation);
      },

      async action(action) {
        if (!loaded) throw new Error('initialObservation() must be called before action()');
        validateAction(action, observation);
        observation = validateObservation(
          await bridge.dispatch({
            type: 'action',
            actionId: action.id,
            ...(action.id === 6 ? { data: structuredClone(action.data) } : {}),
          }),
          game,
        );
        return structuredClone(observation);
      },

      metadata: Object.freeze({
        game,
        seed,
        startLevel,
        bridgeRef: NATIVE_CUSTOM_GAME_SESSION_CONTRACT.bridgeRef,
        sourceArchiveRef: NATIVE_CUSTOM_GAME_SESSION_CONTRACT.sourceArchiveRef,
      }),
    };
  };
}
