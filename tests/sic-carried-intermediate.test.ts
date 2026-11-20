import assert from 'node:assert/strict';
import test from 'node:test';
import { boundedReductionRoute, mergeReductionScene, packReductionState, reductionMoved, reductionState, reductionSuccessors,
  type ReductionModel, type ReductionScene } from '../src/logos-engine/v6-reduction-transport.ts';

const scene: ReductionScene = {
  floor: new Set(['0,0', '2,0', '3,0', '4,0']), pegs: new Set(['0,0', '3,0']),
  carriers: [[1, 1]], rails: new Set(['1,1', '1,0']), edges: new Set(['1,1>1,0']), carriedPlots: new Set(['1,1']),
};

test('position a carried plot as the intermediate, preserve it, then remove a peg', () => {
  const initial = reductionState(scene);
  const route = boundedReductionRoute(initial, scene, 5, { maximumStates: 128, maximumFrontier: 256 });
  assert.equal(route.status, 'found');
  assert.deepEqual(route.path, [['move', [0, -1]], ['jump', [0, 0], [2, 0]], ['jump', [2, 0], [4, 0]]]);
  const placed = reductionMoved(initial, [0, -1], scene.edges);
  const first = [...reductionSuccessors(placed, scene)].find(([, action]) => action[0] === 'jump');
  assert.deepEqual(packReductionState(first![0]), [[[2, 0], [3, 0]], [[1, 0]], [[1, 0]]]);
  assert.ok(initial[2]?.has('1,1'));
});

test('a loaded carrier is not a landing and a known fixed plot blocks its translation', () => {
  const atLanding: ReductionScene = { ...scene, carriers: [[2, 0]], carriedPlots: new Set(['2,0']),
    plots: new Set(['1,0']), pegs: new Set(['0,0']) };
  assert.equal([...reductionSuccessors(reductionState(atLanding), atLanding)].some(([, action]) => action[0] === 'jump'), false);
  assert.deepEqual(packReductionState(reductionMoved(reductionState(scene), [0, -1], scene.edges, new Set(['1,0']))),
    packReductionState(reductionState(scene)));
});

test('filling vacated places is a separate movement law and respects the leading end in both directions', () => {
  const queued: ReductionScene = { ...scene, carriers: [[1, 1], [2, 1]], carriedPlots: new Set(['2,1']),
    edges: new Set(['1,1>2,1', '2,1>3,1', '3,1>2,1', '2,1>1,1']) };
  const initial = reductionState(queued);
  assert.deepEqual(reductionMoved(initial, [1, 0], queued.edges)[1], [[1, 1], [3, 1]]);
  const forward = reductionMoved(initial, [1, 0], queued.edges, undefined, true);
  assert.deepEqual(forward[1], [[2, 1], [3, 1]]);
  assert.deepEqual([...forward[2]!], ['3,1']);
  assert.deepEqual(packReductionState(reductionMoved(forward, [-1, 0], queued.edges, undefined, true)), packReductionState(initial));
});

test('update carried plots in the observed part of the map and preserve off-screen attachments', () => {
  const model: ReductionModel = { unit: 2, pitch: 3, phase: [0, 0], floor: 1, token: 2, ring: 3, rail: 4, width: 8, height: 6 };
  const previous: ReductionScene = { ...scene, carriers: [[3, 1], [10, 1]], carriedPlots: new Set(['3,1', '10,1']), plots: new Set(['3,2']) };
  const visible: ReductionScene = { ...scene, carriers: [[1, 1]], carriedPlots: new Set(['1,1']) };
  const merged = mergeReductionScene(previous, visible, model, [3, 0]);
  assert.deepEqual([...merged.carriedPlots!].sort(), ['10,1', '4,1']);
  assert.deepEqual([...merged.plots!], ['3,2']);
  assert.deepEqual(merged.carriers, [[4, 1], [10, 1]]);
});
