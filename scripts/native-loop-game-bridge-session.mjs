const GAME_BRIDGE_CONTRACTS = Object.freeze({
  STCK: Object.freeze({
    code: 'STCK',
    gameId: 'stck-c0000001',
    backend: 'python-wasm',
  }),
  SMLP: Object.freeze({
    code: 'SMLP',
    gameId: 'smlp-c3000001',
    backend: 'python-wasm',
  }),
});

function requireDispatch(dispatch) {
  if (typeof dispatch !== 'function') {
    throw new TypeError('native game bridge dispatch must be a function');
  }
  return dispatch;
}

function validatePublicObservation(observation, contract) {
  if (!observation || typeof observation !== 'object' || Array.isArray(observation)) {
    throw new TypeError('native game bridge returned an invalid public observation');
  }
  if (observation.error) {
    throw new Error(`native game bridge error: ${String(observation.error)}`);
  }
  if (observation.code !== contract.code) {
    throw new Error(`native game bridge code mismatch: expected ${contract.code}`);
  }
  if (observation.gameId !== contract.gameId) {
    throw new Error(`native game bridge gameId mismatch: expected ${contract.gameId}`);
  }
  if (observation.backend !== contract.backend) {
    throw new Error(`native game bridge backend mismatch: expected ${contract.backend}`);
  }
  if (!Array.isArray(observation.availableActionIds)) {
    throw new TypeError('native game bridge observation must expose availableActionIds');
  }
  if (observation.availableActionIds.some(id => !Number.isInteger(id) || id < 1 || id > 7)) {
    throw new RangeError('native game bridge availableActionIds must contain integer action IDs 1..7');
  }
  if (typeof observation.state !== 'string' || observation.state.length === 0) {
    throw new TypeError('native game bridge observation must expose state');
  }
  return structuredClone(observation);
}

function actionRequest(action) {
  if (!action || typeof action !== 'object' || !Number.isInteger(action.id) || action.id < 1 || action.id > 7) {
    throw new TypeError('native action must contain integer id 1..7');
  }
  if (action.id === 6) {
    const x = action.x;
    const y = action.y;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > 63 || y < 0 || y > 63) {
      throw new RangeError('ACTION6 requires integer x/y coordinates in [0, 63]');
    }
    return { type: 'action', actionId: 6, data: { x, y } };
  }
  return { type: 'action', actionId: action.id };
}

/**
 * Bind the reconstructed benchmark session contract to the durable browser
 * game_bridge request boundary.
 *
 * The caller supplies the transport (normally the native browser worker).
 * This adapter never substitutes another backend, engine, or fallback path.
 */
export async function createGameBridgeNativeSession({
  dispatch,
  game,
  seed,
  startLevel,
}) {
  const send = requireDispatch(dispatch);
  const contract = GAME_BRIDGE_CONTRACTS[game];
  if (!contract) throw new RangeError(`unsupported native benchmark game ${String(game)}`);
  if (seed !== 0) {
    throw new Error('durable game_bridge evidence supports benchmark seed 0 only');
  }
  if (startLevel !== 1) {
    throw new Error('native benchmark sessions must start at level 1');
  }

  let current = validatePublicObservation(
    await send({ type: 'load', code: contract.code, level: 1 }),
    contract,
  );

  return {
    initialObservation() {
      return structuredClone(current);
    },
    async action(action) {
      current = validatePublicObservation(await send(actionRequest(action)), contract);
      return structuredClone(current);
    },
  };
}

export const NATIVE_GAME_BRIDGE_SESSION_CONTRACT = Object.freeze({
  games: GAME_BRIDGE_CONTRACTS,
  seed: 0,
  startLevel: 1,
  transportOwnedByCaller: true,
  fallbackAllowed: false,
});
