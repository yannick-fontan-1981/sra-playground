import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Box = readonly [number, number, number, number];
type Piece = { id: string; type: string; bbox: Box };
type Scene = { unit: number; field: Box; root: Box; tip: number; order: readonly string[]; pieces: readonly Piece[] };
type Effect = { action_ref: string; extent_delta: number; root_translation: NativePoint };
type Move = { command: string; dy: number; dx: number };
type Position = { row: number; tip: number; pieces: readonly NativePoint[] };
type Node = { state: Position; depth: number; from?: { node: Node; move: Move } };
type GuideOrder = { box: Box; order: readonly string[] };

export function measureFixedGuides(rows: NativeRows, scene: Scene & { background: number }): Box[] {
  const { unit, root, field, tip, background } = scene;
  if (unit < 4) return [];
  const stride = unit + 2, offset = Math.floor((unit - 2) / 2);
  const x = tip - unit, y = root[1] + (root[3] - root[1] + 1 - unit) / 2;
  const left = x - Math.floor((x - field[0]) / stride) * stride;
  const top = y - Math.floor((y - field[1]) / stride) * stride;
  const guides: Box[] = [];
  for (let col = left; col + unit - 1 <= field[2]; col += stride) {
    const center = col + offset;
    const band = (row: number) => {
      const line = rows[row];
      if (!line || line[center - 1] !== background || line[center + 2] !== background) return null;
      const [a, b] = [line[center]!, line[center + 1]!];
      return a !== b && a !== background && b !== background ? [a, b] : null;
    };
    let start: number | null = null, end = 0;
    let signature: number[] | null = null;
    for (let row = top; row + unit - 1 <= field[3]; row += stride) {
      const entry = band(row - 1), exit = band(row + unit);
      // The guide stays visible between cells even when a piece covers its center.
      const striped = entry && exit && entry[0] === exit[1] && entry[1] === exit[0] ? entry : null;
      if (signature && (!striped || signature[0] !== striped[0] || signature[1] !== striped[1])) {
        if (start !== null && end > start) guides.push([center, start - 1, center + 1, end + unit]);
        start = null;
      }
      signature = striped;
      if (!striped) continue;
      start ??= row;
      end = row;
    }
    if (start !== null && end > start) guides.push([center, start - 1, center + 1, end + unit]);
  }
  return guides;
}

/** Test a conditional model in which displacement on the support is
 * reversible, and contact on a developing span can push a chain. */
export function planOrderedLattice(scene: Scene, effects: readonly Effect[], depthLimit: number, nodeLimit: number, shouldStop: () => boolean,
  guides: readonly Box[] = [], guideOrders: readonly GuideOrder[] = []) {
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
  const guideCells = new Set<string>();
  for (const [l, t, , b] of guides) {
    const col = (l - left - Math.floor((unit - 2) / 2)) / stride;
    for (let y = t + 1; y + unit <= b; y += stride) guideCells.add(`${col},${(y - top) / stride}`);
  }
  const assignments = guideOrders.map(({ box: [l, t, , b], order }) => {
    const column = (l - left - Math.floor((unit - 2) / 2)) / stride;
    const rows = [];
    for (let y = t + 1; y + unit <= b; y += stride) rows.push((y - top) / stride);
    const pieces = order.map(type => parts.findIndex(part => part.type === type));
    return { column, rows, pieces };
  });

  function predict(state: Position, { dy, dx }: Move): Position | null {
    const row = state.row + dy, tip = state.tip + dx;
    if (row < 0 || row >= rows || tip < -1 || tip >= columns) return null;
    if (dx && assignments.length) {
      const pieces = [...state.pieces], moved = new Set<number>();
      function slide(index: number): boolean {
        if (moved.has(index)) return true;
        const [x, y] = state.pieces[index]!, to = x + dx;
        if (!inside(to, y) || guideCells.has(`${x},${y}`) || guideCells.has(`${to},${y}`)) return false;
        const blocker = pieces.findIndex(([u, v]) => u === to && v === y);
        if (blocker >= 0 && !slide(blocker)) return false;
        pieces[index] = [to, y];
        moved.add(index);
        return true;
      }
      for (const [index, [x, y]] of state.pieces.entries()) {
        if (y === row && (x <= state.tip || dx === 1 && x === tip)) slide(index);
      }
      return { row, tip, pieces };
    }
    const moving = new Set<number>();
    for (const [index, [x, y]] of state.pieces.entries()) {
      if (dx && guideCells.has(`${x},${y}`)) continue;
      if ((y === state.row || y === row) && x <= state.tip || dx === 1 && y === row && x === tip) moving.add(index);
    }
    // Iteration also visits pieces added through contiguous contact.
    for (const index of moving) {
      const [x, y] = state.pieces[index]!;
      if (dx && guideCells.has(`${x},${y}`)) return { row, tip, pieces: state.pieces };
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
  function guideDistance(state: Position) {
    let distance = 0;
    for (const { column, rows, pieces } of assignments) {
      let costs = rows.map(() => 0);
      for (const [index, piece] of pieces.entries()) {
        const [x, y] = state.pieces[piece]!;
        costs = rows.map((row, i) => (index ? Math.min(...costs.slice(0, i)) : 0)
          + 3 * Math.abs(x - column) + Math.abs(y - row));
      }
      distance += Math.min(...costs);
    }
    return distance;
  }
  function priority(state: Position, depth: number) {
    if (assignments.length) return depth * 4 + guideDistance(state) * 15;
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
  enqueue({ state: start, depth: 0 });
  for (let expanded = 0; queue.size && expanded < nodeLimit && !shouldStop(); ) {
    const rank = Math.min(...queue.keys()), bucket = queue.get(rank)!;
    const node = bucket.pop()!;
    if (!bucket.length) queue.delete(rank);
    if (visited.get(key(node.state)) !== node.depth) continue;
    expanded++;
    if (node.from && (assignments.length ? guideDistance(node.state) === 0 : aligned(node.state) === parts.length)) {
      const chain: { result: Position; move: Move }[] = [];
      for (let at = node; at.from; at = at.from.node) chain.push({ result: at.state, move: at.from.move });
      const route = chain.reverse().map(({ move, result }) => ({
        command: move.command,
        prediction: {
          root: root.map((value, index) => index % 2 ? value + (result.row - start.row) * stride : value),
          tip: left + result.tip * stride + unit,
          pieces: parts.map(({ id }, index) => {
            const [x, y] = result.pieces[index]!, px = left + x * stride, py = top + y * stride;
            return [id, [px, py, px + unit - 1, py + unit - 1]] as const;
          }).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0),
        },
      }));
      return { ...route[0]!, distance: node.depth, route };
    }
    if (node.depth >= depthLimit) continue;
    for (const move of moves) {
      const result = predict(node.state, move);
      if (result) enqueue({ state: result, depth: node.depth + 1, from: { node, move } });
    }
  }
  return null;
}
