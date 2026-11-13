import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { crossedPrefixGeometry, crossedPrefixMeasureControls, crossedPrefixReferencePresent,
  crossedPrefixCell, crossedPrefixSlot, crossedPrefixInputCandidates } from '../src/logos-engine/v6-crossed-prefix-observation.ts';

type R = Record<string, any>;
const fixture: R = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-crossed-prefix-reference.json.gz', import.meta.url))).toString());
const root = new URL('../', import.meta.url);
const copy = <T>(value: T): T => structuredClone(value);
const hash = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');

test('crossed-prefix projection fixture identifies unchanged pinned original modules', async () => {
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  const manifest = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/manifest.json`, root), 'utf8'));
  assert.equal(fixture.originalFilesVerifiedBefore, Object.keys(manifest.files).length);
  assert.equal(fixture.originalFilesVerifiedAfter, Object.keys(manifest.files).length);
  for (const [path, digest] of Object.entries(fixture.sourceFiles)) {
    assert.equal(manifest.files[path].sha256, digest, path);
    assert.equal(hash(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/${path}`, root))), digest, path);
  }
});

for (const item of fixture.geometryCases as R[]) {
  test(`${item.id === 'empty_row' ? 'qualified native domain' : 'original crossed-prefix geometry'}: ${item.id}`, () => {
    const before = copy(item.rows);
    if (item.id === 'empty_row') {
      assert.equal(item.expected, null, 'The original returns None for a zero-width row');
      assert.throws(() => crossedPrefixGeometry(item.rows), TypeError, 'The common native image domain requires a positive width');
    } else if (item.error) assert.throws(() => crossedPrefixGeometry(item.rows), 'Native-domain rejection is distinct from original exception-class parity');
    else assert.deepEqual(crossedPrefixGeometry(item.rows), item.expected);
    assert.deepEqual(item.rows, before, 'Measurement cannot mutate the current public raster');
  });
}

for (const item of fixture.controlCases as R[]) {
  test(`original crossed-prefix control addresses: ${item.id}`, () => {
    const before = copy([item.rows, item.layout]);
    if (item.error) assert.throws(() => crossedPrefixMeasureControls(item.rows, item.layout), 'Retained-domain rejection is qualified separately');
    else assert.deepEqual(crossedPrefixMeasureControls(item.rows, item.layout), item.expected);
    assert.deepEqual([item.rows, item.layout], before);
  });
}

for (const item of fixture.helperCases as R[]) {
  test(`original crossed-prefix ${item.method}: ${item.id}`, () => {
    const a = item.arguments, before = copy(a);
    const run = () => {
      if (item.method === 'reference_present') return crossedPrefixReferencePresent(a.rows, a.layout);
      if (item.method === 'cell') return crossedPrefixCell(a.controller, a.index, a.layout);
      if (item.method === 'slot') return crossedPrefixSlot(a.rows, a.layout, a.position);
      if (item.method === 'input_candidates') return crossedPrefixInputCandidates(a.rows, a.available);
      throw new Error('Unrecognized independent source helper case: ' + item.method);
    };
    if (item.error) assert.throws(run, 'Native retained-domain exception class is not claimed to match Python');
    else assert.deepEqual(run(), item.expected);
    assert.deepEqual(a, before);
  });
}

/** A public synthetic geometry, with no physical dynamics or success oracle. */
function raster(): number[][] {
  const rows = Array.from({ length: 32 }, () => Array(36).fill(0));
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    for (let y = 12 + j * 5; y < 15 + j * 5; y++) for (let x = 15 + i * 5; x < 18 + i * 5; x++) rows[y]![x] = 1;
    rows[2 + j]![2 + i] = 2 + (i + j) % 2;
  }
  for (const y of [13, 18, 23]) {
    for (const x of [10, 11]) rows[y]![x] = 2;
    for (const x of [6, 7]) rows[y]![x] = 3;
  }
  for (const x of [16, 21, 26]) {
    for (const y of [8, 9]) rows[y]![x] = 3;
    for (const y of [5, 6]) rows[y]![x] = 2;
  }
  return rows;
}

test('measured field, reference and color-run addresses do not assign input semantics', () => {
  const layout = crossedPrefixGeometry(raster())!;
  assert.ok(layout);
  assert.deepEqual(layout.origin, [15, 12]); assert.deepEqual(layout.shape, [3, 3]);
  assert.deepEqual(layout.size, [3, 3]); assert.deepEqual(layout.pitch, [5, 5]);
  assert.deepEqual(layout.reference.origin, [2, 2]);
  assert.deepEqual(layout.controllers.map(c => c.key), ['0:0:-1', '0:1:-1', '0:2:-1', '1:0:-1', '1:1:-1', '1:2:-1']);
  assert.deepEqual(layout.controllers[0]!.point, [10, 13], 'Even run center follows the inward-to-outward scan direction');
  assert.deepEqual(layout.controllers[0]!.alternatives, [{ point: [6, 13], color: 3 }]);
  assert.equal(Object.hasOwn(layout, 'actions'), false);
  assert.equal(Object.hasOwn(layout, 'terminal'), false);
});

