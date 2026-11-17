import assert from 'node:assert/strict';
import test from 'node:test';
import { facetPointKey, type FacetPoint } from '../src/logos-engine/v6-facet-examples-geometry.ts';
import { facetLayeredCandidates, facetRender, facetRenderPrefix } from '../src/logos-engine/v6-facet-examples-stencils.ts';

test('a construction can reuse a projected origin after extending a face on the earlier unit', () => {
  const background = 0, edgeInk = 4, palette = [1, 2, 3];
  const stamp = Array.from({ length: 13 }, (_, y) => Array.from({ length: 13 }, (_, x) => {
    const slope = Math.floor(Math.abs(x - 6) / 2), seam = 6 - slope, bottom = 12 - slope;
    if (y < slope || y > bottom) return background;
    if (x === 0 || x === 12 || y === slope || y === seam || y === bottom || x === 6 && y > seam) return edgeInk;
    return y < seam ? 1 : x < 6 ? 2 : 3;
  }));
  const centers: FacetPoint[] = [[6, 3], [3, 7], [9, 7]];
  const faces = centers.map((point, index) => ({
    value: palette[index]!, point,
    pixels: stamp.flatMap((row, y) => row.flatMap((ink, x): FacetPoint[] => ink === palette[index] ? [[x, y]] : [])),
  }));
  const steps = new Map<number, FacetPoint>([[1, [0, -6]], [2, [-6, 3]], [3, [6, 3]]]);
  const witness: FacetPoint[] = [[12, 12], [12, 6], [12, 0], [6, 3], [0, 6], [0, 0], [6, 3]];
  const picture = facetRender(stamp, witness, background);
  const reference = Array.from({ length: 25 }, (_, y) => Array.from({ length: 25 }, (_, x) => {
    const ink = picture.get(facetPointKey(x, y)) ?? background;
    if (ink !== edgeInk) return ink;
    return [-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dy => picture.get(facetPointKey(x + dx, y + dy)) ?? background))
      .find(color => color !== edgeInk) ?? background;
  }));

  const result = facetLayeredCandidates(reference, stamp, faces, steps, background, palette, 7, 8_000, 1, [0], [28, 28]);
  assert.equal(result.status, 'compatible_minimal_within_model');
  assert.equal(result.solutions.length, 1);
  const solution = result.solutions[0]!;
  assert.equal(solution.placements.length, 7);
  assert.deepEqual(solution.placements[3], solution.placements[6]);
  assert.deepEqual(solution.actions[3]!.owner_origin, solution.placements[3]);
  assert.deepEqual(facetRenderPrefix(stamp, solution, 7, background, [12, 12]), picture);
});
