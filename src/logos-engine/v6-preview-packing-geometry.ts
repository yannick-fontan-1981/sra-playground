/** Mechanical transfer of preview_packing/donor.py public measurements. No
 * palette, lattice, control meaning or terminal law is supplied by the host. */
import { geometricComponents, validateRows } from './v6-native-observer.ts';
import { PointSet, comparePoints, pointKey } from './v6-point-set.ts';
import type { NativeRows } from './v6-native-types.ts';
import type { PreviewPackingCell as Cell, PreviewPackingCommand, PreviewPackingMask, PreviewPackingPiece,
  PreviewPackingPose as Pose, PreviewPackingScene as Scene } from './v6-preview-packing-types.ts';

export function previewPackingNormalized(points: PreviewPackingMask): [Cell[], Cell] {
  if (!points.length) throw new RangeError('Preview normalization needs a nonempty support');
  const top = Math.min(...points.map(p => p[0])), left = Math.min(...points.map(p => p[1]));
  return [points.map(([y, x]) => [y - top, x - left] as Cell).sort(comparePoints), [top, left]];
}

/** Python Counter.most_common keeps the first insertion on equal counts. */
function majority(values: Iterable<number>): [number, number] {
  const counts = new Map<number, number>();
  for (const color of values) counts.set(color, (counts.get(color) ?? 0) + 1);
  let chosen: number | undefined, count = -1;
  for (const [color, amount] of counts) if (amount > count) { chosen = color; count = amount; }
  if (chosen === undefined) throw new RangeError('Preview sampling needs a nonempty cell');
  return [chosen, count];
}

/** set(dict) presizes before adding keys. Its pop order differs from adding
 * the same keys one by one, and that order determines source piece identities.
 * This uses the existing native CPython point table without changing it. */
export function previewPackingDictPointSet(keys: readonly Cell[]): PointSet {
  let capacity = 8;
  if (keys.length * 5 >= 7 * 3) while (capacity <= keys.length * 2) capacity *= 2;
  const result = PointSet.restore({ format: 'cpython-3.12-64-point-set', capacity, finger: 0, entries: [], dummies: [] });
  for (const p of keys) result.add(p);
  return result;
}

