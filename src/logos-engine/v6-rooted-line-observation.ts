/**
 * Mechanical transfer of rooted_line_projection.py from pinned V6 source
 * 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. Only the current public raster is
 * measured. Repeated silhouettes provide a structural reference, not a route
 * or fixed meaning for a palette value, command or physical support.
 */
import { compareUnicode } from './canonical.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { geometricComponents } from './v6-native-observer.ts';
import { revalidate_frame } from './v6-inventory-measurements.ts';
import { normalizePiercingConfiguration } from './v5-piercing-plan.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Box = readonly number[];
type Position = [number, number];
type Part = ReturnType<typeof geometricComponents>[number];
const positionOrder = (a: readonly number[], b: readonly number[]): number => a[0]! - b[0]! || a[1]! - b[1]!;

/** V5 positions use [row,column], while measured public boxes use [left,top,right,bottom]. */
export function rootedLineMask(box: Box): Position[] {
  const [left, top, right, bottom] = box, result: Position[] = [];
  for (let y = top!; y <= bottom!; y++) for (let x = left!; x <= right!; x++) result.push([y, x]);
  return result;
}

function majority(row: readonly number[]): [number, number] {
  const counts = new Map<number, number>();
  for (const value of row) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: [number, number] | undefined;
  // Counter.most_common preserves first encounter when frequencies are equal.
  for (const entry of counts) if (!best || entry[1] > best[1]) best = entry;
  return best!;
}

export function measureRootedLine(rows: NativeRows): R | null {
  const parts = geometricComponents(rows), height = rows.length, width = rows[0]!.length;
  const bands = rows.map(majority), dividers: number[] = [];
  for (let y = Math.floor(height / 2) + 1; y < height - 3; y++) {
    if (bands[y]![1] >= width * 0.75 && bands[y - 1]![0] !== bands[y]![0] && bands[y]![0] !== bands[y + 1]![0]) dividers.push(y);
  }
  if (dividers.length !== 1) return null;
  const split = dividers[0]!, groups = new Map<string, Part[]>();
  for (const part of parts) {
    const [left, top, right, bottom] = part.bbox, unit = right - left + 1;
    if (4 <= unit && unit <= 12 && bottom - top + 1 === unit && part.area < unit * unit && part.area >= unit) {
      const key = JSON.stringify([part.color, [...part.normalized].sort(positionOrder)]);
      const group = groups.get(key) ?? []; group.push(part); groups.set(key, group);
    }
  }
  let pairs = [...groups.values()].filter(group => group.length === 2
    && Math.min(...group.map(part => part.bbox[1])) < split && split < Math.max(...group.map(part => part.bbox[1])));
  if (pairs.length) {
    const largest = Math.max(...pairs.map(group => group[0]!.bbox[2] - group[0]!.bbox[0]));
    pairs = pairs.filter(group => group[0]!.bbox[2] - group[0]!.bbox[0] === largest);
  }
  if (pairs.length !== 1) return null;
  const [root, reference] = [...pairs[0]!].sort((a, b) => a.bbox[1] - b.bbox[1]);
  const rootBox = root!.bbox, referenceBox = reference!.bbox, referenceUnit = referenceBox[2] - referenceBox[0] - 1;
  const refs = parts.filter(part => part.bbox[0] > referenceBox[2]
    && referenceBox[1] <= part.bbox[1] && part.bbox[1] <= part.bbox[3] && part.bbox[3] <= referenceBox[3]
    && part.bbox[2] - part.bbox[0] + 1 === referenceUnit && part.bbox[3] - part.bbox[1] + 1 === referenceUnit
    && revalidate_frame({ bbox: part.bbox, palette_value: part.color, corner_value: part.color }, rows) !== null)
    .sort((a, b) => a.bbox[0] - b.bbox[0]);
  if (!refs.length || new Set(refs.map(part => part.color)).size !== refs.length
    || new Set(refs.map(part => part.bbox[2] - part.bbox[0])).size !== 1) return null;
  const colors = new Set(refs.map(part => part.color)), unit = refs[0]!.bbox[2] - refs[0]!.bbox[0] + 1;
  const pieces = parts.filter(part => part.bbox[3] < split && colors.has(part.color) && part.rectangular
    && part.bbox[2] - part.bbox[0] + 1 === unit && part.bbox[3] - part.bbox[1] + 1 === unit);
  if (pieces.length !== colors.size || [...colors].some(color => pieces.filter(part => part.color === color).length !== 1)) return null;
  const fields = parts.filter(part => part.bbox[3] < split && part.bbox[0] > rootBox[0]
    && part.bbox[2] - part.bbox[0] >= unit * 3 && part.bbox[3] - part.bbox[1] >= unit * 3 && part.area > unit * unit * 3);
  if (!fields.length) return null;
  // Source max keeps the first part at equal area.
  let fieldPart = fields[0]!;
  for (const part of fields) if (part.area > fieldPart.area) fieldPart = part;
  const background = fieldPart.color, fragments = parts.filter(part => part.color === background && part.bbox[3] < split && part.bbox[0] > rootBox[0]);
  const field = [Math.min(...fragments.map(part => part.bbox[0])), Math.min(...fragments.map(part => part.bbox[1])),
    Math.max(...fragments.map(part => part.bbox[2])), Math.max(...fragments.map(part => part.bbox[3]))];
  const middle = Math.floor((rootBox[1] + rootBox[3]) / 2);
  if (rootBox[3] - rootBox[1] + 1 !== unit + 2) return null;
  const lineRows = [middle, middle + 1], start = rootBox[2];
  let tip = start - 1;
  for (let x = start; x <= field[2]!; x++) {
    if (lineRows.every(y => rows[y]![x] === background)) break;
    tip = x;
  }
  if (tip < start) return null;
  const normalized = [...root!.normalized].sort(positionOrder);
  return structuredClone({ root: rootBox, reference_root: referenceBox, root_signature: identity([root!.color, normalized]),
    field, background, line_rows: lineRows, start, tip,
    pieces: [...pieces].sort((a, b) => a.color - b.color).map(part => ({ id: 'material:' + String(part.color), type: String(part.color), bbox: part.bbox })),
    order: refs.map(part => String(part.color)), unit,
    layout: identity([field, referenceBox, refs.map(part => [part.color, part.bbox]), normalized]) });
}

