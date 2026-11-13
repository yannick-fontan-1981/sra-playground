import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { readEvidenceSync } from './helpers/chunked-evidence.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeCommand, NativeRuntimeYield } from '../src/logos-engine/v6-native-types.ts';
import { hydrateNativeState, isNativeStateGraph } from '../src/logos-engine/v6-native-state-graph.ts';
import { decodeNativeState } from '../src/logos-engine/v6-knowledge-store.ts';
import { chooseFeedbackTrialCooperative } from '../src/logos-engine/v6-feedback-sequences-finite.ts';

type R = Record<string, any>;
type Runtime = Awaited<ReturnType<typeof createNativeV6Runtime>>;
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const fixture = JSON.parse(gunzipSync(readEvidenceSync(new URL('./fixtures/v6-feedback-sequences-reference.json.gz', import.meta.url))).toString());
const declarations: NativeV6Declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
};
const EXECUTION = { yieldControl: async () => {} };
const clone = <T>(value: T): T => structuredClone(value);
const session = (id: string): R => {
  const result = fixture.sessions.find((row: R) => row.id === id);
  assert.ok(result, `source public session ${id}`);
  return result;
};
const record = (id: string): R => {
  const result = fixture.records.find((row: R) => row.id === id);
  assert.ok(result, `source public return ${id}`);
  return result;
};
function graphValue(runtime: Runtime, id: string): R {
  const graph = runtime.inspectKnowledge(), raw = graph.nodes[id]!.value!;
  return (isNativeStateGraph(raw)
    ? hydrateNativeState(raw, fragment => graph.nodes[fragment]!.value)
    : decodeNativeState(raw)) as R;
}
function facts(runtime: Runtime): R[] {
  return graphValue(runtime, 'reasoning:memory').facts.map((id: string) => graphValue(runtime, id));
}
function retainedFeedback(runtime: Runtime): R {
  const fact = facts(runtime).find(row => row.key === 'feedback_sequence_state');
  assert.ok(fact, 'The source common caller retains the single Feedback state fact');
  return fact.value;
}
// The oracle numbers observations from zero; the native coordinator measures
// them from one and supplies a fresh session identity. Translate only witnessed
// reference strings, preserving every source value, decision and evidence edge.
function rebind(value: any, references: Map<string, string>): any {
  if (typeof value === 'string') {
    if (value.startsWith('original-feedback-synthetic:epoch:')) {
      assert.ok(references.has(value), `unwitnessed oracle reference ${value}`);
      return references.get(value);
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(item => rebind(item, references));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rebind(item, references)]));
  return value;
}
const normalizedCommand = (command: NativeCommand | R) => ({ action_ref: command.action_ref, data: command.data ?? {} });

