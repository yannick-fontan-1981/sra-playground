import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureRootedLine, physicalRootedLine, rootedLineMask, rootedLineConfiguration,
  projectedRootedLine } from '../src/logos-engine/v6-rooted-line-observation.ts';
import { rootedLineEffect, rootedLineModel, planRootedLine } from '../src/logos-engine/v6-rooted-line-mechanics.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const file = (path: string): Buffer => readFileSync(new URL(path, root));
const fixture: R = JSON.parse(gunzipSync(file('tests/fixtures/v6-rooted-line-reference.json.gz')).toString());
const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
const observationOperations = new Set(['scene', 'physical', 'configuration', 'projected', 'effect', 'model', 'plan']);

test('rooted contracts pin the unchanged source and qualify synthetic returns separately from game results', () => {
  assert.equal(fixture.schema, 'logos-engine.v6.rooted-line-source-reference.v1');
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.originalFilesVerifiedBefore, 1786);
  assert.equal(fixture.originalFilesVerifiedAfter, 1786);
  assert.match(fixture.qualification, /Synthetic public-raster component contracts/);
  assert.match(fixture.qualification, /Own-layer closure only/);
  const prefix = 'reference/v6/' + fixture.sourceCommit + '/';
  const manifest = JSON.parse(file(prefix + 'manifest.json').toString());
  assert.equal(Object.keys(manifest.files).length, 1786);
  for (const [path, descriptor] of Object.entries(manifest.files) as [string, R][]) {
    assert.equal(hash(file(prefix + 'source/' + path)), descriptor.sha256, path);
  }
  for (const [path, digest] of Object.entries(fixture.sourceFiles)) {
    assert.equal(manifest.files[path].sha256, digest, path);
  }
});

test('99 untouched public initial rasters preserve source admission while excluding the deferred game', () => {
  const raw = file(fixture.publicCorpus.path);
  assert.equal(hash(raw), fixture.publicCorpus.sha256);
  assert.equal(fixture.publicCorpus.actions, 0);
  assert.equal(fixture.publicCorpus.levelJumps, 0);
  assert.deepEqual(fixture.publicCorpus.excludedGames, ['CWSE']);
  const corpus = JSON.parse(gunzipSync(raw).toString());
  assert.equal(fixture.publicProjection.length, 99);
  assert.ok(fixture.publicProjection.every((item: R) => item.game !== 'CWSE'));
  for (const item of fixture.publicProjection as R[]) {
    const entry = corpus.games.find((value: R) => value.game === item.game);
    assert.ok(entry, item.game);
    const rows = entry.packet.frame_rows;
    assert.equal(hash(JSON.stringify(rows)), item.rowsSha256, item.game);
    assert.deepEqual(measureRootedLine(rows), item.expected, item.game);
  }
});

for (const item of fixture.cases.filter((value: R) => observationOperations.has(value.operation)) as R[]) {
  test('original rooted-line observation and mechanics ' + item.id, () => {
    const a = clone(item.arguments);
    let actual: unknown;
    switch (item.operation) {
      case 'scene': actual = measureRootedLine(a.rows); break;
      case 'physical': actual = physicalRootedLine(a.scene); break;
      case 'configuration': actual = rootedLineConfiguration(a.scene, a.ref, a.epoch); break;
      case 'projected': actual = projectedRootedLine(a.configuration); break;
      case 'effect': actual = rootedLineEffect(a.action, a.before, a.after, a.refs); break;
      case 'model': actual = rootedLineModel(a.config); break;
      case 'plan': {
        const [configuration, result] = planRootedLine(a.scene, a.observation, a.effects, a.config, a.retained);
        actual = { configuration, result }; break;
      }
      default: throw new Error('Unknown rooted-line observation operation: ' + item.operation);
    }
    assert.deepEqual(actual, item.expected, item.id);
    assert.deepEqual(a, item.arguments, 'component contracts do not mutate inputs');
  });
}

test('rooted mask uses inclusive row-major V5 coordinates', () => {
  assert.deepEqual(rootedLineMask([4, 2, 5, 3]), [[2, 4], [2, 5], [3, 4], [3, 5]]);
  assert.deepEqual(rootedLineMask([5, 3, 4, 2]), []);
});

