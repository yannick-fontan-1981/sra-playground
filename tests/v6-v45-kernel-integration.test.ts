import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createNativeV6Runtime, type NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import type { NativeExecution, NativeFamily } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const reduction = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-reduction-transport-lf52-original-public.json.gz', import.meta.url))).toString()) as R;
const labeled = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-labeled-sequence-original-public.json.gz', import.meta.url))).toString()) as R;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
function read(runtime: Awaited<ReturnType<typeof createNativeV6Runtime>>, id: string): R {
  const graph = runtime.inspectKnowledge();
  assert.ok(graph.nodes[id], `Missing authoritative node ${id}`);
  return hydrateNativeState(graph.nodes[id]!.value, key => graph.nodes[key]!.value) as R;
}
function families(runtime: Awaited<ReturnType<typeof createNativeV6Runtime>>): NativeFamily[] {
  return (runtime as unknown as { families: NativeFamily[] }).families;
}

// Saved public packets are supplied in their observed order. This is a bounded
// common-caller integration check, separate from the fresh live-game campaign.
test('supported reduction reaches the common Kernel through SRC and WHY/ACT, records each public return and honors graph activation', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  try {
    let result = await runtime.initialize({ sessionId: 'v45-reduction-common-public-replay',
      observation: copy(reduction.packets[0].packet), budgets: { targetLevels: 2, levelActionCaps: [600, 600] } }, execution);
    const owner = families(runtime).find(family => family.id === 'reduction_transport')!;
    assert.ok(owner);
    assert.equal(result.snapshot.coverage.registeredFamilies.filter(id => id === owner.id).length, 1);
    const material = (result.snapshot.coverage.sourceGroups as R[]).find(group => group.id === 'factored_material_return')!;
    const index = material.families.indexOf(owner.id);
    assert.ok(index > material.families.indexOf('band_transfer'));
    assert.ok(index < material.families.indexOf('sliding_cavity'));
    for (let actionIndex = 0; actionIndex < 8; actionIndex++) {
      if (result.kind === 'boundary') result = await runtime.resume(execution);
      assert.equal(result.kind, 'action', result.reason ?? JSON.stringify(result.snapshot.trace));
      assert.equal(result.snapshot.lastDecision, owner.id);
      const proposal = result.snapshot.proposal as R;
      assert.equal(proposal.kind, 'supported_ternary_reduction');
      assert.equal(proposal.material_access_subquestion, 'supported_ternary_reduction');
      assert.equal(proposal.strategy_receipt.selected, 'factored_material_return');
      assert.ok(result.authorization);
      assert.deepEqual(result.command, reduction.packets[actionIndex + 1].command);
      result = await runtime.advance({ command: result.command!, executionMs: 1,
        observation: copy(reduction.packets[actionIndex + 1].packet) }, execution);
      assert.equal(result.kind, 'boundary');
      assert.equal(result.snapshot.actions, actionIndex + 1);
      assert.equal((result.snapshot.caller as R).acquiredTransitions, actionIndex + 1);
      assert.deepEqual((result.snapshot.whyAct as R).analysis.map((item: R) => item.operation), ['OP29', 'OP30', 'OP31']);
      const state = read(runtime, 'family_state:reduction_transport');
      assert.deepEqual(state, owner.state());
      assert.equal(state.events.length + state.passed.length, actionIndex + 1);
      const memory = read(runtime, 'reasoning:memory');
      const facts = (memory.facts as string[]).map(id => read(runtime, id));
      const acquired = facts.find(fact => fact.key === `reduction:${actionIndex + 1}`);
      assert.ok(acquired, 'The source reduction event key must enter the actual common memory');
      assert.equal(acquired.value.status, actionIndex === 7 ? 'official_boundary' : 'observed_response');
      const evidence = read(runtime, `prefix_evidence:${(result.snapshot.prefix as R).revision}`);
      assert.equal(evidence.transitions.length, 1);
    }
    assert.equal(result.snapshot.levelsCompleted, 1);
    assert.equal((result.snapshot.caller as R).boundaryReplays, 1);
    const retained = copy(read(runtime, 'family_state:reduction_transport'));
    const graph = runtime.inspectKnowledge();
    await runtime.edit({ expectedGraphChain: graph.chain,
      reason: 'Verify the new family uses actual Kernel activation at a natural boundary',
      changes: [{ type: 'set_family_enabled', familyId: owner.id, enabled: false }] }, execution);
    result = await runtime.resume(execution);
    assert.notEqual(result.snapshot.lastDecision, owner.id);
    assert.equal(result.snapshot.actions, 8);
    assert.deepEqual(read(runtime, 'family_state:reduction_transport'), retained);
  } finally { runtime.close('bounded_reduction_integration_complete'); }
});

