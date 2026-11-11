import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { NativeSelectedRigid } from '../src/logos-engine/v6-selected-rigid.ts';
import { createNativeV6Runtime, NativeV6Runtime, selectedRigidFamily, rawNativeSelectedRigid } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily, NativeRuntimeYield } from '../src/logos-engine/v6-native-types.ts';
import { hydrateNativeState, isNativeStateGraph } from '../src/logos-engine/v6-native-state-graph.ts';
import { decodeNativeState } from '../src/logos-engine/v6-knowledge-store.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';
import { captureSelectedRigid } from './helpers/capture-selected-rigid.ts';

type R = Record<string, any>;
const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const source = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations: NativeV6Declarations = {
  common: JSON.parse(read(source + 'laya_proto/common_frontier_policy.drm.json')),
  strategy: JSON.parse(read(source + 'morphology_policy/strategy.drm')),
};
const words = JSON.parse(read('./fixtures/v6-interface-families-reference.json'));
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-selected-rigid/reference.json.gz', import.meta.url))).toString());
const execution = { yieldControl: async () => {} };
const budgets = { targetLevels: 3, levelActionCaps: [80, 80, 80] };
const copy = <T>(value: T): T => structuredClone(value);

function callerSession(): R {
  assert.equal(fixture.exportStatus, 'passed');
  assert.equal(fixture.provenance.nativeStatesUsedToGenerateExpected, false);
  assert.equal(fixture.provenance.nativePlansUsedToGenerateExpected, false);
  const session = fixture.sessions.find((row: R) => row.id === 'common-caller-exact-commands-prefix-and-boundary');
  assert.ok(session, 'The independent original exporter must supply the exact-command caller scenario');
  assert.equal(session.cold, true);
  return session;
}
function graphValue(runtime: NativeV6Runtime, id: string): R {
  const graph = runtime.inspectKnowledge(), raw = graph.nodes[id]!.value;
  return (isNativeStateGraph(raw) ? hydrateNativeState(raw, key => graph.nodes[key]!.value) : decodeNativeState(raw)) as R;
}
function sourceFact(runtime: NativeV6Runtime, key = 'selected_rigid_state'): R {
  const facts = graphValue(runtime, 'reasoning:memory').facts.map((id: string) => graphValue(runtime, id));
  const fact = facts.find((row: R) => row.key === key);
  assert.ok(fact, `The actual caller must retain the source fact ${key}, including an explicit null result`);
  return fact;
}
function rebind(value: any, references: Map<string, string>): any {
  if (typeof value === 'string' && value.startsWith(fixture.provenance.observationScope + ':')) {
    assert.ok(references.has(value), `Unwitnessed original observation ${value}`);
    return references.get(value);
  }
  if (Array.isArray(value)) return value.map(item => rebind(item, references));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rebind(v, references)]));
  return value;
}
function expectedProposal(sourceProposal: R, references: Map<string, string>): R {
  const value = rebind(sourceProposal, references);
  // Observation scopes are caller-owned. Recompute only their dependent identity;
  // every plan, action, step, fact and source composition still comes from Python.
  const originalId = sourceProposal.proposal_id, boundId = 'selected-rigid:' + symbolicDigest(value.selected_rigid_plan);
  const replace = (item: any): any => typeof item === 'string' ? item === originalId ? boundId : item
    : Array.isArray(item) ? item.map(replace)
    : item && typeof item === 'object' ? Object.fromEntries(Object.entries(item).map(([k, v]) => [k, replace(v)])) : item;
  return replace(value);
}
const records = (events: R[]): R[] => events.filter(row => row.method === 'record');
const proposals = (events: R[]): R[] => events.filter(row => row.method === 'propose' && row.result?.status === 'proposed');
function released(result: NativeRuntimeYield): void {
  assert.equal(result.kind, 'action', result.reason ?? 'Expected an original SelectedRigid action');
  assert.equal(result.snapshot.lastDecision, 'selected_rigid');
  const snapshot = result.snapshot as R;
  assert.equal(snapshot.whyAct.decision.decision.status, 'action_set_released');
  assert.equal(snapshot.srcDecision.workflow, 'v6.composition_strategy.choose');
  assert.equal(snapshot.proposal.strategy_receipt.selected, 'goal_access');
}
function retainReturnReference(result: NativeRuntimeYield, returned: R, references: Map<string, string>): void {
  const transition = (result.snapshot as R).trace.findLast((row: R) => row.kind === 'actual_outcome');
  assert.ok(transition);
  references.set(returned.afterObservation.observation_ref, transition.observation_ref);
}
function retainedState(runtime: NativeV6Runtime, raw: NativeSelectedRigid, expected: R): void {
  assert.deepEqual(raw.sourceState(), expected);
  assert.deepEqual(sourceFact(runtime).value, expected);
  assert.deepEqual(graphValue(runtime, 'family_state:selected_rigid'), { schema: 'native.selected_rigid.v1', ...expected });
}

