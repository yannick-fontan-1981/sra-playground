import type { NativeRows } from '../logos-engine/v6-native-types.ts';

export type Site = readonly [number, number];
export type Edit = { p: Site; from: string; to: string; n: number };
export type Picture = { frame: NativeRows };
export const shiftSite = (p: Site, d: Site): Site => [p[0] + d[0], p[1] + d[1]];
export const siteOffset = (p: Site, q: Site): Site => [p[0] - q[0], p[1] - q[1]];
export const separation = (p: Site, q: Site) => Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]));
export function localPatch(b: Picture | null, [x, y]: Site): string | null {
  if (!b || x < 1 || y < 1 || y >= b.frame.length - 1 || x >= b.frame[y]!.length - 1) return null;
  let value = '';
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) value += String.fromCharCode(65 + b.frame[y + dy]![x + dx]!);
  return value;
}
export function publicEdits(before: Picture, after: Picture, controls: Picture[]): Edit[] {
  const out: Edit[] = [];
  for (let y = 1; y < before.frame.length - 1; y++)
    for (let x = 1; x < before.frame[y]!.length - 1; x++) {
      if (before.frame[y]![x] === after.frame[y]?.[x]) continue;
      const p: Site = [x, y],
        from = localPatch(before, p),
        to = localPatch(after, p);
      if (!from || !to) continue;
      let n = 0;
      for (let j = 0; j < from.length; j++) if (from[j] !== to[j]) n++;
      if (n >= 3 && !controls.some((b) => localPatch(b, p) === to)) out.push({ p, from, to, n });
    }
  return out;
}
export function clickSite(command: string): Site | null {
  const coords = command.split(':')[1];
  if (!coords) return null;
  const [x, y] = coords.split(',').map(Number);
  return x === undefined || y === undefined ? null : [x, y];
}
export function translateCommand(command: string, shift: Site, board: Picture): string | null {
  const p = clickSite(command);
  if (!p) return command;
  const [x, y] = shiftSite(p, shift);
  return x >= 0 && y >= 0 && y < board.frame.length && x < board.frame[y]!.length
    ? 'ACTION6:' + x + ',' + y
    : null;
}
export function orderEdits(edits: Edit[], focus: Site | null) {
  return edits.sort(
    (a, b) =>
      (focus ? separation(a.p, focus) - separation(b.p, focus) : 0) ||
      b.n - a.n ||
      a.p[1] - b.p[1] ||
      a.p[0] - b.p[0]
  );
}
export function separateEdits(ordered: Edit[], count: number) {
  const taken: Edit[] = [];
  for (const e of ordered) {
    if (taken.every((a) => separation(a.p, e.p) >= 3)) taken.push(e);
    if (taken.length === count) break;
  }
  return taken;
}
