import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { NativeDrmRegistry, projectDeclaredAlternatives } from '../src/logos-engine/v6-drm-projector.ts';
import { NativeMorphologyPolicy } from '../src/logos-engine/v6-morphology-policy.ts';

const reference = JSON.parse(await readFile(new URL('./fixtures/v6-drm-reference.json', import.meta.url), 'utf8'));
const registry = new NativeDrmRegistry();
await registry.registerSource(reference.document.text, reference.document.sha256);
registry.seal();

for (const scenario of reference.projections) {
  test(`original DRM projection parity: ${scenario.id}`, () => {
    const execute = () => projectDeclaredAlternatives({ drm: registry, selection_policy_ref: scenario.policy,
      alternative_refs: scenario.alternatives, descriptive_facts: scenario.facts });
    if (scenario.error) assert.throws(execute, (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, scenario.error);
      return true;
    });
    else {
      assert.deepEqual(execute(), scenario.expected);
      assert.deepEqual(execute(), scenario.expected); // Projection does not acquire/modify measured facts.
    }
  });
}

const morphology = await NativeMorphologyPolicy.create();
function originalFields(result: Record<string, unknown>): Record<string, unknown> {
  // Additional native audit fields are deliberately distinct from the original
  // receipt. No original policy field or execution statement is normalized.
  const { trace: _trace, instructions: _instructions, execution_engine: _engine,
    reference_commit: _commit, reference_semantic_hash: _semantic,
    all_executed_statements: _all, instruction_quantum: _quantum, ...original } = result;
  return original;
}
for (const scenario of reference.morphology) {
  test(`original MorphologyPolicy + real SRC parity: ${scenario.id}`, async () => {
    if (scenario.error) await assert.rejects(morphology.evaluate(scenario.facts), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, scenario.error);
      return true;
    });
    else {
      const result = await morphology.evaluate(scenario.facts);
      assert.deepEqual(originalFields(result), scenario.expected);
      assert.equal(result.execution_engine, 'logos-engine.typescript');
      assert.equal(result.reference_commit, reference.commit);
      assert.equal(result.release_authority, false);
    }
  });
}

test('source-hashed registry rejects altered bytes and its sealed domain remains fixed', async () => {
  await assert.rejects(new NativeDrmRegistry().registerSource(reference.document.text + ' ', reference.document.sha256), /source hash differs/);
  assert.equal((await registry.registerSource(reference.document.text, reference.document.sha256)).source_hash, reference.document.sha256);
  assert.throws(() => registry.resolve('undeclared.policy'), /unregistered DRM/);
  assert.deepEqual(registry.declarationIds, ['policy.test.conditions', 'policy.test.empty', 'policy.test.sequence']);
});