test('a composed classification is authorized only for its current measured query and acquires an unknown physical response once', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  try {
    const saved = labeled.packets.at(-1), packet = copy(saved.packet);
    let result = await runtime.initialize({ sessionId: 'v45-composed-saved-public-query', observation: copy(labeled.packets[0].packet),
      budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600) } }, execution);
    for (let index = 0; index < 40; index++) {
      if (result.kind === 'boundary') result = await runtime.resume(execution);
      assert.equal(result.kind, 'action');
      assert.deepEqual(result.command, labeled.packets[index + 1].command);
      result = await runtime.advance({ command: result.command!, executionMs: 1,
        observation: copy(labeled.packets[index + 1].packet) }, execution);
    }
    assert.equal(result.kind, 'boundary');
    assert.equal(result.snapshot.actions, 40);
    result = await runtime.resume(execution);
    assert.equal(result.kind, 'action', result.reason ?? JSON.stringify(result.snapshot.trace));
    assert.equal(result.snapshot.lastDecision, 'public_occurrence_recall');
    const proposal = result.snapshot.proposal as R, inference = proposal.labeled_sequence_plan.inference;
    assert.equal(inference.source_induction.cause, 'MODEL_CONTRADICTION');
    assert.equal(inference.native_composition.complete, true);
    assert.equal(inference.native_composition.candidateRootCount, 6400);
    assert.equal(inference.native_composition.retainedRootCount, 2);
    assert.equal(inference.induction.values.robust_answer_and_submission_agreement, true);
    assert.equal(inference.induction.values.unique_law_proved, false);
    assert.ok(result.authorization);
    const family = families(runtime).find(candidate => candidate.id === 'public_occurrence_recall')!;
    const before = proposal.steps[0].point_binding;
    assert.equal((await family.before(proposal, 0, { ...packet, frame_rows: packet.frame_rows.map((row: number[], y: number) =>
      row.map((value: number, x: number) => x === before.point[0] && y === before.point[1] ? (value + 1) % 16 : value)) },
      { ...saved.observation, observation_ref: proposal.binding.observation_ref })).admitted, false);
    // A controlled unchanged public response tests acquisition and refusal;
    // it is not a live game result or a claimed sixth-level success.
    result = await runtime.advance({ command: result.command!, executionMs: 1,
      observation: { ...packet, step_index: packet.step_index + 1 } }, execution);
    assert.equal(result.kind, 'boundary');
    assert.equal(result.snapshot.actions, 41);
    const state = read(runtime, 'family_state:public_occurrence_recall');
    const events = state.events.filter((event: R) => event.kind === 'labeled_sequence_submission');
    assert.equal(events.length, 41);
    assert.equal(events.at(-1).physical_receipt_status, 'unchanged_public_context');
    assert.equal(events.at(-1).law_uniqueness_claimed, false);
    assert.ok(events.at(-1).cache.native_composition);
    const retained = copy(state);
    result = await runtime.resume(execution);
    assert.equal(result.snapshot.actions, 41);
    assert.notEqual((result.snapshot.proposal as R | null)?.kind, 'labeled_sequence_experiment');
    assert.deepEqual(read(runtime, 'family_state:public_occurrence_recall'), retained);
  } finally { runtime.close('bounded_composed_integration_complete'); }
});

test('officially acquired reduction is remeasured before a wholly unacquired cell inquiry while new control effects remain unknown', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  try {
    let result = await runtime.initialize({ sessionId: 'v45-current-acquired-continuation',
      observation: copy(reduction.packets[0].packet), budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600] } }, execution);
    for (let index = 0; index < 14; index++) {
      if (result.kind === 'boundary') result = await runtime.resume(execution);
      assert.equal(result.kind, 'action', result.reason ?? JSON.stringify(result.snapshot.trace));
      assert.equal(result.snapshot.lastDecision, 'reduction_transport');
      const proposal = result.snapshot.proposal as R;
      assert.equal(proposal.strategy_receipt.selected, 'factored_material_return');
      assert.deepEqual(result.command, reduction.packets[index + 1].command);
      assert.ok(result.authorization, 'The native priority is not a physical authorization');
      if (index < 8) assert.equal(proposal.strategy_receipt.native_coordination, undefined);
      else {
        const coordination = proposal.strategy_receipt.native_coordination.find((row: R) =>
          row.rule === 'current_acquired_continuation_before_unacquired_exploration');
        assert.ok(coordination);
        assert.equal(coordination.source_trigger_group, 'window_constraints');
        assert.equal(coordination.selected_group, 'factored_material_return');
        assert.equal(coordination.selected_entry, null, 'This single-owner source wrapper has no separate dispatch entry');
        assert.equal(coordination.selected_subquestion, 'supported_ternary_reduction');
        assert.equal(coordination.preferred_family, 'reduction_transport');
        assert.deepEqual(proposal.strategy_receipt.visited, ['goal_access', 'window_constraints']);
        assert.equal(coordination.physical_action_authorized, false);
        assert.equal(coordination.acquired_continuation.score, 1);
        assert.equal(coordination.unacquired_inquiry.status, 'unacquired_exploration');
        assert.deepEqual(coordination.unacquired_inquiry.evidence_refs, []);
        assert.equal(proposal.steps[0].mode, 'calibrate');
        assert.equal(proposal.steps[0].expected_after, null);
        assert.equal(coordination.acquired_continuation.action_effect_known, false);
        const state = read(runtime, 'family_state:reduction_transport');
        assert.equal(state.motion[result.command!.action_ref], undefined);
        assert.equal(read(runtime, 'family_state:public_occurrence_recall').events
          .filter((event: R) => event.kind === 'cell_patch_placement_evidence').length, 0);
      }
      result = await runtime.advance({ command: result.command!, executionMs: 1,
        observation: copy(reduction.packets[index + 1].packet) }, execution);
      assert.equal(result.snapshot.actions, index + 1);
      assert.equal((result.snapshot.caller as R).acquiredTransitions, index + 1);
    }
    assert.equal(result.snapshot.levelsCompleted, 1);
    assert.ok(Object.keys(read(runtime, 'family_state:reduction_transport').motion).length > 0,
      'A control can be learned only after the actual compatible public response');
  } finally { runtime.close('bounded_current_continuation_integration_complete'); }
});
