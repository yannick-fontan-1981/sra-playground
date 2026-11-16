import assert from 'node:assert/strict';
import test from 'node:test';
import { boundedReductionRoute, reductionState, reductionSuccessors, type ReductionScene } from '../src/logos-engine/v6-reduction-transport.ts';

test('two jumps can preserve a fixed intermediate and then remove a movable token', () => {
  const scene: ReductionScene = { floor: new Set(['0,0', '1,0', '2,0', '3,0', '4,0']), pegs: new Set(['0,0', '3,0']),
    carriers: [], rails: new Set(), edges: new Set(), plots: new Set(['1,0']) };
  const state = reductionState(scene);
  const first = [...reductionSuccessors(state, scene)].find(([, action]) =>
    action[0] === 'jump' && action[1][0] === 0 && action[2][0] === 2);
  assert.deepEqual(first?.[0][0], new Set(['2,0', '3,0']));
  const plan = boundedReductionRoute(state, scene, 4, { maximumStates: 32, maximumFrontier: 32 });
  assert.deepEqual(plan.path, [['jump', [0, 0], [2, 0]], ['jump', [2, 0], [4, 0]]]);
  assert.deepEqual(scene.plots, new Set(['1,0']));
});
