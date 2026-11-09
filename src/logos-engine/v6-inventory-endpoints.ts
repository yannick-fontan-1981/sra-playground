/** Original observed_inventory/endpoints.py: existing V5 measurements, no action authority. */
import { _provisional_object_terminating_routes } from './v6-inventory-measurements.ts';
import { pythonEqual as eq, pythonTruthy as truth } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';
type R = Record<string, any>;
const copy = <T>(v: T): T => structuredClone(v);
export const enclosed = (inner: readonly number[], outer: readonly number[]): boolean =>
  outer[0]! <= inner[0]! && inner[0]! <= inner[2]! && inner[2]! <= outer[2]!
  && outer[1]! <= inner[1]! && inner[1]! <= inner[3]! && inner[3]! <= outer[3]!;
export const xybox = (cell: R): number[] => ['left', 'top', 'right', 'bottom'].map(k => cell.bbox[k]);

export function endpoint_measurements(scene: R, probe: R | null, obs: R, rows: NativeRows, forecast: R | null,
  returned: R | null, visited: Map<string, R>, interfaces: R): any[] {
  if ((truth(returned) && returned!.level_epoch !== obs.level_epoch) || probe === null || (scene.grids ?? []).length !== 1) return [];
  const current_forecast = truth(forecast) && forecast!.observation_ref === obs.observation_ref && forecast!.level_epoch === obs.level_epoch;
  const grid = scene.grids[0], starts = (grid.cells as R[]).filter(c => enclosed(scene.body, xybox(c)));
  if (starts.length !== 1) return [];
  const v = { ...probe, established_boundary_indicator_present: current_forecast,
    boundary_indicator_remaining_quantum_count: current_forecast ? forecast!.steps_before_empty : null,
    interface_action_translation_deltas: Object.entries(interfaces).map(([cmd, vector]: [string, any]) => [cmd, vector[1], vector[0]]),
    action_conditioned_grid_evidence: true, visited_input_aligned_entity_bboxes: [...visited.keys()].map(k => {
      const [left, top, right, bottom] = k.split(',').map(Number); return { left, top, right, bottom };
    }) };
  const [routes] = _provisional_object_terminating_routes(v), out: any[] = [];
  for (const [route, _aligned, ref, _trace] of (routes instanceof Map ? routes.values() : Object.values(routes)) as Iterable<any[]>) {
    if (!route.length || route.some((a: string) => !Object.hasOwn(scene.controls, a) && !Object.hasOwn(interfaces, a))) continue;
    let dr = 0, dc = 0;
    for (const a of route as string[]) {
      dr += Object.hasOwn(scene.controls, a) ? scene.controls[a].delta[1] : interfaces[a][1] * grid.row_pitch;
      dc += Object.hasOwn(scene.controls, a) ? scene.controls[a].delta[0] : interfaces[a][0] * grid.col_pitch;
    }
    if (dr % grid.row_pitch || dc % grid.col_pitch) continue;
    const dest = [starts[0]!.row + dr / grid.row_pitch, starts[0]!.col + dc / grid.col_pitch];
    const cell = (grid.cells as R[]).find(c => eq([c.row, c.col], dest)); if (!cell) continue;
    const box = xybox(cell), [l, t, r, b] = box;
    const entities = (obs.entities as R[]).filter(e => !truth(e.identity_ambiguous) && e.area > 1 && enclosed(e.bbox, box));
    const measured = { source_cell: [...dest], source_bbox: box, source_entity: entities.length === 1 ? copy(entities[0]) : null,
      source_entities: copy(entities), cell_pixels: rows.slice(t, b! + 1).map(row => row.slice(l, r! + 1)),
      level_epoch: obs.level_epoch, observed_at: obs.observation_ref, route_ref: ref, route_actions: [...route],
      endpoint_role: 'unknown', dependency_return: truth(returned) ? returned : {} };
    out.push([[...dest], { unassigned_endpoint_measured: true }, measured]);
  }
  return out;
}

export function retained_method_targets(scene: R, obs: R, rows: NativeRows, memories: R[], methods: R[], returned: R | null): any[] {
  if (!truth(returned) || returned!.level_epoch !== obs.level_epoch || truth(scene.displayed_candidate)) return [];
  const display = returned!.cleared_display_pattern, displayBox = returned!.display_bbox;
  if (!truth(display) || !truth(displayBox)) return [];
  const [dl, dt, dr, db] = displayBox;
  if (!eq(rows.slice(dt, db + 1).map(row => row.slice(dl, dr + 1)), display)) return [];
  const available = methods.filter(m => truth(m.evidence) && m.status === 'observed_correspondence_possession_hypothesis'
    && obs.available_action_refs.includes(m.action.action_ref) && eq(m.display_bbox, displayBox));
  if (new Set(available.map(m => m.action.action_ref)).size !== 1) return [];
  const method = available.at(-1)!, out: any[] = [];
  for (const item of memories) {
    const entities = truth(item.source_entities) ? item.source_entities : truth(item.source_entity) ? [item.source_entity] : [];
    const box = item.source_bbox;
    if (item.level_epoch !== obs.level_epoch || !entities.length || !enclosed(scene.body, box)) continue;
    const [l, t, r, b] = box, [bl, bt, br, bb] = scene.body, pixels = item.cell_pixels, under = scene.underlay_evidence ?? {};
    if (!eq(under.cell_bbox ?? [], box)) continue;
    let changed = false;
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++)
      if (!(bl <= x && x <= br && bt <= y && y <= bb) && rows[y]![x] !== pixels[y - t][x - l]) changed = true;
    if (changed) continue;
    const proposal = { ...copy(item), method, method_action: copy(method.action), current_peripheral_clear_ref: obs.observation_ref,
      competing_source_signatures: entities.map((e: R) => e.signature),
      unknown: ['transfer_applicability', 'new_occurrence_usefulness', 'capacity', 'terminal_rule'] };
    out.push([item.source_cell, { retained_endpoint_current: true, observed_method_revalidated: true }, proposal]);
  }
  return out;
}