/** Only independently recorded public returns are supplied; no state, model,
 * plan or selection is installed into the SelectedRigid owner. */
async function learnThroughCaller(runtime: NativeV6Runtime, events: R[], sessionId: string, currentExecution: NativeExecution = execution) {
  const session = callerSession(), references = new Map<string, string>();
  let result = await runtime.initialize({ sessionId, observation: copy(session.steps[0].beforePublic), budgets }, currentExecution);
  for (const row of session.steps.slice(0, 2)) {
    released(result);
    const returned = row.returns[0];
    assert.deepEqual(result.command, returned.command);
    references.set(returned.beforeObservation.observation_ref, result.authorization!.observation_ref);
    result = await runtime.advance({ command: result.command!, observation: copy(returned.afterPublic), executionMs: 0 }, currentExecution);
    retainReturnReference(result, returned, references);
    assert.equal(result.kind, 'boundary');
    assert.deepEqual(records(events).at(-1)!.result, rebind(returned.sourceRecord, references));
    result = await runtime.resume(currentExecution);
  }
  released(result);
  assert.equal((result.snapshot.proposal as R).selected_rigid_plan.mode, 'path');
  assert.ok((result.snapshot.proposal as R).actions.length > 1);
  return { result, references };
}

function owner(runtime: NativeV6Runtime) {
  const internal = runtime as unknown as R;
  const wrappers = internal.families.filter((item: NativeFamily) => item.id === 'selected_rigid');
  assert.equal(wrappers.length, 1);
  const raw = rawNativeSelectedRigid(wrappers[0]); assert.ok(raw);
  assert.equal(internal.acquisitionFamilies.selectedRigid, raw);
  return { raw, wrapper: wrappers[0] as NativeFamily };
}

test('production installs one SelectedRigid owner at the exact source goal entry', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  try {
    const { raw, wrapper } = owner(runtime), snapshot = runtime.snapshot() as R;
    const goal = snapshot.coverage.sourceGroups.find((group: R) => group.id === 'goal_access');
    const index = goal.families.indexOf('selected_rigid');
    assert.deepEqual(goal.families.slice(index - 1, index + 2), ['preview_packing', 'selected_rigid', 'invited_reduction']);
    assert.equal(goal.entryPoints[index], 'selected_rigid');
    assert.equal(snapshot.coverage.registeredFamilies.filter((id: string) => id === 'selected_rigid').length, 1);
    assert.equal(snapshot.coverage.fullV6Parity, false);
    assert.deepEqual(raw.sourceState(), { format: 'selected_rigid_events.v1', events: [] });
    assert.equal(raw.hasRetainedEvents(), false);
    assert.equal((raw as R).attachPrograms, undefined);
    assert.equal((wrapper as R).attachPrograms, undefined);
    assert.equal(rawNativeSelectedRigid({ id: 'selected_rigid' } as NativeFamily), null, 'Names cannot manufacture owner identity');
    const internal = runtime as unknown as R;
    assert.throws(() => new NativeV6Runtime({ sourceDigest: 'wrong-rigid-owner', families: internal.families,
      maxPointOccurrences: 128, authorityPolicy: declarations.common,
      callerStrategy: (declarations.strategy as R).declarations[0].configuration,
      acquisitionFamilies: { ...internal.acquisitionFamilies, selectedRigid: new NativeSelectedRigid() } }),
    /single registered owner/);
  } finally { runtime.close('selected_rigid_factory_contract_complete'); }
});

