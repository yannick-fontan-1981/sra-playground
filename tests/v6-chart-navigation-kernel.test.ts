import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import { ChartNavigation } from '../src/logos-engine/v6-chart-navigation.ts';
import { createNativeV6Runtime, NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily, NativePublicObservation, NativeRuntimeYield } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const ID = 'public_chart_navigation', EPISODE = 'common-observation-frontier';
const reference = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', reference), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', reference), 'utf8')),
} as NativeV6Declarations;
const fixture = JSON.parse(gunzipSync(await readFile(new URL('../docs/migration/lot9a-evidence/reference-01/reference.json.gz', import.meta.url))).toString()) as R;
const budgets = { targetLevels: 3, levelActionCaps: [8, 8, 8], maxActions: 8 };
const execution: NativeExecution = { now: () => 0, deadlineMs: 360_000, yieldControl: async () => {} };

function packet(name: string, index: number, frames?: readonly string[]): NativePublicObservation {
  const value = copy(fixture.frames[name].public);
  value.step_index = index;
  if (frames) value.frame_packet = frames.map(frame => copy(fixture.frames[frame].rows));
  return value;
}

async function harness(ablate = false) {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 }), internal = runtime as unknown as R;
  const chart = internal.acquisitionFamilies.chart as ChartNavigation;
  assert.equal((internal.families as NativeFamily[]).filter(owner => owner.id === ID).length, 1);
  assert.equal((internal.families as NativeFamily[]).find(owner => owner.id === ID), chart);
  assert.deepEqual(chart.state(), (await ChartNavigation.create()).state(), 'Start from the real cold owner');
  const calls: R[] = [], sourceRestores: R[] = [], nativeRestores: R[] = [];
  const original = chart.recordSource.bind(chart), restore = chart.restore.bind(chart), restoreNative = chart.restoreNative.bind(chart);
  chart.recordSource = (...args) => {
    const beforeState = chart.state();
    const result = ablate ? null : original(...args);
    calls.push({ before: copy(args[0]), after: copy(args[1]), command: copy(args[2]),
      proposal: copy(args[5]), frames: copy(args[7]), beforeState, result: copy(result),
      afterState: chart.state(), acquired: !ablate });
    return result;
  };
  chart.restore = state => { restore(state); sourceRestores.push(chart.state()); };
  chart.restoreNative = state => { restoreNative(state); nativeRestores.push(chart.state()); };
  return { runtime, internal, chart, calls, sourceRestores, nativeRestores };
}
type Session = Awaited<ReturnType<typeof harness>>;

function fact(session: Session, key: string): R[] {
  return session.internal.knowledge.stateValue('reasoning:memory').facts
    .map((id: string) => session.internal.knowledge.stateValue(id)).filter((row: R) => row.key === key);
}

function selected(result: NativeRuntimeYield, step: R): void {
  assert.equal(result.kind, 'action', result.reason ?? 'The unfiltered production caller did not select Chart');
  assert.equal(result.snapshot.lastDecision, ID);
  assert.deepEqual(result.command, step.proposal.actions[0]);
  assert.ok(result.authorization);
  assert.equal(result.authorization.observation_ref, step.observation.observation_ref);
  const proposal = result.snapshot.proposal as R;
  assert.equal(proposal.material_access_subquestion, 'chart_navigation');
  assert.deepEqual(proposal.chart_plan, step.proposal.chart_plan, 'Complete source choice and SRC receipt');
  assert.equal(proposal.compositions[0].observed, false);
  assert.equal(proposal.chart_plan.choice.release_authority, false);
  assert.equal(proposal.bundle_template.operation_key, 'OP18');
  assert.equal(proposal.strategy_receipt.selected, 'factored_material_return');
  assert.equal((result.snapshot.whyAct as R).decision.decision.status, 'action_set_released');
}

function acquired(session: Session, step: R, index: number): void {
  assert.equal(session.calls.length, index + 1, 'The selected owner is not acquired again passively');
  const call = session.calls[index]!;
  assert.equal(call.acquired, true);
  assert.deepEqual(call.result, step.record, 'Complete original source return');
  assert.deepEqual(call.afterState, step.afterState, 'All fourteen source fields after acquisition');
  assert.deepEqual(call.frames, step.returnedFrames.map((name: string) => fixture.frames[name].rows));
  assert.deepEqual(session.chart.state(), step.afterState);
  const key = `chart_navigation_event:${call.before.revision}`;
  assert.equal(fact(session, key).length, 1);
  assert.deepEqual(session.internal.authority.memory.get(EPISODE, key).value, step.record);
  assert.deepEqual(session.internal.knowledge.stateValue(`family_state:${ID}`).source_state, step.afterState);
  assert.deepEqual(fact(session, 'chart_navigation_state').at(-1)!.value, step.afterState);
  assert.ok(session.sourceRestores.some(state => isDeepStrictEqual(state, step.afterState)), 'The source fact is actually restored');
  assert.deepEqual(session.internal.knowledge.stateValue(`reasoning:transition:${call.before.revision}`).caller_acquisition.selected_result.events, [step.record]);
}

