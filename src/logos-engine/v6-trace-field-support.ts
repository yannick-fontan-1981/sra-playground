/**
 * Explicit native visual hypothesis for a marker nested in a cell-material ring.
 * A covering path is deliberately absent from this decision. Source observation
 * remains the default; this witness may only resolve concentric alternatives.
 */
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
export interface NativeTraceFieldOptions { distinguishCellSupport?: boolean }
export interface TraceCellSupportSelection { pair: readonly [R, R]; witness: R }

function cellBox(geometry: R, cell: readonly number[]): number[] {
  const left = geometry.bbox[0] + geometry.pitch * cell[0]! + 1;
  const top = geometry.bbox[1] + geometry.pitch * cell[1]! + 1;
  return [left, top, left + geometry.size - 1, top + geometry.size - 1];
}

function centeredInside(inner: R, outer: R): boolean {
  return equal(inner.cell, outer.cell) && inner.width < outer.width
    && inner.bbox[0] > outer.bbox[0] && inner.bbox[1] > outer.bbox[1]
    && inner.bbox[2] < outer.bbox[2] && inner.bbox[3] < outer.bbox[3]
    && inner.bbox[0] + inner.bbox[2] === outer.bbox[0] + outer.bbox[2]
    && inner.bbox[1] + inner.bbox[3] === outer.bbox[1] + outer.bbox[3];
}

/**
 * Measurements, not semantic role labels: a complete cell-sized ring of the
 * current repeated cell material surrounds one distinct inset ring. Three
 * currently full homologues on independent rows and columns attest its extent
 * and material. Every discarded pair must share the selected two cell centers.
 * This does not acquire a terminal role, controller law or physical permission.
 */
export function distinguishTraceCellSupport(rows: NativeRows, geometry: R, marks: readonly R[],
  parts: readonly R[]): TraceCellSupportSelection | null {
  const g = geometry, heads = marks.filter(mark => mark.center_value !== g.floor_value);
  const receivers = marks.filter(mark => mark.center_value === g.floor_value);
  const pairs = heads.flatMap(head => receivers.filter(receiver => head.width === receiver.width)
    .map(receiver => [head, receiver] as const));
  if (pairs.length < 2 || !Number.isSafeInteger(g.size) || !Number.isSafeInteger(g.pitch)
    || g.size < 3 || g.pitch !== g.size + 1 || g.pitch % 2 !== 0) return null;
  const fullCells: R[] = [];
  for (let y = 0; y < g.shape[1]; y++) for (let x = 0; x < g.shape[0]; x++) {
    const cell = [x, y], box = cellBox(g, cell);
    const match = parts.filter(part => part.area === g.size * g.size && part.color === g.floor_value && equal(part.bbox, box));
    if (match.length === 1) fullCells.push({ cell, bbox: box, palette: g.floor_value, area: match[0]!.area });
  }
  if (fullCells.length < 3 || new Set(fullCells.map(part => part.cell[0])).size < 2
    || new Set(fullCells.map(part => part.cell[1])).size < 2) return null;
  const structural = new Map<R, R>();
  for (const mark of marks) {
    if (mark.palette !== g.floor_value || mark.width !== g.size || !equal(mark.bbox, cellBox(g, mark.cell))) continue;
    const inset = marks.filter(candidate => candidate.palette !== g.floor_value && centeredInside(candidate, mark));
    if (inset.length === 1) structural.set(mark, inset[0]!);
  }
  const retained = pairs.filter(pair => !structural.has(pair[0]) && !structural.has(pair[1]));
  if (retained.length !== 1) return null;
  const selected = retained[0]!, alternatives = pairs.filter(pair => pair !== selected);
  // Differences in endpoint positions or competing inset marks are unresolved.
  if (!alternatives.length || alternatives.some(pair => structural.get(pair[0]) !== selected[0]
    || structural.get(pair[1]) !== selected[1])) return null;
  const eliminated = [...new Set(alternatives.flatMap(pair => [...pair]))];
  const witness = {
    schema: 'logos-engine.native.trace-cell-support.v1',
    rule: 'full_cell_material_ring_around_unique_inset_mark',
    status: 'current_visual_support_hypothesis',
    frame_digest: identity(rows), geometry_ref: identity(g),
    current_full_cell_homologues: fullCells,
    original_pair_count: pairs.length, retained_pair_count: 1,
    excluded_cell_material_rings: eliminated.map(mark => ({ mark, inset: structural.get(mark)! })),
    selected_marks: selected,
    selection_basis: 'same current cell material, complete cell extent and unique concentric inset',
    path_search_used: false, primitive_release_authorized: false, terminal_role_acquired: false,
    scope: 'The outer ring is interpreted as current cell support because it has the extent and material of measured full cell homologues. The inset is a distinct marker hypothesis; its control effect and terminal role still require actual public responses.',
  };
  return structuredClone({ pair: selected, witness });
}
