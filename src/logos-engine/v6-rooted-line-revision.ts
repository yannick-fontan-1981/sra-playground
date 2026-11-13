import { pythonEqual as equal } from './v6-operations.ts';

type R = Record<string, any>;
type Cell = readonly [number, number];
type Board = { y: number; tip: number; pieces: readonly Cell[] };

/** Recognize a full-cell push chain that was shortened by the old pixel projection. */
export function witnessedCellPush(before: R, after: R, expected: R, effect: R): boolean {
  if (!effect || !expected || before.layout !== after.layout) return false;
  const [dy, dx] = effect.root_translation;
  const stride = before.unit + 2;
  if (Math.abs(dy) !== stride || dx || effect.extent_delta || before.tip !== after.tip
      || !equal(before.root.map((v: number, i: number) => i % 2 ? v + dy : v), after.root)
      || !equal(expected.root, after.root) || expected.tip !== after.tip) return false;
  const old = new Map(before.pieces.map((piece: R) => [piece.id, piece.bbox]));
  const predictions = new Map(expected.pieces);
  let carried = 0, different = false;
  const observed = after.pieces.every((piece: R) => {
    const box = old.get(piece.id) as number[] | undefined, forecast = predictions.get(piece.id);
    if (!box || !forecast) return false;
    if (equal(box, piece.bbox)) return equal(forecast, box);
    if (!equal(piece.bbox, [box[0], box[1]! + dy, box[2], box[3]! + dy])) return false;
    carried++;
    different ||= !equal(piece.bbox, forecast);
    return true;
  });
  if (!observed || !different || carried < 2) return false;
  const moving: number[][] = after.pieces.filter((piece: R) => !equal(old.get(piece.id), piece.bbox))
    .map((piece: R) => old.get(piece.id) as number[]).sort((a: number[], b: number[]) => a[1]! - b[1]!);
  const rodRow = before.root[1] + (before.root[3] - before.root[1] + 1 - before.unit) / 2;
  return moving.every((box, i) =>
    box[0] === moving[0]![0] && (!i || box[1]! - moving[i - 1]![1]! === stride))
    && moving.some(box => box[1] === rodRow || box[1] === rodRow + dy);
}

/** Search a conditional lattice model after evidence for whole-cell contact.
 * The caller admits one step at a time and verifies the full public projection. */
export function planCellPush(scene: R, effects: R, limit: number, maxNodes: number, timedOut: () => boolean,
  options: { allowFirst?: (command: string) => boolean; visit?: () => void } = {}) {
  const stride = scene.unit + 2, [left, top, right, bottom] = scene.field;
  const pieces: R[] = scene.pieces;
  const first = scene.tip - scene.unit;
  const row = scene.root[1] + (scene.root[3] - scene.root[1] + 1 - scene.unit) / 2;
  if (!pieces.every(p => (p.bbox[0] - first) % stride === 0 && (p.bbox[1] - row) % stride === 0)) return null;
  const minX = first - Math.floor((first - left) / stride) * stride;
  const maxX = right - scene.unit + 1;
  const minY = row - Math.floor((row - top) / stride) * stride;
  const maxY = bottom - scene.unit + 1;
  const start: Board = { y: row, tip: first, pieces: pieces.map(p => [p.bbox[0], p.bbox[1]]) };
  const wanted = scene.order.map((type: string) => pieces.findIndex(p => p.type === type));
  if (!pieces.length || wanted.some((index: number) => index < 0)
      || !Number.isInteger(row) || limit < 1 || maxNodes < 2
      || start.pieces.some(([x, y]) => x < minX || x > maxX || y < minY || y > maxY)) return null;
  const moves = Object.values(effects).flatMap(effect => {
    const [dy, dx] = effect.root_translation, extent = effect.extent_delta;
    return dx === 0 && ((Math.abs(dy) === stride && extent === 0) || (dy === 0 && Math.abs(extent) === stride))
      ? [{ command: effect.action_ref as string, dy, extent }] : [];
  });
  const onRod = (state: Board, [x, y]: Cell) => y === state.y && x >= minX && x <= state.tip;
  function predict(state: Board, dy: number, extent: number): Board | null {
    const y = state.y + dy, tip = state.tip + extent;
    if (y < minY || y > maxY || tip < minX - stride || tip > maxX) return null;
    const next = { y, tip, pieces: state.pieces.slice() };
    const visiting = new Set<number>();
    const moved = new Set<number>();
    const move = (index: number): boolean => {
      if (moved.has(index)) return true;
      if (visiting.has(index)) return false;
      const [x, y0] = state.pieces[index]!;
      const x1 = x + extent, y1 = y0 + dy;
      if (x1 < minX || x1 > maxX || y1 < minY || y1 > maxY) return false;
      visiting.add(index);
      const blocking = state.pieces.findIndex(([xx, yy]) => xx === x1 && yy === y1);
      const allowed = blocking === -1 || move(blocking);
      visiting.delete(index);
      if (!allowed) return false;
      next.pieces[index] = [x1, y1];
      moved.add(index);
      return true;
    };
    for (const [index, cell] of state.pieces.entries()) {
      const [x, yy] = cell;
      const touches = dy ? onRod(state, cell) || onRod(next, cell)
        : yy === y && x <= Math.max(state.tip, tip) && (extent > 0 || x >= minX);
      if (touches && !move(index) && dy) return null;
    }
    return next;
  }
  const key = (state: Board) => JSON.stringify(state);
  const queue: { state: Board; depth: number; first?: { command: string; state: Board } }[] = [{ state: start, depth: 0 }];
  const seen = new Set([key(start)]);
  for (let i = 0; i < queue.length && i < maxNodes; i++) {
    if (timedOut()) return null;
    options.visit?.();
    const entry = queue[i]!;
    const inOrder = entry.state.pieces.map((cell, index) => ({ cell, index })).filter(({ cell }) => onRod(entry.state, cell))
      .sort((a, b) => a.cell[0] - b.cell[0]).map(({ index }) => index);
    if (entry.first && equal(inOrder, wanted)) {
      const result = entry.first.state;
      const root = scene.root.map((value: number, i: number) => value + (i % 2 ? result.y - row : 0));
      const prediction = { root, tip: result.tip + scene.unit,
        pieces: pieces.map((piece, index) => {
          const [x, y0] = result.pieces[index]!;
          return [piece.id, [x, y0, x + scene.unit - 1, y0 + scene.unit - 1]];
        }).sort(([a], [b]) => String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0) };
      return { command: entry.first.command, prediction, predictedGoalDistance: entry.depth };
    }
    if (entry.depth >= limit) continue;
    for (const { command, dy, extent } of moves) {
      if (queue.length >= maxNodes) break;
      if (!entry.first && options.allowFirst && !options.allowFirst(command)) continue;
      const state = predict(entry.state, dy, extent);
      if (!state || seen.has(key(state))) continue;
      seen.add(key(state));
      queue.push({ state, depth: entry.depth + 1, first: entry.first ?? { command, state } });
    }
  }
  return null;
}
