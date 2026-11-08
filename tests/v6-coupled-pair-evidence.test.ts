import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { CoupledPairEvidenceMemory, coupledPairAfter } from '../src/logos-engine/v6-coupled-pair-evidence.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(await readFile(
  new URL('./fixtures/v6-coupled-pair-evidence-reference.json.gz', import.meta.url),
)).toString('utf8'));
const journal = (id: string): R => fixture.journals.find((row: R) => row.id === id);

test('coupled-pair acquisition oracle retains unchanged source and its explicit planner/digest limits', async () => {
  assert.equal(fixture.provenance.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.provenance.sourceModified, false);
  assert.match(fixture.provenance.sourceMethod, /Unchanged full ObservedCompositionConstraint/);
  assert.match(fixture.provenance.qualification, /no equality with the full ObservedCompositionConstraint digest/);
  assert.match(fixture.provenance.qualification, /not game solutions or transferred planning/);
  for (const [path, hash] of Object.entries(fixture.provenance.sources)) {
    const source = await readFile(new URL('../reference/v6/' + fixture.provenance.commit + '/source/' + path, import.meta.url));
    assert.equal(createHash('sha256').update(source).digest('hex'), hash, path);
  }
});

for (const row of fixture.journals) test('original pair evidence and reconstruction: ' + row.id, async context => {
  let memory = new CoupledPairEvidenceMemory();
  assert.deepEqual(memory.state(), row.initial.state);
  assert.equal(memory.retainedDigest(row.initial.sourceParentDigest), row.initial.sourcePairLayerDigest);
  for (const [index, step] of row.steps.entries()) {
    await context.test(index + ' ' + step.operation.kind, () => {
      const operation = step.operation;
      if (operation.kind === 'record') {
        const before = fixture.scenes[operation.before], after = fixture.scenes[operation.after];
        const actual = memory.record(before.observation, operation.command, after.observation,
          before.rows, after.rows, operation.proposal, operation.index);
        assert.deepEqual(actual, step.expected.pairEvents, 'Every acquired anchor/evidence event matches the unchanged source');
      } else if (operation.kind === 'apply') memory.applyEvent(operation.event);
      else throw new Error('Unknown original pair-memory operation');
      assert.deepEqual(memory.state(), step.expected.state, 'The complete current state, all events and initial-map entries match');
      assert.equal(memory.retainedDigest(step.expected.sourceParentDigest), step.expected.sourcePairLayerDigest,
        'The exact source layer formula uses the supplied real source parent digest');
      const restored = new CoupledPairEvidenceMemory();
      restored.restore(JSON.parse(JSON.stringify(memory.state())));
      assert.deepEqual(restored.state(), step.expected.state);
      assert.equal(restored.retainedDigest(step.expected.sourceParentDigest), step.expected.sourcePairLayerDigest);
      memory = restored;
    });
  }
  assert.deepEqual(memory.state(), row.finalState);
});

for (const row of fixture.afterCases) test('original pair-plan outcome: ' + row.id, () => {
  const before = fixture.scenes[row.before], after = fixture.scenes[row.after];
  assert.deepEqual(coupledPairAfter(row.proposal, row.index, before.rows, after.rows, row.meta), row.expected);
});

test('ambiguity remains unknown, while supported zero-effect samples deduplicate only exact evidence', () => {
  assert.equal(journal('two_moving_candidates_do_not_choose_one').finalState.pair_state, null);
  const ambiguous = journal('ambiguous_assignment_does_not_reassign_members');
  assert.equal(ambiguous.steps[0].expected.state.pair_state, null);
  assert.deepEqual(ambiguous.steps.at(-1).expected.pairEvents, []);
  assert.deepEqual(ambiguous.steps.at(-1).expected.state, ambiguous.steps.at(-2).expected.state);
  const sampled = journal('learned_motion_and_exact_sample_deduplication').steps;
  const previous = sampled.at(-2).expected.state.pair_state, repeated = sampled.at(-1).expected.state.pair_state;
  assert.deepEqual(repeated.samples, previous.samples);
  assert.equal(repeated.evidence.length, previous.evidence.length + 2);
  assert.equal(sampled.at(-1).expected.state.pair_events.length, sampled.at(-2).expected.state.pair_events.length + 1);
});

