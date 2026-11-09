import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { SlotSubstitution } from '../src/logos-engine/v6-slot-substitution.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
type R = Record<string, any>;
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;

test('the real common caller retains the complete first recall envelope, epoch anchor and eight caller components; other series providers stay pending', async context => {
  const oracle = JSON.parse(await readFile(new URL('./fixtures/v6-native-caller/memo-first-prefix.json', import.meta.url), 'utf8'));
  const from = (reference: R): R => oracle.objects[reference.$object];
  assert.equal(oracle.method.sourceModified, false); assert.equal(oracle.sourceVerification.afterOriginalMain, true);
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 }), service = new V6AgentService(() => runtime);
  const sessionId = from(oracle.snapshots[0].observation).observation_ref.split(':epoch:')[0];
  let result = await service.handle({ type: 'init', sessionId, sequence: 0, observation: oracle.publicProtocol.events[0].observation, budgets: oracle.budgets });
  const original = from(oracle.snapshots.find((row: R) => row.stage === 'released').proposal), proposal = result.snapshot.proposal as R;
  assert.equal(result.kind, 'action'); assert.equal(result.snapshot.lastDecision, 'public_occurrence_recall');
  assert.equal(proposal.field_subquestion, 'observed_occurrence_recall');
  assert.deepEqual(proposal.actions, original.actions);
  assert.deepEqual(proposal.strategy_receipt.visited, original.strategy_receipt.visited);
  assert.equal(proposal.strategy_receipt.selected, original.strategy_receipt.selected);
  for (const [index, row] of oracle.publicProtocol.events.slice(1).entries()) {
    assert.deepEqual(result.command, row.command);
    result = await service.handle({ type: 'advance', sessionId, sequence: index + 1, ticketId: result.ticket!.id, observation: row.observation, executionMs: 0 });
  }
  assert.equal(result.kind, 'boundary'); assert.equal(result.snapshot.cycles, 1);
  assert.equal((result.snapshot.caller as R).acquiredTransitions, 1);
  const graph = runtime.inspectKnowledge();
  const read = (id: string): R => hydrateNativeState(graph.nodes[id]!.value, key => graph.nodes[key]!.value) as R;
  const final = oracle.snapshots.find((row: R) => row.stage === 'prefix_analyzed'), state = from(final.state);
  for (const component of ['goal', 'frontier', 'view', 'attention', 'points', 'displays', 'controls', 'counters']) {
    await context.test(component, () => assert.deepEqual(read(`caller:${component}`), state[component]));
  }
  const transition = read('reasoning:transition:1');
  const sourceResult = from(final.result), nativeResult = transition.caller_acquisition.selected_result;
  assert.deepEqual(nativeResult, sourceResult, 'The whole source result now includes recall followed by the epoch anchor');
  const sourceFacts = from(final.memory).facts as R[], nativeFacts = (read('reasoning:memory').facts as string[]).map(read);
  const sourceFact = sourceFacts.find(fact => fact.key === 'window_constraint:1')!, nativeFact = nativeFacts.find(fact => fact.key === 'window_constraint:1')!;
  assert.deepEqual(nativeFact, sourceFact);
  assert.deepEqual(nativeFacts.find(fact => fact.key === 'repeated_series_state')!.value, read('family_state:public_occurrence_recall'));
  const series = read('family_state:public_occurrence_recall');
  assert.deepEqual(series.events, sourceFacts.find(fact => fact.key === 'repeated_series_state')!.value.events);
  assert.deepEqual(series.events.map((event: R) => event.kind), ['occurrence_recall_transition', 'coupled_pair_epoch_anchor']);
  assert.notEqual(series.digest, sourceFacts.find(fact => fact.key === 'repeated_series_state')!.value.digest,
    'The native closure does not impersonate the digest of the unported inheritance chain');
  assert.match((result.snapshot.coverage as R).sharedSeriesMemory, /remaining ObservedCompositionConstraint providers pending/);
  assert.equal((result.snapshot.coverage as R).sharedSeriesDigestScope, 'native_program_relations_recall_typed_material_and_pose_radial_ports_field_service_rooted_quota_mark_support_occluded_catalogue_and_view_queued_field_product_panel_labeled_sequence_trace_field_linked_packet_cell_placement_alternating_graph_coupled_support_and_panel_service_one_of_six_observed_compositions_v6');
  assert.equal(read('family_state:public_occurrence_recall').events.filter((event: R) => event.kind === 'occurrence_recall_transition').length, 1,
    'The selected recall event is not acquired a second time by passive observation');
});

