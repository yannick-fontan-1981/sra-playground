import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { alternatingDescription, alternatingHistogram, alternatingOverlays, measureAlternatingGraph } from '../src/logos-engine/v6-alternating-graph-observation.ts';
import { alternatingTopology, instrumentalAlternatingContact } from '../src/logos-engine/v6-alternating-graph-questions.ts';
import type { AlternatingTopology } from '../src/logos-engine/v6-alternating-graph-questions.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(await readFile(
  new URL('./fixtures/v6-alternating-graph-measurement-reference.json.gz', import.meta.url),
)).toString('utf8'));
const rc = (key: string): number[] => key.split(',').map(Number);
const order = (a: number[], b: number[]): number => a[0]! - b[0]! || a[1]! - b[1]!;

function normalizedGraph(graph: AlternatingTopology | null): R | null {
  if (!graph) return null;
  const nodes = [...graph.nodes].map(rc).sort(order);
  return { ...graph, nodes, edges: nodes.map(node => ({ node, neighbors: [...graph.edges.get(node.join(','))!].map(rc).sort(order) })) };
}

function invoke(kind: string, rows: number[][], args: R): unknown {
  if (kind === 'description') return alternatingDescription(rows);
  if (kind === 'histogram') return alternatingHistogram(rows, args.box);
  if (kind === 'overlays') return alternatingOverlays(rows);
  if (kind === 'measure') return measureAlternatingGraph(rows, args.observation, args.actor, args.controls, args.evidence, args.lastAction, args.markerPrecaution);
  if (kind === 'topology') return normalizedGraph(alternatingTopology(rows, args.actor, args.calibration));
  if (kind === 'contact') return instrumentalAlternatingContact(rows, args.actor, args.controls, args.calibration, args.removals, args.remaining);
  throw new Error('Unknown fixture kind: ' + kind);
}

