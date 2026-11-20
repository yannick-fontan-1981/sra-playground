import test from 'node:test';
import assert from 'node:assert/strict';
import type { NativeEntity } from '../src/logos-engine/v6-native-types.ts';
import { observedExchanges, poseOf, type Groups } from '../src/sic/exchange-roles.ts';

function poses(a: number[], b: number[]): Groups {
  const signatures = ['a', 'b'];
  return new Map(
    [a, b].map((xs, i) => [
      signatures[i]!,
      new Map(
        xs.map((x) => {
          const position = [x, 2] as const,
            signature = signatures[i]!;
          const e: NativeEntity = {
            id: signature + x,
            signature,
            position,
            bbox: [x, 2, x, 2],
            area: 1,
            scale: 1,
            mask: [[0, 0]],
            palette_value: i + 1,
            rectangular: true,
            identity_ambiguous: xs.length > 1,
            identity_scope: 'monochrome_component_not_physical_object',
          };
          return [position.join(), e];
        })
      ),
    ])
  );
}
test('a reciprocal displacement identifies an occurrence only while its peers stay put', () => {
  const initial = poses([1, 5, 7], [11]),
    swapped = poses([1, 5, 11], [7]);
  const [roles] = observedExchanges(initial, swapped);
  assert.ok(roles);
  assert.deepEqual(poseOf(initial, roles), [
    [7, 2],
    [11, 2],
  ]);
  assert.deepEqual(poseOf(poses([1, 5, 14], [7]), roles), [
    [14, 2],
    [7, 2],
  ]);
  assert.equal(poseOf(poses([1, 8, 14], [7]), roles), null);
  assert.equal(poseOf(poses([1, 5], [7]), roles), null);
  assert.deepEqual(observedExchanges(initial, poses([1, 8, 11], [7])), []);
  assert.deepEqual(observedExchanges(initial, poses([1, 5, 11], [9])), []);
});
