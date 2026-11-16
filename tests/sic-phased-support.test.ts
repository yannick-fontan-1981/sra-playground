import assert from 'node:assert/strict';
import test from 'node:test';
import { observePhaseStep, planPhasedSupport, type PhasedSupport } from '../src/sic/phased-support-route.ts';

const scene: PhasedSupport = {
  terrain: { origin: [0, 0], width: 5, height: 2, pitch: 2, voids: [5], base: [2, 2, 5, 5, 2, -1, 5, 5, 5, -1] },
  controls: [[10, 0, 13, 3]], portal: [10, 4, 13, 7],
  pads: [{ cell: 5, pixels: [6, 7, 7, 6] }, { cell: 9, pixels: [7, 6, 6, 7] }],
  actorInk: 14, target: 4, position: { cell: 1, phases: [0] }, cycles: [{ phases: [[]], closed: false }], route: [],
};

test('identical intermediate appearances retain separate positions in an observed cycle', () => {
  const observed = (inks: number[]) => [
    inks.flatMap(ink => [ink, ink]), inks.flatMap(ink => [ink, ink]),
    [6, 7, 5, 5, 5, 5, 5, 5, 7, 6], [7, 6, 5, 5, 5, 5, 5, 5, 6, 7],
  ];
  let current = scene;
  for (const ink of [1, 3, 1, 5]) {
    const next = observePhaseStep(current, { control: 0, probing: true, next: scene.position }, observed([2, 14, ink, 5, 2]));
    assert.ok(next);
    current = next;
  }
  assert.deepEqual(current.cycles, [{ phases: [[], [[2, 1]], [[2, 3]], [[2, 1]]], closed: true }]);
});

test('the route advances a cycle only if the current actor cell still has support', () => {
  const cycles: PhasedSupport['cycles'] = [{ phases: [[], [[2, 1]], [[3, 1]], [[2, 1], [3, 1]]], closed: true }];
  const route = planPhasedSupport({ ...scene, cycles }, [3], 10);
  assert.deepEqual(route.map(step => [step.next.cell, step.next.phases[0]]), [
    [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [4, 3],
  ]);
});
