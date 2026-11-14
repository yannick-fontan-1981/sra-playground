import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { readNativeResolution } from '../src/sic/native-resolution.ts';

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
  assert.deepEqual(read('family_state:public_occurrence_recall').events, []);
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
      assert.deepEqual(read('family_state:public_occurrence_recall').events, [],
        'The epoch anchor is not acquired during an unfinished action prefix');
      assert.equal(runtime.inspectKnowledge().nodes['reasoning:transition:1'], undefined);
    }
  }
  assert.equal(result.kind, 'boundary');
  assert.equal(result.snapshot.cycles, 1);
  assert.equal((result.snapshot.caller as any).acquiredTransitions, 2);
  assert.equal((result.snapshot.caller as any).boundaryReplays, 0);
  assert.equal(result.snapshot.acquiredRecords, 2);
  assert.equal(read('family_state:ordered_support_transfer').events.length, 2);
  const sourceFacts = fromOracle(oracle.snapshots.find((row: any) => row.stage === 'prefix_analyzed').memory).facts;
  const nativeFacts = (read('reasoning:memory').facts as string[]).map(read), series = read('family_state:public_occurrence_recall');
  assert.deepEqual(series.events, sourceFacts.find((fact: any) => fact.key === 'repeated_series_state').value.events);
  assert.deepEqual(series.events.map((event: any) => event.kind), ['coupled_pair_epoch_anchor'],
    'The passive shared series journal acquires one anchor across both reconciled primitives');
  assert.deepEqual(nativeFacts.find(fact => fact.key === 'repeated_series_state')!.value, series);
  assert.deepEqual((result.snapshot.whyAct as any).analysis.map((row: any) => row.operation), ['OP29', 'OP30', 'OP31']);
  const originalState = fromOracle(oracle.snapshots.find((row: any) => row.stage === 'prefix_analyzed').state);
  for (const component of ['goal', 'frontier', 'view', 'attention', 'points', 'displays', 'controls', 'counters']) {
    await context.test(`real ${component} node matches the unchanged common caller`, () => assert.deepEqual(read(`caller:${component}`), originalState[component]));
  }
  for (let revision = 1; revision <= 2; revision += 1) {
    const transition = read(`reasoning:transition:${revision}`);
    assert.ok(transition.caller_acquisition);
    assert.equal(transition.caller_acquisition.selected_result.events.length, 1);
    const sourceTransition = oracle.snapshots.find((row: any) => row.stage === 'before_assessment' && row.revision === revision);
    assert.deepEqual(transition.caller_acquisition.selected_result, fromOracle(sourceTransition.result),
      'The original SupportNavigation wrapper and its ordered-support event are acquired exactly once');
    assert.ok(transition.frontier_acquisition);
    assert.ok(transition.assessment);
    assert.equal(transition.before, `run:epoch:1:revision:${revision}:frame:${fromOracle(oracle.snapshots.find((row: any) => row.stage === 'before_assessment' && row.revision === revision).observation).frame_hash}`);
  }
  assert.deepEqual(read('caller:lifecycle'), { acquiredTransitions: 2, boundaryReplays: 0 });
  assert.equal(result.snapshot.familyStates, undefined, 'Per-action snapshots do not retransmit every family state');
  assert.ok((result.snapshot.familyStateRefs as any).ordered_support_transfer.id);
  assert.equal((result.snapshot.coverage as any).fullV6Parity, false);
});

test('the live service releases a SIC view plan and binds its measured return to the published objective', async () => {
  const capture = JSON.parse(await readFile(new URL('./fixtures/v6-native-caller/viewport-three-prefixes.json', import.meta.url), 'utf8'));
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const service = new V6AgentService(() => runtime);
  const [start, ...returns] = capture.publicProtocol.events;
  const sessionId = 'view-sic-production';
  let result = await service.handle({ type: 'init', sessionId, sequence: 0, observation: start.observation, budgets: capture.budgets });
  let viewObjective: string | null = null;
  for (const [index, row] of returns.entries()) {
    if (result.kind === 'boundary') result = await service.handle({ type: 'resume', sessionId, sequence: index });
    assert.equal(result.kind, 'action');
    assert.deepEqual(result.command, row.command);
    if (index === 2) {
      const projected = readNativeResolution({ ...result.snapshot, sessionId, sequence: index, phase: result.phase });
      assert.equal(projected?.viewStrategy?.agenda.find(item => item.result === 'selected')?.id, 'approach_view_edge');
      assert.equal(projected?.operation, 'OP18');
      assert.ok(projected?.viewStrategy?.objective.id);
      viewObjective = projected.viewStrategy.objective.id;
    }
    result = await service.handle({ type: 'advance', sessionId, sequence: index + 1, ticketId: result.ticket!.id,
      observation: row.observation, executionMs: 0 });
  }
  assert.equal(result.snapshot.sicActionCoverage?.viewAccess, 1);
  const projected = readNativeResolution({ ...result.snapshot, sessionId, sequence: returns.length, phase: result.phase });
  assert.equal(projected?.outcome?.viewOutcome?.objective, viewObjective);
  assert.equal(projected?.outcome?.viewOutcome?.status, 'expanded');
  const graph = runtime.inspectKnowledge();
  const needs = Object.values(graph.nodes).filter(node => node.component === 'sic_need');
  const values = needs.map(node => hydrateNativeState(node.value!, id => graph.nodes[id]!.value) as Record<string, unknown>);
  const view = values.find(value => value.kind === 'observe_view_access');
  assert.equal(view?.status, 'observed');
  assert.ok(typeof view?.firstPlan === 'string' && view.firstPlan === view.latestPlan);
  assert.equal(values.filter(value => value.id === view?.id).length, 1);
});