test('Chart registers one cold owner at source position 24, with one shared SRC program and the same passive owner', async () => {
  const session = await harness();
  try {
    const source = declarations.strategy.declarations[0]!.configuration.factored_material_return.ordered_subquestions;
    assert.equal(source.indexOf('chart_navigation') + 1, 24);
    assert.deepEqual(source.slice(22, 25), ['ordered_reaction', 'chart_navigation', 'region_intervention']);
    const groups = (session.runtime.snapshot().coverage as R).sourceGroups;
    const material = groups.find((group: R) => group.id === 'factored_material_return'), index = material.entryPoints.indexOf('chart_navigation');
    assert.ok(index > 0); assert.equal(material.families[index], ID);
    assert.equal(material.entryPoints[index - 1], 'ordered_reaction');
    assert.equal(material.families.filter((id: string) => id === ID).length, 1);
    assert.equal((session.runtime.snapshot().coverage as R).fullV6Parity, false);
    const wrong = await ChartNavigation.create();
    assert.throws(() => new NativeV6Runtime({ sourceDigest: 'chart-owner-mismatch-contract',
      families: session.internal.families, authorityPolicy: declarations.common,
      callerStrategy: declarations.strategy.declarations[0]!.configuration,
      acquisitionFamilies: { ...session.internal.acquisitionFamilies, chart: wrong },
      maxPointOccurrences: declarations.common.input_domain.max_point_occurrences }), /same registered owner/);
  } finally { session.runtime.close('chart-registration-complete'); }
});

test('cold production caller acquires gain, intermediate boundary loss and the next conditional route once', async t => {
  const steps = fixture.sequences.primary.steps as R[], session = await harness();
  assert.equal(steps.length, 3);
  try {
    let result = await session.runtime.initialize({ sessionId: 'chart:synthetic',
      observation: packet(steps[0]!.beforeFrame, 0), budgets }, execution);
    for (const [index, step] of steps.entries()) {
      selected(result, step);
      assert.equal(session.calls.length, index, 'Planning and guarding acquire no physical return');
      assert.ok(session.runtime.inspectKnowledge().nodes['program:v6.chart_navigation.choose']);
      const nativeRestoreCount = session.nativeRestores.length;
      result = await session.runtime.advance({ command: result.command!,
        observation: packet(step.afterFrame, index + 1, step.returnedFrames), executionMs: 0 }, execution);
      assert.equal(result.kind, 'boundary'); acquired(session, step, index);
      assert.equal(result.snapshot.levelsCompleted, 0, 'Synthetic returns are not solved game levels');
      assert.deepEqual((result.snapshot.whyAct as R).analysis.map((row: R) => row.operation), ['OP29', 'OP30', 'OP31']);
      if (index + 1 < steps.length) {
        session.chart.restore((await ChartNavigation.create()).state());
        result = await session.runtime.resume(execution);
        assert.ok(session.nativeRestores.length > nativeRestoreCount, 'A real common graph restoration ran');
        assert.equal(session.calls.length, index + 1, 'Resume does not synthesize another physical return');
      }
    }
    assert.equal(session.chart.gains.length, 1); assert.equal(session.chart.grants.length, 1);
    assert.equal(session.chart.grants[0]!.status, 'local_permission_hypothesis_not_confirmed_transaction');
    assert.equal((session.runtime.snapshot().caller as R).acquiredTransitions, 3);
    t.diagnostic(JSON.stringify({ physicalReturns: 3, sourceAcquisitions: session.calls.length,
      sourceRestores: session.sourceRestores.length, nativeRestores: session.nativeRestores.length, solvedLevels: 0 }));
  } finally { session.runtime.close('chart-cold-causal-complete'); }
});

test('a contrary current anchor revises the actual common owner and retains its source refutation', async t => {
  const session = await harness(), steps = fixture.sequences.contraryAnchor.steps as R[];
  try {
    const step = steps[0]!;
    const result = await session.runtime.initialize({ sessionId: 'chart:synthetic', observation: packet(step.beforeFrame, 0), budgets }, execution);
    selected(result, step);
    const returned = await session.runtime.advance({ command: result.command!, observation: packet(step.afterFrame, 1, step.returnedFrames), executionMs: 0 }, execution);
    assert.equal(returned.kind, 'boundary'); acquired(session, step, 0);
    assert.equal(session.chart.position_status, 'current_anchor_refutes_predicted_arrival');
    assert.deepEqual(session.chart.visited, []); assert.deepEqual(session.chart.grants, []);
    assert.ok(step.record.events.includes('predicted_arrival_refuted_by_current_anchor'));
    t.diagnostic(JSON.stringify({ physicalReturns: 1, sourceAcquisitions: 1, contraryAnchor: true }));
  } finally { session.runtime.close('chart-contrary-anchor-complete'); }
});

