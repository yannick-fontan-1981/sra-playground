import test from 'node:test';
import assert from 'node:assert/strict';
import { witnessedWord } from '../src/sic/witnessed-capacity-word.ts';
import { offerCapacityWord } from '../src/sic/probe-territorial-capacity.ts';
import { initialMemory } from '../src/sic/preparation-experiments.ts';
const site = { signature: 'r', fixed: [] };
function fixture() {
  const m = initialMemory(1);
  m.scenes = ['root|A,B', 'other|A,B', 'third|A,B'];
  const edge = (s, t, cmd, ref, from, to) => ({
    s,
    t,
    cmd,
    ref,
    stable: true,
    anchors: { p: { at: from + ',1' }, r: { at: '2,1' } },
    visibleAfter: ['p', 'r'],
    effect: {
      moves: from === to ? [] : [{ actor: 'p', from: from + ',1', to: to + ',1', dx: to - from, dy: 0 }],
    },
  });
  m.edges = [edge(0, 1, 'A', 2, 1, 1), edge(1, 2, 'B', 3, 1, 3), edge(2, 0, 'A', 4, 3, 1)];
  m.delayed.history = [0, 1, 2];
  m.revisionScene = { 1: 0, 2: 1, 3: 2, 4: 0 };
  return m;
}
test('an already played control uses its contiguous chronological receipts', () => {
  const m = fixture(),
    v = witnessedWord(m, 'root', ['A', 'B'], 4, 'p', site, true);
  assert.equal(v.ref, 3);
  assert.deepEqual(v.patient, [3, 1]);
  assert.deepEqual(v.afterFirst, { p: [1, 1], r: [2, 1] });
  assert.equal(witnessedWord(m, 'root', ['B', 'A'], 4, 'p', site, false), null);
  m.revisionScene[2] = 2;
  assert.equal(witnessedWord(m, 'root', ['A', 'B'], 4, 'p', site, false), null);
});
test('when a paired control is missing the agent can go back to its exact starting image', () => {
  const m = fixture(),
    q = {
      id: 'q',
      traveller: 'p',
      site,
      patient: [1, 1],
      marker: [2, 1],
      ordinal: 0,
      observations: { 0: { prepared: { frame: 'root' } } },
      alphabet: ['A', 'B'],
      prepare: 'A',
      rival: 'B',
      ideal: [5, 1],
    };
  m.territory.words = {
    problems: {
      q: {
        q,
        goal: { actor: 'p', width: 10, stride: [1, 1], home: [[10, 7]], foothold: [8, 1] },
        choices: [],
        laws: [],
        last: 0,
        originalFrame: 'root',
      },
    },
    reused: {},
  };
  const o = {
    frame_hash: 'third',
    revision: 8,
    available_action_refs: ['A', 'B'],
    entities: [
      { signature: 'p', position: [3, 1] },
      { signature: 'r', position: [2, 1] },
    ],
  };
  const plan = offerCapacityWord(m, o, new Set(['A', 'B']));
  assert.equal(plan.plan.kind, 'revisit_capacity');
  assert.deepEqual(plan.plan.program, [{ op: 'A', stage: 'capacity_return', expectedFrame: 'root', ref: 4 }]);
  m.territory.words.failedReturns = { [plan.plan.key]: 8 };
  assert.equal(offerCapacityWord(m, o, new Set(['A', 'B'])), null);
});