test('a reference scene where SlotSubstitution can propose retains the original earlier recall priority', async () => {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-interface-families-reference.json', import.meta.url), 'utf8'));
  const scene = fixture.scenes['slot:initial'], domain = new ObservedInputDomain(4096);
  assert.ok(await new SlotSubstitution().propose(scene.observation, scene.rows, domain.candidates(scene.observation), 100));
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const result = await runtime.initialize({ sessionId: 'source-priority', observation: scene.public, budgets: { targetLevels: 1, levelActionCaps: [100] } }, { yieldControl: async () => {} });
  assert.equal(result.kind, 'action');
  assert.equal(result.snapshot.lastDecision, 'public_occurrence_recall');
  assert.equal((result.snapshot.proposal as R).field_subquestion, 'observed_occurrence_recall');
  assert.equal((result.snapshot.proposal as R).strategy_receipt.selected, 'window_constraints');
  assert.ok(!(result.snapshot.proposal as R).strategy_receipt.visited.includes('surface'));
});

for (const code of ['SKBN', 'DAME']) test(`common runtime releases and acquires a real ${code} support prefix`, async () => {
  const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-support-extensions-reference.json.gz', import.meta.url))).toString());
  const session = fixture.games.find((row: R) => row.game === code), prefix = session.journal[0];
  const runtime = await createNativeV6Runtime(declarations);
  const execution = { yieldControl: async () => {} };
  let result = await runtime.initialize({ sessionId: `support-integration-${code}`, observation: session.initial.public,
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600) } }, execution);
  assert.equal(result.kind, 'action', result.reason ?? 'No admitted action');
  assert.equal(result.snapshot.lastDecision, code === 'SKBN' ? 'joint_transport' : 'invited_reduction');
  assert.deepEqual((result.snapshot.proposal as R).actions, prefix.proposal.actions);
  for (const step of prefix.steps) {
    if (!step.after) continue;
    result = await runtime.advance({ command: result.command!, observation: step.after.public, executionMs: 0 }, execution);
  }
  assert.equal(result.kind, 'boundary');
  assert.equal((result.snapshot.caller as R).acquiredTransitions, prefix.steps.filter((step: R) => step.after).length);
  const graph = runtime.inspectKnowledge();
  const read = (id: string): R => hydrateNativeState(graph.nodes[id]!.value, key => graph.nodes[key]!.value) as R;
  const acquired = read('reasoning:transition:1').caller_acquisition.selected_result;
  assert.ok(acquired.events.length > 0);
  const records = (read('reasoning:memory').facts as string[]).map(read);
  assert.deepEqual(records.find(row => row.key === 'support_navigation_event:1')!.value, acquired);
});

test('ONDE begins with the exact complete-caller source decision and periodic/support acquisition', async context => {
  const oracle = JSON.parse(await readFile(new URL('./fixtures/v6-native-caller/onde-first-prefix.json', import.meta.url), 'utf8'));
  const from = (ref: R): R => oracle.objects[ref.$object], runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const service = new V6AgentService(() => runtime), sessionId = from(oracle.snapshots[0].observation).observation_ref.split(':epoch:')[0];
  let result = await service.handle({ type: 'init', sessionId, sequence: 0, observation: oracle.publicProtocol.events[0].observation, budgets: oracle.budgets });
  const original = from(oracle.snapshots.find((row: R) => row.stage === 'released').proposal), proposal = result.snapshot.proposal as R;
  assert.equal(result.kind, 'action'); assert.equal(result.snapshot.lastDecision, 'periodic_sums');
  assert.deepEqual(proposal.actions, original.actions);
  assert.deepEqual(proposal.strategy_receipt.visited, original.strategy_receipt.visited);
  assert.equal(proposal.strategy_receipt.selected, original.strategy_receipt.selected);
  assert.equal(proposal.field_subquestion, original.field_subquestion);
  for (const [index, row] of oracle.publicProtocol.events.slice(1).entries()) {
    assert.deepEqual(result.command, row.command);
    result = await service.handle({ type: 'advance', sessionId, sequence: index + 1, ticketId: result.ticket!.id, observation: row.observation, executionMs: 0 });
  }
  assert.equal(result.kind, 'boundary');
  const graph = runtime.inspectKnowledge(), read = (id: string): R => hydrateNativeState(graph.nodes[id]!.value, key => graph.nodes[key]!.value) as R;
  const final = oracle.snapshots.find((row: R) => row.stage === 'prefix_analyzed'), sourceState = from(final.state);
  for (const component of ['goal', 'frontier', 'view', 'attention', 'points', 'displays', 'controls', 'counters']) {
    await context.test(component, () => assert.deepEqual(read(`caller:${component}`), sourceState[component]));
  }
  assert.deepEqual(read('reasoning:transition:1').caller_acquisition.selected_result, from(final.result));
  const facts = (read('reasoning:memory').facts as string[]).map(read), sourceFacts = from(final.memory).facts as R[];
  for (const key of ['support_navigation_event:1', 'periodic_sums_state']) {
    assert.deepEqual(facts.find(fact => fact.key === key), sourceFacts.find(fact => fact.key === key), key);
  }
  const series = read('family_state:public_occurrence_recall');
  assert.deepEqual(series.events, sourceFacts.find(fact => fact.key === 'repeated_series_state')!.value.events);
  assert.deepEqual(series.events.map((event: R) => event.kind), ['coupled_pair_epoch_anchor']);
  assert.deepEqual(facts.find(fact => fact.key === 'repeated_series_state')!.value, series);
});
