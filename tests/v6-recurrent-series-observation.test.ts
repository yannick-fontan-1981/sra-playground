import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { recurrentSeriesFields, recurrentSeriesPointedCandidates, recurrentSeriesExtensions, recurrentSeriesLayoutKey,
  type RecurrentSeriesLineField } from '../src/logos-engine/v6-recurrent-series-observation.ts';

type R = Record<string, any>;
const fixture: R = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-recurrent-series-reference.json.gz', import.meta.url))).toString());
const root = new URL('../', import.meta.url);
const copy = <T>(value: T): T => structuredClone(value);
const hash = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');

test('recurrent-series projection fixture identifies unchanged pinned original modules', async () => {
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  const manifest = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/manifest.json`, root), 'utf8'));
  assert.equal(fixture.originalFilesVerifiedBefore, Object.keys(manifest.files).length);
  assert.equal(fixture.originalFilesVerifiedAfter, Object.keys(manifest.files).length);
  for (const [path, digest] of Object.entries(fixture.sourceFiles)) {
    assert.equal(manifest.files[path].sha256, digest, path);
    assert.equal(hash(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/${path}`, root))), digest, path);
  }
});

for (const item of fixture.fieldCases as R[]) {
  test(`original recurrent-series fields: ${item.id}`, () => {
    const before = copy(item.rows);
    if (item.error) assert.throws(() => recurrentSeriesFields(item.rows), 'Exception classes outside the admitted native domain are qualified separately');
    else assert.deepEqual(recurrentSeriesFields(item.rows), item.expected);
    assert.deepEqual(item.rows, before);
  });
}

for (const item of fixture.pointedCases as R[]) {
  test(`original recurrent-series pointed addresses: ${item.id}`, () => {
    const before = copy(item.rows);
    if (item.error) assert.throws(() => recurrentSeriesPointedCandidates(item.rows, item.available));
    else assert.deepEqual(recurrentSeriesPointedCandidates(item.rows, item.available), item.expected);
    assert.deepEqual(item.rows, before);
  });
}

for (const item of fixture.extensionCases as R[]) {
  test(`original recurrent-series extensions: ${item.id}`, () => {
    const before = copy(item.field);
    if (item.error) assert.throws(() => recurrentSeriesExtensions(item.field));
    else assert.deepEqual(recurrentSeriesExtensions(item.field), item.expected);
    assert.deepEqual(item.field, before);
  });
}

for (const item of fixture.layoutCases as R[]) {
  test(`original recurrent-series insertion layout key: ${item.id}`, () => {
    const before = copy(item.field);
    if (item.error) assert.throws(() => recurrentSeriesLayoutKey(item.field));
    else assert.equal(recurrentSeriesLayoutKey(item.field), item.expected);
    assert.deepEqual(item.field, before);
  });
}

for (const item of fixture.sourceDivergences as R[]) {
  test(`qualified original raster behavior outside the native domain: ${item.id}`, () => {
    const before = copy(item.rows);
    assert.equal(item.method, 'fields');
    assert.throws(() => recurrentSeriesFields(item.rows), TypeError,
      'Source permissiveness or exception classes outside uint8 rectangular inputs are not native parity claims');
    assert.deepEqual(item.rows, before);
  });
}

