/** Conditional finite line search from common_supported_lines.py. */
type Board = readonly (readonly unknown[])[];
type Point = readonly [number, number];
type R = Record<string, any>;
const pointOrder = (a: readonly number[], b: readonly number[]): number => a[0]! - b[0]! || a[1]! - b[1]!;
export class NativeLineSearchDomainError extends RangeError {}

export function lineInsertions(board: Board, empty: unknown, axis: number | null, sign: number): Point[] {
  const height = board.length, width = board[0]!.length, result: Point[] = [];
  if (axis === null) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (board[y]![x] === empty) result.push([x, y]);
    return result;
  }
  const length = [width, height][axis]!, lanes = [height, width][axis]!;
  for (let lane = 0; lane < lanes; lane++) {
    for (let d = sign > 0 ? length - 1 : 0; sign > 0 ? d >= 0 : d < length; d += sign > 0 ? -1 : 1) {
      const [x, y] = axis === 0 ? [d, lane] : [lane, d];
      if (board[y!]![x!] === null) break;
      if (board[y!]![x!] === empty) { result.push([x!, y!]); break; }
    }
  }
  return result;
}

export function lineWindows(board: Board, length: number): Point[][] {
  const height = board.length, width = board[0]!.length, result: Point[][] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]] as Point[]) {
      const points: Point[] = Array.from({ length }, (_, index) => [x + index * dx, y + index * dy]);
      if (points.every(([u, v]) => u >= 0 && u < width && v >= 0 && v < height && board[v]![u] !== null)) result.push(points);
    }
  }
  return result;
}

export function linePlace(board: Board, point: readonly number[], color: unknown): unknown[][] {
  const [x, y] = point as [number, number], rows = [...board], row = [...rows[y]!];
  row[x] = color; rows[y] = row; return rows as unknown[][];
}

export function searchLines(board: Board, own: unknown, other: unknown, empty: unknown,
  length: number, axis: number | null, sign: number, depth: number): [R[], R] {
  const windows = lineWindows(board, length), terminal = (windows.length + 1) * 4 ** length * 100, cache = new Map<string, number>();
  // Python scores are unbounded integers. Reject a broader numeric domain
  // before rounded bounds or ties could authorize a different physical move.
  if (!Number.isSafeInteger(terminal * 2 + Math.abs(depth) + board.length * board[0]!.length)) {
    throw new NativeLineSearchDomainError('Conditional line search exceeds the native exact-integer domain');
  }
  let nodes = 0;
  const won = (current: Board, color: unknown): boolean => windows.some(window => window.every(([x, y]) => current[y]![x] === color));
  const evaluate = (current: Board): number => {
    let value = 0;
    for (const window of windows) {
      const a = window.reduce((count, [x, y]) => count + Number(current[y]![x] === own), 0);
      const c = window.reduce((count, [x, y]) => count + Number(current[y]![x] === other), 0);
      if (!c) value += 4 ** a;
      if (!a) value -= 4 ** c;
    }
    return value;
  };
  const solve = (current: Board, left: number, player: unknown, startAlpha: number, startBeta: number): number => {
    nodes++;
    if (won(current, own)) return terminal + left;
    if (won(current, other)) return -terminal - left;
    const legal = lineInsertions(current, empty, axis, sign);
    if (!left || !legal.length) return evaluate(current);
    const key = JSON.stringify([current, left, player]), known = cache.get(key);
    if (known !== undefined) return known;
    const maximizing = player === own;
    let best = maximizing ? -terminal * 2 : terminal * 2, complete = true, alpha = startAlpha, beta = startBeta;
    const ordered = legal.map(point => ({ point, value: evaluate(linePlace(current, point, player)) })).sort((a, b) =>
      (maximizing ? -1 : 1) * (a.value - b.value || pointOrder(a.point, b.point)));
    for (const { point } of ordered) {
      const value = solve(linePlace(current, point, player), left - 1, maximizing ? other : own, alpha, beta);
      best = maximizing ? Math.max(best, value) : Math.min(best, value);
      if (maximizing) alpha = Math.max(alpha, best); else beta = Math.min(beta, best);
      if (beta <= alpha) { complete = false; break; }
    }
    if (complete) cache.set(key, best);
    return best;
  };
  const ranked = lineInsertions(board, empty, axis, sign).map(point => {
    const child = linePlace(board, point, own), value = solve(child, depth - 1, other, -terminal * 2, terminal * 2);
    const useful = windows.reduce((count, window) => count + Number(window.some(candidate => pointOrder(candidate, point) === 0)), 0);
    return { point: [...point], value, immediate_goal: won(child, own), geometric_windows: useful };
  }).sort((a, b) => b.value - a.value || b.geometric_windows - a.geometric_windows || pointOrder(a.point, b.point));
  return [ranked, { nodes, reply_plies: depth, windows: windows.length,
    scope: 'Exact finite-horizon search under conditional insertion, alternating response and symmetric line-goal hypotheses; future response policy unknown.' }];
}
