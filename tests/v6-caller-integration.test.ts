import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';

const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const oracle = JSON.parse(await readFile(new URL('./fixtures/v6-native-caller/hano-first-prefix.json', import.meta.url), 'utf8'));
const fromOracle = (reference: { $object: string }) => oracle.objects[reference.$object];

test('the live common caller acquires a real released prefix once and matches every original retained component', async context => {
  // The native agent receives only the original public observations. None of
  // the captured original programs, plans, working state or outcomes is loaded
  // into its memory. The fixed clock is for this deterministic frame replay;
  // live game campaigns retain the production time budget.
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const service = new V6AgentService(() => runtime);
  const sourceObservation = fromOracle(oracle.snapshots[0].observation);
  const sessionId = sourceObservation.observation_ref.split(':epoch:')[0];
  let result = await service.handle({ type: 'init', sessionId, sequence: 0,
    observation: oracle.publicProtocol.events[0].observation, budgets: oracle.budgets });
  assert.equal(result.kind, 'action');
  assert.equal((result.snapshot.caller as any).enabled, true);
  const originalProposal = fromOracle(oracle.snapshots.find((row: any) => row.stage === 'released').proposal);
  assert.deepEqual((result.snapshot.proposal as any).actions, originalProposal.actions);
  assert.equal((result.snapshot.proposal as any).strategy_receipt.selected, originalProposal.strategy_receipt.selected);
  assert.deepEqual((result.snapshot.proposal as any).strategy_receipt.visited, originalProposal.strategy_receipt.visited);
  const releasedGraph = runtime.inspectKnowledge();
  const read = (id: string) => {
    const graph = runtime.inspectKnowledge();
    return hydrateNativeState(graph.nodes[id]!.value!, key => graph.nodes[key]!.value) as Record<string, any>;
  };
  assert.equal(read('caller:goal').episode.length, 0);
  for (const [index, row] of oracle.publicProtocol.events.slice(1).entries()) {
    assert.deepEqual(result.command, row.command);
    result = await service.handle({ type: 'advance', sessionId, sequence: index + 1,
      ticketId: result.ticket!.id, observation: row.observation, executionMs: 0 });
    if (index === 0) {
      assert.equal(result.kind, 'action');
      assert.equal((result.snapshot.caller as any).acquiredTransitions, 0);
      assert.equal(result.snapshot.cycles, 0);
      assert.equal(runtime.inspectKnowledge().chain, releasedGraph.chain,
        'A guarded intermediate primitive does not reconcile or revise learned memory');
      assert.equal(read('caller:goal').episode.length, 0);
      assert.equal(runtime.inspectKnowledge().nodes['reasoning:transition:1'], undefined);
    }
  }
  assert.equal(result.kind, 'boundary');
  assert.equal(result.snapshot.cycles, 1);
  assert.equal((result.snapshot.caller as any).acquiredTransitions, 2);
  assert.equal((result.snapshot.caller as any).boundaryReplays, 0);
  assert.equal(result.snapshot.acquiredRecords, 2);
  assert.equal(read('family_state:ordered_support_transfer').events.length, 2);
  assert.deepEqual((result.snapshot.whyAct as any).analysis.map((row: any) => row.operation), ['OP29', 'OP30', 'OP31']);
  const originalState = fromOracle(oracle.snapshots.find((row: any) => row.stage === 'prefix_analyzed').state);
  for (const component of ['goal', 'frontier', 'view', 'attention', 'points', 'displays', 'controls', 'counters']) {
    await context.test(`real ${component} node matches the unchanged common caller`, () => assert.deepEqual(read(`caller:${component}`), originalState[component]));
  }
  for (let revision = 1; revision <= 2; revision += 1) {
    const transition = read(`reasoning:transition:${revision}`);
    assert.ok(transition.caller_acquisition);
    assert.equal(transition.caller_acquisition.selected_result.events.length, 1);
    assert.ok(transition.frontier_acquisition);
    assert.ok(transition.assessment);
    assert.equal(transition.before, `run:epoch:1:revision:${revision}:frame:${fromOracle(oracle.snapshots.find((row: any) => row.stage === 'before_assessment' && row.revision === revision).observation).frame_hash}`);
  }
  assert.deepEqual(read('caller:lifecycle'), { acquiredTransitions: 2, boundaryReplays: 0 });
  assert.equal(result.snapshot.familyStates, undefined, 'Per-action snapshots do not retransmit every family state');
  assert.ok((result.snapshot.familyStateRefs as any).ordered_support_transfer.id);
  assert.equal((result.snapshot.coverage as any).fullV6Parity, false);
});