interface Journal {
  runtime: Runtime;
  owner: R;
  calls: R[];
  restorations: R[];
  references: Map<string, string>;
  result: NativeRuntimeYield;
}
function watchOwner(runtime: Runtime): Pick<Journal, 'owner' | 'calls' | 'restorations'> {
  const internal = runtime as unknown as R;
  const owners = internal.families.filter((family: R) => family.id === 'feedback_sequences');
  assert.equal(owners.length, 1, 'The two strategy entries must not create two acquired owners');
  const owner = owners[0]!, calls: R[] = [], restorations: R[] = [];
  assert.equal(internal.acquisitionFamilies.feedback, owner, 'Passive acquisition uses that exact registered instance');
  const acquire = owner.record.bind(owner), restore = owner.restore.bind(owner);
  owner.record = async (...args: any[]) => {
    const result = await acquire(...args);
    calls.push({ argc: args.length, before: args[0].observation_ref, after: args[1].observation_ref,
      selected: args[5] !== undefined, index: args[6], result: clone(result) });
    return result;
  };
  owner.restore = (state: R) => { restorations.push(clone(state)); restore(state); };
  return { owner, calls, restorations };
}
async function start(id: string, policy = declarations): Promise<Journal> {
  const runtime = await createNativeV6Runtime(policy, { now: () => 0 });
  const watched = watchOwner(runtime);
  try {
    const result = await runtime.initialize({ sessionId: `feedback-integration-${id}`,
      observation: clone(session(id).steps[0].beforePublic),
      budgets: { targetLevels: 3, levelActionCaps: [120, 120, 120] } }, EXECUTION);
    return { runtime, ...watched, references: new Map(), result };
  } catch (error) { runtime.close('feedback_initialization_failed'); throw error; }
}
function assertReleased(result: NativeRuntimeYield, family: string): void {
  const snapshot = result.snapshot as R;
  assert.equal(result.kind, 'action', String(result.reason));
  assert.equal(snapshot.lastDecision, family);
  assert.equal(snapshot.caller.enabled, true);
  assert.equal(snapshot.whyAct.enabled, true);
  assert.equal(snapshot.whyAct.decision.decision.status, 'action_set_released');
  assert.equal(snapshot.whyAct.decision.decision.model_calls.length, 0);
  assert.equal(snapshot.srcDecision.workflow, 'v6.composition_strategy.choose');
  const guard = snapshot.trace.findLast((row: R) => row.kind === 'before_guard');
  assert.equal(guard.admitted, true);
  if (result.command!.action_ref === 'ACTION6') assert.equal(guard.point_bound, true);
  if (family === 'feedback_sequences') assert.equal(snapshot.proposal.feedback_plan.workflow.workflow, 'v6.feedback_sequences.choose');
}
async function primitive(journal: Journal, row: R, family = 'feedback_sequences'): Promise<{ command: NativeCommand; offered: R; returned: R }> {
  if (journal.result.kind === 'boundary') journal.result = await journal.runtime.resume(EXECUTION);
  assertReleased(journal.result, family);
  assert.deepEqual(normalizedCommand(journal.result.command!), normalizedCommand(row.command));
  const offered = journal.result.snapshot as R, command = clone(journal.result.command!);
  journal.references.set(row.beforeObservation.observation_ref, journal.result.authorization!.observation_ref);
  journal.result = await journal.runtime.advance({ command: journal.result.command!, observation: clone(row.afterPublic), executionMs: 0 }, EXECUTION);
  const returned = journal.result.snapshot as R;
  const transition = returned.trace.findLast((item: R) => item.kind === 'actual_outcome');
  journal.references.set(row.afterObservation.observation_ref, transition.observation_ref);
  if (journal.result.kind === 'boundary') {
    const expected = rebind(row.stateAfter, journal.references);
    assert.deepEqual(journal.owner.state(), expected, 'The real caller restores the exact source acquired state');
    assert.deepEqual(graphValue(journal.runtime, 'family_state:feedback_sequences'), expected);
    assert.deepEqual(retainedFeedback(journal.runtime), expected);
  }
  return { command, offered, returned };
}

