import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { measurePortLayout, portAgreement, updatePorts, type PortModel } from '../src/logos-engine/v6-port-assembly.ts';
import { PointSet } from '../src/logos-engine/v6-point-set.ts';
import { measureGeometryControl, measureSelectedGeometryControl, observeGeometryControl } from '../src/sic/port-geometry-control.ts';

const board = () => Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => 15));
const tile = (rows: number[][], x: number, y: number, ink: number) => {
  for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) rows[y * 2 + row]![x * 2 + col] = ink;
};
const observe = (rows: number[][], revision: number) => measureNativeObservation({
  frame_rows: rows, frame_hash: String(revision), level: 1, levels_completed: 0, state: 'NOT_FINISHED',
  available_action_refs: ['ACTION6'],
}, revision);

test('a local click changes one piece and renews its control until it disappears', async () => {
  const first = board();
  for (const [x, y] of [[1, 2], [1, 3], [2, 3]] as const) tile(first, x, y, 3);
  tile(first, 1, 1, 6);
  tile(first, 2, 2, 6);
  tile(first, 5, 2, 4);
  tile(first, 6, 2, 4);
  tile(first, 1, 4, 0);
  const model = measurePortLayout(await observe(first, 0), first)!;
  const control = measureGeometryControl(first, model, model.poses)!;
  assert.deepEqual(control.cell, [1, 4]);

  const second = structuredClone(first);
  tile(second, 1, 4, 3);
  tile(second, 2, 4, 6);
  tile(second, 1, 5, 0);
  const changed = observeGeometryControl(await observe(second, 1), first, second, model, model.poses, control)!;
  assert.deepEqual(changed.next?.cell, [1, 5]);
  assert.equal(changed.model.bodies[changed.part]?.ports.size, 3);
  assert.equal(observeGeometryControl(await observe(first, 1), first, first, model, model.poses, control), null);

  const finished = structuredClone(second);
  tile(finished, 1, 5, 3);
  const final = observeGeometryControl(await observe(finished, 2), second, finished,
    changed.model, changed.model.poses, changed.next!)!;
  assert.equal(final.next, null);
  assert.ok(portAgreement(finished, final.model, final.model.poses));

  tile(second, 5, 2, 7);
  tile(second, 6, 2, 7);
  assert.equal(observeGeometryControl(await observe(second, 2), first, second, model, model.poses, control), null);
});

test('a selected piece keeps its identity across an attached control and separated regions', async () => {
  const inactive = board();
  for (let x = 1; x <= 5; x++) tile(inactive, x, 2, 4);
  tile(inactive, 1, 5, 7);
  tile(inactive, 2, 5, 7);
  const peer = { material: new PointSet([[0, 0], [1, 0]]), ports: new PointSet([[1, 0]]), known: true };
  const model: PortModel = { background: 15, marker: 6, phase: [0, 0], unit: 2, width: 16, height: 16,
    bodies: [{ material: new PointSet([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]), ports: new PointSet(), known: false }, peer],
    poses: [[0, 1, 2], [0, 1, 5]] };
  const selected = structuredClone(inactive);
  for (let x = 1; x <= 5; x++) tile(selected, x, 2, 3);
  tile(selected, 1, 2, 6);
  tile(selected, 3, 2, 0);
  tile(selected, 5, 2, 6);
  assert.equal(measureSelectedGeometryControl(inactive, inactive, model, model.poses, 0), null);
  const control = measureSelectedGeometryControl(inactive, selected, model, model.poses, 0)!;
  assert.deepEqual(control.cell, [3, 2]);
  updatePorts(selected, model, model.poses, 0);
  assert.equal(observeGeometryControl(await observe(selected, 1), selected, selected, model, model.poses, control), null);

  const grown = structuredClone(selected);
  tile(grown, 3, 2, 15);
  tile(grown, 4, 2, 0);
  tile(grown, 6, 2, 3);
  const changed = observeGeometryControl(await observe(grown, 2), selected, grown, model, model.poses, control)!;
  assert.deepEqual(changed.next?.cell, [4, 2]);
  assert.equal(changed.model.bodies[1], peer);
  assert.deepEqual(changed.model.bodies[0]!.material.sorted(), [[0, 0], [1, 0], [4, 0], [5, 0]]);
  assert.deepEqual(changed.model.bodies[0]!.ports.sorted(), [[0, 0], [4, 0]]);
  const unrelated = structuredClone(grown);
  tile(unrelated, 1, 5, 8);
  assert.equal(observeGeometryControl(await observe(unrelated, 2), selected, unrelated, model, model.poses, control), null);

  const finished = structuredClone(grown);
  tile(finished, 4, 2, 15);
  tile(finished, 5, 2, 3);
  tile(finished, 6, 2, 6);
  const final = observeGeometryControl(await observe(finished, 3), grown, finished,
    changed.model, changed.model.poses, changed.next!)!;
  assert.equal(final.next, null);
  assert.equal(final.model.bodies[0]!.ports.size, 2);
  assert.deepEqual(final.model.bodies[0]!.ports.sorted(), [[0, 0], [5, 0]]);
  assert.ok(portAgreement(finished, final.model, final.model.poses));
});
