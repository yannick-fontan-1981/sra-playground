import assert from 'node:assert/strict';
import test from 'node:test';
import { executeWorkflow } from '../src/logos-engine/interpreter.ts';
import { measure } from '../src/logos-engine/v6-topological-recolor-geometry.ts';
import { checkExampleWorkflow, matchExampleModule, matchExampleOperations, matchExampleWorkflow } from '../src/sic/legend-recolor-card.ts';

test('the SRC example card selects or reuses a value and checks outside preservation', async () => {
  const module = await matchExampleModule();
  const pending = [{ index: 0, color: 4 }, { index: 1, color: 7 }];
  const run = (hasReadyRegion: boolean) => executeWorkflow(module, matchExampleWorkflow, {
    situation: { hasReadyRegion, pending, ready: [pending[1]!] },
  }, matchExampleOperations);
  assert.deepEqual((await run(true)).value, { candidate: pending[1], strategy: 'apply_legend_pigment' });
  assert.deepEqual((await run(false)).value, { candidate: pending[0], strategy: 'acquire_legend_pigment' });
  for (const preserved of [true, false]) for (const expectedValueObserved of [true, false]) {
    const result = await executeWorkflow(module, checkExampleWorkflow, {
      outcome: { preserved, expectedValueObserved },
    }, matchExampleOperations);
    assert.equal(result.value, preserved && expectedValueObserved);
  }
});

function twoSidedLegend(fieldSize: number) {
  const rows = Array.from({ length: 32 }, () => Array<number>(32).fill(0));
  function square(left: number, top: number, size: number, color: number, outline = false) {
    for (let y = top; y < top + size; y++) for (let x = left; x < left + size; x++) {
      if (!outline || y === top || x === left || y === top + size - 1 || x === left + size - 1) rows[y]![x] = color;
    }
  }
  for (let y = 0; y < 23; y++) {
    rows[y]!.fill(1, 0, 7);
    rows[y]![7] = 4;
  }
  rows[23]!.fill(4);
  square(2, 2, 3, 2);
  square(2, 9, 3, 3, true);
  square(10, 2, fieldSize, 3);
  square(10, 10, fieldSize, 2, true);
  square(1, 25, 4, 7);
  square(2, 26, 2, 2);
  square(9, 26, 2, 3);
  square(16, 26, 2, 5);
  return rows;
}

test('recolor orients a reversible divider using consistently smaller legend examples', () => {
  const rows = twoSidedLegend(6);
  const observation = { observation_ref: 'observed-layout' };
  for (const flip of [false, true]) {
    const scene = measure(flip ? rows.map(row => [...row].reverse()) : rows, observation, [], { examples: true });
    assert.ok(scene?.reduced_examples);
    assert.deepEqual(scene.legend, flip ? [25, 0, 31, 22] : [0, 0, 6, 22]);
    assert.deepEqual(scene.mapping, { 0: 2, 1: 3 });
    assert.equal(scene.active, 2);
  }
  assert.equal(measure(twoSidedLegend(3), observation, [], { examples: true }), null);
  assert.equal(measure(rows, observation), null);
});

test('palette ink inside a legend symbol describes the matching pocket', () => {
  const rows = twoSidedLegend(6);
  for (let y = 0; y < 23; y++) for (let x = 0; x < 7; x++) {
    if (rows[y]![x] === 1) rows[y]![x] = 5;
  }
  const scene = measure(rows, { observation_ref: 'painted-example' }, [], { examples: true });
  assert.deepEqual(scene?.legend, [0, 0, 6, 22]);
  assert.deepEqual(scene?.mapping, { 0: 2, 1: 3 });
  const pockets = scene?.bodies.filter((body: { relation_kind: string }) => body.relation_kind === 'pocket');
  assert.equal(pockets.length, 1);
  assert.deepEqual({ region: pockets[0].bbox, example: pockets[0].example, target: pockets[0].target },
    { region: [11, 11, 14, 14], example: [2, 9, 4, 11], target: 5 });
});
