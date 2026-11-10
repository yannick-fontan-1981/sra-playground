import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureReferencePopulation, referencePopulationCellKey, referencePopulationInputs,
  referencePopulationLocalRelations, referencePopulationPaths, referencePopulationPoint } from '../src/logos-engine/v6-reference-population-observation.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const file = (path: string): Buffer => readFileSync(new URL(path, root));
const fixture: R = JSON.parse(gunzipSync(file('tests/fixtures/v6-reference-population-reference.json.gz')).toString());
const admission: R = JSON.parse(file('docs/migration/lot3f-evidence/diagnostic/reference-population-public-admission.json').toString());
const hash = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
const clone = <T>(value: T): T => structuredClone(value);
const orderCell = (a: readonly number[], b: readonly number[]): number => a[0]! - b[0]! || a[1]! - b[1]!;
const operations = new Set(['scene', 'point', 'inputs', 'paths', 'local_relations']);

test('reference-population projection fixtures pin all original files and the zero-action public corpus', () => {
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.originalFilesVerifiedBefore, 1786); assert.equal(fixture.originalFilesVerifiedAfter, 1786);
  const prefix = 'reference/v6/' + fixture.sourceCommit + '/', manifest = JSON.parse(file(prefix + 'manifest.json').toString());
  for (const [path, descriptor] of Object.entries(manifest.files) as [string, R][]) {
    assert.equal(hash(file(prefix + 'source/' + path)), descriptor.sha256, path);
  }
  for (const [path, digest] of Object.entries(fixture.sourceFiles)) assert.equal(manifest.files[path].sha256, digest, path);
  assert.equal(admission.sourceCommit, fixture.sourceCommit);
  assert.equal(admission.sourceSha256, manifest.files[admission.sourcePath].sha256);
  assert.equal(admission.originalFilesVerifiedBefore, 1786); assert.equal(admission.originalFilesVerifiedAfter, 1786);
  assert.equal(admission.corpus.actions, 0); assert.equal(admission.corpus.levelJumps, 0);
  assert.deepEqual(admission.corpus.excludedGames, ['CWSE', 'SK48', 'FOGW']);
});

test('97 retained initial public rasters reproduce original admission without new game actions', () => {
  const raw = file(admission.corpus.path), corpus = JSON.parse(gunzipSync(raw).toString());
  assert.equal(hash(raw), admission.corpus.sha256); assert.equal(admission.cases.length, 97);
  for (const item of admission.cases as R[]) {
    assert.ok(!admission.corpus.excludedGames.includes(item.game));
    const rows = corpus.games.find((entry: R) => entry.game === item.game).packet.frame_rows;
    assert.equal(hash(JSON.stringify(rows)), item.rowsSha256, item.game);
    assert.deepEqual(measureReferencePopulation(rows), item.scene, item.game);
  }
});

for (const item of fixture.cases.filter((value: R) => operations.has(value.operation)) as R[]) {
  test('original reference-population projection ' + item.id, () => {
    const a = clone(item.arguments); let actual: unknown;
    switch (item.operation) {
      case 'scene': actual = measureReferencePopulation(a.rows, a.retained ?? null); break;
      case 'point': actual = referencePopulationPoint(a.scene, a.cell); break;
      case 'inputs': actual = referencePopulationInputs(a.rows, a.available); break;
      case 'local_relations': actual = referencePopulationLocalRelations(a.scene); break;
      case 'paths': actual = [...referencePopulationPaths(a.start, a.floor, a.occupied, a.controls)]
        .map(([key, value]) => [JSON.parse(key), value]).sort((a, b) => orderCell(a[0], b[0])); break;
      default: throw new Error('Unexpected projection operation');
    }
    assert.deepEqual(actual, item.expected, item.id);
    assert.deepEqual(a, item.arguments, 'projection inputs remain unchanged');
  });
}

for (const item of fixture.sourceExceptions.filter((value: R) => value.operation === 'scene') as R[]) {
  test('short retained raster is refused with explicit native exception class ' + item.id, () => {
    assert.equal(item.expectedError.type, 'IndexError');
    assert.throws(() => measureReferencePopulation(item.arguments.rows, item.arguments.retained), RangeError,
      'native RangeError corresponds to the retained original invalid-raster exception; exception-class identity is not claimed');
  });
}

