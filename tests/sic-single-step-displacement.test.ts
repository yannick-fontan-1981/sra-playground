import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { singleStepDisplacement } from '../src/sic/observed-translation.ts';

for (const step of [4, 6]) test(`a signed axial displacement has exactly one step of size ${step}`, () => {
  const start: NativePoint = [17, 23];
  const cases: [string, NativePoint, NativePoint | null][] = [
    ['left', [17 - step, 23], [-step, 0]],
    ['right', [17 + step, 23], [step, 0]],
    ['up', [17, 23 - step], [0, -step]],
    ['down', [17, 23 + step], [0, step]],
    ['stationary', start, null],
    ['diagonal with the same Manhattan distance', [17 + step / 2, 23 - step / 2], null],
    ['short step', [17, 24], null],
    ['double step', [17 - 2 * step, 23], null],
  ];
  for (const [name, to, expected] of cases) {
    assert.deepEqual(singleStepDisplacement(start, to, step), expected, name);
  }
});
