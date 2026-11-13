/** Original observed_inventory/continuation.py and its consumed gauge-mark projection. */
import { display_matches } from './v6-inventory-contrast.ts';
import { patch } from './v6-inventory-boundary.ts';
import { locate } from './v6-inventory-measurements.ts';
import { pythonEqual as eq, pythonTruthy as truth } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';
type R = Record<string, any>;

/** geometry.gauge_related_marks: appearance relation only, no asserted refill role. */
export function gauge_related_marks(parts: R[], meter_forecast: R | null, size: readonly number[], excluded_sites: readonly (readonly number[])[] = []): number[][] {
  const marks: number[][] = [];
  if (truth(meter_forecast)) {
    const [axis, line, pigment] = meter_forecast!.measured_strip;
    for (const part of parts) {
      const [l, t, r, b] = part.bbox, on_strip = axis === 'x' ? t <= line && line <= b : l <= line && line <= r;
      if (part.color === pigment && !on_strip && r - l + 1 <= size[0]! && b - t + 1 <= size[1]!
        && !excluded_sites.some(site => l <= site[2]! && site[0]! <= r && t <= site[3]! && site[1]! <= b)) marks.push(part.bbox);
    }
  }
  return marks;
}

export function access_measurements(proposal: R | null, index: number, before: R, after: R, first: NativeRows, second: NativeRows): R | null {
  const offer = proposal?.inventory_plan?.offer ?? {};
  if (offer.kind !== 'access_probe_candidate' || before.level_epoch !== after.level_epoch || before.levels_completed !== after.levels_completed) return null;
  const step = proposal!.steps[index], expected = step.expected_after, display = offer.scene.displayed_candidate;
  if (!truth(expected) || !truth(display) || !eq(step.to_cell, offer.route.target_cell)) return null;
  if (before.observation_ref !== proposal!.binding.observation_ref) return null;
  const current_display = truth(display.visibility)
    ? display.current_observation_ref === before.observation_ref && display.current_level_epoch === before.level_epoch && eq(patch(first, display.display_bbox), display.current_indicator_pattern ?? null)
    : display_matches(display, first);
  if (!current_display || !eq(locate(first, offer.core), step.body_before) || !eq(locate(second, offer.core), expected.body_bbox)) return null;
  const cell = (offer.scene.grids[0].cells as R[]).find(c => eq([c.row, c.col], offer.route.target_cell));
  if (!cell) return null;
  const box = ['left', 'top', 'right', 'bottom'].map(k => cell.bbox[k]), [l, t, r, b] = box;
  const [bl, bt, br, bb] = expected.body_bbox; let changed = 0;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++)
    if (!(bl <= x && x <= br && bt <= y && y <= bb) && first[y]![x] !== second[y]![x]) changed++;
  const [dl, dt, dr, db] = display.display_bbox, value = display.source_value;
  let absent: boolean;
  if (truth(display.visibility)) absent = eq(patch(second, display.display_bbox), display.absence_pattern);
  else { absent = true; for (let y = dt; y <= db; y++) for (let x = dl; x <= dr; x++) if (second[y]![x] === value) absent = false; }
  return { current_scope_and_observation: true, entered_bound_partition: l <= bl && br <= r && t <= bt && bb <= b,
    partition_changed_outside_control: changed > 0, display_signature_disappeared: absent,
    before: before.observation_ref, after: after.observation_ref, level_epoch: after.level_epoch, partition_bbox: box,
    partition_changed_pixels: changed, display_bbox: display.display_bbox, cleared_display_pattern: second.slice(dt, db + 1).map(row => [...row.slice(dl, dr + 1)]),
    composition_ref: proposal!.bundle_template.composition_ref, objective_ref: proposal!.bundle_template.objective_ref,
    unknown: ['universal_consumption', 'capacity', 'terminal_rule', 'new_resource_effect'] };
}

export function capacity_targets(scene: R, obs: R, forecast: R | null, returned: R | null): any[] {
  if (!truth(returned) || returned!.level_epoch !== obs.level_epoch || !truth(forecast)
    || forecast!.observation_ref !== obs.observation_ref || forecast!.level_epoch !== obs.level_epoch || (scene.grids ?? []).length !== 1) return [];
  const grid = scene.grids[0], parts = (obs.entities as R[]).map(e => ({ bbox: e.bbox, color: e.palette_value }));
  const marks = gauge_related_marks(parts, forecast, [grid.cell_width, grid.cell_height], [scene.body]), targets: any[] = [];
  for (const box of marks) {
    const cells = (grid.cells as R[]).filter(c => c.bbox.left <= box[0]! && box[2]! <= c.bbox.right && c.bbox.top <= box[1]! && box[3]! <= c.bbox.bottom);
    if (cells.length !== 1) continue;
    const c = cells[0]!;
    targets.push([[c.row, c.col], { current_scope_and_observation: true, local_access_return_present: true, current_gauge_related_mark: true },
      { target_cell: [c.row, c.col], target_bbox: ['left', 'top', 'right', 'bottom'].map(k => c.bbox[k]), mark_bbox: box,
        observation_ref: obs.observation_ref, dependency_return: returned, appearance_relation_only: true }]);
  }
  return targets;
}
