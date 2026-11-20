import assert from 'node:assert/strict';
import test from 'node:test';
import { display_matches, world_complements } from '../src/logos-engine/v6-inventory-contrast.ts';

test('a sparse object spanning a cell can fill its measured complementary gate', () => {
  const rows = [[8, 0, 0, 0, 0, 8, 8], [0, 8, 0, 0, 8, 0, 8], [0, 0, 8, 0, 8, 8, 0]];
  const cells = [0, 4].map((left, col) => ({ row: 0, col, bbox: { left, top: 0, right: left + 2, bottom: 2 } }));
  const scene = { grids: [{ cell_height: 3, cell_width: 3, cells }] };
  const links = (allow: boolean) => world_complements(scene, rows, allow).filter(link =>
    link.source_value === 8 && link.source_cell[1] === 0 && link.target_cell[1] === 1);
  assert.deepEqual(links(false), []);
  assert.equal(links(true).length, 1);
  assert.deepEqual(links(true)[0]!.source_mask, [[0, 0], [1, 1], [2, 2]]);
});

test('an opaque inventory indicator can have a different mask from the carried object', () => {
  const receipt = { source_value: 8, source_mask: [[0, 0], [1, 1]], display_bbox: [0, 0, 1, 1], display_value: 15 };
  const rows = [[15, 15], [15, 15]];
  assert.equal(display_matches(receipt, rows), false);
  const opaque = { ...receipt, display_mask: [[0, 0], [1, 0], [0, 1], [1, 1]] };
  assert.equal(display_matches(opaque, rows), true);
  assert.equal(display_matches(opaque, [[15, 15], [0, 15]]), false);
});
