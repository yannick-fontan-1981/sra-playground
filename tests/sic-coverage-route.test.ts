import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { searchCoverageRoute } from '../src/sic/coverage-route.ts';

test('revisits a junction with the same seals when a required support is still intact', () => {
  const start: NativePoint = [0, 0], support: NativePoint = [1, 0], goal: NativePoint = [2, 0];
  const detour: NativePoint = [0, 1], bend: NativePoint = [1, 1], junction: NativePoint = [2, 1];
  const adjacency = new Map<NativePoint, NativePoint[]>([
    [start, [support, detour]], [support, [junction, goal]], [detour, [bend]], [bend, [junction]], [junction, [support]],
  ]);
  const route = searchCoverageRoute(start, goal, 0, 1, function* (at, _first, spent) {
    for (const point of adjacency.get(at) ?? []) {
      if (point === support && spent) continue;
      yield { point, step: point, visits: Number(point === junction), uses: Number(at === support) };
    }
  });
  assert.deepEqual(route, [detour, bend, junction, support, goal]);
});