test('observed overlap supplies a possible support pair without acquiring physical possession', () => {
  const scene = measureRootedLine(fixture.rasters.base)!;
  scene.pieces[0].bbox = [9, scene.line_rows[0], 12, scene.line_rows[0] + 3];
  const configuration = rootedLineConfiguration(scene, 'current:overlap', 7);
  assert.deepEqual(configuration.possible_support_pairs, [['current_rod', 'material:2']]);
  assert.deepEqual(configuration.pieces[0].support_refs, []);
  assert.equal(configuration.domain_boundary_is_known, false);
  assert.deepEqual(configuration.scope, { level_epoch: 7 });
  assert.deepEqual(configuration.provenance, ['current:overlap']);
  assert.deepEqual(configuration.root_footprints[0][1][0], [scene.root[1], scene.root[0]]);
  assert.deepEqual(configuration.rods[0].root_to_tip_positions[0], [scene.line_rows[0], scene.start]);
  assert.deepEqual(projectedRootedLine(configuration), physicalRootedLine(scene));
});

test('palette permutation preserves measured geometry without assigning meaning to a fixed color', () => {
  const rows = clone(fixture.rasters.base), first = measureRootedLine(rows)!;
  const remap = (color: number): number => (color + 5) % 16;
  const second = measureRootedLine(rows.map((row: number[]) => row.map(remap)))!;
  assert.ok(second);
  for (const property of ['root', 'reference_root', 'field', 'line_rows', 'start', 'tip', 'unit']) {
    assert.deepEqual(second[property], first[property], property);
  }
  assert.equal(second.background, remap(first.background));
  assert.deepEqual(second.pieces.map((piece: R) => piece.bbox), first.pieces.map((piece: R) => piece.bbox));
  assert.deepEqual(second.order, first.order.map((color: string) => String(remap(Number(color)))));
  assert.notEqual(second.root_signature, first.root_signature);
  assert.notEqual(second.layout, first.layout);
});

test('axial extent stops at the first measured background gap', () => {
  const rows = clone(fixture.rasters.base), initial = measureRootedLine(rows)!;
  const gap = initial.start + 2;
  for (const y of initial.line_rows) rows[y][gap] = initial.background;
  const scene = measureRootedLine(rows)!;
  assert.ok(scene);
  assert.equal(scene.tip, gap - 1);
  assert.equal(scene.layout, initial.layout);
});

test('physical projection sorts identifiers lexically and detaches nested measured boxes', () => {
  const source = { root: [2, 8, 7, 13], tip: 12, pieces: [
    { id: 'material:2', bbox: [20, 10, 23, 13] }, { id: 'material:10', bbox: [30, 20, 33, 23] },
  ] };
  const projected = physicalRootedLine(source);
  assert.deepEqual(projected.pieces.map((piece: any[]) => piece[0]), ['material:10', 'material:2']);
  projected.root[0] = 99; projected.pieces[0][1][0] = 99;
  assert.equal(source.root[0], 2); assert.equal(source.pieces[1].bbox[0], 30);
  const rows = clone(fixture.rasters.base), untouched = clone(rows), scene = measureRootedLine(rows)!;
  scene.root[0] = 99; scene.pieces[0].bbox[0] = 99;
  assert.deepEqual(rows, untouched);
  assert.equal(measureRootedLine(rows)!.root[0], 2);
});

test('command labels remain opaque to effect measurement', () => {
  const scene = measureRootedLine(fixture.rasters.base)!;
  const moved = clone(scene); moved.root = scene.root.map((value: number, i: number) => value + (i % 2 ? 3 : 0));
  const extended = { ...clone(scene), tip: scene.tip + 4 };
  const sameLabelTranslation = rootedLineEffect('ACTION1', scene, moved, ['a', 'b'])!;
  const sameLabelExtension = rootedLineEffect('ACTION1', scene, extended, ['a', 'b'])!;
  const arbitraryLabel = rootedLineEffect('arbitrary:control', scene, moved, ['a', 'b'])!;
  assert.deepEqual(sameLabelTranslation.root_translation, [3, 0]);
  assert.equal(sameLabelTranslation.extent_delta, 0);
  assert.deepEqual(sameLabelExtension.root_translation, [0, 0]);
  assert.equal(sameLabelExtension.extent_delta, 4);
  assert.deepEqual(arbitraryLabel.root_translation, [3, 0]);
  assert.equal(arbitraryLabel.action_ref, 'arbitrary:control');
  assert.deepEqual(arbitraryLabel.evidence_refs, ['a', 'b']);
});
