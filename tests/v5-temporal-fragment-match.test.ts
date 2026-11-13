import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureTemporalFragmentMatch, normalizeTemporalFragmentExactRequest,
  TEMPORAL_FRAGMENT_EXACT_OPERATION, TEMPORAL_FRAGMENT_NATIVE_INTERRUPTION } from '../src/logos-engine/v5-temporal-fragment-match.ts';

type R = Record<string, any>;
const fixture: R = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-framed-window-reference.json.gz', import.meta.url))).toString());
const clone = <T>(value: T): T => structuredClone(value);

function request(): R {
  return { scope: { request_ref: 'request', caller_ref: 'caller', parent_consumer_ref: 'consumer', parent_goal_ref: 'goal',
    parent_contribution_ref: 'contribution', caller_next_item_ref: 'next', epoch: 1, evidence_revision_ref: 'revision',
    model_revision_ref: 'model-revision', model_status_ref: 'hypothesis', event_owner_ref: 'owner', input_domain_complete: true },
  operation_ref: TEMPORAL_FRAGMENT_EXACT_OPERATION, mode_ref: 'MATCH', requested_result_type: 'DMechanicalResult',
  node_bound: 100000, depth_bound: 4096, domain_bound: 4096, time_bound_ms: 1000,
  models: [{ model_ref: 'M', photo_count: 1, equality_law_ref: 'exact_palette_value' }],
  reference: { rows: [[1, 2], [3, 4]] }, reference_revision_ref: 'revision',
  photos: [{ photo_ref: 'P', scene_ref: 'scene', film_revision_ref: 'film', photo_index: 0,
    frame: { rows: [[1, 2], [3, 4]] }, evidence_ref: 'photo-evidence', content_support_ref: 'support', content_kind_ref: 'acquired_photo_content' }],
  windows: [{ window_ref: 'W', photo_ref: 'P', top: 0, left: 0 }] };
}

for (const item of fixture.kernelCases as R[]) test(`original temporal exact-candidate contract: ${item.id}`, () => {
  const ticks: number[] = item.clockMs ?? [100000];
  let calls = 0;
  const clock = () => ticks[Math.min(calls++, ticks.length - 1)]!;
  if (item.expectedError) {
    if (item.expectedError.type === 'AttributeError' && item.expectedError.message === "'dict' object has no attribute '_data'") {
      const actual = measureTemporalFragmentMatch(item.request ?? item.requestInput, clock);
      assert.equal(actual.status, 'NEEDS_EVIDENCE'); assert.equal(actual.domain_complete, false);
      assert.ok(['NODE_BOUND', 'TIME_BOUND'].includes(actual.cause));
      assert.deepEqual(actual.values, {});
      assert.equal(actual.frontier.work_frontier.native_adaptation, TEMPORAL_FRAGMENT_NATIVE_INTERRUPTION);
      assert.equal(actual.descriptive_facts.primitive_release_authorized, false);
      if (item.sourceClockCalls !== undefined) assert.equal(calls, item.sourceClockCalls);
    } else assert.throws(() => measureTemporalFragmentMatch(item.requestInput, clock));
  } else {
    const before = clone(item.request), actual = measureTemporalFragmentMatch(item.request, clock);
    assert.deepEqual(actual, item.expected, item.id);
    assert.deepEqual(item.request, before, 'Read-only calculation must not alter the source-bound request');
    if (item.sourceClockCalls !== undefined) assert.equal(calls, item.sourceClockCalls, 'Preserve budget clock visitation order');
  }
});

test('a matching window remains descriptive and cannot authorize a primitive', () => {
  const result = measureTemporalFragmentMatch(request(), () => 0);
  assert.equal(result.status, 'COMPLETE');
  assert.equal(result.domain_complete, true);
  assert.equal(result.examined_count, 5);
  assert.equal(result.descriptive_facts.primitive_release_authorized, false);
  assert.equal(result.source_disposition_ref, null);
  assert.equal(result.source_policy_ref, null);
  const row = result.values.model_correlated_results[0].result;
  assert.deepEqual(row.exact_window_refs, ['W']);
  assert.equal(row.unique_in_declared_window_domain, true);
  assert.equal(row.window_results[0].background_and_isolated_pixels_preserved, true);
});

test('all pixels, including the last isolated difference, participate in equality', () => {
  const q = request(); q.photos[0].frame.rows[1][1] = 9;
  const result = measureTemporalFragmentMatch(q, () => 0);
  const row = result.values.model_correlated_results[0].result;
  assert.equal(result.domain_complete, true);
  assert.deepEqual(row.exact_window_refs, []);
  assert.equal(row.absent_in_declared_window_domain, true);
  assert.deepEqual(row.window_results[0].counterexample_pixels, [[1, 1, 4, 9]]);
  assert.equal(row.window_results[0].compared_pixel_count, 4);
});

