import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily, NativeObservation, NativeProposal, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { RadialPortMemory } from '../src/logos-engine/v6-radial-port-access.ts';
import type { RadialPortState } from '../src/logos-engine/v6-radial-port-access.ts';
import { radialLearnedPreparationWitness } from '../src/logos-engine/v6-learned-preparation.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const normalized = (command: R): R => ({ action_ref: command.action_ref, data: command.data ?? {} });
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const trace = JSON.parse(gunzipSync(await readFile(new URL('../docs/migration/native-campaigns-v41/diagnostics/pipe-first-public.json.gz', import.meta.url))).toString());
const secondTrace = JSON.parse(gunzipSync(await readFile(new URL('../docs/migration/native-campaigns-v41/diagnostics/pipe-second-public.json.gz', import.meta.url))).toString());
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };

// Offline replay of actually recorded public returns. No game engine,
// private state, selected family, learned rule or expected command enters the
// caller. The expected commands only check the choice before its return is fed.
async function coldPrefix(sessionId: string, recorded = trace, count = 6) {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const family = (runtime as unknown as { families: NativeFamily[] }).families
    .find(candidate => candidate.id === 'public_occurrence_recall')!;
  assert.ok(family.learnedPreparationWitness);
  assert.deepEqual((family.state() as R).events, []);
  let result = await runtime.initialize({ sessionId, observation: copy(recorded.packets[0].packet) as NativePublicObservation,
    budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600], maxActions: 1800 } }, execution);
  for (let index = 0; index < count; index++) {
    assert.equal(result.kind, 'action', result.reason ?? `Missing recorded choice ${index + 1}`);
    assert.equal(result.snapshot.lastDecision, family.id);
    assert.equal((result.snapshot.proposal as R).kind, 'radial_port_composition');
    assert.deepEqual(normalized(result.command!), normalized(recorded.packets[index + 1].command));
    assert.ok(result.authorization, 'Every recorded choice passes the ordinary WHY/ACT gate');
    assert.equal((result.snapshot.whyAct as R).decision.decision.status, 'action_set_released');
    result = await runtime.advance({ command: result.command!, executionMs: 0,
      observation: copy(recorded.packets[index + 1].packet) as NativePublicObservation }, execution);
    assert.equal(result.kind, 'boundary', result.reason);
    assert.equal(result.snapshot.actions, index + 1);
    assert.equal((result.snapshot.caller as R).acquiredTransitions, index + 1);
    assert.deepEqual((result.snapshot.whyAct as R).analysis.map((row: R) => row.operation), ['OP29', 'OP30', 'OP31']);
    if (index < count - 1) result = await runtime.resume(execution);
  }
  return { runtime, family, result };
}

function radialState(events: R[]): RadialPortState {
  const memory = new RadialPortMemory();
  for (const event of events) if (['radial_port_effect', 'radial_method_recall'].includes(event.kind)) memory.applyEvent(copy(event));
  return memory.currentState();
}

// Pure falsification cases below copy the journal acquired by the real cold
// caller. They never restore an imported learned state into a running agent.
let acquired: Promise<{ state: RadialPortState; proposal: NativeProposal; observation: NativeObservation }> | undefined;
async function acquiredWitness() {
  acquired ??= (async () => {
    const { runtime, family } = await coldPrefix('radial-witness-public-acquisition');
    const result = await runtime.resume(execution);
    assert.equal(result.kind, 'action', result.reason);
    const proposal = copy(result.snapshot.proposal!) as NativeProposal;
    assert.equal(proposal.kind, 'radial_port_composition');
    const observation = copy((runtime as unknown as { observation: NativeObservation }).observation);
    const state = radialState((family.state() as R).events);
    assert.ok(radialLearnedPreparationWitness(state, proposal, observation));
    return { state, proposal, observation };
  })();
  return copy(await acquired);
}

async function acquireRevalidation() {
  const { runtime, family, result: boundary } = await coldPrefix('anonymous-radial-new-geometry', secondTrace, 12);
  const retained = family.state() as R, result = await runtime.resume(execution);
  assert.equal(result.kind, 'action', result.reason);
  assert.equal((result.snapshot.proposal as R).kind, 'radial_port_composition');
  const proposal = copy(result.snapshot.proposal!) as NativeProposal;
  const observation = copy((runtime as unknown as { observation: NativeObservation }).observation);
  const state = radialState(retained.events);
  assert.equal(radialLearnedPreparationWitness(state, proposal, observation)?.kind, 'radial_point_method_revalidation');
  return { runtime, family, boundary, result, retained, state, proposal, observation };
}
let revalidation: ReturnType<typeof acquireRevalidation> | undefined;
const acquiredRevalidation = () => revalidation ??= acquireRevalidation();

