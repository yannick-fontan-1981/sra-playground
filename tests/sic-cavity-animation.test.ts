import assert from 'node:assert/strict';
import test from 'node:test';
import { animationSlideDirection } from '../src/sic/cavity-access.ts';
import { acquireTemporalOpening, movingOpeningMask } from '../src/sic/temporal-cavity.ts';
import { observedCommandFrontier, rememberCommandReturn, type ObservedCommandGraph } from '../src/sic/observed-command-frontier.ts';
import { pairedOpenings } from '../src/sic/paired-opening.ts';

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
