import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import * as routing from '../src/logos-engine/v6-inventory-routing.ts';
import * as dependencies from '../src/logos-engine/v6-inventory-dependencies.ts';
import * as endpoints from '../src/logos-engine/v6-inventory-endpoints.ts';
import * as boundary from '../src/logos-engine/v6-inventory-boundary.ts';
import * as continuation from '../src/logos-engine/v6-inventory-continuation.ts';
import * as localContact from '../src/logos-engine/v6-inventory-local-contact.ts';
import * as contextIntervention from '../src/logos-engine/v6-inventory-context-intervention.ts';

// Expected results, including the complete mutated argument graph, are executed
// by unchanged pinned Python. These synthetic public rasters do not attest a
// game success, complete family parity, or arbitrary Python nominal/coercion
// semantics. Map/Set wrappers adapt only the declared native collection API.
type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-inventory-helpers-reference.json.gz', import.meta.url))).toString());
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const coordinateMap = (pairs: any[][] | null | undefined): Map<string, R> | null =>
  pairs == null ? null : new Map(pairs.map(([bbox, item]) => [bbox.join(','), item]));
const nativeBox = (b: R): R => ({ ...b, width: b.right - b.left + 1, height: b.bottom - b.top + 1 });
function nativeProbe(raw: R | null): R | null {
  if (raw === null) return null;
  // Pydantic's serialized FrameGrid and computed BoundingBox properties map
  // to the plain matrix and measured boxes used by native CellProjection.
  // The original components, cell measurements and values are preserved.
  const probe = structuredClone(raw); probe.frame = probe.frame.rows;
  probe.components.components = probe.components.components.map((c: R) => ({ ...c, bbox: nativeBox(c.bbox) }));
  for (const name of ['canonical_provisional_control_geometry_bboxes', 'input_aligned_entity_bboxes', 'visited_input_aligned_entity_bboxes'])
    probe[name] = probe[name].map(nativeBox);
  probe.periodic_cell_grids.candidates = probe.periodic_cell_grids.candidates.map((g: R) => ({ ...g, cells: g.cells.map((c: R) => ({ ...c, bbox: nativeBox(c.bbox) })) }));
  return probe;
}