export function previewPackingMeasureScene(rows: NativeRows): Scene | null {
  validateRows(rows);
  const parts = geometricComponents(rows), background = majority(rows.flat())[0];
  const squares = parts.filter(p => p.rectangular && p.bbox[2] - p.bbox[0] === p.bbox[3] - p.bbox[1]
    && 2 <= p.bbox[2] - p.bbox[0] + 1 && p.bbox[2] - p.bbox[0] + 1 <= 12);
  const counts = new Map<string, { empty: number; width: number; count: number }>();
  for (const p of squares) {
    const width = p.bbox[2] - p.bbox[0] + 1, key = `${p.color},${width}`, previous = counts.get(key);
    if (previous) previous.count++; else counts.set(key, { empty: p.color, width, count: 1 });
  }
  for (const { empty, width, count } of [...counts.values()].sort((a, b) => b.count - a.count)) {
    if (count < 3) continue;
    const q = width + 1;
    for (const frame of parts) {
      const [l, t, r, b] = frame.bbox, w = r - l - 1, h = b - t - 1;
      if (w <= q || h <= q || w % q || h % q) continue;
      const support = new Set(frame.mask.map(([x, y]) => `${x + l},${y + t}`));
      let ring = true;
      for (let x = l; x <= r; x++) if (!support.has(`${x},${t}`) || !support.has(`${x},${b}`)) { ring = false; break; }
      if (ring) for (let y = t; y <= b; y++) if (!support.has(`${l},${y}`) || !support.has(`${r},${y}`)) { ring = false; break; }
      if (!ring) continue;
      const holes = squares.filter(p => p.color === empty && p.bbox[2] - p.bbox[0] + 1 === width
        && l < p.bbox[0] && p.bbox[0] < r && t < p.bbox[1] && p.bbox[1] < b);
      if (holes.length < 3) continue;
      const offset: Cell = [t + 1, l + 1], board: Cell[] = [];
      for (let y = 0; y < h / q; y++) for (let x = 0; x < w / q; x++) board.push([y, x]);
      const boardKeys = new Set(board.map(pointKey));
      const values = new Map<string, { cell: Cell; color: number }>(), world: Cell[] = [];
      for (let y = 0; y < Math.floor((rows.length - offset[0]) / q); y++) {
        for (let x = 0; x < Math.floor((rows[0]!.length - offset[1]) / q); x++) {
          const samples: number[] = [];
          for (let dy = 0; dy < q; dy++) for (let dx = 0; dx < q; dx++) samples.push(rows[offset[0] + y * q + dy]![offset[1] + x * q + dx]!);
          const [color, n] = majority(samples), cell: Cell = [y, x]; world.push(cell);
          if (n >= q * q - 1 && color !== background && color !== empty && color !== frame.color) values.set(pointKey(cell), { cell, color });
        }
      }
      const groups: { color: number; cells: Cell[] }[] = [];
      const remaining = previewPackingDictPointSet([...values.values()].map(v => v.cell));
      while (remaining.size) {
        const start = remaining.pop(), todo: Cell[] = [start], cells: Cell[] = [start], color = values.get(pointKey(start))!.color;
        for (let index = 0; index < todo.length; index++) {
          const [y, x] = todo[index]!;
          for (const p of [[y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1]] as Cell[]) {
            if (remaining.has(p) && values.get(pointKey(p))!.color === color) { remaining.delete(p); todo.push(p); cells.push(p); }
          }
        }
        if (cells.length >= 2) groups.push({ color, cells });
      }
      const inside = groups.filter(g => g.cells.every(p => boardKeys.has(pointKey(p))));
      const occupied = new Set(inside.flatMap(g => g.cells.map(pointKey)));
      const residualSize = board.length - occupied.size;
      const outside = groups.filter(g => g.cells.every(p => !boardKeys.has(pointKey(p)))
        && Math.min(...g.cells.map(p => p[0])) < h / q && g.cells.length <= residualSize);
      if (!outside.length || outside.reduce((sum, g) => sum + g.cells.length, 0) !== residualSize) continue;
      const pieces = [...inside, ...outside].map(({ color, cells }, i): PreviewPackingPiece => {
        const [mask, anchor] = previewPackingNormalized(cells);
        return { id: `piece:${i}`, color, mask, anchor, movable: !cells.every(p => boardKeys.has(pointKey(p))) };
      });
      return { q, offset, board, pieces, background, empty, frame_color: frame.color, frame: [...frame.bbox],
        world, selected: null, preview_color: null, evidence: [] };
    }
  }
  return null;
}

export function previewPackingPointFor(model: Scene, piece: PreviewPackingPiece): { x: number; y: number } {
  const [y, x] = piece.mask[0]!, [a, b] = piece.anchor, q = model.q;
  return { x: model.offset[1] + (b + x) * q + Math.floor(q / 2), y: model.offset[0] + (a + y) * q + Math.floor(q / 2) };
}
export function previewPackingInputCandidates(rows: NativeRows, available: readonly string[]): PreviewPackingCommand[] {
  if (!available.includes('ACTION6')) return [];
  const m = previewPackingMeasureScene(rows);
  return m ? m.pieces.filter(p => p.movable).map(p => ({ action_ref: 'ACTION6', data: previewPackingPointFor(m, p) })) : [];
}
export function previewPackingSample(rows: NativeRows, model: Scene, cell: Cell): [number, number] {
  const [y, x] = cell, q = model.q, [a, b] = model.offset, values: number[] = [];
  for (let dy = 0; dy < q; dy++) for (let dx = 0; dx < q; dx++) {
    // .at retains Python's negative-index behavior for source diagnostics.
    const value = rows.at(a + y * q + dy)?.at(b + x * q + dx);
    if (value === undefined) throw new RangeError('Preview sample leaves the supplied public raster');
    values.push(value);
  }
  return majority(values);
}
export function previewPackingPose(rows: NativeRows, model: Scene): Pose | null {
  if (model.preview_color === null) return null;
  const excluded = new Set([model.background, model.empty, ...model.pieces.map(p => p.color)]), points: Cell[] = [];
  for (const cell of model.world) {
    const [color, n] = previewPackingSample(rows, model, cell);
    if (n >= model.q ** 2 - 1 && (color === model.preview_color || !excluded.has(color))) points.push(cell);
  }
  const held = model.pieces.find(p => p.id === model.selected);
  if (!held || points.length !== held.mask.length) return null;
  const [mask, anchor] = previewPackingNormalized(points); return { mask, anchor };
}
