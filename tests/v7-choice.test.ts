import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { emptyArgumentBindings, V7Runtime } from '../src/logos-engine/v7-runtime.ts';
import { createV7Runtime } from '../src/logos-engine/create-runtime.ts';
import type { ActivationReceipt, ChoiceReceipt, CycleReceipt, PublicObservation } from '../src/logos-engine/v7-runtime.ts';

const bundle = JSON.parse(await readFile(new URL('../reference/v7/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/bundle.json', import.meta.url), 'utf8'));
const fixture = JSON.parse(await readFile(new URL('./fixtures/v7-choice-reference.json', import.meta.url), 'utf8'));
const configuration = { ...bundle.knowledge, ...bundle.programs, sourceDigest: 'test:typescript-v7-choice', workflowHashes: bundle.provenance.workflowHashes };
const initialEvent = fixture.scenarios[0].steps[0].operation.event;

function cycle(receipt: CycleReceipt): unknown {
  return { sequence: receipt.sequence, src_status: receipt.srcStatus, source_digest: receipt.sourceDigest,
    workflow_hash: receipt.workflowHash, input_digest: receipt.inputDigest, new_deltas: receipt.deltaCount,
    graph_chain: receipt.graphChain, src_statements: receipt.instructions };
}

function activation(receipt: ActivationReceipt): unknown {
  return { sequence: receipt.sequence, activation_ref: receipt.activationRef, revision: receipt.revision,
    source_digest: receipt.sourceDigest, workflow_hash: receipt.workflowHash,
    before_chain: receipt.beforeChain, configured_chain: receipt.configuredChain,
    configuration: receipt.configuration, executed: receipt.executed, graph_chain: receipt.graphChain,
    ...(receipt.reconsideration ? { reconsideration: cycle(receipt.reconsideration) } : {}) };
}

function choice(receipt: ChoiceReceipt): unknown {
  return { sequence: receipt.sequence, src_status: receipt.srcStatus, observation_ref: receipt.observationRef,
    basis: receipt.basis, source_digest: receipt.sourceDigest, workflow_hash: receipt.workflowHash,
    decision: receipt.decision, options: receipt.options, new_deltas: receipt.deltaCount,
    graph_chain: receipt.graphChain, executed: receipt.executed };
}

test('experiment IR and choice goldens come from the pinned original Python implementation', () => {
  assert.equal(fixture.provenance.commit, bundle.provenance.commit);
  assert.equal(bundle.programs.experiment.source_hash, bundle.provenance.sourceFiles['experiment.src']);
  assert.equal(bundle.programs.experiment.workflows[0].id, 'prototype.v7_experiment.choose');
  assert.equal(bundle.provenance.workflowHashes.experiment, 'e3057f045e437373fc3bdb79ab1726162b4fa3bf617c30406d9df4bdfd8f9609');
  assert.ok(Object.values(fixture.assessments).every(value => value === true));
  assert.equal(fixture.scenarios.reduce((count: number, scenario: any) => count + scenario.steps.length, 0), 18);
});

for (const scenario of fixture.scenarios) {
  test(`Original Python choose parity, complete raw histories: ${scenario.id}`, async () => {
    // Controlled differential test only: basis-derived experiment IDs depend on
    // sourceDigest. Supplying the same input token permits exact byte/ID/chain
    // comparison; createV7Runtime below separately proves production provenance
    // is its own TS manifest and does not reuse this Python token.
    const runtime = new V7Runtime({ ...configuration, sourceDigest: fixture.referenceEngine.pathDependentSourceDigest });
    for (const step of scenario.steps) {
      const label = `${scenario.id}/${step.label}`;
      let comparable: unknown;
      if (step.operation.kind === 'advance') comparable = cycle(await runtime.advance(step.operation.event));
      else if (step.operation.kind === 'set_activation') {
        const request = step.operation.configuration;
        comparable = activation(await runtime.setActivation({ disabledKinds: request.disabled_kinds, disabledNodes: request.disabled_nodes, reason: request.reason }));
      } else {
        assert.equal(step.operation.kind, 'choose');
        const receipt = await runtime.choose(step.operation.observation, { policyRef: step.operation.policy_ref });
        comparable = choice(receipt);
        assert.equal(receipt.instructions, receipt.trace.length);
        assert.ok(receipt.instructions <= 4096);
        assert.equal(receipt.executed, false);
        assert.equal(receipt.currentObservation.id, receipt.observationRef);
        assert.equal(receipt.decision === null, receipt.proposal === null);
      }
      assert.deepEqual(comparable, step.python.receipt, `${label}: raw receipt`);
      assert.deepEqual(runtime.memory, step.python.memory, `${label}: all nodes/deltas/IDs/provenance/hash chains`);
      assert.deepEqual(await runtime.availability(), step.python.availability, `${label}: raw availability`);
    }
  });
}

test('production manifest stays distinct while native policy actions and groundings match Python', async () => {
  const runtime = await createV7Runtime(bundle);
  assert.notEqual(runtime.sourceDigest, fixture.referenceEngine.pathDependentSourceDigest);
  for (const step of fixture.scenarios[0].steps) {
    if (step.operation.kind === 'advance') await runtime.advance(step.operation.event);
    else {
      const receipt = await runtime.choose(step.operation.observation);
      assert.equal(receipt.policyRef, 'native_context_curiosity');
      assert.equal(receipt.policyId, 'curiosity.context_then_scope_trials.v1');
      assert.equal(receipt.decision?.action, step.python.receipt.decision?.action);
      assert.notEqual(receipt.decision?.id, step.python.receipt.decision?.id, 'basis-derived identity uses the actual TS provenance');
      const options = (nodes: any[]) => nodes.map(node => [node.action, node.status, node.trial_count, node.grounding]).sort(([a], [b]) => a.localeCompare(b));
      assert.deepEqual(options([...receipt.options]), options(step.python.receipt.options));
    }
  }
});

