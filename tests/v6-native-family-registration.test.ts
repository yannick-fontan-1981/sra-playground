import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import { hydrateNativeState, isNativeStateGraph } from '../src/logos-engine/v6-native-state-graph.ts';
import { decodeNativeState } from '../src/logos-engine/v6-knowledge-store.ts';
import type { KnowledgeMemory } from '../src/logos-engine/kernel.ts';
import type { NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
const source = new URL(`../reference/v6/${COMMIT}/source/agents/yf_arc3_v6/`, import.meta.url);
const fixtureBytes = await readFile(new URL('./fixtures/v6-interface-families-reference.json', import.meta.url));
const fixture = JSON.parse(fixtureBytes.toString());
const strategyBytes = await readFile(new URL('morphology_policy/strategy.drm', source));
const declarations: NativeV6Declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(strategyBytes.toString()),
};
const policy = declarations.strategy.declarations[0]!.configuration;
const EXECUTION = { yieldControl: async () => {} };
const interfaceIds = {
  slot_substitution: 'slot_substitution', typed_word_interface: 'word_interface',
  rigid_port_assembly: 'port_assembly', controlled_constellation_cover: 'constellation_cover',
} as const;

// Independent development capture from the unchanged StrategyRouter.choose,
// with real Goal/Frontier/Point/Control/View objects, empty acquired registry,
// and the main caller's 160-action / 360-second level allowance. No provider,
// strategy, decision or source function was replaced. Its original observation
// reference is retained in the family fixture; the native test starts a fresh
// public session and therefore numbers the same two packets as steps 0 and 1.
const originalChoice = {
  sourceSha256: '425aca6c30e7abb38a537dfcef38f92c418bc4dfa35201ae52dc42ba4390fa55',
  drmSha256: '6e8aee941d56511273be79222b03c88d092cdc3ca1c295c91509b9cc93b15f44',
  fixtureSha256: 'c63c597f6195a2bef78c770b197bd6e83789bca4cac85f999bf00352cf4b95e5',
  scene: 'word:initial', frameHash: '11230f3123ae005e',
  selected: 'surface', question: 'typed_word_interface', action: { action_ref: 'ACTION1' },
  visited: ['goal_access', 'window_constraints', 'orbit_constraints', 'scored_local_rewrite', 'containment', 'surface'],
};
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function packet(scene: string, index: number): NativePublicObservation {
  return { ...structuredClone(fixture.scenes[scene].public), step_index: index };
}
function value(graph: KnowledgeMemory, id: string): R {
  const raw = graph.nodes[id]!.value!;
  return (isNativeStateGraph(raw)
    ? hydrateNativeState(raw, fragment => graph.nodes[fragment]!.value)
    : decodeNativeState(raw)) as R;
}

