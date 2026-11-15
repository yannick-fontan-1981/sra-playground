import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { RegularField } from '../logos-engine/v6-field-constraints.ts';
import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Cell = { point: NativePoint; value: number };
const key = ([x, y]: NativePoint) => x + ',' + y;

function repeatedGap(cells: readonly Cell[], axis: 0 | 1, width: number): number | null {
  const lines = new Map<number, number[]>();
  for (const { point } of cells) {
    const line = point[1 - axis]!;
    const offsets = lines.get(line) ?? [];
    offsets.push(point[axis]);
    lines.set(line, offsets);
  }
  const votes = new Map<number, number>();
  for (const offsets of lines.values()) {
    offsets.sort((a, b) => a - b);
    for (let index = 1; index < offsets.length; index++) {
      const gap = offsets[index]! - offsets[index - 1]!;
      if (gap >= width) votes.set(gap, (votes.get(gap) ?? 0) + 1);
    }
  }
  const [first, second] = [...votes].sort((a, b) => b[1] - a[1]);
  return first && first[1] > (second?.[1] ?? 1) ? first[0] : null;
}

/** Read rectangular neighborhoods from repeated neighbor offsets in public pixels. */
export function observeRepeatedCells(rows: NativeRows, { minimumSide = 3, includeUnitCells = false } = {}): RegularField[] {
  const sizes = new Map<string, { size: NativePoint; cells: Cell[] }>();
  for (const part of geometricComponents(rows)) {
    const [left, top, right, bottom] = part.bbox;
    const size: NativePoint = [right - left + 1, bottom - top + 1];
    if ((!includeUnitCells && part.area === 1) || part.area !== size[0] * size[1]) continue;
    const group = sizes.get(key(size)) ?? { size, cells: [] };
    group.cells.push({ point: [left, top], value: part.color });
    sizes.set(key(size), group);
  }
  const fields: RegularField[] = [];
  for (const { size, cells } of sizes.values()) {
    if (cells.length < minimumSide ** 2) continue;
    const dx = repeatedGap(cells, 0, size[0]), dy = repeatedGap(cells, 1, size[1]);
    if (dx === null || dy === null) continue;
    const pending = new Map(cells.map(cell => [key(cell.point), cell]));
    for (const [origin, cell] of pending) {
      pending.delete(origin);
      const connected = [cell];
      for (const { point: [x, y] } of connected) {
        const neighbors: NativePoint[] = [[x - dx, y], [x + dx, y], [x, y - dy], [x, y + dy]];
        for (const neighbor of neighbors) {
          const address = key(neighbor), next = pending.get(address);
          if (next) {
            pending.delete(address);
            connected.push(next);
          }
        }
      }
      const xs = [...new Set(connected.map(entry => entry.point[0]))].sort((a, b) => a - b);
      const ys = [...new Set(connected.map(entry => entry.point[1]))].sort((a, b) => a - b);
      if (xs.length >= minimumSide && ys.length >= minimumSide && connected.length === xs.length * ys.length) {
        fields.push({ xs, ys, values: new Map(connected.map(entry => [key(entry.point), entry.value])), size });
      }
    }
  }
  return fields;
}
