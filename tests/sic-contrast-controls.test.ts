import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import type { CompiledModule, IrExpression } from '../src/logos-engine/ir.ts';
import { contrastCheck, contrastControlOperations, contrastControlsModule, contrastControlsWorkflow,
  contrastNeed, contrastPrimitive, contrastReturnWorkflow, readContrastCardSettings } from '../src/sic/contrast-controls-card.ts';

test('an edited SIC workflow changes which observed candidate it selects', async () => {
  const store = new NativeKnowledgeStore('sic-test-source', 'sic-test-session');
  const original = await contrastControlsModule();
  const program = await store.registerProgram(contrastControlsWorkflow, contrastControlOperations, original);
  const verification = await store.registerProgram(contrastReturnWorkflow, contrastControlOperations, original);
  const options = [{ index: 1, separation: 20 }, { index: 2, separation: 40 }];
  const situation = { mode: 'exploration', need: contrastNeed, pointOnChangedControl: true,
    previousControlsUniform: true, changedControls: 1, changedIndicators: 2, initialProbe: false, options };
  const first = await program.run({ situation });
  const expected = { need: contrastNeed, primitive: contrastPrimitive, target: options[1], check: contrastCheck, minimumChanges: 1 };
  assert.deepEqual(first.result, expected);
  assert.equal(first.receipt.edited, false);
  assert.equal((await program.run({ situation: { ...situation, mode: 'unknown' } })).result, null);
  assert.equal((await program.run({ situation: { ...situation, changedIndicators: 0 } })).result, null);
  assert.deepEqual((await program.run({ situation: { ...situation, mode: 'solving', previousControlsUniform: false, continuing: true,
    changedIndicators: 1 } })).result, expected);
  const outcome = { check: contrastCheck, minimumChanges: expected.minimumChanges };
  for (const [changes, verdict] of [[0, false], [1, true], [null, null]] as const) {
    assert.equal((await verification.run({ outcome: { ...outcome, changes } })).result, verdict);
  }

  const edited: CompiledModule = structuredClone(original);
  const rank = edited.workflows[0]!.steps[0]!.statements[0]!.body![0]!.expression!.arguments!.find(arg => arg.name === 'target')!.value;
  const order = rank.arguments!.find(arg => arg.name === 'order')!.value;
  (order as { value: IrExpression['value'] }).value = 'smallest';
  const write = await store.programReplacement(contrastControlsWorkflow, edited);
  await store.commit([write], { workflow: contrastControlsWorkflow, step: 'test', statement: 'replace' });
  const second = await program.run({ situation });
  assert.deepEqual(second.result, { ...expected, target: options[0] });
  assert.equal(second.receipt.edited, true);
  assert.notEqual(first.receipt.native_execution_hash, second.receipt.native_execution_hash);
});

test('strategy editor settings compile to an executable trigger and return contract', async () => {
  const settings = { minimumRemoteChanges: 2, order: 'smallest', minimumChanges: 3 } as const;
  const module = await contrastControlsModule(settings);
  assert.deepEqual(readContrastCardSettings(module), settings);
  const store = new NativeKnowledgeStore('sic-card-source', 'sic-card-session');
  const program = await store.registerProgram(contrastControlsWorkflow, contrastControlOperations, module);
  const options = [{ index: 0, separation: 4, x: 15, y: 12 }, { index: 1, separation: 8, x: 31, y: 12 }];
  const situation = { mode: 'exploration', need: contrastNeed, pointOnChangedControl: true,
    previousControlsUniform: true, changedControls: 1, changedIndicators: 1, initialProbe: false, options };
  assert.equal((await program.run({ situation })).result, null);
  assert.deepEqual((await program.run({ situation: { ...situation, changedIndicators: 2 } })).result,
    { need: contrastNeed, primitive: contrastPrimitive, target: options[0], check: contrastCheck, minimumChanges: 3 });
});