test('six cold public radial returns retain a measured method and defer the seventh invitation in the real caller', async context => {
  const { runtime, family, result: boundary } = await coldPrefix('anonymous-public-radial-acquisition');
  const retained = family.state() as R;
  assert.equal(boundary.snapshot.levelsCompleted, 1, 'The replay establishes one actual official completion, not three');
  const calls: string[] = [], original = family.proposeInSubquestion!.bind(family);
  context.mock.method(family, 'proposeInSubquestion', (...args: Parameters<NonNullable<NativeFamily['proposeInSubquestion']>>) => {
    if (args[0] === 'window_constraints') calls.push(args[1]);
    return original(...args);
  });
  const result = await runtime.resume(execution);
  assert.equal(result.kind, 'action', result.reason);
  assert.equal(result.snapshot.lastDecision, family.id);
  const proposal = result.snapshot.proposal as R, plan = proposal.radial_port_plan;
  assert.equal(proposal.kind, 'radial_port_composition');
  assert.equal(proposal.field_subquestion, 'radial_port_composition');
  assert.equal(plan.point_method_revalidated, true);
  assert.equal(plan.goal_status, 'closed_connected_acyclic_composition_hypothesis_official_terminal_unknown');
  assert.notDeepEqual(normalized(result.command!), normalized(trace.packets[7].command),
    'The original diagnostic seventh command was the deferred invitation, not this acquired rotation');
  assert.deepEqual(calls, ['occluded_catalogue_composition', 'queued_field_composition', 'product_panel_composition', 'labeled_sequence_composition',
    'linked_packet_composition', 'trace_field_composition', 'cell_patch_composition', 'observed_occurrence_recall',
    'observed_program_composition', 'typed_material_flow', 'radial_port_composition']);
  assert.equal(proposal.strategy_receipt.selected, 'window_constraints');
  assert.deepEqual(proposal.strategy_receipt.visited, ['goal_access', 'window_constraints']);
  assert.ok(result.authorization, 'The learned-method witness does not replace WHY/ACT');
  assert.equal((result.snapshot.whyAct as R).decision.decision.status, 'action_set_released');
  assert.deepEqual((result.snapshot.whyAct as R).decision.decision.model_calls, []);
  assert.deepEqual(proposal.steps[0].point_binding.point, plan.scene.cells[plan.steps[0].cell].point);
  assert.equal(proposal.steps[0].point_binding.observation_ref, plan.observation_ref);
  assert.deepEqual(normalized(result.command!), normalized(plan.steps[0].action));

  const coordination = proposal.strategy_receipt.native_coordination;
  assert.equal(coordination.length, 1);
  const receipt = coordination[0], witness = receipt.learned_preparation, state = radialState(retained.events);
  assert.equal(receipt.rule, 'retained_learned_preparation_before_unlearned_invitation');
  assert.equal(receipt.preferred_proposal_id, proposal.proposal_id);
  assert.match(receipt.deferred_proposal_id, /^animated-contact:/);
  assert.equal(receipt.guard_reason, 'bound_observed_support_and_conditional_ports');
  assert.equal(witness.kind, 'radial_point_method');
  assert.equal(witness.status, 'conditional_acquired_preparation');
  assert.equal(witness.observation_ref, plan.observation_ref);
  assert.equal(witness.model_ids.length, 1);
  assert.match(witness.model_ids[0], /^radial-point-method:/);
  assert.equal(witness.evidence_refs.length, 2);
  assert.equal(new Set(witness.evidence_refs).size, 2);
  assert.deepEqual(witness.evidence_refs, state.port_point_rule!.evidence);
  assert.equal(state.port_point_rule!.epoch, plan.epoch);
  assert.equal(state.port_prior, null, 'No prior action method was imported');
  assert.equal(receipt.source_state_ref, 'family_state:public_occurrence_recall');
  assert.equal(receipt.scope, 'Native coordination extension; conditional learned preparation, not an original Python selection rule.');
  assert.equal(result.snapshot.actions, 6);
  assert.equal((result.snapshot.caller as R).acquiredTransitions, 6);
  assert.deepEqual(family.state(), retained, 'Lookahead and priority acquire neither an action nor a new rule');
  const graph = runtime.inspectKnowledge();
  const read = (id: string): R => hydrateNativeState(graph.nodes[id]!.value, key => graph.nodes[key]!.value) as R;
  assert.equal(receipt.source_state_revision, graph.nodes[receipt.source_state_ref]!.revision);
  assert.deepEqual(read(receipt.source_state_ref), retained, 'The receipt names the actual retained shared graph state');
  assert.deepEqual(read('family_state:animated_contact').events, [], 'The deferred invitation has no fabricated return');
});