test('palette permutation preserves measured geometry and remaps observed appearances without fixed roles', () => {
  const rows = clone(fixture.rasters.base), first = measureReferencePopulation(rows)!;
  const recolor = (value: number): number => (value + 17) % 256;
  const second = measureReferencePopulation(rows.map((row: number[]) => row.map(recolor)))!;
  assert.ok(first); assert.ok(second);
  for (const name of ['q', 'offset', 'floor', 'zone_box', 'reference_box', 'population']) assert.deepEqual(second[name], first[name], name);
  for (const name of ['background', 'empty', 'border']) assert.equal(second[name], recolor(first[name]), name);
  assert.deepEqual(second.target, first.target.map(([y, x, appearance]: number[]) => [y, x, recolor(appearance!)]));
  assert.deepEqual(second.bodies, first.bodies.map((body: R) => ({ ...body, appearance: recolor(body.appearance) })));
  assert.notEqual(second.reference_digest, first.reference_digest);
});

test('fresh and retained projections detach all mutable measured and inherited fields', () => {
  const rows = clone(fixture.rasters.base), unchangedRows = clone(rows), first = measureReferencePopulation(rows)!;
  const retained = clone(first), before = clone(retained), second = measureReferencePopulation(rows, retained)!;
  assert.ok(second); second.floor[0][0] = -999; second.target[0][0] = -999;
  second.bodies[0].cell[0] = -999; second.reference_box[0] = -999;
  assert.deepEqual(retained, before); assert.deepEqual(rows, unchangedRows);
  assert.deepEqual(measureReferencePopulation(rows), first);
});

test('retained occupancy records an appearance change without inventing its color rule', () => {
  const rows = clone(fixture.rasters.base), first = measureReferencePopulation(rows)!;
  const body = first.bodies[0], [oy, ox] = first.offset, [y, x] = body.cell;
  const changedAppearance = Array.from({ length: 256 }, (_, i) => i)
    .find(value => ![first.background, first.empty, first.border, body.appearance].includes(value))!;
  const changed = clone(rows);
  for (let dy = 0; dy < first.q - 1; dy++) for (let dx = 0; dx < first.q - 1; dx++) {
    changed[oy + y * first.q + dy][ox + x * first.q + dx] = changedAppearance;
  }
  const next = measureReferencePopulation(changed, first)!;
  assert.ok(next); assert.deepEqual(next.bodies.map((item: R) => item.cell), first.bodies.map((item: R) => item.cell));
  assert.equal(next.bodies[0].appearance, changedAppearance);
  assert.deepEqual(referencePopulationLocalRelations(next).map(({ appearance, ...relation }) => relation),
    referencePopulationLocalRelations(first).map(({ appearance, ...relation }) => relation));
});

test('measured path cannot cross another current member and carries only supplied opaque commands', () => {
  const floor = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], occupied = [[0, 0], [0, 2]];
  const controls = { 'opaque:alpha': { delta: [0, 1] }, 'opaque:beta': { delta: [1, 0] },
    'opaque:gamma': { delta: [0, -1] }, 'opaque:delta': { delta: [-1, 0] } };
  const untouched = clone({ floor, occupied, controls });
  const found = referencePopulationPaths([0, 0], floor, occupied, controls);
  assert.ok(!found.has(referencePopulationCellKey([0, 2])));
  const [commands, path] = found.get(referencePopulationCellKey([1, 2]))!;
  assert.equal(commands.length, 3); assert.equal(path.length, 4);
  assert.ok(commands.every(command => Object.hasOwn(controls, command.action_ref)));
  assert.deepEqual(path[0], [0, 0]); assert.deepEqual(path.at(-1), [1, 2]);
  path[0]![0] = -999;
  assert.deepEqual({ floor, occupied, controls }, untouched);
  const sentinel = new Error('native population work bound');
  assert.throws(() => referencePopulationPaths([0, 0], floor, occupied, controls, () => { throw sentinel; }), error => error === sentinel);
});