test('a partial model never publishes its calculated prefix as a complete result', () => {
  const q = request(); q.node_bound = 4;
  const result = measureTemporalFragmentMatch(q, () => 0);
  assert.equal(result.status, 'NEEDS_EVIDENCE');
  assert.equal(result.cause, 'NODE_BOUND');
  assert.equal(result.domain_complete, false);
  assert.deepEqual(result.values, {});
  assert.equal(result.examined_count, 4);
  assert.deepEqual(result.frontier.completed_model_results, []);
  assert.equal(result.frontier.unfinished_model_ref, 'M');
  assert.deepEqual(result.frontier.work_frontier, { window_ref: 'W', next_pixel: [1, 1], counterexample_pixels: [],
    native_adaptation: TEMPORAL_FRAGMENT_NATIVE_INTERRUPTION });
});

test('resumption reuses only completed correlated models and binds all scoped input', () => {
  const q = request(); q.models.push({ ...q.models[0], model_ref: 'M2' }); q.node_bound = 6;
  const interrupted = measureTemporalFragmentMatch(q, () => 0);
  assert.equal(interrupted.cause, 'NODE_BOUND');
  assert.equal(interrupted.frontier.completed_model_results.length, 1);
  const resumed = { ...q, node_bound: 100, resume_frontier: interrupted.frontier };
  const complete = measureTemporalFragmentMatch(resumed, () => 0);
  assert.equal(complete.status, 'COMPLETE'); assert.equal(complete.examined_count, 5);
  assert.deepEqual(complete.values, measureTemporalFragmentMatch({ ...q, node_bound: 100 }, () => 0).values);
  const changed = clone(resumed); changed.scope.evidence_revision_ref = 'changed';
  const refused = measureTemporalFragmentMatch(changed, () => 0);
  assert.equal(refused.status, 'NEEDS_EVIDENCE'); assert.equal(refused.cause, 'RESUME_INPUT_OR_REVISION_MISMATCH');
  assert.deepEqual(refused.frontier.completed_model_results, []);
});

test('completed-model reuse does not skip the final elapsed-time check', () => {
  const q = request(); const complete = measureTemporalFragmentMatch(q, () => 0);
  const small = measureTemporalFragmentMatch({ ...q, node_bound: 1 }, () => 0);
  q.resume_frontier = { ...small.frontier, completed_model_results: complete.values.model_correlated_results };
  const ticks = [0, 1000]; let next = 0;
  const result = measureTemporalFragmentMatch(q, () => ticks[Math.min(next++, 1)]!);
  assert.equal(result.cause, 'TIME_BOUND'); assert.equal(result.domain_complete, false);
  assert.equal(result.examined_count, 0); assert.equal(result.frontier.completed_model_results.length, 1);
});

test('an exact-candidate result does not transfer the other temporal operations', () => {
  const q = request(); q.operation_ref = 'mechanics.temporal_fragment_match.discriminants'; q.mode_ref = 'COMPARE';
  const result = measureTemporalFragmentMatch(q, () => 0);
  assert.equal(result.status, 'NEEDS_EVIDENCE');
  assert.equal(result.cause, 'NATIVE_TEMPORAL_FRAGMENT_OPERATION_NOT_TRANSFERRED');
  assert.equal(result.domain_complete, false); assert.deepEqual(result.values, {});
});

test('normalization retains complete source defaults without aliasing the caller', () => {
  const q = request(), normalized = normalizeTemporalFragmentExactRequest(q);
  assert.equal(normalized.reference.schema_version, 'yf_arc3_v5.frame_grid.v1');
  assert.deepEqual(normalized.models[0].palette_relation, []);
  assert.equal(normalized.models[0].navigation_law_ref, null);
  assert.deepEqual(normalized.memory_records, []);
  normalized.reference.rows[0][0] = 99;
  assert.equal(q.reference.rows[0][0], 1);
});

for (const [name, mutate] of [
  ['fractional pixel', (q: R) => { q.reference.rows[0][0] = 0.5; }],
  ['negative zero pixel', (q: R) => { q.reference.rows[0][0] = -0; }],
  ['unsafe integer', (q: R) => { q.windows[0].left = Number.MAX_SAFE_INTEGER + 1; }],
  ['ragged photo', (q: R) => { q.photos[0].frame.rows[1].pop(); }],
  ['empty frame', (q: R) => { q.reference.rows = []; }],
  ['unknown request field', (q: R) => { q.oracle = 'not-a-contract'; }],
  ['null frame schema', (q: R) => { q.reference.schema_version = null; }],
  ['null assumptions', (q: R) => { q.scope.assumption_refs = null; }],
  ['untransferred request submodel', (q: R) => { q.primitive = { primitive_ref: 'p', kind_ref: 'point' }; }],
] as [string, (q: R) => void][]) test(`native exact request refuses ${name}`, () => {
  const q = request(); mutate(q); assert.throws(() => measureTemporalFragmentMatch(q, () => 0));
});
