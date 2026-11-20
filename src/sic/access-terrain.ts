import type { NativeEntity, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Move } from './preparation-experiments.ts';

export type XY = [number, number];
export const add = (p: XY, d: XY): XY => [p[0] + d[0], p[1] + d[1]];
export const diff = (p: XY, q: XY): XY => [p[0] - q[0], p[1] - q[1]];
export const size = (p: XY) => Math.abs(p[0]) + Math.abs(p[1]);
export const same = (p: XY, q: XY) => p[0] === q[0] && p[1] === q[1];
export const point = (s: string): XY => s.split(',').map(Number) as XY;
export type Floor = Record<string, Record<string, number>>;

// A moving component exposes its substrate. Never sample a pixel still occupied by a moving part.
export function observeFloor(
  floor: Floor,
  b: NativeObservation,
  a: NativeObservation,
  next: NativeRows,
  moves: Move[]
) {
  if (!moves.length) return;
  const after = new Set(moves.map((v) => v.actor));
  const covered = new Set<string>();
  for (const e of a.entities)
    if (after.has(e.signature))
      for (const [x, y] of e.mask) covered.add([e.position[0] + x, e.position[1] + y].join());
  for (const e of b.entities)
    if (after.has(e.signature)) {
      const votes = (floor[e.signature] ??= {});
      for (const [dx, dy] of e.mask) {
        const x = e.position[0] + dx,
          y = e.position[1] + dy;
        if (!covered.has([x, y].join()) && next[y]?.[x] !== undefined) {
          const c = next[y]![x]!;
          votes[c] = (votes[c] ?? 0) + 1;
        }
      }
    }
}

export function terrain(
  rows: NativeRows,
  actor: NativeEntity,
  mobile: Set<string>,
  o: NativeObservation,
  floor: Floor
) {
  const w = rows[0]!.length,
    h = rows.length;
  const votes = Object.entries(floor[actor.signature] ?? {}).sort((a, b) => b[1] - a[1]);
  const ground = Number(votes[0]?.[0] ?? -1),
    ids = new Int32Array(w * h),
    open = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) open[y * w + x] = Number(rows[y]![x] === ground);
  for (const e of o.entities)
    if (mobile.has(e.signature))
      for (const [dx, dy] of e.mask) open[(e.position[1] + dy) * w + e.position[0] + dx] = 1;
  let n = 0;
  const areas = [0];
  for (let i = 0; i < open.length; i++)
    if (open[i] && !ids[i]) {
      const queue = [i];
      ids[i] = ++n;
      for (let j = 0; j < queue.length; j++) {
        const at = queue[j]!,
          x = at % w,
          y = Math.floor(at / w);
        for (const t of [
          x > 0 ? at - 1 : -1,
          x + 1 < w ? at + 1 : -1,
          y > 0 ? at - w : -1,
          y + 1 < h ? at + w : -1,
        ])
          if (t >= 0 && open[t] && !ids[t]) {
            ids[t] = n;
            queue.push(t);
          }
      }
      areas[n] = queue.length;
    }
  const cx = Math.floor((actor.bbox[2] - actor.bbox[0]) / 2),
    cy = Math.floor((actor.bbox[3] - actor.bbox[1]) / 2);
  const region = (p: XY) => {
    const x = p[0] + cx,
      y = p[1] + cy;
    return x >= 0 && y >= 0 && x < w && y < h && ground >= 0 ? ids[y * w + x]! : 0;
  };
  return { region, areas, ground };
}
