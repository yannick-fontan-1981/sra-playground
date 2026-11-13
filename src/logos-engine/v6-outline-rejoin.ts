/** Mechanical transfer of V5 interaction._adjacent_unmarked_compact_body_capture
 * from 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 *
 * The original helper measures both a post-intervention rejoin relation and
 * adjacent unmarked bodies. Its returned action mapping is the latter only;
 * the rejoin action remains in the named summary field. No action is selected
 * and no effect, role, obstacle or terminal rule is inferred here. */
import { detectV5Components } from './v6-native-observer.ts';
import type { V5BoundingBox, V5Component } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';
import type { OutlineFields } from './v6-outline-geometry.ts';
import { compareUnicode } from './canonical.ts';

type R = Record<string, any>;
type Point = readonly [number, number];
type Box = V5BoundingBox;
const key = (point: Point): string => point.join(',');
const samePoint = (a: Point, b: Point): boolean => a[0] === b[0] && a[1] === b[1];
const sameBox = (a: Box, b: Box): boolean => a.top === b.top && a.left === b.left && a.bottom === b.bottom && a.right === b.right;
const box = (left: number, top: number, right: number, bottom: number): Box => ({ left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 });
const asBox = (value: any): Box => Array.isArray(value) ? box(value[0], value[1], value[2], value[3]) : box(value.left, value.top, value.right, value.bottom);
const normalized = (point: Point): Point => [Math.sign(point[0]), Math.sign(point[1])];

/** Input fields are the same public morphology fields used by the other
 * Outline measurements. Component and relation bounds retain source order,
 * including the source's explicit `> 3` ambiguity/refusal summaries. */