function execute(operation: string, arguments_: R): { value: unknown; after: R } {
  const a = structuredClone(arguments_); let value: unknown;
  switch (operation) {
    case 'routing.measured_paths':
      value = routing.measured_paths(a.facts, a.rows, a.target_cells, a.interface_hypotheses, new Set(a.available), a.maximum, a.conditional_cells); break;
    case 'dependencies.measured_dependencies':
      value = dependencies.measured_dependencies(a.scene, a.rows, a.world_pairs, a.display_pairs, a.interfaces, new Set(a.available)); break;
    case 'dependencies.frontier_target':
      value = dependencies.frontier_target(a.scene, a.dependency, a.held); break;
    case 'dependencies.recalled_gain_targets':
      value = dependencies.recalled_gain_targets(a.scene, a.obs, a.collection === null ? null : {
        evidence_for: signature => structuredClone(a.collection[String(signature)] ?? { confirmed: [], counterexamples: [] }),
      }, a.dependency); break;
    case 'boundary.patch': value = boundary.patch(a.rows, a.box); break;
    case 'boundary.capture': value = boundary.capture(a.before, a.after, a.first, a.second, a.held, a.returns, a.core); break;
    case 'boundary.revalidate': value = boundary.revalidate(a.memory, a.obs, a.rows, a.methods); break;
    case 'boundary.complements': value = boundary.complements(a.scene, a.rows, a.held); break;
    case 'boundary.current_goal_witnesses': value = boundary.current_goal_witnesses(a.scene, a.rows, a.models); break;
    case 'continuation.access_measurements':
      value = continuation.access_measurements(a.proposal, a.index, a.before, a.after, a.first, a.second); break;
    case 'continuation.capacity_targets': value = continuation.capacity_targets(a.scene, a.obs, a.forecast, a.returned); break;
    case 'endpoints.retained_method_targets':
      value = endpoints.retained_method_targets(a.scene, a.obs, a.rows, a.memories, a.methods, a.returned); break;
    case 'endpoints.endpoint_measurements':
      value = endpoints.endpoint_measurements(a.scene, nativeProbe(a.probe), a.obs, a.rows, a.forecast, a.returned, coordinateMap(a.visited)!, a.interfaces); break;
    case 'local_contact.reconcile':
      value = localContact.reconcile(a.memories, a.methods, a.proposal, a.index, a.before, a.after, a.first, a.second, a.outcome, coordinateMap(a.underlays)); break;
    case 'local_contact.targets': value = localContact.targets(a.scene, a.obs, a.rows, a.memories, a.methods, a.prior); break;
    case 'local_contact.departure_support': value = localContact.departure_support(a.scene, a.obs, a.rows, a.memories, a.equivalence); break;
    case 'local_contact.equivalent_current_contact_offers':
      value = localContact.equivalent_current_contact_offers(a.options, a.declaration, contextIntervention.digest); break;
    case 'context_intervention.record':
      value = contextIntervention.record(a.methods, a.proposal, a.index, a.before, a.after, a.first, a.second, a.maximum_regions); break;
    case 'context_intervention.targets':
      value = contextIntervention.targets(a.scene, a.obs, a.rows, a.memories, a.methods, a.ordinary_targets); break;
    case 'context_intervention.decorate': value = contextIntervention.decorate(a.proposal, a.obs); break;
    case 'context_intervention.unchanged_visible_context': value = contextIntervention.unchanged_visible_context(a.attempt, a.rows, a.body); break;
    default: assert.fail(`Unregistered original helper operation ${operation}`);
  }
  return { value: value === undefined ? null : value, after: a };
}

test('inventory helper fixture executes the unchanged verified source with explicit ownership', () => {
  assert.equal(fixture.schema, 'logos-engine.v6.inventory-helpers-reference.v1');
  assert.equal(fixture.referenceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.verifiedSourceFilesBefore, 1786);
  assert.equal(fixture.verifiedSourceFilesAfter, 1786);
  assert.equal(Object.keys(fixture.sourceHashes).length, 1786);
  const prefix = '../reference/v6/' + fixture.referenceCommit + '/source/';
  for (const [path, expected] of Object.entries(fixture.sourceHashes))
    assert.equal(hash(readFileSync(new URL(prefix + path, import.meta.url))), expected, path);
  assert.equal(hash(readFileSync(new URL('../' + fixture.generator.path, import.meta.url))), fixture.generator.sha256);
  assert.deepEqual(fixture.ownedSourceModules.map((s: string) => s.split('/').at(-1)).sort(),
    ['boundary.py', 'context_intervention.py', 'continuation.py', 'dependencies.py', 'endpoints.py', 'local_contact.py', 'routing.py']);
  for (const path of fixture.ownedSourceModules) {
    const bytes = readFileSync(new URL(prefix + path, import.meta.url));
    assert.equal(fixture.ownedSourceBytes[path].bytes, bytes.length);
    assert.equal(fixture.ownedSourceBytes[path].sha256, fixture.sourceHashes[path]);
    assert.equal(fixture.sourceFootprint.importedSourceFiles[path], fixture.sourceHashes[path]);
    assert.ok(fixture.sourceFootprint.executedSourceFunctions.some((f: R) => f.path === path && f.calls > 0), path);
  }
  assert.equal(new Set(fixture.cases.map((c: R) => c.id)).size, fixture.cases.length);
  assert.equal(Object.values(fixture.operationCounts).reduce((a: number, b: any) => a + b, 0), fixture.cases.length);
});

for (const row of fixture.cases) test(`inventory helper original ${row.id}`, () => {
  assert.deepEqual(execute(row.operation, row.arguments), { value: row.value, after: row.after });
});