test('production common factory connects one Feedback owner in source order, acquires each selected primitive once, and restores a method without a layout', async () => {
  const journal = await start('repeatable'), { runtime, owner, calls, restorations } = journal;
  try {
    const snapshot = journal.result.snapshot as R, groups = snapshot.coverage.sourceGroups;
    assert.deepEqual(groups.map((group: R) => group.id), declarations.strategy.declarations[0]!.configuration.families);
    const goal = groups.find((group: R) => group.id === 'goal_access');
    const index = goal.families.indexOf('feedback_sequences');
    assert.ok(index > 0);
    assert.deepEqual(goal.families.slice(index - 1, index + 2), ['joint_transport', 'feedback_sequences', 'animated_contact']);
    assert.equal(goal.entryPoints[index], 'observed_feedback_sequence');
    assert.deepEqual(groups.find((group: R) => group.id === 'information_goal').families,
      ['visual_sequences', 'feedback_sequences', 'information_goal']);
    assert.equal(snapshot.coverage.registeredFamilies.filter((id: string) => id === 'feedback_sequences').length, 1);
    assert.equal(snapshot.familyStateRefs.feedback_sequences.id, 'family_state:feedback_sequences');
    assert.equal(snapshot.proposal.strategy_receipt.selected, 'goal_access');
    assert.deepEqual(snapshot.proposal.strategy_receipt.visited, ['goal_access']);
    assert.equal(snapshot.coverage.fullV6Parity, false);

    const rows = session('repeatable').steps;
    for (const [index, row] of rows.entries()) {
      const { offered, returned } = await primitive(journal, row);
      assert.equal(offered.proposal.strategy_receipt.selected, 'goal_access');
      if (index === 4) assert.equal(offered.prefix.planned, 3, 'The learned entry law allows a conditional ordered prefix');
      if (index === 4 || index === 5) {
        assert.equal(journal.result.kind, 'action');
        assert.equal(calls.length, 4, 'Unsealed primitive returns are not acquired early');
        assert.equal(returned.prefix.revision, 5, 'Continuation keeps the original source decision');
        assert.equal(returned.prefix.nextIndex, index - 3);
      } else {
        assert.equal(journal.result.kind, 'boundary');
        assert.equal(calls.length, index + 1);
        assert.equal(returned.caller.acquiredTransitions, index + 1);
      }
    }
    assert.deepEqual(calls.map(call => call.result.events[0].status), rows.map((row: R) => row.record.status));
    assert.ok(calls.every(call => call.selected && call.argc === 8));
    assert.deepEqual(calls.slice(4, 7).map(call => call.index), [0, 1, 2]);
    assert.equal(new Set(calls.map(call => `${call.before}:${call.after}`)).size, 8);
    assert.equal(facts(runtime).filter(fact => /^feedback_sequence_event:\d+$/.test(fact.key)).length, 8);
    assert.equal(owner.state().history.length, 2);

    // The next genuinely selected action receives a synthetic official public
    // boundary. The oracle's boundary record is independent of its triggering
    // command; this is lifecycle coverage, not a claim of a solved game replay.
    journal.result = await runtime.resume(EXECUTION);
    assertReleased(journal.result, 'feedback_sequences');
    const boundary = record('official-boundary-method-only');
    const boundaryReturn = await runtime.advance({ command: journal.result.command!, observation: clone(boundary.afterPublic), executionMs: 0 }, EXECUTION);
    journal.result = boundaryReturn;
    assert.equal(boundaryReturn.kind, 'boundary');
    assert.equal(boundaryReturn.snapshot.actions, 9);
    assert.equal((boundaryReturn.snapshot as R).caller.boundaryReplays, 1);
    assert.equal(calls.length, 9);
    assert.equal(calls[8]!.result.events[0].status, 'official_boundary');
    const methodOnly = rebind(boundary.stateAfter, journal.references);
    assert.equal(methodOnly.layout, null);
    assert.ok(methodOnly.entry_method);
    assert.deepEqual(owner.state(), methodOnly);
    assert.deepEqual(graphValue(runtime, 'family_state:feedback_sequences'), methodOnly);
    assert.deepEqual(retainedFeedback(runtime), methodOnly);
    assert.ok(restorations.some(state => state.layout === null && state.entry_method !== null),
      'The caller restores its retained method-only fact, rather than dropping it with layout');

    // Simulate eviction of the mutable working owner. Restore only through the
    // real graph lifecycle, whose state above came exclusively from public returns.
    owner.restore(clone(rows[0].stateBefore));
    assert.equal(owner.state().entry_method, null);
    (runtime as unknown as R).restoreFamilies();
    assert.deepEqual(owner.state(), methodOnly);
    journal.result = await runtime.resume(EXECUTION);
    assertReleased(journal.result, 'feedback_sequences');
    const recalled = record('recalled-method-confirmed'), proposal = (journal.result.snapshot as R).proposal;
    assert.deepEqual(journal.result.command, recalled.command);
    assert.equal(proposal.feedback_plan.selection.current_role_revalidation_pending, true);
    assert.deepEqual(proposal.feedback_plan.selection.recalled_entry, methodOnly.entry_method);
    const response = await runtime.advance({ command: journal.result.command!, observation: clone(recalled.afterPublic), executionMs: 0 }, EXECUTION);
    assert.equal(response.kind, 'boundary');
    assert.equal(calls.length, 10);
    assert.equal(calls[9]!.result.events[0].event.method_revalidation, 'active_rank_row_confirmed');
    assert.equal(owner.state().entry_evidence.length, 1);
    assert.equal(owner.state().layout.epoch, 2);
    assert.deepEqual(owner.state().entry_method, methodOnly.entry_method);
    assert.deepEqual(retainedFeedback(runtime), owner.state());
  } finally { runtime.close('feedback_common_lifecycle_complete'); }
});

