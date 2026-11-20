import test from 'node:test';
import assert from 'node:assert/strict';
import { responseField, placementsForResponse } from '../scripts/fit-source-response-field.mjs';
const samples = (...pairs) => pairs.map(([r, y], i) => ({ r, y, i }));
test('one intervention direction predicts only along its measured span', () => {
  const obs = samples(
    [
      [3, 3],
      [6, 6],
    ],
    [
      [5, 3],
      [6, 9],
    ]
  );
  assert.deepEqual(responseField(obs, [7, 3]).to, [6, 12]);
  assert.equal(responseField(obs, [4, 3]), null);
  assert.equal(responseField(obs, [5, 4]), null);
  assert.deepEqual(placementsForResponse(obs, [6, 12]), [[7, 3]]);
});
test('independent directions identify an invertible response even when the axes change', () => {
  const obs = samples(
    [
      [0, 0],
      [5, 8],
    ],
    [
      [2, 0],
      [5, 10],
    ],
    [
      [0, 2],
      [3, 8],
    ]
  );
  assert.deepEqual(responseField(obs, [2, 2]).to, [3, 10]);
  assert.deepEqual(placementsForResponse(obs, [3, 10]), [[2, 2]]);
  assert.equal(responseField([...obs, { ...obs[0], y: [5, 9] }], [2, 2]), null);
});
test('a collapsed response can be produced by several distinct achievable placements', () => {
  const obs = samples(
    [
      [0, 0],
      [0, 0],
    ],
    [
      [1, 0],
      [1, 0],
    ],
    [
      [0, 1],
      [0, 0],
    ]
  );
  assert.deepEqual(
    placementsForResponse(
      obs,
      [2, 0],
      [
        [2, 0],
        [2, 4],
        [3, 0],
      ]
    ),
    [
      [2, 0],
      [2, 4],
    ]
  );
});
