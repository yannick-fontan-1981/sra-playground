import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureReferencePopulation } from '../src/logos-engine/v6-reference-population-observation.ts';
import { measureTransferredPopulationSelection } from '../src/sic/population-placement.ts';

const fixture = new URL('./fixtures/v6-reference-population-reference.json.gz', import.meta.url);
const base: number[][] = JSON.parse(gunzipSync(readFileSync(fixture)).toString()).rasters.base;
const layout = measureReferencePopulation(base)!;
const cells: [number, number][] = layout.bodies.map(({ cell: [y, x] }: { cell: number[] }) =>
  [layout.offset[1] + x! * layout.q, layout.offset[0] + y! * layout.q]);
const ink = Math.max(...base.flat()) + 1;

function marked(index: number, offsets: number[][]) {
  const rows = structuredClone(base), [x, y] = cells[index]!;
  for (const [dx, dy] of offsets) rows[y + dy!]![x + dx!] = ink;
  return rows;
}

test('a translated mark reveals a stationary population and binds the body actually clicked', () => {
  for (const shape of [[[1, 1]], [[0, 1], [1, 1]]]) {
    const before = marked(0, shape), after = marked(1, shape);
    const original = structuredClone(before);
    assert.equal(measureReferencePopulation(before), null);
    const result = measureTransferredPopulationSelection(before, after, cells[1]!);
    assert.deepEqual(result?.selection, layout.bodies[1].cell);
    assert.deepEqual(result?.scene.bodies, layout.bodies);
    assert.deepEqual(measureReferencePopulation(before, result!.scene)?.bodies, layout.bodies);
    assert.deepEqual(before, original);
    assert.equal(measureTransferredPopulationSelection(before, after, cells[0]!), null);
  }
});

test('shifted offsets, extra edits, an absent mark or a solitary new mark do not prove transfer', () => {
  const before = marked(0, [[1, 1]]), after = marked(1, [[1, 1]]);
  assert.equal(measureTransferredPopulationSelection(before, marked(1, [[0, 0]]), cells[1]!), null);
  assert.equal(measureTransferredPopulationSelection(base, after, cells[1]!), null);
  assert.equal(measureTransferredPopulationSelection(before, before, cells[1]!), null);
  after[0]![0] = ink;
  assert.equal(measureTransferredPopulationSelection(before, after, cells[1]!), null);
});
