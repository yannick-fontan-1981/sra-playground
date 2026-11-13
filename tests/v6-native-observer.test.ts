import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { detectV5Components, geometricComponents, geometricCorrespondences, geometricTransitions,
  measureNativeObservation, ObservedInputDomain, publicFrameHash, rowsDigest, v6Canonical, v6Digest } from '../src/logos-engine/v6-native-observer.ts';

const reference = JSON.parse(await readFile(new URL('./fixtures/v6-observer-reference.json', import.meta.url), 'utf8'));

for (const sample of reference.cases) {
  test(`pinned Python V6/V5 observation parity: ${sample.id}`, async () => {
    const parts = geometricComponents(sample.rows);
    assert.deepEqual(parts, sample.parts);
    assert.deepEqual(geometricCorrespondences(parts), sample.correspondences);
    assert.equal(await publicFrameHash(sample.rows), sample.public.frame_hash);
    const observation = await measureNativeObservation(sample.public, 1, 'reference');
    assert.deepEqual(observation, sample.observation);
    assert.equal(await rowsDigest(sample.rows), sample.rowsDigest);
    for (const connectivity of [4, 8] as const) assert.deepEqual(await detectV5Components(sample.rows, connectivity), sample.v5[String(connectivity)]);
    for (const expected of sample.domains) {
      const domain = new ObservedInputDomain(expected.limit);
      assert.deepEqual(domain.candidates(observation), expected.candidates);
      assert.deepEqual([...domain.bindings.get(`1:${sample.public.frame_hash}`)!], expected.bindings);
    }
    const witness = await ObservedInputDomain.makeLocusWitness(observation, sample.rows, sample.witness.point,
      { reason: 'measured reference', evidence: [observation.observation_ref] });
    assert.deepEqual(witness, sample.witness);
    const command = { action_ref: 'ACTION6', data: { x: witness.point[0]!, y: witness.point[1]! } };
    assert.equal(await ObservedInputDomain.pointGuard(sample.public, command, { point_binding: witness }), true);
    const changed = sample.rows.map((row: number[]) => [...row]);
    changed[command.data.y][command.data.x] = (changed[command.data.y][command.data.x] + 1) % 256;
    assert.equal(await ObservedInputDomain.pointGuard({ ...sample.public, frame_rows: changed }, command, { point_binding: witness }), false);
    assert.equal(await ObservedInputDomain.pointGuard({ ...sample.public, level: 2 }, command, { point_binding: witness }), false);
  });
}

test('geometric transition correspondence keeps original ambiguity rules', () => {
  const value = reference.transition;
  assert.deepEqual(geometricTransitions(geometricComponents(value.before), geometricComponents(value.after)), value.expected);
});

test('geometric connectivity preserves diagonal separation, ordering and edge coordinates', () => {
  const rows = [[4, 9, 9], [9, 4, 9], [9, 9, 4]];
  assert.deepEqual(geometricComponents(rows, 4).map(({ color, area }) => [color, area]),
    [[4, 1], [9, 3], [9, 3], [4, 1], [4, 1]]);
  assert.deepEqual(geometricComponents(rows, 8), [
    { id: 'component-0', color: 4, bbox: [0, 0, 2, 2], area: 3, scale: 1,
      mask: [[0, 0], [1, 1], [2, 2]], normalized: [[0, 0], [1, 1], [2, 2]], rectangular: false },
    { id: 'component-1', color: 9, bbox: [0, 0, 2, 2], area: 6, scale: 1,
      mask: [[0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1]],
      normalized: [[0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1]], rectangular: false },
  ]);
  for (const connectivity of [4, 8] as const) {
    assert.deepEqual(geometricComponents([[1], [1], [2], [1]], connectivity).map(({ bbox, area, mask }) => ({ bbox, area, mask })), [
      { bbox: [0, 0, 0, 1], area: 2, mask: [[0, 0], [0, 1]] },
      { bbox: [0, 2, 0, 2], area: 1, mask: [[0, 0]] },
      { bbox: [0, 3, 0, 3], area: 1, mask: [[0, 0]] },
    ]);
  }
  assert.throws(() => geometricComponents([[0]], 6 as 4), /Connectivity/);
});