// These are adapter contracts with an explicitly substituted provider result.
// Source reachability and geometric refusal reasons are independently qualified
// by the original Python corpus; these tests claim no synthetic game outcome.
for (const reason of ['rigid_direction_domain_incomplete', 'rigid_control_or_collision_model_refuted',
  'rigid_conditional_configuration_search_incomplete', 'rigid_receptacle_matched_terminal_unknown',
  'rigid_control_discrimination_exhausted']) {
  test(`current source refusal stops before any lower-priority action: ${reason}`, async () => {
    const raw = new NativeSelectedRigid(); let lowerCalls = 0;
    raw.propose = async () => ({ status: 'unknown', block_unrelated_probe: true, reason });
    const rigid = selectedRigidFamily(raw);
    const fallback: NativeFamily = { id: 'later_provider', propose: () => { lowerCalls++; return null; },
      state: () => ({}), restore: () => {}, before: () => ({ admitted: true, reason: 'adapter_fixture' }),
      after: () => ({ matched: true, seal_prefix: true, reason: 'adapter_fixture' }), record: () => ({ events: [] }) };
    const runtime = new NativeV6Runtime({ sourceDigest: 'selected-rigid-blocking-adapter', families: [rigid, fallback],
      groups: [{ id: 'goal_access', families: [rigid.id], entryPoints: ['selected_rigid'] }, { id: 'later', families: [fallback.id] }],
      maxPointOccurrences: 128, now: () => 0 });
    try {
      const result = await runtime.initialize({ sessionId: `rigid-refusal-${reason}`,
        observation: { ...structuredClone(words.scenes['word:initial'].public), step_index: 0 }, budgets }, execution);
      assert.equal(result.kind, 'stopped'); assert.equal(result.reason, reason);
      assert.equal(result.command, null); assert.equal(result.snapshot.actions, 0);
      assert.equal(lowerCalls, 0);
      const refusal = (result.snapshot as R).trace.find((row: R) => row.kind === 'native_proposal_refusal');
      assert.equal(refusal.family, 'selected_rigid'); assert.equal(refusal.refusal.release_authority, false);
      assert.equal(refusal.refusal.source_stop_reason, reason);
      assert.deepEqual(raw.sourceState(), { format: 'selected_rigid_events.v1', events: [] });
    } finally { runtime.close('selected_rigid_refusal_contract_complete'); }
  });
}

test('the real caller keeps source priority and WHY/ACT, acquires each return once at seal, then restores controls across the epoch', async () => {
  const session = callerSession(), runtime = await createNativeV6Runtime(declarations, { now: () => 1000 });
  const { raw } = owner(runtime), events: R[] = [], references = new Map<string, string>();
  const capture = captureSelectedRigid(raw, events);
  try {
    let result = await runtime.initialize({ sessionId: 'selected-rigid-original-common-caller',
      observation: copy(session.steps[0].beforePublic), budgets }, execution);
    let physicalReturns = 0, retainedPrefix = false;
    for (const row of session.steps) {
      if (result.kind === 'boundary') result = await runtime.resume(execution);
      released(result);
      references.set(row.beforeObservation.observation_ref, result.authorization!.observation_ref);
      assert.deepEqual(raw.sourceState(), rebind(row.stateBefore, references));
      assert.deepEqual(proposals(events).at(-1)!.result, expectedProposal(row.proposal, references));
      const prefixRevision = result.authorization!.decision_revision, proposalCount = proposals(events).length;
      for (const returned of row.returns) {
        released(result);
        assert.deepEqual(result.command, returned.command, 'The exact emitted command, without host substitution, is returned');
        assert.equal(result.authorization!.action_index, returned.index);
        assert.equal(result.authorization!.decision_revision, prefixRevision);
        references.set(returned.beforeObservation.observation_ref, result.authorization!.observation_ref);
        const beforeGuard = events.findLast(event => event.method === 'before');
        assert.deepEqual(beforeGuard!.result, returned.beforeGuard);
        const recordCount = records(events).length;
        result = await runtime.advance({ command: result.command!, observation: copy(returned.afterPublic), executionMs: 0 }, execution);
        physicalReturns++;
        retainReturnReference(result, returned, references);
        assert.deepEqual(events.findLast(event => event.method === 'after')!.result, returned.afterGuard);
        assert.equal(proposals(events).length, proposalCount, 'A physical return never re-runs the provider within its prefix');
        if (result.kind === 'action') {
          retainedPrefix = true;
          assert.equal(result.authorization!.decision_revision, prefixRevision);
          assert.equal(records(events).length, recordCount, 'Known prefix acquisition waits for its real seal');
          assert.deepEqual(raw.sourceState(), rebind(row.stateBefore, references));
        } else {
          assert.equal(result.kind, 'boundary');
          assert.equal(records(events).length, physicalReturns);
          retainedState(runtime, raw, rebind(returned.stateAfter, references));
        }
      }
    }
    const expectedReturns: R[] = session.steps.flatMap((row: R) => row.returns);
    assert.equal(retainedPrefix, true);
    assert.equal(result.snapshot.actions, expectedReturns.length);
    assert.equal(result.snapshot.levelsCompleted, 1);
    assert.equal(records(events).length, expectedReturns.length);
    for (const [index, event] of records(events).entries()) {
      const expected = expectedReturns[index]!;
      assert.deepEqual(event.arguments[2], expected.command);
      assert.deepEqual(event.result, rebind(expected.sourceRecord, references));
      assert.deepEqual(event.sourceBefore, rebind(expected.stateBefore, references));
      assert.deepEqual(event.sourceAfter, rebind(expected.stateAfter, references));
      assert.ok(event.arguments[5].selected_rigid_plan);
    }
    const boundaryRecord = records(events).at(-1)!;
    assert.equal(boundaryRecord.resultKind, 'null');
    assert.deepEqual(boundaryRecord.sourceBefore, boundaryRecord.sourceAfter);
    assert.equal(sourceFact(runtime, `selected_rigid_event:${boundaryRecord.arguments[0].revision}`).value, null,
      'A selected null record remains a present null source fact');
    assert.equal(events.filter(event => event.method === 'restoreSourceState').length, expectedReturns.length);
    const nativeRestores = events.filter(event => event.method === 'restoreNative');
    assert.ok(nativeRestores.length > 0, 'The native checkpoint is actually read back');
    assert.deepEqual(nativeRestores.at(-1)!.arguments[0], raw.nativeState());
    assert.ok(events.every(event => event.returnedNormally && event.observationErrors.length === 0));
    assert.deepEqual(capture.unscopedClockReads, []);
    const continuation = proposals(events).at(-1)!.result.selected_rigid_plan;
    assert.equal(continuation.epoch, 2);
    assert.equal(continuation.mode, 'select');
    assert.equal(continuation.models.length, 6);
    assert.deepEqual(continuation.models, raw.sourceState().events.at(-1)!.models,
      'The next decision consumes restored controls instead of creating the initial 24 alternatives');
  } finally { runtime.close('selected_rigid_common_caller_contract_complete'); }
});

