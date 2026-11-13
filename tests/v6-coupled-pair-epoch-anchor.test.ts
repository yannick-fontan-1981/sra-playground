import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { CoupledPairEpochAnchorMemory } from '../src/logos-engine/v6-coupled-pair-epoch-anchor.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(await readFile(
  new URL('./fixtures/v6-coupled-pair-epoch-anchor-reference.json.gz', import.meta.url),
)).toString('utf8'));
const firstAnchor = (): R => structuredClone(
  fixture.journals.find((journal: R) => journal.id === 'selected_recall_precedes_one_epoch_anchor')
    .steps[0].expected.anchorEvents[0],
);

test('epoch-anchor oracle records unchanged source, with an explicit partial digest boundary', async () => {
  assert.equal(fixture.provenance.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.match(fixture.provenance.sourceMethod, /Unchanged full ObservedCompositionConstraint/);
  assert.match(fixture.provenance.qualification, /no equality with the full ObservedCompositionConstraint digest/);
  for (const [path, expected] of Object.entries(fixture.provenance.sources)) {
    const bytes = await readFile(new URL(
      '../reference/v6/' + fixture.provenance.commit + '/source/' + path, import.meta.url,
    ));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, path);
  }
  const input = fixture.provenance.inputFixture;
  assert.equal(createHash('sha256').update(await readFile(
    new URL('../' + input.path, import.meta.url),
  )).digest('hex'), input.sha256);
});

for (const journal of fixture.journals) test(
  'original epoch-anchor acquisition and replay: ' + journal.id,
  async context => {
    let memory = new CoupledPairEpochAnchorMemory();
    assert.deepEqual(memory.state(), journal.initial.state);
    assert.equal(memory.retainedDigest(journal.initial.sourceParentDigest),
      journal.initial.sourcePairLayerDigest);
    for (const [index, entry] of journal.steps.entries()) {
      await context.test(index + ' ' + entry.operation.kind, () => {
        const operation = entry.operation;
        if (operation.kind === 'record') {
          const view = fixture.scenes[operation.before];
          assert.deepEqual(memory.record(view.observation, view.rows), entry.expected.anchorEvents,
            'the exact source anchor, including before-frame and interior digests');
        } else if (operation.kind === 'apply') memory.applyEvent(operation.event);
        else throw new Error('Unknown anchor oracle operation');
        assert.deepEqual(memory.state(), entry.expected.state, 'the entire source anchor projection');
        assert.equal(memory.retainedDigest(entry.expected.sourceParentDigest),
          entry.expected.sourcePairLayerDigest, 'the original pair layer with its supplied source parent digest');
        const restored = new CoupledPairEpochAnchorMemory();
        restored.restore(JSON.parse(JSON.stringify(memory.state())));
        assert.deepEqual(restored.state(), entry.expected.state, 'lossless public checkpoint reconstruction');
        assert.equal(restored.retainedDigest(entry.expected.sourceParentDigest),
          entry.expected.sourcePairLayerDigest);
        memory = restored;
      });
    }
    assert.deepEqual(memory.state(), journal.finalState);
  },
);

test('complete original results place recall before the anchor and packet observation after it', () => {
  const selected = fixture.journals.find((row: R) =>
    row.id === 'selected_recall_precedes_one_epoch_anchor').steps;
  assert.deepEqual(selected[0].expected.result.events.map((event: R) => event.kind),
    ['occurrence_recall_transition', 'coupled_pair_epoch_anchor']);
  assert.deepEqual(selected[1].expected.result.events.map((event: R) => event.kind),
    ['occurrence_recall_transition']);
  const packet = fixture.journals.find((row: R) =>
    row.id === 'public_packet_anchor_before_program_alignment').steps[0];
  assert.deepEqual(packet.expected.result.events.map((event: R) => event.kind),
    ['coupled_pair_epoch_anchor', 'public_program_phase_alignment']);
  assert.equal(packet.expected.result.transfer_authority, 'hypothesis_only');
});

test('public events, rasters and snapshots cannot alter retained anchor history', () => {
  const view = structuredClone(fixture.scenes['memo:0']);
  const memory = new CoupledPairEpochAnchorMemory();
  const [event] = memory.record(view.observation, view.rows);
  const expected = memory.state(), expectedDigest = memory.retainedDigest('parent-closure');
  event!.frame_digest = 'changed returned event';
  view.rows[0][0] = 42;
  view.observation.observation_ref = 'changed public observation';
  assert.deepEqual(memory.state(), expected);
  assert.equal(memory.retainedDigest('parent-closure'), expectedDigest);

  const snapshot = memory.state() as R, restored = new CoupledPairEpochAnchorMemory();
  restored.restore(snapshot as any);
  snapshot.pair_events[0].score = 99;
  snapshot.pair_initials['1'].observation_ref = 'changed public snapshot';
  assert.deepEqual(memory.state(), expected);
  assert.deepEqual(restored.state(), expected);

  const applied = firstAnchor(), fromEvent = new CoupledPairEpochAnchorMemory();
  fromEvent.applyEvent(applied);
  const appliedState = fromEvent.state();
  applied.interior_digest = 'changed replay input';
  assert.deepEqual(fromEvent.state(), appliedState);
});

test('restore rejects an inconsistent projection atomically, preserving all live events', () => {
  const memory = new CoupledPairEpochAnchorMemory();
  memory.applyEvent(firstAnchor());
  const expected = memory.state(), expectedDigest = memory.retainedDigest('parent-closure');
  const invalid: R[] = [];
  let broken = structuredClone(expected) as R;
  broken.pair_initials['1'].frame_digest = 'unreplayed change';
  invalid.push(broken);
  broken = structuredClone(expected) as R;
  broken.pair_events = [];
  invalid.push(broken);
  broken = structuredClone(expected) as R;
  broken.pair_events.push({ kind: 'coupled_pair_evidence', state: { epoch: 1 } });
  invalid.push(broken);
  broken = structuredClone(expected) as R;
  broken.pair_state = { epoch: 1 };
  invalid.push(broken);
  broken = structuredClone(expected) as R;
  delete broken.pair_initials;
  invalid.push(broken);
  for (const state of invalid) {
    assert.throws(() => memory.restore(state as any));
    assert.deepEqual(memory.state(), expected);
    assert.equal(memory.retainedDigest('parent-closure'), expectedDigest);
  }
});

test('duplicate-epoch replay retains both events and the last anchor after restoration', () => {
  const memory = new CoupledPairEpochAnchorMemory(), first = firstAnchor();
  const second = { ...first, observation_ref: 'second explicit source replay', score: 1 };
  memory.applyEvent(first);
  const firstDigest = memory.retainedDigest('parent-closure');
  memory.applyEvent(second);
  const state = memory.state();
  assert.deepEqual(state.pair_events, [first, second]);
  assert.deepEqual(state.pair_initials, { '1': second });
  assert.notEqual(memory.retainedDigest('parent-closure'), firstDigest);
  assert.notEqual(memory.retainedDigest('another-parent-closure'), memory.retainedDigest('parent-closure'));
  const restored = new CoupledPairEpochAnchorMemory();
  restored.restore(state);
  assert.deepEqual(restored.record(fixture.scenes['memo:0'].observation, fixture.scenes['memo:0'].rows), []);
  assert.deepEqual(restored.state(), state);
});
