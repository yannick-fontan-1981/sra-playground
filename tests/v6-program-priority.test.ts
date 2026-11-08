import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeFamily, NativeExecution, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const source = new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/', root);
const declarations = {
  common: JSON.parse(await readFile(new URL('agents/yf_arc3_v6/laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('agents/yf_arc3_v6/morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const fixture = JSON.parse(gunzipSync(await readFile(new URL('tests/fixtures/v6-program-priority-public.json.gz', root))).toString());
const collision = JSON.parse(await readFile(new URL('docs/migration/native-campaigns-v39/diagnostics/stck-original-caller-collision.json', root), 'utf8'));
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const copy = <T>(value: T): T => structuredClone(value);
const normalized = (command: R): R => ({ action_ref: command.action_ref, data: command.data ?? {} });
const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

test('the unchanged original caller independently confirms the invitation collision', async () => {
  assert.equal(collision.matchedActions, 4);
  assert.equal(collision.childExitCode, 0);
  assert.equal(collision.original.reason, 'frontier_unknown');
  assert.deepEqual(collision.original.levelActions, { '1': 3, '2': 1 });
  assert.equal(collision.original.final.levels_completed, 1);
  assert.equal(collision.sourceVerification.beforeOriginalMain, true);
  assert.equal(collision.sourceVerification.afterOriginalMain, true);
  for (const [path, expected] of Object.entries(collision.sourceVerification.sourceHashes)) {
    assert.equal(sha(await readFile(new URL(path, source))), expected, path);
  }
  const trace = await readFile(new URL(collision.input.path, root));
  assert.equal(sha(trace), collision.input.sha256);
  const packets = JSON.parse(gunzipSync(trace).toString()).packets;
  assert.deepEqual(fixture.packets, packets.slice(0, 4));
  assert.deepEqual(packets[3].packet.frame_rows, packets[4].packet.frame_rows,
    'The later original invitation was stationary in the actually observed public response');
  assert.equal(collision.proposals[3].kind, 'measured_animated_contact');
});

// This deterministic replay is a coordinator regression, not a fresh game win.
// The caller acquires every model from the recorded public prefix; no family,
// proposal, learned state, expected action or game identifier is supplied to it.
test('a newly acquired and currently guarded program defers an unlearned invitation through the normal SRC window entry', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const families = (runtime as unknown as { families: NativeFamily[] }).families;
  const family = families.find(candidate => candidate.id === 'public_occurrence_recall')!;
  assert.ok(family);
  assert.equal(families.filter(candidate => candidate.id === family.id).length, 1);
  assert.equal((family.state() as R).events.length, 0);
  const initial = copy(fixture.packets[0].packet) as NativePublicObservation;
  let result = await runtime.initialize({ sessionId: 'program-native-coordination', observation: initial,
    budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600], maxActions: 1800 } }, execution);
  for (let i = 0; i < 3; i++) {
    assert.equal(result.kind, 'action', result.reason ?? JSON.stringify(result.snapshot.trace));
    const proposal = result.snapshot.proposal as R;
    assert.equal(proposal.kind, 'marked_collection_edit');
    assert.equal(proposal.strategy_receipt.selected, 'window_constraints');
    assert.equal(proposal.strategy_receipt.native_coordination, undefined,
      'Unacquired collection edits do not gain priority over an invitation');
    assert.deepEqual(normalized(result.command!), normalized(fixture.packets[i + 1].command));
    assert.ok(result.authorization);
    result = await runtime.advance({ command: result.command!, executionMs: 0,
      observation: copy(fixture.packets[i + 1].packet) }, execution);
    assert.equal(result.kind, 'boundary', result.reason);
    assert.equal(result.snapshot.actions, i + 1);
    assert.equal((result.snapshot.caller as R).acquiredTransitions, i + 1);
    assert.deepEqual((result.snapshot.whyAct as R).analysis.map((entry: R) => entry.operation), ['OP29', 'OP30', 'OP31']);
    if (i < 2) result = await runtime.resume(execution);
  }
  assert.equal(result.snapshot.levelsCompleted, 1);
  assert.equal(result.snapshot.level, 2);
  assert.equal((result.snapshot.caller as R).boundaryReplays, 1);
  const retained = family.state() as R, fitted = retained.events.filter((event: R) => event.kind === 'fitted_program_composition');
  assert.equal(fitted.length, 1);
  assert.equal(retained.events.filter((event: R) => event.kind === 'program_edit_sample').length, 2);
  assert.equal(retained.events.filter((event: R) => event.kind === 'public_program_phase_alignment').length, 1);
  const model = fitted[0].model;

  result = await runtime.resume(execution);
  assert.equal(result.kind, 'action', result.reason ?? JSON.stringify(result.snapshot.trace));
  assert.equal(result.snapshot.lastDecision, family.id);
  const proposal = result.snapshot.proposal as R, plan = proposal.program_composition_plan;
  assert.equal(proposal.kind, 'public_program_composition');
  assert.equal(plan.mode, 'bind_single_member');
  assert.equal(proposal.field_subquestion, 'observed_program_composition');
  assert.equal(plan.model.model_id, model.model_id);
  assert.equal(proposal.strategy_receipt.selected, 'window_constraints');
  assert.deepEqual(proposal.strategy_receipt.visited, ['goal_access', 'window_constraints']);
  assert.deepEqual(normalized(result.command!), { action_ref: 'ACTION6', data: { x: 16, y: 56 } });
  assert.deepEqual(proposal.steps[0].point_binding.point, [16, 56]);
  assert.deepEqual(proposal.steps[0].point_binding.projection_bbox, [12, 54, 20, 58]);
  assert.equal(proposal.steps[0].point_binding.level_epoch, 2);
  assert.equal(proposal.steps[0].point_binding.observation_ref, plan.observation_ref);
  assert.ok(result.authorization, 'The preferred current point still passes the ordinary WHY/ACT gate');
  assert.deepEqual(family.state(), retained, 'Read-only lookahead and ordinary planning cannot acquire or mutate observed effects');
  assert.equal(result.snapshot.actions, 3);
  assert.equal((result.snapshot.caller as R).acquiredTransitions, 3);

  const configuration = declarations.strategy.declarations[0]!.configuration, groups = (result.snapshot.coverage as R).sourceGroups;
  assert.deepEqual(groups.map((group: R) => group.id), configuration.families, 'The declared outer SRC family order is unchanged');
  const entries = groups.find((group: R) => group.id === 'window_constraints').entryPoints.filter((entry: string | null) => entry !== null);
  assert.deepEqual(entries, ['cell_patch_composition', 'observed_occurrence_recall', 'observed_program_composition']);

  const coordination = proposal.strategy_receipt.native_coordination;
  assert.equal(coordination.length, 1);
  assert.equal(coordination[0].rule, 'retained_program_preparation_before_unlearned_invitation');
  assert.equal(coordination[0].observation_ref, plan.observation_ref);
  assert.equal(coordination[0].preferred_proposal_id, proposal.proposal_id);
  assert.equal(coordination[0].model_id, model.model_id);
  assert.equal(coordination[0].guard_reason, 'program_collection_and_operands_bound');
  assert.match(coordination[0].deferred_proposal_id, /^animated-contact:/);
  assert.equal(coordination[0].scope, 'Native coordination extension; conditional learned preparation, not an original Python selection rule.');
  const graph = runtime.inspectKnowledge();
  const read = (id: string): R => hydrateNativeState(graph.nodes[id]!.value, key => graph.nodes[key]!.value) as R;
  assert.deepEqual(read('family_state:public_occurrence_recall'), retained);
  const animation = read('family_state:animated_contact');
  assert.deepEqual(animation.events, [], 'A deferred geometric invitation has no fabricated observation');
});

test('a current invitation keeps its original priority when no program model has been learned', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  // Reuse a public raster as a controlled cold scene, without pretending the
  // fresh caller completed the earlier level or acquired its program model.
  const packet: NativePublicObservation = { ...copy(fixture.packets[3].packet), level: 1, levels_completed: 0, step_index: 0 };
  const result = await runtime.initialize({ sessionId: 'program-no-acquired-model', observation: packet,
    budgets: { targetLevels: 1, levelActionCaps: [40], maxActions: 40 } }, execution);
  assert.equal(result.kind, 'action', result.reason);
  const proposal = result.snapshot.proposal as R;
  assert.equal(result.snapshot.lastDecision, 'animated_contact');
  assert.equal(proposal.animated_contact_plan.mode, 'invitation');
  assert.deepEqual(normalized(result.command!), { action_ref: 'ACTION6', data: { x: 33, y: 24 } });
  assert.equal(proposal.strategy_receipt.selected, 'goal_access');
  assert.equal(proposal.strategy_receipt.native_coordination, undefined);
  assert.equal(result.snapshot.actions, 0);
});

