import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureFramedWindow, certifyFramedWindow } from '../src/logos-engine/v6-framed-window-observation.ts';

type R = Record<string, any>;
const fixture: R = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-framed-window-reference.json.gz', import.meta.url))).toString());
const copy = <T>(value: T): T => structuredClone(value);
const root = new URL('../', import.meta.url);
const hash = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');

test('framed-window fixture preserves the pinned original files and separates the own transfer', async () => {
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  const manifest = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/manifest.json`, root), 'utf8'));
  assert.equal(fixture.originalFilesVerifiedBefore, Object.keys(manifest.files).length);
  assert.equal(fixture.originalFilesVerifiedAfter, Object.keys(manifest.files).length);
  for (const [path, digest] of Object.entries(fixture.sourceFiles)) {
    assert.equal(manifest.files[path].sha256, digest, path);
    assert.equal(hash(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/${path}`, root))), digest, path);
  }
  assert.match(fixture.qualification, /consumed V5 exact_candidates only/);
  assert.match(fixture.qualification, /opaque boundary/);
  assert.equal(hash(await readFile(new URL(fixture.publicAdmissionReceipt.path, root))), fixture.publicAdmissionReceipt.sha256);
});

test('all 96 eligible archived public projections preserve the original absence of admission', async () => {
  const bytes = await readFile(new URL(fixture.publicCorpus.path, root));
  assert.equal(hash(bytes), fixture.publicCorpus.sha256);
  const corpus = JSON.parse(gunzipSync(bytes).toString()) as R;
  const eligible: R[] = corpus.games.filter((item: R) => !fixture.publicCorpus.excludedGames.includes(item.game));
  assert.equal(eligible.length, 96); assert.equal(fixture.publicProjection.length, eligible.length);
  assert.equal(fixture.publicCorpus.actions, 0); assert.equal(fixture.publicCorpus.levelJumps, 0);
  for (const [index, item] of eligible.entries()) {
    const expected = fixture.publicProjection[index];
    assert.equal(item.game, expected.game);
    assert.equal(hash(JSON.stringify(item.packet.frame_rows)), expected.rowsSha256);
    assert.deepEqual(measureFramedWindow(item.packet.frame_rows), expected.scene, item.game);
  }
  assert.equal(fixture.publicProjection.filter((item: R) => item.scene !== null).length, 0);
});

for (const item of (fixture.cases as R[]).filter(item => ['measure', 'certify'].includes(item.operation))) {
  test(`original framed-window projection: ${item.id}`, () => {
    const a = item.arguments, before = copy(a);
    const actual = item.operation === 'measure' ? measureFramedWindow(a.rows)
      : certifyFramedWindow(a.scene, a.observation, a.deadlineMs, () => a.nowMs);
    assert.deepEqual(actual, item.expected, item.id);
    assert.deepEqual(a, before, 'Public measurement and certification cannot mutate acquired inputs');
  });
}

function raster(): number[][] {
  const rows = Array.from({ length: 16 }, () => Array(20).fill(0));
  const frame = (left: number, top: number, right: number, bottom: number, fill: number) => {
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      rows[y]![x] = x === left || x === right || y === top || y === bottom ? 1 : fill;
    }
  };
  frame(2, 2, 5, 5, 6); frame(9, 2, 15, 8, 6);
  for (const [left, top] of [[3, 3], [11, 4]]) {
    rows[top]![left] = 2; rows[top]![left + 1] = 3;
    rows[top + 1]![left] = 4; rows[top + 1]![left + 1] = 5;
  }
  return rows;
}

test('a unique exact current window preserves geometry and full prefilter work counts', () => {
  const scene = measureFramedWindow(raster())!;
  assert.ok(scene);
  assert.deepEqual(scene.reference_box, [2, 2, 5, 5]);
  assert.deepEqual(scene.image_box, [9, 2, 15, 8]);
  assert.deepEqual(scene.reference, [[2, 3], [4, 5]]);
  assert.deepEqual(scene.matches, [[1, 1]]);
  assert.equal(scene.examined_windows, 16);
  assert.equal(scene.frame_pair_candidates, 1);
  assert.equal(scene.all_pair_windows_examined, 16);
});

test('palette renaming and translation preserve the measured window without fixed roles', () => {
  const rows = raster(), original = measureFramedWindow(rows)!;
  const palette = [15, 9, 7, 11, 2, 3, 5];
  const renamed = rows.map(row => row.map(value => palette[value]!));
  const moved = Array.from({ length: 20 }, () => Array(25).fill(palette[0]!));
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[0]!.length; x++) moved[y + 2]![x + 3] = renamed[y]![x]!;
  const scene = measureFramedWindow(moved)!;
  assert.ok(scene);
  assert.deepEqual(scene.matches, original.matches);
  assert.deepEqual(scene.reference, original.reference.map((row: number[]) => row.map(value => palette[value])));
  assert.deepEqual(scene.reference_box, [5, 4, 8, 7]);
  assert.deepEqual(scene.image_box, [12, 4, 18, 10]);
});

test('a second pixel-equal window leaves the reference correspondence ambiguous', () => {
  const rows = raster();
  rows[6]![13] = 2; rows[6]![14] = 3; rows[7]![13] = 4; rows[7]![14] = 5;
  assert.equal(measureFramedWindow(rows), null);
});

test('one changed reference pixel removes equality without guessing an approximate match', () => {
  const rows = raster(); rows[4]![4] = 7;
  assert.equal(measureFramedWindow(rows), null);
});

test('a boundary-touching reference outline is outside the measured frame grammar', () => {
  const rows = raster().map(row => row.slice(2));
  assert.equal(measureFramedWindow(rows), null);
});

test('measurement returns detached pixels and cannot edit its acquired raster', () => {
  const rows = raster(), before = copy(rows), scene = measureFramedWindow(rows)!;
  scene.reference[0][0] = 99; scene.image[0][0] = 99; scene.reference_box[0] = 99;
  assert.deepEqual(rows, before);
});

test('certification distinguishes descriptive equality from reference-role and point hypotheses', () => {
  const scene = measureFramedWindow(raster())!, observation = { observation_ref: 'current', level_epoch: 7 };
  const result = certifyFramedWindow(scene, observation, 1000, () => 0);
  assert.equal(result.status, 'COMPLETE'); assert.equal(result.domain_complete, true);
  assert.equal(result.descriptive_facts.primitive_release_authorized, false);
  assert.deepEqual(result.scope.assumption_refs, [scene.hypothesis, 'pointing_at_equal_window_may_contribute_to_official_progress']);
  const row = result.values.model_correlated_results[0].result;
  assert.deepEqual(row.covered_window_refs, ['W_1_1']);
  assert.deepEqual(row.exact_window_refs, ['W_1_1']);
  assert.equal(row.window_results[0].photo_scene_ref, 'scene:7');
  assert.equal(result.examined_count, 5, 'Certifier compares the source-prefiltered candidate, not every search-domain window again');
});

test('the low-level source certifier retains its one-millisecond expired-deadline clamp', () => {
  const scene = measureFramedWindow(raster())!;
  const result = certifyFramedWindow(scene, { observation_ref: 'current', level_epoch: 1 }, -1, () => 0);
  assert.equal(result.status, 'COMPLETE', 'Common current-deadline admission is a separate contract');
});