test('real factory registers the four interfaces in DRM order and executes Word through SRC, WHY/ACT, acquisition and V7 activation', async () => {
  assert.equal(sha(await readFile(new URL('morphology_policy/strategy.py', source))), originalChoice.sourceSha256);
  assert.equal(sha(strategyBytes), originalChoice.drmSha256);
  assert.equal(sha(fixtureBytes), originalChoice.fixtureSha256);
  assert.equal(fixture.scenes[originalChoice.scene].public.frame_hash, originalChoice.frameHash);

  // The production factory and original declarations select the provider. No
  // family, plan, expected action, game identifier or acquired state is injected.
  // This deterministic replay clock is separate from real-time campaign checks.
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  try {
    const first = await runtime.initialize({ sessionId: 'interface-registration',
      observation: packet(originalChoice.scene, 0), budgets: { targetLevels: 3, levelActionCaps: [160, 160, 160] } }, EXECUTION);
    const snapshot = first.snapshot as R, graph = runtime.inspectKnowledge();
    assert.equal(first.kind, 'action', String(first.reason));
    assert.deepEqual(first.command, originalChoice.action);
    assert.equal(snapshot.lastDecision, 'word_interface');
    assert.equal(snapshot.proposal.program_subquestion, originalChoice.question);
    assert.equal(snapshot.proposal.strategy_receipt.selected, originalChoice.selected);
    assert.deepEqual(snapshot.proposal.strategy_receipt.visited, originalChoice.visited);
    assert.equal(snapshot.srcDecision.workflow, 'v6.composition_strategy.choose');
    assert.equal(snapshot.whyAct.decision.decision.status, 'action_set_released');
    assert.equal(snapshot.whyAct.decision.decision.model_calls.length, 0);
    assert.equal(snapshot.coverage.fullV6Parity, false);
    assert.deepEqual(snapshot.coverage.sourceGroups.map((group: R) => group.id), policy.families);

    const available = { surface_rewrite: 'surface_program', learned_code_program: 'code_program', ...interfaceIds,
      configured_arrivals: 'configured_arrivals', fixed_origin: 'fixed_origin',
      linked_temporal_preparation: 'linked_temporal_preparation' } as Record<string, string>;
    const expected = policy.program_construction.ordered_subquestions.flatMap(question => available[question] ? [available[question]] : []);
    assert.deepEqual(snapshot.coverage.sourceGroups.find((group: R) => group.id === 'surface').families, expected);
    for (const id of Object.values(interfaceIds)) {
      assert.ok(snapshot.coverage.registeredFamilies.includes(id));
      assert.equal(graph.nodes[`family_state:${id}`]!.kind, 'family_state');
      assert.equal(graph.nodes[`family_activation:${id}`]!.kind, 'family_activation');
      assert.deepEqual(value(graph, `family_activation:${id}`), { enabled: true });
    }
    assert.ok(graph.nodes['program:v6.composition_strategy.choose']);
    assert.ok(graph.nodes['program:prototype.laya_router.route']);

    // Supply only the next public packet witnessed in the original family
    // journal. The native coordinator must acquire the asynchronous rewrite,
    // retain its actual evidence, and seal the prefix once before replanning.
    const boundary = await runtime.advance({ command: first.command!, observation: packet('word:editA', 1), executionMs: 0 }, EXECUTION);
    assert.equal(boundary.kind, 'boundary', String(boundary.reason));
    assert.equal(boundary.snapshot.actions, 1);
    assert.equal(boundary.snapshot.cycles, 1);
    assert.equal(boundary.snapshot.levelsCompleted, 0, 'This controlled public transition makes no solved-level claim');
    const acquired = runtime.inspectKnowledge(), word = value(acquired, 'family_state:word_interface');
    assert.ok(word.verified.includes('ACTION1'));
    assert.equal(word.events.length, 1);
    assert.equal(word.events[0].status, 'local_glyph_rewrite');
    assert.equal(word.edit_graph[0][0], 'ACTION1');
    const index = value(acquired, 'reasoning:memory');
    const wordFact = index.facts.map((id: string) => value(acquired, id)).find((fact: R) => fact.key === 'words:1');
    assert.ok(wordFact, 'The original caller event key must retain the acquired Word event');
    assert.deepEqual(wordFact.value, word.events[0]);
    assert.ok(acquired.nodes['caller:goal']);
    assert.ok(acquired.nodes['caller:frontier']);
    assert.ok(acquired.nodes['reasoning:transition:1']);
    assert.ok(acquired.nodes['prefix_evidence:1']);

    // Disable all four through the public edit API at the sealed boundary. The
    // actual selection must now read those revisions, while retaining learning.
    const edited = await runtime.edit({ expectedGraphChain: acquired.chain,
      reason: 'Verify installed interface activation revisions affect selection',
      changes: Object.values(interfaceIds).map(familyId => ({ type: 'set_family_enabled' as const, familyId, enabled: false })) }, EXECUTION);
    assert.equal(edited.snapshot.actions, 1, 'An activation edit dispatches no action');
    const disabled = runtime.inspectKnowledge();
    assert.notEqual(disabled.chain, acquired.chain);
    for (const id of Object.values(interfaceIds)) {
      assert.equal(disabled.nodes[`family_activation:${id}`]!.revision, acquired.nodes[`family_activation:${id}`]!.revision + 1);
      assert.deepEqual(value(disabled, `family_activation:${id}`), { enabled: false });
      assert.equal(disabled.nodes[`family_state:${id}`], acquired.nodes[`family_state:${id}`]);
    }
    const resumed = await runtime.resume(EXECUTION);
    assert.equal(resumed.snapshot.actions, 1);
    assert.ok(!Object.values(interfaceIds).includes(resumed.snapshot.lastDecision as typeof interfaceIds[keyof typeof interfaceIds]),
      'A disabled interface must not be selected from a stale provider cache');
    assert.deepEqual(value(runtime.inspectKnowledge(), 'family_state:word_interface'), word);
    assert.equal((resumed.snapshot as R).coverage.fullV6Parity, false);
  } finally { runtime.close('registration_test_complete'); }
});

// This bounded positive route is not full router parity. In the unchanged
// original router, the Slot fixture is preempted by public_occurrence_recall in
// window_constraints. This priority is now tested by the connected recall
// integration suite; the isolated Slot journal remains a component test.
