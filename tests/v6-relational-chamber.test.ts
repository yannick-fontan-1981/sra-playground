import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureRelationalChamber, relationalChamberProjection, relationalChamberInputCandidates } from '../src/logos-engine/v6-relational-chamber-observation.ts';
import { RelationalChamberMemory, proposeRelationalChamber, relationalChamberBefore, relationalChamberAfter,
  learnChamberRelations, predictChamberRelations, inverseChamberRelations } from '../src/logos-engine/v6-relational-chamber-access.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const file = (path: string): Buffer => readFileSync(new URL(path, root));
const compressed = (path: string): R => JSON.parse(gunzipSync(file(path)).toString());
const fixture = compressed('tests/fixtures/v6-relational-chamber-parity.json.gz');
const discovery = compressed(fixture.initialPublicCorpus.path);
const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
function assertState(memory: RelationalChamberMemory, expected: R): void {
  assert.deepEqual(memory.currentState(), expected.projection);
  assert.equal(memory.retainedDigest(expected.parentDigest), expected.digest);
}
function seeded(events: R[] = []): RelationalChamberMemory {
  const memory = new RelationalChamberMemory();
  for (const event of events) memory.applyEvent(clone(event));
  return memory;
}

test('chamber parity pins original V5/V6 and qualifies synthetic returns separately from game evidence', () => {
  assert.equal(fixture.schema, 'logos-engine.v6.relational-chamber-parity.v1');
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.pinnedSourceFilesVerifiedBeforeImport, 1786);
  assert.equal(fixture.pinnedSourceFilesVerifiedAfterRun, 1786);
  for (const key of ['sourceModified', 'sourceMonkeyPatched', 'gameHostRunByExporter', 'gameSourceRead', 'oracleOrSolutionRead']) assert.equal(fixture.qualification[key], false);
  assert.equal(fixture.qualification.physicalActions, 0);
  assert.match(fixture.qualification.controlledReturns, /never game-success evidence/);
  assert.match(fixture.qualification.digestScope, /separate integration gate/);
  const manifest = JSON.parse(file(`reference/v6/${fixture.sourceCommit}/manifest.json`).toString());
  assert.equal(Object.keys(manifest.files).length, 1786);
  for (const [path, descriptor] of Object.entries(manifest.files) as [string, R][]) {
    assert.equal(hash(file(`reference/v6/${fixture.sourceCommit}/source/${path}`)), descriptor.sha256, path);
  }
  for (const [path, digest] of Object.entries(fixture.sourceHashes)) assert.equal(manifest.files[path].sha256, digest, path);
  assert.equal(hash(file(fixture.generator)), fixture.generatorSha256);
  assert.equal(hash(file(fixture.policySource)), fixture.policySourceSha256);
  assert.equal(hash(file(fixture.initialPublicCorpus.path)), fixture.initialPublicCorpus.sha256);
  assert.equal(fixture.initialPublicCorpus.recordedActions, 0);
  assert.equal(fixture.initialPublicCorpus.recordedLevelJumps, 0);
});

test('all 100 untouched public initial rasters preserve source admission using only geometry', () => {
  assert.equal(discovery.games.length, 100);
  assert.equal(fixture.initialMeasurements.length, 100);
  for (const item of fixture.initialMeasurements as R[]) {
    const publicView = discovery.games.find((view: R) => view.game === item.game);
    assert.equal(publicView.observation.frame_hash, item.frameHash);
    assert.deepEqual(measureRelationalChamber(publicView.packet.frame_rows), item.scene, item.game);
  }
  assert.ok(fixture.initialMeasurements.some((item: R) => item.scene !== null));
  assert.ok(fixture.initialMeasurements.some((item: R) => item.scene === null));
});

for (const item of fixture.cases as R[]) test(`original relational chamber ${item.id}`, () => {
  const a = clone(item.arguments), memory = seeded(item.seedEvents);
  if (item.beforeState) assertState(memory, item.beforeState);
  let actual: unknown;
  switch (item.operation) {
    case 'scene': actual = measureRelationalChamber(a.rows); break;
    case 'projection': actual = relationalChamberProjection(a.scene); break;
    case 'input_candidates': actual = relationalChamberInputCandidates(a.rows, a.available, a.inherited); break;
    case 'learn': actual = learnChamberRelations(a.scene, a.memory, a.ref); break;
    case 'predict': actual = predictChamberRelations(a.scene, a.memory, a.settings); break;
    case 'inverse': actual = inverseChamberRelations(a.scene, a.memory, a.config); break;
    case 'propose': actual = proposeRelationalChamber(memory, a.obs, a.rows, a.inputs, a.limit, a.config); break;
    case 'record': actual = memory.record(a.before, a.command, a.after, a.rows, a.later, a.proposal, a.index); break;
    default: throw new Error('Unknown chamber operation: ' + item.operation);
  }
  assert.deepEqual(actual, item.expected, item.id);
  if (item.afterState) assertState(memory, item.afterState);
});

