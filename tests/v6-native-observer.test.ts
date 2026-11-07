import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { detectV5Components, geometricComponents, geometricCorrespondences, geometricTransitions,
  measureNativeObservation, ObservedInputDomain, publicFrameHash, rowsDigest, v6Canonical } from '../src/logos-engine/v6-native-observer.ts';

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

test('V6 canonical strings use Python ASCII escapes and unsupported rasters fail explicitly', () => {
  assert.equal(v6Canonical({ z: 'é😀', a: 2 }), '{"a":2,"z":"\\u00e9\\ud83d\\ude00"}');
  assert.throws(() => geometricComponents([[0, 1], [2]]), /rectangular/);
  assert.throws(() => geometricComponents([[NaN]]), /palette/);
  assert.throws(() => new ObservedInputDomain(0), /cap/);
});
