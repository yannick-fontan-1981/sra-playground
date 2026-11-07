import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { digest } from '../src/logos-engine/canonical.ts';
import { V7Runtime } from '../src/logos-engine/v7-runtime.ts';
import type { ActivationReceipt, CycleReceipt } from '../src/logos-engine/v7-runtime.ts';

const root = new URL('../reference/v7/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/', import.meta.url);
const bundle = JSON.parse(await readFile(new URL('bundle.json', root), 'utf8'));
const fixture = JSON.parse(await readFile(new URL('./fixtures/v7-reference.json', import.meta.url), 'utf8'));

// Only implementation-specific provenance hashes are excluded. Identities,
// order, revisions, evidence, decisions and real SRC causes remain untouched.
function normalizedMemory(value: any): any {
  const memory = structuredClone(value);
  delete memory.chain;
  for (const node of Object.values(memory.nodes) as any[]) delete node.origin.source_digest;
  for (const delta of memory.deltas) {
    delete delta.previous;
    delete delta.digest;
    delete delta.source_digest;
    delete delta.node.origin.source_digest;
  }
  return memory;
}

function normalizedAvailability(value: any): any {
  const availability = structuredClone(value);
  delete availability.graph_chain;
  delete availability.source_digest;
  return availability;
}

function normalizedPythonReceipt(value: any): any {
  const receipt = structuredClone(value);
  for (const field of ['source_digest', 'graph_chain', 'before_chain', 'configured_chain', 'compute_ms', 'timing_ms', 'total_ms']) delete receipt[field];
  if (receipt.reconsideration) receipt.reconsideration = normalizedPythonReceipt(receipt.reconsideration);
  return receipt;
}

function cycleReceipt(receipt: CycleReceipt): any {
  return {
    sequence: receipt.sequence, src_status: receipt.srcStatus,
    workflow_hash: receipt.workflowHash, input_digest: receipt.inputDigest,
    new_deltas: receipt.deltaCount, src_statements: receipt.instructions,
  };
}

function activationReceipt(receipt: ActivationReceipt): any {
  return {
    sequence: receipt.sequence, activation_ref: receipt.activationRef,
    revision: receipt.revision, workflow_hash: receipt.workflowHash,
    configuration: receipt.configuration, executed: receipt.executed,
    ...(receipt.reconsideration ? { reconsideration: cycleReceipt(receipt.reconsideration) } : {}),
  };
}

async function auditChain(memory: any): Promise<void> {
  let previous: string | null = null;
  for (const [index, delta] of memory.deltas.entries()) {
    assert.equal(delta.sequence, index + 1);
    assert.equal(delta.previous, previous);
    const { digest: recorded, ...payload } = delta;
    assert.equal(await digest(payload), recorded);
    previous = recorded;
  }
  assert.equal(memory.chain, previous);
}

test('reference fixtures pin the original Python implementation and compiler outputs', () => {
  assert.equal(bundle.provenance.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.provenance.commit, bundle.provenance.commit);
  assert.equal(bundle.programs.generators.source_hash, bundle.provenance.sourceFiles['generators.src']);
  assert.equal(bundle.programs.activation.source_hash, bundle.provenance.sourceFiles['activation.src']);
  assert.match(bundle.provenance.workflowHashes.generators, /^[a-f0-9]{64}$/);
  assert.match(bundle.provenance.workflowHashes.activation, /^[a-f0-9]{64}$/);
  assert.ok(fixture.scenarios.length >= 4, 'Expected discovery, renaming, scope isolation and activation histories');
});

for (const scenario of fixture.scenarios) {
  test(`Python ↔ TypeScript: every retained revision, delta and availability in ${scenario.id}`, async () => {
    const runtime = new V7Runtime({
      ...bundle.knowledge, ...bundle.programs,
      sourceDigest: 'test:typescript-v7-parity',
      workflowHashes: bundle.provenance.workflowHashes,
    });
    for (const step of scenario.steps) {
      const label = `${scenario.id} / ${step.label}`;
      let receipt: CycleReceipt | ActivationReceipt;
      if (step.operation.kind === 'advance') {
        receipt = await runtime.advance(step.operation.event);
        assert.deepEqual(cycleReceipt(receipt), normalizedPythonReceipt(step.python.receipt), `${label}: cycle receipt`);
      } else {
        assert.equal(step.operation.kind, 'set_activation', `${label}: unsupported fixture operation`);
        const { disabled_kinds, disabled_nodes, reason } = step.operation.configuration;
        receipt = await runtime.setActivation({ disabledKinds: disabled_kinds ?? [], disabledNodes: disabled_nodes ?? [], reason });
        assert.deepEqual(activationReceipt(receipt), normalizedPythonReceipt(step.python.receipt), `${label}: activation receipt`);
      }
      assert.deepEqual(normalizedMemory(runtime.memory), normalizedMemory(step.python.memory), `${label}: complete ordered graph history`);
      const availability = await runtime.availability();
      assert.deepEqual(normalizedAvailability(availability), normalizedAvailability(step.python.availability), `${label}: dependency mask`);
      assert.equal(receipt.graphChain, runtime.memory.chain, `${label}: committed receipt chain`);
      assert.equal(availability.graph_chain, runtime.memory.chain, `${label}: availability chain`);
      assert.equal(receipt.workflowHashKind, 'python-transitive-source');
      assert.ok(receipt.trace.every(entry => entry.status === 'completed'), `${label}: actual completed SRC statements`);
    }
    // Recompute both independent audit chains from their original payloads. The
    // Python source digest is never reused as the TypeScript engine provenance.
    await auditChain(runtime.memory);
    await auditChain(scenario.steps.at(-1).python.memory);
  });
}
