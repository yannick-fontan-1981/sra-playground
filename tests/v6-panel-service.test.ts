import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measurePanelService, panelServiceProjection, panelServiceInputCandidates } from '../src/logos-engine/v6-panel-service-observation.ts';
import { PanelServiceMemory, proposePanelService, panelServiceBefore, panelServiceAfter } from '../src/logos-engine/v6-panel-service-access.ts';
import { NestedIntegerTupleSet, nestedIntegerTupleHash } from '../src/logos-engine/v6-panel-service-pattern-set.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const file = (path: string): Buffer => readFileSync(new URL(path, root));
const compressed = (path: string): R => JSON.parse(gunzipSync(file(path)).toString());
const fixture = compressed('tests/fixtures/v6-panel-service-parity.json.gz');
const discovery = compressed(fixture.initialPublicCorpus.path);
const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');

function assertState(memory: PanelServiceMemory, expected: R): void {
  assert.deepEqual(memory.currentState(), expected.projection);
  assert.equal(memory.retainedDigest(expected.parentDigest), expected.digest);
}

function seeded(events: R[] = []): PanelServiceMemory {
  const memory = new PanelServiceMemory();
  for (const event of events) memory.applyEvent(clone(event));
  return memory;
}

test('panel parity pins 1786 unchanged source files and separates controlled returns from game evidence', () => {
  assert.equal(fixture.schema, 'logos-engine.v6.panel-service-parity.v1');
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.pinnedSourceFilesVerifiedBeforeImport, 1786);
  assert.equal(fixture.pinnedSourceFilesVerifiedAfterRun, 1786);
  for (const property of ['sourceModified', 'sourceMonkeyPatched', 'gameHostRunByExporter', 'gameSourceRead', 'oracleOrSolutionRead']) {
    assert.equal(fixture.qualification[property], false, property);
  }
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

test('all 100 untouched public initial rasters retain original panel admission without game dispatch', () => {
  assert.equal(discovery.games.length, 100);
  assert.equal(fixture.initialMeasurements.length, 100);
  for (const item of fixture.initialMeasurements as R[]) {
    const publicView = discovery.games.find((view: R) => view.game === item.game);
    assert.equal(publicView.observation.frame_hash, item.frameHash);
    assert.deepEqual(measurePanelService(publicView.packet.frame_rows), item.scene, item.game);
  }
  assert.deepEqual(fixture.initialMeasurements.filter((item: R) => item.scene).map((item: R) => item.game), ['RSWP']);
});

for (const item of fixture.patternSetCases as R[]) test(`original nested integer tuple set ${item.id}`, () => {
  const left = new NestedIntegerTupleSet(item.left), right = new NestedIntegerTupleSet(item.right);
  assert.deepEqual([...left], item.constructed);
  assert.deepEqual([...left.copy()], item.copy);
  assert.deepEqual([...left.union(right)], item.union);
  assert.deepEqual(item.left.map((value: any) => nestedIntegerTupleHash(value).toString()), item.hashes);
  assert.deepEqual([...left], item.constructed, 'Union must preserve its source set');
});

for (const item of fixture.cases as R[]) test(`original panel service ${item.id}`, () => {
  const a = clone(item.arguments), memory = seeded(item.seedEvents);
  if (item.beforeState) assertState(memory, item.beforeState);
  let actual: unknown;
  switch (item.operation) {
    case 'scene': actual = measurePanelService(a.rows, a.symbols); break;
    case 'projection': actual = panelServiceProjection(a.scene); break;
    case 'input_candidates': actual = panelServiceInputCandidates(a.rows, a.available, a.inherited); break;
    case 'propose': actual = proposePanelService(memory, a.obs, a.rows, a.inputs, a.limit, a.config); break;
    case 'record': actual = memory.record(a.before, a.command, a.after, a.rows, a.later, a.proposal, a.index); break;
    default: throw new Error('Unknown original panel operation: ' + item.operation);
  }
  assert.deepEqual(actual, item.expected, item.id);
  if (item.afterState) assertState(memory, item.afterState);
});

for (const item of fixture.guards as R[]) test(`original panel service guard ${item.id}`, () => {
  const a = clone(item.arguments);
  const actual = item.operation === 'before' ? panelServiceBefore(a.proposal, a.index, a.rows, a.meta)
    : panelServiceAfter(a.proposal, a.index, a.rows, a.later, a.meta);
  assert.deepEqual(actual, item.expected, item.id);
});

test('selection acquisition unlocks batching while configured appearance remains an execution hypothesis', () => {
  const first = fixture.cases.find((item: R) => item.id === 'propose:direct_initial_experiment');
  const batch = fixture.cases.find((item: R) => item.id === 'propose:selection_observed_batch');
  const selected = fixture.cases.find((item: R) => item.id === 'record:observed_selection');
  const application = fixture.cases.find((item: R) => item.id === 'propose:already_selected_application');
  assert.equal(first.expected.actions.length, 1);
  assert.ok(batch.expected.actions.length > 1);
  assert.equal(selected.afterState.projection.panel_memory.selection_observed, true);
  assert.equal(application.expected.panel_service_plan.kind, 'application');
  assert.deepEqual(application.expected.actions, [{ action_ref: 'ACTION5' }]);
  assert.equal(application.expected.facts.shared_turn_law_unknown, true);
  assert.ok(application.expected.compositions.every((composition: R) => composition.observed === false));
  const noEffect = fixture.cases.find((item: R) => item.id === 'record:application_pixels_changed_projection_unchanged');
  assert.equal(noEffect.expected[0].detail.pixel_changed, true);
  assert.equal(noEffect.expected[0].detail.no_panel_service_information, true);
  assert.ok(noEffect.afterState.projection.panel_memory.failed.length > 0);
});

test('source own events restore exact retained state with detached mutable exports and unchanged proposal state', () => {
  const cases = fixture.cases.filter((item: R) => item.operation === 'record') as R[];
  assert.ok(cases.length >= 8);
  for (const item of cases) {
    const memory = seeded([...item.seedEvents, ...item.expected]);
    assertState(memory, item.afterState);
    const beforeDigest = memory.retainedDigest(item.afterState.parentDigest);
    const exported = memory.currentState();
    exported.panel_memory.effects.length = 0;
    exported.panel_events.length = 0;
    assert.equal(memory.retainedDigest(item.afterState.parentDigest), beforeDigest);
  }
  for (const item of fixture.cases.filter((candidate: R) => candidate.operation === 'propose') as R[]) {
    assert.deepEqual(item.beforeState, item.afterState, item.id);
  }
});

test('source common envelopes contain current point support, binding, budget stops and application reconciliation', () => {
  const initial = fixture.commons.find((item: R) => item.id === 'public_initial');
  assert.equal(initial.proposal.field_subquestion, 'observed_composition_services');
  const step = initial.proposal.steps[0];
  assert.match(step.point_support.entity_ref, /^observed-composition-control:/);
  assert.deepEqual(step.point_binding, step.point_support);
  assert.deepEqual(Object.keys(step.expected_before).sort(), ['frame_hash', 'level_epoch', 'levels_completed', 'state']);
  for (const id of ['remaining_zero', 'remaining_negative']) {
    assert.equal(fixture.commons.find((item: R) => item.id === id).proposal, null);
  }
  const one = fixture.commons.find((item: R) => item.id === 'remaining_one');
  assert.equal(one.proposal.actions.length, 1);
  assert.equal(fixture.commons.find((item: R) => item.id === 'deadline_missing').error.name, 'ValueError');
});
