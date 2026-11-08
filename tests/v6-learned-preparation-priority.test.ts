import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily, NativeObservation, NativeProposal, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { OccurrenceRecallAccess, OccurrenceRecallConstraint } from '../src/logos-engine/v6-occurrence-recall.ts';
import { occurrenceCandidates } from '../src/logos-engine/v6-occurrence-scene.ts';
import { sharedLearnedPreparationWitness } from '../src/logos-engine/v6-learned-preparation.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const source = new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', root);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const fixture = JSON.parse(await readFile(new URL('tests/fixtures/v6-occurrence-reference.json', root), 'utf8'));
const scenario = fixture.scenarios.find((value: R) => value.id === 'real_MEMO_three_levels_and_L4_refusal');
const sourceProposals = scenario.steps.filter((step: R) => step.operation.kind === 'propose').slice(0, 7)
  .map((step: R) => step.expected.result);
const policy = fixture.policy;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const copy = <T>(value: T): T => structuredClone(value);
const normalized = (command: R): R => ({ action_ref: command.action_ref, data: command.data ?? {} });
const publicPacket = (index: number): NativePublicObservation => copy(fixture.scenes[`memo:${index}`].public);

// These are offline replays of already recorded public returns. No game module,
// private object, family selection, learned checkpoint or expected command is
// supplied to the caller. Expected commands only verify the observed choice.
async function coldPrefix(sessionId: string) {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const families = (runtime as unknown as { families: NativeFamily[] }).families;
  const family = families.find(candidate => candidate.id === 'public_occurrence_recall')!;
  assert.ok(family.learnedPreparationWitness);
  assert.deepEqual((family.state() as R).events, []);
  let result = await runtime.initialize({ sessionId, observation: publicPacket(0),
    budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600], maxActions: 1800 } }, execution);
  for (let index = 0; index < 6; index++) {
    assert.equal(result.kind, 'action', result.reason ?? JSON.stringify(result.snapshot.trace));
    assert.equal(result.snapshot.lastDecision, family.id);
    const proposal = result.snapshot.proposal as R;
    assert.equal(proposal.occurrence_recall_plan.selection_reason, 'test_observed_enclosing_emphasis');
    assert.deepEqual(normalized(result.command!), normalized(sourceProposals[index].actions[0]));
    assert.equal(proposal.strategy_receipt.native_coordination, undefined,
      'Observed emphasis alone does not receive learned-preparation priority');
    assert.ok(result.authorization);
    result = await runtime.advance({ command: result.command!, executionMs: 0,
      observation: publicPacket(index + 1) }, execution);
    assert.equal(result.kind, 'boundary', result.reason);
    assert.equal(result.snapshot.actions, index + 1);
    assert.equal((result.snapshot.caller as R).acquiredTransitions, index + 1);
    assert.equal((family.state() as R).events.filter((event: R) => event.kind === 'occurrence_recall_transition').length, index + 1);
    if (index < 5) result = await runtime.resume(execution);
  }
  return { runtime, family, result };
}

// Pure witness tests independently acquire the original recall journal. They
// use the existing Python fixture as their expected answer, rather than a
// model copied out of the new priority implementation.
async function acquiredRecall() {
  const family = new OccurrenceRecallConstraint(policy);
  for (let index = 0; index < 6; index++) {
    const before = fixture.scenes[`memo:${index}`], after = fixture.scenes[`memo:${index + 1}`];
    const proposal = await family.propose(before.observation, before.rows, [], 600);
    assert.ok(proposal);
    assert.deepEqual(proposal, sourceProposals[index]);
    family.record(before.observation, after.observation, proposal.actions[0], before.rows, after.rows,
      proposal, 0, after.public.frame_packet);
  }
  const current = fixture.scenes['memo:6'];
  const proposal = await family.propose(current.observation, current.rows, [], 600) as NativeProposal;
  assert.deepEqual(proposal, sourceProposals[6]);
  return { family, memory: family.memory, proposal: copy(proposal), observation: copy(current.observation) as NativeObservation };
}