test('a current radial guard veto retains invitation priority and acquires nothing', async context => {
  const { runtime, family } = await coldPrefix('anonymous-radial-current-guard-veto');
  const retained = family.state(), original = family.before.bind(family);
  let vetoes = 0;
  context.mock.method(family, 'before', (...args: Parameters<NativeFamily['before']>) => {
    if (args[0].kind === 'radial_port_composition') {
      vetoes++; return { admitted: false, reason: 'controlled_current_radial_geometry_changed' };
    }
    return original(...args);
  });
  const result = await runtime.resume(execution);
  assert.equal(vetoes, 1);
  assert.equal(result.kind, 'action', result.reason);
  assert.equal(result.snapshot.lastDecision, 'animated_contact');
  assert.equal((result.snapshot.proposal as R).animated_contact_plan.mode, 'invitation');
  assert.equal((result.snapshot.proposal as R).strategy_receipt.native_coordination, undefined);
  assert.deepEqual(normalized(result.command!), normalized(trace.packets[7].command));
  assert.deepEqual(family.state(), retained);
  assert.equal(result.snapshot.actions, 6);
  assert.equal((result.snapshot.caller as R).acquiredTransitions, 6);
});

test('a radial proposal and copied or imported rule cannot replace acquired public-effect evidence', async () => {
  const { state, proposal, observation } = await acquiredWitness(), previous = copy(state);
  assert.ok(radialLearnedPreparationWitness(state, proposal, observation));
  assert.deepEqual(state, previous);
  assert.equal(radialLearnedPreparationWitness(new RadialPortMemory().currentState(), proposal, observation), null);
  assert.equal(radialLearnedPreparationWitness({ ...copy(state), port_point_rule: null }, proposal, observation), null);
  assert.equal(radialLearnedPreparationWitness({ ...copy(state), port_events: [] }, proposal, observation), null,
    'A rule-shaped object with no witnessed event cannot grant priority');
  const imported = copy(state);
  imported.port_prior = copy(state.port_point_rule);
  imported.port_events = [{ kind: 'radial_method_recall', method: copy(imported.port_prior) }];
  assert.equal(radialLearnedPreparationWitness(imported, proposal, observation), null,
    'A recalled prior does not create a selected current public response');
});

test('a previously learned radial turn is not priority evidence in a different epoch', async () => {
  const { state, proposal, observation } = await acquiredWitness();
  const oldEpoch = state.port_point_rule!.epoch - 1;
  state.port_point_rule!.epoch = oldEpoch;
  for (const event of state.port_events) if (event.rule) event.rule.epoch = oldEpoch;
  assert.equal(radialLearnedPreparationWitness(state, proposal, observation), null);
});

test('a later radial refutation or rejected context cannot be erased by a retained rule object', async () => {
  const { state, proposal, observation } = await acquiredWitness(), plan = (proposal as R).radial_port_plan;
  const refuted = copy(state);
  refuted.port_events.push({ kind: 'radial_port_effect', rule: null, refuted: true,
    context: plan.context, evidence: [observation.observation_ref, 'controlled-contradictory-return'],
    selection_observed: true, goal_terminal_status: 'unknown' });
  assert.equal(radialLearnedPreparationWitness(refuted, proposal, observation), null,
    'Even an otherwise retained old rule must yield to the later refutation event');
  const rejected = copy(state); rejected.port_rejected.push(plan.context);
  assert.equal(radialLearnedPreparationWitness(rejected, proposal, observation), null);
});

test('radial priority requires one selected public response with two distinct retained observation references', async () => {
  const { state, proposal, observation } = await acquiredWitness();
  const unselected = copy(state), support = unselected.port_events.findLast(event => event.rule)!;
  support.selection_observed = false;
  assert.equal(radialLearnedPreparationWitness(unselected, proposal, observation), null);
  const missing = copy(state), repeated = [observation.observation_ref, observation.observation_ref];
  missing.port_point_rule!.evidence = repeated;
  const event = missing.port_events.findLast(item => item.rule)!;
  event.rule.evidence = repeated; event.evidence = repeated;
  assert.equal(radialLearnedPreparationWitness(missing, proposal, observation), null);
});

