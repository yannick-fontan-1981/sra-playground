import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureReceptionService, receptionServiceCarriers, receptionServicePath,
  receptionServiceSides } from '../src/logos-engine/v6-reception-service-observation.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const file = (path: string): Buffer => readFileSync(new URL(path, root));
const fixture: R = JSON.parse(gunzipSync(file('tests/fixtures/v6-reception-service-reference.json.gz')).toString());
const admission: R = JSON.parse(file('docs/migration/lot3e-evidence/diagnostic/reception-public-admission.json').toString());
const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
const operations = new Set(['scene', 'sides', 'carriers', 'path']);

test('reception projection fixtures pin original source and retain public-only scope', () => {
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.originalFilesVerifiedBefore, 1786);
  assert.equal(fixture.originalFilesVerifiedAfter, 1786);
  const prefix = 'reference/v6/' + fixture.sourceCommit + '/';
  const manifest = JSON.parse(file(prefix + 'manifest.json').toString());
  for (const [path, descriptor] of Object.entries(manifest.files) as [string, R][]) {
    assert.equal(hash(file(prefix + 'source/' + path)), descriptor.sha256, path);
  }
  for (const [path, digest] of Object.entries(fixture.sourceFiles)) assert.equal(manifest.files[path].sha256, digest, path);
  assert.equal(admission.sourceCommit, fixture.sourceCommit);
  assert.equal(admission.sourceSha256, manifest.files[admission.sourcePath].sha256);
  assert.equal(admission.originalFilesVerifiedBefore, 1786);
  assert.equal(admission.originalFilesVerifiedAfter, 1786);
  assert.match(admission.scope, /already archived initial public pixels/);
});

test('98 archived public rasters preserve source admission and carriers without a new game attempt', () => {
  const raw = file(admission.corpus.path), corpus = JSON.parse(gunzipSync(raw).toString());
  assert.equal(hash(raw), admission.corpus.sha256);
  assert.equal(admission.corpus.actions, 0);
  assert.equal(admission.corpus.levelJumps, 0);
  assert.deepEqual(admission.corpus.excludedGames, ['CWSE', 'SK48']);
  assert.equal(admission.cases.length, 98);
  for (const item of admission.cases as R[]) {
    assert.ok(!admission.corpus.excludedGames.includes(item.game));
    const rows = corpus.games.find((entry: R) => entry.game === item.game).packet.frame_rows;
    assert.equal(hash(JSON.stringify(rows)), item.rowsSha256, item.game);
    const scene = measureReceptionService(rows);
    assert.deepEqual(scene, item.scene, item.game);
    assert.deepEqual(scene ? receptionServiceCarriers(rows, scene) : [], item.carriers, item.game);
  }
});

for (const item of fixture.cases.filter((value: R) => operations.has(value.operation)) as R[]) {
  test('original reception projection ' + item.id, () => {
    const a = clone(item.arguments);
    let actual: unknown;
    switch (item.operation) {
      case 'scene': actual = measureReceptionService(a.rows, a.retained ?? null); break;
      case 'sides': actual = receptionServiceSides(a.rows, a.box, a.color); break;
      case 'carriers': actual = receptionServiceCarriers(a.rows, a.scene); break;
      case 'path': actual = receptionServicePath(a.rows, a.scene, a.start, a.target, a.moves, a.remaining); break;
      default: throw new Error('Unknown reception projection operation: ' + item.operation);
    }
    assert.deepEqual(actual, item.expected, item.id);
    assert.deepEqual(a, item.arguments, 'source component inputs remain unchanged');
  });
}

test('palette permutation keeps measured geometric relations without fixed color meanings', () => {
  const rows = clone(fixture.rasters.base), first = measureReceptionService(rows)!;
  const remap = (color: number): number => (color + 7) % 16;
  const permuted = rows.map((row: number[]) => row.map(remap)), second = measureReceptionService(permuted)!;
  assert.ok(first); assert.ok(second);
  for (const key of ['box', 'pitch', 'cells']) assert.deepEqual(second[key], first[key], key);
  for (const key of ['bbox', 'anchor', 'mask']) assert.deepEqual(second.target[key], first.target[key], key);
  assert.equal(second.background, remap(first.background));
  assert.equal(second.target.color, remap(first.target.color));
  assert.deepEqual(second.counterparts, first.counterparts);
  assert.deepEqual(receptionServiceCarriers(permuted, second), receptionServiceCarriers(rows, first)
    .map(carrier => ({ ...carrier, color: remap(carrier.color) })));
  assert.notEqual(second.layout, first.layout);
});

test('measured and retained projections are detached from inputs and earlier results', () => {
  const rows = clone(fixture.rasters.base), untouched = clone(rows), first = measureReceptionService(rows)!;
  const retained = clone(first), second = measureReceptionService(rows, retained)!;
  second.cells[0][0] = -999; second.target.anchor[0] = -999; second.target.mask[0][0] = -999;
  second.counterparts[0].body_bbox[0] = -999;
  assert.deepEqual(rows, untouched); assert.deepEqual(retained, first);
  assert.deepEqual(measureReceptionService(rows), first);
});

test('path uses opaque observed commands, avoids other supports, and never truncates a budget failure', () => {
  const rows = clone(fixture.rasters.base), scene = measureReceptionService(rows)!, carrier = receptionServiceCarriers(rows, scene)[0]!;
  const moves = { 'opaque:alpha': [scene.pitch, 0], 'opaque:beta': [-scene.pitch, 0],
    'opaque:gamma': [0, scene.pitch], 'opaque:delta': [0, -scene.pitch] };
  const untouched = clone({ rows, scene, moves }), plan = receptionServicePath(rows, scene, carrier.anchor, scene.target.anchor, moves, 128)!;
  assert.ok(plan.length > 1);
  assert.deepEqual(plan[0]!.from, carrier.anchor);
  assert.deepEqual(plan.at(-1)!.to, scene.target.anchor);
  for (let i = 0; i < plan.length; i++) {
    assert.ok(Object.hasOwn(moves, plan[i]!.action_ref));
    if (i) assert.deepEqual(plan[i - 1]!.to, plan[i]!.from);
    assert.ok(scene.support_candidates.every((support: R) => JSON.stringify(support.anchor) === JSON.stringify(scene.target.anchor)
      || JSON.stringify(support.anchor) !== JSON.stringify(plan[i]!.to)));
  }
  assert.equal(receptionServicePath(rows, scene, carrier.anchor, scene.target.anchor, moves, plan.length - 1), null);
  plan[0]!.from[0] = -999; plan[0]!.to[0] = -999;
  assert.deepEqual({ rows, scene, moves }, untouched);
});

test('carrier requires four equal corners, distinct edge interiors, and a non-background color', () => {
  const rows = clone(fixture.rasters.base), scene = measureReceptionService(rows)!, actor = receptionServiceCarriers(rows, scene)[0]!;
  assert.ok(actor);
  const [x, y] = actor.anchor, cornerChanged = clone(rows), edgeChanged = clone(rows), backgroundChanged = clone(rows);
  cornerChanged[y][x] = scene.background;
  edgeChanged[y][x + 1] = actor.color;
  for (const [dx, dy] of [[0, 0], [scene.pitch - 1, 0], [0, scene.pitch - 1], [scene.pitch - 1, scene.pitch - 1]]) {
    backgroundChanged[y + dy][x + dx] = scene.background;
  }
  for (const changed of [cornerChanged, edgeChanged, backgroundChanged]) {
    assert.ok(!receptionServiceCarriers(changed, scene).some(carrier => JSON.stringify(carrier.anchor) === JSON.stringify(actor.anchor)));
  }
});