test('cold public recall acquisition defers the seventh unlearned invitation through the ordinary window order', async context => {
  const { runtime, family, result: boundary } = await coldPrefix('anonymous-retained-correspondence');
  const retained = family.state() as R;
  assert.equal(boundary.snapshot.levelsCompleted, 0, 'This seven-choice regression does not assert a level completion');
  const calls: string[] = [], original = family.proposeInSubquestion!.bind(family);
  context.mock.method(family, 'proposeInSubquestion', (...args: Parameters<NonNullable<NativeFamily['proposeInSubquestion']>>) => {
    if (args[0] === 'window_constraints') calls.push(args[1]);
    return original(...args);
  });
  const result = await runtime.resume(execution);
  assert.equal(result.kind, 'action', result.reason ?? JSON.stringify(result.snapshot.trace));
  assert.equal(result.snapshot.lastDecision, 'public_occurrence_recall');
  const proposal = result.snapshot.proposal as R, plan = proposal.occurrence_recall_plan;
  assert.equal(plan.selection_reason, 'test_retained_occurrence_correspondence');
  assert.equal(plan.selected.marked, false);
  assert.deepEqual(normalized(result.command!), normalized(sourceProposals[6].actions[0]));
  assert.deepEqual(normalized(result.command!), { action_ref: 'ACTION6', data: { x: 15, y: 35 } });
  assert.equal(proposal.field_subquestion, 'observed_occurrence_recall');
  assert.equal(proposal.strategy_receipt.selected, 'window_constraints');
  assert.deepEqual(proposal.strategy_receipt.visited, ['goal_access', 'window_constraints']);
  assert.deepEqual(calls, ['occluded_catalogue_composition', 'queued_field_composition', 'product_panel_composition', 'labeled_sequence_composition', 'linked_packet_composition', 'trace_field_composition', 'cell_patch_composition', 'observed_occurrence_recall'],
    'The first ordinary window choice supplies its own proof; later entries are not borrowed or reordered');
  const groups = (result.snapshot.coverage as R).sourceGroups;
  assert.deepEqual(groups.map((group: R) => group.id), declarations.strategy.declarations[0]!.configuration.families);
  assert.deepEqual(groups.find((group: R) => group.id === 'window_constraints').entryPoints.filter((entry: string | null) => entry !== null),
    ['occluded_catalogue_composition', 'queued_field_composition', 'product_panel_composition', 'labeled_sequence_composition', 'linked_packet_composition', 'trace_field_composition', 'cell_patch_composition', 'observed_occurrence_recall', 'observed_program_composition', 'typed_material_flow', 'radial_port_composition', 'rooted_quota_composition']);
  assert.ok(result.authorization, 'A priority witness still requires the current WHY/ACT authorization');
  assert.deepEqual(proposal.steps[0].point_binding.point, plan.selected.point);
  assert.equal(proposal.steps[0].point_binding.observation_ref, plan.observation_ref);

  const coordination = proposal.strategy_receipt.native_coordination;
  assert.equal(coordination.length, 1);
  const receipt = coordination[0], witness = receipt.learned_preparation;
  assert.equal(receipt.rule, 'retained_learned_preparation_before_unlearned_invitation');
  assert.equal(receipt.preferred_proposal_id, proposal.proposal_id);
  assert.match(receipt.deferred_proposal_id, /^animated-contact:/);
  assert.equal(receipt.guard_reason, 'public_occurrence_bound');
  assert.equal(receipt.source_state_ref, 'family_state:public_occurrence_recall');
  assert.equal(witness.status, 'conditional_acquired_preparation');
  assert.equal(witness.kind, 'occurrence_correspondence');
  assert.equal(witness.observation_ref, plan.observation_ref);
  assert.equal(witness.model_ids.length, 4);
  assert.equal(new Set(witness.model_ids).size, 4);
  assert.equal(witness.evidence_refs.length, 5,
    'Four adjacent public transitions share endpoints and are shared by all four hypotheses');
  assert.equal(new Set(witness.evidence_refs).size, 5);
  assert.deepEqual(witness.evidence_refs, [3, 4, 5, 6, 7].map(revision =>
    retained.events.find((event: R) => event.kind === 'occurrence_recall_transition'
      && event.evidence[1].includes(`:revision:${revision}:`)).evidence[1]));
  assert.equal(receipt.scope, 'Native coordination extension; conditional learned preparation, not an original Python selection rule.');
  assert.equal(result.snapshot.actions, 6);
  assert.equal((result.snapshot.caller as R).acquiredTransitions, 6);
  assert.deepEqual(family.state(), retained, 'Lookahead and witness construction acquire no observation or working-state mutation');
  const graph = runtime.inspectKnowledge();
  const read = (id: string): R => hydrateNativeState(graph.nodes[id]!.value, key => graph.nodes[key]!.value) as R;
  assert.equal(receipt.source_state_revision, graph.nodes[receipt.source_state_ref]!.revision);
  assert.deepEqual(read(receipt.source_state_ref), retained);
  assert.deepEqual(read('family_state:animated_contact').events, [], 'A deferred invitation has no synthetic return');
});

