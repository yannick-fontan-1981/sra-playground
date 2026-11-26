import assert from 'node:assert/strict';
import test from 'node:test';
import { animationSlideDirection } from '../src/sic/cavity-access.ts';
import { acquireTemporalOpening, movingOpeningMask } from '../src/sic/temporal-cavity.ts';
import { observedCommandFrontier, rememberCommandReturn, type ObservedCommandGraph } from '../src/sic/observed-command-frontier.ts';
import { pairedOpenings } from '../src/sic/paired-opening.ts';
import { measureSlideBoundary, rectangularSlideInteriors } from '../src/sic/slide-boundary.ts';
import { chooseJointSlide, observeJointSlide, readSingleSlide } from '../src/sic/joint-slide.ts';
import { supportParts } from '../src/logos-engine/v6-support-measurements.ts';
import type { NativeObservation, NativePoint } from '../src/logos-engine/v6-native-types.ts';

test('matching sides locate a slot whether its interior contains a piece or bare floor', () => {
  const board = (fill: number, peer: number) => Array.from({ length: 10 }, (_, y) => Array.from({ length: 12 }, (_, x) => {
    if (x >= 3 && x <= 4) {
      if (y === 2 || y === 3) return 6;
      if (y === 4 || y === 5) return fill;
      if (y === 6 || y === 7) return peer;
    }
    return x >= 8 && x <= 9 && y >= 4 && y <= 5 ? 9 : 0;
  }));
  assert.deepEqual(pairedOpenings(board(0, 6)), [[3, 4, 4, 5]]);
  assert.deepEqual(pairedOpenings(board(9, 6)), [[3, 4, 4, 5]]);
  assert.deepEqual(pairedOpenings(board(9, 8)), []);
});

test('slide direction follows local steps across a wrap even if overall displacement reverses', () => {
  assert.deepEqual(animationSlideDirection([[26, 48], [22, 48], [18, 48], [6, 48], [50, 48], [46, 48]], 4, 4), [-1, 0]);
  assert.deepEqual(animationSlideDirection([[46, 48], [50, 48], [6, 48], [10, 48], [38, 48]], 4, 4), [1, 0]);
  assert.equal(animationSlideDirection([[26, 48], [22, 48], [26, 48]], 4, 4), null);
});

for (const variant of [
  { pitch: 2, origin: [3, 4], inks: [1, 5, 7, 8, 9], input: 'ACTION4', transpose: false },
  { pitch: 3, origin: [7, 2], inks: [13, 10, 5, 2, 4], input: 'ACTION2', transpose: true },
] as const) {
  test(`a measured edge crossing drives an aligned slide with pitch ${variant.pitch}`, () => {
    const { pitch, origin: [left, top], inks: [rim, floor, wall, piece, color], input, transpose } = variant;
    const cols = transpose ? 6 : 8, lines = transpose ? 8 : 6;
    const transform = (x: number, y: number): NativePoint => transpose ? [y, x] : [x, y];
    const anchor = (x: number, y: number): NativePoint => {
      const [tx, ty] = transform(x, y);
      return [left + tx * pitch, top + ty * pitch];
    };
    const board = (actor: boolean) => Array.from({ length: top + lines * pitch + 3 }, (_, row) =>
      Array.from({ length: left + cols * pitch + 4 }, (_, column) => {
        const x = column - left, y = row - top;
        if (x < -1 || x > cols * pitch || y < -1 || y > lines * pitch) return 0;
        if (x === -1 || x === cols * pitch || y === -1 || y === lines * pitch) return rim;
        const [cx, cy] = transform(Math.floor(x / pitch), Math.floor(y / pitch));
        if (cx >= 6 && (cy === 1 || cy === 3) || (cx === 4 || cx === 5) && cy === 2) return wall;
        if (cx === 6 && cy === 2 || cx === 0 && (cy === 2 || cy === 3)) return color;
        return actor && cx === 1 && cy === 2 ? piece : floor;
      }));
    const rows = board(true), parts = supportParts(rows);
    const interiors = rectangularSlideInteriors(rows, parts), bounds = interiors[0]!;
    const direction = transform(-1, 0), track = [anchor(1, 2), anchor(0, 2), anchor(7, 2)];
    const evidence = measureSlideBoundary(track, bounds, pitch, pitch, direction, 'previous-return');
    assert.ok(evidence);
    const observation = { level_epoch: 3, observation_ref: 'current-return', available_action_refs: [input] } as NativeObservation;
    const model = readSingleSlide(rows, observation, parts, [[input, direction]], [evidence], interiors);
    assert.ok(model);
    const step = chooseJointSlide(model, 2);
    assert.equal(step?.input, input);
    assert.equal(step?.distance, 1);
    assert.equal(step?.crossedSeam, true);
    assert.equal(step?.rule.wrap, false);
    assert.ok(model.refs.includes('previous-return'));
    assert.equal(observeJointSlide(rows, model, step!, observation), null, 'a colored slot alone cannot confirm that the actor reached it');
    assert.ok(observeJointSlide(board(false), model, step!, observation));
    assert.equal(measureSlideBoundary([track[0]!, track[1]!, null, track[2]!], bounds, pitch, pitch, direction, 'ambiguous-return'), null);
    assert.equal(measureSlideBoundary([track[0]!, track[1]!, anchor(7, 3)], bounds, pitch, pitch, direction, 'changed-lane'), null);
    assert.equal(measureSlideBoundary([anchor(2, 2), anchor(1, 2), anchor(5, 2)], bounds, pitch, pitch, direction, 'interior-jump'), null);
  });
}

