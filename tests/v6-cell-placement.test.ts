import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { cellPatchCenter, validateCellPatchGeometry, measureCellPatchFields, projectCellPatch,
  cellPatchChanges } from '../src/logos-engine/v6-cell-patch-observation.ts';
import { lineWindows, lineInsertions, linePlace, searchLines, NativeLineSearchDomainError } from '../src/logos-engine/v6-supported-lines.ts';
import { CellPlacementMemory, cellPlacementBefore, cellPlacementAfter } from '../src/logos-engine/v6-cell-placement.ts';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const oracle = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-cell-placement-reference.json.gz', import.meta.url))).toString());
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/', import.meta.url);
const copy = <T>(value: T): T => structuredClone(value);

function fromState(id: string): CellPlacementMemory {
  const memory = new CellPlacementMemory();
  memory.restore(copy(oracle.states[id].projection));
  assert.deepEqual(memory.state(), oracle.states[id].projection);
  assert.equal(memory.retainedDigest(oracle.states[id].sourceParentDigest), oracle.states[id].sourceDigest);
  return memory;
}

function sharedFromState(id: string): SharedSeriesConstraint {
  const family = new SharedSeriesConstraint(oracle.policy.recall);
  for (const original of oracle.states[id].events) {
    const event = copy(original);
    if (event.kind === 'cell_patch_placement_evidence') family.cells.applyEvent(event);
    else family.memory.applyEvent(event);
    family.events.push(copy(event));
  }
  const rebuilt = new SharedSeriesConstraint(oracle.policy.recall);
  rebuilt.restore(family.state()); return rebuilt;
}

