import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { measureOutlineRejoinAndCapture } from '../src/logos-engine/v6-outline-rejoin.ts';

// Expected results come from the unchanged original Python helper. The
// controlled cases vary visible morphology, direction vocabulary, ambiguity
// and input binding; retained public cases establish component parity only.
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-outline-rejoin-reference.json.gz', import.meta.url))).toString('utf8'));

test('outline rejoin expectations retain unchanged pinned V5 provenance', () => {
  assert.equal(fixture.schema, 'logos-engine.v5.outline-rejoin-reference.v1');
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.function, '_adjacent_unmarked_compact_body_capture');
  assert.equal(fixture.sourceUnchanged, true);
  const source = readFileSync(new URL('../' + fixture.source.path, import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'), fixture.source.sha256);
  assert.ok(fixture.cases.some(row => row.domain === 'retained_public_component_contract'));
  assert.ok(fixture.cases.some(row => row.value?.[1]?.body_perimeter_marker_rejoin_count === 1));
  assert.ok(fixture.cases.some(row => row.value?.[1]?.body_perimeter_marker_rejoin_route_bound_reached === true));
  assert.ok(fixture.cases.some(row => row.value?.[1]?.adjacent_unmarked_compact_body_route_bound_reached === true));
});

for (const row of fixture.cases) test(`outline exact V5 rejoin and capture ${row.id}`, async () => {
  const retained = structuredClone({ rows: row.rows, fields: row.fields });
  const run = () => measureOutlineRejoinAndCapture(row.rows, row.fields);
  if (row.error) await assert.rejects(run);
  else assert.deepEqual(await run(), row.value);
  assert.deepEqual({ rows: row.rows, fields: row.fields }, retained);
});
