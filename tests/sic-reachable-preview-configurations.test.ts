import assert from 'node:assert/strict';
import test from 'node:test';
import {
  previewLaw,
  reachablePreviewConfigurations,
  type GroundStroke,
} from '../scripts/source-reachable-preview-calculus.ts';
const motors: GroundStroke[] = [
  { op: 'east', d: [1, 0], ref: 3 },
  { op: 'west', d: [-1, 0], ref: 4 },
];
test('a measured layout translates around its reference and opens an independently usable region', () => {
  const floor = new Set(['0,0', '1,0', '2,0', '3,0', '4,0', '3,2', '4,2']);
  const input = {
    actor: [0, 0] as [number, number],
    centre: [2, 0] as [number, number],
    motors,
    op: 'apply',
    patterns: [
      {
        actor: [4, 4] as [number, number],
        centre: [5, 4] as [number, number],
        indicator: [5, 6] as [number, number],
        ref: 2,
      },
    ],
    passable: (p: [number, number]) => floor.has(p.join()),
    otherCentres: [],
    readWitnessed: true,
    allowWrites: true,
    stateLimit: 100,
  };
  const found = reachablePreviewConfigurations(input);
  assert.deepEqual([...found.home], ['0,0', '1,0']);
  const first = found.configurations[0]!;
  assert.deepEqual(first.placed, [3, 0]);
  assert.deepEqual(first.launch, [2, 0]);
  assert.deepEqual(first.arrival, [3, 2]);
  assert.deepEqual(first.continuation, [4, 2]);
  assert.deepEqual(
    first.steps.map((x) => x.stage),
    ['move', 'write', 'read', 'use']
  );
  assert.equal(reachablePreviewConfigurations({ ...input, allowWrites: false }).configurations.length, 0);
  assert.equal(reachablePreviewConfigurations({ ...input, baselineRead: [1, 2] }).configurations.length, 0);
});
test('different distances require a consistent transform and an observed direction relative to the reference', () => {
  const forecast = previewLaw([
    { actor: [3, 4], centre: [4, 4], indicator: [5, 4], ref: 1 },
    { actor: [2, 4], centre: [4, 4], indicator: [6, 4], ref: 2 },
  ]);
  assert.deepEqual(
    forecast([3, 9], [6, 9]).map((x) => x.at),
    [[9, 9]]
  );
  assert.deepEqual(forecast([6, 6], [6, 9]), []);
});
