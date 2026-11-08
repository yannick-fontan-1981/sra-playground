import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createNativeV6Runtime, NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';

type R = Record<string, any>;
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const existing = JSON.parse(await readFile(new URL('./fixtures/v6-occurrence-reference.json', import.meta.url), 'utf8'));
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const copy = <T>(value: T): T => structuredClone(value);

test('a cold common caller releases a measured collection edit and acquires its real refusal once', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const families = (runtime as unknown as { families: NativeFamily[] }).families;
  const owners = families.filter(family => family.id === 'public_occurrence_recall');
  assert.equal(owners.length, 1);
  const family = owners[0]!, initial = copy(existing.scenes['stck:initial'].public);
  const empty = family.state();
  let result = await runtime.initialize({ sessionId: 'program-common-fresh', observation: { ...initial, step_index: 0 },
    budgets: { targetLevels: 3, levelActionCaps: [40, 40, 40], maxActions: 120 } }, execution);
  assert.equal(result.kind, 'action', result.reason ?? JSON.stringify(result.snapshot.trace));
  assert.ok(result.authorization, 'WHY/ACT releases the actual public point');
  assert.equal(result.snapshot.lastDecision, family.id);
  const proposal = result.snapshot.proposal as R;
  assert.equal(proposal.kind, 'marked_collection_edit');
  assert.equal(proposal.marked_collection_plan.mode, 'remove');
  assert.equal(proposal.field_subquestion, 'observed_program_composition');
  assert.equal(proposal.strategy_receipt.selected, 'window_constraints');
  assert.deepEqual(family.state(), empty, 'No effect or operator model exists before the first real action');
  const group = (result.snapshot.coverage as R).sourceGroups.find((entry: R) => entry.id === 'window_constraints');
  assert.deepEqual(group.entryPoints.filter((entry: string | null) => entry !== null),
    ['cell_patch_composition', 'observed_occurrence_recall', 'observed_program_composition', 'radial_port_composition', 'rooted_quota_composition']);
  assert.equal(group.families.filter((id: string) => id === family.id).length, 5);
  assert.deepEqual(proposal.steps[0].point_binding.point, [result.command!.data!.x, result.command!.data!.y]);

  // A controlled stationary response is a falsifier, not a real-game success.
  result = await runtime.advance({ command: result.command!, executionMs: 1,
    observation: { ...initial, step_index: 1 } }, execution);
  assert.equal(result.kind, 'boundary');
  assert.equal(result.snapshot.actions, 1); assert.equal(result.snapshot.cycles, 1);
  assert.equal((result.snapshot.caller as R).acquiredTransitions, 1);
  assert.deepEqual((result.snapshot.whyAct as R).analysis.map((entry: R) => entry.operation), ['OP29', 'OP30', 'OP31']);
  const graph = runtime.inspectKnowledge();
  const read = (id: string): R => hydrateNativeState(graph.nodes[id]!.value, key => graph.nodes[key]!.value) as R;
  const series = read('family_state:public_occurrence_recall');
  const edits = series.events.filter((event: R) => event.kind === 'marked_collection_result');
  assert.equal(edits.length, 1, 'The shared selected owner must not be acquired twice by its passive entry');
  assert.equal(edits[0].outcome.matched, false);
  assert.equal(series.events.filter((event: R) => event.kind === 'program_edit_sample').length, 0);
  assert.equal(series.events.filter((event: R) => event.kind === 'fitted_program_composition').length, 0);
  assert.deepEqual(family.state(), series);
  const facts = (read('reasoning:memory').facts as string[]).map(read);
  assert.deepEqual(facts.find(fact => fact.key === 'repeated_series_state')!.value, series);
  const transition = read(`reasoning:transition:${read(`prefix_evidence:${(result.snapshot.prefix as R).revision}`).decision_revision}`);
  assert.ok(transition.caller_acquisition && transition.frontier_acquisition);
  const resumed = await runtime.resume(execution);
  assert.notEqual((resumed.snapshot.proposal as R)?.kind, 'marked_collection_edit', 'A refuted edit is not replayed');
});

for (const official of [false, true]) {
  test(`source stop is checked only after sealed acquisition; official completion priority=${official}`, async () => {
    let records: number[] = [];
    const stopReads: number[] = [];
    const family: NativeFamily = {
      id: 'scoped-program-stop-contract',
      propose: () => ({ status: 'proposed', kind: 'controlled_prefix',
        actions: [{ action_ref: 'ACTION1' }, { action_ref: 'ACTION1' }], steps: [{}, {}] }),
      before: () => ({ admitted: true, reason: 'controlled_current_context' }),
      after: (_proposal, index) => ({ matched: true, seal_prefix: index === 1, reason: 'controlled_projection' }),
      record: (_before, _after, _command, _first, _second, _proposal, index) => { records.push(index); return { events: [] }; },
      requestedStopReason: () => { stopReads.push(records.length); return records.length === 2 ? 'program_composition_projection_refuted' : null; },
      state: () => ({ records: [...records] }), restore: state => { records = [...state.records as number[]]; },
    };
    const runtime = new NativeV6Runtime({ families: [family], maxPointOccurrences: 250,
      sourceDigest: 'controlled-acquisition-stop-contract', now: () => 0 });
    const rows = [[0, 0], [0, 0]];
    const packet: NativePublicObservation = { frame_rows: rows, frame_packet: [rows], frame_hash: 'controlled-public-frame',
      level: 1, levels_completed: 0, state: 'NOT_FINISHED', step_index: 0, available_action_refs: ['ACTION1'] };
    let result = await runtime.initialize({ sessionId: `program-stop-${official}`, observation: packet,
      budgets: { targetLevels: 1, levelActionCaps: [40], maxActions: 40 } }, execution);
    assert.equal(result.kind, 'action'); assert.deepEqual(stopReads, []);
    result = await runtime.advance({ command: result.command!, executionMs: 1, observation: { ...packet, step_index: 1 } }, execution);
    assert.equal(result.kind, 'action'); assert.deepEqual(records, []); assert.deepEqual(stopReads, []);
    result = await runtime.advance({ command: result.command!, executionMs: 1,
      observation: { ...packet, step_index: 2, ...(official ? { levels_completed: 1, state: 'WIN' } : {}) } }, execution);
    assert.deepEqual(records, [0, 1]); assert.deepEqual(stopReads, [2]);
    assert.equal(result.kind, 'stopped');
    assert.equal(result.reason, official ? 'target_levels_completed' : 'program_composition_projection_refuted');
    assert.equal(result.snapshot.actions, 2); assert.equal(result.snapshot.cycles, 1);
    assert.equal((await runtime.resume(execution)).kind, 'stopped');
  });
}