test('a foreign Word return after real rigid acquisition checkpoints the rigid owner before restored Preview without passive acquisition', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 1000 });
  const { raw } = owner(runtime), events: R[] = []; captureSelectedRigid(raw, events);
  try {
    const learned = await learnThroughCaller(runtime, events, 'selected-rigid-foreign-retention');
    const acquired = raw.sourceState();
    assert.equal(acquired.events.length, 2);
    assert.equal(acquired.events.at(-1)!.models.length, 6);
    // This second owner's checkpoint is explicitly restored from its independent
    // original corpus. It is not claimed as acquisition by this synthetic session.
    const previewFixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-preview-packing/reference.json.gz', import.meta.url))).toString());
    const previewSource = previewFixture.sessions.flatMap((row: R) => row.steps)
      .find((row: R) => row.stateAfter?.packing_model)?.stateAfter;
    assert.ok(previewSource?.packing_model);
    const preview = (runtime as unknown as R).acquisitionFamilies.preview;
    preview.restoreSourceState(copy(previewSource));
    const order: string[] = [], rigidRestore = raw.restoreSourceState, previewRestore = preview.restoreSourceState;
    raw.restoreSourceState = function (value) { order.push('selected_rigid'); return rigidRestore.call(this, value); };
    preview.restoreSourceState = function (value: R) { order.push('preview_packing'); return previewRestore.call(this, value); };
    let previewRecords = 0;
    const previewRecord = preview.record;
    preview.record = function (...args: unknown[]) { previewRecords++; return previewRecord.apply(this, args); };
    // The interface switch is a labelled public boundary supplied to the caller.
    // It establishes ownership/checkpoint order, not a game or an original route.
    const wordStart = { ...copy(words.scenes['word:initial'].public), level: 2, levels_completed: 1, step_index: 3 };
    const boundary = await runtime.advance({ command: learned.result.command!, observation: wordStart, executionMs: 0 }, execution);
    assert.equal(boundary.kind, 'boundary');
    assert.deepEqual(order, ['selected_rigid', 'preview_packing']);
    assert.deepEqual(raw.sourceState(), acquired);
    assert.equal(records(events).at(-1)!.resultKind, 'null');
    const beforeForeignRecordCount = records(events).length, eventCursor = events.length;
    order.length = 0;
    const foreign = await runtime.resume(execution);
    assert.equal(foreign.kind, 'action'); assert.equal(foreign.snapshot.lastDecision, 'word_interface');
    // The preceding decision may cache a negative Preview measurement for the
    // new epoch. This transition must retain the current owner state exactly.
    const previewBeforeForeignReturn = preview.sourceState();
    const returned = await runtime.advance({ command: foreign.command!, executionMs: 0,
      observation: { ...copy(words.scenes['word:editA'].public), level: 2, levels_completed: 1, step_index: 4 } }, execution);
    assert.equal(returned.kind, 'boundary');
    assert.equal(records(events).length, beforeForeignRecordCount, 'The foreign return never calls SelectedRigid.record');
    assert.equal(previewRecords, 0, 'Preview also has no passive record path');
    assert.deepEqual(order, ['selected_rigid', 'preview_packing']);
    retainedState(runtime, raw, acquired);
    assert.deepEqual(sourceFact(runtime, 'preview_packing_state').value, previewBeforeForeignReturn);
    assert.deepEqual(preview.sourceState(), previewBeforeForeignReturn);
    const sinceForeign = events.slice(eventCursor);
    assert.equal(sinceForeign.filter(event => event.method === 'restoreSourceState').length, 1);
    assert.ok(sinceForeign.some(event => event.method === 'restoreNative' && event.returnedNormally));
    assert.ok(sinceForeign.every(event => event.returnedNormally && event.observationErrors.length === 0));
  } finally { runtime.close('selected_rigid_foreign_retention_contract_complete'); }
});

