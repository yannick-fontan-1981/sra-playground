function nonEmpty(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function validateRuntime(runtime) {
  if (!runtime || typeof runtime !== 'object') {
    throw new TypeError('browser game runtime must be an object');
  }
  if (typeof runtime.load !== 'function' || typeof runtime.action !== 'function') {
    throw new TypeError('browser game runtime requires load() and action()');
  }
  return runtime;
}

function publicBridgeObservation(observation, game) {
  if (!observation || typeof observation !== 'object') {
    throw new TypeError('browser game runtime returned an invalid observation');
  }
  const code = observation.code ?? observation.gameCode;
  if (code !== game) {
    throw new Error(`browser game runtime returned ${String(code)} for ${game}`);
  }
  return {
    ...structuredClone(observation),
    code,
  };
}

/**
 * Adapt BrowserGameRuntime to the exact request/response boundary expected by
 * createGameBridgeNativeSession. It supports no fallback transport and no
 * request kind outside load/action.
 */
export function createBrowserWorkerGameBridgeDispatch({ runtime, game }) {
  const browserRuntime = validateRuntime(runtime);
  nonEmpty(game, 'game');
  let loaded = false;

  return async request => {
    if (!request || typeof request !== 'object') {
      throw new TypeError('browser worker dispatch request must be an object');
    }
    if (request.type === 'load') {
      if (request.code !== game || request.level !== 1) {
        throw new Error(`browser worker ${game} runner requires explicit ${game} level 1 load`);
      }
      const observation = await browserRuntime.load(game, 1);
      loaded = true;
      return publicBridgeObservation(observation, game);
    }
    if (request.type === 'action') {
      if (!loaded) throw new Error(`browser worker ${game} action before load`);
      if (!Number.isInteger(request.actionId) || request.actionId < 1 || request.actionId > 7) {
        throw new RangeError('browser worker actionId must be an integer in [1, 7]');
      }
      const observation = await browserRuntime.action(request.actionId, request.data);
      return publicBridgeObservation(observation, game);
    }
    throw new Error(`unsupported browser worker benchmark request ${String(request.type)}`);
  };
}
