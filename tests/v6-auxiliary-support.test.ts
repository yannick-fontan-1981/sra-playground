import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { AuxiliarySupportMemory, auxiliarySupportBefore, auxiliarySupportAfter } from '../src/logos-engine/v6-auxiliary-support.ts';
import * as preparation from '../src/logos-engine/v6-auxiliary-support-preparation.ts';
import * as continuation from '../src/logos-engine/v6-auxiliary-support-continuation.ts';
import { CoupledPairEvidenceMemory } from '../src/logos-engine/v6-coupled-pair-evidence.ts';
import { proposeCoupledPairGraph } from '../src/logos-engine/v6-coupled-pair-planning.ts';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-auxiliary-support-reference.json.gz', import.meta.url))).toString());
const auxiliaryKinds = new Set(['coupled_support_preparation', 'coupled_support_control_model']);
const supportedKinds = new Set([...auxiliaryKinds, 'coupled_pair_epoch_anchor', 'coupled_pair_evidence']);
const mainJournal = (): R => fixture.journals.find((row: R) => row.id === 'selection_parking_return_and_physical_group_verification');

test('auxiliary oracle preserves pinned source, raw ancestral envelopes and the native projection boundary', async () => {
  assert.equal(fixture.provenance.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.provenance.sourceModified, false);
  assert.match(fixture.provenance.qualification, /no game completion or private state/);
  assert.match(fixture.provenance.qualification, /not unported ancestral graph acquisition or the full inheritance digest/);
  for (const [path, expected] of Object.entries(fixture.provenance.sources)) {
    const bytes = await readFile(new URL('../reference/v6/' + fixture.provenance.commit + '/source/' + path, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, path);
  }
  for (const journal of fixture.journals) for (const step of journal.steps) {
    assert.deepEqual(step.expected.rawSourceEvents, [...step.expected.parentEvents, ...step.expected.auxiliaryLayerEvents], 'The source event stream is retained in full, not rewritten as native parity');
    assert.deepEqual(step.expected.unportedAncestorEvents, step.expected.parentEvents.filter((event: R) => !supportedKinds.has(event.kind)));
  }
});

for (const row of fixture.proposals) test('original auxiliary proposal: ' + row.id, async () => {
  const memory = new AuxiliarySupportMemory(); memory.restore(row.initial.auxiliary);
  const scene = fixture.scenes[row.scene], pair = structuredClone(row.initial.pair.pair_state), before = memory.state();
  const actual = memory.proposeGraph(pair, scene.observation, scene.rows, [], row.maxPrefix, row.config,
    () => proposeCoupledPairGraph(pair, scene.observation, scene.rows, [], row.maxPrefix, row.config)
      ?? { status: 'abstained', reason: 'graph_question_not_enabled' });
  assert.deepEqual(actual, row.expected, 'Exact original plan, parent priority, commands, identifiers and declared hypotheses');
  assert.deepEqual(memory.state(), before, 'Planning does not acquire or replace a witnessed effect');
  if (row.adapter) {
    const family = new SharedSeriesConstraint({} as any);
    family.pairs.restore(row.initial.pair); family.auxiliary.restore(row.initial.auxiliary);
    const adapted = await family.coupledPropose(scene.observation, scene.rows, [], row.adapter.remaining, row.config, row.adapter.levelDeadline);
    assert.deepEqual(adapted, row.adapter.expectedProposal, 'The complete original common wrapper includes exact point support and field_subquestion');
    if (row.adapter.expectedBound) {
      assert.ok(adapted); family.bind(adapted, null as any);
      assert.deepEqual(adapted, row.adapter.expectedBound, 'Current point binding matches the unchanged common adapter');
    }
  }
});

for (const row of fixture.guards) test('original auxiliary ' + row.operation + ': ' + row.id, () => {
  const first = fixture.scenes[row.first], second = fixture.scenes[row.second];
  const actual = row.operation === 'before' ? auxiliarySupportBefore(row.proposal, row.index, first.rows, row.meta)
    : auxiliarySupportAfter(row.proposal, row.index, first.rows, second.rows, row.meta);
  assert.deepEqual(actual, row.expected);
});

for (const row of fixture.journals) test('original auxiliary acquisition and reconstruction: ' + row.id, async context => {
  let memory = new AuxiliarySupportMemory(), pairs = new CoupledPairEvidenceMemory();
  memory.restore(row.initial.auxiliary); pairs.restore(row.initial.pair);
  assert.equal(memory.retainedDigest(row.initial.sourceParentDigest), row.initial.sourceAuxiliaryDigest);
  for (const [index, step] of row.steps.entries()) await context.test(String(index), () => {
    const operation = step.operation, first = fixture.scenes[operation.before], second = fixture.scenes[operation.after];
    assert.deepEqual(pairs.record(first.observation, operation.command, second.observation, first.rows, second.rows, operation.proposal, operation.index),
      step.expected.parentPairEvents);
    assert.deepEqual(pairs.state(), step.expected.pairAfterParent, 'The auxiliary layer sees the pair state after the actual parent acquisition');
    const events = memory.record(pairs.currentState(), first.observation, operation.command, second.observation, first.rows, second.rows, operation.proposal, operation.index);
    assert.deepEqual(events, step.expected.auxiliaryLayerEvents, 'Every own event and the auxiliary-produced pair update match source order');
    for (const event of events) if (event.kind === 'coupled_pair_evidence') pairs.applyEvent(event);
    assert.deepEqual(pairs.state(), step.expected.pair);
    assert.deepEqual(memory.state(), step.expected.auxiliary);
    assert.equal(memory.retainedDigest(step.expected.sourceParentDigest), step.expected.sourceAuxiliaryDigest, 'Exact layer digest with the supplied actual original parent digest');
    const restored = new AuxiliarySupportMemory(), restoredPairs = new CoupledPairEvidenceMemory();
    restored.restore(JSON.parse(JSON.stringify(memory.state()))); restoredPairs.restore(JSON.parse(JSON.stringify(pairs.state())));
    assert.deepEqual(restored.state(), memory.state()); assert.deepEqual(restoredPairs.state(), pairs.state());
    memory = restored; pairs = restoredPairs;
  });
});

const operations: Record<string, [(...args: any[]) => any, string[]]> = {
  mode_key: [continuation.auxiliarySupportModeKey, ['aux']],
  scene_key: [continuation.auxiliarySupportSceneKey, ['rows', 'aux']],
  recall: [continuation.auxiliarySupportRecall, ['models', 'aux', 'available']],
  observed_model: [continuation.auxiliarySupportObservedModel, ['models', 'aux', 'action', 'delta', 'evidence', 'refutation']],
  prefix: [continuation.auxiliarySupportPrefix, ['route', 'aux', 'rows', 'limit']],
  cached_route: [continuation.auxiliarySupportCachedRoute, ['aux', 'rows']],
  controls: [preparation.auxiliarySupportControls, ['state', 'available']],
  current_pair: [preparation.auxiliarySupportCurrentPair, ['rows', 'known']],
  occurrences: [preparation.auxiliarySupportOccurrences, ['rows', 'pair', 'floor']],
  erased: [preparation.auxiliarySupportErased, ['rows', 'items', 'floor']],
  select_question: [preparation.auxiliarySupportSelectQuestion, ['rows', 'state', 'available', 'remaining', 'parked']],
  parking_route: [preparation.auxiliarySupportParkingRoute, ['rows', 'state', 'aux', 'available', 'remaining']],
  group_control_question: [preparation.auxiliarySupportGroupControlQuestion, ['rows', 'state', 'aux', 'available']],
  group_control_response: [preparation.auxiliarySupportGroupControlResponse, ['rows', 'later', 'detail']],
};
for (const row of fixture.helpers) test('original auxiliary helper: ' + row.id, () => {
  const [invoke, names] = operations[row.operation]!;
  const args = structuredClone(row.arguments), before = structuredClone(args);
  assert.deepEqual(invoke(...names.map(name => args[name])), row.expected);
  assert.deepEqual(args, before, 'These measured helper inputs are not edited by hypothetical calculations');
});

test('V7 restores the common selection, parking, return, model and verified pair journal without duplicate acquisition', async () => {
  const row = mainJournal(), familyId = 'family_state:public_occurrence_recall';
  let family = new SharedSeriesConstraint({} as any);
  family.pairs.restore(row.initial.pair); family.auxiliary.restore(row.initial.auxiliary);
  // This journal begins with pair measurements only; later event order comes
  // from the actual SharedSeries record, not from merging projected histories.
  assert.deepEqual(row.initial.auxiliary.support_events, []);
  family.events = structuredClone(row.initial.pair.pair_events);
  const store = new NativeKnowledgeStore('auxiliary-support-source-layer-v35', 'auxiliary-common-journal');
  let rollback: R | null = null;
  const acquire = async (step: R, index: number): Promise<void> => {
    const operation = step.operation, first = fixture.scenes[operation.before], second = fixture.scenes[operation.after];
    const result = family.record(first.observation, second.observation, operation.command, first.rows, second.rows, operation.proposal, operation.index, second.public.frame_packet);
    assert.deepEqual(result.events, step.expected.rawSourceEvents.filter((event: R) => supportedKinds.has(event.kind)), 'Explicit transferred-layer projection, not a claim about missing ancestors');
    assert.deepEqual(family.pairs.state(), step.expected.pair); assert.deepEqual(family.auxiliary.state(), step.expected.auxiliary);
    const before = family.state();
    await store.commit([{ id: familyId, kind: 'family_state', family: family.id, value: before }],
      { workflow: 'v6.composition_strategy.choose', step: 'coupled_support_composition', statement: 'acquire.' + index });
    const stored = store.stateValue(familyId) as R;
    family = new SharedSeriesConstraint({} as any); family.restore(stored);
    assert.deepEqual(family.state(), before); assert.deepEqual(family.auxiliary.state(), step.expected.auxiliary);
    if (index === 1) rollback = stored;
  };
  for (const [index, step] of row.steps.entries()) await acquire(step, index);
  const complete = family.state();
  assert.equal(family.auxiliary.state().support_state!.phase, 'group');
  assert.equal(family.auxiliary.state().support_state!.return_method.status, 'paired_control_revalidated');
  assert.ok(Object.keys(family.auxiliary.state().support_models).length > 0);
  const checkpoint = rollback!;
  await store.commit([{ id: familyId, kind: 'family_state', family: family.id, value: checkpoint }],
    { workflow: 'v6.composition_strategy.choose', step: 'restore', statement: 'earlier.witnessed.state' });
  family.restore(store.stateValue(familyId) as R);
  for (let index = 2; index < row.steps.length; index++) await acquire(row.steps[index], index);
  assert.deepEqual(family.state(), complete, 'Reacquisition after a real versioned-node rollback reproduces events and digest');
  const retainedAuxiliary = family.auxiliary.state(), retainedPair = family.pairs.state();
  for (const change of [
    (state: R) => { state.events.find((event: R) => event.kind === 'coupled_support_control_model').model.controls.ACTION1.witnesses[0].delta[0] = 999; },
    (state: R) => { state.events.filter((event: R) => event.kind === 'coupled_support_preparation').at(-1).state.parked = []; },
    (state: R) => { state.events.pop(); },
    (state: R) => { state.digest = 'changed'; },
  ]) {
    const corrupted = structuredClone(complete); change(corrupted);
    assert.throws(() => family.restore(corrupted));
    assert.deepEqual(family.state(), complete); assert.deepEqual(family.auxiliary.state(), retainedAuxiliary); assert.deepEqual(family.pairs.state(), retainedPair);
  }
});

test('auxiliary snapshots, returned events and rejected projection restores preserve the owned evidence', () => {
  const row = mainJournal(), step = row.steps[1], operation = step.operation;
  const memory = new AuxiliarySupportMemory(); memory.restore(row.steps[0].expected.auxiliary);
  const first = fixture.scenes[operation.before], second = fixture.scenes[operation.after];
  const events = memory.record(step.expected.pairAfterParent.pair_state, first.observation, operation.command, second.observation, first.rows, second.rows, operation.proposal, operation.index);
  const retained = memory.state(), digest = memory.retainedDigest('parent');
  events[0]!.model.controls.ACTION1.witnesses[0].delta[0] = 999;
  events.at(-1)!.state.box[0] = 999;
  assert.deepEqual(memory.state(), retained); assert.equal(memory.retainedDigest('parent'), digest);
  const snapshot = memory.state() as R; snapshot.support_events.pop();
  assert.deepEqual(memory.state(), retained);
  for (const change of [
    (state: R) => { state.support_state.box[0] = 999; },
    (state: R) => { state.support_models = {}; },
    (state: R) => { state.support_events.pop(); },
    (state: R) => { state.support_events.push({ kind: 'unported_ancestor' }); },
  ]) {
    const corrupted = structuredClone(retained) as R; change(corrupted);
    assert.throws(() => memory.restore(corrupted as any)); assert.deepEqual(memory.state(), retained);
  }
});
