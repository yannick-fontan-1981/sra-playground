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

test('qualified checkpoint core persists and replays one bounded browser session without a performance claim', async () => {
  const registry = await loadRegistry(registryPath);
  const checkpoint = registry.capabilities.find(
    (capability: { id: string }) => capability.id === 'runtime.campaign-checkpoint-core',
  );
  assert.equal(checkpoint.functionalStatus, 'qualified-bounded');
  assert.equal(checkpoint.productStatus, 'active');
  assert.equal(checkpoint.performanceStatus, 'not-measured-separately');
  assert.ok(checkpoint.implementation.includes('src/runtime/v6-browser-campaign-checkpoint.ts'));
  assert.ok(checkpoint.implementation.includes('src/runtime/v6-browser-common-campaign-host.ts'));
  assert.ok(checkpoint.implementation.includes('src/runtime/v6-browser-agent-controller.ts'));
  assert.ok(checkpoint.implementation.includes('src/runtime/browser-games.ts'));
  assert.ok(checkpoint.implementation.includes('src/runtime/v6-browser-durable-session.ts'));
  assert.ok(checkpoint.tests.includes('tests/browser-game-runtime-checkpoint.test.ts'));
  assert.ok(checkpoint.tests.includes('tests/v6-browser-durable-session.test.ts'));
  assert.ok(checkpoint.tests.includes('tests/v6-browser-agent-live-capture.test.ts'));
  assert.ok(checkpoint.proofs.includes('docs/recovery/op01-op31-browser-durable-resume-20261113.md'));
  assert.ok(checkpoint.proofs.includes('docs/recovery/op01-op31-browser-durable-resume-qualified.json'));
  assert.equal(
    registry.openGates.some((gate: { id: string }) => gate.id === 'browser-checkpoint-persistence'),
    false,
  );
  assert.equal(
    registry.openGates.find((gate: { id: string }) => gate.id === 'browser-checkpoint-crash-recovery').status,
    'open',
  );
  assert.equal(registry.summary.capabilitiesProductActive, 8);
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