test('refutation preserves prior movement evidence and keeps exact, interior-only and changed returns distinct', () => {
  for (const [label, flags] of [['whole', [true, true]], ['interior_only', [false, true]], ['changed', [false, false]]] as const) {
    const steps = journal('refuted_plan_' + label + '_return').steps;
    const before = steps[0].expected.state.pair_state, refuted = steps[1].expected.state.pair_state;
    assert.deepEqual([refuted.unresolved.whole_scene_initial_equal, refuted.unresolved.interior_initial_equal], flags);
    for (const key of ['pair', 'samples', 'floors', 'evidence']) assert.deepEqual(refuted[key], before[key]);
    assert.deepEqual(refuted.refused, ['guard-contract-trial']);
  }
  const first = journal('first_acquisition_refusal_has_no_prior_unresolved_state').finalState.pair_state;
  assert.deepEqual(first.refused, ['guard-contract-trial']);
  assert.equal(first.unresolved, undefined, 'No earlier pair memory exists for the source early-refutation branch');
});

test('public events and restored checkpoints cannot mutate the retained pair journal or latest state', () => {
  const step = journal('learned_motion_and_exact_sample_deduplication').steps[0];
  const operation = structuredClone(step.operation), before = structuredClone(fixture.scenes[operation.before]), after = structuredClone(fixture.scenes[operation.after]);
  const memory = new CoupledPairEvidenceMemory();
  const result = memory.record(before.observation, operation.command, after.observation, before.rows, after.rows, operation.proposal, operation.index);
  const expected = memory.state(), digest = memory.retainedDigest('parent');
  result[0]!.frame_digest = 'external mutation';
  result[1]!.state.pair.boxes[0][0] = 99;
  after.rows[0][0] = 9;
  assert.deepEqual(memory.state(), expected);
  assert.equal(memory.retainedDigest('parent'), digest);
  const snapshot = memory.state() as R, rebuilt = new CoupledPairEvidenceMemory();
  rebuilt.restore(snapshot as any);
  snapshot.pair_state.samples.ACTION4[0].deltas[0][0] = 99;
  snapshot.pair_events[1].state.evidence.push('external');
  assert.deepEqual(memory.state(), expected);
  assert.deepEqual(rebuilt.state(), expected);
  const replayed = structuredClone(step.expected.pairEvents[1]), fromEvent = new CoupledPairEvidenceMemory();
  fromEvent.applyEvent(replayed);
  const retained = fromEvent.state();
  replayed.state.refused.push('external');
  assert.deepEqual(fromEvent.state(), retained);
});

test('inconsistent pair-state reconstruction is rejected atomically without losing evidence', () => {
  const memory = new CoupledPairEvidenceMemory();
  memory.restore(journal('learned_motion_and_exact_sample_deduplication').finalState);
  const retained = memory.state(), digest = memory.retainedDigest('parent');
  const mutations: ((state: R) => void)[] = [
    state => { state.pair_state.floors.push(9); },
    state => { state.pair_initials['1'].frame_digest = 'changed outside its event'; },
    state => { state.pair_events.pop(); },
    state => { state.pair_events.push({ kind: 'unported_series_event' }); },
    state => { state.pair_state = null; },
    state => { delete state.pair_initials; },
  ];
  for (const change of mutations) {
    const state = structuredClone(retained) as R;
    change(state);
    assert.throws(() => memory.restore(state as any));
    assert.deepEqual(memory.state(), retained);
    assert.equal(memory.retainedDigest('parent'), digest);
  }
});