test('a rejected current program guard vetoes deferral and leaves the invitation available', async context => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const family = (runtime as unknown as { families: NativeFamily[] }).families.find(candidate => candidate.id === 'public_occurrence_recall')!;
  let result = await runtime.initialize({ sessionId: 'program-priority-guard-veto', observation: copy(fixture.packets[0].packet),
    budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600] } }, execution);
  for (let index = 1; index <= 3; index++) {
    assert.equal(result.kind, 'action');
    assert.deepEqual(normalized(result.command!), normalized(fixture.packets[index].command));
    result = await runtime.advance({ command: result.command!, executionMs: 0, observation: copy(fixture.packets[index].packet) }, execution);
    assert.equal(result.kind, 'boundary');
    if (index < 3) result = await runtime.resume(execution);
  }
  const retained = family.state(), originalBefore = family.before.bind(family);
  let vetoes = 0;
  // A controlled guard failure isolates arbitration. It supplies no proposal,
  // candidate action or learned data and is not evidence of a game outcome.
  context.mock.method(family, 'before', (...args: Parameters<NativeFamily['before']>) => {
    if (args[0].kind === 'public_program_composition') {
      vetoes++; return { admitted: false, reason: 'controlled_current_support_changed' };
    }
    return originalBefore(...args);
  });
  result = await runtime.resume(execution);
  assert.equal(vetoes, 1);
  assert.equal(result.kind, 'action', result.reason);
  const proposal = result.snapshot.proposal as R;
  assert.equal(result.snapshot.lastDecision, 'animated_contact');
  assert.equal(proposal.animated_contact_plan.mode, 'invitation');
  assert.deepEqual(normalized(result.command!), { action_ref: 'ACTION6', data: { x: 33, y: 24 } });
  assert.equal(proposal.strategy_receipt.selected, 'goal_access');
  assert.equal(proposal.strategy_receipt.native_coordination, undefined);
  assert.deepEqual(family.state(), retained);
  assert.equal(result.snapshot.actions, 3);
});

