/** Exact geometry.py closure for pinned V6 ReactiveContact.
 * The grid helper implements the source call's supplied fields/defaults only:
 * one current box, observed/known translations, retained geometry; no retained
 * recount, interface vectors, periodic/fill grid or recalled sprite is supplied.
 * Those source branches abstain, rather than inventing a broader grid solver. */
import { symbolicDigest } from './v6-hash.ts';
import { supportParts, supportCompare, measureCurrentSupportUnderlays } from './v6-support-measurements.ts';
import { outlineEqual as same, outlineTruthy as truth } from './v6-outline-identity.ts';
import { measure_reactive_pursuit_observation } from './v6-reactive-contact-measurements.ts';
import type { NativeRows } from './v6-native-types.ts';
export { occupied_union, occupiedUnion, translated_mask, translatedMask, support_collisions, supportCollisions, candidate_grasp_roots, candidateGraspRoots } from './v6-reactive-contact-measurements.ts';
type R = Record<string, any>;
const key = (p: readonly number[]): string => p.join(',');
export const digest = (value: unknown): string => symbolicDigest(value);
export const detect_components = (rows: NativeRows): { components: R[] } => ({ components: supportParts(rows) });
export function unique(obs: R): R { return Object.fromEntries(obs.entities.filter((e: R) => obs.entities.filter((x: R) => same(x.signature, e.signature)).length === 1).map((e: R) => [e.signature, e])); }
export function patch(rows: NativeRows, box: readonly number[]): number[][] { return rows.slice(box[1], box[3]! + 1).map(row => [...row.slice(box[0], box[2]! + 1)]); }
/** This source helper intentionally uses the full rectangle. Escape geometry
 * separately demands the real entity mask; callers must preserve that split. */
export function mask(entity: R): number[][] { const b = entity.bbox, out: number[][] = []; for (let y = b[1]; y <= b[3]; y++) for (let x = b[0]; x <= b[2]; x++) out.push([x, y]); return out; }
export function movements(before: R, after: R): R[] {
  const a = unique(before), b = unique(after);
  return Object.keys(a).filter(k => Object.hasOwn(b, k) && !same(a[k].bbox, b[k].bbox) && a[k].area >= 4 && a[k].area === (a[k].bbox[2] - a[k].bbox[0] + 1) * (a[k].bbox[3] - a[k].bbox[1] + 1)).map(k => ({ signature: k, before: a[k], after: b[k], delta: [b[k].bbox[0] - a[k].bbox[0], b[k].bbox[1] - a[k].bbox[1]] }));
}
export function relative(before: R, after: R, first: NativeRows, second: NativeRows, core: string, quantum: number): R | null {
  const body = unique(after)[core]; if (!body) return null;
  const components = supportParts(second), bybox = Object.fromEntries(components.map(c => [key([c.bbox.left, c.bbox.top, c.bbox.right, c.bbox.bottom]), c.component_id]));
  const motion = movements(before, after), translations = motion.filter(m => Object.hasOwn(bybox, key(m.after.bbox))).map(m => [bybox[key(m.after.bbox)], m.delta[1], m.delta[0]]);
  const bodyRef = bybox[key(body.bbox)], bodyDeltas = translations.filter(([ref]) => ref === bodyRef).map(([, dr, dc]) => [dr, dc]);
  let underlay: number[] = [];
  if (same(before.level_epoch, after.level_epoch) && bodyDeltas.length === 1) {
    const matches = measureCurrentSupportUnderlays(first, second).filter(row => row.component_ref === bodyRef && same(row.translation_delta, bodyDeltas[0]));
    if (matches.length === 1) underlay = [...new Set<number>(matches[0]!.observed_underlay_pixels.map((p: number[]) => p[2]!))].sort((a, b) => a - b);
  }
  return measure_reactive_pursuit_observation({ frame: second, available_action_refs: after.available_action_refs, canonical_provisional_control_geometry_bboxes: [body.bbox], current_observation_frame_ref: after.observation_ref,
    components: { components }, current_exact_component_translations: translations, previous_action_observed_frame: first, current_input_aligned_underlay_values: underlay }, { contact_quantum: quantum, contact_grid_current: true });
}

/** Exact _action_quantized_route_grid_candidates at geometry.scene's call.
 * Its default retained recount/ref are absent, so the source fallback is null.
 * Fill-growth and pattern-role sources are likewise empty at this call. */
