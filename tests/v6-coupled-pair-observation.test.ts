import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { matchCoupledPair, measureCoupledPairs } from '../src/logos-engine/v6-coupled-pair-observation.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(await readFile(
  new URL('./fixtures/v6-coupled-pair-observation-reference.json.gz', import.meta.url),
)).toString('utf8'));

test('pair observation oracle binds unchanged source and excludes route planning', async () => {
  assert.equal(fixture.provenance.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.match(fixture.provenance.sourceMethod, /unchanged pairs\(\) and match_pair\(\)/);
  assert.match(fixture.provenance.qualification, /joint_route is explicitly excluded/);
  for (const [path, expected] of Object.entries(fixture.provenance.sources)) {
    const bytes = await readFile(new URL(
      '../reference/v6/' + fixture.provenance.commit + '/source/' + path, import.meta.url,
    ));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, path);
  }
});

for (const item of fixture.cases) test('original public pair observation: ' + item.id, () => {
  if (item.operation === 'pairs') {
    const rows = structuredClone(fixture.scenes[item.arguments.scene]), original = structuredClone(rows);
    assert.deepEqual(measureCoupledPairs(rows), item.expected);
    assert.deepEqual(rows, original, 'measuring the public image must not modify it');
  } else if (item.operation === 'match_pair') {
    const args = structuredClone(item.arguments), original = structuredClone(args);
    assert.deepEqual(matchCoupledPair(args.before, args.after), item.expected);
    assert.deepEqual(args, original, 'enumerating assignments must not re-sort tracked members');
  } else throw new Error('Unknown pair observation oracle operation');
});

test('pair measurements respect changed raster contents and own their output boxes', () => {
  const rows = structuredClone(fixture.scenes.two_filled_squares);
  const measured = measureCoupledPairs(rows), expected = structuredClone(measured);
  assert.equal(measured.length, 1);
  (measured[0]!.boxes[0] as number[])[0] = 99;
  measured[0]!.boxes.reverse();
  assert.deepEqual(measureCoupledPairs(rows), expected, 'output edits cannot mutate cached component measurements');
  const [top, left] = expected[0]!.boxes[0]!;
  rows[top][left] = 0;
  assert.deepEqual(measureCoupledPairs(rows), [],
    'one overwritten pixel destroys the full-square member; array identity cannot preserve an old measurement');
});

test('matching owns returned boxes while preserving tracked identity across spatial order changes', () => {
  const item = fixture.cases.find((row: R) =>
    row.id === 'spatial_order_changes_but_member_identity_is_retained');
  const args = structuredClone(item.arguments), matched = matchCoupledPair(args.before, args.after)!;
  assert.deepEqual(matched, item.expected);
  args.after.boxes[0][0] = 99;
  assert.deepEqual(matched, item.expected, 'later public box edits cannot mutate the measured correspondence');
  (matched.boxes[0] as number[])[1] = 99;
  assert.notEqual(args.before.boxes[0][1], 99, 'returned boxes are not retained input boxes');
  assert.deepEqual(item.expected.deltas, [[2, 0], [-2, 0]]);
});
