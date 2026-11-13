/** Original observed_inventory/routing.py: conditional support paths, no goal authority. */
import { pythonEqual as eq, pythonTruthy as truth } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';
type R = Record<string, any>;
const key = (p: readonly number[]): string => p.join(',');
const point = (p: string): number[] => p.split(',').map(Number);
const xybox = (c: R): number[] => ['left', 'top', 'right', 'bottom'].map(k => c.bbox[k]);

export function measured_paths(facts: R, rows: NativeRows, target_cells: readonly (readonly number[])[],
  interface_hypotheses: R, available: ReadonlySet<string>, maximum = 16,
  conditional_cells: Iterable<readonly number[]> = []): R[] {
  if ((facts.grids ?? []).length !== 1) return [];
  const grid = facts.grids[0], [bl, bt, br, bb] = facts.body;
  const cells = new Map<string, R>((grid.cells as R[]).map(c => [key([c.row, c.col]), c]));
  const starts = [...cells].filter(([, c]) => c.bbox.left <= bl && bl <= br && br <= c.bbox.right && c.bbox.top <= bt && bt <= bb && bb <= c.bbox.bottom);
  if (starts.length !== 1) return [];
  const start = starts[0]![0], box = starts[0]![1].bbox, left = box.left, top = box.top;
  const w = grid.cell_width, h = grid.cell_height;
  let exterior = new Map<string, number>();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    if (!(bl <= left + x && left + x <= br && bt <= top + y && top + y <= bb)) exterior.set(key([x, y]), rows[top + y]![left + x]!);
  if (!exterior.size) return [];
  const departure = facts.conditional_departure_support;
  const overlay = truth(departure) ? departure : facts.underlay_evidence?.material_overlay;
  let retained = false;
  if (truth(overlay) && overlay.level_epoch === facts.level_epoch && eq(overlay.body_bbox, facts.body)
    && eq(overlay.cell_bbox, [box.left, box.top, box.right, box.bottom])
    && overlay.current_exterior.every(([x, y, v]: number[]) => eq(exterior.get(key([x!, y!])) ?? null, v))) {
    exterior = new Map(overlay.prior_exterior.map(([x, y, v]: number[]) => [key([x!, y!]), v!])); retained = true;
  }
  const controls = new Map<string, R>();
  for (const [cmd, delta] of Object.entries(interface_hypotheses) as [string, number[]][])
    if (available.has(cmd) && !(facts.rejected_interface_commands ?? []).includes(cmd))
      controls.set(cmd, { cell_delta: [delta[1], delta[0]], status: 'interface_mapping_hypothesis' });
  for (const [cmd, record] of Object.entries(facts.controls ?? {}) as [string, R][]) {
    const [dx, dy] = record.delta;
    if (available.has(cmd) && dx % grid.col_pitch === 0 && dy % grid.row_pitch === 0)
      controls.set(cmd, { cell_delta: [dy / grid.row_pitch, dx / grid.col_pitch],
        status: truth(record.recalled_hypothesis) ? 'recalled_translation_hypothesis' : 'observed_translation', evidence: record.evidence });
  }
  const allowed = new Set<string>();
  for (const [cellKey, c] of cells) if ([...exterior].every(([p, v]) => {
    const [x, y] = point(p); return rows[c.bbox.top + y!]![c.bbox.left + x!] === v;
  })) allowed.add(cellKey);
  const materialCandidates = new Map<string, R | null>();
  for (const layer of (facts.retained_material_surfaces ?? []) as R[]) {
    const matching = [...cells].filter(([, c]) => eq(xybox(c), layer.cell_bbox));
    if (matching.length !== 1) continue;
    const cellKey = matching[0]![0], substrate = layer.substrate_patch;
    if (substrate.length !== h || substrate.some((r: number[]) => r.length !== w)
      || [...exterior].some(([p, v]) => { const [x, y] = point(p); return substrate[y!]![x!] !== v; })) continue;
    materialCandidates.set(cellKey, materialCandidates.has(cellKey) ? null : layer);
  }
  const materials = new Map([...materialCandidates].filter((entry): entry is [string, R] => entry[1] !== null));
  for (const p of materials.keys()) allowed.add(p);
  const conditional = new Set([...conditional_cells].map(key)), results: R[] = [];
  for (const target of target_cells) {
    const end = key(target), queue = [start], parent = new Map<string, string | null>([[start, null]]), edge = new Map<string, [string, R]>();
    for (let cursor = 0; cursor < queue.length && !parent.has(end); cursor++) {
      const current = queue[cursor]!, [r, c] = point(current);
      for (const [cmd, control] of controls) {
        const [dr, dc] = control.cell_delta, dest = key([r! + dr, c! + dc]);
        if (!cells.has(dest) || parent.has(dest) || (!allowed.has(dest) && dest !== end && !conditional.has(dest))) continue;
        parent.set(dest, current); edge.set(dest, [cmd, control]); queue.push(dest);
      }
    }
    if (!parent.has(end)) continue;
    const reverse: R[] = []; let p = end;
    while (parent.get(p) !== null) {
      const [cmd, control] = edge.get(p)!, from = parent.get(p)!;
      reverse.push({ action: { action_ref: cmd }, from_cell: point(from), to_cell: point(p), control,
        surface_status: materials.has(p) ? 'retained_material_surface_hypothesis' : allowed.has(p) ? 'matching_observed_exterior_hypothesis'
          : conditional.has(p) ? 'conditional_intermediate_partition' : 'destination_effect_unknown' });
      p = from;
    }
    const path = reverse.reverse(), prefix: R[] = [];
    for (let step of path.slice(0, maximum)) {
      const destination = key(step.to_cell);
      if (materials.has(destination)) step = { ...step, control: { ...step.control, status: 'retained_material_entry_hypothesis', surface_evidence: materials.get(destination)!.evidence } };
      if (retained && !prefix.length) step = { ...step, control: { ...step.control,
        status: truth(departure) ? 'retained_endpoint_departure_hypothesis' : 'retained_surface_departure_hypothesis', surface_evidence: overlay.evidence } };
      if (destination === end && prefix.length) break;
      prefix.push(step);
      if (step.control.status !== 'observed_translation' || destination === end) break;
    }
    const result: R = { target_cell: point(end), length: path.length, prefix, path, start_cell: point(start),
      support_evidence: retained && truth(departure) ? 'entered_support_and_current_endpoint_revalidated'
        : retained ? 'retained_pre_material_exterior_currently_revalidated' : 'matching_current_exterior_of_candidate_body_cell',
      hypotheses: ['other_similar_surfaces_may_differ', 'interface_direction_not_an_acquired_game_law'], resource_model_required: true };
    if (retained && truth(departure)) result.conditional_departure_support = departure;
    const used = path.flatMap(step => { const layer = materials.get(key(step.to_cell)); return layer ? [layer] : []; });
    if (used.length) result.conditional_material_entries = used.map(layer => Object.fromEntries(
      ['cell_bbox', 'evidence', 'qualification', 'visible_pixels', 'hidden_pixels'].map(k => [k, layer[k]])));
    results.push(result);
  }
  return results;
}