export function reactive_route_grid(rows: NativeRows, body: R, control: R, observation: R): R | null {
  const known = Object.entries(control.commands ?? {}) as [string, number[]][];
  const observed = control.last_motion?.after_ref === observation.observation_ref ? control.last_motion.translation : null;
  const calibrated = known.filter(([, [dx, dy]]) => (dx === 0) !== (dy === 0) && Math.abs(dy || dx || 0) > 1);
  if (observed === null && calibrated.length < 2) return null;
  const quanta = new Set(calibrated.map(([, [dx, dy]]) => Math.abs(dy || dx || 0)));
  const [l, t, r, b] = body.bbox, height = b - t + 1, width = r - l + 1;
  if (observed !== null) { const [, dr, dc] = observed, q = Math.abs(dr || dc); if ((dr === 0) !== (dc === 0) && q > 1 && height <= q && width <= q) quanta.add(q); }
  if (!quanta.size) return null;
  const quantum = Math.min(...quanta); if ([...quanta].some(q => q % quantum !== 0) || quantum > 32 || height > quantum || width > quantum || (quantum - height) % 2 || (quantum - width) % 2) return null;
  const mod = (n: number) => (n % quantum + quantum) % quantum, rowOffset = mod(t - Math.floor((quantum - height) / 2)), colOffset = mod(l - Math.floor((quantum - width) / 2));
  const rowStarts: number[] = [], colStarts: number[] = [];
  for (let y = rowOffset; y <= rows.length - quantum; y += quantum) rowStarts.push(y);
  for (let x = colOffset; x <= rows[0]!.length - quantum; x += quantum) colStarts.push(x);
  if (rowStarts.length < 2 || colStarts.length < 2) return null;
  const patterns = rowStarts.flatMap(y => colStarts.map(x => patch(rows, [x, y, x + quantum - 1, y + quantum - 1]))), counts = new Map<string, number>();
  for (const p of patterns) { const k = JSON.stringify(p); counts.set(k, (counts.get(k) ?? 0) + 1); }
  const cells = rowStarts.flatMap((y, rr) => colStarts.map((x, cc) => { const p = patterns[rr * colStarts.length + cc]!, values = [...new Set(p.flat())].sort((a, b) => a - b); return { row: rr, col: cc,
    bbox: { left: x, top: y, right: x + quantum - 1, bottom: y + quantum - 1, width: quantum, height: quantum }, point: [y + Math.floor(quantum / 2), x + Math.floor(quantum / 2)], pattern_ref: 'measurement.cell_pattern.' + digest(p).slice(0, 16), palette_value_count: values.length, palette_values: values, pattern_occurrence_count: counts.get(JSON.stringify(p)) }; }));
  return { candidate_ref: `measurement.periodic_grid.action_centered.r${rowOffset}.${quantum}.0.c${colOffset}.${quantum}.0`, row_offset: rowOffset, col_offset: colOffset, cell_height: quantum, cell_width: quantum, row_gap: 0, col_gap: 0, row_pitch: quantum, col_pitch: quantum,
    logical_rows: rowStarts.length, logical_columns: colStarts.length, separator_consistency_ppm: 0, repeated_pattern_count: [...counts.values()].filter(n => n > 1).length, distinct_pattern_count: counts.size, cells };
}

export function scene(obs: R, rows: NativeRows, control: R, peer: string | null, floor: number | null): R | null {
  const entities = unique(obs), body = entities[control.signature], target = peer ? entities[peer] : null;
  if (!body || !target || floor === null) return null;
  const grid = reactive_route_grid(rows, body, control, obs); if (!grid) return null;
  const pitch = grid.row_pitch; control.grid = ['row_offset', 'col_offset', 'cell_height', 'cell_width', 'row_pitch', 'col_pitch', 'logical_rows', 'logical_columns'].map(k => grid[k]);
  if (pitch !== grid.col_pitch) return null;
  const tiles: R = {};
  for (const cell of grid.cells) { const b = cell.bbox, k = `${b.left},${b.top}`; tiles[k] = { key: k, box: [b.left, b.top, b.right, b.bottom], patch: patch(rows, [b.left, b.top, b.right, b.bottom]), center: [Math.floor((b.left + b.right) / 2), Math.floor((b.top + b.bottom) / 2)] }; }
  const cellKey = (e: R): string | null => { const b = e.bbox, matches = Object.entries(tiles).filter(([, v]) => v.box[0] <= b[0] && b[0] <= b[2] && b[2] <= v.box[2] && v.box[1] <= b[1] && b[1] <= b[3] && b[3] <= v.box[3]); return matches.length === 1 ? matches[0]![0] : null; };
  const bk = cellKey(body), tk = cellKey(target); if (bk === null || tk === null) return null;
  const stones: R[] = [];
  for (const e of obs.entities as R[]) {
    if ([control.signature, peer].includes(e.signature) || e.area !== body.area || e.bbox[2] - e.bbox[0] !== body.bbox[2] - body.bbox[0] || e.bbox[3] - e.bbox[1] !== body.bbox[3] - body.bbox[1]) continue;
    const k = cellKey(e), covered = new Set(mask(e).map(key));
    if (k && mask({ bbox: tiles[k].box }).every(([x, y]) => covered.has(key([x!, y!])) || rows[y!]![x!] === floor)) stones.push({ ...e, key: k });
  }
  const admitted = new Set(Object.entries(tiles).filter(([, t]) => t.patch.flat().every((v: number) => v === floor)).map(([k]) => k)); admitted.add(bk); admitted.add(tk);
  return { current_entities: obs.entities, body, peer: target, bodykey: bk, peerkey: tk, stones, tiles, admitted, pitch, grid: Object.fromEntries(['row_offset', 'col_offset', 'row_pitch', 'col_pitch', 'cell_height', 'cell_width'].map(k => [k, grid[k]])) };
}

