import assert from 'node:assert/strict';
import test from 'node:test';
import { ConstellationEvidence, type ConstellationModel } from '../src/logos-engine/v6-constellation-cover.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { PointSet } from '../src/logos-engine/v6-point-set.ts';
import { rememberExposedMarkers } from '../src/sic/marker-layers.ts';
import { nextMarkerMaterialMove } from '../src/sic/marker-material-route.ts';

function model(): ConstellationModel {
  return { targets: new Map([[9, new PointSet([[2, 2], [3, 2]])], [8, new PointSet([[5, 3], [5, 4]])]]),
    marker_rows: new Map([[9, [{ centre: [2, 2], ring_width: 3, ring_value: 4 }]]]),
    background: 0, focus_color: 15, focus_occlusion: new PointSet([[0, 0]]), excluded: new PointSet(),
    boundary_overlay: new PointSet(), marker_raster: new Map(), ring_widths: [3], width: 14, height: 10,
    materialRegions: [{ color: 8, box: [0, 7, 3, 9], interior: [1, 8, 2, 8] }], movingColors: [12] };
}

test('a marker is remembered after its frame is exposed and survives a later overlap', async () => {
  const measured = new ConstellationEvidence();
  measured.model = model();
  const rows = Array.from({ length: 10 }, () => Array<number>(14).fill(0));
  for (let y = 6; y <= 8; y++) for (let x = 9; x <= 11; x++) rows[y]![x] = x === 10 && y === 7 ? 8 : 4;
  const observe = (rev: number) => measureNativeObservation({ frame_rows: rows, frame_hash: `f${rev}`,
    level: 1, levels_completed: 0, state: 'NOT_FINISHED', available_action_refs: ['ACTION1'] }, rev);
  rows[6]![9] = 12;
  rememberExposedMarkers(await observe(0), rows, measured);
  assert.equal(measured.model.targets.get(8)?.has([10, 7]), false);

  rows[6]![9] = 4;
  rememberExposedMarkers(await observe(1), rows, measured);
  assert.ok(measured.model.targets.get(8)?.has([10, 7]));
  assert.equal(measured.model.marker_raster.get('10,7')?.value, 8);

  rows[7]![10] = 12;
  rememberExposedMarkers(await observe(2), rows, measured);
  assert.ok(measured.model.targets.get(8)?.has([10, 7]));
  assert.equal(measured.model.marker_raster.get('10,7')?.value, 8);
});

test('two separately controlled bodies can divide a constellation of the same color', () => {
  const measured = new ConstellationEvidence();
  measured.model = model();
  measured.model.targets.get(9)!.update(new PointSet([[10, 5], [11, 5]]));
  measured.model.materialRegions = [];
  measured.poses = [[2, 2], [5, 3], [9, 5]];
  measured.active = 2;
  measured.motion = new Map([['up', [0, -1]], ['down', [0, 1]], ['left', [-1, 0]], ['right', [1, 0]]]);
  const horizontal = new PointSet([[0, 0], [1, 0]]);
  measured.bodies = [{ color: 9, pose: measured.poses[0]!, mask: horizontal },
    { color: 8, pose: measured.poses[1]!, mask: new PointSet([[0, 0], [0, 1]]) },
    { color: 9, pose: measured.poses[2]!, mask: horizontal }];
  const next = nextMarkerMaterialMove(measured, [...measured.motion.keys()], []);
  assert.equal(next?.kind, 'move');
  if (next?.kind === 'move') {
    assert.equal(next.key, 'right');
    assert.deepEqual(next.goal, [10, 5]);
  }
});