test('an independently fitted program model cannot displace an already learned animation contact', async () => {
  // This controlled checkpoint test is deliberately separate from the cold
  // caller acquisition and fresh real-game campaigns. Both checkpoints come
  // from public evidence: the first-level program packets and the unchanged
  // original animation contract fixture, respectively.
  const configuration = declarations.strategy.declarations[0]!.configuration;
  const acquired = new SharedSeriesConstraint(configuration.window_constraints.occurrence_recall);
  const observations: R[] = [];
  for (const [index, item] of fixture.packets.entries()) {
    observations.push(await measureNativeObservation(item.packet, index + 1, 'program-independent-model'));
  }
  for (let index = 0; index < 3; index++) {
    const before = fixture.packets[index].packet, after = fixture.packets[index + 1].packet;
    const proposal = await acquired.programPropose(observations[index]!, before.frame_rows, [], 600, 360_000, () => 0);
    assert.ok(proposal);
    acquired.record(observations[index]!, observations[index + 1]!, fixture.packets[index + 1].command,
      before.frame_rows, after.frame_rows, proposal, 0, after.frame_packet);
  }
  assert.equal(acquired.memory.compositionModels.length, 1);
  const animation = JSON.parse(await readFile(new URL('tests/fixtures/v6-animated-contact-reference.json', root), 'utf8'));
  const sequence = animation.scenarios.find((scenario: R) => scenario.id === 'invitation to complete packet measurement and authorized contact');
  const returned = sequence.steps.find((step: R) => step.operation.kind === 'record' && step.operation.packet === 'contact').expected.state;
  const expected = sequence.steps.find((step: R) => step.operation.kind === 'propose' && step.operation.scene === 'same_after').expected.result;
  assert.equal(returned.events.filter((event: R) => event.model).length, 1);
  assert.equal(expected.animated_contact_plan.mode, 'contact_solution');
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const families = (runtime as unknown as { families: NativeFamily[] }).families;
  const shared = families.find(family => family.id === 'public_occurrence_recall')!, contact = families.find(family => family.id === 'animated_contact')!;
  shared.restore(acquired.state()); contact.restore(copy(returned));
  const programState = shared.state(), packet: NativePublicObservation = { ...copy(animation.scenes.same_after.public), step_index: 0 };
  const result = await runtime.initialize({ sessionId: 'program-independent-vs-learned-contact', observation: packet,
    budgets: { targetLevels: 1, levelActionCaps: [40], maxActions: 40 } }, execution);
  assert.equal(result.kind, 'action', result.reason ?? JSON.stringify(result.snapshot.trace));
  assert.equal(result.snapshot.lastDecision, 'animated_contact');
  const proposal = result.snapshot.proposal as R;
  assert.equal(proposal.animated_contact_plan.mode, 'contact_solution');
  assert.deepEqual(normalized(result.command!), normalized(expected.actions[0]));
  assert.equal(proposal.strategy_receipt.selected, 'goal_access');
  assert.equal(proposal.strategy_receipt.native_coordination, undefined);
  assert.deepEqual(shared.state(), programState);
  assert.equal(result.snapshot.actions, 0);
});
