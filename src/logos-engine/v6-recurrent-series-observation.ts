/** Public repeated-field measurements from pinned V6 common_repeated_lines.py.
 * Rectangular patches and parallel separators locate cells. Their palette mode
 * and recurrent lines remain hypotheses; neither supplies a terminal rule. */
import { geometricComponents } from './v6-native-observer.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import type { NativeRows } from './v6-native-types.ts';

export type RecurrentSeriesPoint = [number, number];
export interface RecurrentSeriesField {
  origin: RecurrentSeriesPoint; pitch: RecurrentSeriesPoint; size: RecurrentSeriesPoint;
  shape: RecurrentSeriesPoint; grid: (number | null)[][]; empty_hypothesis: number; ref: string;
}
export interface RecurrentSeriesExtension {
  color: number; length: number; target: RecurrentSeriesPoint; direction: RecurrentSeriesPoint;
}
export type RecurrentSeriesLineField = Pick<RecurrentSeriesField, 'grid' | 'shape' | 'empty_hypothesis'>;
export type RecurrentSeriesLayout = Pick<RecurrentSeriesField, 'origin' | 'pitch' | 'size' | 'shape'>;

/** Source Counter ties retain the first encountered component. This differs
 * from choosing the shortest gap, and from a new numeric ordering of sizes. */
function firstMode(counts: ReadonlyMap<number, number>): number {
  let selected: number | undefined, maximum = -1;
  for (const [value, count] of counts) if (count > maximum) { selected = value; maximum = count; }
  if (selected === undefined) throw new RangeError('A nonempty recurrent-series palette measurement is required');
  return selected;
}

export function recurrentSeriesFields(rows: NativeRows): RecurrentSeriesField[] {
  const parts = geometricComponents(rows), height = rows.length, width = rows[0]!.length;
  const sizes = new Map<string, { width: number; height: number; count: number }>();
  for (const part of parts) {
    const [x, y, right, bottom] = part.bbox, w = right - x + 1, h = bottom - y + 1;
    if (part.area !== w * h || Math.min(w, h) < 2) continue;
    const key = `${w}:${h}`, size = sizes.get(key) ?? { width: w, height: h, count: 0 };
    size.count++; sizes.set(key, size);
  }
  const result: RecurrentSeriesField[] = [], retained = new Set<string>();
  for (const { width: w, height: h, count } of sizes.values()) {
    if (count < 4) continue;
    const bands = new Map<string, { top: number; bottom: number; width: number; xs: number[] }>();
    for (const part of parts) {
      const [x, y, right, bottom] = part.bbox, lw = right - x + 1, lh = bottom - y + 1;
      if (part.area !== lw * lh || lw >= w || lh < 3 * h) continue;
      const key = `${y}:${bottom}:${lw}:${part.color}`;
      const band = bands.get(key) ?? { top: y, bottom, width: lw, xs: [] };
      band.xs.push(x); bands.set(key, band);
    }
    for (const { top, bottom, width: lw, xs } of bands.values()) {
      const chains: number[][] = [];
      let chain: number[] = [];
      for (const x of xs.sort((a, b) => a - b)) {
        if (chain.length && x - chain.at(-1)! !== w + lw) { chains.push(chain); chain = []; }
        chain.push(x);
      }
      if (chain.length) chains.push(chain);
      for (const current of chains) {
        if (current.length < 3) continue;
        const gaps = new Map<number, number>();
        for (const part of parts) {
          const [left, y, right, b] = part.bbox, gw = right - left + 1, gh = b - y + 1;
          // Only the origin of a gap is bounded in the source measurement.
          if (part.area === gw * gh && gw === w && gh < h && current[0]! - w <= left
            && left <= current.at(-1)! + lw && top <= y && y <= bottom) {
            gaps.set(gh, (gaps.get(gh) ?? 0) + 1);
          }
        }
        if (!gaps.size) continue;
        const gap = firstMode(gaps), pitch = h + gap;
        if ((bottom - top + 1 + gap) % pitch !== 0) continue;
        const ny = (bottom - top + 1 + gap) / pitch, nx = current.length + 1, left = current[0]! - w;
        if (ny < 3 || left < 0 || left + (nx - 1) * (w + lw) + w > width || top + (ny - 1) * pitch + h > height) continue;
        const grid: (number | null)[][] = [], counts = new Map<number, number>();
        let unknown = 0;
        for (let j = 0; j < ny; j++) {
          const line: (number | null)[] = [];
          for (let i = 0; i < nx; i++) {
            const x = left + i * (w + lw), y = top + j * pitch, first = rows[y]![x]!;
            let uniform = true;
            for (let v = y; v < y + h && uniform; v++) for (let u = x; u < x + w; u++) {
              if (rows[v]![u] !== first) { uniform = false; break; }
            }
            if (!uniform) { line.push(null); unknown++; }
            else { line.push(first); counts.set(first, (counts.get(first) ?? 0) + 1); }
          }
          grid.push(line);
        }
        if (unknown > Math.min(nx, ny)) continue;
        const empty = firstMode(counts), highest = counts.get(empty)!;
        if ([...counts].some(([color, n]) => color !== empty && n === highest)) continue;
        const geometry = { origin: [left, top] as RecurrentSeriesPoint, pitch: [w + lw, pitch] as RecurrentSeriesPoint,
          size: [w, h] as RecurrentSeriesPoint, shape: [nx, ny] as RecurrentSeriesPoint, empty_hypothesis: empty };
        const ref = identity(geometry);
        if (retained.has(ref)) continue;
        retained.add(ref); result.push({ ...geometry, grid, ref });
      }
    }
  }
  return result.sort((a, b) => a.origin[1] - b.origin[1] || a.origin[0] - b.origin[0]);
}

