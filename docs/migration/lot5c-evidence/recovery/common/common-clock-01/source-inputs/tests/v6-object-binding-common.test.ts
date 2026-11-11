import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution } from '../src/logos-engine/v6-native-types.ts';
import { CommonMaterialReplay } from './helpers/native-composition-loop.ts';
import { BindingCapture, runBindingCommon, saveBindingEvidence, ATTENTION_OWNER, OWNER, STATE_ID,
  bindingDeclarations, bindingPublicTable, commonProofInputs, assertReleased, copy, type R } from '../scripts/native-object-binding-common-loop.ts';

test('cold ordinary object binding distinguishes a detached reception from an object still following the body', async () => {
  const positive = await runBindingCommon('positive');
  await saveBindingEvidence('positive', positive);
  assert.equal(positive.status, 'passed', JSON.stringify(positive.checks.failures));
  const negative = await runBindingCommon('refutation');
  await saveBindingEvidence('refutation', negative);
  assert.equal(negative.status, 'passed', JSON.stringify(negative.checks.failures));
  assert.equal(positive.returned, negative.returned);
  assert.deepEqual(positive.table.slice(0, -1), negative.table.slice(0, -1), 'The acquisition prefix before separation is identical');
  const lastPositive = positive.history.at(-1), lastNegative = negative.history.at(-1);
  assert.deepEqual(lastPositive.selected.command, lastNegative.selected.command, 'The contrasting return follows the same actual selected separation command');
  assert.equal(lastPositive.selected.family, OWNER); assert.equal(lastNegative.selected.family, OWNER);
  assert.notDeepEqual(positive.next.command, negative.next.command, 'Observed separation changes the next actual common command');
  assert.notEqual(positive.next.snapshot.proposal.binding_plan.offer.target.frame.ref,
    negative.next.snapshot.proposal.binding_plan.offer.target.frame.ref, 'Positive separation releases the completed parent; refutation keeps its selected frame');
  assert.equal(positive.finalAttention.composition.status, 'achieved');
  assert.equal(negative.finalAttention.composition.status, 'pending');
  assert.ok(negative.finalState.events.some((event: R) => event.status === 'reception_refuted_object_moves_with_body'));
});

test('two compatible public relocations keep attachment unresolved and do not silently replace the selected-frame parent', async () => {
  const report = await runBindingCommon('ambiguity');
  await saveBindingEvidence('ambiguity', report);
  assert.equal(report.status, 'passed', JSON.stringify(report.checks.failures));
  const records = report.operations.filter((row: R) => row.method === 'recordSource');
  const unresolved = records.findLast((row: R) => row.native.result?.status === 'identity_binding_unresolved');
  assert.ok(unresolved); assert.equal(unresolved.native.result.compatible_source_count, 0);
  assert.ok(unresolved.native.result.ambiguities.some((item: R) => item.compatible_count === 2));
  assert.equal(report.finalState.held, null);
  assert.equal(report.finalAttention.composition.owner, ATTENTION_OWNER);
  assert.equal(report.finalAttention.composition.status, 'pending');
  const parentIds = records.map((row: R) => row.native.attention.composition?.id).filter(Boolean);
  assert.equal(new Set(parentIds).size, 1);
});

test('an official boundary during selected reception clears local binding geometry and keeps conditional methods through restoration', async () => {
  const report = await runBindingCommon('boundary');
  await saveBindingEvidence('boundary', report);
  assert.equal(report.status, 'passed', JSON.stringify(report.checks.failures));
  const state = report.finalState;
  assert.equal(state.epoch, 2); assert.equal(state.core, null); assert.equal(state.held, null);
  assert.deepEqual(state.moves, {}); assert.deepEqual(state.blocked, []); assert.deepEqual(state.failed, []);
  assert.deepEqual(state.observed_frames, {}); assert.equal(state.pending_reception, null);
  assert.ok(state.methods.some((item: R) => item.status === 'boundary_support_not_universal_sufficiency'));
  assert.equal(report.finalAttention.composition.status, 'boundary');
  assert.ok(report.restores.length > 0);
  assert.ok(report.attentionRestores.some((row: R) => row.identityChanged));
});

