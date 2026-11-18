import assert from 'node:assert/strict';
import test from 'node:test';
import type { ReferencePopulationCell as Cell } from '../src/logos-engine/v6-reference-population-observation.ts';
import { populationZoneTargets, readPopulationZones } from '../src/sic/population-zones.ts';

test('a closed contour preserves an excluded cell between translated reference positions', () => {
  const q = 4, offset: Cell = [2, 2], empty = 4, border = 2;
  const floor: Cell[] = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c): Cell => [r, c])).flat();
  const rows = Array.from({ length: 36 }, () => Array<number>(36).fill(5));
  const ring = floor.filter(([r, c]) => r >= 1 && r <= 3 && c >= 1 && c <= 3 && (r !== 2 || c !== 2));
  const second = floor.filter(([r, c]) => r >= 5 && r <= 6 && c >= 5 && c <= 7);
  for (const area of [ring, second]) for (const [r, c] of area) {
    const y = offset[0] + r * q, x = offset[1] + c * q;
    const member = (dr: number, dc: number) => area.some(([row, col]) => row === r + dr && col === c + dc);
    for (let i = 0; i < q - 1; i++) {
      rows[y + i]!.fill(empty, x, x + q - 1);
      if (!member(-1, 0)) rows[y - 1]![x + i] = border;
      if (!member(1, 0)) rows[y + q - 1]![x + i] = border;
      if (!member(0, -1)) rows[y + i]![x - 1] = border;
      if (!member(0, 1)) rows[y + i]![x + q - 1] = border;
    }
  }
  const zones = readPopulationZones(rows, { q, offset, floor, empty, border });
  assert.deepEqual(zones.map(zone => zone.cells.length), [8, 6]);
  assert.equal(zones[0]!.cells.some(([r, c]) => r === 2 && c === 2), false);
  const reference = ring.map(([r, c]): [number, number, number] => [r + 3, c + 2, 9]);
  const placements = [...populationZoneTargets(reference, zones)];
  assert.equal(placements.length, 1);
  assert.deepEqual(placements[0]!.positions, ring.map(([r, c]) => [r, c, 9]));
});
