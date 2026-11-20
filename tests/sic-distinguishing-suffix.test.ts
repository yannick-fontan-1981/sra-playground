import test from 'node:test';
import assert from 'node:assert/strict';
import { initialMemory, type Edge } from '../src/sic/preparation-experiments.ts';
import { recordDelayed, selectDelayed } from '../src/sic/distinguishing-suffix.ts';
import type { NativeObservation } from '../src/logos-engine/v6-native-types.ts';

function edge(s: number, t: number, cmd: string, from = 0, to = 0): Edge {
  return {
    s,
    t,
    cmd,
    ref: t + 1,
    stable: true,
    anchors: { body: { at: from + ',0', exterior: '' } },
    visibleAfter: ['body'],
    effect: {
      key: 'public_change',
      moves: from === to ? [] : [{ actor: 'body', from: from + ',0', to: to + ',0', dx: to - from, dy: 0 }],
    },
  };
}
function observation(x: number, revision: number): NativeObservation {
  return {
    revision,
    level_epoch: 1,
    frame_hash: String(revision),
    observation_ref: 'r' + revision,
    coordinate_basis: 'screen',
    entities: [
      {
        id: 'body',
        signature: 'body',
        position: [x, 0],
        bbox: [x, 0, x, 0],
        mask: [[0, 0]],
        area: 1,
        scale: 1,
        palette_value: 1,
        rectangular: true,
        identity_ambiguous: false,
        identity_scope: 'test',
      },
    ],
    available_action_refs: ['settle', 'trigger', 'use'],
    state: 'PLAY',
    levels_completed: 0,
    unknowns: [],
    provenance: 'observed',
  };
}
function sample() {
  const m = initialMemory(1);
  m.edges = [
    edge(0, 1, 'settle'),
    edge(1, 2, 'trigger'),
    edge(3, 4, 'trigger', 0, 5),
    edge(4, 5, 'use', 5, 6),
    edge(0, 6, 'prepare'),
  ];
  m.delayed.history = [0, 1, 2, 3, 4];
  m.previous = 4;
  m.turns = 12;
  m.recurrences = 3;
  return m;
}
test('a witnessed control program can discriminate only on its second input and then exercise the opening', () => {
  const m = sample(),
    ops = new Set(['settle', 'trigger', 'use']),
    o = observation(0, 10),
    next = observation(0, 11);
  const q = selectDelayed(m, o, 6, ops)!.delayed!;
  assert.deepEqual(
    q.sequence.map((s) => s.op),
    ['settle', 'trigger']
  );
  assert.equal(q.predicted, '5,0');
  assert.equal(recordDelayed(m, q, edge(6, 7, 'settle'), o, next, false).result, 'delayed_prefix_matched');
  const t = selectDelayed(m, next, 7, ops)!.delayed!,
    land = observation(5, 12);
  assert.equal(
    recordDelayed(m, t, edge(7, 8, 'trigger', 0, 5), next, land, false).result,
    'delayed_access_observed'
  );
  assert.equal(Object.values(m.delayed.learned)[0]!.delta, '5,0');
  const use = selectDelayed(m, land, 8, ops)!.delayed!;
  assert.equal(use.use, 'use');
  assert.equal(
    recordDelayed(m, use, edge(8, 9, 'use', 5, 6), land, observation(6, 13), false).result,
    'delayed_followup_moved'
  );
});
test('a changed control origin cannot be credited as a newly enabled movement', () => {
  const m = sample(),
    ops = new Set(['settle', 'trigger']);
  const q = selectDelayed(m, observation(0, 6), 6, ops)!.delayed!;
  const r = recordDelayed(m, q, edge(6, 7, 'settle'), observation(2, 7), observation(4, 8), false);
  assert.equal(r.result, 'delayed_unmatched_origin');
  assert.deepEqual(m.delayed.learned, {});
});
test('known convergence of the two public arms removes the proposed distinction', () => {
  const m = sample();
  m.edges.push(edge(6, 1, 'settle'));
  assert.equal(selectDelayed(m, observation(0, 6), 6, new Set(['settle', 'trigger'])), null);
});