export function physicalRootedLine(scene: R): R {
  return structuredClone({ root: scene.root, tip: scene.tip,
    pieces: [...scene.pieces].sort((a: R, b: R) => compareUnicode(a.id, b.id)).map((piece: R) => [piece.id, piece.bbox]) });
}

export function rootedLineConfiguration(scene: R, reference: string, epoch: number): R {
  const root = 'current_root', rod = 'current_rod', y = scene.line_rows[0], spine: Position[] = [], foot: Position[] = [];
  for (let x = scene.start; x <= scene.tip; x++) spine.push([y, x]);
  for (const yy of scene.line_rows) for (let x = scene.start; x <= scene.tip; x++) foot.push([yy, x]);
  const domain = rootedLineMask([scene.root[0], scene.field[1], scene.field[2], scene.field[3]]);
  const pieces = scene.pieces.map((piece: R) => ({ piece_ref: piece.id, type_ref: piece.type, occupied_positions: rootedLineMask(piece.bbox), support_refs: [] }));
  const footprint = new Set(foot.map(point => point.join(',')));
  const possible = pieces.filter((piece: R) => piece.occupied_positions.some((point: number[]) => footprint.has(point.join(','))))
    .map((piece: R) => [rod, piece.piece_ref]);
  return normalizePiercingConfiguration({ configuration_ref: 'observed:' + reference,
    rods: [{ rod_ref: rod, root_ref: root, root_to_tip_positions: spine, rod_footprint_positions: foot }], pieces,
    domain_positions: domain, domain_boundary_is_known: false, root_footprints: [[root, rootedLineMask(scene.root)]],
    root_admissible_positions: [[root, rootedLineMask([scene.root[0], scene.field[1], scene.root[2], scene.field[3]])]],
    movable_piece_refs: pieces.map((piece: R) => piece.piece_ref), possible_support_pairs: possible,
    frame_ref: reference, scope: { level_epoch: epoch }, provenance: [reference] });
}

export function projectedRootedLine(configuration: R): R {
  const roots = new Map<string, number[][]>(configuration.root_footprints), root = roots.get('current_root');
  const rod = configuration.rods.find((value: R) => value.rod_ref === 'current_rod');
  if (!root || !rod) throw new TypeError('Rooted projection requires its current root and rod');
  const box = (points: number[][]): number[] => [Math.min(...points.map(p => p[1]!)), Math.min(...points.map(p => p[0]!)),
    Math.max(...points.map(p => p[1]!)), Math.max(...points.map(p => p[0]!))];
  return { root: box(root), tip: Math.max(...rod.root_to_tip_positions.map((point: number[]) => point[1]!)),
    pieces: [...configuration.pieces].sort((a: R, b: R) => compareUnicode(a.piece_ref, b.piece_ref))
      .map((piece: R) => [piece.piece_ref, box(piece.occupied_positions)]) };
}
