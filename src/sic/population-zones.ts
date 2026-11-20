import type { NativeBox, NativeRows } from '../logos-engine/v6-native-types.ts';
import { referencePopulationCellKey as key, type ReferencePopulationCell as Cell } from '../logos-engine/v6-reference-population-observation.ts';

type Target = [number, number, number];
export type PopulationZone = { box: NativeBox; cells: Cell[] };
type Geometry = { q: number; offset: Cell; floor: Cell[]; empty: number; border: number };
const sides: readonly Cell[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function readPopulationZones(rows: NativeRows, { q, offset: [oy, ox], floor, empty, border }: Geometry): PopulationZone[] {
  const available = new Set(floor.map(key)), seen = new Set<string>(), zones: PopulationZone[] = [];
  for (const first of floor) {
    if (seen.has(key(first))) continue;
    const cells = [first];
    seen.add(key(first));
    let open = false, hasEmptyCell = false;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const [row, column] of cells) {
      const y = oy + row * q, x = ox + column * q;
      left = Math.min(left, x - 1); top = Math.min(top, y - 1);
      right = Math.max(right, x + q - 1); bottom = Math.max(bottom, y + q - 1);
      hasEmptyCell ||= rows.slice(y, y + q - 1).every(line => line.slice(x, x + q - 1).every(ink => ink === empty));
      for (const [dy, dx] of sides) {
        const edge = dy ? rows[y + (dy > 0 ? q - 1 : -1)]?.slice(x, x + q - 1) :
          rows.slice(y, y + q - 1).map(line => line[x + (dx > 0 ? q - 1 : -1)]);
        if (edge?.length === q - 1 && edge.every(ink => ink === border)) continue;
        const next: Cell = [row + dy, column + dx], id = key(next);
        if (!available.has(id)) open = true;
        else if (!seen.has(id)) {
          seen.add(id);
          cells.push(next);
        }
      }
    }
    if (!open && hasEmptyCell) zones.push({ box: [left, top, right, bottom], cells });
  }
  return zones;
}

export function* populationZoneTargets(target: readonly Target[], zones: readonly PopulationZone[]) {
  if (!target.length) return;
  const minRow = Math.min(...target.map(([row]) => row)), minCol = Math.min(...target.map(([, col]) => col));
  const relative = target.map(([row, col, ink]): Target => [row - minRow, col - minCol, ink]);
  for (const zone of zones) {
    if (zone.cells.length < target.length) continue;
    const within = new Set(zone.cells.map(key));
    // Concave references need not occupy the top-left cell of their bounding box.
    const [dy, dx] = relative[0]!;
    for (const [row, col] of zone.cells) {
      const positions = relative.map(([y, x, ink]): Target => [row - dy + y, col - dx + x, ink]);
      if (positions.every(([y, x]) => within.has(key([y, x])))) yield { positions, zone };
    }
  }
}
