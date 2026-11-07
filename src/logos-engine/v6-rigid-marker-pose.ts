/** Exact V5 measure_rigid_marker_poses closure used by ConstellationCover.
 * Reference: 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. All bounds and uncertainty
 * fields are retained; measurements never designate a controller or a goal.
 */
import { PointSet, pointKey, type Point } from './v6-point-set.ts';
import { v6Digest } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';
export type RigidMarkerRecord = Record<string, any>;
export interface RigidMarkerComponent { bbox: { top: number; left: number; height: number; width: number }; area: number; pixels: readonly Point[]; relative_pixels: readonly Point[]; value: number; touches_frame_boundary: boolean }
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const isInteger = (value: unknown): boolean => typeof value === 'boolean' || Number.isSafeInteger(value);
export async function measureRigidMarkerPoses(input: {
  frame: NativeRows; components: readonly RigidMarkerComponent[]; quantum: number | null; contract: RigidMarkerRecord | null;
  association_rows?: readonly RigidMarkerRecord[]; prior_target_rows?: readonly RigidMarkerRecord[]; prior_body_rows?: readonly RigidMarkerRecord[];
}): Promise<RigidMarkerRecord> {
  const { frame, components, quantum, contract, association_rows: associations = [], prior_target_rows: targets = [], prior_body_rows: priorBodies = [] } = input;
  const empty = { rigid_marker_pose_rows: [], rigid_marker_pose_enumeration_complete: true, rigid_marker_pose_group_count: 0, rigid_marker_non_axial_support_group_count: 0 };
  const invalid = () => ({ ...empty, rigid_marker_pose_enumeration_complete: false });
  if (!contract || !Object.keys(contract).length || quantum === null || quantum <= 0) return empty;
  if (!frame.length || !frame[0]!.length || new Set(frame.map(row => row.length)).size !== 1) return invalid();
  const height = frame.length, width = frame[0]!.length; if (height * width > contract.maximum_pixels) return invalid();
  const bounded = (point: readonly any[]) => point.length === 2 && point.every(isInteger) && 0 <= Number(point[0]) && Number(point[0]) < height && 0 <= Number(point[1]) && Number(point[1]) < width;
  if (targets.length > contract.maximum_groups || priorBodies.length > contract.maximum_groups || new Set(targets.map(row => row.partition_value)).size !== targets.length || new Set(priorBodies.map(row => row.partition_value)).size !== priorBodies.length) return invalid();
  for (const row of targets) {
    const centres: readonly Point[] = row.marker_centres, rings: readonly RigidMarkerRecord[] = row.marker_ring_rows;
    if (centres.length < contract.minimum_markers || centres.length > contract.maximum_markers || rings.length !== centres.length || centres.some(point => !bounded(point))
      || !new PointSet(centres).equals(new PointSet(rings.map(ring => ring.centre))) || rings.some(ring => !contract.ring_widths.includes(ring.ring_width))) return invalid();
  }
  for (const row of priorBodies) { const offsets: readonly Point[] = row.relative_support_pixels;
    if (!bounded(row.indicator_position) || offsets.length < contract.minimum_support_pixels || offsets.length > contract.maximum_support_pixels || offsets.some(point => point.length !== 2 || point.some(value => !isInteger(value) || Math.abs(value) >= Math.max(height, width)))) return invalid(); }
  const groups = new Map<number, Point[]>(), ringRows = new Map<number, readonly RigidMarkerRecord[]>(), excluded = new PointSet();
  for (const component of components) {
    const box = component.bbox; if (component.touches_frame_boundary) excluded.update(component.pixels);
    if (box.height !== box.width || !contract.ring_widths.includes(box.height) || component.area !== box.height * box.width - 1) continue;
    const middle = Math.floor(box.height / 2), centre: Point = [box.top + middle, box.left + middle], expected: Point[] = [];
    for (let r = 0; r < box.height; r++) for (let c = 0; c < box.width; c++) if (r !== middle || c !== middle) expected.push([r, c]);
    if (!same(component.relative_pixels, expected) || frame[centre[0]]![centre[1]] === component.value) continue;
    const value = frame[centre[0]]![centre[1]]!; if (!groups.has(value)) { groups.set(value, []); ringRows.set(value, []); }
    groups.get(value)!.push(centre); (ringRows.get(value)! as RigidMarkerRecord[]).push({ centre, ring_width: box.height, ring_value: component.value });
  }
  let contradictions = 0;
  for (const row of targets) { const value = row.partition_value, centres = row.marker_centres as Point[];
    contradictions += new PointSet(groups.get(value) ?? []).difference(new PointSet(centres)).size; groups.set(value, [...centres]); ringRows.set(value, row.marker_ring_rows); }
  if (groups.size > contract.maximum_groups) return invalid();
  const singletonPositions = components.filter(component => component.area === 1 && !component.touches_frame_boundary).map(component => component.pixels[0]!);
  const matchingAssociations = (point: Point) => associations.filter(association => association.active === true && association.role_ref === contract.indicator_role_ref && same(association.normalized_valued_pixels || [], [[0, 0, frame[point[0]]![point[1]]]]));
  const glyphPositions = new PointSet(singletonPositions.filter(point => matchingAssociations(point).length)).sorted(), markerPixels = new PointSet();
  for (const [, rings] of [...ringRows].sort(([a], [b]) => a - b)) for (const ring of rings) { const [r, c] = ring.centre, half = Math.floor(ring.ring_width / 2);
    for (let dr = -half; dr <= half; dr++) for (let dc = -half; dc <= half; dc++) markerPixels.add([r + dr, c + dc]); }
  const templates = new Map(priorBodies.map(row => [row.partition_value, row])), rows: RigidMarkerRecord[] = [];
  for (const [value, centres] of [...groups].sort(([a], [b]) => a - b)) {
    if (centres.length < contract.minimum_markers || centres.length > contract.maximum_markers) continue;
    const centreSet = new PointSet(centres), visiblePixels = new PointSet();
    for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) if (frame[r]![c] === value && !centreSet.has([r, c]) && !excluded.has([r, c])) visiblePixels.add([r, c]);
    let pixels = visiblePixels; const template = templates.get(value); let anchorCandidates: readonly Point[] = [], anchor: Point | null = null, incompatible = 0;
    if (template !== undefined) {
      const offsets = template.relative_support_pixels as readonly Point[], placed = (at: Point) => new PointSet(offsets.map(([dr, dc]) => [at[0] + dr, at[1] + dc] as Point));
      const incompatiblePixels = (predicted: PointSet) => [...predicted].filter(([r, c]) => !(0 <= r && r < height && 0 <= c && c < width) || (frame[r]![c] !== value && !markerPixels.has([r, c]) && !groups.has(frame[r]![c]!))).length;
      anchorCandidates = glyphPositions.filter(point => [...placed(point)].filter(p => visiblePixels.has(p)).length >= contract.minimum_support_pixels && incompatiblePixels(placed(point)) === 0);
      if (anchorCandidates.length <= 1) {
        anchor = anchorCandidates[0] ?? template.indicator_position; const predicted = placed(anchor!); incompatible = incompatiblePixels(predicted); if (incompatible === 0) pixels = visiblePixels.union(predicted);
      }
    }
    if (pixels.size < contract.minimum_support_pixels || pixels.size > contract.maximum_support_pixels) continue;
    const top = Math.min(...[...pixels].map(p => p[0])), bottom = Math.max(...[...pixels].map(p => p[0])), left = Math.min(...[...pixels].map(p => p[1])), right = Math.max(...[...pixels].map(p => p[1]));
    const adjacent = new Map(singletonPositions.map(([r, c]) => [pointKey([r, c]), contract.neighbour_offsets.filter(([dr, dc]: Point) => pixels.has([r + dr, c + dc])).length]));
    let internal = singletonPositions.filter(([r, c]) => top < r && r < bottom && left < c && c < right && frame[r]![c] !== value && (adjacent.get(pointKey([r, c]))! >= contract.minimum_internal_neighbours
      || Math.abs(2 * r - top - bottom) <= contract.maximum_midpoint_twice_offset && Math.abs(2 * c - left - right) <= contract.maximum_midpoint_twice_offset));
    if (template !== undefined) internal = [...anchorCandidates];
    const support = pixels.union(new PointSet(internal.filter(point => adjacent.get(pointKey(point))! >= contract.minimum_internal_neighbours))), remaining = support.copy(); let partitions = 0;
    while (remaining.size) { partitions++; const pending = [remaining.pop()];
      while (pending.length) { const [r, c] = pending.pop()!; for (const [dr, dc] of contract.neighbour_offsets as readonly Point[]) { const point: Point = [r + dr, c + dc]; if (remaining.delete(point)) pending.push(point); } } }
    if (partitions > (contract.maximum_visible_support_partitions ?? 1) && template === undefined) continue;
    let translations: PointSet | null = null;
    for (const [r, c] of centres) { const supported = new PointSet([...pixels].map(([br, bc]) => [r - br, c - bc] as Point)); translations = translations === null ? supported : translations.intersection(supported); }
    const translatedRows: RigidMarkerRecord[] = [];
    for (const [dr, dc] of translations?.sorted() ?? []) {
      if (dr % quantum || dc % quantum || !(0 <= top + dr && top + dr <= bottom + dr && bottom + dr < height && 0 <= left + dc && left + dc <= right + dc && right + dc < width)) continue;
      translatedRows.push({ delta_row: dr, delta_col: dc, primitive_distance: Math.floor((Math.abs(dr) + Math.abs(dc)) / quantum) });
    }
    if (translatedRows.length > contract.maximum_poses_per_group) return invalid();
    const token = (await v6Digest([value, pixels.sorted(), [...centres].sort((a, b) => a[0] - b[0] || a[1] - b[1])])).slice(0, 16);
    rows.push({ measurement_ref: `measurement.rigid_marker_pose.${token}`, partition_value: value, marker_centres: [...centres].sort((a, b) => a[0] - b[0] || a[1] - b[1]),
      marker_ring_rows: ringRows.get(value), visible_support_pixels: pixels.sorted(), support_bbox: [top, left, bottom, right], support_partition_count: partitions,
      internal_singleton_positions: internal, internal_singleton_values: internal.map(([r, c]) => frame[r]![c]),
      internal_singleton_association_rows: internal.flatMap(point => matchingAssociations(point).map(association => ({ position: point, association_ref: association.term_ref, source_claim_refs: association.source_claim_refs || [] }))),
      pose_rows: translatedRows, pose_count: translatedRows.length, uses_scoped_support_template: template !== undefined, template_pixel_incompatibility_count: incompatible,
      template_anchor_match_count: anchorCandidates.length, template_anchor: anchor,
      relative_support_pixels: internal.length === 1 ? template !== undefined ? template.relative_support_pixels : pixels.sorted().map(([r, c]) => [r - internal[0]![0], c - internal[0]![1]]) : [],
      translation_quantum: quantum, uses_visible_support_lower_bound: true, unobserved_support_is_not_certified: true });
  }
  const coveredByRowAndColumn = (points: readonly Point[]) => { const [row, col] = points[0]!;
    return new Set(points.filter(([r]) => r !== row).map(([, c]) => c)).size <= 1 || new Set(points.filter(([, c]) => c !== col).map(([r]) => r)).size <= 1; };
  return { rigid_marker_pose_rows: rows, rigid_marker_non_axial_support_group_count: rows.filter(row => !coveredByRowAndColumn(row.visible_support_pixels)).length,
    rigid_marker_pose_enumeration_complete: true, rigid_marker_pose_group_count: rows.length, rigid_marker_pose_all_groups_admitted: rows.length === groups.size,
    rigid_marker_visible_target_contradiction_count: contradictions };
}