export function recurrentSeriesPointedCandidates(rows: NativeRows, available: readonly string[]):
  { action_ref: 'ACTION6'; data: { x: number; y: number } }[] {
  if (!available.includes('ACTION6')) return [];
  const result: { action_ref: 'ACTION6'; data: { x: number; y: number } }[] = [];
  for (const field of recurrentSeriesFields(rows)) for (let y = 0; y < field.grid.length; y++) {
    for (let x = 0; x < field.grid[y]!.length; x++) {
      result.push({ action_ref: 'ACTION6', data: {
        x: field.origin[0] + x * field.pitch[0] + Math.floor((field.size[0] - 1) / 2),
        y: field.origin[1] + y * field.pitch[1] + Math.floor((field.size[1] - 1) / 2),
      } });
    }
  }
  return result;
}

/** The layout key used for public insertion observations intentionally excludes
 * both the current palette contents and the current empty-palette hypothesis. */
export function recurrentSeriesLayoutKey(field: RecurrentSeriesLayout): string {
  return identity([field.origin, field.pitch, field.size, field.shape]);
}

/** This helper consumes the same rectangular uint8/null fields produced by
 * recurrentSeriesFields. Malformed retained shapes are not silently truncated. */
export function recurrentSeriesExtensions(field: RecurrentSeriesLineField): RecurrentSeriesExtension[] {
  const grid = field.grid, [nx, ny] = field.shape, empty = field.empty_hypothesis;
  if (!Number.isSafeInteger(nx) || !Number.isSafeInteger(ny) || nx < 0 || ny < 0 || nx * ny > 65_536
    || !Array.isArray(grid) || grid.length !== ny || grid.some(row => !Array.isArray(row) || row.length !== nx
      || row.some(value => value !== null && (!Number.isSafeInteger(value) || value < 0 || value > 255)))
    || !Number.isSafeInteger(empty) || empty < 0 || empty > 255) {
    throw new TypeError('A rectangular recurrent-series palette field of at most 65536 cells is required');
  }
  const found: RecurrentSeriesExtension[] = [], directions: RecurrentSeriesPoint[] = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[y]!.length; x++) {
    const color = grid[y]![x]!;
    if (color === null || color === empty) continue;
    for (const [dx, dy] of directions) {
      if (x - dx >= 0 && x - dx < nx && y - dy >= 0 && y - dy < ny && grid[y - dy]![x - dx] === color) continue;
      let length = 0;
      while (x + length * dx >= 0 && x + length * dx < nx && y + length * dy >= 0 && y + length * dy < ny
        && grid[y + length * dy]![x + length * dx] === color) length++;
      if (length < 2) continue;
      for (const [u, v] of [[x - dx, y - dy], [x + length * dx, y + length * dy]]) {
        if (u! >= 0 && u! < nx && v! >= 0 && v! < ny && grid[v!]![u!] === empty) {
          found.push({ color, length, target: [u!, v!], direction: [dx, dy] });
        }
      }
    }
  }
  return found;
}
