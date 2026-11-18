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

test('revisits the same position with the same seals after opening its gate', () => {
  const start: NativePoint = [0, 0], toggle: NativePoint = [0, 1];
  const seal: NativePoint = [1, 0], goal: NativePoint = [2, 0];
  const route = searchCoverageRoute(start, goal, 0, 1, function* (at, _first, _spent, phase) {
    if (at === toggle) yield { point: start, step: start, visits: 0 };
    if (at === start && phase === 5) yield { point: toggle, step: toggle, visits: 0, phase: 8 };
    if (at === start && phase === 8) yield { point: seal, step: seal, visits: 1 };
    if (at === seal) yield { point: goal, step: goal, visits: 0 };
  }, undefined, 5);
  assert.deepEqual(route, [toggle, start, seal, goal]);
});