test('passive object binding shares restored caller attention without replacing a real parent retained by another family', async () => {
  const startedAt = new Date().toISOString(), failures: R[] = [];
  const executionInputsBefore = await commonProofInputs(['tests/helpers/native-composition-loop.ts',
    'tests/fixtures/v6-typed-material-original-public.json.gz', 'docs/migration/native-campaigns-v50/life-public-trace-final.json.gz']);
  let capture: BindingCapture | null = null, driver: CommonMaterialReplay | null = null;
  let before: R | null = null, after: R | null = null, finalCheckpoint: R | null = null;
  try {
    driver = await CommonMaterialReplay.cold('lot5c-recovery-foreign-typed-material-parent', async (declarations, options) => {
      const runtime = await createNativeV6Runtime(declarations, options);
      capture = new BindingCapture(runtime as unknown as R); return runtime;
    });
    const active = capture! as BindingCapture;
    await driver.until(proposal => proposal.material_pose_plan?.mode === 'control' && proposal.material_pose_plan.rule === null);
    before = copy(driver.attention());
    assert.ok(before && before.status === 'pending'); assert.notEqual(before.owner, ATTENTION_OWNER);
    const priorRecordCount = active.records().length;
    let returned = 0;
    do {
      await driver.recorded(); returned++;
      assert.ok(returned <= 16, 'The retained foreign-parent return must seal within its finite path');
    } while (active.records().length === priorRecordCount);
    after = copy(driver.attention());
    assert.ok(after && after.status === 'pending'); assert.equal(after.id, before.id); assert.equal(after.owner, before.owner);
    const observed = active.records().slice(priorRecordCount);
    assert.ok(observed.length > 0 && observed.every(row => !row.useLatestSourceProposal));
    assert.ok(observed.every(row => row.native.sharedAttentionBound));
    assert.ok(observed.every(row => row.native.attention.composition?.id === before!.id));
    assert.ok(active.attentionRestores.some(row => row.identityChanged));
    const internal = driver.runtime as unknown as R;
    finalCheckpoint = copy(internal.knowledge.stateValue(STATE_ID));
    assert.equal(Object.hasOwn(finalCheckpoint!, 'attention'), false);
    assert.equal(Object.hasOwn(finalCheckpoint!.source, 'attention'), false);
    assert.equal(internal.families.filter((family: R) => family.id === OWNER).length, 1);
    assert.deepEqual(internal.knowledge.stateValue('caller:attention'), active.attention());
    assert.equal(active.records().length, driver.packetIndex);
  } catch (error: any) { failures.push({ name: error.name, message: error.message, stack: error.stack }); }
  finally { driver?.runtime.close('object_binding_foreign_parent_proof_finished'); }
  const observedCapture = capture as BindingCapture | null;
  const report = { schema: 'logos-engine.lot5c-foreign-parent-common-proof.v1',
    status: failures.length ? 'failed' : 'passed', mode: 'foreign-parent', startedAt, finishedAt: new Date().toISOString(),
    reconstruction: 'New recovery execution; no historical receipt reused', executionInputsBefore,
    publicTrace: 'docs/migration/native-campaigns-v50/life-public-trace-final.json.gz',
    actions: driver?.packetIndex ?? 0, parentBefore: before, parentAfter: after, finalCheckpoint,
    operations: observedCapture?.operations ?? [], journal: observedCapture?.journal('lot5c-recovery-foreign-typed-material-parent', 'foreign-parent')
      ?? { schema: 'logos-engine.v6.observed-binding-public-operations.v1', operations: [] },
    restores: observedCapture?.restores ?? [], attentionRestores: observedCapture?.attentionRestores ?? [],
    nativeAttentionExtensions: observedCapture?.nativeAttentionExtensions ?? [], completeOriginalCallerReplayClaimed: false, failures,
    qualification: 'Existing public LIFE returns through the ordinary factory establish the foreign typed-material parent without injected tracker or parent state. This proves shared native attention ownership and preservation. Typed-material parent revisions are a native extension, not a claim of complete original StrategyRouter replay.' };
  await saveBindingEvidence('foreign-parent', report);
  assert.equal(report.status, 'passed', JSON.stringify(failures));
});