test('an open component moving in two command returns retains its evidence independently of the controlled piece', () => {
  const at = (left: number) => Array.from({ length: 9 }, (_, y) => Array.from({ length: 10 }, (_, x) => {
    if (y >= 2 && y <= 4 && x >= left && x < left + 3 && (y !== 3 || x === left)) return 6;
    return y === 7 && x === 6 ? 5 : 0;
  }));
  const first = acquireTemporalOpening(at(1), at(3), 'ACTION1', 'return-1', null);
  assert.deepEqual(first?.direction, [1, 0]);
  assert.equal(first?.otherEvidence, undefined);
  const second = acquireTemporalOpening(at(3), at(5), 'ACTION2', 'return-2', first);
  assert.ok(second);
  assert.equal(second.otherEvidence, 'return-1');
  assert.deepEqual(movingOpeningMask(at(5), second), [5, 2, 7, 4]);
});

test('stop replaying a measured transition when identical public appearances produced different returns', () => {
  const graph: ObservedCommandGraph = {};
  rememberCommandReturn(graph, 'current', 'new-phase', 'ACTION1', 'old-return');
  rememberCommandReturn(graph, 'current', 'current', 'ACTION2', 'blocked-return');
  const reached = observedCommandFrontier(graph, 'current', ['ACTION1', 'ACTION2'], 2);
  assert.equal(reached?.first?.evidence, 'old-return');
  assert.equal(reached?.depth, 1);
  assert.equal(observedCommandFrontier(graph, 'current', ['ACTION1', 'ACTION2'], 1), null);
  rememberCommandReturn(graph, 'current', 'other-phase', 'ACTION1', 'counterexample');
  assert.equal(observedCommandFrontier(graph, 'current', ['ACTION1', 'ACTION2'], 2), null);
});

test('frontier replay considers only the visible inputs witnessed on each board', () => {
  const graph: ObservedCommandGraph = {};
  rememberCommandReturn(graph, 'start', 'different-controls', 'ACTION1', 'return');
  const available = (key: string) => key === 'start' ? ['ACTION1'] : ['ACTION6:9,2'];
  const next = observedCommandFrontier(graph, 'start', ['ACTION1'], 2, available);
  assert.equal(next?.action, 'ACTION1');
  assert.equal(next?.probe, 'ACTION6:9,2');
  rememberCommandReturn(graph, 'different-controls', 'different-controls', 'ACTION6:9,2', 'return-2');
  assert.equal(observedCommandFrontier(graph, 'start', ['ACTION1'], 2, available), null);
});

test('defer an inverse probe only when an equally accessible input remains', () => {
  const graph: ObservedCommandGraph = {};
  const inputs = ['ACTION1', 'ACTION2', 'ACTION3'];
  assert.equal(observedCommandFrontier(graph, 'start', inputs, 3, () => inputs, 'ACTION1')?.action, 'ACTION2');
  rememberCommandReturn(graph, 'start', 'next', 'ACTION2', 'return-2');
  rememberCommandReturn(graph, 'start', 'start', 'ACTION3', 'return-3');
  assert.equal(observedCommandFrontier(graph, 'start', inputs, 3, () => inputs, 'ACTION1')?.action, 'ACTION1');
});
