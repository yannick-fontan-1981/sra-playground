/**
 * Mechanical transfer of panel_service_projection.py, source
 * 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. Public rasters are the only input.
 * The repeated panel grammar is a structural prior; colors have no fixed role.
 */
import { geometricComponents } from './v6-native-observer.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import { NestedIntegerTupleSet } from './v6-panel-service-pattern-set.ts';
import type { NativeRows } from './v6-native-types.ts';
import type { IntegerTuple } from './v6-panel-service-pattern-set.ts';

type R = Record<string, any>;
type Box = readonly [number, number, number, number];
type Pattern = readonly (readonly [number, number])[];

function counts(values: Iterable<number>): Map<number, number> {
  const result = new Map<number, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}
function majority(values: Iterable<number>): number {
  // Counter.most_common resolves equal counts by first encounter.
  return [...counts(values)].sort((a, b) => b[1] - a[1])[0]![0];
}
function border(rows: NativeRows, box: Box, color: number): boolean {
  const [left, top, right, bottom] = box;
  for (let x = left; x <= right; x++) if (rows[top]![x] !== color || rows[bottom]![x] !== color) return false;
  for (let y = top; y <= bottom; y++) if (rows[y]![left] !== color || rows[y]![right] !== color) return false;
  return true;
}
function inside(a: Box, b: Box): boolean { return b[0] < a[0] && a[0] <= a[2] && a[2] < b[2] && b[1] < a[1] && a[1] <= a[3] && a[3] < b[3]; }
function pattern(rows: NativeRows, x: number, y: number, unit: number, background: number): [number, number][] {
  const result: [number, number][] = [];
  for (let dy = 0; dy < unit; dy++) for (let dx = 0; dx < unit; dx++) if (rows[y + dy]![x + dx] !== background) result.push([dx, dy]);
  return result;
}

