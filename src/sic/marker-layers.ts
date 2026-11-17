import { constellationBodyPixels, type ConstellationEvidence, type ConstellationModel } from '../logos-engine/v6-constellation-cover.ts';
import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { PointSet, pointKey, type Point } from '../logos-engine/v6-point-set.ts';

export function measureUnassignedMaterial(observation: NativeObservation, rows: NativeRows, model: ConstellationModel): number[] {
  if (!model.materialRegions?.length) return [];
  const rim = [...model.marker_rows.values()].flatMap(rings => rings.map(ring => ring.ring_value as number));
  const assigned = new Set([model.background, model.focus_color, ...model.targets.keys(), ...rim,
    ...model.materialRegions.flatMap(region => [region.color, rows[region.box[1]]![region.box[0]]!])]);
  const ringAreas = model.ring_widths.map(side => side * side);
  return [...new Set(observation.entities.filter(entity => !assigned.has(entity.palette_value) && entity.area > Math.max(...ringAreas)
    && entity.bbox[0] < entity.bbox[2] && entity.bbox[1] < entity.bbox[3]).map(entity => entity.palette_value))];
}

export function rememberExposedMarkers(observation: NativeObservation, rows: NativeRows, measured: ConstellationEvidence,
  projected?: readonly Point[]) {
  const model = measured.model;
  if (!model?.movingColors?.length) return;
  const styles = new Set([...model.marker_rows.values()].flatMap(rings => rings.map(ring => `${ring.ring_width}:${ring.ring_value}`)));
  const colorSources = new Set(model.materialRegions?.map(region => region.color));
  const oldCenters = new PointSet([...model.targets.values()].flatMap(points => [...points]));
  const covered = new PointSet(measured.bodies.flatMap((body, index) =>
    [...constellationBodyPixels(body, projected?.[index] ?? measured.poses[index]!)]));
  for (const entity of observation.entities) {
    const [l, t, r, b] = entity.bbox, side = r - l + 1, offset = Math.floor(side / 2);
    if (side !== b - t + 1 || entity.area !== side * side - 1 || !styles.has(`${side}:${entity.palette_value}`)) continue;
    const centre: Point = [l + offset, t + offset];
    if (oldCenters.has(centre) || covered.has(centre)) continue;
    const color = rows[centre[1]]![centre[0]]!;
    if (!colorSources.has(color) || color === entity.palette_value) continue;
    const cut = new PointSet(entity.mask);
    if (cut.has([offset, offset])) continue;
    oldCenters.add(centre);
    const targets = model.targets.get(color) ?? new PointSet();
    targets.add(centre);
    model.targets.set(color, targets);
    model.marker_rows.set(color, [...model.marker_rows.get(color) ?? [], {
      centre: [centre[1], centre[0]], ring_width: side, ring_value: entity.palette_value,
    }]);
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
      const point: Point = [x, y];
      model.excluded.add(point);
      model.marker_raster.set(pointKey(point), { point, value: rows[y]![x]! });
    }
    measured.refs.set('revealed-marker:' + pointKey(centre), observation.observation_ref);
  }
}
