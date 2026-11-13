/** Original observed_inventory/boundary.py: current witnesses after a scope transition. */
import { display_matches } from './v6-inventory-contrast.ts';
import { find_body } from './v6-inventory-measurements.ts';
import { pythonEqual as eq, pythonTruthy as truth } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';
type R = Record<string, any>;
const copy = <T>(v: T): T => structuredClone(v);
const key = (p: readonly number[]): string => p.join(',');
const point = (p: string): number[] => p.split(',').map(Number);

export function patch(rows: NativeRows, box: readonly number[]): number[][] | null {
  const [l, t, r, b] = box;
  if (!(0 <= l! && l! <= r! && r! < rows[0]!.length && 0 <= t! && t! <= b! && b! < rows.length)) return null;
  return rows.slice(t, b! + 1).map(row => [...row.slice(l, r! + 1)]);
}

export function capture(before: R, after: R, first: NativeRows, _second: NativeRows, held: R | null, returns: R[], core: unknown): R | null {
  if (!truth(held) || !truth(core) || before.level_epoch === after.level_epoch || after.levels_completed <= before.levels_completed
    || !display_matches(held!, first)) return null;
  const blank = [...returns].reverse().find(z => z.level_epoch === before.level_epoch && truth(z.cleared_display_pattern) && eq(z.display_bbox, held!.display_bbox));
  if (!blank) return null;
  return { status: 'unconfirmed_persistence_after_scope_boundary', active: true, source_receipt: copy(held),
    source_epoch: before.level_epoch, target_epoch: after.level_epoch, old_control_signature: core,
    absence_pattern: copy(blank.cleared_display_pattern), absence_evidence: blank.evidence,
    before_boundary: before.observation_ref, after_boundary: after.observation_ref,
    evidence: [...held!.evidence, before.observation_ref, after.observation_ref],
    alternatives: ['same_content_with_changed_presentation', 'replacement', 'absence_with_changed_indicator'], release_authority: false };
}

export function revalidate(memory: R | null, obs: R, rows: NativeRows, methods: R[]): R {
  if (!truth(memory) || !truth(memory!.active) || memory!.target_epoch !== obs.level_epoch) return { status: 'out_of_scope' };
  const held = memory!.source_receipt, box = held.display_bbox, current = patch(rows, box), blank = memory!.absence_pattern;
  if (current === null) return { status: 'unbound_window' };
  if (eq(current, blank)) return { status: 'contradicted', reason: 'current_window_matches_prior_signature_absence_witness' };
  if (methods.some(m => !eq(m.source_mask ?? null, held.source_mask) && eq(m.display_bbox ?? null, box) && display_matches(m, rows)))
    return { status: 'contradicted', reason: 'different_previously_observed_signature_visible' };
  const changed: number[][] = [];
  for (let y = 0; y < current.length; y++) for (let x = 0; x < current[0]!.length; x++)
    if (current[y]![x] !== blank[y][x]) changed.push([x, y, current[y]![x]!]);
  const visible = display_matches(held, rows);
  if (!changed.length) return { status: 'unbound_window' };
  const xs = changed.map(p => p[0]!), ys = changed.map(p => p[1]!);
  const rectangular = changed.length === (Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1)
    && new Set(changed.map(p => p[2])).size === 1;
  if (!visible && !rectangular) return { status: 'ambiguous_presentation' };
  const body = find_body(obs, memory!.old_control_signature);
  if (body === null) return { status: 'unbound_control_correspondence' };
  const [l, t] = box;
  return { status: 'revalidated_hypothesis', body_signature: memory!.old_control_signature, body_bbox: body.bbox,
    record: { ...copy(held), visibility: visible ? 'observed_reappearance' : 'opaque_rewrite_hypothesis', current_indicator_pattern: current,
      current_indicator_pixels: changed.map(([x, y, v]) => [l + x!, t + y!, v]), absence_pattern: blank,
      current_observation_ref: obs.observation_ref, current_level_epoch: obs.level_epoch, evidence: [...memory!.evidence, obs.observation_ref],
      alternatives: memory!.alternatives, release_authority: false } };
}

export function complements(scene: R, rows: NativeRows, held: R): R[] {
  if ((scene.grids ?? []).length !== 1) return [];
  const grid = scene.grids[0], w = grid.cell_width, h = grid.cell_height;
  const shape = new Set<string>((held.source_mask as number[][]).map(key)), full = new Set<string>();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) full.add(key([x, y]));
  if (!shape.size || shape.size >= full.size) return [];
  const points = [...shape].map(point), maxX = Math.max(...points.map(p => p[0]!)), maxY = Math.max(...points.map(p => p[1]!)), out: R[] = [];
  for (const cell of grid.cells as R[]) {
    const b = cell.bbox, l = b.left, t = b.top, mask = new Set<string>();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rows[t + y]![l + x] === held.source_value) mask.add(key([x, y]));
    if (mask.size + shape.size !== full.size) continue;
    const offsets: number[][] = [];
    for (let dy = 0; dy < h - maxY; dy++) for (let dx = 0; dx < w - maxX; dx++) {
      const placed = new Set(points.map(([x, y]) => key([x! + dx, y! + dy]))), union = new Set([...mask, ...placed]);
      if (![...placed].some(p => mask.has(p)) && union.size === full.size && [...union].every(p => full.has(p))) offsets.push([dx, dy]);
    }
    if (offsets.length === 1) out.push({ target_row: cell.row, target_col: cell.col, target_bbox: [b.left, b.top, b.right, b.bottom],
      level_epoch: scene.level_epoch, source_value: held.source_value, display_component_ref: held.display_component_ref,
      shape_source: 'historically_observed_signature_not_current_pixels', offset: offsets[0], observation_ref: scene.observation_ref });
  }
  return out;
}

export function current_goal_witnesses(scene: R, rows: NativeRows, models: R[] | null): R[] {
  if ((scene.grids ?? []).length !== 1) return [];
  const out: R[] = [];
  for (const model of models ?? []) {
    if (!eq(model.role ?? null, scene.body_signature ?? null) || !truth(model.boundary_before)) continue;
    const old = model.scoring_pattern ?? [];
    for (const cell of scene.grids[0].cells as R[]) {
      const b = cell.bbox, w = b.right - b.left + 1, h = b.bottom - b.top + 1, pattern: number[] = [];
      for (let y = b.top; y <= b.bottom; y++) for (let x = b.left; x <= b.right; x++) pattern.push(rows[y]![x]!);
      if (old.length !== pattern.length || Math.min(w, h) < 3) continue;
      const rim: number[] = [], inside: number[] = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) (x === 0 || x === w - 1 || y === 0 || y === h - 1 ? rim : inside).push(y * w + x);
      const enclosed = new Set(rim.map(i => old[i])).size === 1 && inside.every(i => old[i] !== old[rim[0]!]);
      if (!eq(pattern, old) && !(enclosed && rim.every(i => pattern[i] === old[i]) && inside.every(i => pattern[i] !== old[rim[0]!]))) continue;
      const residual = inside.filter(i => pattern[i] !== old[i]).map(i => ({ cell_offset: [i % w, Math.floor(i / w)], prior: old[i], current: pattern[i] }));
      out.push({ boundary_before: model.boundary_before, boundary_after: model.boundary_after, current_cell: [cell.row, cell.col],
        current_observation_ref: scene.observation_ref, interior_residual: residual,
        qualification: residual.length ? 'current_contour_correspondence_to_prior_scoring_approach_with_unresolved_internal_conditions'
          : 'current_visual_correspondence_to_prior_scoring_approach_not_a_universal_terminal_law', release_authority: false });
    }
  }
  return out;
}
