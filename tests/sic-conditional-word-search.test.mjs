import test from 'node:test';
import assert from 'node:assert/strict';
import { wordAt, nextArm, recordArm, transferBinding } from '../src/sic/conditional-word-search.ts';
const question = () => ({
  alphabet: ['x', 'y'],
  prepare: 'lift',
  rival: 'hold',
  patient: [0, 0],
  marker: [1, 0],
  ordinal: 0,
  observations: {},
});
const effect = (marker, ref, frame = 'state', afterFirst = { p: [0, 0], r: [1, 0] }) => ({
  marker,
  patient: [0, 0],
  frame,
  afterFirst,
  ref,
  entered: false,
  win: false,
});
test('enumeration covers repeated, ordered finite compositions without a gesture template', () => {
  const words = Array.from({ length: 30 }, (_, i) => wordAt(['x', 'y'], i).join(''));
  assert.equal(new Set(words).size, 30);
  assert.deepEqual(words.slice(0, 6), ['x', 'y', 'xx', 'xy', 'yx', 'yy']);
  assert.equal(words.at(-1), 'yyyy');
  assert.deepEqual(wordAt(['x'], 2), ['x', 'x', 'x']);
});
test('a sequence is tested alone, after a preparation and after a same-duration rival', () => {
  const q = question();
  assert.equal(nextArm(q, true).arm, 'prepared');
  recordArm(q, 0, 'prepared', effect([2, 0], 3));
  assert.equal(nextArm(q, true), null);
  assert.equal(nextArm(q, false).arm, 'bare');
  recordArm(q, 0, 'bare', effect([1, 0], 4));
  assert.equal(nextArm(q, false).arm, 'durationControl');
  const law = recordArm(q, 0, 'durationControl', effect([1, 0], 9));
  assert(law);
  assert.equal(law.sameScene, true);
  assert.equal(q.ordinal, 1);
  assert.deepEqual(transferBinding(law, [4, 2], [3, 2], [6, 2]), {
    word: ['lift', 'x'],
    marker: [5, 2],
    patient: [3, 2],
  });
  assert.equal(transferBinding(law, [4, 2], [3, 2], [1, 2]), null);
});
test('a moving clock or different starting configuration does not establish selective control', () => {
  const q = question();
  recordArm(q, 0, 'prepared', effect([2, 0], 2));
  recordArm(q, 0, 'bare', effect([1, 0], 3));
  assert.equal(recordArm(q, 0, 'durationControl', effect([2, 0], 4)), null);
  const q2 = question();
  recordArm(q2, 0, 'prepared', effect([2, 0], 2));
  recordArm(q2, 0, 'bare', effect([1, 0], 3));
  assert.equal(
    recordArm(q2, 0, 'durationControl', effect([1, 0], 4, 'state', { p: [3, 4], r: [1, 0] })),
    null
  );
});
