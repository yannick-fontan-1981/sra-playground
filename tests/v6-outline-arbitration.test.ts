import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { readEvidenceSync } from './helpers/chunked-evidence.ts';
import { NativeCallerCoordinator } from '../src/logos-engine/v6-native-caller.ts';
import { createNativeV6Runtime, NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import { NativeReasoningMemory } from '../src/logos-engine/v6-reasoning-memory.ts';
import { ObservedInputDomain, measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { frontierActionKey, frontierIndex } from '../src/logos-engine/v6-observed-frontier.ts';
import { hydrateNativeState, isNativeStateGraph } from '../src/logos-engine/v6-native-state-graph.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';
import type { NativeCommand, NativeExecution, NativeFamily, NativeObservation, NativeProposal, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const policy = declarations.strategy.declarations[0]!.configuration;
const evidenceRoot = new URL('../docs/migration/native-campaigns-v53/diagnostics/', import.meta.url);
const witnessed = JSON.parse(gunzipSync(await readFile(new URL('original-caller-prefix1/bounded-public-trace.json.gz', evidenceRoot))).toString()) as R;
const secondWitnessed = JSON.parse(gunzipSync(readEvidenceSync(new URL('../docs/migration/native-campaigns-v53/attempt2/esct-public-trace.json.gz', import.meta.url))).toString()) as R;
const originalDecisions = gunzipSync(await readFile(new URL('original-caller-lean1/decisions.jsonl.gz', evidenceRoot))).toString().trim().split('\n').map(line => JSON.parse(line) as R);
const execution: NativeExecution = { now: () => 0, yieldControl: async () => {}, deadlineMs: 360_000 };
const OUTLINE = 'public_outline_service';
const OWNER = `family_state:${OUTLINE}`;
const command = (action_ref: string): NativeCommand => ({ action_ref, data: {} });

function graphValue(runtime: NativeV6Runtime, id: string): R {
  const graph = runtime.inspectKnowledge(), value = graph.nodes[id]!.value;
  return (isNativeStateGraph(value) ? hydrateNativeState(value, key => graph.nodes[key]!.value) : value) as R;
}

function currentParts(runtime: NativeV6Runtime) {
  const inner = runtime as unknown as R;
  return { caller: inner.caller as NativeCallerCoordinator,
    family: (inner.families as NativeFamily[]).find(family => family.id === OUTLINE)!,
    observation: inner.observation as NativeObservation,
    packet: inner.current as NativePublicObservation };
}

/** Actual retained returns only. This is a test replay, not another game.
 * No recorded outcome is supplied unless the production caller has requested
 * its exact corresponding command. The alternative next question never receives
 * a packet, so the test cannot claim its effect, a level or a score. */
async function replayActualReturns(packets: R[], count: number, sessionId: string) {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  try {
    let result = await runtime.initialize({ sessionId,
      observation: copy(packets[0]!.packet),
      budgets: { targetLevels: 3, levelActionCaps: [160, 160, 160], maxActions: 480 } }, execution);
    for (let index = 1; index <= count; index++) {
      assert.equal(result.kind, 'action', `Missing requested command before retained return ${index}: ${result.reason}`);
      const expected = packets[index]!.command;
      assert.equal(result.command!.action_ref, expected.action_ref);
      // The actual public transport adds data:{} to bare discrete commands.
      assert.deepEqual(result.command!.data ?? {}, expected.data ?? {});
      result = await runtime.advance({ command: result.command!, observation: copy(packets[index]!.packet), executionMs: 0 }, execution);
      if (index < count && result.kind === 'boundary') result = await runtime.resume(execution);
    }
    assert.equal(result.kind, 'boundary', 'The last supplied observed return closes its one-action question');
    assert.equal(result.snapshot.actions, count); assert.equal(result.snapshot.levelsCompleted, 0);
    assert.equal((result.snapshot.caller as R).acquiredTransitions, count);
    return { runtime, boundary: result, ...currentParts(runtime) };
  } catch (error) { runtime.close('outline_public_replay_setup_failed'); throw error; }
}

const replayEightActualReturns = () => replayActualReturns(witnessed.packets, 8, 'outline-current-service-public-contract');

test('eleven actual public returns preserve the dispatched service and ground one obstructing-inset operator question without an invented twelfth return', async () => {
  const { runtime, family, observation } = await replayActualReturns(secondWitnessed.packets, 11, 'outline-public-announcement-contract');
  try {
    const graphBefore = runtime.inspectKnowledge(), stateBefore = graphValue(runtime, OWNER);
    assert.equal(stateBefore.format, 'native.public_outline_service.v2');
    const previous = stateBefore.public_transition;
    assert.equal(previous.after.observation_ref, observation.observation_ref);
    assert.equal(previous.after.revision, observation.revision);
    assert.equal(previous.before.revision + 1, previous.after.revision);
    assert.equal(previous.before_rows_sha256, symbolicDigest(secondWitnessed.packets[10].packet.frame_rows));
    assert.equal(previous.after_rows_sha256, symbolicDigest(secondWitnessed.packets[11].packet.frame_rows));
    assert.equal(previous.source_state_ref, `outline_source:${symbolicDigest(stateBefore.source_state)}`);
    assert.equal(previous.selected_outline.active_goal_ref, 'goal.accompany_mobile_entity_to_compatible_hollow_perimeter');
    assert.equal(previous.selected_outline.guard_admitted, true);
    assert.equal(previous.selected_outline.observation_ref, previous.before.observation_ref);
    assert.deepEqual(previous.selected_outline.command, previous.command);
    const local = stateBefore.source_state.methods.filter((event: R) => event.status === 'observed_local_change'
      && event.scope === observation.level_epoch && event.local_count > 0).at(-1);
    assert.ok(local, 'The operator must have an actual same-epoch local effect receipt');
    let guards = 0, bindings = 0;
    const before = family.before.bind(family), bind = family.bind?.bind(family);
    family.before = async (...args) => { guards++; return before(...args); };
    if (bind) family.bind = async (...args) => { bindings++; return bind(...args); };
    const result = await runtime.resume(execution), proposal = result.snapshot.proposal as R;
    assert.equal(result.kind, 'action', result.reason);
    assert.equal(result.snapshot.lastDecision, OUTLINE);
    assert.equal(result.command!.action_ref, local.action.action_ref);
    assert.notEqual(result.command!.action_ref, secondWitnessed.packets[12].command.action_ref,
      'The old twelfth outcome is deliberately not supplied to this different current question');
    assert.equal(proposal.requires_current_service_witness, true);
    assert.equal(proposal.native_outline_public_context.kind, 'obstructing_inset_operator');
    assert.equal(proposal.actions.length, 1); assert.equal(proposal.steps.length, 1);
    assert.equal(proposal.steps[0].expected_after, null); assert.equal(proposal.steps[0].seal_after, true);
    assert.equal(proposal.bundle_template.operation_key, 'OP18');
    assert.equal(proposal.compositions[0].observed, false);
    const admission = proposal.native_current_service_admission, witness = proposal.native_current_service_witness;
    assert.equal(admission.rule, 'current_required_service_witness_on_every_selection_path');
    assert.equal(admission.release_authority, false);
    assert.equal(admission.source_state_revision, graphBefore.nodes[OWNER]!.revision);
    assert.equal(witness.status, 'current_required_service');
    assert.equal(witness.release_authority, false); assert.equal(witness.primitive_bound, 1);
    assert.equal(witness.replan_after_each_primitive, true);
    assert.equal(witness.current_trial.observation_ref, observation.observation_ref);
    assert.equal(witness.current_trial.action_key, await frontierActionKey(result.command!));
    assert.equal(witness.current_trial.prior_trial_count, 0);
    const effects = witness.current_trial.effectful_action_context;
    assert.equal(effects.domain_complete, true); assert.equal(effects.v5_producer_parity, false);
    assert.ok(effects.known_effectful_action_refs.includes(local.action.action_ref));
    assert.ok(JSON.stringify(witness).includes('tier.current_tool_on_obstructing_other_inset_operator_question'));
    assert.ok(guards >= 3, 'Priority, final admission and action authorization retain their own current guard');
    assert.equal(bindings, 1); assert.ok(result.authorization);
    assert.equal((result.snapshot.whyAct as R).decision.decision.status, 'action_set_released');
    assert.deepEqual(graphValue(runtime, OWNER), stateBefore, 'The previous actual return remains immutable; proposing does not acquire an operator effect');
    assert.equal(result.snapshot.actions, 11); assert.equal(result.snapshot.levelsCompleted, 0);
    assert.equal((result.snapshot.caller as R).acquiredTransitions, 11);
    assert.equal(runtime.inspectKnowledge().nodes['reasoning:transition:12'], undefined);
  } finally { runtime.close('outline_public_announcement_question_contract_complete'); }
});

test('the actual common caller replays eight witnessed returns then retains a single current service before an unknown contact question', async () => {
  const { runtime, family, caller, observation, packet } = await replayEightActualReturns();
  try {
    const sourceAtNine = originalDecisions[8]!;
    assert.equal(sourceAtNine.matchedPublicReturnsBeforeRequest, 8);
    assert.equal(sourceAtNine.proposal.strategy_receipt.selected, 'pre_score_contact');
    assert.equal(sourceAtNine.command.actionRef, witnessed.packets[9].command.action_ref);
    const graphBefore = runtime.inspectKnowledge(), stateBefore = graphValue(runtime, OWNER);
    assert.equal(stateBefore.source_state.methods.at(-1).status, 'observed_local_change');
    assert.equal(stateBefore.source_state.methods.at(-1).local_count, 4);
    assert.equal(stateBefore.source_state.methods.at(-1).remote_change_count, 62, 'Retain the exact original counter semantics, including its documented variable shadowing');
    const acquiredBefore = caller.state(); let guarded = 0, bound = 0;
    const before = family.before.bind(family), bind = family.bind?.bind(family);
    family.before = async (...args) => { guarded++; return before(...args); };
    if (bind) family.bind = async (...args) => { bound++; return bind(...args); };
    const result = await runtime.resume(execution), proposal = result.snapshot.proposal as R;
    assert.equal(result.kind, 'action', result.reason);
    assert.equal(result.snapshot.lastDecision, OUTLINE);
    assert.equal(result.command!.action_ref, 'ACTION4', 'The remeasured accompaniment supplies its current direction');
    assert.notEqual(result.command!.action_ref, sourceAtNine.command.actionRef, 'This priority is an explicit native extension, not original caller parity');
    assert.equal(proposal.actions.length, 1); assert.equal(proposal.steps.length, 1);
    assert.equal(proposal.material_access_subquestion, 'observed_outline_service');
    assert.equal(proposal.bundle_template.operation_key, 'OP18');
    assert.equal(proposal.compositions[0].observed, false);
    assert.equal(guarded, 2, 'The priority guard and ordinary authorization guard both run');
    assert.equal(bound, 1, 'Ordinary binding remains required');
    const [receipt] = proposal.strategy_receipt.native_coordination;
    assert.equal(receipt.rule, 'v5_current_required_service_before_independent_contact_question');
    assert.equal(receipt.source_trigger_group, 'pre_score_contact');
    assert.equal(receipt.selected_group, 'factored_material_return');
    assert.equal(receipt.preferred_family, OUTLINE);
    assert.equal(receipt.deferred_family, 'pre_score_contact');
    assert.equal(receipt.physical_action_authorized, false);
    assert.equal(receipt.primitive_bound, 1); assert.equal(receipt.replan_after_each_primitive, true);
    assert.equal(receipt.source_state_revision, graphBefore.nodes[OWNER]!.revision);
    assert.equal(receipt.current_required_service.status, 'current_required_service');
    const trial = receipt.current_required_service.current_trial;
    assert.equal(trial.status, 'untried_exact_public_context');
    assert.equal(trial.observation_ref, observation.observation_ref);
    assert.equal(trial.context_index, await frontierIndex(observation));
    assert.equal(trial.action_key, await frontierActionKey(result.command!));
    assert.equal(trial.prior_trial_count, 0); assert.deepEqual(trial.prior_transition_refs, []);
    assert.equal(trial.v5_caller_context_parity, false);
    assert.equal(trial.source_state_ref, 'caller:frontier');
    assert.equal(trial.source_state_revision, graphBefore.nodes['caller:frontier']!.revision);
    assert.deepEqual(trial.protocol.available_action_refs, [...packet.available_action_refs].sort());
    assert.equal(receipt.independent_unknown_effect_question.effect_status, 'unobserved');
    assert.deepEqual(receipt.independent_unknown_effect_question.contact_evidence, []);
    assert.ok(result.authorization, 'A coordination witness cannot release an action by itself');
    assert.equal((result.snapshot.whyAct as R).decision.decision.status, 'action_set_released');
    assert.deepEqual(graphValue(runtime, OWNER), stateBefore, 'Selecting a question acquires no hypothetical return');
    assert.deepEqual(caller.state().frontier.nodes[trial.context_index].attempts,
      acquiredBefore.frontier.nodes[trial.context_index].attempts);
    assert.equal(result.snapshot.actions, 8); assert.equal(result.snapshot.levelsCompleted, 0);
    assert.equal((result.snapshot.caller as R).acquiredTransitions, 8);
    assert.equal(runtime.inspectKnowledge().nodes['reasoning:transition:9'], undefined, 'No ninth outcome was supplied');
  } finally { runtime.close('outline_current_service_contract_complete'); }
});

for (const mode of ['source_guard_refused', 'family_disabled', 'witness_absent'] as const) {
  test(`current-service arbitration keeps original contact priority when ${mode}`, async () => {
    const { runtime, family } = await replayEightActualReturns();
    try {
      const state = graphValue(runtime, OWNER);
      if (mode === 'source_guard_refused') family.before = () => ({ admitted: false, reason: 'controlled_current_guard_refusal' });
      if (mode === 'witness_absent') delete family.currentRequiredServiceWitness;
      if (mode === 'family_disabled') await runtime.edit({ expectedGraphChain: runtime.inspectKnowledge().chain!,
        reason: 'Controlled Kernel test disables the family at a sealed boundary',
        changes: [{ type: 'set_family_enabled', familyId: OUTLINE, enabled: false }] }, execution);
      const result = await runtime.resume(execution), proposal = result.snapshot.proposal as R;
      assert.equal(result.kind, 'action', result.reason);
      assert.equal(result.snapshot.lastDecision, 'pre_score_contact');
      assert.equal(result.command!.action_ref, originalDecisions[8]!.command.actionRef);
      assert.equal(proposal.strategy_receipt.native_coordination, undefined);
      assert.deepEqual(graphValue(runtime, OWNER), state);
      assert.equal(result.snapshot.actions, 8); assert.equal(result.snapshot.levelsCompleted, 0);
    } finally { runtime.close(`outline_${mode}_contract_complete`); }
  });
}

function syntheticPacket(step = 0, changed = false): NativePublicObservation {
  const rows = Array.from({ length: 6 }, () => Array<number>(6).fill(1));
  rows[2]![2] = changed ? 3 : 2;
  return { frame_rows: rows, frame_packet: [rows], frame_hash: symbolicDigest(rows).slice(0, 16),
    available_action_refs: ['ACTION1', 'ACTION2'], level: 1, levels_completed: 0, state: 'NOT_FINISHED', step_index: step };
}

async function syntheticCaller() {
  const memory = new NativeReasoningMemory({ clock: () => 0 });
  const caller = new NativeCallerCoordinator(memory, { targetLevels: 3, domain: new ObservedInputDomain(64),
    strategy: policy, informationGoal: 'open_questions' });
  const packet = syntheticPacket();
  const observation = await measureNativeObservation(packet, 1, 'controlled-public-trial') as NativeObservation;
  await caller.initialize(observation);
  return { caller, memory, packet, observation };
}

test('the trial witness requires a real current admitted occurrence and returns a detached exact public scope', async () => {
  const { caller, memory, observation } = await syntheticCaller();
  try {
    const state = caller.state(), witness = await caller.currentUntriedServiceTrial(observation, command('ACTION1'));
    assert.ok(witness);
    assert.equal(witness.status, 'untried_exact_public_context');
    assert.equal(witness.context_projection, 'v6.frontierProtocol');
    assert.equal(witness.v5_caller_context_parity, false);
    assert.equal(witness.attempted_without_effect_in_current_context, false);
    assert.deepEqual(witness.evidence_refs, [observation.observation_ref]);
    assert.equal(witness.source_frontier_chain, caller.frontier.chain);
    assert.equal(witness.source_frontier_sequence, caller.frontier.sequence);
    assert.equal(witness.domain_complete, true);
    const effects = witness.effectful_action_context as R;
    assert.equal(effects.status, 'observed_effectful_action_inventory');
    assert.equal(effects.domain_complete, true); assert.equal(effects.v5_producer_parity, false);
    assert.deepEqual(effects.known_effectful_action_refs, []);
    assert.equal(effects.considered_transition_count, 0);
    assert.equal(effects.level_start_checkpoint_action_ref, null, 'No admitted public role identifies a checkpoint input');
    assert.equal(await caller.currentUntriedServiceTrial({ ...observation, observation_ref: 'not-observed' }, command('ACTION1')), null);
    assert.equal(await caller.currentUntriedServiceTrial(observation, command('ACTION3')), null);
    assert.equal(await caller.currentUntriedServiceTrial(observation, { action_ref: 'ACTION1', data: { x: 2, y: 2 } }), null);
    witness.protocol.available_action_refs.length = 0; witness.command.action_ref = 'forged'; witness.evidence_refs.length = 0;
    assert.deepEqual(caller.state(), state, 'Read-only witness mutations cannot change the retained frontier or its action domain');
  } finally { memory.close(); }
});

test('public trial scope is explicitly revalidated across every protocol field, without inventing V5 context equivalence', async () => {
  const { caller, memory, observation } = await syntheticCaller();
  try {
    const variants = [{ frame_hash: 'another-raster' }, { level_epoch: 2 }, { levels_completed: 1 },
      { state: 'ANOTHER_PUBLIC_STATE' }, { available_action_refs: ['ACTION1'] }];
    for (const [index, changed] of variants.entries()) {
      const stale = { ...observation, ...changed } as NativeObservation;
      assert.equal(await caller.currentUntriedServiceTrial(stale, command('ACTION1')), null, 'A registered reference cannot silently bind to another public protocol');
      const current = { ...stale, observation_ref: `controlled-scope:${index}`, revision: index + 2 };
      assert.equal(await caller.currentUntriedServiceTrial(current, command('ACTION1')), null, 'A new context has no admitted occurrence before observation');
      await caller.frontier.observe(current, caller.graphInputs(current));
      const witness = await caller.currentUntriedServiceTrial(current, command('ACTION1'));
      assert.ok(witness); assert.equal(witness.v5_caller_context_parity, false);
      assert.notEqual(witness.context_index, await frontierIndex(observation));
    }
    const reordered = { ...observation, available_action_refs: [...observation.available_action_refs].reverse() };
    assert.ok(await caller.currentUntriedServiceTrial(reordered, command('ACTION1')), 'The existing public protocol projection treats action availability as a set');
  } finally { memory.close(); }
});

test('effect inventory reuses one current scan without retaining stale acquisitions, scopes or caller mutations', async () => {
  const { caller, memory, packet, observation } = await syntheticCaller();
  const internal = caller as unknown as R;
  const measure = internal.measureObservedEffectfulActions.bind(caller);
  let scans = 0;
  internal.measureObservedEffectfulActions = (current: NativeObservation) => { scans++; return measure(current); };
  try {
    const cold = caller.state();
    const first = await caller.currentUntriedServiceTrial(observation, command('ACTION1'));
    const repeated = await caller.currentUntriedServiceTrial(observation, command('ACTION2'));
    assert.ok(first && repeated); assert.equal(scans, 1, 'Independent guards share one scan of the unchanged frontier');
    assert.deepEqual(first.effectful_action_context, repeated.effectful_action_context);
    (first.effectful_action_context as R).known_effectful_action_refs.push('forged:input');
    (first.effectful_action_context as R).available_action_refs.length = 0;
    const intact = await caller.currentUntriedServiceTrial(observation, command('ACTION1'));
    assert.deepEqual((intact!.effectful_action_context as R).known_effectful_action_refs, []);
    assert.deepEqual((intact!.effectful_action_context as R).available_action_refs, observation.available_action_refs);
    assert.equal(scans, 1, 'Returned inventory mutation cannot poison the internally owned cache');

    const next = syntheticPacket(1, true);
    const after = await measureNativeObservation(next, 2, 'controlled-public-trial') as NativeObservation;
    await caller.recordAssessment({ before: observation, after, command: command('ACTION1'), first: packet, second: next,
      index: 0, outcome: { matched: null, seal_prefix: true, reason: 'controlled_public_return_unknown_effect' } }, null);
    const changed = await caller.currentUntriedServiceTrial(after, command('ACTION2'));
    assert.deepEqual((changed!.effectful_action_context as R).known_effectful_action_refs, ['ACTION1']);
    assert.equal(scans, 2, 'An actual acquisition invalidates the former empty inventory');
    await caller.currentUntriedServiceTrial(after, command('ACTION1'));
    assert.equal(scans, 2);

    const reordered = { ...after, available_action_refs: [...after.available_action_refs].reverse() };
    const reorderedTrial = await caller.currentUntriedServiceTrial(reordered, command('ACTION2'));
    assert.deepEqual((reorderedTrial!.effectful_action_context as R).available_action_refs, reordered.available_action_refs);
    assert.equal(scans, 3, 'Set-equivalent public availability still retains the exact supplied order in its receipt');

    caller.restore(cold);
    const restored = await caller.currentUntriedServiceTrial(observation, command('ACTION1'));
    assert.deepEqual((restored!.effectful_action_context as R).known_effectful_action_refs, []);
    assert.equal(scans, 4, 'Restoring a different frontier cannot retain effects from its discarded successor');
    await caller.frontier.recordTransition(observation, command('ACTION1'), after,
      { after_action_candidates: caller.graphInputs(after) });
    const acquiredDelta = await caller.currentUntriedServiceTrial(after, command('ACTION2'));
    assert.deepEqual((acquiredDelta!.effectful_action_context as R).known_effectful_action_refs, ['ACTION1']);
    assert.equal(scans, 5, 'A frontier delta also invalidates by sequence and chain without a coordinator callback');

    const other = { ...after, observation_ref: 'controlled-public-trial:other-epoch', level_epoch: 2, revision: 3 };
    await caller.frontier.observe(other, caller.graphInputs(other));
    const scoped = await caller.currentUntriedServiceTrial(other, command('ACTION2'));
    assert.deepEqual((scoped!.effectful_action_context as R).known_effectful_action_refs, []);
    assert.equal((scoped!.effectful_action_context as R).considered_transition_count, 0);
    assert.equal(scans, 6, 'Evidence from one epoch cannot be served by the next current scope');
  } finally { memory.close(); }
});

for (const outcome of ['stationary', 'changed_then_returned', 'transient_then_returned'] as const) {
  test(`a real acquired trial removes this priority for ${outcome}, without classifying the effect`, async () => {
    const { caller, memory, packet, observation } = await syntheticCaller();
    try {
      const next = syntheticPacket(1, outcome === 'changed_then_returned');
      const returned = outcome === 'transient_then_returned'
        ? { ...next, frame_packet: [syntheticPacket(1, true).frame_rows, next.frame_rows] } : next;
      const after = await measureNativeObservation(returned, 2, 'controlled-public-trial') as NativeObservation;
      await caller.recordAssessment({ before: observation, after, command: command('ACTION1'), first: packet, second: returned,
        index: 0, outcome: { matched: null, seal_prefix: true, reason: 'controlled_public_return_unknown_effect' } }, null);
      let current = after;
      if (outcome === 'changed_then_returned') {
        assert.ok(await caller.currentUntriedServiceTrial(after, command('ACTION1')), 'The different current public context has its own exact trial scope');
        const restoredPacket = syntheticPacket(2), restored = await measureNativeObservation(restoredPacket, 3, 'controlled-public-trial') as NativeObservation;
        await caller.recordAssessment({ before: after, after: restored, command: command('ACTION2'), first: returned, second: restoredPacket,
          index: 0, outcome: { matched: null, seal_prefix: true, reason: 'controlled_public_return_unknown_effect' } }, null);
        current = restored;
      }
      assert.equal(await caller.currentUntriedServiceTrial(current, command('ACTION1')), null);
      const node = caller.frontier.nodes[await frontierIndex(current)], attempt = node.attempts[await frontierActionKey(command('ACTION1'))];
      assert.equal(attempt.count, 1); assert.equal(attempt.evidence_refs.length, 1);
      assert.equal(Object.hasOwn(attempt, 'no_effect'), false);
      assert.equal(Object.hasOwn(attempt, 'attempted_without_effect_in_current_context'), false);
      const alternative = await caller.currentUntriedServiceTrial(current, command('ACTION2'));
      assert.ok(alternative, 'Another current untried command can expose the read-only positive-effect inventory');
      const effects = alternative.effectful_action_context as R;
      assert.equal(effects.measurement_domain, 'final_public_raster_change_within_current_epoch_and_score');
      assert.equal(effects.v5_producer_parity, false);
      assert.equal(effects.considered_transition_count, outcome === 'changed_then_returned' ? 2 : 1);
      assert.deepEqual(effects.known_effectful_action_refs, outcome === 'changed_then_returned' ? ['ACTION1', 'ACTION2'] : [],
        'Final-equal returns, including a witnessed transient, are not relabeled as positive or negative effects');
      assert.equal(effects.witnesses.length, outcome === 'changed_then_returned' ? 2 : 0);
      for (const witness of effects.witnesses) {
        assert.notEqual(witness.before_frame_hash, witness.after_frame_hash);
        assert.equal(witness.effect_status, 'observed_final_raster_change');
        assert.ok(witness.transition_refs.length > 0);
      }
      for (const [suffix, patch] of [['other-epoch', { level_epoch: 2 }], ['other-score', { levels_completed: 1 }]] as const) {
        const other = { ...current, ...patch, observation_ref: `controlled-public-trial:${suffix}`, revision: current.revision + 1 };
        await caller.frontier.observe(other, caller.graphInputs(other));
        const scoped = await caller.currentUntriedServiceTrial(other, command('ACTION1'));
        assert.ok(scoped); assert.deepEqual((scoped.effectful_action_context as R).known_effectful_action_refs, []);
        assert.equal((scoped.effectful_action_context as R).considered_transition_count, 0,
          'Observed effects are not promoted into a different current epoch or score');
      }
    } finally { memory.close(); }
  });
}

test('the deferred contact witness uses the actual source initial question and rejects learned or stale effect premises', async () => {
  const { caller, memory } = await syntheticCaller();
  try {
    const row = originalDecisions[8]!, proposal = copy(row.proposal), observation = row.observation as NativeObservation;
    const witness = caller.unacquiredInquiryWitness(proposal, observation);
    assert.ok(witness); assert.equal(witness.status, 'unknown_effect_inquiry_with_measured_access');
    assert.equal(witness.effect_status, 'unobserved'); assert.equal(witness.terminal_role, 'unknown');
    assert.deepEqual(witness.contact_evidence, []); assert.ok(witness.control_evidence.length > 0);
    assert.equal(witness.physical_action_authorized, false);
    for (const patch of [{ observation_ref: 'stale' }, { epoch: observation.level_epoch + 1 },
      { score: observation.levels_completed + 1 }, { initial_contact_acquisition: false },
      { observed_nonlocal_contact_count: 1 }, { contact_evidence: ['acquired-contact'] },
      { remote_effect_families: ['acquired-effect'] }, { remote_change_evidence: ['observed-remote'] },
      { control_surface_evidence: [] }, { prefix: [{ effect: 'conditional_translation' }] }]) {
      const altered = copy(proposal); Object.assign(altered.effect_plan, patch);
      assert.equal(caller.unacquiredInquiryWitness(altered, observation), null);
    }
    assert.deepEqual(row.proposal, proposal);
  } finally { memory.close(); }
});

type OrdinaryGateMode = 'admitted' | 'prior_trial' | 'witness_absent' | 'witness_stale' | 'witness_hook_absent' | 'source_guard_refused' | 'witness_revoked_before_bind';

/** A deliberately synthetic provider contract, with no game or acquired effect.
 * It isolates ordinary selection from preemption while retaining the real
 * common caller, acquired public frontier, graph, binding and WHY/ACT gate.
 * The provider attests only this test's current question. It cannot replace the
 * caller's trial witness, which must be supplied by the actual runtime. */
function ordinaryGateFixture(mode: OrdinaryGateMode) {
  let recorded = 0;
  const calls = { witness: 0, before: 0, bind: 0 };
  const id = 'controlled_current_service_contract';
  const family: NativeFamily = {
    id,
    state: () => ({ schema: 'controlled-current-service-contract', recorded }),
    restore: state => {
      assert.equal(state.schema, 'controlled-current-service-contract');
      assert.ok(Number.isSafeInteger(state.recorded) && Number(state.recorded) >= 0);
      recorded = Number(state.recorded);
    },
    propose: observation => {
      const action = command('ACTION1'), focus = `controlled-question:${observation.observation_ref}`;
      const facts = { current_controlled_public_question: true };
      return { status: 'proposed', kind: 'controlled_current_service_question',
        requires_current_service_witness: mode !== 'prior_trial' || recorded > 0,
        actions: [action], steps: [{ action, expected_after: null, seal_after: true }], facts,
        binding: { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch,
          levels_completed: observation.levels_completed, frame_hash: observation.frame_hash },
        compositions: [{ id: focus, role: 'controlled_public_contract_question', observed: false,
          properties: { unknown: ['current_effect', 'terminal_role'] }, relations: ['contributes_to:G_official_completion'],
          open_question: 'Observe this controlled public input without asserting its effect' }],
        question: { reason: 'Synthetic current-service gate contract; no effect is known' },
        bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion',
          purpose: 'Test one current public question', actions: [action], preconditions: facts,
          evidence: [observation.observation_ref], preserve_refs: [], preservation_evidence: {} } } as NativeProposal;
    },
    currentRequiredServiceWitness: (proposal, observation, _rows, trial) => {
      calls.witness++;
      assert.equal(trial.status, 'untried_exact_public_context');
      assert.equal(trial.observation_ref, observation.observation_ref);
      assert.equal(trial.source_state_ref, 'caller:frontier');
      assert.ok(Number.isSafeInteger(trial.source_state_revision));
      if (mode === 'witness_absent' || mode === 'witness_revoked_before_bind' && calls.witness > 1) return null;
      return { status: 'current_required_service', observation_ref: observation.observation_ref,
        level_epoch: observation.level_epoch, frame_hash: mode === 'witness_stale' ? 'stale-public-raster' : observation.frame_hash,
        action_ref: proposal.actions[0]!.action_ref, release_authority: false, primitive_bound: 1,
        replan_after_each_primitive: true, current_trial: copy(trial),
        qualification: 'Synthetic provider contract only; no public effect or successful game is asserted' };
    },
    before: (proposal, _index, _packet, observation) => {
      calls.before++;
      if (proposal.requires_current_service_witness === true) {
        assert.equal((proposal.native_current_service_witness as R)?.observation_ref, observation.observation_ref);
        assert.equal((proposal.native_current_service_admission as R)?.rule, 'current_required_service_witness_on_every_selection_path');
        assert.equal((proposal.native_current_service_admission as R)?.release_authority, false);
      }
      return { admitted: mode !== 'source_guard_refused', reason: 'controlled_current_source_guard' };
    },
    bind: () => { calls.bind++; },
    after: () => ({ matched: null, seal_prefix: true, reason: 'synthetic_public_return_effect_remains_unknown' }),
    record: () => { recorded++; return { events: [] }; },
  };
  if (mode === 'witness_hook_absent') delete family.currentRequiredServiceWitness;
  const runtime = new NativeV6Runtime({ sourceDigest: 'controlled-ordinary-current-service-gate', now: () => 0,
    families: [family], groups: [{ id: 'factored_material_return', families: [id] }],
    authorityPolicy: declarations.common, callerStrategy: policy,
    maxPointOccurrences: declarations.common.input_domain.max_point_occurrences });
  return { runtime, calls, id };
}

for (const mode of ['admitted', 'prior_trial', 'witness_absent', 'witness_stale', 'witness_hook_absent', 'source_guard_refused', 'witness_revoked_before_bind'] as const) {
  test(`ordinary selection applies the current-service gate without preemption: ${mode}`, async () => {
    const { runtime, calls, id } = ordinaryGateFixture(mode);
    try {
      let result = await runtime.initialize({ sessionId: `controlled-ordinary-service:${mode}`, observation: syntheticPacket(),
        budgets: { targetLevels: 3, levelActionCaps: [20, 20, 20], maxActions: 60 } }, execution);
      if (mode === 'prior_trial') {
        assert.equal(result.kind, 'action', JSON.stringify({ reason: result.reason, decision: (result.snapshot.whyAct as R).decision?.decision,
          trace: (result.snapshot.trace as R[]).slice(-4) }));
        assert.equal((result.snapshot.proposal as R).requires_current_service_witness, false);
        assert.equal(calls.witness, 0, 'An unchanged source offer does not require the new native witness');
        result = await runtime.advance({ command: result.command!, observation: syntheticPacket(1), executionMs: 0 }, execution);
        assert.equal(result.kind, 'boundary');
        calls.witness = 0; calls.before = 0; calls.bind = 0;
        result = await runtime.resume(execution);
      }
      assert.equal(result.snapshot.levelsCompleted, 0);
      assert.equal(result.snapshot.actions, mode === 'prior_trial' ? 1 : 0);
      if (mode === 'admitted') {
        assert.equal(result.kind, 'action', JSON.stringify({ reason: result.reason, decision: (result.snapshot.whyAct as R).decision?.decision,
          trace: (result.snapshot.trace as R[]).slice(-4) }));
        assert.equal(result.snapshot.lastDecision, id);
        const proposal = result.snapshot.proposal as R;
        assert.equal(proposal.strategy_receipt.selected, 'factored_material_return');
        assert.equal(proposal.strategy_receipt.native_coordination, undefined, 'Admission applies without an earlier provider to preempt');
        assert.equal(proposal.native_current_service_admission.rule, 'current_required_service_witness_on_every_selection_path');
        assert.equal(proposal.native_current_service_admission.release_authority, false);
        assert.equal(proposal.native_current_service_admission.source_state_ref, `family_state:${id}`);
        const witness = proposal.native_current_service_witness, inner = runtime as unknown as R;
        assert.equal(witness.current_trial.context_index, await frontierIndex(inner.observation));
        assert.equal(witness.current_trial.action_key, await frontierActionKey(result.command!));
        assert.equal(witness.current_trial.prior_trial_count, 0);
        assert.ok(calls.before >= 2, 'Admission and ordinary action authorization both recheck the source guard');
        assert.equal(calls.bind, 1);
        assert.ok(result.authorization);
        assert.equal((result.snapshot.whyAct as R).decision.decision.status, 'action_set_released');
        assert.equal(runtime.inspectKnowledge().nodes['reasoning:transition:1'], undefined, 'The accepted question receives no invented outcome');
      } else {
        assert.equal(result.kind, 'stopped');
        assert.equal(result.reason, 'no_applicable_transferred_family');
        assert.equal(result.command, null); assert.equal(result.authorization, null);
        assert.equal(calls.bind, 0, 'No failed service question reaches physical composition binding');
        assert.ok((result.snapshot.trace as R[]).some(item => item.kind === 'native_proposal_refusal'
          && item.family === id && (item.refusal?.rule ?? item.rule) === 'current_required_service_witness_on_every_selection_path'),
        'The refusal remains visible even when no later family proposes anything');
        if (mode === 'prior_trial' || mode === 'witness_hook_absent') assert.equal(calls.witness, 0);
        else assert.equal(calls.witness, mode === 'witness_revoked_before_bind' ? 2 : 1);
        assert.equal(calls.before, ['source_guard_refused', 'witness_revoked_before_bind'].includes(mode) ? 1 : 0);
      }
    } finally { runtime.close(`ordinary_current_service_gate_${mode}_complete`); }
  });
}
