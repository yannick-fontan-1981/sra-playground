import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import type { CompiledModule, IrExpression } from '../src/logos-engine/ir.ts';
import { contrastControlOperations, contrastControlsModule, contrastControlsWorkflow } from '../src/sic/contrast-controls-card.ts';

test('an edited SIC workflow changes which observed candidate it selects', async () => {
  const store = new NativeKnowledgeStore('sic-test-source', 'sic-test-session');
  const original = await contrastControlsModule();
  const program = await store.registerProgram(contrastControlsWorkflow, contrastControlOperations, original);
  const options = [{ index: 1, separation: 20 }, { index: 2, separation: 40 }];
  const first = await program.run({ situation: { eligible: true, options } });
  assert.deepEqual(first.result, options[1]);
  assert.equal(first.receipt.edited, false);
  assert.equal((await program.run({ situation: { eligible: false, options } })).result, null);

  const edited: CompiledModule = structuredClone(original);
  const order = edited.workflows[0]!.steps[0]!.statements[0]!.body![0]!.expression!.arguments![2]!.value;
  (order as { value: IrExpression['value'] }).value = 'smallest';
  const write = await store.programReplacement(contrastControlsWorkflow, edited);
  await store.commit([write], { workflow: contrastControlsWorkflow, step: 'test', statement: 'replace' });
  const second = await program.run({ situation: { eligible: true, options } });
  assert.deepEqual(second.result, options[0]);
  assert.equal(second.receipt.edited, true);
  assert.notEqual(first.receipt.native_execution_hash, second.receipt.native_execution_hash);
});