test('information_goal consults VisualSequences before the same Feedback owner and obeys feedback_sequences_first', async () => {
  // Explicit source-configuration variant: isolate one declared group to make
  // the second entry observable. No provider, proposal, action or state is
  // substituted, and this does not establish unchanged-router selection parity.
  const policy = clone(declarations);
  policy.strategy.declarations[0]!.configuration.families = ['information_goal'];
  const runtime = await createNativeV6Runtime(policy, { now: () => 0 });
  const watched = watchOwner(runtime), consulted: string[] = [];
  for (const family of (runtime as unknown as R).families as R[]) {
    if (!['visual_sequences', 'feedback_sequences'].includes(family.id)) continue;
    const method = family.proposeInGroup ? 'proposeInGroup' : 'propose';
    const propose = family[method].bind(family);
    family[method] = (...args: any[]) => { consulted.push(family.id); return propose(...args); };
  }
  try {
    const row = session('repeatable').steps[0];
    const result = await runtime.initialize({ sessionId: 'feedback-information-entry', observation: clone(row.beforePublic),
      budgets: { targetLevels: 3, levelActionCaps: [120, 120, 120] } }, EXECUTION);
    assertReleased(result, 'feedback_sequences');
    assert.deepEqual(consulted, ['visual_sequences', 'feedback_sequences']);
    assert.equal((result.snapshot as R).proposal.strategy_receipt.selected, 'information_goal');
    assert.deepEqual((result.snapshot as R).proposal.strategy_receipt.visited, ['information_goal']);
    const journal = { runtime, ...watched, references: new Map<string, string>(), result };
    await primitive(journal, row);
    assert.equal(watched.calls.length, 1);
    assert.equal(watched.calls[0]!.selected, true);
    assert.equal(watched.owner, (runtime as unknown as R).acquisitionFamilies.feedback);
  } finally { runtime.close('feedback_information_entry_complete'); }

  const disabled = clone(policy);
  disabled.strategy.declarations[0]!.configuration.information_goal!.feedback_sequences_first = false;
  const withoutEntry = await createNativeV6Runtime(disabled, { now: () => 0 });
  try {
    assert.deepEqual((withoutEntry.snapshot() as R).coverage.sourceGroups[0].families, ['visual_sequences', 'information_goal']);
    assert.equal((withoutEntry as unknown as R).families.filter((family: R) => family.id === 'feedback_sequences').length, 1);
  } finally { withoutEntry.close('feedback_information_flag_complete'); }
});

test('source palette compaction rebinds each actual point while preserving the conditional ordered prefix', async () => {
  const journal = await start('compacting');
  try {
    const offered: R[] = [];
    for (const row of session('compacting').steps) offered.push((await primitive(journal, row)).offered);
    assert.deepEqual(offered.slice(4, 7).map(snapshot => snapshot.prefix.revision), [5, 5, 5]);
    assert.deepEqual(offered[4]!.proposal.actions.map((action: R) => action.data.x), [17, 17, 8]);
    assert.ok(offered[4]!.proposal.steps.every((step: R) => step.point_binding.projected_rows_digest));
    assert.equal(journal.owner.state().repeatable, false);
    assert.notEqual(journal.owner.state().palette_background, null);
    assert.equal(journal.calls.length, 8);
    assert.equal(journal.owner.state().history.length, 2);
  } finally { journal.runtime.close('feedback_compacting_prefix_complete'); }
});