export function measurePanelService(rows: NativeRows, symbols: readonly Pattern[] = []): R | null {
  const parts = geometricComponents(rows);
  const frames = parts.filter(part => 15 <= part.bbox[2] - part.bbox[0] && part.bbox[2] - part.bbox[0] <= 35
    && 10 <= part.bbox[3] - part.bbox[1] && part.bbox[3] - part.bbox[1] <= 25 && border(rows, part.bbox, part.color));
  const byExtent = new Map<string, typeof frames>();
  for (const frame of frames) {
    const box = frame.bbox, key = JSON.stringify([box[0], box[2], box[3] - box[1]]);
    if (!byExtent.has(key)) byExtent.set(key, []);
    byExtent.get(key)!.push(frame);
  }
  const groups = [...byExtent.values()].filter(group => group.length >= 2).map(group => group.sort((a, b) => a.bbox[1] - b.bbox[1]));
  if (groups.length !== 1) return null;
  const selectedFrames = groups[0]!, panels: R[] = [];
  for (const frame of selectedFrames) {
    const box = frame.bbox, [left, top, right, bottom] = box, interior: number[] = [];
    for (let y = top + 1; y < bottom; y++) for (let x = left + 1; x < right; x++) interior.push(rows[y]![x]!);
    const background = majority(interior);
    const squares = parts.filter(part => inside(part.bbox, box) && part.area === 9 && part.bbox[2] - part.bbox[0] === 2
      && part.bbox[3] - part.bbox[1] === 2 && part.color !== background);
    if (!squares.length) return null;
    const unit = squares[0]!.bbox[2] - squares[0]!.bbox[0] + 1;
    const small = parts.filter(part => inside(part.bbox, box) && part.color !== background
      && part.bbox[2] - part.bbox[0] === unit - 1 && part.bbox[3] - part.bbox[1] <= unit - 1);
    const xs = [...new Set(small.map(part => part.bbox[0]))].sort((a, b) => a - b);
    const ys = [...new Set(small.filter(part => part.bbox[3] - part.bbox[1] === unit - 1).map(part => part.bbox[1]))].sort((a, b) => a - b);
    if (xs.length < 3 || !ys.length) return null;
    const step = Math.min(...xs.slice(1).map((value, i) => value - xs[i]!));
    const ystep = ys.length > 1 ? Math.min(...ys.slice(1).map((value, i) => value - ys[i]!)) : step;
    const allXs: number[] = [];
    for (let x = xs[0]!; x <= right - unit; x += step) allXs.push(x);
    if (allXs.length !== 5 || ystep % step !== 0) return null;
    const allYs: number[] = [];
    for (let y = top + 2; y <= bottom - unit; y += step) allYs.push(y);
    if (allYs.length !== 3) return null;
    const cells: R[] = [];
    for (const [ri, y] of allYs.entries()) for (const [ci, x] of allXs.entries()) {
      const shape = pattern(rows, x, y, unit, background);
      if (!shape.length) continue;
      const color = majority(shape.map(([dx, dy]) => rows[y + dy]![x + dx]!));
      const cellBox: Box = [x - 1, y - 1, x + unit, y + unit], corner = rows[y - 1]![x - 1]!;
      const outline = corner !== background && border(rows, cellBox, corner) ? corner : null;
      cells.push({ row: ri, col: ci, point: [x + Math.floor(unit / 2), y + Math.floor(unit / 2)],
        bbox: [x, y, x + unit - 1, y + unit - 1], pattern: shape, color, solid: shape.length === unit * unit, outline });
    }
    const materials = cells.filter(cell => cell.col === 0 && cell.solid), selected = materials.filter(cell => cell.outline !== null);
    if (selected.length !== 1) return null;
    const selection = selected[0]!.outline;
    const marks = parts.filter(part => part.area === 4 && part.bbox[2] - part.bbox[0] === 1 && part.bbox[0] < left
      && left - part.bbox[2] <= 5 && top <= part.bbox[1] && part.bbox[1] <= bottom);
    if (marks.length !== 1) return null;
    const roomCandidates = parts.filter(part => part.color === marks[0]!.color && part.bbox[2] < left && part.bbox[3] - part.bbox[1] >= 8);
    if (!roomCandidates.length || new Set(roomCandidates.map(part => JSON.stringify([part.bbox[1], part.bbox[3]]))).size !== 1) return null;
    const room: Box = [Math.min(...roomCandidates.map(part => part.bbox[0])), roomCandidates[0]!.bbox[1],
      Math.max(...roomCandidates.map(part => part.bbox[2])), roomCandidates[0]!.bbox[3]];
    const [rx, ry, rr, rb] = room, material = selected[0]!.color;
    const external = parts.filter(part => rx <= part.bbox[0] && part.bbox[0] <= part.bbox[2] && part.bbox[2] <= rr
      && ry <= part.bbox[1] && part.bbox[1] <= part.bbox[3] && part.bbox[3] <= rb && part.area === unit * unit
      && part.bbox[2] - part.bbox[0] === unit - 1 && part.bbox[3] - part.bbox[1] === unit - 1);
    const operators: R[] = [], services: R[] = [], controls = cells.filter(cell => cell.col === 1 && !cell.solid);
    const controlShapes = new NestedIntegerTupleSet<IntegerTuple>(controls.map(cell => cell.pattern as Pattern));
    const signatures = controlShapes.union(new NestedIntegerTupleSet<IntegerTuple>(symbols));
    for (const signature of signatures) {
      const control = controls.find(cell => equal(cell.pattern, signature)) ?? null, matches: [number, number][] = [];
      for (let y = ry; y <= rb - unit + 1; y++) for (let x = rx + 1; x <= rr - unit; x++) {
        const tile: number[] = [];
        for (let dy = 0; dy < unit; dy++) for (let dx = 0; dx < unit; dx++) tile.push(rows[y + dy]![x + dx]!);
        const frequency = counts(tile);
        if (frequency.size !== 2) continue;
        for (const localBackground of frequency.keys()) if (equal(pattern(rows, x, y, unit, localBackground), signature)) matches.push([x, y]);
      }
      const relations: R[] = [];
      for (const [x, y] of matches) {
        const before = external.filter(part => part.bbox[1] === y && 0 < x - part.bbox[2] && x - part.bbox[2] <= unit);
        const after = external.filter(part => part.bbox[1] === y && 0 < part.bbox[0] - (x + unit - 1) && part.bbox[0] - (x + unit - 1) <= unit);
        const below = external.filter(part => part.bbox[0] === x && 0 < part.bbox[1] - (y + unit - 1) && part.bbox[1] - (y + unit - 1) <= unit);
        const relation: R = { control, symbol: signature, observed_site: [x, y], selected: control !== null && control.outline === selection };
        if (before.length === 1 && after.length === 1) Object.assign(relation, { kind: 'displayed_rewrite', input: before[0]!.color, output: after[0]!.color });
        else if (below.length === 1) Object.assign(relation, { kind: 'displayed_receiver', input: below[0]!.color });
        else continue;
        relations.push(relation);
      }
      if (relations.length !== 1) continue;
      services.push(relations[0]!);
      if (control !== null) operators.push(relations[0]!);
    }
    panels.push({ id: identity([box, frame.color]), bbox: box, color: frame.color, room, room_marker: marks[0]!.color,
      material, selection_color: selection, cells, operators, services, activity_controls: controls });
  }
  if (panels.length !== selectedFrames.length) return null;
  return structuredClone({ panels, layout: panels.map(panel => [panel.bbox, panel.color]) });
}

/** All panel projections participate, including unchanged panels and fields. */
export function panelServiceProjection(scene: R): R[] {
  return scene.panels.map((panel: R) => ({ id: panel.id, material: panel.material, room_marker: panel.room_marker,
    activity: panel.activity_controls.filter((cell: R) => cell.outline === panel.selection_color).map((cell: R) => cell.row),
    parameters: panel.cells.filter((cell: R) => cell.col >= 2 && cell.outline !== null).map((cell: R) => [cell.row, cell.col]) }));
}

/** Own source layer: append measured points to inherited candidates, then deduplicate. */
export function panelServiceInputCandidates(rows: NativeRows, available: readonly string[], inherited: readonly R[] = []): R[] {
  const values = [...inherited], scene = measurePanelService(rows);
  if (scene && available.includes('ACTION6')) for (const panel of scene.panels) for (const cell of panel.cells) {
    values.push({ action_ref: 'ACTION6', data: { x: cell.point[0], y: cell.point[1] } });
  }
  return [...new Map(values.map(value => [identity(value), value])).values()];
}