test('V6 canonical strings use Python ASCII escapes and unsupported rasters fail explicitly', () => {
  assert.equal(v6Canonical({ z: 'é😀', a: 2 }), '{"a":2,"z":"\\u00e9\\ud83d\\ude00"}');
  assert.throws(() => geometricComponents([[0, 1], [2]]), /rectangular/);
  assert.throws(() => geometricComponents([[NaN]]), /palette/);
  assert.throws(() => new ObservedInputDomain(0), /cap/);
});

const signatureCases = [
  { id: 'palette-extremes-and-many-components', rows: Array.from({ length: 17 }, (_, y) => Array.from({ length: 19 }, (_, x) => (x + y) % 2 ? 255 : 0)) },
  { id: 'scaled-blocks-with-duplicate-signatures', rows: Array.from({ length: 24 }, (_, y) => Array.from({ length: 32 }, (_, x) => (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? 7 : 3)) },
  { id: 'irregular-masks-and-holes', rows: Array.from({ length: 19 }, (_, y) => Array.from({ length: 23 }, (_, x) => x === y || x === 22 - y || (x % 5 === 1 && y % 3 === 0) ? 11 : 4)) },
  { id: 'maximum-public-one-dimensional-raster', rows: [Array<number>(65_536).fill(255)] },
];
for (const { id, rows } of signatureCases) {
  test(`private component signatures retain the original generic digest: ${id}`, async () => {
    const packet = { frame_rows: rows, frame_hash: 'measured-public-signature-contract', level: 2,
      levels_completed: 1, state: 'NOT_FINISHED', available_action_refs: ['ACTION1'] };
    const parts = geometricComponents(rows), observation = await measureNativeObservation(packet, 9, 'signature-contract');
    const expected = await Promise.all(parts.map(part => v6Digest({ palette_value: part.color, area: part.area,
      scale: part.scale, normalized_mask: part.normalized })));
    assert.deepEqual(observation.entities.map(entity => entity.signature), expected);
    assert.equal(observation.revision, 9); assert.equal(observation.level_epoch, 2);
    assert.equal(observation.levels_completed, 1);
    for (const [index, entity] of observation.entities.entries()) {
      assert.deepEqual(entity.mask, parts[index]!.mask);
      assert.equal(entity.identity_ambiguous, expected.filter(value => value === expected[index]).length > 1);
    }
  });
}

test('closed observation signatures preserve portable palette and raster refusals', async () => {
  for (const value of [-0, NaN, Infinity, 0.5, -1, 256]) {
    const packet = { frame_rows: [[value]], frame_hash: 'invalid-palette', level: 1,
      levels_completed: 0, state: 'NOT_FINISHED', available_action_refs: ['ACTION1'] };
    await assert.rejects(measureNativeObservation(packet, 1), Object.is(value, -0) ? /Portable V7 numbers/ : /palette/);
  }
  const valid = { frame_rows: [[0]], frame_hash: 'valid-palette', level: 1,
    levels_completed: 0, state: 'NOT_FINISHED', available_action_refs: ['ACTION1'] };
  await assert.rejects(measureNativeObservation(valid, -1), /revision/);
});

test('a palette getter cannot substitute a nonportable scalar after raster validation', async () => {
  let reads = 0;
  const row = [0];
  Object.defineProperty(row, '0', { enumerable: true, get: () => ++reads === 1 ? 0 : 0.5 });
  await assert.rejects(measureNativeObservation({ frame_rows: [row], frame_hash: 'changed-palette', level: 1,
    levels_completed: 0, state: 'NOT_FINISHED', available_action_refs: ['ACTION1'] }, 1), /Portable V7 numbers/);
});