test('ablating the selected acquisition preserves the physical return but removes the learned continuation', async t => {
  const session = await harness(true), steps = fixture.sequences.primary.steps as R[];
  try {
    const step = steps[0]!;
    let result = await session.runtime.initialize({ sessionId: 'chart:synthetic', observation: packet(step.beforeFrame, 0), budgets }, execution);
    selected(result, step);
    result = await session.runtime.advance({ command: result.command!, observation: packet(step.afterFrame, 1, step.returnedFrames), executionMs: 0 }, execution);
    assert.equal(result.kind, 'boundary'); assert.equal(result.snapshot.actions, 1);
    assert.equal(session.calls.length, 1); assert.equal(session.calls[0]!.acquired, false);
    assert.deepEqual(session.chart.gains, []); assert.deepEqual(session.chart.visited, []); assert.deepEqual(session.chart.evidence, []);
    assert.equal((session.runtime.snapshot().caller as R).acquiredTransitions, 1, 'The caller still receives the real public return');
    result = await session.runtime.resume(execution);
    assert.equal(result.kind, 'action'); assert.equal(result.snapshot.lastDecision, ID);
    assert.notDeepEqual((result.snapshot.proposal as R).chart_plan.offer, steps[1]!.proposal.chart_plan.offer);
    assert.equal((result.snapshot.proposal as R).chart_plan.offer.kind, 'annotation_dependency');
    assert.equal(session.calls.length, 1);
    t.diagnostic(JSON.stringify({ physicalReturns: 1, sourceAcquisitions: 0, suppressedAcquisitions: 1,
      changedContinuation: true, commandChangeClaimed: false }));
  } finally { session.runtime.close('chart-acquisition-ablation-complete'); }
});

for (const changed of [false, true]) test(`a retained Chart owner acquires one foreign return after its selection is disabled (scene changed: ${changed})`, async t => {
  const session = await harness(), first = fixture.sequences.primary.steps[0];
  const sourceCase = fixture.cases.find((row: R) => row.id === (changed
    ? 'unattributed_scene_withdraws_location' : 'unattributed_same_scene_preserves_location'));
  assert.ok(sourceCase);
  try {
    let result = await session.runtime.initialize({ sessionId: 'chart:synthetic', observation: packet(first.beforeFrame, 0),
      budgets: { ...budgets, maxActions: 2, levelActionCaps: [2, 2, 2] } }, execution);
    selected(result, first);
    result = await session.runtime.advance({ command: result.command!, observation: packet(first.afterFrame, 1, first.returnedFrames), executionMs: 0 }, execution);
    acquired(session, first, 0);
    const chartState = session.chart.state();
    // An actual supported graph edit disables future selection only. It does
    // not inject a source state or replace the production selection groups.
    await session.runtime.edit({ expectedGraphChain: result.snapshot.graphChain!,
      reason: 'Controlled passive-acquisition contract after a real cold gain',
      changes: [{ type: 'set_family_enabled', familyId: ID, enabled: false }] }, execution);
    result = await session.runtime.resume(execution);
    assert.equal(result.kind, 'action', result.reason ?? 'The current common caller has no foreign action');
    assert.notEqual(result.snapshot.lastDecision, ID);
    const selectedOwner = result.snapshot.lastDecision;
    const afterFrame = changed ? 'room_c_empty' : 'room_b_equal_held';
    const returnedFrames = changed ? ['room_c_boundary4', afterFrame] : [afterFrame];
    result = await session.runtime.advance({ command: result.command!, observation: packet(afterFrame, 2, returnedFrames), executionMs: 0 }, execution);
    assert.equal(result.snapshot.actions, 2); assert.equal(session.calls.length, 2);
    const passive = session.calls[1]!;
    assert.equal(passive.proposal, null, 'A foreign action has no chart proposal attribution');
    assert.deepEqual(passive.frames, returnedFrames.map(name => fixture.frames[name].rows));
    assert.deepEqual(passive.result, sourceCase.value);
    assert.deepEqual(session.chart.state(), sourceCase.afterState);
    assert.deepEqual(session.chart.evidence, chartState.evidence, 'Foreign pixels do not become active chart evidence');
    assert.deepEqual(session.chart.gains, chartState.gains);
    assert.deepEqual(session.chart.grants, chartState.grants);
    assert.deepEqual(fact(session, `chart_navigation_event:${passive.before.revision}`).at(-1)!.value, sourceCase.value);
    assert.deepEqual(session.internal.knowledge.stateValue(`family_state:${ID}`).source_state, sourceCase.afterState);
    t.diagnostic(JSON.stringify({ physicalReturns: 2, activeChartAcquisitions: 1, passiveChartCalls: 1,
      foreignSelectedOwner: selectedOwner, selectionDisabledThroughSupportedGraphEdit: true }));
  } finally { session.runtime.close('chart-passive-foreign-complete'); }
});
