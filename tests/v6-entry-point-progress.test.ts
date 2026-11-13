import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveSummary,
  loadRegistry,
  validateRegistry,
} from '../scripts/check-v6-entry-point-progress.mjs';

const registryPath = 'docs/migration/v6-entry-point-progress.json';

test('V6 reconstructed registry is internally consistent and every evidence path exists', async () => {
  const registry = await loadRegistry(registryPath);
  const result = await validateRegistry(registry, { root: process.cwd() });
  assert.equal(result.valid, true);
  assert.ok(result.referencedPaths.length >= 100);
  assert.deepEqual(result.summary, registry.summary);
});

test('historical 76-slot count remains explicitly unresolved', async () => {
  const registry = await loadRegistry(registryPath);
  assert.equal(registry.historical76.targetSlots, 76);
  assert.deepEqual(registry.historical76.historicalClaimsObserved, [70, 71]);
  assert.equal(registry.historical76.slotSchemaRecovered, false);
  assert.equal(registry.historical76.mappedSlots, 0);
  assert.equal(registry.historical76.currentCount, null);
  assert.equal(registry.historical76.parityClaimed, false);
  assert.equal(registry.historical76.site109ParityClaimed, false);
  assert.equal(registry.summary.historicalCount, null);
  assert.equal(registry.summary.historicalMappedSlots, 0);
});

test('only OP18 and OP28 are promoted to current product-active operations', async () => {
  const registry = await loadRegistry(registryPath);
  const active = registry.operations
    .filter((operation: { productActive: boolean }) => operation.productActive)
    .map((operation: { id: string }) => operation.id)
    .sort();
  assert.deepEqual(active, ['OP18', 'OP28']);
  assert.equal(registry.operations.length, 31);
  assert.equal(registry.operations.find((operation: { id: string }) => operation.id === 'OP31').runtimeUse, 'generic-call-no-objective-owner');
});

test('official performance status is limited to the two qualified reconstructed scopes', async () => {
  const registry = await loadRegistry(registryPath);
  const qualified = registry.capabilities
    .filter((capability: { performanceStatus: string }) => capability.performanceStatus === 'official-qualified')
    .map((capability: { id: string }) => capability.id)
    .sort();
  assert.deepEqual(qualified, [
    'campaign.joint-channels-op28',
    'learning.region-intervention',
  ]);
});

test('qualified checkpoint core is recorded without claiming browser reactivation', async () => {
  const registry = await loadRegistry(registryPath);
  const checkpoint = registry.capabilities.find(
    (capability: { id: string }) => capability.id === 'runtime.campaign-checkpoint-core',
  );
  assert.equal(checkpoint.functionalStatus, 'qualified-bounded');
  assert.equal(checkpoint.productStatus, 'available-not-main');
  assert.equal(checkpoint.performanceStatus, 'not-measured-separately');
  assert.equal(
    registry.openGates.find((gate: { id: string }) => gate.id === 'browser-session-reactivation').status,
    'open',
  );
  assert.equal(
    registry.openGates.some((gate: { id: string }) => gate.id === 'campaign-snapshot-restoration'),
    false,
  );
});

test('derived summary cannot be replaced by an inflated declared count', async () => {
  const registry = await loadRegistry(registryPath);
  const mutated = structuredClone(registry);
  mutated.summary.inventoryRecords += 1;
  mutated.historical76.currentCount = 71;
  await assert.rejects(
    validateRegistry(mutated, { root: process.cwd(), checkPaths: false }),
    /historical current count must remain null|summary must exactly match/u,
  );
  assert.notDeepEqual(deriveSummary(mutated), mutated.summary);
});

test('duplicate operation identities are rejected', async () => {
  const registry = await loadRegistry(registryPath);
  const mutated = structuredClone(registry);
  mutated.operations[1].id = mutated.operations[0].id;
  await assert.rejects(
    validateRegistry(mutated, { root: process.cwd(), checkPaths: false }),
    /duplicate ids|OP01 through OP31/u,
  );
});