test('the same current raster without acquired recall evidence retains invitation priority', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const observation = { ...publicPacket(6), step_index: 0 };
  const result = await runtime.initialize({ sessionId: 'anonymous-cold-current-raster', observation,
    budgets: { targetLevels: 1, levelActionCaps: [40], maxActions: 40 } }, execution);
  assert.equal(result.kind, 'action', result.reason);
  assert.equal(result.snapshot.lastDecision, 'animated_contact');
  const proposal = result.snapshot.proposal as R;
  assert.equal(proposal.animated_contact_plan.mode, 'invitation');
  assert.equal(proposal.strategy_receipt.native_coordination, undefined);
  assert.deepEqual(normalized(result.command!), { action_ref: 'ACTION6', data: { x: 37, y: 13 } });
  assert.equal(result.snapshot.actions, 0);
});

test('a veto by the current recall guard preserves the unlearned invitation and acquires nothing', async context => {
  const { runtime, family } = await coldPrefix('anonymous-correspondence-guard-veto');
  const retained = family.state(), original = family.before.bind(family);
  let vetoes = 0;
  context.mock.method(family, 'before', (...args: Parameters<NativeFamily['before']>) => {
    if (args[0].kind === 'public_occurrence_recall') {
      vetoes++; return { admitted: false, reason: 'controlled_current_occurrence_changed' };
    }
    return original(...args);
  });
  const result = await runtime.resume(execution);
  assert.equal(vetoes, 1);
  assert.equal(result.kind, 'action', result.reason);
  assert.equal(result.snapshot.lastDecision, 'animated_contact');
  assert.equal((result.snapshot.proposal as R).animated_contact_plan.mode, 'invitation');
  assert.equal((result.snapshot.proposal as R).strategy_receipt.native_coordination, undefined);
  assert.deepEqual(normalized(result.command!), { action_ref: 'ACTION6', data: { x: 37, y: 13 } });
  assert.deepEqual(family.state(), retained);
  assert.equal(result.snapshot.actions, 6);
  assert.equal((result.snapshot.caller as R).acquiredTransitions, 6);
});

test('an earlier unlearned window proposal cannot borrow priority from the later learned recall', async context => {
  const { runtime, family } = await coldPrefix('anonymous-earlier-unlearned-window');
  const retained = family.state(), original = family.proposeInSubquestion!.bind(family), calls: string[] = [];
  // A controlled, never-executed proposal isolates declaration order. It is
  // not a real cell model or a claimed physical observation, and it supplies
  // no candidate action. The later genuine recall remains fully acquired.
  const unsupported = { status: 'proposed', kind: 'controlled_unlearned_preparation',
    proposal_id: 'controlled-first-window-choice', actions: [], steps: [] } as NativeProposal;
  context.mock.method(family, 'proposeInSubquestion', (...args: Parameters<NonNullable<NativeFamily['proposeInSubquestion']>>) => {
    if (args[0] === 'window_constraints') {
      calls.push(args[1]);
      if (args[1] === 'cell_patch_composition') return unsupported;
    }
    return original(...args);
  });
  const result = await runtime.resume(execution);
  assert.deepEqual(calls, ['occluded_catalogue_composition', 'queued_field_composition', 'product_panel_composition', 'labeled_sequence_composition', 'linked_packet_composition', 'trace_field_composition', 'cell_patch_composition'], 'No later candidate may lend evidence to the earlier choice');
  assert.equal(result.kind, 'action', result.reason);
  assert.equal(result.snapshot.lastDecision, 'animated_contact');
  assert.equal((result.snapshot.proposal as R).animated_contact_plan.mode, 'invitation');
  assert.equal((result.snapshot.proposal as R).strategy_receipt.native_coordination, undefined);
  assert.deepEqual(normalized(result.command!), { action_ref: 'ACTION6', data: { x: 37, y: 13 } });
  assert.deepEqual(family.state(), retained);
  assert.equal(result.snapshot.actions, 6);
  assert.equal((result.snapshot.caller as R).acquiredTransitions, 6);
});

