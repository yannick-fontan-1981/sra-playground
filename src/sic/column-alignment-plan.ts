export type LineCell = readonly [row: number, column: number];
type Player = 1 | -1;
type Board = number[][];
export type DropChoice = { cell: LineCell; reason: 'complete' | 'block' | 'prepare'; line: LineCell[] };
const axes = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;

export function lineAt(board: readonly number[][], [row, col]: LineCell, player: Player): LineCell[] {
  if (board[row]?.[col] !== player) return [];
  let longest: LineCell[] = [[row, col]];
  for (const [dy, dx] of axes) {
    const points: LineCell[] = [[row, col]];
    for (const direction of [-1, 1]) {
      for (let i = direction; board[row + i * dy]?.[col + i * dx] === player; i += direction) {
        points.push([row + i * dy, col + i * dx]);
      }
    }
    if (points.length > longest.length) longest = points;
  }
  return longest;
}

export function landing(board: readonly number[][], column: number): LineCell | null {
  for (let row = board.length - 1; row >= 0; row--) if (board[row]![column] === 0) return [row, column];
  return null;
}

function winningDrops(board: Board, open: readonly LineCell[], player: Player, length: number) {
  return open.flatMap(cell => {
    const [r, c] = cell;
    board[r]![c] = player;
    const line = lineAt(board, cell, player);
    board[r]![c] = 0;
    return line.length >= length ? [{ cell, line }] : [];
  });
}

export function chooseLineDrop(measured: readonly number[][], length: number): DropChoice | null {
  const board = measured.map(row => [...row]), width = board[0]?.length ?? 0, height = board.length;
  const columns = Array.from({ length: width }, (_, i) => i).sort((a, b) =>
    Math.abs(a - (width - 1) / 2) - Math.abs(b - (width - 1) / 2) || a - b);
  const open = () => columns.flatMap(column => {
    const cell = landing(board, column);
    return cell ? [cell] : [];
  });
  const initial = open();
  if (!initial.length || length < 2 || length > Math.max(width, height)) return null;
  const immediate = winningDrops(board, initial, 1, length)[0];
  if (immediate) return { ...immediate, reason: 'complete' };
  const threats = winningDrops(board, initial, -1, length);
  if (threats.length) return { ...threats[0]!, reason: 'block' };

  const windows: LineCell[][] = [];
  for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) for (const [dy, dx] of axes) {
    const y = r + (length - 1) * dy, x = c + (length - 1) * dx;
    if (y >= height || x < 0 || x >= width) continue;
    windows.push(Array.from({ length }, (_, i) => [r + i * dy, c + i * dx]));
  }
  function evaluate(player: Player) {
    let score = 0;
    for (const window of windows) {
      let own = 0, opponent = 0, supported = 0;
      for (const [r, c] of window) {
        const value = board[r]![c];
        if (value === player) own++;
        else if (value) opponent++;
        else if (r === height - 1 || board[r + 1]![c] !== 0) supported++;
      }
      if (own && !opponent) score += (1 << (2 * own)) * (1 + supported);
      if (opponent && !own) score -= (1 << (2 * opponent)) * (1 + supported);
    }
    return score;
  }

  const win = 100_000, maxNodes = 65_000;
  let nodes = 0;
  function search(player: Player, depth: number, alpha: number, beta: number): number {
    if (++nodes >= maxNodes) return 0;
    const moves = open();
    if (!moves.length) return 0;
    if (winningDrops(board, moves, player, length).length) return win + depth;
    const replies = winningDrops(board, moves, player === 1 ? -1 : 1, length);
    if (replies.length > 1) return -win - depth;
    if (!depth) return evaluate(player);
    let best = -Infinity;
    for (const [r, c] of replies.length ? [replies[0]!.cell] : moves) {
      board[r]![c] = player;
      const score = -search(player === 1 ? -1 : 1, depth - 1, -beta, -alpha);
      board[r]![c] = 0;
      if (nodes >= maxNodes) break;
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return best;
  }

  let chosen = initial[0]!;
  for (const depth of [3, 5, 7]) {
    let best = -Infinity, at = chosen;
    const candidates = [chosen, ...initial.filter(cell => cell !== chosen)];
    for (const cell of candidates) {
      const [r, c] = cell;
      board[r]![c] = 1;
      const score = -search(-1, depth - 1, -Infinity, -best);
      board[r]![c] = 0;
      if (score > best) { best = score; at = cell; }
      if (nodes >= maxNodes || best >= win) break;
    }
    if (nodes >= maxNodes) break;
    chosen = at;
    if (best >= win) break;
  }
  return { cell: chosen, reason: 'prepare', line: [] };
}
