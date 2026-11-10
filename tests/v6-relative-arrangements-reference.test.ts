import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { readEvidenceSync } from './helpers/chunked-evidence.ts';
import { RelativeArrangements } from '../src/logos-engine/v6-relative-arrangements.ts';
import {
  relativeArrangementRectangles, relativeArrangementCell, relativeArrangementPads,
  relativeArrangementProject, translatedRelativeArrangementTargets, relativeArrangementEffect,
} from '../src/logos-engine/v6-relative-arrangements-geometry.ts';
import {
  relativeArrangementAssignments, relativeArrangementOptions, relativeArrangementTrialKey,
} from '../src/logos-engine/v6-relative-arrangements-planner.ts';
import { ObservedInputDomain, measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';

const fixture = JSON.parse(gunzipSync(readEvidenceSync(new URL('./fixtures/v6-relative-arrangements-reference.json.gz', import.meta.url))).toString('utf8'));
const sourceRoot = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/', import.meta.url);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// family.py exports list(set). Only this unordered collection is normalized.
// Rank vectors, ordered alternatives, DFS pad cells and SRC receipts stay exact.
function lexicographic(left: any, right: any): number {
  if (Array.isArray(left) && Array.isArray(right)) {
    for (let index = 0; index < Math.min(left.length, right.length); index++) {
      const compared = lexicographic(left[index], right[index]);
      if (compared) return compared;
    }
    return left.length - right.length;
  }
  return left < right ? -1 : left > right ? 1 : 0;
}
function normalizedState(value: any): any {
  const copied = clone(value);
  copied.failed.sort(lexicographic);
  return copied;
}
function assertState(actual: any, expected: any, label: string): void {
  assert.equal(new Set(actual.failed.map((trial: any) => relativeArrangementTrialKey(trial))).size, actual.failed.length, `${label}: failed is a set`);
  assert.deepEqual(normalizedState(actual), normalizedState(expected), label);
}

test('RelativeArrangements oracle pins the unchanged family, DRM, SRC and consumed original dependencies', async () => {
  assert.equal(fixture.provenance.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.match(fixture.provenance.scope, /not router\/game parity/);
  assert.equal(fixture.provenance.stateNormalization.field, 'failed');
  assert.equal(fixture.provenance.stateNormalization.otherOrdersPreserved, true);
  for (const [name, expected] of Object.entries(fixture.provenance.sources) as [string, { bytes: number; sha256: string }][]) {
    const bytes = await readFile(new URL(name, sourceRoot));
    assert.equal(bytes.length, expected.bytes, name);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, name);
  }
  const family = new RelativeArrangements();
  assert.deepEqual(family.configuration, fixture.configuration);
});

for (const row of fixture.cells) test(`original arrangement cell measurement: ${row.id}`, () => {
  assert.deepEqual(relativeArrangementCell(row.rows, row.x, row.y, row.size), row.expected);
});

for (const row of fixture.initial) test(`original projection, complete SRC proposal and refusal: ${row.id}`, async () => {
  const family = new RelativeArrangements();
  if (row.observationMode === 'original-public-measurement') {
    assert.deepEqual(await measureNativeObservation(row.public, row.public.step_index, fixture.provenance.observationScope), row.observation);
  } else {
    assert.equal(row.observationMode, 'synthetic-support-corruption');
    assert.match(row.id, /point-support/);
  }
  assert.deepEqual(relativeArrangementRectangles(row.observation), row.rectangles);
  const layout = relativeArrangementProject(row.observation, row.public.frame_rows);
  assert.deepEqual(layout, row.layout);
  if (layout) {
    assert.deepEqual(relativeArrangementPads(row.observation, row.public.frame_rows, layout.board, layout.size), row.layout.pads);
    assert.deepEqual(translatedRelativeArrangementTargets(layout), row.targets);
  }
  const proposal = await family.propose(row.observation, row.public.frame_rows, row.inputs, row.remaining);
  assert.deepEqual(proposal, row.proposal);
  assert.deepEqual(family.last, row.diagnostic);
  assertState(family.state(), row.state, row.id);
  if (proposal) {
    assert.equal(proposal.kind, 'public_relative_arrangement');
    assert.equal(proposal.actions.length, 1);
    assert.equal(proposal.arrangement_plan.workflow.workflow, 'v6.relative_arrangements.choose');
    assert.equal(proposal.arrangement_plan.workflow.src_status, 'completed');
    assert.deepEqual(proposal.arrangement_plan.workflow, row.proposal.arrangement_plan.workflow);
  }
});

for (const row of fixture.planner) test(`original bounded assignments and numerically ordered conditional offers: ${row.id}`, () => {
  const a = row.arguments;
  const before = clone(a);
  assert.deepEqual(relativeArrangementAssignments(a.layout, a.targets, a.config.maximum_assignments), row.assignments);
  const failed = new Set<string>(a.failed.map((trial: any) => relativeArrangementTrialKey(trial)));
  assert.deepEqual(relativeArrangementOptions(a.layout, a.targets, a.models, a.selection_ref, failed, a.config), row.expected);
  assert.deepEqual(a, before, 'finite planning does not alter observed layouts or acquired records');
});

for (const session of fixture.sessions) test(`original selected experiment, response acquisition and restored continuation: ${session.id}`, async () => {
  const family = new RelativeArrangements();
  for (const [index, row] of session.steps.entries()) {
    const label = `${session.id} step ${index}`;
    assertState(family.state(), row.stateBefore, `${label} initial owner state`);
    assert.deepEqual(await measureNativeObservation(row.beforePublic, row.beforePublic.step_index, fixture.provenance.observationScope), row.beforeObservation);
    const domain = new ObservedInputDomain(250);
    assert.deepEqual(domain.candidates(row.beforeObservation), row.inputs);
    const restored = new RelativeArrangements();
    restored.restore(clone(row.stateBefore));
    const proposal = await family.propose(row.beforeObservation, row.beforePublic.frame_rows, row.inputs, row.remaining);
    assert.deepEqual(proposal, row.proposal, `${label} complete proposal and SRC receipt`);
    assert.deepEqual(await restored.propose(row.beforeObservation, row.beforePublic.frame_rows, row.inputs, row.remaining), row.proposal, `${label} restored decision`);
    assertState(family.state(), row.stateAfterPropose, `${label} proposal owner state`);
    assertState(restored.state(), row.stateAfterPropose, `${label} restored proposal owner state`);
    if (!row.command) continue;
    assert.ok(proposal, `${label} selected-only acquisition requires its proposal`);
    await family.bind(proposal, domain);
    assert.deepEqual(proposal, row.boundProposal, `${label} measured point binding`);
    assert.deepEqual(family.before(proposal, 0, row.beforePublic, row.beforeObservation), row.beforeGuard, `${label} current guard`);
    assert.equal(row.beforeGuard.admitted, true);
    assert.deepEqual(await measureNativeObservation(row.afterPublic, row.afterPublic.step_index, fixture.provenance.observationScope), row.afterObservation);
    assert.deepEqual(family.after(proposal, 0, row.beforeObservation, row.afterObservation, row.beforePublic.frame_rows, row.afterPublic.frame_rows), row.afterGuard);
    const result = await family.record(row.beforeObservation, row.afterObservation, row.command, row.beforePublic.frame_rows, row.afterPublic.frame_rows, proposal, 0);
    assert.deepEqual(result, row.record, `${label} acquired event`);
    assertState(family.state(), row.stateAfter, `${label} acquired owner state`);
    const checkpoint = new RelativeArrangements();
    checkpoint.restore(clone(row.stateAfterPropose));
    assert.deepEqual(await checkpoint.record(row.beforeObservation, row.afterObservation, row.command, row.beforePublic.frame_rows, row.afterPublic.frame_rows, clone(row.boundProposal), 0), row.record, `${label} record after restore without transient layout`);
    assertState(checkpoint.state(), row.stateAfter, `${label} restored acquisition`);
  }
});

for (const row of fixture.records) test(`original response classification, failed trial and epoch state: ${row.id}`, async () => {
  const family = new RelativeArrangements();
  family.restore(clone(row.stateBefore));
  assert.deepEqual(relativeArrangementProject(row.beforeObservation, row.beforePublic.frame_rows), row.beforeLayout);
  assert.deepEqual(relativeArrangementProject(row.afterObservation, row.afterPublic.frame_rows), row.afterLayout);
  assert.deepEqual(relativeArrangementEffect(row.beforeLayout, row.afterLayout, row.command), row.effect);
  assert.deepEqual(await family.record(row.beforeObservation, row.afterObservation, row.command, row.beforePublic.frame_rows, row.afterPublic.frame_rows, clone(row.proposal), 0), row.record);
  assertState(family.state(), row.stateAfter, `${row.id} acquired state`);
  const restored = new RelativeArrangements();
  restored.restore(clone(row.stateAfter));
  const next = await family.propose(row.afterObservation, row.afterPublic.frame_rows, row.nextInputs, row.nextRemaining);
  assert.deepEqual(next, row.nextProposal);
  assert.deepEqual(await restored.propose(row.afterObservation, row.afterPublic.frame_rows, row.nextInputs, row.nextRemaining), row.nextProposal);
  assertState(family.state(), row.stateAfterNext, `${row.id} next state`);
  assertState(restored.state(), row.stateAfterNext, `${row.id} restored next state`);
});

for (const row of fixture.effects) test(`original direct public effect measurement: ${row.id}`, () => {
  assert.deepEqual(relativeArrangementEffect(row.before, row.after, row.command), row.expected);
});

for (const row of fixture.guards.cases) test(`original arrangement scope guard: ${row.id}`, () => {
  const family = new RelativeArrangements();
  family.restore(clone(fixture.guards.state));
  assert.deepEqual(family.before(clone(row.proposal), 0, row.public, row.observation), row.expected);
  assert.equal(row.expected.admitted, row.id === 'current');
});

for (const row of fixture.guards.errors) test(`original explicit binding rejection: ${row.id}`, async () => {
  const family = new RelativeArrangements();
  family.restore(clone(fixture.guards.state));
  const before = family.state();
  await assert.rejects(async () => {
    if (row.operation === 'bind') await family.bind(clone(row.proposal), new ObservedInputDomain(250));
    else await family.record(row.observation, fixture.guards.afterObservation, row.command,
      fixture.guards.beforePublic.frame_rows, fixture.guards.afterPublic.frame_rows, clone(row.proposal), 0);
  }, (error: unknown) => error instanceof Error && error.message.includes(row.message));
  assertState(family.state(), before, 'unbound response cannot mutate acquired state');
});

test('different measured returns after the same public experiment change the following source decision', () => {
  const left = fixture.sessions.find((s: any) => s.id === 'discriminating-return-unit');
  const right = fixture.sessions.find((s: any) => s.id === 'discriminating-return-opposite');
  assert.deepEqual(left.steps[0].beforeObservation, right.steps[0].beforeObservation);
  assert.deepEqual(left.steps[1].proposal, right.steps[1].proposal);
  assert.deepEqual(left.steps[1].command, right.steps[1].command);
  assert.equal(left.steps[1].record.status, 'single_object_and_actuator_displacement');
  assert.equal(right.steps[1].record.status, 'single_object_and_actuator_displacement');
  assert.notDeepEqual(left.steps[1].record.delta, right.steps[1].record.delta);
  assert.notDeepEqual(left.steps[2].proposal.actions, right.steps[2].proposal.actions);
  for (const session of [left, right]) {
    assert.ok(session.steps[2].proposal.arrangement_plan.offer.model_evidence.length > 0);
    assert.deepEqual(session.steps[1].record.preserved_objects, [[5, 4, 12]]);
  }
});

test('failed trials are excluded, while a new epoch resets local models and retains events', () => {
  const failed = fixture.sessions.find((s: any) => s.id === 'failed_trial');
  assert.ok(failed.steps[1].stateAfter.failed.length > 0);
  const excluded = new Set(failed.steps[1].stateAfter.failed.map((trial: any) => relativeArrangementTrialKey(trial)));
  if (failed.steps[2].proposal?.arrangement_plan.offer.trial) {
    assert.equal(excluded.has(relativeArrangementTrialKey(failed.steps[2].proposal.arrangement_plan.offer.trial)), false);
  }
  const boundary = fixture.records.find((r: any) => r.id === 'official-boundary-retains-events-resets-epoch-models');
  assert.equal(boundary.record.status, 'official_boundary');
  assert.deepEqual(boundary.stateAfterNext.models, []);
  assert.deepEqual(boundary.stateAfterNext.failed, []);
  assert.equal(boundary.stateAfterNext.selection_ref, null);
  assert.equal(boundary.stateAfterNext.epoch, boundary.afterObservation.level_epoch);
  assert.deepEqual(boundary.stateAfterNext.events, boundary.stateAfter.events);
  assert.ok(boundary.stateAfterNext.events.length > 0);
});

test('restoration and returned state do not alias the retained source evidence', () => {
  const row = fixture.sessions.find((s: any) => s.id === 'selected_displacement').steps.find((r: any) => r.stateAfter?.models.length);
  assert.ok(row);
  const retained = clone(row.stateAfter), supplied = clone(retained), family = new RelativeArrangements();
  family.restore(supplied);
  supplied.models[0].evidence.push('external mutation');
  supplied.events.length = 0;
  assertState(family.state(), retained, 'restore deep copies acquired evidence');
  const exposed = family.state() as any;
  exposed.models[0].delta[0] += 100;
  exposed.events.length = 0;
  assertState(family.state(), retained, 'state export deep copies acquired evidence');
  assert.deepEqual(Object.keys(family.state()).sort(), ['epoch', 'events', 'failed', 'models', 'selection_ref']);
});