test('an incomplete passive binding acquisition keeps its old knowledge and stops the common caller after assessment', async () => {
  const startedAt = new Date().toISOString(), failures: R[] = [], injected: R[] = [];
  const executionInputsBefore = await commonProofInputs();
  const plan = JSON.parse(await readFile(new URL('../docs/migration/lot5c-evidence/recovery/common/common-plan.json', import.meta.url), 'utf8'));
  const { initial, table } = bindingPublicTable('positive', plan);
  const runtime = await createNativeV6Runtime(await bindingDeclarations(), { now: () => 0 });
  const internal = runtime as unknown as R, capture = new BindingCapture(internal), owner = capture.owner;
  const execution: NativeExecution = { now: () => 0, deadlineMs: 360_000, yieldControl: async () => {} };
  let result: R | null = null, ownerBefore: R | null = null, ownerAfter: R | null = null;
  let stateFactsBefore: R[] = [], stateFactsAfter: R[] = [], retainedIncomplete: R[] = [];
  const facts = (): R[] => internal.knowledge.stateValue('reasoning:memory').facts.map((id: string) => copy(internal.knowledge.stateValue(id)));
  try {
    result = await runtime.initialize({ sessionId: 'lot5c-recovery-passive-acquisition-bound', observation: copy(initial),
      budgets: { targetLevels: 3, levelActionCaps: [32, 32, 32], maxActions: 32 } }, execution) as unknown as R;
    assertReleased(result as any); assert.notEqual(result.snapshot.lastDecision, OWNER);
    assert.deepEqual(result.command, table[0]!.command);
    const firstReturn = { ...copy(table[0]!.after), available_action_refs: ['ACTION6'] };
    result = await runtime.advance({ command: copy(result.command), observation: firstReturn, executionMs: 0 }, execution) as unknown as R;
    assert.equal(result.kind, 'boundary'); assert.ok(owner.state().core);
    result = await runtime.resume(execution) as unknown as R;
    assertReleased(result as any); assert.notEqual(result.snapshot.lastDecision, OWNER);
    assert.equal(result.command.action_ref, 'ACTION6');
    ownerBefore = copy(owner.state()); stateFactsBefore = facts().filter(fact => fact.key === 'observed_object_binding_state');
    assert.ok(stateFactsBefore.length > 0, 'Actual retained owner knowledge precedes the bounded passive return');
    const realRecord = owner.recordSource.bind(owner);
    owner.recordSource = (...args: any[]) => {
      assert.equal(args[5] ?? null, null, 'The controlled execution bound applies only to a passive call');
      injected.push({ before: args[0].observation_ref, after: args[1].observation_ref, command: copy(args[2]),
        deadlineMs: 0, now: 1, scope: 'NativeExecution supplied to this actual passive recordSource invocation only' });
      return realRecord(...args.slice(0, 7), { ...execution, deadlineMs: 0, now: () => 1 });
    };
    const selected = copy(result), returnedPacket = { ...copy(firstReturn), step_index: 2, frame_packet: [copy(firstReturn.frame_rows)] };
    result = await runtime.advance({ command: copy(selected.command), observation: returnedPacket, executionMs: 0 }, execution) as unknown as R;
    assert.equal(injected.length, 1); assert.equal(result.kind, 'stopped'); assert.equal(result.reason, 'native_acquisition_incomplete');
    assert.equal(result.command, null); assert.equal(result.authorization, null);
    assert.equal(result.snapshot.actions, 2); assert.equal(result.snapshot.caller.acquiredTransitions, 2);
    assert.deepEqual(result.snapshot.whyAct.analysis.map((row: R) => row.operation), ['OP29', 'OP30', 'OP31']);
    assert.equal(capture.records().length, 2); assert.equal(capture.records().at(-1)!.native.result, null);
    assert.deepEqual(capture.records().at(-1)!.native.memoryPuts, [], 'The bounded owner commits no attention mutation');
    ownerAfter = copy(owner.state()); assert.deepEqual(ownerAfter, ownerBefore, 'A bound commits no partial tracker acquisition');
    stateFactsAfter = facts().filter(fact => fact.key === 'observed_object_binding_state');
    assert.deepEqual(stateFactsAfter, stateFactsBefore, 'Old binding knowledge must not be relabeled freshly acquired');
    const prefix = internal.knowledge.stateValue(`prefix_evidence:${selected.authorization.decision_revision}`);
    retainedIncomplete = copy(prefix.native_acquisitions_incomplete);
    assert.equal(retainedIncomplete.length, 1);
    const stopped = retainedIncomplete[0]!, actual = capture.records().at(-1)!;
    assert.equal(stopped.family, OWNER); assert.equal(stopped.mode, 'passive');
    assert.equal(stopped.before, actual.input.before.observation_ref); assert.equal(stopped.after, actual.input.after.observation_ref);
    assert.deepEqual(stopped.command, selected.command);
    assert.equal(stopped.refusal.reason, 'observed_binding_acquisition_work_bound'); assert.equal(stopped.refusal.status, 'unknown');
    assert.equal(stopped.refusal.observation_ref, actual.input.after.observation_ref);
    assert.equal(stopped.refusal.level_epoch, actual.input.after.level_epoch); assert.equal(stopped.refusal.frame_hash, actual.input.after.frame_hash);
    assert.equal(stopped.refusal.release_authority, false); assert.equal(stopped.refusal.frontier.complete, false);
    const traces = result.snapshot.trace.filter((row: R) => row.kind === 'native_acquisition_incomplete');
    assert.deepEqual(traces.map(({ kind: _kind, ...row }: R) => row), retainedIncomplete);
    const resumed = await runtime.resume(execution) as unknown as R;
    assert.equal(resumed.kind, 'stopped'); assert.equal(resumed.reason, 'native_acquisition_incomplete');
    assert.equal(resumed.command, null); assert.equal(capture.records().length, 2);
  } catch (error: any) { failures.push({ name: error.name, message: error.message, stack: error.stack }); }
  finally { runtime.close('object_binding_passive_bound_proof_finished'); }
  const report = { schema: 'logos-engine.lot5c-passive-acquisition-bound-proof.v1', mode: 'passive-acquisition-bound',
    status: failures.length ? 'failed' : 'passed', startedAt, finishedAt: new Date().toISOString(),
    reconstruction: 'New recovery execution; no historical receipt reused', executionInputsBefore,
    injectedExecutionBounds: injected, ownerBefore, ownerAfter, stateFactsBefore, stateFactsAfter, retainedIncomplete, next: result,
    operations: capture.operations,
    journal: { ...capture.journal('lot5c-recovery-passive-acquisition-bound', 'passive-acquisition-bound'), originalReplayEligible: false, nativeExecutionBoundInjected: true },
    failures, qualification: 'Native execution-bound contract, not original unbounded-source equivalence. The ordinary factory selects both commands. Only the second passive binding acquisition receives an expired execution deadline; no owner result, tracker state, proposal, family priority or public command is fabricated.' };
  await saveBindingEvidence('passive-acquisition-bound', report);
  assert.equal(report.status, 'passed', JSON.stringify(failures));
});

