import type { NativeRows } from '../logos-engine/v6-native-types.ts';

// A public edit is reversible. One run encodes equal replacements on adjacent cells of a single row.
export type Edit = { width: number; height: number; runs: [number, number, number, number][]; count: number };
export function observedEdit(before: NativeRows, after: NativeRows, limit = 384): Edit | null {
  const width = before[0]?.length ?? 0,
    height = before.length;
  if (!width || height !== after.length) return null;
  const runs: Edit['runs'] = [];
  let count = 0;
  for (let y = 0; y < height; y++) {
    const a = before[y]!,
      b = after[y]!;
    if (a.length !== width || b.length !== width) return null;
    for (let x = 0; x < width; x++) {
      if (a[x] === b[x]) continue;
      const begin = x,
        old = a[x]!,
        value = b[x]!;
      while (x + 1 < width && a[x + 1] === old && b[x + 1] === value) x++;
      runs.push([y * width + begin, x - begin + 1, old, value]);
      count += x - begin + 1;
      if (runs.length > limit) return null;
    }
  }
  return { width, height, runs, count };
}
export function projectEdit(
  board: NativeRows,
  edit: Edit,
  options: { reverse?: boolean; strict?: boolean; offset?: readonly number[] } = {}
) {
  if (board.length !== edit.height || board[0]?.length !== edit.width) return null;
  const next = board.map((row) => Array.from(row));
  let conflicts = 0,
    changed = 0;
  const dx = options.offset?.[0] ?? 0,
    dy = options.offset?.[1] ?? 0;
  for (const [start, len, old, value] of edit.runs) {
    const y = Math.floor(start / edit.width) + dy,
      x = (start % edit.width) + dx;
    if (y < 0 || y >= edit.height || x < 0 || x + len > edit.width) return null;
    const row = next[y]!,
      from = options.reverse ? value : old,
      to = options.reverse ? old : value;
    for (let i = x; i < x + len; i++) {
      if (row[i] !== from) {
        if (row[i] !== to) conflicts++;
        if (options.strict) return null;
      }
      if (row[i] !== to) {
        row[i] = to;
        changed++;
      }
    }
  }
  return { board: next, conflicts, changed };
}
export function imageKey(rows: NativeRows) {
  let a = 2166136261,
    b = 5381;
  for (const row of rows)
    for (const v of row) {
      a = Math.imul(a ^ v, 16777619);
      b = (Math.imul(b, 33) ^ v) >>> 0;
    }
  return [rows.length, rows[0]?.length ?? 0, a >>> 0, b >>> 0].join('/');
}
