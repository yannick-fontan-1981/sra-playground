import assert from 'node:assert/strict';
import test from 'node:test';
import { executeWorkflow } from '../src/logos-engine/interpreter.ts';
import { checkObservedMotion, chooseObservedMotion, observedMotionModule } from '../src/sic/reflected-motion-card.ts';

test('the motion card chooses one admissible step and preserves uncertain returns', async () => {
  const module = await observedMotionModule();
  const choose = async (move: boolean, select: boolean, test: boolean) =>
    (await executeWorkflow(module, chooseObservedMotion, { situation: { move, select, test } }, {})).value;
  assert.equal(await choose(true, true, true), 'place_reflected_contributor');
  assert.equal(await choose(false, true, true), 'select_reflected_contributor');
  assert.equal(await choose(false, false, true), 'test_reflected_displacement');
  assert.equal(await choose(false, false, false), null);
  for (const matched of [true, false, null]) {
    const result = await executeWorkflow(module, checkObservedMotion, { outcome: { matched } }, {});
    assert.equal(result.value, matched);
  }
});