test('an incomplete selected binding acquisition cannot invent a null source fact or release another action', async () => {
  const startedAt = new Date().toISOString(), executionInputsBefore = await commonProofInputs();
  const failures: R[] = [], injected: R[] = [];
  const plan = JSON.parse(await readFile(new URL('../docs/migration/lot5c-evidence/recovery/common/common-plan.json', import.meta.url), 'utf8'));
  const { initial, table } = bindingPublicTable('positive', plan);
  const runtime = await createNativeV6Runtime(await bindingDeclarations(), { now: () => 0 });
  const internal = runtime as unknown as R, capture = new BindingCapture(internal), owner = capture.owner;
  const execution: NativeExecution = { now: () => 0, deadlineMs: 360_000, yieldControl: async () => {} };
  let result: R | null = null, ownerBefore: R | null = null, ownerAfter: R | null = null;
  let stateFactsBefore: R[] = [], stateFactsAfter: R[] = [], retainedIncomplete: R[] = [], incompleteSourceFacts: R[] = [];
  const facts = (): R[] => internal.knowledge.stateValue('reasoning:memory').facts.map((id: string) => copy(internal.knowledge.stateValue(id)));
  try {
    result = await runtime.initialize({ sessionId: 'lot5c-recovery-selected-acquisition-bound', observation: copy(initial),
      budgets: { targetLevels: 3, levelActionCaps: [32, 32, 32], maxActions: 32 } }, execution) as unknown as R;
    assertReleased(result as any); assert.notEqual(result.snapshot.lastDecision, OWNER);
    assert.deepEqual(result.command, table[0]!.command);
    result = await runtime.advance({ command: copy(result.command), observation: copy(table[0]!.after), executionMs: 0 }, execution) as unknown as R;
    assert.equal(result.kind, 'boundary'); assert.ok(owner.state().core);
    result = await runtime.resume(execution) as unknown as R;
    assertReleased(result as any); assert.equal(result.snapshot.lastDecision, OWNER);
    assert.deepEqual(result.command, table[1]!.command);
    ownerBefore = copy(owner.state()); stateFactsBefore = facts().filter(fact => fact.key === 'observed_object_binding_state');
    assert.ok(stateFactsBefore.length > 0);
    const selected = copy(result), realRecord = owner.recordSource.bind(owner);
    owner.recordSource = (...args: any[]) => {
      assert.ok(args[5]?.binding_plan, 'The actual selected offer must reach this bounded acquisition unchanged');
      assert.deepEqual(args[2], selected.command);
      injected.push({ before: args[0].observation_ref, after: args[1].observation_ref, command: copy(args[2]),
        index: args[6] ?? 0, deadlineMs: 0, now: 1, scope: 'NativeExecution of the already selected recordSource only' });
      return realRecord(...args.slice(0, 7), { ...execution, deadlineMs: 0, now: () => 1 });
    };
    result = await runtime.advance({ command: copy(selected.command), observation: copy(table[1]!.after), executionMs: 0 }, execution) as unknown as R;
    assert.equal(injected.length, 1); assert.equal(result.kind, 'stopped'); assert.equal(result.reason, 'native_acquisition_incomplete');
    assert.equal(result.command, null); assert.equal(result.authorization, null);
    assert.equal(result.snapshot.actions, 2); assert.equal(result.snapshot.caller.acquiredTransitions, 2);
    assert.deepEqual(result.snapshot.whyAct.analysis.map((row: R) => row.operation), ['OP29', 'OP30', 'OP31']);
    const actual = capture.records().at(-1)!;
    assert.equal(capture.records().length, 2); assert.equal(actual.useLatestSourceProposal, true);
    assert.equal(actual.native.result, null); assert.deepEqual(actual.native.memoryPuts, []);
    ownerAfter = copy(owner.state()); assert.deepEqual(ownerAfter, ownerBefore);
    stateFactsAfter = facts().filter(fact => fact.key === 'observed_object_binding_state');
    assert.deepEqual(stateFactsAfter, stateFactsBefore);
    incompleteSourceFacts = facts().filter(fact => fact.key === `object_binding_event:${actual.input.before.revision}`);
    assert.deepEqual(incompleteSourceFacts, [], 'An incomplete selected acquisition is not a completed selected-null source result');
    const prefix = internal.knowledge.stateValue(`prefix_evidence:${selected.authorization.decision_revision}`);
    retainedIncomplete = copy(prefix.native_acquisitions_incomplete); assert.equal(retainedIncomplete.length, 1);
    const stopped = retainedIncomplete[0]!;
    assert.equal(stopped.family, OWNER); assert.equal(stopped.mode, 'selected'); assert.deepEqual(stopped.command, selected.command);
    assert.equal(stopped.before, actual.input.before.observation_ref); assert.equal(stopped.after, actual.input.after.observation_ref);
    assert.equal(stopped.refusal.reason, 'observed_binding_acquisition_work_bound'); assert.equal(stopped.refusal.status, 'unknown');
    assert.equal(stopped.refusal.observation_ref, actual.input.after.observation_ref);
    assert.equal(stopped.refusal.level_epoch, actual.input.after.level_epoch); assert.equal(stopped.refusal.frame_hash, actual.input.after.frame_hash);
    assert.equal(stopped.refusal.release_authority, false); assert.equal(stopped.refusal.frontier.complete, false);
    assert.deepEqual(result.snapshot.trace.filter((row: R) => row.kind === 'native_acquisition_incomplete')
      .map(({ kind: _kind, ...row }: R) => row), retainedIncomplete);
    const resumed = await runtime.resume(execution) as unknown as R;
    assert.equal(resumed.kind, 'stopped'); assert.equal(resumed.reason, 'native_acquisition_incomplete');
    assert.equal(resumed.command, null); assert.equal(capture.records().length, 2);
  } catch (error: any) { failures.push({ name: error.name, message: error.message, stack: error.stack }); }
  finally { runtime.close('object_binding_selected_bound_proof_finished'); }
  const report = { schema: 'logos-engine.lot5c-selected-acquisition-bound-proof.v1', mode: 'selected-acquisition-bound',
    status: failures.length ? 'failed' : 'passed', startedAt, finishedAt: new Date().toISOString(), executionInputsBefore,
    reconstruction: 'New recovery execution; no historical receipt reused', injectedExecutionBounds: injected,
    ownerBefore, ownerAfter, stateFactsBefore, stateFactsAfter, incompleteSourceFacts, retainedIncomplete, next: result,
    operations: capture.operations,
    journal: { ...capture.journal('lot5c-recovery-selected-acquisition-bound', 'selected-acquisition-bound'),
      originalReplayEligible: false, nativeExecutionBoundInjected: true }, failures,
    qualification: 'Native selected-acquisition bound after an actual ordinary Binding release. Only the acquisition execution deadline changes; no proposal, command, public return or learned state is injected. This is not unbounded Python equivalence.' };
  await saveBindingEvidence('selected-acquisition-bound', report);
  assert.equal(report.status, 'passed', JSON.stringify(failures));
});