test('a contradicted intermediate step cannot borrow a correct first radial rotation', async () => {
  const { state, proposal, observation } = await acquiredWitness();
  const plan = (proposal as R).radial_port_plan;
  assert.ok(plan.steps.length > 1, 'The acquired method offers an actual multi-step conditional prefix');
  const alternatives: { name: string; alter: (value: R) => void }[] = [
    { name: 'later input ports contradict preceding output', alter: value => { value.radial_port_plan.steps[1].ports_before[0] = []; } },
    { name: 'later output contradicts the measured turn', alter: value => { value.radial_port_plan.steps[1].ports_after[0] = []; } },
    { name: 'later action selects a different current point', alter: value => {
      value.radial_port_plan.steps[1].action.data.x++;
      value.actions[1] = copy(value.radial_port_plan.steps[1].action);
    } },
    { name: 'later action reopens unmeasured turn hypotheses', alter: value => { value.radial_port_plan.steps[1].candidate_turns = [0, 1, 2, 3]; } },
  ];
  for (const alternative of alternatives) {
    const changed = copy(proposal) as R; alternative.alter(changed);
    assert.equal(radialLearnedPreparationWitness(state, changed as NativeProposal, observation), null, alternative.name);
  }
});

test('twelve cold public returns permit one source revalidation on the newly measured support, without asserting a current method', async () => {
  const { runtime, family, boundary, result, retained, state, proposal, observation } = await acquiredRevalidation();
  const value = proposal as R, plan = value.radial_port_plan;
  assert.equal(boundary.snapshot.levelsCompleted, 2);
  assert.equal(result.snapshot.actions, 12);
  assert.equal((result.snapshot.caller as R).acquiredTransitions, 12);
  assert.equal(state.port_events.length, 10, 'The two official boundaries did not manufacture a radial effect');
  assert.equal(state.port_point_rule!.epoch, 2);
  assert.equal(plan.epoch, 3);
  assert.notEqual(state.port_point_rule!.geometry_ref, plan.scene.geometry_ref);
  assert.deepEqual(plan.scene.shape, [4, 4]);
  assert.equal(plan.point_method_revalidated, false);
  assert.equal(plan.steps.length, 1);
  assert.equal(value.actions.length, 1);
  assert.equal(value.question.reason, 'test_point_binding_of_recalled_rotation');
  assert.equal(plan.steps[0].prediction_status, 'unconfirmed_point_binding_to_recalled_rotation');
  assert.deepEqual(normalized(result.command!), { action_ref: 'ACTION6', data: { x: 50, y: 10 } });
  assert.notDeepEqual(normalized(result.command!), normalized(secondTrace.packets[13].command),
    'The diagnostic invitation is superseded only by the bounded source revalidation question');
  assert.equal(plan.goal_status, 'closed_connected_acyclic_composition_hypothesis_official_terminal_unknown');
  assert.deepEqual(value.steps[0].point_binding.point, plan.scene.cells[plan.steps[0].cell].point);
  assert.equal(value.steps[0].point_binding.observation_ref, observation.observation_ref);
  assert.ok(result.authorization);
  assert.equal((result.snapshot.whyAct as R).decision.decision.status, 'action_set_released');
  const receipt = value.strategy_receipt.native_coordination[0];
  assert.equal(receipt.rule, 'retained_learned_preparation_before_unlearned_invitation');
  assert.equal(receipt.learned_preparation.kind, 'radial_point_method_revalidation');
  assert.match(receipt.learned_preparation.qualification, /applicability to the current epoch or geometry is unknown/);
  assert.deepEqual(receipt.learned_preparation.evidence_refs, state.port_point_rule!.evidence);
  assert.equal(receipt.guard_reason, 'bound_observed_support_and_conditional_ports');
  assert.deepEqual(family.state(), retained, 'Offering revalidation does not promote the old rule to the current context');
  const graph = runtime.inspectKnowledge();
  assert.equal(receipt.source_state_revision, graph.nodes[receipt.source_state_ref]!.revision);
  assert.deepEqual(hydrateNativeState(graph.nodes[receipt.source_state_ref]!.value, key => graph.nodes[key]!.value), retained);
});

