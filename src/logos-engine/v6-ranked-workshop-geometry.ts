/** Pinned V6 ranked_workshop/geometry.py, using the exact V5 projector.
 * Public entity masks use (x,y); V5 profiles and scene boxes use (row,column).
 */
import { measureStationProfileScene, stationProfileContext } from './v5-station-profile-scene.ts';
import { supportCompare as compare } from './v6-support-measurements.ts';
import type { NativeObservation, NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const key = (x: number, y: number): string => `${x},${y}`;

export function candidates(observation: NativeObservation | R): boolean {
  let found = 0;
  for (const entity of observation.entities ?? []) {
    const [left, top, right, bottom] = entity.bbox, w = right - left + 1, h = bottom - top + 1;
    if (w < 5 || h < 2 || entity.rectangular) continue;
    const mask = new Set<string>(entity.mask.map(([x, y]: number[]) => key(x!, y!)));
    let bottomStem = true, topStem = true;
    for (let x = 0; x < w; x++) { bottomStem &&= mask.has(key(x, h - 1)); topStem &&= mask.has(key(x, 0)); }
    if (!bottomStem && !topStem) continue;
    const occupied: number[] = [];
    for (let x = 0; x < w; x++) {
      let count = 0;
      for (let y = 0; y < h; y++) if (mask.has(key(x, y))) count++;
      if (count > 1) occupied.push(x);
    }
    const groups = occupied.reduce((sum, x, i) => sum + Number(i === 0 || occupied[i - 1] !== x - 1), 0);
    if (groups >= 2) found++;
  }
  return found >= 2;
}

export function project(observation: NativeObservation | R, rows: NativeRows, config: R): [R, R] {
  if (!candidates(observation)) return [{}, {}];
  const height = rows.length, width = rows[0]!.length, parts: R[] = [];
  for (const entity of observation.entities) {
    const [left, top, right, bottom] = entity.bbox;
    const relative = entity.mask.map(([x, y]: number[]) => [y!, x!]);
    const pixels = relative.map(([y, x]: number[]) => [top + y!, left + x!]);
    if (pixels.some(([y, x]: number[]) => !(0 <= y! && y! < height && 0 <= x! && x! < width) || rows[y!]![x!] !== entity.palette_value)) return [{}, {}];
    if (bottom < top || right < left) throw new RangeError('bounding box extents must be ordered');
    if (!pixels.length) throw new RangeError('component pixels must be nonempty');
    if (new Set(pixels.map(([y, x]: number[]) => key(y!, x!))).size !== pixels.length) throw new RangeError('component pixels must be unique');
    parts.push({ component_id: entity.id, value: entity.palette_value, pixels, relative_pixels: relative,
      bbox: { top, left, bottom, right, height: bottom - top + 1, width: right - left + 1 }, area: pixels.length,
      touches_frame_boundary: left === 0 || top === 0 || right === width - 1 || bottom === height - 1,
      schema_version: 'yf_arc3_v5.component_description.v1' });
  }
  const scene = measureStationProfileScene(rows, parts, config.stem, config.scene);
  return [scene, comparisonContext(scene, config.scene)];
}

export function stableContext(context: R): R {
  return Object.fromEntries(Object.entries(context).filter(([name]) => !name.endsWith('_ref')));
}

export function comparisonContext(scene: R, configuration: R): R {
  const formats = new Map<string, (string | number)[]>();
  for (const binding of scene.receiver_bindings ?? []) {
    const cut = binding.cut_measurements, columns: number[] = cut.rank_columns;
    const pitches = new Set(columns.slice(1).map((b, i) => b - columns[i]!));
    if (pitches.size !== 1 || cut.uncertain_rank_indexes.length) continue;
    for (const axis of configuration.receiver_axis_directions) {
      const format = [axis, columns.length, cut.rank_width_pixels, pitches.values().next().value!];
      formats.set(JSON.stringify(format), format);
    }
  }
  const admitted: R[] = [], other: R[] = [];
  for (const profile of scene.profiles ?? []) {
    const p = profile.profile, format = [p.stem_relief_axis_direction, p.stem_relief_rank_height_pixels.length,
      p.stem_relief_rank_width_pixels, p.stem_relief_rank_pitch_pixels];
    (formats.has(JSON.stringify(format)) ? admitted : other).push(profile);
  }
  scene.comparison_domain = { measured_receiver_formats: [...formats.values()].sort(compare),
    admitted_profile_refs: admitted.map(p => p.component_ref), retained_other_profiles: other,
    exclusion_scope: 'not_homologous_to_these_receiver_formats; utility_and_role_unknown',
    axis_scope: 'declared_reference_cut_measurement_orientation; not_universal_geometry' };
  return stationProfileContext({ ...scene, profiles: admitted });
}
