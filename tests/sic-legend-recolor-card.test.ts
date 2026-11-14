import assert from 'node:assert/strict';
import test from 'node:test';
import { executeWorkflow } from '../src/logos-engine/interpreter.ts';
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