test('recall proof is derived from qualified retained models, including the exclusion of refuted rivals', async () => {
  const { family, memory, proposal, observation } = await acquiredRecall();
  const state = family.state(), plan = (proposal as R).occurrence_recall_plan;
  assert.equal(plan.supporting_models.length, 4);
  for (const key of plan.supporting_models) {
    assert.equal(memory.recallModels[key].unique_support, 4);
    assert.equal(memory.recallModels[key].evidence.length, 4);
    assert.deepEqual(memory.recallModels[key].counterexamples, []);
  }
  for (const comparison of policy.comparison_families) {
    assert.equal(memory.recallModels[`plural_antecedent:previous_chosen:${comparison}`].counterexamples.length, 4);
  }
  const witness = sharedLearnedPreparationWitness(memory, policy, proposal, observation);
  assert.ok(witness, 'Rejected rival hypotheses do not veto the remaining source-qualified agreement');
  assert.equal(witness.model_ids.length, 4);
  assert.equal(witness.evidence_refs.length, 5);
  assert.deepEqual(family.state(), state);
  assert.equal(sharedLearnedPreparationWitness(new OccurrenceRecallAccess(), policy, proposal, observation), null,
    'A genuine old proposal does not create its own learned state in a new memory');
});

for (const change of [
  { id: 'no retained models', apply: (memory: OccurrenceRecallAccess) => { memory.recallModels = {}; } },
  { id: 'threshold not reached', apply: (memory: OccurrenceRecallAccess) => {
    for (const model of Object.values(memory.recallModels) as R[]) model.unique_support = 1;
  } },
  { id: 'counts without acquired evidence', apply: (memory: OccurrenceRecallAccess) => {
    for (const model of Object.values(memory.recallModels) as R[]) model.evidence = [];
  } },
  { id: 'counterexamples on every supported hypothesis', apply: (memory: OccurrenceRecallAccess) => {
    for (const model of Object.values(memory.recallModels) as R[]) model.counterexamples = [['observed-before', 'observed-restoration']];
  } },
  { id: 'old memory epoch', apply: (memory: OccurrenceRecallAccess) => { memory.recallEpoch = 0; } },
  { id: 'missing active antecedent', apply: (memory: OccurrenceRecallAccess) => { memory.recallContext = null; } },
]) test(`retained recall priority refuses ${change.id}`, async () => {
  const { memory, proposal, observation } = await acquiredRecall();
  change.apply(memory);
  assert.equal(sharedLearnedPreparationWitness(memory, policy, proposal, observation), null);
});

for (const change of [
  { id: 'proposal observation', apply: (plan: R) => { plan.observation_ref = 'earlier-observation'; } },
  { id: 'proposal epoch', apply: (plan: R) => { plan.epoch++; } },
  { id: 'antecedent', apply: (plan: R) => { plan.context.chosen = 'unobserved-choice'; } },
  { id: 'source policy', apply: (plan: R) => { plan.configuration.minimum_unique_observations.plural_antecedent = 1; } },
  { id: 'selected occurrence', apply: (plan: R) => { plan.selected = { ...plan.selected, id: 'unmeasured-occurrence' }; } },
  { id: 'supporting model list', apply: (plan: R) => { plan.supporting_models = ['fabricated-support']; } },
  { id: 'emphasis instead of retained correspondence', apply: (plan: R) => { plan.selection_reason = 'test_observed_enclosing_emphasis'; } },
]) test(`retained recall priority refuses a changed ${change.id}`, async () => {
  const { memory, proposal, observation } = await acquiredRecall();
  change.apply((proposal as R).occurrence_recall_plan);
  assert.equal(sharedLearnedPreparationWitness(memory, policy, proposal, observation), null);
});