/** Synthetic public pixels only: no transition model or success condition. */
function raster(grid: number[][] = [[1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
  width = 3, height = 3, dx = 2, dy = 2): number[][] {
  const nx = grid[0]!.length, ny = grid.length;
  const rows = Array.from({ length: dy + ny * height + ny - 1 + 2 }, () => Array(dx + nx * width + nx - 1 + 2).fill(7));
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    for (let y = dy + j * (height + 1); y < dy + j * (height + 1) + height; y++) {
      for (let x = dx + i * (width + 1); x < dx + i * (width + 1) + width; x++) rows[y]![x] = grid[j]![i]!;
    }
    if (j + 1 < ny) for (let x = dx + i * (width + 1); x < dx + i * (width + 1) + width; x++) {
      rows[dy + j * (height + 1) + height]![x] = 8;
    }
  }
  for (let i = 0; i + 1 < nx; i++) for (let y = dy; y < dy + ny * height + ny - 1; y++) {
    rows[y]![dx + i * (width + 1) + width] = 9;
  }
  return rows;
}

test('separators and recurring patches measure a field without asserting a terminal length', () => {
  const fields = recurrentSeriesFields(raster());
  assert.equal(fields.length, 1);
  const field = fields[0]!;
  assert.deepEqual(field.origin, [2, 2]); assert.deepEqual(field.shape, [4, 3]);
  assert.deepEqual(field.size, [3, 3]); assert.deepEqual(field.pitch, [4, 4]);
  assert.equal(field.empty_hypothesis, 0);
  assert.deepEqual(recurrentSeriesExtensions(field), [{ color: 1, length: 2, target: [2, 0], direction: [1, 0] }]);
  assert.equal(Object.hasOwn(field, 'terminal'), false);
  assert.equal(Object.hasOwn(field, 'target_length'), false);
});

test('field identity excludes palette contents but includes the majority hypothesis; insertion layout excludes both', () => {
  const first = recurrentSeriesFields(raster())[0]!;
  const second = recurrentSeriesFields(raster([[1, 1, 0, 0], [0, 2, 0, 0], [0, 0, 0, 0]]))[0]!;
  const renamed = recurrentSeriesFields(raster([[1, 1, 3, 3], [3, 3, 3, 3], [3, 3, 3, 3]]))[0]!;
  assert.equal(first.ref, second.ref); assert.notEqual(first.ref, renamed.ref);
  assert.equal(recurrentSeriesLayoutKey(first), recurrentSeriesLayoutKey(second));
  assert.equal(recurrentSeriesLayoutKey(first), recurrentSeriesLayoutKey(renamed));
});

test('majority ties refuse a field, while a single palette remains a measured empty hypothesis', () => {
  assert.deepEqual(recurrentSeriesFields(raster([[1, 1, 1, 1], [1, 1, 0, 0], [0, 0, 0, 0]])), []);
  const field = recurrentSeriesFields(raster(Array.from({ length: 3 }, () => Array(4).fill(4))))[0]!;
  assert.equal(field.empty_hypothesis, 4); assert.deepEqual(recurrentSeriesExtensions(field), []);
});

test('unknown cells are retained through the exact minimum-shape limit and remain pointable', () => {
  const rows = raster(), before = copy(rows);
  for (const x of [2, 6, 10]) rows[6]![x] = 5;
  const field = recurrentSeriesFields(rows)[0]!;
  assert.ok(field); assert.deepEqual(field.grid[1], [null, null, null, 0]);
  const inputs = recurrentSeriesPointedCandidates(rows, ['ACTION6']);
  assert.equal(inputs.length, 12); assert.deepEqual(inputs[4], { action_ref: 'ACTION6', data: { x: 3, y: 7 } });
  rows[6]![14] = 5;
  assert.deepEqual(recurrentSeriesFields(rows), [], 'One unknown beyond min(nx, ny) refuses the measured field');
  assert.notDeepEqual(rows, before);
});

test('candidate order is row-major per measured field and even-sized centers use the lower pixel', () => {
  const rows = raster(undefined, 2, 2), points = recurrentSeriesPointedCandidates(rows, ['ACTION1', 'ACTION6']);
  assert.equal(points.length, 12);
  assert.deepEqual(points.slice(0, 5).map(input => input.data), [{ x: 2, y: 2 }, { x: 5, y: 2 }, { x: 8, y: 2 }, { x: 11, y: 2 }, { x: 2, y: 5 }]);
  assert.deepEqual(recurrentSeriesPointedCandidates([], ['ACTION1']), [], 'Unavailable pointing does not inspect the raster');
});

test('translation and arbitrary palette renaming preserve lattice relations and candidate addresses', () => {
  const first = recurrentSeriesFields(raster())[0]!, dx = 5, dy = 4;
  const palette = [12, 4, 20, 11, 2, 6, 1, 18, 14, 0];
  const translated = raster(undefined, 3, 3, 2 + dx, 2 + dy).map(row => row.map(value => palette[value]!));
  const second = recurrentSeriesFields(translated)[0]!;
  assert.ok(second); assert.deepEqual(second.origin, [first.origin[0] + dx, first.origin[1] + dy]);
  assert.deepEqual(second.size, first.size); assert.deepEqual(second.shape, first.shape); assert.deepEqual(second.pitch, first.pitch);
  assert.equal(second.empty_hypothesis, palette[first.empty_hypothesis]);
  assert.deepEqual(second.grid, first.grid.map(row => row.map(value => value === null ? null : palette[value])));
});

test('maximal runs emit preceding then following endpoints without deduplicating common targets', () => {
  const both: RecurrentSeriesLineField = { grid: [[0, 1, 1, 1, 0]], shape: [5, 1], empty_hypothesis: 0 };
  assert.deepEqual(recurrentSeriesExtensions(both), [
    { color: 1, length: 3, target: [0, 0], direction: [1, 0] },
    { color: 1, length: 3, target: [4, 0], direction: [1, 0] },
  ]);
  const shared: RecurrentSeriesLineField = { grid: [[0, 0, 2], [0, 0, 2], [1, 1, 0]], shape: [3, 3], empty_hypothesis: 0 };
  assert.deepEqual(recurrentSeriesExtensions(shared), [
    { color: 2, length: 2, target: [2, 2], direction: [0, 1] },
    { color: 1, length: 2, target: [2, 2], direction: [1, 0] },
  ]);
});

test('both diagonal orientations are measured and unknown or occupied endpoints are not extended', () => {
  const descending: RecurrentSeriesLineField = { grid: [[1, 0, 0], [0, 1, 0], [0, 0, 0]], shape: [3, 3], empty_hypothesis: 0 };
  const ascending: RecurrentSeriesLineField = { grid: [[0, 0, 0], [0, 2, 0], [2, 0, 0]], shape: [3, 3], empty_hypothesis: 0 };
  assert.deepEqual(recurrentSeriesExtensions(descending), [{ color: 1, length: 2, target: [2, 2], direction: [1, 1] }]);
  assert.deepEqual(recurrentSeriesExtensions(ascending), [{ color: 2, length: 2, target: [2, 0], direction: [1, -1] }]);
  for (const blocker of [null, 2]) {
    assert.deepEqual(recurrentSeriesExtensions({ grid: [[1, 1, blocker]], shape: [3, 1], empty_hypothesis: 0 }), []);
  }
});

test('measurement outputs and extension addresses are detached from the supplied public pixels', () => {
  const rows = raster(), before = copy(rows), field = recurrentSeriesFields(rows)[0]!, saved = copy(field);
  const extensions = recurrentSeriesExtensions(field);
  extensions[0]!.target[0] = 99;
  assert.deepEqual(field, saved);
  field.grid[0]![0] = 99; field.origin[0] = 99;
  assert.deepEqual(rows, before);
});

test('native public measurements retain the finite positive rectangular uint8 domain', () => {
  for (const rows of [[], [[]], [[0], [0, 1]], [[-1]], [[256]], [[0.5]], Array.from({ length: 257 }, () => Array(256).fill(0))]) {
    assert.throws(() => recurrentSeriesFields(rows), TypeError);
  }
});

test('direct line projections reject malformed retained dimensions and palette values explicitly', () => {
  assert.deepEqual(recurrentSeriesExtensions({ grid: [], shape: [0, 0], empty_hypothesis: 0 }), []);
  for (const field of [
    { grid: [[1, 1, 0]], shape: [4, 1], empty_hypothesis: 0 },
    { grid: [[1, 1, 0]], shape: [3, 2], empty_hypothesis: 0 },
    { grid: [[1, 1, 0]], shape: [3.5, 1], empty_hypothesis: 0 },
    { grid: [[1, 1, 0]], shape: [-3, 1], empty_hypothesis: 0 },
    { grid: [[1, 1, 256]], shape: [3, 1], empty_hypothesis: 0 },
    { grid: [[1, 1, 0]], shape: [3, 1], empty_hypothesis: -1 },
  ]) assert.throws(() => recurrentSeriesExtensions(field as RecurrentSeriesLineField), TypeError);
});
