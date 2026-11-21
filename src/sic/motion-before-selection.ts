import type { NativeRows } from '../logos-engine/v6-native-types.ts';
import type { TransportMemory } from './transport-observations.ts';

type Extent = { left: number; top: number; right: number; bottom: number };
type Footprints = Record<number, Extent>;
type Witness = { before: Footprints; after: Footprints; ref: string };
export type PriorMotions = Record<string, Witness[]>;

function footprints(rows: NativeRows): Footprints {
  const extents: Footprints = {};
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y]!;
    for (let x = 0; x < row.length; x++) {
      const color = row[x]!;
      const extent = extents[color];
      if (!extent) extents[color] = { left: x, right: x, top: y, bottom: y };
      else {
        extent.left = Math.min(extent.left, x);
        extent.right = Math.max(extent.right, x);
        extent.bottom = y;
      }
    }
  }
  return extents;
}

export function retainMotion(history: PriorMotions, op: string, before: NativeRows, after: NativeRows, ref: string) {
  if (!/^ACTION[1-4]$/.test(op)) return;
  const attempts = history[op] ??= [];
  attempts.push({ before: footprints(before), after: footprints(after), ref });
  if (attempts.length > 8) attempts.shift();
}

function site(g: TransportMemory['grid'], e?: Extent) {
  if (!e) return;
  const x = Math.floor((e.left - g.left) / g.pitch);
  const y = Math.floor((e.top - g.top) / g.pitch);
  if (x < 0 || x >= g.columns || y < 0 || y >= g.rows ||
      Math.floor((e.right - g.left) / g.pitch) !== x ||
      Math.floor((e.bottom - g.top) / g.pitch) !== y) return;
  return { x, y };
}

// Registration identifies both body pigments and the grid. An old transition
// becomes evidence only if one body took one step while its partner held.
export function recoverRegisteredMotions(m: TransportMemory, history: PriorMotions) {
  for (const [op, attempts] of Object.entries(history)) {
    if (m.motors[op]) continue;
    const alternatives = new Map<string, TransportMemory['motors'][string]>();
    for (const w of attempts) {
      const shifts = m.inks.map(ink => {
        const a = site(m.grid, w.before[ink]), b = site(m.grid, w.after[ink]);
        return a && b ? { dx: b.x - a.x, dy: b.y - a.y } : undefined;
      });
      if (!shifts.every(d => d !== undefined)) continue;
      const moved = shifts.filter(d => d.dx || d.dy);
      if (moved.length !== 1) continue;
      const d = moved[0]!;
      if (Math.abs(d.dx) + Math.abs(d.dy) === 1)
        alternatives.set([d.dx, d.dy].join(','), { ...d, ref: w.ref });
    }
    if (alternatives.size === 1) m.motors[op] = [...alternatives.values()][0]!;
  }
}