export async function measureOutlineRejoinAndCapture(rows: NativeRows, fields: OutlineFields): Promise<[R, R]> {
  if (!Array.isArray(fields.available_action_refs) || !fields.available_action_refs.length) throw new TypeError('Outline rejoin requires available actions');
  for (const [name, limit] of [['canonical_provisional_control_term_facts', 64], ['canonical_provisional_control_geometry_bboxes', 3],
    ['current_action_conditioned_control_outline_bboxes', 64]] as const) {
    if (fields[name] !== undefined && (!Array.isArray(fields[name]) || fields[name].length > limit)) throw new TypeError(`Outline rejoin ${name} exceeds its source contract`);
  }
  const empty: R = {
    adjacent_compact_body_without_visible_cardinal_marker_count: 0,
    controlled_lead_distinct_uniform_interior_present: false,
    filled_logical_cell_opposite_last_direction_present: false,
    adjacent_unmarked_compact_body_route_bound_reached: false,
    body_perimeter_marker_rejoin_count: 0,
    compact_body_perimeter_cardinal_announcement_count: 0,
    controlled_lead_cardinally_adjacent_to_announced_cell: false,
    body_perimeter_marker_rejoin_route_first_action_ref: '',
    body_perimeter_marker_rejoin_route_bound_reached: false,
  };
  const terms: R[] = fields.canonical_provisional_control_term_facts ?? [];
  const retained = (fields.canonical_provisional_control_geometry_bboxes ?? []).map(asBox) as Box[];
  if (!terms.length || retained.length !== 1) return [{}, empty];
  let lead = retained[0]!;
  const quantumRow = lead.height, quantumCol = lead.width;
  if (quantumRow < 3 || quantumCol < 3) return [{}, empty];
  const supplied = fields.current_observed_frame;
  const current: NativeRows = supplied == null ? rows : Array.isArray(supplied) ? supplied : supplied.rows;
  const components = (await detectV5Components(current, 4)).components.filter(component => !component.touches_frame_boundary).slice(0, 128);
  const bodies = components.filter(component => component.bbox.height === quantumRow - 1 && component.bbox.width === quantumCol - 1
    && component.area === (quantumRow - 1) * (quantumCol - 1)).slice(0, 64);
  const markers = components.filter(component => component.area === 1).slice(0, 64);
  const directions = new Map<string, Point>();
  for (const [action, dr, dc] of fields.interface_action_translation_deltas ?? []) {
    if (fields.available_action_refs.includes(action)) directions.set(String(action), normalized([Number(dr), Number(dc)]));
  }
  const ordered = [...directions.entries()].sort(([a], [b]) => compareUnicode(a, b));
  const cardinalDirections = [...new Map([...directions.values()].filter(([dr, dc]) => (dr === 0) !== (dc === 0)).map(value => [key(value), value])).values()]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const rim = new Set<string>();
  for (let row = 0; row < quantumRow; row++) for (let col = 0; col < quantumCol; col++) {
    if (row === 0 || col === 0 || row === quantumRow - 1 || col === quantumCol - 1) rim.add(key([row, col]));
  }
  const exactPerimeter = (component: V5Component): boolean => {
    if (component.bbox.height !== quantumRow || component.bbox.width !== quantumCol) return false;
    const pixels = new Set(component.relative_pixels.map(key));
    return pixels.size === rim.size && [...pixels].every(point => rim.has(point));
  };
  if (terms.length !== 1) {
    const outlines = (fields.current_action_conditioned_control_outline_bboxes ?? []).map(asBox) as Box[];
    if (outlines.length !== 1) return [{}, empty];
    const currentOutline = outlines[0]!;
    if (currentOutline.height !== quantumRow || currentOutline.width !== quantumCol) return [{}, empty];
    if (components.filter(component => sameBox(component.bbox, currentOutline) && exactPerimeter(component)).length !== 1) return [{}, empty];
    lead = currentOutline;
  }
  const perimeters = components.filter(exactPerimeter).slice(0, 64);
  const rejoinRelations: R[] = [], announced = new Set<string>();
  bodyLoop: for (const body of bodies) {
    const origin: Point = [body.bbox.top - 1, body.bbox.left - 1];
    for (const marker of markers) {
      if (marker.value !== body.value) continue;
      const [markerRow, markerCol] = marker.pixels[0]!;
      for (const [, [dr, dc]] of ordered) {
        if (!samePoint([markerRow, markerCol], [body.bbox.top + dr * quantumRow, body.bbox.left + dc * quantumCol])) continue;
        // Original V5 counts correspondence independently of the lead's pose
        // and of whether the next body step reduces the target distance.
        for (const perimeter of perimeters) if (perimeter.value === body.value) {
          announced.add(JSON.stringify([body.component_id, marker.component_id, perimeter.component_id]));
        }
        const markerCell = box(markerCol - 1, markerRow - 1, markerCol + quantumCol - 2, markerRow + quantumRow - 2);
        const delta: Point = [markerCell.top - lead.top, markerCell.left - lead.left];
        if (Math.floor(Math.abs(delta[0]) / quantumRow) + Math.floor(Math.abs(delta[1]) / quantumCol) !== 1
          || delta[0] % quantumRow || delta[1] % quantumCol) continue;
        const leadDirection = normalized(delta), actionRefs = ordered.filter(([, direction]) => samePoint(direction, leadDirection)).map(([action]) => action);
        if (actionRefs.length !== 1) continue;
        for (const perimeter of perimeters) {
          if (perimeter.value !== body.value) continue;
          const target: Point = [perimeter.bbox.top, perimeter.bbox.left];
          const distance = Math.floor(Math.abs(target[0] - origin[0]) / quantumRow) + Math.floor(Math.abs(target[1] - origin[1]) / quantumCol);
          const destination: Point = [origin[0] + dr * quantumRow, origin[1] + dc * quantumCol];
          const nextDistance = Math.floor(Math.abs(target[0] - destination[0]) / quantumRow) + Math.floor(Math.abs(target[1] - destination[1]) / quantumCol);
          if (nextDistance >= distance) continue;
          rejoinRelations.push({ action_ref: actionRefs[0], compact_body_component_ref: body.component_id,
            hollow_perimeter_component_ref: perimeter.component_id, cardinal_marker_component_ref: marker.component_id });
          if (rejoinRelations.length > 3) break bodyLoop;
        }
      }
    }
  }

  const interior: number[] = [], outerPoints: Point[] = [];
  for (let row = lead.top + 1; row < lead.bottom; row++) for (let col = lead.left + 1; col < lead.right; col++) interior.push(current[row]![col]!);
  // Match the original Counter insertion order, including ties.
  for (let col = lead.left; col <= lead.right; col++) outerPoints.push([lead.top - 1, col]);
  for (let col = lead.left; col <= lead.right; col++) outerPoints.push([lead.bottom + 1, col]);
  for (let row = lead.top; row <= lead.bottom; row++) outerPoints.push([row, lead.left - 1]);
  for (let row = lead.top; row <= lead.bottom; row++) outerPoints.push([row, lead.right + 1]);
  const counts = new Map<number, number>();
  for (const [row, col] of outerPoints) if (row >= 0 && row < current.length && col >= 0 && col < current[0]!.length) {
    const value = current[row]![col]!; counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let dominant: number | null = null, highest = 0;
  for (const [value, count] of counts) if (count > highest) { dominant = value; highest = count; }
  const distinctInterior = interior.length > 0 && new Set(interior).size === 1 && interior[0] !== dominant;

  const adjacent: R[] = [];
  for (const body of bodies) {
    const origin: Point = [body.bbox.top - 1, body.bbox.left - 1];
    const actions = ordered.filter(([, [dr, dc]]) => samePoint(origin, [lead.top + dr * quantumRow, lead.left + dc * quantumCol])).map(([action]) => action);
    if (actions.length !== 1) continue;
    let marked = false;
    for (const marker of markers) {
      if (marker.value !== body.value) continue;
      const [row, col] = marker.pixels[0]!;
      for (const [dr, dc] of cardinalDirections) {
        const destination: Point = [origin[0] + dr * quantumRow, origin[1] + dc * quantumCol];
        if (destination[0] + 1 <= row && row <= destination[0] + quantumRow - 2
          && destination[1] + 1 <= col && col <= destination[1] + quantumCol - 2) { marked = true; break; }
      }
      if (marked) break;
    }
    if (!marked) adjacent.push({ action_ref: actions[0], compact_body_component_ref: body.component_id });
    if (adjacent.length > 3) return [{}, { ...empty, adjacent_compact_body_without_visible_cardinal_marker_count: adjacent.length,
      controlled_lead_distinct_uniform_interior_present: distinctInterior, adjacent_unmarked_compact_body_route_bound_reached: true }];
  }
  const lastDirection = directions.get(String(fields.last_action_ref || ''));
  let filledBehind = false;
  if (lastDirection && (lastDirection[0] === 0) !== (lastDirection[1] === 0)) {
    const [dr, dc] = lastDirection;
    const behind = box(lead.left - dc * quantumCol, lead.top - dr * quantumRow, lead.right - dc * quantumCol, lead.bottom - dr * quantumRow);
    filledBehind = components.some(component => sameBox(component.bbox, behind) && component.area === quantumRow * quantumCol);
  }
  const summary = { ...empty, adjacent_compact_body_without_visible_cardinal_marker_count: adjacent.length,
    controlled_lead_distinct_uniform_interior_present: distinctInterior, filled_logical_cell_opposite_last_direction_present: filledBehind,
    body_perimeter_marker_rejoin_count: rejoinRelations.length, compact_body_perimeter_cardinal_announcement_count: announced.size,
    controlled_lead_cardinally_adjacent_to_announced_cell: rejoinRelations.length > 0,
    body_perimeter_marker_rejoin_route_first_action_ref: rejoinRelations.length === 1 ? String(rejoinRelations[0]!.action_ref) : '',
    body_perimeter_marker_rejoin_route_bound_reached: rejoinRelations.length > 3 };
  return adjacent.length === 1 ? [{ [String(adjacent[0]!.action_ref)]: adjacent[0]! }, summary] : [{}, summary];
}
