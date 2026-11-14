import assert from 'node:assert/strict';
import test from 'node:test';
import { animationSlideDirection } from '../src/sic/cavity-access.ts';

test('slide direction follows local steps across a wrap even if overall displacement reverses', () => {
  assert.deepEqual(animationSlideDirection([[26, 48], [22, 48], [18, 48], [6, 48], [50, 48], [46, 48]], 4, 4), [-1, 0]);
  assert.deepEqual(animationSlideDirection([[46, 48], [50, 48], [6, 48], [10, 48], [38, 48]], 4, 4), [1, 0]);
  assert.equal(animationSlideDirection([[26, 48], [22, 48], [26, 48]], 4, 4), null);
});