test('a competing qualified current prediction vetoes priority even if proposal diagnostics claim agreement', async () => {
  const { memory, proposal, observation } = await acquiredRecall(), plan = (proposal as R).occurrence_recall_plan;
  // Controlled symbolic disagreement: retain the actual current measurements,
  // but make a different antecedent relation predict the other visible shape.
  // This is a witness-refusal test, not a claimed physical game transition.
  const other = plan.scene.occurrences.find((part: R) => part.id !== plan.selected.id);
  const chosen = memory.recallContext!.previous.occurrences.find((part: R) => part.id === memory.recallContext!.chosen);
  chosen.shape = other.shape; chosen.color = other.color;
  plan.context = copy(memory.recallContext);
  for (const comparison of policy.comparison_families) {
    const key = `plural_antecedent:previous_chosen:${comparison}`;
    memory.recallModels[key] = { unique_support: 4, evidence: copy(memory.recallModels[plan.supporting_models[0]].evidence), counterexamples: [] };
    assert.deepEqual(occurrenceCandidates(plan.scene, memory.recallContext, memory.recallSeen, 'previous_chosen', comparison), [other.id]);
  }
  plan.predictions = plan.predictions.map((prediction: R) => ({ ...prediction, candidates: [plan.selected.id], unique_support: 999, counterexamples: 0 }));
  assert.equal(sharedLearnedPreparationWitness(memory, policy, proposal, observation), null,
    'The witness recomputes current candidates from retained hypotheses rather than trusting the proposal diagnostics');
});

test('learned occurrence priority is independent of palette names, horizontal position and session identity', async () => {
  const family = new OccurrenceRecallConstraint(policy), current: R[] = [];
  for (let index = 0; index <= 6; index++) {
    const packet = publicPacket(index);
    // A bijection and horizontal reflection preserve exact-mask relations.
    // They create a public synthetic experiment, without a game identifier.
    const transform = (rows: readonly (readonly number[])[]) => rows.map(row => [...row].reverse().map(color => (color + 5) % 16));
    const changed = { ...packet, frame_rows: transform(packet.frame_rows), frame_packet: packet.frame_packet.map(transform) };
    const observation = await measureNativeObservation(changed, index + 1, 'unrelated-observation-series');
    current.push({ packet: changed, observation });
    if (index === 0) continue;
    const before = current[index - 1]!, after = current[index]!;
    const proposal = await family.propose(before.observation, before.packet.frame_rows, [], 600);
    assert.ok(proposal);
    const expected = sourceProposals[index - 1].occurrence_recall_plan.selected;
    const selected = proposal.occurrence_recall_plan.selected;
    assert.deepEqual(selected.bbox, [63 - expected.bbox[2], expected.bbox[1], 63 - expected.bbox[0], expected.bbox[3]]);
    assert.equal(selected.color, (expected.color + 5) % 16);
    // The source breaks equal-distance point ties lexicographically, so the
    // reflected occurrence, rather than a reflected tie-break, is invariant.
    assert.equal(before.packet.frame_rows[selected.point[1]][selected.point[0]], selected.color);
    family.record(before.observation, after.observation, proposal.actions[0], before.packet.frame_rows, after.packet.frame_rows,
      proposal, 0, after.packet.frame_packet);
  }
  const view = current[6]!, proposal = await family.propose(view.observation, view.packet.frame_rows, [], 600) as NativeProposal;
  assert.ok(proposal);
  assert.deepEqual(proposal.actions[0]!.data, { x: 48, y: 35 });
  const witness = sharedLearnedPreparationWitness(family.memory, policy, proposal, view.observation);
  assert.ok(witness);
  assert.equal(witness.kind, 'occurrence_correspondence');
  assert.equal(witness.model_ids.length, 4);
  assert.equal(witness.evidence_refs.length, 5);
  assert.ok(witness.evidence_refs.every(reference => reference.startsWith('unrelated-observation-series:')));
});
