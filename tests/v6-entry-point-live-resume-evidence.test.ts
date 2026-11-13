import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const registryPath = new URL('../docs/migration/v6-entry-point-progress.json', import.meta.url);

async function loadRegistry() {
  return JSON.parse(await readFile(registryPath, 'utf8'));
}

test('real Chrome resume evidence preserves active checkpoint status and narrows the remaining gate', async () => {
  const registry = await loadRegistry();
  assert.equal(registry.summary.capabilitiesProductActive, 8);

  for (const id of [
    'campaign.common-owner',
    'runtime.campaign-checkpoint-core',
    'runtime.browser-campaign-host',
    'runtime.browser-agent-controller',
  ]) {
    const capability = registry.capabilities.find(candidate => candidate.id === id);
    assert.ok(capability, `missing capability ${id}`);
    assert.ok(capability.tests.includes('tests/browser/op01-op31-live-smlp-session-resume.ts'));
    assert.ok(capability.tests.includes('tests/op01-op31-live-smlp-session-resume-contract.test.mjs'));
    assert.ok(capability.proofs.includes('docs/recovery/op01-op31-live-smlp-session-resume-20261113.md'));
    assert.ok(capability.proofs.includes('docs/recovery/op01-op31-live-smlp-session-resume-qualified.json'));
  }

  const checkpoint = registry.capabilities.find(candidate => candidate.id === 'runtime.campaign-checkpoint-core');
  assert.equal(checkpoint.productStatus, 'active');
  assert.equal(checkpoint.performanceStatus, 'not-measured-separately');

  const gate = registry.openGates.find(candidate => candidate.id === 'browser-checkpoint-persistence');
  assert.equal(gate.status, 'open');
  assert.match(gate.reason, /réactivation en mémoire.*qualifiées dans Chrome.*vrai Worker\/Pyodide/u);
  assert.match(gate.reason, /stockage durable versionné.*rechargement de page.*nouveau processus/u);
  assert.equal(
    registry.openGates.some(candidate => candidate.id === 'browser-session-reactivation'),
    false,
  );
});
