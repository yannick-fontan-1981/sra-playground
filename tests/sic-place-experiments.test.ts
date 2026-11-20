import test from 'node:test';
import assert from 'node:assert/strict';
import type { NativeObservation, NativeEntity } from '../src/logos-engine/v6-native-types.ts';
import { initialMemory, type Edge } from '../src/sic/preparation-experiments.ts';
import { recordFrontier } from '../src/sic/experimental-frontier.ts';
import { placeExperiments } from '../src/sic/place-experiments.ts';
import { splitNativeState } from '../src/logos-engine/v6-native-state-graph.ts';

const rows = Array.from({ length: 3 }, () => Array(25).fill(0));
function observation(poses: Record<string, number>): NativeObservation {
  const entities: NativeEntity[] = Object.entries(poses).map(([signature, x]) => ({
    id: signature,
    signature,
    position: [x, 1],
    bbox: [x, 1, x, 1],
    mask: [[0, 0]],
    area: 1,
    scale: 1,
    palette_value: 2,
    rectangular: true,
    identity_ambiguous: false,
    identity_scope: 'test',
  }));
  return {
    entities,
    revision: 20,
    level_epoch: 1,
    frame_hash: 'f',
    observation_ref: 'o',
    coordinate_basis: 'screen',
    available_action_refs: [],
    state: 'NOT_FINISHED',
    levels_completed: 0,
    unknowns: [],
    provenance: 'public',
  };
}
function edge(
  s: number,
  t: number,
  cmd: string,
  start: Record<string, number>,
  after: Record<string, number>
): Edge {
  return {
    s,
    t,
    ref: s + 1,
    cmd,
    stable: true,
    anchors: Object.fromEntries(Object.entries(start).map(([id, x]) => [id, { at: x + ',1', exterior: '' }])),
    visibleAfter: Object.keys(after),
    effect: {
      key: 'changed',
      moves: Object.keys(start)
        .filter((id) => after[id] !== undefined && start[id] !== after[id])
        .map((actor) => ({
          actor,
          from: start[actor] + ',1',
          to: after[actor] + ',1',
          dx: after[actor]! - start[actor]!,
          dy: 0,
        })),
    },
  };
}
test('prefers an unmeasured location to repeating the same spatial control under a new image', () => {
  const m = initialMemory(1);
  m.edges = [
    edge(0, 1, 'west', { traveler: 2 }, { traveler: 1 }),
    edge(1, 2, 'east', { traveler: 1 }, { traveler: 2 }),
    edge(2, 3, 'east', { traveler: 2 }, { traveler: 3 }),
  ];
  const score = placeExperiments(m, observation({ traveler: 3 }), rows, 3)!;
  assert.ok(score(3, 'east')!.score > score(0, 'east')!.score);
  assert.deepEqual(score(3, 'east')!.question.arrival?.to, [4, 1]);
  assert.deepEqual(score(3, 'east')!.question.use?.to, [5, 1]);
  assert.doesNotThrow(() => splitNativeState(score(3, 'east')!.question, 'frontier'));
});
test('a witnessed exchange projects the transported traveler and its subsequent use at a new separation', () => {
  const m = initialMemory(1);
  m.edges = [
    edge(0, 1, 'switch', { traveler: 2, marker: 5 }, { traveler: 5, marker: 2 }),
    edge(1, 2, 'step', { traveler: 5, marker: 2 }, { traveler: 6, marker: 2 }),
    edge(3, 4, 'prepare', { traveler: 2, marker: 5 }, { traveler: 2, marker: 12 }),
  ];
  const q = placeExperiments(m, observation({ traveler: 2, marker: 12 }), rows, 4)!(4, 'switch')!.question;
  assert.equal(q.place?.actor, 'traveler');
  assert.deepEqual(q.arrival?.to, [12, 1]);
  assert.deepEqual(q.use?.to, [13, 1]);
  assert.equal(q.place?.reference, 'marker');
});

test('tests a previously ineffective input for motion demonstrated by another input after preparation', () => {
  const m = initialMemory(1);
  m.edges = [
    edge(0, 0, 'test', { traveler: 2, marker: 8 }, { traveler: 2, marker: 8 }),
    edge(0, 1, 'carry', { traveler: 2, marker: 8 }, { traveler: 6, marker: 8 }),
    edge(0, 2, 'prepare', { traveler: 2, marker: 8 }, { traveler: 2, marker: 9 }),
  ];
  const rank = placeExperiments(m, observation({ traveler: 2, marker: 9 }), rows, 2)!;
  const q = rank(2, 'test')!.question;
  assert.deepEqual(q.arrival?.to, [6, 1]);
  assert.equal(q.arrival?.alternative?.observedWith, 'carry');
  assert.equal(q.arrival?.alternative?.inactiveRef, m.edges[0]!.ref);
  assert.equal(q.arrival?.alternative?.preparationRef, m.edges[2]!.ref);
  assert.equal(rank(0, 'test')!.question.arrival, null);
  assert.doesNotThrow(() => splitNativeState(q, 'frontier'));
});
test('a bare no-op and a measured preparation remain distinct from a predicted opening', () => {
  const m = initialMemory(1);
  m.edges = [
    edge(0, 0, 'step', { traveler: 2, marker: 4 }, { traveler: 2, marker: 4 }),
    edge(0, 1, 'prepare', { traveler: 2, marker: 4 }, { traveler: 2, marker: 7 }),
    edge(2, 3, 'step', { traveler: 5, marker: 7 }, { traveler: 6, marker: 7 }),
  ];
  const q = placeExperiments(m, observation({ traveler: 2, marker: 7 }), rows, 1)!(1, 'step')!.question;
  assert.deepEqual(q.place?.bare?.to, [2, 1]);
  assert.deepEqual(q.arrival?.to, [3, 1]);
  assert.equal(q.place?.preparationRef, m.edges[1]!.ref);
});
test('derives a three-input experiment in which moving one role opens a different landing and then a use for another', () => {
  const m = initialMemory(1);
  m.edges = [
    edge(0, 1, 'switch', { traveler: 2, marker: 5 }, { traveler: 5, marker: 2 }),
    edge(1, 2, 'step', { traveler: 5, marker: 2 }, { traveler: 6, marker: 2 }),
    edge(3, 4, 'shift', { traveler: 2, marker: 8 }, { traveler: 2, marker: 9 }),
  ];
  const q = placeExperiments(m, observation({ traveler: 2, marker: 5 }), rows, 0)!(0, 'shift')!.question;
  assert.equal(q.arrival?.role, 'marker');
  assert.deepEqual(q.arrival?.to, [6, 1]);
  assert.deepEqual(q.place?.opening?.without, [5, 1]);
  assert.equal(q.use?.role, 'traveler');
  assert.deepEqual(q.use?.to, [6, 1]);
  assert.ok(q.after);
  const receipt = recordFrontier(
    m,
    { question: q, next: null, use: false },
    edge(0, 5, 'shift', { traveler: 2, marker: 5 }, { traveler: 2, marker: 6 }),
    false,
    (role) => (role === 'traveler' ? '2,1' : '6,1')
  );
  assert.equal(receipt.result, 'arrival_verified');
  assert.equal(m.frontier.follow?.scene, 5);
  const landed = recordFrontier(
    m,
    { question: q, next: null, use: true },
    edge(5, 6, 'switch', { traveler: 2, marker: 6 }, { traveler: 6, marker: 2 }),
    false,
    (role) => (role === 'traveler' ? '6,1' : '2,1')
  );
  assert.equal(landed.result, 'continuation_verified');
  assert.equal(m.frontier.follow?.after, true);
});