test('grounding uses only declared interface arguments and authority', () => {
  const interfaces = bundle.knowledge.drm.public_interface.actions;
  const bindings = emptyArgumentBindings(['ACTION0', 'ACTION1', 'ACTION5', 'ACTION6', 'ACTION7'], interfaces);
  assert.deepEqual(bindings, {
    ACTION0: { grounded: false, reason: 'interface_undeclared', command: null },
    ACTION1: { grounded: true, reason: 'arguments_complete', command: { action_ref: 'ACTION1', data: {} } },
    ACTION5: { grounded: true, reason: 'arguments_complete', command: { action_ref: 'ACTION5', data: {} } },
    ACTION6: { grounded: false, reason: 'missing_arguments:x,y', command: null },
    ACTION7: { grounded: false, reason: 'authority_missing:recovery', command: null },
  });
});

test('choose binds exactly the committed observation and is atomic on budget failure or cancellation', async () => {
  const runtime = new V7Runtime(configuration);
  await assert.rejects(runtime.choose(initialEvent.after), /current committed observation/);
  await runtime.advance(initialEvent);
  const memory = runtime.memory;
  await assert.rejects(runtime.choose({ ...initialEvent.after, id: 'uncommitted' }), /current committed observation/);
  await assert.rejects(runtime.choose(initialEvent.after, { maxInstructions: 45 }), /instruction limit/);
  assert.equal(runtime.memory, memory);
  assert.equal(runtime.choices.length, 0);
  const controller = new AbortController();
  const pending = runtime.choose(initialEvent.after, { signal: controller.signal, yieldEvery: 1 });
  controller.abort();
  await assert.rejects(pending, /cancel/i);
  assert.equal(runtime.memory, memory);
  assert.equal(runtime.choices.length, 0);
  const receipt = await runtime.choose(initialEvent.after);
  assert.ok(receipt.proposal);
  assert.equal(runtime.currentObservation?.id, initialEvent.after.id);
  assert.equal(runtime.sequence, 1, 'choice does not fabricate an observation cycle');
});

test('proposal ticket binds source, current graph, decision and observation and is consumed once', async () => {
  const runtime = new V7Runtime(configuration);
  await runtime.advance(initialEvent);
  const receipt = await runtime.choose(initialEvent.after);
  const ticket = receipt.proposal!;
  await assert.rejects(runtime.validateProposal({ ...ticket, sourceDigest: 'forged' }), /does not match/);
  await assert.rejects(runtime.validateProposal({ ...ticket, observationRef: 'forged' }), /does not match/);
  await assert.rejects(runtime.validateProposal({ ...ticket, decisionRevision: ticket.decisionRevision + 1 }), /does not match/);
  const validated = await runtime.validateProposal(structuredClone(ticket));
  assert.equal(validated.actionRef, 'ACTION1');
  assert.deepEqual(validated.data, {});
  assert.equal(validated.executed, false);
  const memory = runtime.memory;
  assert.deepEqual(await runtime.consumeProposal(ticket), validated);
  assert.equal(runtime.memory, memory, 'host handoff does not invent evidence or mark an action as executed');
  assert.equal(runtime.memory.nodes[ticket.decisionId].executed, false);
  await assert.rejects(runtime.consumeProposal(ticket), /already consumed/);
  await assert.rejects(runtime.validateProposal(ticket), /already consumed/);
});

test('new graph, new choice, and dependency masks invalidate old proposal tickets', async () => {
  const runtime = new V7Runtime(configuration);
  await runtime.advance(initialEvent);
  const first = await runtime.choose(initialEvent.after);
  const second = await runtime.choose(initialEvent.after);
  await assert.rejects(runtime.consumeProposal(first.proposal!), /does not match/);
  await runtime.setActivation({ disabledKinds: ['question'], reason: 'Suspend public question use' });
  await assert.rejects(runtime.consumeProposal(second.proposal!), /stale/);
  const unavailable = await runtime.choose(initialEvent.after);
  assert.equal(unavailable.proposal, null);
  assert.equal(unavailable.decision, null);
  assert.deepEqual(unavailable.options, []);
  await assert.rejects(runtime.consumeProposal(second.proposal!), /no current SRC proposal/);
});

test('declared choice budget remains bounded independently of observation count', async () => {
  const runtime = new V7Runtime(configuration);
  const observation: PublicObservation = { id: 'empty:0', scope: 'empty', values: { measured: 0 }, actions: [] };
  await runtime.advance({ before: null, after: observation, action: null });
  for (let index = 0; index < bundle.knowledge.drm.limits.events; index++) {
    const receipt = await runtime.choose(observation);
    assert.equal(receipt.decision, null);
  }
  const memory = runtime.memory;
  await assert.rejects(runtime.choose(observation), /choice budget/);
  assert.equal(runtime.memory, memory);
  assert.equal(runtime.sequence, 1);
});
