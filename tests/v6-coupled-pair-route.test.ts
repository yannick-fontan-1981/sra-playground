import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { jointCoupledPairRoute } from '../src/logos-engine/v6-coupled-pair-route.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(await readFile(
  new URL('./fixtures/v6-coupled-pair-route-reference.json.gz', import.meta.url),
)).toString('utf8'));

const route = (rows: number[][], args: R) => jointCoupledPairRoute(
  rows, args.pair, args.controls, args.floorValues, args.signs, args.limit, args.evidence, args.excludeMixtures,
);

test('joint route oracle binds the unchanged V6 wrapper and its consumed V5 closure', async () => {
  assert.equal(fixture.provenance.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.match(fixture.provenance.sourceMethod, /unchanged joint_route/);
  assert.match(fixture.provenance.sourceMethod, /No source rewriting or mocked route/);
  assert.match(fixture.provenance.qualification, /not solved-game evidence/);
  for (const [path, expected] of Object.entries(fixture.provenance.sources)) {
    const bytes = await readFile(new URL(
      '../reference/v6/' + fixture.provenance.commit + '/source/' + path, import.meta.url,
    ));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, path);
  }
});

for (const item of fixture.cases) test('original joint route: ' + item.id, () => {
  const rows = structuredClone(fixture.scenes[item.arguments.scene]);
  const args = structuredClone(item.arguments), original = structuredClone([rows, args]);
  if (item.error) {
    assert.match(item.error.message, /known grid cell count exceeds hard bound/);
    assert.throws(() => route(rows, args), /known grid cell count exceeds hard bound/);
  } else {
    assert.deepEqual(route(rows, args), item.expected);
    if (item.expected) {
      assert.equal(item.sourceSearch.length, 1);
      assert.equal(item.expected.states, item.sourceSearch[0].states);
      assert.equal(item.expected.expanded, item.sourceSearch[0].expanded);
      assert.equal(item.expected.actions.length, item.expected.expected.length);
    }
  }
  assert.deepEqual([rows, args], original, 'route generation must not mutate public scenes, tracked identity, or controls');
});

test('source search limit counts expansions separately from visited states', () => {
  const item = fixture.cases.find((entry: R) => entry.id === 'search_expansion_budget_is_4096_not_the_visited_count');
  assert.equal(item.expected, null);
  assert.deepEqual(item.sourceSearch, [{ states: 4470, expanded: 4096, maxDepth: 40, stateBudget: 4096, routeLength: 0 }]);
  assert.equal(route(fixture.scenes[item.arguments.scene], item.arguments), null);
});

test('canonical long route retains exact first-shortest counters and member order', () => {
  const item = fixture.cases.find((entry: R) => entry.id === 'twenty_one_step_route_limit_40');
  const found = route(fixture.scenes[item.arguments.scene], item.arguments)!;
  assert.deepEqual(found.actions, Array(21).fill('ACTION4'));
  assert.equal(found.states, 323);
  assert.equal(found.expanded, 308);
  assert.equal(found.grid_ref, 'measured_motion_lattice:9de7b1b2e34fd7d3');
  assert.deepEqual(found.expected[0], [[4, 6, 5, 7], [4, 86, 5, 87]]);
  assert.deepEqual(found.expected.at(-1), [[4, 46, 5, 47], [4, 46, 5, 47]]);
});

test('route results own all boxes and recompute from changed public content', () => {
  const item = fixture.cases.find((entry: R) => entry.id === 'two_steps_on_uniform_known_floor');
  const rows = structuredClone(fixture.scenes[item.arguments.scene]), args = structuredClone(item.arguments);
  const found = route(rows, args)!;
  found.actions[0] = 'EDITED';
  (found.expected[0]![0] as number[])[0] = 999;
  found.expected.reverse();
  assert.deepEqual(route(rows, args), item.expected, 'caller edits cannot alter a later route');
  const [top, left] = args.pair.boxes[1];
  rows[top][left] = 9;
  assert.equal(route(rows, args), null, 'array identity cannot retain a previous pixel-pattern match');
  assert.notEqual(args.pair.boxes[0][0], 999);
});