test('real frontier actions acquire passive Feedback once and the acquired entry immediately changes actual strategy selection', async () => {
  const journal = await start('passive-unmarked-append');
  try {
    const rows = session('passive-unmarked-append').steps;
    assert.equal(rows.length, 3);
    assert.equal(rows[0].proposal, null);
    assert.equal(rows[1].proposal, null);
    for (const [index, row] of rows.entries()) {
      const family = index < 2 ? 'observed_frontier' : 'feedback_sequences';
      const { offered } = await primitive(journal, row, family);
      assert.equal(offered.proposal.strategy_receipt.selected, index < 2 ? 'observed_frontier' : 'goal_access');
      assert.equal(journal.calls.length, index + 1);
      assert.equal(journal.calls[index]!.selected, index === 2);
      assert.equal(journal.calls[index]!.argc, index < 2 ? 5 : 8,
        'Passive acquisition supplies no selected proposal, index or foreign frame envelope');
    }
    assert.deepEqual(journal.calls.map(call => call.result.events[0].status),
      ['no_bound_sequence_effect', 'observed_append', 'observed_append']);
    assert.equal(journal.owner.state().entry_evidence.length, 2);
    assert.equal(journal.owner.state().entry_evidence[0].value, 4);
    assert.equal(facts(journal.runtime).filter(fact => /^feedback_sequence_event:\d+$/.test(fact.key)).length, 1,
      'Only a selected Feedback return gets the selected-event key; passive learning lives in the state fact');
  } finally { journal.runtime.close('feedback_passive_common_acquisition_complete'); }
});

test('different source-observed feedback rows cause different subsequently released ordered action suites', async () => {
  const left = session('discriminant-a'), right = session('discriminant-b');
  assert.deepEqual(left.steps[0].beforePublic, right.steps[0].beforePublic);
  assert.deepEqual(left.steps.slice(0, 4).map((row: R) => row.command), right.steps.slice(0, 4).map((row: R) => row.command));
  assert.deepEqual(left.steps[3].afterPublic.frame_rows.slice(0, 40), right.steps[3].afterPublic.frame_rows.slice(0, 40),
    'The palette, active row and revealed values agree; the observed feedback marks distinguish the returns');
  assert.notDeepEqual(left.steps[3].afterPublic.frame_rows, right.steps[3].afterPublic.frame_rows);
  const choices: R[] = [];
  for (const branch of [left, right]) {
    const journal = await start(branch.id);
    try {
      const actions: NativeCommand[] = [];
      let chosen: R | undefined;
      for (const [index, row] of branch.steps.slice(0, 7).entries()) {
        const { command, offered } = await primitive(journal, row);
        if (index === 4) {
          chosen = clone(offered.proposal.feedback_plan.selection);
          assert.deepEqual(chosen, rebind(row.proposal.feedback_plan.selection, journal.references));
          assert.ok(chosen.evidence.includes(journal.references.get(branch.steps[3].afterObservation.observation_ref)));
        }
        if (index >= 4) actions.push(command);
      }
      assert.equal(journal.calls.length, 7);
      assert.equal(journal.owner.state().history.length, 1);
      choices.push({ selection: chosen!, actions });
    } finally { journal.runtime.close('feedback_discriminating_branch_complete'); }
  }
  assert.deepEqual(choices.map(choice => choice.selection.trial), [[3, 3, 3], [3, 3, 4]]);
  assert.notDeepEqual(choices[0]!.actions, choices[1]!.actions,
    'The difference reaches real WHY/ACT-released commands, not just a diagnostic counter');
});