test('a known prefix survives a long inactive pause with a refreshed deadline, then active execution time stops before its next action', async () => {
  let clock = 1000;
  const runtime = await createNativeV6Runtime(declarations, { now: () => clock });
  const { raw } = owner(runtime), events: R[] = []; captureSelectedRigid(raw, events);
  try {
    const learned = await learnThroughCaller(runtime, events, 'selected-rigid-pause-and-active-budget');
    const source = callerSession().steps[2], original = learned.result;
    const oldDeadline = raw.captureContext().levelDeadlineMs!;
    assert.equal(oldDeadline, clock + 360_000);
    assert.equal(original.snapshot.activeSeconds, 0);
    const proposalCount = proposals(events).length, recordCount = records(events).length;
    clock += 3_600_000; // No runtime call or active action occurs during this pause.
    assert.ok(clock > oldDeadline);
    let result = await runtime.advance({ command: original.command!,
      observation: copy(source.returns[0].afterPublic), executionMs: 0 }, execution);
    retainReturnReference(result, source.returns[0], learned.references);
    released(result);
    assert.equal(result.authorization!.decision_revision, original.authorization!.decision_revision);
    assert.equal(result.authorization!.action_index, 1);
    assert.equal(proposals(events).length, proposalCount);
    assert.equal(records(events).length, recordCount);
    assert.equal(result.snapshot.activeSeconds, 0, 'Inactive wall time never becomes charged active-level work');
    const continued = events.findLast(event => event.method === 'before')!;
    assert.equal(continued.arguments[1], 1);
    assert.equal(continued.result.admitted, true);
    assert.equal(continued.contextBefore.levelDeadlineMs, clock + 360_000);
    assert.deepEqual(continued.clockReads, [clock]);
    assert.equal(raw.captureContext().remainingLevelActions, 77);
    const beforeCount = events.filter(event => event.method === 'before').length;
    // This is the host's actual active-action duration input, not a mutation of
    // private runtime counters. The controlled clock advances by the same amount.
    clock += 360_000;
    result = await runtime.advance({ command: result.command!,
      observation: copy(source.returns[1].afterPublic), executionMs: 360_000 }, execution);
    retainReturnReference(result, source.returns[1], learned.references);
    assert.equal(result.kind, 'stopped'); assert.equal(result.reason, 'level_active_time_budget');
    assert.equal(result.command, null); assert.equal(result.snapshot.activeSeconds, 360);
    assert.equal(result.snapshot.actions, 4);
    assert.equal(events.filter(event => event.method === 'before').length, beforeCount,
      'Exhausted active time prevents any third path authorization');
    assert.equal(proposals(events).length, proposalCount);
    assert.equal(records(events).length, 4, 'Both actual known-path returns are acquired once when the budget seals their prefix');
    retainedState(runtime, raw, rebind(source.returns[1].stateAfter, learned.references));
    assert.ok(events.every(event => event.returnedNormally && event.observationErrors.length === 0));
  } finally { runtime.close('selected_rigid_pause_active_budget_contract_complete'); }
});