test('radial revalidation refuses absent evidence, future epochs and subsequent refutation', async () => {
  const acquired = await acquiredRevalidation();
  const { state, proposal, observation } = copy({ state: acquired.state, proposal: acquired.proposal, observation: acquired.observation });
  assert.equal(radialLearnedPreparationWitness({ ...copy(state), port_events: [] }, proposal, observation), null);
  const future = copy(state); future.port_point_rule!.epoch = observation.level_epoch + 1;
  future.port_events.findLast(event => event.rule)!.rule.epoch = future.port_point_rule!.epoch;
  assert.equal(radialLearnedPreparationWitness(future, proposal, observation), null);
  const refuted = copy(state);
  refuted.port_events.push({ kind: 'radial_port_effect', rule: null, refuted: true, context: (proposal as R).radial_port_plan.context });
  assert.equal(radialLearnedPreparationWitness(refuted, proposal, observation), null);
});

test('radial revalidation cannot be widened into a multi-action or already-confirmed current prediction', async () => {
  const acquired = await acquiredRevalidation();
  const { state, proposal, observation } = copy({ state: acquired.state, proposal: acquired.proposal, observation: acquired.observation });
  const changes: { name: string; alter: (value: R) => void }[] = [
    { name: 'a second unvalidated action', alter: value => {
      value.radial_port_plan.steps.push(copy(value.radial_port_plan.steps[0]));
      value.actions.push(copy(value.actions[0]));
    } },
    { name: 'false claim of a revalidated current method', alter: value => { value.radial_port_plan.point_method_revalidated = true; } },
    { name: 'ordinary assembly substituted for the revalidation question', alter: value => { value.question.reason = 'conditional_port_assembly'; } },
    { name: 'confirmed status substituted for the unknown binding', alter: value => { value.radial_port_plan.steps[0].prediction_status = 'conditional_point_method'; } },
    { name: 'stale observation binding', alter: value => { value.radial_port_plan.observation_ref = 'controlled-earlier-observation'; } },
    { name: 'unrelated point action', alter: value => {
      value.radial_port_plan.steps[0].action.data.x++;
      value.actions[0] = copy(value.radial_port_plan.steps[0].action);
    } },
    { name: 'a prediction contradicting the retained method', alter: value => { value.radial_port_plan.steps[0].ports_after[0] = []; } },
  ];
  for (const change of changes) {
    const changed = copy(proposal) as R; change.alter(changed);
    assert.equal(radialLearnedPreparationWitness(state, changed as NativeProposal, observation), null, change.name);
  }
});

test('the revalidation question still requires the exact current frame and available point input', async () => {
  const { family, proposal, observation } = await acquiredRevalidation(), retained = family.state();
  const packet = copy(secondTrace.packets[12].packet) as NativePublicObservation;
  assert.equal(family.before(proposal, 0, packet, observation).admitted, true);
  assert.equal(family.before(proposal, 0, { ...packet,
    available_action_refs: packet.available_action_refs.filter(ref => ref !== 'ACTION6') }, observation).admitted, false);
  const rows = copy(packet.frame_rows) as number[][]; rows[0]![0] = rows[0]![0]! + 1;
  assert.equal(family.before(proposal, 0, { ...packet, frame_rows: rows }, observation).admitted, false);
  assert.equal(family.before(proposal, 0, packet, { ...observation, observation_ref: 'controlled-unbound-observation' }).admitted, false);
  assert.deepEqual(family.state(), retained, 'Neither admission nor refusal acquires a current method');
});