test('the ordinary level clock bounds an actual selected acquisition after its real public return', async () => {
  const startedAt = new Date().toISOString(), executionInputsBefore = await commonProofInputs();
  const failures: R[] = [], clockProgressions: R[] = [];
  const plan = JSON.parse(await readFile(new URL('../docs/migration/lot5c-evidence/recovery/common/common-plan.json', import.meta.url), 'utf8'));
  assert.ok(plan.cases.some((item: R) => item.id === 'level-clock-acquisition-bound'));
  const { initial, table } = bindingPublicTable('positive', plan);
  let clockMs = 0;
  const now = () => clockMs, rawCallerDeadline = 900_000;
  const runtime = await createNativeV6Runtime(await bindingDeclarations(), { now });
  const internal = runtime as unknown as R, capture = new BindingCapture(internal), owner = capture.owner;
  const execution: NativeExecution = { now, deadlineMs: rawCallerDeadline, yieldControl: async () => {} };
  const observedRecordSource = owner.recordSource;
  let result: R | null = null, ownerBefore: R | null = null, ownerAfter: R | null = null;
  let stateFactsBefore: R[] = [], stateFactsAfter: R[] = [], retainedIncomplete: R[] = [], incompleteSourceFacts: R[] = [];
  const facts = (): R[] => internal.knowledge.stateValue('reasoning:memory').facts.map((id: string) => copy(internal.knowledge.stateValue(id)));
  try {
    result = await runtime.initialize({ sessionId: 'lot5c-recovery-level-clock-acquisition-bound', observation: copy(initial),
      budgets: { targetLevels: 3, levelActionCaps: [32, 32, 32], maxActions: 32 } }, execution) as unknown as R;
    assertReleased(result as any); assert.notEqual(result.snapshot.lastDecision, OWNER);
    assert.deepEqual(result.command, table[0]!.command);
    result = await runtime.advance({ command: copy(result.command), observation: copy(table[0]!.after), executionMs: 0 }, execution) as unknown as R;
    assert.equal(result.kind, 'boundary'); assert.ok(owner.state().core);
    result = await runtime.resume(execution) as unknown as R;
    assertReleased(result as any); assert.equal(result.snapshot.lastDecision, OWNER);
    assert.deepEqual(result.command, table[1]!.command);
    ownerBefore = copy(owner.state()); stateFactsBefore = facts().filter(fact => fact.key === 'observed_object_binding_state');
    assert.ok(stateFactsBefore.length > 0);
    const selected = copy(result), actualAfter = owner.after.bind(owner);
    owner.after = (...args: any[]) => {
      assert.deepEqual(args[0].actions[args[1]], selected.command);
      assert.deepEqual(args[5], table[1]!.after.frame_rows);
      const returned = actualAfter(...args);
      assert.ok(!returned || typeof returned.then !== 'function', 'The actual source after guard is synchronous');
      assert.equal(clockMs, 0); assert.equal(clockProgressions.length, 0);
      clockProgressions.push({ trigger: 'after_actual_selected_after_guard', before: args[2].observation_ref,
        after: args[3].observation_ref, returned: copy(returned), fromMs: clockMs, toMs: 360_001,
        rawCallerDeadline, changedRecordSourceArguments: false });
      clockMs = 360_001;
      return returned;
    };
    result = await runtime.advance({ command: copy(selected.command), observation: copy(table[1]!.after), executionMs: 0 }, execution) as unknown as R;
    assert.equal(clockProgressions.length, 1); assert.equal(owner.recordSource, observedRecordSource);
    assert.ok(clockMs < rawCallerDeadline, 'The caller deadline remains open; only the actual level allowance has expired');
    assert.equal(result.kind, 'stopped'); assert.equal(result.reason, 'native_acquisition_incomplete');
    assert.equal(result.command, null); assert.equal(result.authorization, null);
    assert.equal(result.snapshot.actions, 2); assert.equal(result.snapshot.caller.acquiredTransitions, 2);
    assert.deepEqual(result.snapshot.whyAct.analysis.map((row: R) => row.operation), ['OP29', 'OP30', 'OP31']);
    const actual = capture.records().at(-1)!;
    assert.equal(capture.records().length, 2); assert.equal(actual.useLatestSourceProposal, true);
    assert.equal(actual.native.result, null); assert.deepEqual(actual.native.memoryPuts, []);
    ownerAfter = copy(owner.state()); assert.deepEqual(ownerAfter, ownerBefore);
    stateFactsAfter = facts().filter(fact => fact.key === 'observed_object_binding_state');
    assert.deepEqual(stateFactsAfter, stateFactsBefore);
    incompleteSourceFacts = facts().filter(fact => fact.key === `object_binding_event:${actual.input.before.revision}`);
    assert.deepEqual(incompleteSourceFacts, [], 'An expired acquisition does not fabricate a completed selected-null source event');
    const prefix = internal.knowledge.stateValue(`prefix_evidence:${selected.authorization.decision_revision}`);
    retainedIncomplete = copy(prefix.native_acquisitions_incomplete); assert.equal(retainedIncomplete.length, 1);
    const stopped = retainedIncomplete[0]!;
    assert.equal(stopped.family, OWNER); assert.equal(stopped.mode, 'selected'); assert.deepEqual(stopped.command, selected.command);
    assert.equal(stopped.before, actual.input.before.observation_ref); assert.equal(stopped.after, actual.input.after.observation_ref);
    assert.equal(stopped.refusal.reason, 'observed_binding_acquisition_work_bound'); assert.equal(stopped.refusal.status, 'unknown');
    assert.equal(stopped.refusal.exhausted_bound, 'deadline'); assert.equal(stopped.refusal.frontier.deadline_ms, clockMs);
    assert.equal(stopped.refusal.observation_ref, actual.input.after.observation_ref);
    assert.equal(stopped.refusal.level_epoch, actual.input.after.level_epoch); assert.equal(stopped.refusal.frame_hash, actual.input.after.frame_hash);
    assert.equal(stopped.refusal.release_authority, false); assert.equal(stopped.refusal.frontier.complete, false);
    assert.deepEqual(result.snapshot.trace.filter((row: R) => row.kind === 'native_acquisition_incomplete')
      .map(({ kind: _kind, ...row }: R) => row), retainedIncomplete);
    const resumed = await runtime.resume(execution) as unknown as R;
    assert.equal(resumed.kind, 'stopped'); assert.equal(resumed.reason, 'native_acquisition_incomplete');
    assert.equal(resumed.command, null); assert.equal(capture.records().length, 2);
    assert.equal(owner.recordSource, observedRecordSource);
  } catch (error: any) { failures.push({ name: error.name, message: error.message, stack: error.stack }); }
  finally { runtime.close('object_binding_level_clock_bound_proof_finished'); }
  const report = { schema: 'logos-engine.lot5c-level-clock-acquisition-bound-proof.v1', mode: 'level-clock-acquisition-bound',
    status: failures.length ? 'failed' : 'passed', startedAt, finishedAt: new Date().toISOString(), executionInputsBefore,
    reconstruction: 'New recovery execution; no historical receipt reused', clockProgressions, rawCallerDeadline,
    recordSourceUnchanged: owner.recordSource === observedRecordSource, injectedAcquisitionDeadline: false,
    ownerBefore, ownerAfter, stateFactsBefore, stateFactsAfter, incompleteSourceFacts, retainedIncomplete, next: result,
    operations: capture.operations,
    journal: { ...capture.journal('lot5c-recovery-level-clock-acquisition-bound', 'level-clock-acquisition-bound'),
      originalReplayEligible: false, nativeExecutionBoundInjected: false, nativeRuntimeClockControlled: true }, failures,
    qualification: 'The ordinary runtime clock advances only after the actual selected after guard returned unchanged. The caller deadline remains longer than the expired level allowance. The runtime derives the acquisition deadline; recordSource receives no injected argument or result. This is a native scheduling proof, not original unbounded-source equivalence or measured latency.' };
  await saveBindingEvidence('level-clock-acquisition-bound', report);
  assert.equal(report.status, 'passed', JSON.stringify(failures));
});
