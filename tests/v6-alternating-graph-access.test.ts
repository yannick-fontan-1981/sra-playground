import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { AlternatingGraphMemory, alternatingGraphBefore, alternatingGraphAfter, alternatingGraphSignature,
  alternatingGraphBoxAt, alternatingGraphPoints } from '../src/logos-engine/v6-alternating-graph-access.ts';

type R = Record<string, any>;
const oracle = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-alternating-graph-access-reference.json.gz', import.meta.url))).toString());
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/', import.meta.url);
const copy = <T>(value: T): T => structuredClone(value);

function fromState(id: string): AlternatingGraphMemory {
  const memory = new AlternatingGraphMemory();
  memory.restore(copy(oracle.states[id].projection));
  assert.deepEqual(memory.state(), oracle.states[id].projection);
  assert.equal(memory.retainedDigest(oracle.states[id].sourceParentDigest), oracle.states[id].sourceDigest);
  return memory;
}

test('graph oracle uses unchanged originals and retains complete ancestor evidence', async () => {
  assert.equal(oracle.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  for (const [path, digest] of Object.entries(oracle.sourceHashes)) {
    assert.equal(createHash('sha256').update(await readFile(new URL(path, source))).digest('hex'), digest, path);
  }
  assert.equal(createHash('sha256').update(await readFile(new URL('../' + oracle.generator, import.meta.url))).digest('hex'), oracle.generatorSha256);
  assert.match(oracle.qualification, /full raw ancestor returns retained/);
  assert.match(oracle.qualification, /not successful-game evidence/);
  let ancestorEvents = 0;
  for (const journal of oracle.journals) for (const step of journal.steps) {
    assert.deepEqual(step.sourceEvents, [...step.parentEvents, ...step.expectedOwnEvents]);
    assert.ok(step.expectedOwnEvents.every((event: R) => event.kind === 'alternating_graph_evidence'));
    assert.equal(step.sourceInputsUnchanged, true);
    ancestorEvents += step.parentEvents.length;
  }
  // These controlled translations produce no CellPlacementAccess ancestor
  // event in the original. Assert that observed domain explicitly; the common
  // integration oracle separately compares the complete CombinedMemory MRO.
  assert.equal(ancestorEvents, 0, 'No nonempty ancestor acquisition is claimed by these own-layer traces');
  assert.equal(oracle.plans.long.actions.length, 16);
  assert.equal(oracle.plans.long.graph_access_plan.measurement.alternating_material_first_shortest_action_refs.length, 20);
});

for (const [id, original] of Object.entries<R>(oracle.states)) {
  test(`exact graph projection and digest over the supplied source ancestor: ${id}`, () => {
    const memory = fromState(id), replayed = new AlternatingGraphMemory();
    for (const event of original.projection.graph_events) replayed.applyEvent(copy(event));
    assert.deepEqual(replayed.state(), memory.state());
    assert.equal(replayed.retainedDigest(original.sourceParentDigest), original.sourceDigest);
    assert.notEqual(replayed.retainedDigest('unsupported-ancestor-is-not-the-original-digest'), original.sourceDigest);
  });
}

for (const journal of oracle.journals) {
  test(`original own acquisition after complete source parent: ${journal.id}`, () => {
    let memory = journal.initialState ? fromState(journal.initialState) : new AlternatingGraphMemory();
    for (const step of journal.steps) {
      const before = oracle.scenes[step.before], after = oracle.scenes[step.after];
      const args = [copy(before.observation), copy(step.command), copy(after.observation), copy(before.rows), copy(after.rows), copy(step.proposal), step.index] as const;
      const untouched = copy(args), priorRevision = memory.nativeRevision;
      const events = memory.record(...args);
      assert.deepEqual(events, step.expectedOwnEvents, 'Every own event field, including all evidence, is compared');
      assert.deepEqual(args, untouched);
      assert.deepEqual(memory.state(), step.state.projection);
      assert.equal(memory.retainedDigest(step.state.sourceParentDigest), step.state.sourceDigest);
      assert.equal(memory.nativeRevision > priorRevision, events.length > 0);
      const checkpoint = memory.state(), rebuilt = new AlternatingGraphMemory();
      rebuilt.restore(checkpoint); assert.deepEqual(rebuilt.state(), checkpoint); memory = rebuilt;
      // Callers may edit emitted events, but cannot mutate the retained source
      // journal or any projection that was already acquired from the frame.
      if (events.length) {
        events[0]!.samples.length = 0;
        events[0]!.detail.after = 'external mutation';
        assert.deepEqual(memory.state(), checkpoint);
      }
    }
    assert.deepEqual(memory.state(), journal.finalState.projection);
    assert.equal(memory.retainedDigest(journal.finalState.sourceParentDigest), journal.finalState.sourceDigest);
  });
}

for (const entry of oracle.proposalCases.filter((entry: R) => entry.operation === 'own')) {
  test(`unchanged graph planner: ${entry.id}`, () => {
    const memory = fromState(entry.state), scene = oracle.scenes[entry.scene], retained = memory.state(), revision = memory.nativeRevision;
    const observation = copy(entry.observation), rows = copy(scene.rows), inputs = copy(entry.inputs), config = copy(entry.config);
    const run = () => memory.proposeGraph(observation, rows, inputs, entry.maxPrefix, config);
    if (entry.error) assert.throws(run, (error: Error) => error.message === entry.error.message);
    else assert.deepEqual(run(), entry.expected);
    assert.deepEqual(memory.state(), retained);
    assert.equal(memory.nativeRevision, revision);
    assert.deepEqual(observation, entry.observation); assert.deepEqual(rows, scene.rows);
    assert.deepEqual(inputs, entry.inputs); assert.deepEqual(config, entry.config);
    assert.equal(entry.sourceStateUnchanged, true);
  });
}

for (const entry of oracle.guardCases) {
  test(`unchanged graph ${entry.operation} guard: ${entry.id}`, () => {
    const proposal = copy(entry.proposal), rows = copy(oracle.scenes[entry.before].rows);
    const later = entry.after ? copy(oracle.scenes[entry.after].rows) : null;
    const run = () => entry.operation === 'before'
      ? alternatingGraphBefore(proposal, entry.index, rows, entry.meta)
      : alternatingGraphAfter(proposal, entry.index, rows, later, entry.meta);
    if (entry.error) assert.throws(run, (error: Error) => error.message === entry.error.message);
    else assert.deepEqual(run(), entry.expected);
    assert.deepEqual(proposal, entry.proposal); assert.deepEqual(rows, oracle.scenes[entry.before].rows);
    if (entry.after) assert.deepEqual(later, oracle.scenes[entry.after].rows);
  });
}

for (const entry of oracle.helperCases) {
  test(`original graph public helper: ${entry.id}`, () => {
    const result = entry.operation === 'signature' ? alternatingGraphSignature(entry.args[0])
      : entry.operation === 'box_at' ? alternatingGraphBoxAt(entry.args[0], entry.args[1])
        : alternatingGraphPoints(entry.args[0]).map(point => point.split(',').map(Number));
    assert.deepEqual(result, entry.expected);
  });
}

test('contact remains unknown until departure; confirmed occlusion supplies no removal', () => {
  const unknown = fromState('unverified_contact').state(), occlusion = fromState('occlusion').state();
  assert.equal(unknown.graph_contacts[0]!.status, 'occlusion_or_removal_unknown');
  assert.equal(unknown.graph_removals.length, 0);
  assert.equal(occlusion.graph_contacts[0]!.status, 'occlusion_confirmed_no_removal');
  assert.equal(occlusion.graph_removals.length, 0);
  const waiting = fromState('validation_departure').state(), revealed = fromState('after_validation').state();
  assert.equal(waiting.graph_contacts.at(-1)!.requires_revalidation, true);
  assert.equal(waiting.graph_contacts.at(-1)!.status, 'occlusion_or_removal_unknown');
  assert.equal(revealed.graph_contacts.at(-1)!.status, 'ordinary_support_revealed_after_departure');
  assert.equal(revealed.graph_removals.length, waiting.graph_removals.length + 1);
  assert.deepEqual(oracle.plans.instrumental.actions, [{ action_ref: 'ACTION4' }]);
  assert.deepEqual(oracle.plans.validation_departure.actions, [{ action_ref: 'ACTION3' }]);
  assert.deepEqual(oracle.plans.after_validation.actions, [{ action_ref: 'ACTION4' }, { action_ref: 'ACTION2' }]);
  assert.equal(fromState('terminal').state().graph_terminal.length, 1);
  assert.equal(fromState('instrumental_terminal').state().graph_terminal.length, 1);
});

test('native owned events and independent public snapshots cannot rewrite learned evidence', () => {
  const memory = new AlternatingGraphMemory(), event = copy(oracle.states.static.projection.graph_events[0]);
  memory.applyEvent(event); const expected = memory.state(), revision = memory.nativeRevision;
  event.samples[0].evidence.push('outside'); event.detail.before = 'outside';
  assert.deepEqual(memory.state(), expected); assert.equal(memory.nativeRevision, revision);
  const snapshot = memory.state(); snapshot.graph_samples[0]!.evidence.push('snapshot only');
  assert.deepEqual(snapshot.graph_events, expected.graph_events, 'Public cumulative projections do not alias their historical event snapshots');
  snapshot.graph_events[0]!.samples[0].evidence.push('old event only');
  assert.deepEqual(memory.state(), expected);
  const retained = memory.state(); memory.restore(retained); retained.graph_events[0]!.samples.length = 0;
  assert.deepEqual(memory.state(), expected);
});

test('corrupt replay is rejected atomically and direct mutations invalidate a native checkpoint', () => {
  const memory = fromState('after_validation'), retained = memory.state(), digest = memory.retainedDigest('parent'), revision = memory.nativeRevision;
  const corrupt = copy(retained); corrupt.graph_contacts[0]!.evidence.push('not acquired');
  assert.throws(() => memory.restore(corrupt), /complete event journal/);
  assert.deepEqual(memory.state(), retained); assert.equal(memory.retainedDigest('parent'), digest); assert.equal(memory.nativeRevision, revision);
  assert.throws(() => memory.applyEvent({ kind: 'other' }), /Outside alternating graph layer/);
  assert.throws(() => memory.applyEvent({ kind: 'alternating_graph_evidence' }), /complete current projection/);
  assert.equal(memory.nativeRevision, revision);
  const event = copy(oracle.states.static.projection.graph_events[0]); memory.applyEvent(event);
  assert.ok(memory.nativeRevision > revision); const nextRevision = memory.nativeRevision;
  memory.restore(retained); assert.ok(memory.nativeRevision > nextRevision); assert.deepEqual(memory.state(), retained);
});