for (const item of fixture.guards as R[]) test(`original relational chamber guard ${item.id}`, () => {
  const a = clone(item.arguments);
  const actual = item.operation === 'before' ? relationalChamberBefore(a.proposal, a.index, a.rows, a.meta)
    : relationalChamberAfter(a.proposal, a.index, a.rows, a.later, a.meta);
  assert.deepEqual(actual, item.expected, item.id);
});

test('observed edit knowledge changes experiment into guarded contribution while contradiction blocks the next proposal', () => {
  const find = (id: string): R => fixture.cases.find((item: R) => item.id === id);
  const first = find('propose:public_initial'), batch = find('propose:known_edges_batch');
  assert.equal(first.expected.chamber_relation_plan.kind, 'relation_experiment');
  assert.equal(first.expected.actions.length, 1);
  assert.equal(batch.expected.chamber_relation_plan.kind, 'conditional_relation_contribution');
  assert.ok(batch.expected.actions.length > 1);
  const acquired = find('record:observed_edit_and_rows');
  assert.ok(Object.keys(acquired.expected[0].memory.edges).length > 0);
  assert.equal(acquired.expected[0].detail.prediction_matched, true);
  const contradiction = find('record:changed_control_contradicts_rows');
  assert.ok(contradiction.expected[0].memory.conflicts.length > 0);
  assert.equal(find('propose:learned_contradiction_blocks').expected.reason, 'shared_relation_rows_contradicted');
  assert.equal(find('propose:pointing_unavailable').expected.reason, 'pointing_unavailable');
  assert.equal(find('propose:trials_exhausted').expected.reason, 'relation_trials_exhausted');
  assert.equal(find('inverse:variable_refusal').expected, null);
  assert.equal(find('scene:ambiguous_two_grids').expected, null);
  for (const name of ['before_second_prediction_unknown', 'before_second_prediction_altered']) {
    assert.equal(fixture.guards.find((item: R) => item.id === name).expected.admitted, false);
  }
  assert.equal(fixture.guards.find((item: R) => item.id === 'after_prediction_unknown').expected.matched, null);
});

test('own events restore exact state and never share mutable exports or mutate proposal-time knowledge', () => {
  const cases = fixture.cases.filter((item: R) => item.operation === 'record') as R[];
  assert.ok(cases.length >= 5);
  for (const item of cases) {
    const memory = seeded([...item.seedEvents, ...item.expected]);
    assertState(memory, item.afterState);
    const digest = memory.retainedDigest(item.afterState.parentDigest), state = memory.currentState();
    state.relation_memory.evidence.length = 0; state.relation_events.length = 0;
    assert.equal(memory.retainedDigest(item.afterState.parentDigest), digest);
    assert.equal(memory.eventCount, item.seedEvents.length + item.expected.length);
  }
  for (const item of fixture.cases.filter((value: R) => value.operation === 'propose')) assert.deepEqual(item.beforeState, item.afterState, item.id);
});

test('common source wrapper keeps point support and action budgets separate from component inference', () => {
  const initial = fixture.commons.find((item: R) => item.id === 'initial');
  assert.equal(initial.proposal.field_subquestion, 'observed_composition_services');
  const step = initial.proposal.steps[0];
  assert.match(step.point_support.entity_ref, /^observed-composition-control:/);
  assert.deepEqual(step.point_binding, step.point_support);
  assert.deepEqual(Object.keys(step.expected_before).sort(), ['frame_hash', 'level_epoch', 'levels_completed', 'state']);
  for (const id of ['remaining_zero', 'remaining_negative']) assert.equal(fixture.commons.find((item: R) => item.id === id).proposal, null);
  assert.equal(fixture.commons.find((item: R) => item.id === 'remaining_one').proposal.actions.length, 1);
  assert.equal(fixture.commons.find((item: R) => item.id === 'deadline_missing').error.name, 'ValueError');
});
