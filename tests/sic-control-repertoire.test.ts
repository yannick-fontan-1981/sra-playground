import test from 'node:test';
import assert from 'node:assert/strict';
import { controlExperiments, changedControl } from '../src/sic/partial-control-repertoire.ts';
import { compareControlRepertoires } from '../src/sic/control-repertoire.ts';
import { recordFrontier, selectFrontier } from '../src/sic/experimental-frontier.ts';
import { initialMemory, type Edge } from '../src/sic/preparation-experiments.ts';
import type { NativeObservation } from '../src/logos-engine/v6-native-types.ts';

function transition(
  ref: number,
  s: number,
  t: number,
  cmd: string,
  actor: number,
  after: number,
  peer: number,
  placed: number
): Edge {
  const positions: [string, number, number][] = [
    ['traveler', actor, after],
    ['fixture', peer, placed],
  ];
  return {
    s,
    t,
    cmd,
    ref,
    stable: true,
    anchors: Object.fromEntries(positions.map(([role, x]) => [role, { at: x + ',1', exterior: '' }])),
    visibleAfter: ['traveler', 'fixture'],
    effect: {
      key: 'observed',
      moves: positions
        .filter(([, x, y]) => x !== y)
        .map(([role, x, y]) => ({
          actor: role,
          from: x + ',1',
          to: y + ',1',
          dx: y - x,
          dy: 0,
        })),
    },
  };
}

test('relative controls distinguish a new choice from a shared translation', () => {
  assert.equal(
    changedControl([1, 1], [5, 1], [{ op: 'D', before: [2, 1], after: [6, 1], bareRef: 1, preparedRef: 2 }]),
    null
  );
  assert.equal(
    compareControlRepertoires(
      [1, 1],
      [5, 1],
      new Map([
        ['B', { before: [1, 1], after: [6, 1] }],
        ['D', { before: [2, 1], after: [6, 1] }],
      ]),
      'B'
    ),
    null
  );
  const result = compareControlRepertoires(
    [1, 1],
    [5, 1],
    new Map([
      ['B', { before: [1, 1], after: [5, 2] }],
      ['D', { before: [2, 1], after: [6, 1] }],
    ]),
    'B'
  );
  assert.ok(result?.novel && result.awakened);
});

test('a measured change under D nominates untested B, then exercises its actual landing', () => {
  const m = initialMemory(1);
  m.scenes = Array.from({ length: 8 }, (_, i) => i + '|A,B,C,D');
  m.edges.push(
    transition(1, 0, 1, 'A', 1, 1, 4, 5),
    transition(2, 0, 0, 'D', 1, 1, 4, 4),
    transition(3, 0, 0, 'B', 1, 1, 4, 4),
    transition(4, 1, 2, 'D', 1, 2, 5, 5),
    transition(5, 3, 4, 'C', 3, 4, 9, 9)
  );
  const claims = controlExperiments(m, new Set([1]));
  const claim = claims.proposals.get('1/B')?.claim;
  assert.equal(claim?.calibration.op, 'D');
  assert.equal(claim?.bare.ref, 3);
  const action = selectFrontier(m, 1, new Set(['B', 'D']), new Map([[1, { first: null, length: 0 }]]));
  assert.equal(action?.b, 'B');
  assert.deepEqual(action?.frontier?.question.repertoire, claim);
  const edge = transition(6, 1, 5, 'B', 1, 3, 5, 5);
  m.edges.push(edge);
  const after = {
    available_action_refs: ['B', 'C', 'D'],
    entities: [{ signature: 'traveler', identity_ambiguous: false, bbox: [3, 1, 3, 1] }],
  } as unknown as NativeObservation;
  const outcome = recordFrontier(
    m,
    action!.frontier!,
    edge,
    false,
    () => '3,1',
    () => '1,1',
    { after, rows: [Array(10).fill(0), Array(10).fill(0)] }
  );
  assert.deepEqual(outcome.detail.controlled, { actual: [3, 1], moved: true, changed: true });
  assert.equal(m.frontier.follow?.question.use?.op, 'C');
  assert.deepEqual(m.frontier.follow?.question.use?.to, [4, 1]);
  assert.equal(controlExperiments(m, new Set([1])).proposals.has('1/B'), false);
});

test('the first probe at a placement can measure D before any prepared response is known', () => {
  const m = initialMemory(1);
  m.edges.push(
    transition(1, 0, 1, 'A', 1, 1, 4, 5),
    transition(2, 0, 2, 'D', 1, 2, 4, 4),
    transition(3, 0, 0, 'B', 1, 1, 4, 4)
  );
  const menu = controlExperiments(m, new Set([1]));
  assert.equal(menu.proposals.size, 0);
  assert.deepEqual(menu.calibrations.get('1/D')?.alternatives.sort(), ['A', 'B']);
  assert.equal(menu.calibrations.get('1/D')?.direct.ref, 2);
});