test('palette renaming and translation preserve measured relationships', () => {
  const rows = raster(), before = crossedPrefixGeometry(rows)!, palette = [7, 9, 11, 4];
  const translated = Array.from({ length: 39 }, () => Array(44).fill(palette[0]!));
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[0]!.length; x++) translated[y + 4]![x + 3] = palette[rows[y]![x]!]!;
  const after = crossedPrefixGeometry(translated)!;
  assert.ok(after);
  assert.deepEqual(after.origin, [18, 16]); assert.deepEqual(after.reference.origin, [5, 6]);
  assert.deepEqual(after.shape, before.shape); assert.deepEqual(after.size, before.size); assert.deepEqual(after.pitch, before.pitch);
  assert.deepEqual(after.reference.values, before.reference.values.map(row => row.map(value => palette[value])));
  assert.deepEqual(after.controllers.map(c => [c.key, c.point, c.color]),
    before.controllers.map(c => [c.key, [c.point[0] + 3, c.point[1] + 4], palette[c.color]]));
});

test('both positive-facing controller families preserve reversed prefix cell addresses', () => {
  const reflected = raster().reverse().map(row => row.reverse()), layout = crossedPrefixGeometry(reflected)!;
  assert.ok(layout);
  assert.ok(layout.controllers.every(c => c.side === 1));
  const horizontal = layout.controllers.find(c => c.axis === 0 && c.lane === 0)!;
  const vertical = layout.controllers.find(c => c.axis === 1 && c.lane === 0)!;
  assert.deepEqual(crossedPrefixCell(horizontal, 0, layout), [2, 0]);
  assert.deepEqual(crossedPrefixCell(horizontal, 2, layout), [0, 0]);
  assert.deepEqual(crossedPrefixCell(vertical, 0, layout), [0, 2]);
});

test('two complete sides of one controller family leave geometry ambiguous', () => {
  const rows = raster();
  for (const y of [13, 18, 23]) for (const x of [32, 33]) rows[y]![x] = 2;
  assert.equal(crossedPrefixGeometry(rows), null);
});

test('a disconnected duplicate reference with identical values is admitted in first scan order', () => {
  const rows = raster();
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) rows[27 + j]![2 + i] = rows[2 + j]![2 + i]!;
  const layout = crossedPrefixGeometry(rows)!;
  assert.ok(layout); assert.deepEqual(layout.reference.origin, [2, 2]);
  rows[27]![2] = 3;
  assert.equal(crossedPrefixGeometry(rows), null, 'Different reference matrices are not resolved by selecting one');
});

test('measurement and projections return detached arrays without editing acquired pixels', () => {
  const rows = raster(), before = copy(rows), layout = crossedPrefixGeometry(rows)!;
  const projection = crossedPrefixSlot(rows, layout, [1, 1]);
  projection[0]![0] = 99; layout.reference.values[0]![0] = 99; layout.controllers[0]!.point[0] = 99;
  assert.deepEqual(rows, before);
});

test('point candidates are sorted unique measured addresses and unavailable pointing short-circuits geometry', () => {
  const rows = raster(), inputs = crossedPrefixInputCandidates(rows, ['ACTION1', 'ACTION6']);
  assert.equal(inputs.length, 12);
  assert.ok(inputs.every(input => input.action_ref === 'ACTION6'));
  assert.equal(new Set(inputs.map(input => `${input.data.x},${input.data.y}`)).size, 12);
  assert.deepEqual(inputs.map(input => [input.data.x, input.data.y]),
    inputs.map(input => [input.data.x, input.data.y]).sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!));
  assert.deepEqual(crossedPrefixInputCandidates([], ['ACTION1']), [], 'Source does not measure geometry without ACTION6');
});

test('reference guard checks every retained reference pixel and refuses a truncated raster address', () => {
  const rows = raster(), layout = crossedPrefixGeometry(rows)!;
  assert.equal(crossedPrefixReferencePresent(rows, layout), true);
  rows[3]![3] = 8;
  assert.equal(crossedPrefixReferencePresent(rows, layout), false);
  assert.throws(() => crossedPrefixReferencePresent(rows.slice(0, 2), layout), RangeError);
});

test('native public measurement retains its finite rectangular uint8 domain', () => {
  for (const rows of [[], [[]], [[0], [0, 1]], [[-1]], [[256]], [[0.5]], Array.from({ length: 257 }, () => Array(256).fill(0))]) {
    assert.throws(() => crossedPrefixGeometry(rows), TypeError);
  }
});

test('retained geometry rejects noninteger indices and negative pixel wrapping, while slot slices clip', () => {
  const rows = raster(), layout = crossedPrefixGeometry(rows)!;
  const changed = copy(layout); changed.reference.origin[0] = -1;
  assert.throws(() => crossedPrefixReferencePresent(rows, changed), RangeError);
  assert.throws(() => crossedPrefixCell(layout.controllers[0]!, 0.5, layout), TypeError);
  assert.deepEqual(crossedPrefixSlot(rows, layout, [100, 100]), []);
});