test('a paused known prefix preserves a tighter caller deadline on a different clock and refuses the next expired action', async () => {
  let clock = 1000, callerClock = 9_000_000;
  const runtime = await createNativeV6Runtime(declarations, { now: () => clock });
  const { raw } = owner(runtime), events: R[] = []; captureSelectedRigid(raw, events);
  try {
    const learned = await learnThroughCaller(runtime, events, 'selected-rigid-shifted-caller-deadline');
    const source = callerSession().steps[2], original = learned.result;
    const oldDeadline = raw.captureContext().levelDeadlineMs!;
    const proposalCount = proposals(events).length, recordCount = records(events).length;
    clock += 3_600_000; // The retained action was paused without active-level work.
    assert.ok(clock > oldDeadline);
    const callerDeadline = callerClock + 75;
    const boundedExecution: NativeExecution = { ...execution, now: () => callerClock, deadlineMs: callerDeadline };
    let result = await runtime.advance({ command: original.command!,
      observation: copy(source.returns[0].afterPublic), executionMs: 0 }, boundedExecution);
    retainReturnReference(result, source.returns[0], learned.references);
    released(result);
    assert.equal(result.authorization!.decision_revision, original.authorization!.decision_revision);
    assert.equal(result.authorization!.action_index, 1);
    assert.equal(proposals(events).length, proposalCount);
    assert.equal(records(events).length, recordCount);
    assert.equal(result.snapshot.activeSeconds, 0);
    const continued = events.findLast(event => event.method === 'before')!;
    assert.equal(continued.result.admitted, true);
    assert.equal(continued.contextBefore.levelDeadlineMs, clock + 75,
      'The caller deadline is translated to the runtime clock without enlarging its remaining duration');
    assert.equal(continued.contextBefore.remainingLevelActions, 77);
    assert.deepEqual(continued.clockReads, [clock]);

    // The second command was already authorized. Its actual return must be
    // acquired, but an expired request must not authorize a third command.
    clock += 76; callerClock += 76;
    result = await runtime.advance({ command: result.command!,
      observation: copy(source.returns[1].afterPublic), executionMs: 0 }, boundedExecution);
    retainReturnReference(result, source.returns[1], learned.references);
    assert.notEqual(result.kind, 'action');
    assert.equal(result.command, null);
    assert.equal(result.snapshot.activeSeconds, 0,
      'This refusal belongs to the tighter caller deadline, not the active-level time cap');
    assert.equal(result.snapshot.actions, 4);
    assert.equal(proposals(events).length, proposalCount);
    const refused = events.findLast(event => event.method === 'before')!;
    assert.equal(refused.arguments[1], 2);
    assert.equal(refused.contextBefore.levelDeadlineMs, clock);
    assert.equal(refused.contextBefore.remainingLevelActions, 76);
    assert.deepEqual(refused.result, { admitted: false, reason: 'level_deadline' });
    assert.equal(records(events).length, 4, 'Both real path returns are acquired once when the expired guard seals the prefix');
    retainedState(runtime, raw, rebind(source.returns[1].stateAfter, learned.references));
    assert.ok(events.every(event => event.returnedNormally && event.observationErrors.length === 0));
  } finally { runtime.close('selected_rigid_shifted_caller_deadline_contract_complete'); }
});

test('the adapter passes the current zero level quota separately from its positive prefix allowance', async () => {
  const first = callerSession().steps[0], raw = new NativeSelectedRigid(copy(fixture.configuration));
  const wrapper = selectedRigidFamily(raw);
  const proposal = await wrapper.propose(copy(first.beforeObservation), copy(first.beforePublic.frame_rows), copy(first.inputs), 1,
    { ...execution, now: () => 1000, deadlineMs: 20_000, remainingLevelActions: 0 });
  assert.equal(proposal?.status, 'proposed');
  assert.equal(proposal!.actions.length, 1);
  assert.equal(raw.captureContext().remainingLevelActions, 0,
    'Source requires a supplied level budget but does not itself test this value for exhaustion');
  assert.equal(wrapper.currentProposalRefusal!(copy(first.beforeObservation)), null);
});