test('declared source order registers 67 of 76 entries with all six observed-composition branches', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const coverage = runtime.snapshot().coverage as R, groups = coverage.sourceGroups as R[];
  const configuration = declarations.strategy.declarations[0]!.configuration as R;
  assert.deepEqual(groups.map(group => group.id), configuration.families);
  const windows = groups.find(group => group.id === 'window_constraints')!;
  assert.deepEqual(windows.entryPoints.filter((entry: string | null) => entry !== null),
    ['occluded_catalogue_composition', 'queued_field_composition', 'product_panel_composition', 'labeled_sequence_composition',
      'linked_packet_composition', 'trace_field_composition', 'cell_patch_composition', 'observed_occurrence_recall',
      'observed_program_composition', 'typed_material_flow', 'radial_port_composition', 'observed_framed_analogy',
      'field_service_composition', 'rooted_quota_composition', 'framed_window_composition', 'coupled_prefix_reference', 'relative_arrangement', 'recurrent_series']);
  const radialIndex = windows.entryPoints.indexOf('radial_port_composition');
  assert.equal(windows.families[radialIndex], 'public_occurrence_recall');
  assert.equal(coverage.registeredFamilies.filter((family: string) => family === 'public_occurrence_recall').length, 1);

  // The denominator is the four explicit source lists, not family objects,
  // private game scores, code volume or a claim of complete behavioral parity.
  const aliases: Record<string, string> = {
    scored_relation_access: 'goal_access', observed_support_access: 'support_navigation',
    observed_feedback_sequence: 'feedback_sequences',
    relative_arrangement: 'relative_arrangements',
    window_question: 'public_window_question',
    facet_example: 'facet_examples',
    observed_addressed_material: 'public_addressed_material',
    observed_object_binding: 'public_observed_binding',
    observed_composition_services: 'public_occurrence_recall',
    coupled_support_composition: 'public_occurrence_recall', alternating_graph_composition: 'public_occurrence_recall',
    occluded_catalogue_composition: 'public_occurrence_recall', queued_field_composition: 'public_occurrence_recall',
    linked_packet_composition: 'public_occurrence_recall', trace_field_composition: 'public_occurrence_recall',
    typed_material_flow: 'public_occurrence_recall', field_service_composition: 'public_occurrence_recall',
    framed_window_composition: 'public_occurrence_recall', coupled_prefix_reference: 'public_occurrence_recall', recurrent_series: 'public_occurrence_recall',
    observed_framed_analogy: 'public_framed_transfer', observed_framed_transfer: 'public_framed_transfer',
    observed_outline_service: 'public_outline_service', observed_inventory_composition: 'public_observed_inventory',
    observed_ranked_workshop: 'public_ranked_workshop',
    observed_symbol_transaction: 'public_symbol_transaction',
    reactive_contact: 'public_reactive_contact', reactive_contact_continuation: 'public_reactive_contact',
    ordered_reaction: 'public_ordered_reaction', topological_recolor: 'public_topological_recolor',
    axial_question: 'public_axial_question',
    product_panel_composition: 'public_occurrence_recall', labeled_sequence_composition: 'public_occurrence_recall', cell_patch_composition: 'public_occurrence_recall', observed_program_composition: 'public_occurrence_recall',
    radial_port_composition: 'public_occurrence_recall', rooted_quota_composition: 'public_occurrence_recall', observed_occurrence_recall: 'public_occurrence_recall',
    multiscale_constraints: 'window_constraints', surface_rewrite: 'surface_program', learned_code_program: 'code_program',
    typed_word_interface: 'word_interface', rigid_port_assembly: 'port_assembly',
    controlled_constellation_cover: 'constellation_cover', conserved_band_transfer: 'band_transfer',
    supported_ternary_reduction: 'reduction_transport',
    motif_conditioned_access: 'motif_access',
  };
  const lists: [string, string[]][] = [
    ['goal_access', configuration.goal_access_subquestions],
    ['window_constraints', configuration.window_constraints.ordered_subquestions],
    ['surface', configuration.program_construction.ordered_subquestions],
    ['factored_material_return', configuration.factored_material_return.ordered_subquestions],
  ];
  const counts = lists.map(([id, declared]) => {
    const group = groups.find(item => item.id === id)!;
    const connected = declared.filter(question => {
      // A registered branch is still partial until its declared entry closes.
      if (coverage.partialEntryPoints[question]) return false;
      const family = aliases[question] ?? question;
      const explicitEntry = family === 'public_occurrence_recall' || family === 'public_ranked_workshop' || family === 'public_axial_question' || family === 'public_window_question'
        || family === 'public_symbol_transaction' || family === 'feedback_sequences' || family === 'relative_arrangements'
        || family === 'facet_examples' || family === 'public_addressed_material' || family === 'public_observed_binding' || family === 'preview_packing' || family === 'selected_rigid';
      return group.families.includes(family) && (!explicitEntry
        || group.entryPoints?.some((entry: string | null, index: number) => entry === question && group.families[index] === family));
    });
    return [connected.length, declared.length];
  });
  assert.deepEqual(counts, [[12, 12], [21, 21], [10, 10], [24, 33]]);
  assert.equal(counts.reduce((sum, count) => sum + count[0]!, 0), 67);
  assert.deepEqual(Object.keys(coverage.partialEntryPoints), []);
  assert.equal(coverage.observedCompositionBranches.connectedBranches.length, 6);
  assert.deepEqual(coverage.observedCompositionBranches.pendingBranches, []);
  assert.equal(counts.reduce((sum, count) => sum + count[1]!, 0), 76);
  assert.equal(coverage.fullV6Parity, false);
});
