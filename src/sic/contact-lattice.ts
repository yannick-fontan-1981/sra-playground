import type { NativePoint } from '../logos-engine/v6-native-types.ts';

type Box = readonly [number, number, number, number];
type Piece = { id: string; type: string; bbox: Box };
type Scene = { unit: number; field: Box; root: Box; tip: number; order: readonly string[]; pieces: readonly Piece[] };
type Effect = { action_ref: string; extent_delta: number; root_translation: NativePoint };
type Move = { command: string; dy: number; dx: number };
type Position = { row: number; tip: number; pieces: readonly NativePoint[] };
type Node = { state: Position; depth: number; first: { move: Move; result: Position } | null };

/** Test a conditional model in which displacement on the support is
 * reversible, and contact on a developing span can push a chain. */
export function planOrderedLattice(scene: Scene, effects: readonly Effect[], depthLimit: number, nodeLimit: number, shouldStop: () => boolean) {
  const { unit, root, field } = scene, stride = unit + 2;
  const startX = scene.tip - unit, startY = root[1] + (root[3] - root[1] + 1 - unit) / 2;
  const left = startX - Math.floor((startX - field[0]) / stride) * stride;
  const top = startY - Math.floor((startY - field[1]) / stride) * stride;
  const columns = Math.floor((field[2] - unit + 1 - left) / stride) + 1;
  const rows = Math.floor((field[3] - unit + 1 - top) / stride) + 1;
  const inside = (x: number, y: number) => x >= 0 && x < columns && y >= 0 && y < rows;
  const parts = scene.order.flatMap(type => scene.pieces.filter(piece => piece.type === type));
  if (!parts.length || parts.length !== scene.pieces.length || new Set(parts).size !== parts.length) return null;
  const start: Position = { row: (startY - top) / stride, tip: (startX - left) / stride,
    pieces: parts.map(({ bbox }) => [(bbox[0] - left) / stride, (bbox[1] - top) / stride]) };
  if (!Number.isInteger(start.row) || !Number.isInteger(start.tip) || !inside(Math.max(0, start.tip), start.row) || start.tip < -1
    || start.pieces.some(([x, y]) => !Number.isInteger(x) || !Number.isInteger(y) || !inside(x, y))) return null;
  const moves: Move[] = effects.flatMap(effect => {
    const dy = effect.root_translation[0] / stride, dx = effect.extent_delta / stride;
    return effect.root_translation[1] === 0 && Number.isInteger(dx) && Number.isInteger(dy) && Math.abs(dx) + Math.abs(dy) === 1
      ? [{ command: effect.action_ref, dy, dx }] : [];
  });

  function predict(state: Position, { dy, dx }: Move): Position | null {
    const row = state.row + dy, tip = state.tip + dx;
    if (row < 0 || row >= rows || tip < -1 || tip >= columns) return null;
    const moving = new Set<number>();
    for (const [index, [x, y]] of state.pieces.entries()) {
      if ((y === state.row || y === row) && x <= state.tip || dx === 1 && y === row && x === tip) moving.add(index);
    }
    // Iteration also visits pieces added through contiguous contact.
    for (const index of moving) {
      const [x, y] = state.pieces[index]!;
      if (!inside(x + dx, y + dy)) return dx ? { row, tip, pieces: state.pieces } : null;
      const blocking = state.pieces.findIndex(([u, v]) => u === x + dx && v === y + dy);
      if (blocking >= 0) moving.add(blocking);
    }
    return { row, tip, pieces: state.pieces.map(([x, y], index) => moving.has(index) ? [x + dx, y + dy] : [x, y]) };
  }

  function aligned({ row, tip, pieces }: Position) {
    const firstUnmatched = pieces.findIndex(([x, y], index) => y !== row || x > tip || index > 0 && x <= pieces[index - 1]![0]);
    return firstUnmatched === -1 ? pieces.length : firstUnmatched;
  }
  function priority(state: Position, depth: number) {
    const prefix = aligned(state), remaining = state.pieces.length - prefix;
    if (!remaining) return depth * 20;
    const wrongOnSupport = state.pieces.slice(prefix).filter(([x, y]) => y === state.row && x <= state.tip).length;
    const inversions = state.pieces.reduce((sum, [x, y], index) =>
      sum + state.pieces.slice(index + 1).filter(([u, v]) => v === y && u < x).length, 0);
    const [x, y] = state.pieces[prefix]!;
    return depth * 20 + (remaining * 12 + wrongOnSupport * 4 + inversions * 4
      + Math.abs(y - state.row) * 2 + Math.abs(x - state.tip)) * 13;
  }

  const visited = new Map<string, number>(), queue = new Map<number, Node[]>();
  const key = (state: Position) => JSON.stringify([state.row, state.tip, state.pieces]);
  const enqueue = (node: Node) => {
    const id = key(node.state);
    if ((visited.get(id) ?? Infinity) <= node.depth) return;
    visited.set(id, node.depth);
    const rank = priority(node.state, node.depth), bucket = queue.get(rank);
    if (bucket) bucket.push(node);
    else queue.set(rank, [node]);
  };
  enqueue({ state: start, depth: 0, first: null });
  for (let expanded = 0; queue.size && expanded < nodeLimit && !shouldStop(); ) {
    const rank = Math.min(...queue.keys()), bucket = queue.get(rank)!;
    const node = bucket.pop()!;
    if (!bucket.length) queue.delete(rank);
    if (visited.get(key(node.state)) !== node.depth) continue;
    expanded++;
    if (node.first && aligned(node.state) === parts.length) {
      const { move, result } = node.first;
      const pieces = parts.map(({ id }, index) => {
        const [x, y] = result.pieces[index]!, px = left + x * stride, py = top + y * stride;
        return [id, [px, py, px + unit - 1, py + unit - 1]] as const;
      }).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
      return { command: move.command, distance: node.depth, prediction: {
        root: root.map((value, index) => index % 2 ? value + (result.row - start.row) * stride : value),
        tip: left + result.tip * stride + unit, pieces,
      } };
    }
    if (node.depth >= depthLimit) continue;
    for (const move of moves) {
      const result = predict(node.state, move);
      if (result) enqueue({ state: result, depth: node.depth + 1, first: node.first ?? { move, result } });
    }
  }
  return null;
}