test('cell contracts bind unchanged original source, policy and complete ancestor returns', async () => {
  assert.equal(oracle.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(oracle.sourceModified, false);
  for (const [path, digest] of Object.entries(oracle.sourceHashes)) {
    assert.equal(createHash('sha256').update(await readFile(new URL(path, source))).digest('hex'), digest, path);
  }
  assert.equal(createHash('sha256').update(await readFile(new URL('../' + oracle.generator, import.meta.url))).digest('hex'), oracle.generatorSha256);
  assert.match(oracle.qualification, /full raw ancestor returns retained/);
  assert.match(oracle.qualification, /not successful-game evidence/);
  const strategy = JSON.parse(await readFile(new URL('agents/yf_arc3_v6/morphology_policy/strategy.drm', source), 'utf8'));
  assert.deepEqual(oracle.policy.cell, strategy.declarations[0].configuration.window_constraints.cell_patch_composition);
  let parentEvents = 0;
  for (const journal of oracle.journals) for (const step of journal.steps) {
    if (!step.error) {
      assert.deepEqual(step.sourceEvents, [...step.parentEvents, ...step.expectedOwnEvents]);
      assert.ok(step.expectedOwnEvents.every((event: R) => event.kind === 'cell_patch_placement_evidence'));
      parentEvents += step.parentEvents.length;
    }
    assert.equal(step.sourceInputsUnchanged, true);
  }
  assert.equal(parentEvents, 0, 'These own-layer controlled rasters produce no ancestor events; full inherited envelopes are checked separately');
});

const measurementHelpers: Record<string, (...args: any[]) => unknown> = {
  center: cellPatchCenter, validate_geometry: validateCellPatchGeometry, fields: measureCellPatchFields,
  project: projectCellPatch, changes: cellPatchChanges,
};
for (const entry of oracle.measurementCases) test('original exact cell-patch measurement: ' + entry.id, () => {
  const args = copy(entry.args), result = measurementHelpers[entry.operation]!(...args);
  assert.deepEqual(result, entry.expected);
  assert.deepEqual(args, entry.args, 'Geometry and patch measurement cannot alter public pixels or retained geometry');
});

const lineHelpers: Record<string, (...args: any[]) => unknown> = {
  line_windows: lineWindows, insertions: lineInsertions, place: linePlace, search_lines: searchLines,
};
for (const entry of oracle.lineCases) test('original conditional line calculation: ' + entry.id, () => {
  const args = copy(entry.args), result = lineHelpers[entry.operation]!(...args);
  assert.deepEqual(result, entry.expected, 'Full ranking, coordinate tie order, conditional scope and exact search-node count match');
  assert.deepEqual(args, entry.args);
});

for (const [id, original] of Object.entries<R>(oracle.states)) {
  test('cell state, full own journal and source-parent-bound digest: ' + id, () => {
    const memory = fromState(id), replay = new CellPlacementMemory();
    for (const event of original.projection.cell_events) replay.applyEvent(copy(event));
    assert.deepEqual(replay.state(), memory.state());
    assert.equal(replay.retainedDigest(original.sourceParentDigest), original.sourceDigest);
    assert.notEqual(replay.retainedDigest('a-different-ancestor-scope'), original.sourceDigest);
  });
}

for (const journal of oracle.journals) test('original cell acquisition and dated packet evidence: ' + journal.id, () => {
  let memory = journal.initialState ? fromState(journal.initialState) : new CellPlacementMemory();
  for (const step of journal.steps) {
    const first = oracle.scenes[step.before], second = oracle.scenes[step.after];
    const args = copy({ before: first.observation, after: second.observation, command: step.command,
      rows: first.rows, later: second.rows, proposal: step.proposal, frames: step.frames });
    const untouched = copy(args), old = memory.state(), revision = memory.nativeRevision;
    const run = () => step.operation === 'record'
      ? memory.record(args.before, args.command, args.after, args.rows, args.later, args.proposal, step.index)
      : memory.recordPacket(args.before, args.command, args.after, args.rows, args.frames);
    if (step.error) {
      assert.throws(run, { message: step.error.message });
      assert.deepEqual(memory.state(), old); assert.equal(memory.nativeRevision, revision);
    } else {
      const events = run();
      assert.deepEqual(events, step.expectedOwnEvents, 'All original own event fields remain observable');
      assert.equal(memory.nativeRevision > revision, events.length > 0);
      if (events.length) {
        const checkpoint = memory.state();
        events[0]!.detail = { changedOutsideTheMemory: true };
        events[0]!.models = { changedOutsideTheMemory: true };
        assert.deepEqual(memory.state(), checkpoint, 'Returned evidence cannot mutate the retained model');
      }
    }
    assert.deepEqual(args, untouched);
    assert.deepEqual(memory.state(), step.state.projection);
    assert.equal(memory.retainedDigest(step.state.sourceParentDigest), step.state.sourceDigest);
    const checkpoint = memory.state(), rebuilt = new CellPlacementMemory();
    rebuilt.restore(checkpoint); assert.deepEqual(rebuilt.state(), checkpoint); memory = rebuilt;
  }
  assert.deepEqual(memory.state(), journal.finalState.projection);
});

for (const entry of oracle.proposalCases.filter((entry: R) => entry.operation === 'own')) {
  test('unchanged original cell proposal or refusal: ' + entry.id, () => {
    const memory = fromState(entry.state), current = oracle.scenes[entry.scene];
    const args = copy([entry.observation, current.rows, entry.inputs, entry.maxPrefix, entry.config, entry.sourceBaseProposal]);
    const old = memory.state(), revision = memory.nativeRevision;
    const result = memory.proposeCell(args[0], args[1], args[2], args[3], args[4], args[5]);
    assert.deepEqual(result, entry.expected);
    assert.deepEqual(args, [entry.observation, current.rows, entry.inputs, entry.maxPrefix, entry.config, entry.sourceBaseProposal]);
    assert.deepEqual(memory.state(), old); assert.equal(memory.nativeRevision, revision);
    assert.equal(entry.sourceStateUnchanged, true);
  });
}

for (const entry of oracle.proposalCases.filter((entry: R) => entry.operation === 'common')) {
  test('unchanged common cell wrapper and current pixel evidence: ' + entry.id, async () => {
    const family = sharedFromState(entry.state), current = oracle.scenes[entry.scene], old = family.state();
    const run = () => family.cellPropose(copy(entry.observation), copy(current.rows), copy(entry.inputs),
      entry.remaining, copy(entry.config), entry.deadline);
    if (entry.error) await assert.rejects(run, { message: entry.error.message });
    else assert.deepEqual(await run(), entry.expected);
    assert.deepEqual(family.state(), old, 'Considering a cell question cannot acquire a game response');
  });
}

for (const entry of oracle.guardCases) test('unchanged original cell ' + entry.operation + ' guard: ' + entry.id, () => {
  const proposal = copy(entry.proposal), rows = copy(oracle.scenes[entry.before].rows);
  const later = entry.after ? copy(oracle.scenes[entry.after].rows) : null;
  const paths = copy(oracle.states[entry.state].projection.cell_paths), meta = copy(entry.meta);
  const result = entry.operation === 'before'
    ? cellPlacementBefore(proposal, entry.index, rows, meta)
    : cellPlacementAfter(proposal, entry.index, rows, later, meta, paths);
  assert.deepEqual(result, entry.expected);
  assert.deepEqual(proposal, entry.proposal); assert.deepEqual(rows, oracle.scenes[entry.before].rows);
  assert.deepEqual(meta, entry.meta); assert.deepEqual(paths, oracle.states[entry.state].projection.cell_paths);
  if (entry.after) assert.deepEqual(later, oracle.scenes[entry.after].rows);
});

for (const entry of oracle.bindCases) test('shared binder retains exact current cell-point support: ' + entry.id, () => {
  const family = sharedFromState('empty'), proposal = copy(entry.proposal), domain = new ObservedInputDomain(256);
  if (entry.error) assert.throws(() => family.bind(proposal, domain));
  else { family.bind(proposal, domain); assert.deepEqual(proposal, entry.expected); }
});

for (const journal of oracle.commonJournals) test('full original common acquisition and shared restoration: ' + journal.id, () => {
  let family = new SharedSeriesConstraint(oracle.policy.recall);
  for (const step of journal.steps) {
    const before = oracle.scenes[step.before], after = oracle.scenes[step.after];
    const result = family.record(copy(before.observation), copy(after.observation), copy(step.command),
      copy(before.rows), copy(after.rows), copy(step.proposal), step.index, copy(after.public.frame_packet));
    assert.deepEqual(result, step.expected, 'The whole original common envelope is compared without event filtering');
    assert.deepEqual(family.state().events, step.fullSourceState.events);
    assert.deepEqual(family.cells.state(), step.cellState.projection);
    assert.equal(family.cells.retainedDigest(step.cellState.sourceParentDigest), step.cellState.sourceDigest);
    assert.notEqual(family.state().digest, step.fullSourceState.digest, 'Remaining original inherited layers are outside the declared native closure');
    const checkpoint = family.state(), restored = new SharedSeriesConstraint(oracle.policy.recall);
    restored.restore(checkpoint); assert.deepEqual(restored.state(), checkpoint);
    assert.deepEqual(restored.cells.state(), step.cellState.projection); family = restored;
  }
});

test('dated same-palette motifs give conditional roles; returned views preserve them and contrast tied choices', () => {
  const first = oracle.plans.initial.cell_placement_plan, learned = oracle.plans.learned.cell_placement_plan;
  assert.equal(first.expected_motif, null); assert.equal(first.model, null); assert.equal(first.search, null);
  const model = Object.values<R>(oracle.states.learned.projection.cell_models)[0]!;
  assert.notEqual(model.own, model.other);
  assert.equal(learned.field.motifs[model.own].palette, null);
  assert.equal(learned.field.motifs[model.other].palette, null);
  assert.equal(learned.expected_motif, model.own);
  assert.deepEqual(model.ordered_frames, [0, 2]);
  const returned = oracle.plans.returned;
  assert.equal(Object.values<R>(oracle.states.returned.projection.cell_models)[0]!.status, 'candidate');
  assert.equal(returned.question.reason, 'contrast_equivalent_line_preparations_after_observed_return');
  assert.equal(returned.cell_placement_plan.search.return_contrast.choice_changed, true);
  assert.ok(returned.cell_placement_plan.search.return_contrast.evidence_refs.length > 0);
  assert.deepEqual(learned.point, [0, 2]); assert.deepEqual(returned.cell_placement_plan.point, [2, 0]);
  assert.equal(returned.steps[0].expected_after.official_progress_required, true);
  assert.match(returned.cell_placement_plan.search.scope, /not proven wins/);
});

test('cell cumulative projections, returned events and public state reads are independent', () => {
  const memory = fromState('learned'), retained = memory.state(), revision = memory.nativeRevision;
  const modelKey = Object.keys(retained.cell_models)[0]!;
  const external = memory.state(); external.cell_models[modelKey].evidence.push('outside-model');
  assert.deepEqual(external.cell_events, retained.cell_events, 'The current projection cannot rewrite historical event snapshots');
  external.cell_events.at(-1)!.models[modelKey].evidence.push('outside-event');
  assert.deepEqual(memory.state(), retained); assert.equal(memory.nativeRevision, revision);
  const event = copy(retained.cell_events.at(-1)!); memory.applyEvent(event);
  const after = memory.state(), nextRevision = memory.nativeRevision;
  event.models[modelKey].evidence.push('outside-input'); event.paths = {};
  assert.deepEqual(memory.state(), after); assert.equal(memory.nativeRevision, nextRevision);
});

test('cell state corruption is rejected atomically and the old acquired state can be restored', () => {
  const memory = fromState('returned'), retained = memory.state(), digest = memory.retainedDigest('parent'), revision = memory.nativeRevision;
  const key = Object.keys(retained.cell_models)[0]!;
  for (const edit of [
    (value: R) => { value.cell_models[key].evidence.push('unacquired'); },
    (value: R) => { value.cell_returns = {}; },
    (value: R) => { value.cell_events.pop(); },
  ]) {
    const corrupt = copy(retained); edit(corrupt);
    assert.throws(() => memory.restore(corrupt), /complete event journal/);
    assert.deepEqual(memory.state(), retained); assert.equal(memory.retainedDigest('parent'), digest);
    assert.equal(memory.nativeRevision, revision);
  }
  assert.throws(() => memory.applyEvent({ kind: 'outside' }), /Outside cell placement layer/);
  assert.throws(() => memory.applyEvent({ kind: 'cell_patch_placement_evidence' }), /complete current projection/);
  assert.equal(memory.nativeRevision, revision);
  memory.restore(copy(oracle.states.learned.projection));
  assert.ok(memory.nativeRevision > revision); assert.deepEqual(memory.state(), oracle.states.learned.projection);
  const epochView = oracle.proposalCases.find((entry: R) => entry.id === 'model_is_epoch_bound');
  const proposal = memory.proposeCell(epochView.observation, oracle.scenes[epochView.scene].rows, [], 16, oracle.policy.cell);
  assert.equal(proposal.cell_placement_plan.expected_motif, null, 'A retained old-epoch model cannot bind new-epoch local roles');
});

test('native exact-integer boundary refuses unsupported large line scores before action selection', () => {
  // Explicit native numeric-domain boundary; the source uses arbitrary-size
  // Python integers. This check is not advertised as parity in that domain.
  const board = [Array(30).fill('e')];
  assert.throws(() => searchLines(board, 'x', 'o', 'e', 30, null, 0, 1), NativeLineSearchDomainError);
});