test('a contradictory public entry return seals the unfinished prefix, acquires only the real primitive, and prevents stale Feedback continuation', async () => {
  const journal = await start('repeatable');
  try {
    for (const row of session('repeatable').steps.slice(0, 4)) await primitive(journal, row);
    journal.result = await journal.runtime.resume(EXECUTION);
    assertReleased(journal.result, 'feedback_sequences');
    assert.equal((journal.result.snapshot as R).prefix.planned, 3);
    // A controlled splice of two source-observed public returns: the same
    // selected value now disappears from the palette instead of repeating.
    // This tests the caller's interruption, not a claim about a game trajectory.
    const contradicted = session('compacting').steps[4];
    assert.deepEqual(journal.result.command, contradicted.command);
    const returned = await journal.runtime.advance({ command: journal.result.command!, observation: clone(contradicted.afterPublic), executionMs: 0 }, EXECUTION);
    assert.equal(returned.kind, 'boundary');
    assert.equal(returned.snapshot.actions, 5);
    assert.equal((returned.snapshot as R).prefix.executed, 1);
    assert.equal((returned.snapshot as R).prefix.planned, 3);
    assert.equal(journal.calls.length, 5);
    assert.equal(journal.calls[4]!.result.events[0].status, record('entry-protocol-refuted').record.status);
    assert.equal(journal.owner.state().blocked.status, 'entry_protocol_refuted');
    assert.equal(journal.owner.state().entry_evidence.length, 3);
    assert.equal(journal.owner.state().history.length, 1);
    const actual = (returned.snapshot as R).trace.findLast((row: R) => row.kind === 'actual_outcome');
    assert.equal(actual.matched, false);
    assert.equal(actual.seal_prefix, true);
    const sealed = graphValue(journal.runtime, 'prefix_evidence:5');
    assert.equal(sealed.transitions.length, 1);
    assert.deepEqual(retainedFeedback(journal.runtime), journal.owner.state());
    const resumed = await journal.runtime.resume(EXECUTION);
    assert.notEqual(resumed.snapshot.lastDecision, 'feedback_sequences');
    assert.equal(resumed.snapshot.actions, 5, 'Planning does not dispatch either unexecuted suffix command');
    assert.equal(journal.calls.length, 5);
    if (resumed.kind === 'action') {
      assert.ok(resumed.authorization!.decision_revision > 5);
      assert.equal(resumed.authorization!.action_index, 0);
    }
  } finally { journal.runtime.close('feedback_refuted_prefix_complete'); }
});

test('cooperative Feedback enumeration yields and preserves cancellation or deadline exhaustion as incomplete without a recommendation', async () => {
  const row = fixture.finite.find((item: R) => item.expected.status === 'proposed' && item.arguments.alphabet.length >= 3);
  assert.ok(row);
  const a = row.arguments;
  const args: Parameters<typeof chooseFeedbackTrialCooperative>[0] =
    [a.alphabet, a.length, a.prefix, a.history, a.revealed, a.repeatable, a.observation, a.budget, a.configuration];
  const alreadyAborted = new AbortController(); alreadyAborted.abort();
  const duringSearch = new AbortController();
  let yields = 0, virtualMs = 0;
  const executions = [
    { ...EXECUTION, signal: alreadyAborted.signal, now: () => 0, reason: 'aborted' },
    { ...EXECUTION, deadlineMs: 0, now: () => 0, reason: 'deadline' },
    { yieldControl: async () => { yields += 1; duringSearch.abort(); }, signal: duringSearch.signal,
      now: () => { const current = virtualMs; virtualMs += 8; return current; }, reason: 'aborted' },
  ];
  for (const execution of executions) {
    const result = await chooseFeedbackTrialCooperative(args, execution);
    assert.equal(result.status, 'native_feedback_search_incomplete');
    assert.equal(result.reason, execution.reason);
    assert.equal(result.domain_complete, false);
    assert.equal(result.recommendation, null);
    assert.ok(!Object.hasOwn(result, 'trial'));
  }
  assert.equal(yields, 1, 'The actual finite search cooperates before completing its domain');
});
