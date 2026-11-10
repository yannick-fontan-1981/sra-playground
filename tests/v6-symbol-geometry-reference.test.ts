import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { ConcentricFrame, measureConcentricFrames, measureConcentricContext,
  measureConcentricCandidate } from '../src/logos-engine/v5-concentric-frames.ts';
import * as diagrams from '../src/logos-engine/v5-symbolic-diagrams.ts';
import { frame, perimeterEntities, project } from '../src/logos-engine/v6-symbol-transactions-geometry.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-symbol-geometry-reference.json.gz', import.meta.url))).toString());
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
function plain(value: any): any {
  if (value instanceof ConcentricFrame) return { ...value, inner_refs: [...value.inner_refs], center: [...value.center], identity: [...value.identity] };
  if (Array.isArray(value)) return value.map(plain);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, plain(child)]));
  return value;
}
function execute(operation: string, a: R): unknown {
  const scene = a.scene ? fixture.scenes[a.scene] : null;
  const current = scene ? frame(scene.rows) : null;
  const candidate = { point: a.point ?? null };
  switch (operation) {
    case 'frame': return current;
    case 'components': return diagrams.diagramComponents(current!);
    case 'shape_predicates': return diagrams.diagramComponents(current!).map(c => ({ component_ref: c.component_id,
      rectangular_perimeter: diagrams.rectangularPerimeter(c), solid_square: diagrams.solidSquare(c),
      three_branch_to_left: diagrams.threeBranchToLeft(c) }));
    case 'concentric_frames': return measureConcentricFrames(current!);
    case 'concentric_context': return measureConcentricContext(measureConcentricFrames(current!), a.additions ?? [], a.white_value ?? 0, a.with_frame === false ? null : current);
    case 'concentric_candidate': return measureConcentricCandidate(measureConcentricFrames(current!), candidate, a.additions ?? [], a.white_value ?? 0, a.with_frame === false ? null : current);
    case 'diagram_rows': return diagrams.measureDiagramRows(current!);
    case 'equal_row_pairs': return diagrams.measureEqualRowPairs(current!);
    case 'diagram_context': return diagrams.measureDiagramContext(current!, a.transition_count ?? 0);
    case 'diagram_candidate': return diagrams.measureDiagramCandidate(current!, candidate, a.white_value ?? 0);
    case 'diagram_transition': return diagrams.measureDiagramTransition(frame(fixture.scenes[a.before].rows), frame(fixture.scenes[a.after].rows));
    case 'perimeter_entities': return perimeterEntities(a.observation ?? scene.observation, a.white_value ?? 0);
    case 'project': return project(a.observation ?? scene.observation, scene.rows, a.inputs, fixture.config, a.transition_count ?? 0);
    default: assert.fail('Unregistered source geometry operation ' + operation);
  }
}

test('symbol geometry oracle binds unchanged source and its executed footprint', () => {
  assert.equal(fixture.schema, 'logos-engine.v6.symbol-geometry-reference.v1');
  assert.equal(fixture.referenceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.verifiedSourceFilesBefore, fixture.verifiedSourceFilesAfter);
  assert.equal(fixture.verifiedSourceFilesBefore, Object.keys(fixture.sourceHashes).length);
  const prefix = '../reference/v6/' + fixture.referenceCommit + '/source/';
  for (const [path, expected] of Object.entries(fixture.sourceHashes))
    assert.equal(hash(readFileSync(new URL(prefix + path, import.meta.url))), expected, path);
  for (const record of [fixture.generator, fixture.sourceManifest]) {
    const bytes = readFileSync(new URL('../' + record.path, import.meta.url));
    assert.equal(bytes.length, record.bytes); assert.equal(hash(bytes), record.sha256);
  }
  assert.deepEqual(fixture.ownedSourceModules.map((s: string) => s.split('/').at(-1)).sort(),
    ['concentric_frames.py', 'geometry.py', 'symbolic_diagrams.py']);
  for (const path of fixture.ownedSourceModules) {
    const bytes = readFileSync(new URL(prefix + path, import.meta.url));
    assert.equal(bytes.length, fixture.ownedSourceBytes[path].bytes);
    assert.equal(hash(bytes), fixture.ownedSourceBytes[path].sha256);
    assert.equal(fixture.sourceFootprint.importedSourceFiles[path], fixture.sourceHashes[path]);
    assert.ok(fixture.sourceFootprint.executedSourceFunctions.some((entry: R) => entry.path === path && entry.calls > 0), path);
  }
  assert.equal(new Set(fixture.cases.map((row: R) => row.id)).size, fixture.cases.length);
  assert.equal(Object.values(fixture.operationCounts).reduce((sum: number, count: any) => sum + count, 0), fixture.cases.length);
});

for (const row of fixture.cases) test('symbol geometry original: ' + row.id, () => {
  const a = structuredClone(row.arguments), before = structuredClone(a);
  if (row.error) assert.throws(() => execute(row.operation, a), { name: row.error.name, message: row.error.message });
  else assert.deepEqual(plain(execute(row.operation, a)), row.expected);
  assert.equal(row.argumentsUnchanged, true);
  assert.deepEqual(a, before);
});

test('Python malformed and nominal-number boundaries are explicit, outside portable parity', () => {
  assert.match(fixture.portableInputDomain, /without parity claims/);
  for (const row of fixture.outsidePortableInputDomain) {
    const result = execute('project', structuredClone(row.arguments)) as R;
    if (row.id === 'nominal_integral_float') {
      assert.equal(row.sourceCoordinateTypes.x, 'float');
      assert.equal(row.sourceResult.options.length, 0);
      // JSON44.0 and JSON44 have one JavaScript numeric representation. The
      // native admitted integer-value domain consequently accepts this point.
      assert.equal(result.options.length, 1);
    } else {
      assert.equal(row.sourceError.name, 'TypeError');
      assert.equal(result.options.length, 0);
    }
  }
});

test('geometry caches retain immutable raster measurements, never mutable caller arrays', () => {
  const rows = structuredClone(fixture.scenes.guide_asymmetric.rows);
  const original = frame(rows), measured = measureConcentricFrames(original), saved = plain(measured);
  assert.ok(Object.isFrozen(original)); assert.ok(Object.isFrozen(original.rows));
  assert.ok(original.rows.every(row => Object.isFrozen(row)));
  assert.ok(Object.isFrozen(measured)); assert.ok(measured.every(item => Object.isFrozen(item)));
  rows[18][40] = 9;
  assert.equal(original.rows[18]![40], 0);
  assert.deepEqual(plain(measureConcentricFrames(original)), saved);
  assert.notDeepEqual(plain(measureConcentricFrames(frame(rows))), saved);
  assert.throws(() => (measured as ConcentricFrame[]).reverse(), TypeError);
  assert.deepEqual(plain(measureConcentricFrames(original)), saved);
});
