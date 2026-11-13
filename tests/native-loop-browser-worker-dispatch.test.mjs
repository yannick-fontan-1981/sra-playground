import assert from 'node:assert/strict';
import test from 'node:test';

import { createBrowserWorkerGameBridgeDispatch } from '../scripts/native-loop-browser-worker-dispatch.mjs';

function observation(game, overrides = {}) {
  return {
    gameCode: game,
    gameId: game === 'STCK' ? 'stck-c0000001' : 'smlp-c3000001',
    backend: 'python-wasm',
    frame: Array.from({ length: 64 }, () => Array(64).fill(0)),
    state: 'NOT_FINISHED',
    level: 1,
    levelCount: 6,
    levelsCompleted: 0,
    availableActionIds: [5, 6, 7],
    ...overrides,
  };
}

test('browser dispatch binds explicit level-1 load and forwards ACTION6 coordinates', async () => {
  const calls = [];
  const runtime = {
    async load(game, level) {
      calls.push(['load', game, level]);
      return observation(game);
    },
    async action(actionId, data) {
      calls.push(['action', actionId, data]);
      return observation('STCK');
    },
  };
  const dispatch = createBrowserWorkerGameBridgeDispatch({ runtime, game: 'STCK' });
  const initial = await dispatch({ type: 'load', code: 'STCK', level: 1 });
  const after = await dispatch({ type: 'action', actionId: 6, data: { x: 4, y: 52 } });
  assert.equal(initial.code, 'STCK');
  assert.equal(after.code, 'STCK');
  assert.deepEqual(calls, [
    ['load', 'STCK', 1],
    ['action', 6, { x: 4, y: 52 }],
  ]);
});

test('browser dispatch rejects action before load and wrong game identity', async () => {
  const runtime = {
    async load() { return observation('SMLP'); },
    async action() { return observation('SMLP'); },
  };
  const dispatch = createBrowserWorkerGameBridgeDispatch({ runtime, game: 'STCK' });
  await assert.rejects(
    dispatch({ type: 'action', actionId: 6, data: { x: 1, y: 1 } }),
    /action before load/,
  );
  await assert.rejects(
    dispatch({ type: 'load', code: 'STCK', level: 1 }),
    /returned SMLP for STCK/,
  );
});

test('browser dispatch rejects implicit levels, alternate games and unsupported requests', async () => {
  const runtime = {
    async load(game) { return observation(game); },
    async action() { return observation('STCK'); },
  };
  const dispatch = createBrowserWorkerGameBridgeDispatch({ runtime, game: 'STCK' });
  await assert.rejects(dispatch({ type: 'load', code: 'STCK' }), /explicit STCK level 1/);
  await assert.rejects(dispatch({ type: 'load', code: 'SMLP', level: 1 }), /explicit STCK level 1/);
  await assert.rejects(dispatch({ type: 'observe' }), /unsupported browser worker benchmark request/);
});