export function routes(current: R, directions: R, excluded: Iterable<string> = [], _part: R | null = null): [R, R] {
  const excludedSet = new Set(excluded), allowed = new Set<string>([...current.admitted].filter((k: string) => !excludedSet.has(k))); allowed.add(current.bodykey);
  const ordered = [...allowed].sort(), adjacency = new Map<string, string[]>(), actions = new Map<string, string>(); let work = 0;
  for (const k of ordered) { const [x, y] = current.tiles[k].box, ns: string[] = []; for (const [a, [dx, dy]] of Object.entries(directions) as [string, number[]][]) { const n = `${x + dx! * current.pitch},${y + dy! * current.pitch}`; if (allowed.has(n)) { work++; ns.push(n); actions.set(k + '\0' + n, a); } } adjacency.set(k, ns); }
  const parents = new Map<string, string | null>(), depth = new Map<string, number>(); if (adjacency.has(current.bodykey)) { parents.set(current.bodykey, null); depth.set(current.bodykey, 0); }
  const queue = [...parents.keys()]; let cursor = 0, truncated = false; const bound = Math.max(1, allowed.size);
  while (cursor < queue.length) { const at = queue[cursor++]!; work++; const ns = adjacency.get(at)!; if (depth.get(at)! >= bound) { truncated ||= ns.some(n => !parents.has(n)); continue; } for (const n of [...ns].sort()) if (!parents.has(n)) { parents.set(n, at); depth.set(n, depth.get(at)! + 1); queue.push(n); } }
  const out: R = {};
  for (const k of parents.keys()) { const path: string[] = []; let at: string | null = k; while (at !== null) { path.push(at); at = parents.get(at)!; } path.reverse(); out[k] = path.slice(1).map((b, i) => ({ action: { action_ref: actions.get(path[i]! + '\0' + b) }, before: path[i], after: b })); }
  return [out, { nodes: allowed.size, evaluations: work, truncated, support_is_conditional: true }];
}

export function current_body_box(rows: NativeRows, body: R): number[] | null {
  const b = body.bbox, matches = supportParts(rows).filter(c => c.value === body.palette_value && c.area === body.area && c.bbox.width === b[2] - b[0] + 1 && c.bbox.height === b[3] - b[1] + 1);
  return matches.length === 1 ? [matches[0]!.bbox.left, matches[0]!.bbox.top, matches[0]!.bbox.right, matches[0]!.bbox.bottom] : null;
}
export function current_member_scene(rows: NativeRows, offer: R, expected_part: number[] | null = null): R | null {
  const bodybox = current_body_box(rows, offer.body), peerbox = current_body_box(rows, offer.peer), expected = truth(expected_part) ? expected_part! : offer.subject.bbox;
  const components = supportParts(rows), parts = components.filter(c => same([c.bbox.left, c.bbox.top, c.bbox.right, c.bbox.bottom], expected) && c.value === offer.subject.palette_value && c.area === offer.subject.area), partbox = parts.length === 1 ? expected : null;
  if (bodybox === null || peerbox === null) return null;
  const stones: R[] = []; if (partbox !== null) stones.push({ ...offer.subject, bbox: partbox });
  for (const e of offer.guard_other_entities ?? []) if (components.some(c => c.value === e.palette_value && c.area === e.area && same([c.bbox.left, c.bbox.top, c.bbox.right, c.bbox.bottom], e.bbox))) stones.push(e);
  const body = { ...offer.body, bbox: bodybox }, peer = { ...offer.peer, bbox: peerbox }, tiles = offer.guard_tiles;
  const explained = new Set([...mask(body), ...mask(peer), ...(partbox !== null ? mask(stones[0]!) : [])].map(key));
  const admitted = Object.entries(tiles as R).filter(([, t]) => mask({ bbox: t.box }).every(([x, y]) => rows[y!]![x!] === offer.guard_support_value || explained.has(key([x!, y!])))).map(([k]) => k);
  return { body, peer, stones, tiles, admitted };
}
export function bound_relative_peer_row(measured: R, observation: R, rows: NativeRows, peer_signature: string): R | null {
  const peer = unique(observation)[peer_signature]; if (!peer) return null;
  const members = supportParts(rows).filter(c => same([c.bbox.left, c.bbox.top, c.bbox.right, c.bbox.bottom], peer.bbox) && c.value === peer.palette_value && c.area === peer.area);
  if (members.length !== 1) return null;
  const matches = (measured.relative_escape_transition_rows ?? []).filter((r: R) => r.peer_component_ref === members[0]!.component_id && r.frame_ref === observation.observation_ref);
  return matches.length === 1 ? matches[0] : null;
}
export { current_body_box as currentBodyBox, current_member_scene as currentMemberScene, bound_relative_peer_row as boundRelativePeerRow };