test('alternating primitive oracle binds unchanged Python and qualifies the consumed sprite projection', async () => {
  assert.equal(fixture.provenance.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.match(fixture.provenance.sourceMethod, /Direct calls to unchanged/);
  assert.match(fixture.provenance.sourceMethod, /no source rewriting, mocked measurement or supplied route/);
  assert.match(fixture.provenance.qualification, /not unconsumed grids, holes, memberships/);
  assert.match(fixture.provenance.qualification, /not solved-game evidence/);
  for (const [path, expected] of Object.entries(fixture.provenance.sources)) {
    const bytes = await readFile(new URL('../reference/v6/' + fixture.provenance.commit + '/source/' + path, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, path);
  }
  for (const source of fixture.publicRasters) {
    const rows = fixture.scenes[source.scene] as number[][];
    assert.equal(createHash('sha256').update(Uint8Array.from(rows.flat())).digest('hex'), source.frameSha256);
  }
});

for (const item of fixture.cases) test('original alternating ' + item.kind + ': ' + item.id, () => {
  const args = structuredClone(item.arguments), rows = structuredClone(fixture.scenes[args.scene]);
  const original = structuredClone([rows, args]);
  if (item.error) {
    assert.equal(item.error.kind, 'IndexError');
    assert.throws(() => invoke(item.kind, rows, args), /list index out of range/);
  } else {
    assert.deepEqual(invoke(item.kind, rows, args), item.expected);
  }
  assert.deepEqual([rows, args], original, 'public raster, calibration and prior evidence are inputs, not scratch storage');
});

const entry = (id: string): R => {
  const result = fixture.cases.find((item: R) => item.id === id);
  assert.ok(result, id);
  return result;
};

test('the unchanged source saturates the original route depth, expansion and description bounds', () => {
  const atDepth = entry('source_maximum_route_depth_40');
  assert.equal(atDepth.expected.alternating_material_first_shortest_edge_count, 40);
  const beyondDepth = entry('source_maximum_route_depth_41');
  assert.equal(beyondDepth.expected.unique_alternating_material_graph_description_present, false);
  assert.equal(beyondDepth.sourceSearch[0].depthBound, 40);
  assert.equal(beyondDepth.sourceSearch[0].greatestDepth, 40);
  const expansion = entry('source_512_expansion_bound');
  assert.equal(expansion.expected.unique_alternating_material_graph_description_present, false);
  assert.equal(expansion.sourceSearch[0].expanded, 512);
  assert.equal(expansion.sourceSearch[0].expansionBound, 512);
  const description = entry('independent_description_count_4');
  assert.equal(description.expected.alternating_material_graph_description_count, 4);
  assert.equal(description.expected.alternating_material_graph_description_bound_reached, true);
  assert.equal(description.expected.unique_alternating_material_graph_description_present, false);
  const witnesses = entry('target_count_4');
  assert.equal(witnesses.expected.alternating_material_route_witness_count, 3);
  assert.equal(witnesses.expected.alternating_material_route_witness_bound_reached, true);
  assert.deepEqual(witnesses.expected.alternating_material_first_shortest_action_refs, []);
});

test('instrumental contact returns only its prefix and retains the conditional scope', () => {
  const item = entry('instrumental_contact_remaining_40');
  const result = invoke(item.kind, fixture.scenes[item.arguments.scene], item.arguments) as R;
  assert.equal(result.counterfactual_complete_length, 4);
  assert.ok(result.prefix.length < result.counterfactual_complete_length);
  assert.ok(result.prefix.slice(0, -1).every((step: R) => step.contact_index === null));
  assert.equal(result.prefix.at(-1).contact_index, 0);
  assert.match(result.scope, /transfer of side\/rear applicability is a hypothesis/);
  assert.match(result.scope, /Prefix ends at first contact/);
  assert.equal(result.examined, item.sourceSearch[0].examined);
  const large = entry('removed_guard_index_33_is_not_a_32_bit_mask');
  assert.equal(large.expected.prefix.at(-1).contact_index, 33);
  assert.equal(large.sourceSearch[0].greatestRemovedBitLength, 34);
  const bound = entry('conditional_search_keeps_512_examined_bound');
  assert.equal(bound.expected, null);
  assert.equal(bound.sourceSearch[0].examined, 512);
});

test('description reuse is content-bound, immutable and limited to eight frames', () => {
  const item = entry('all_consumed_component_and_sprite_fields');
  const rows = structuredClone(fixture.scenes[item.arguments.scene]);
  const first = alternatingDescription(rows);
  assert.equal(alternatingDescription(structuredClone(rows)), first, 'equal content shares the fixed-size cached projection');
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.sprites[0]!.pattern[0]));
  assert.throws(() => { (first.sprites[0]!.pattern[0] as number[])[0] = 199; }, TypeError);
  assert.deepEqual(first, item.expected);
  for (let value = 0; value < 8; value++) alternatingDescription(Array.from({ length: 8 }, () => Array<number>(8).fill(value)));
  const afterEviction = alternatingDescription(rows);
  assert.notEqual(afterEviction, first, 'eight distinct intervening contents evict the old projection');
  assert.deepEqual(afterEviction, first);
  rows[2][2] = 9;
  assert.notEqual(alternatingDescription(rows), afterEviction, 'edits in the same caller-owned array invalidate the measurement');
  assert.deepEqual(alternatingOverlays(rows), []);
});

test('overlay, graph and measure result edits cannot poison later decisions', () => {
  const item = entry('unique_grid_canonical_rc_route'), args = item.arguments, rows = fixture.scenes[args.scene];
  const overlays = alternatingOverlays(rows);
  overlays[0]!.histogram[0]![1] = 999;
  (overlays[0]!.bbox as number[])[0] = 999;
  assert.notEqual(alternatingOverlays(rows)[0]!.bbox[0], 999);
  const measured = invoke(item.kind, rows, args) as R;
  measured.alternating_material_first_shortest_action_refs[0] = 'EDITED';
  measured.alternating_material_connector_values.push(199);
  assert.deepEqual(invoke(item.kind, rows, args), item.expected);
  const graphItem = entry('one_cardinal_guard');
  const graph = alternatingTopology(fixture.scenes[graphItem.arguments.scene], graphItem.arguments.actor, graphItem.arguments.calibration)!;
  graph.nodes.clear(); graph.edges.clear(); graph.guards[0]!.histogram[0]![1] = 999;
  assert.deepEqual(invoke(graphItem.kind, fixture.scenes[graphItem.arguments.scene], graphItem.arguments), graphItem.expected);
});
