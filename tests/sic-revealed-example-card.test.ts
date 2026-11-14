import assert from 'node:assert/strict';
import test from 'node:test';
import { executeWorkflow } from '../src/logos-engine/interpreter.ts';
import {
  checkRevealedExample, chooseRevealedExample, revealedExampleModule, revealedExampleOperations,
} from '../src/sic/revealed-example-card.ts';

test('a supported unique example takes priority over a new view', async () => {
  const module = await revealedExampleModule();
  const choose = async (unique: boolean, next: boolean, views: boolean) =>
    (await executeWorkflow(module, chooseRevealedExample, { situation: { unique, next, views } }, revealedExampleOperations)).value;
  assert.equal(await choose(true, false, true), 'test_unique_catalogue_match');
  assert.equal(await choose(false, true, true), 'change_catalogue_subject');
  assert.equal(await choose(false, false, true), 'seek_distinguishing_view');
  assert.equal(await choose(false, false, false), null);
});

test('only a comparable view retaining fewer possible examples confirms the prediction', async () => {
  const module = await revealedExampleModule();
  const verify = async (comparable: boolean, afterCount: number) =>
    (await executeWorkflow(module, checkRevealedExample, {
      outcome: { comparable, beforeCount: 3, afterCount },
    }, revealedExampleOperations)).value;
  assert.equal(await verify(true, 1), true);
  assert.equal(await verify(true, 3), false);
  assert.equal(await verify(true, 0), false);
  assert.equal(await verify(false, 1), null);
});
