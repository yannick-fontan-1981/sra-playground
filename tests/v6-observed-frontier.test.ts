import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ObservedFrontier, frontierAction, frontierActionKey, frontierProtocol, frontierIndex, frontierRef,
  frontierRules, closedReturnContrast, closedObservedPathReturn } from '../src/logos-engine/v6-observed-frontier.ts';

const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-frontier-reference.json', import.meta.url), 'utf8'));
const helpers: Record<string, (...args: any[]) => any> = { action: frontierAction, action_key: frontierActionKey, protocol: frontierProtocol,
  index: frontierIndex, ref: frontierRef, rules: frontierRules, closed_observed_return: closedObservedPathReturn };
for (const sample of fixture.cases) test(`V6 observed frontier helper original parity: ${sample.id}`, async () => {
  const run = async () => helpers[sample.operation]!(...structuredClone(sample.args));
  if (sample.error) await assert.rejects(run, (e: any) => e.message === sample.error);
  else assert.deepEqual(await run(), sample.expected);
});

async function runOperation(graph: ObservedFrontier, row: any, saved: Map<string, any>): Promise<any> {
  const a = structuredClone(row.args), kw = structuredClone(row.kwargs);
  switch (row.operation) {
    case 'observe': return graph.observe(a[0], a[1]);
    case 'propose': return graph.propose(a[0], a[1], kw);
    case 'record_transition': return graph.recordTransition(a[0], a[1], a[2], kw);
    case 'guard_saved': return graph.guard(saved.get(a[0]), a[1], a[2]);
    case 'outcome_saved': return graph.checkOutcome(saved.get(a[0]), a[1], a[2]);
    case 'check_outcome': return graph.checkOutcome(a[0], a[1], a[2]);
    case 'can_probe_here': return graph.canProbeHere(a[0], a[1]);
    case 'set_rules': graph.rules = a[0]; return null;
    case 'increment_revision': graph.knowledge_revision++; return null;
    case 'bind_current_candidate_context': graph.bindCurrentCandidateContext(a[0], a[1]); return null;
    case 'return_contrast': return closedReturnContrast(graph, a[0], a[1], a[2]);
    case 'propose_return': return graph.propose(a[0], a[1], { return_episode: a[2] });
    default: throw new Error(`Unknown frontier fixture operation: ${row.operation}`);
  }
}

for (const scenario of fixture.scenarios) test(`V6 observed frontier original sequence and delta replay: ${scenario.id}`, async () => {
  const graph = new ObservedFrontier(scenario.target, scenario.maximum), replay = new ObservedFrontier(scenario.target, scenario.maximum);
  const saved = new Map<string, any>();
  for (const [index, row] of scenario.steps.entries()) {
    const label = `${scenario.id} step ${index}: ${row.operation}`;
    if (row.error) await assert.rejects(() => runOperation(graph, row, saved), (e: any) => e.message === row.error, label);
    else {
      const result = await runOperation(graph, row, saved);
      assert.deepEqual(result ?? null, row.expected, label);
      if (row.save) saved.set(row.save, structuredClone(result));
    }
    const deltas = graph.drainDeltas(); assert.deepEqual(deltas, row.deltas, `${label} source-bound deltas`);
    assert.deepEqual(graph.snapshot(), row.state, `${label} retained state`);
    if (row.operation === 'set_rules') replay.rules = structuredClone(row.args[0]);
    if (row.operation === 'increment_revision') replay.knowledge_revision++;
    for (const delta of deltas) await replay.applyDelta(delta);
    assert.deepEqual(replay.snapshot(), graph.snapshot(), `${label} delta replay`);
    const restored = new ObservedFrontier(3, 16, graph.snapshot());
    assert.deepEqual(restored.snapshot(), graph.snapshot(), `${label} full restore`);
  }
});

test('V6 frontier rejects tampered, duplicate or reordered retained events without replacing its chain', async () => {
  const scenario = fixture.scenarios[0], first = scenario.steps.flatMap((step: any) => step.deltas)[0];
  const graph = new ObservedFrontier();
  const damaged = structuredClone(first); damaged.payload.protocol.frame_hash = 'changed';
  await assert.rejects(() => graph.applyDelta(damaged), /chain\/order mismatch/);
  assert.equal(graph.sequence, 0); assert.equal(graph.chain, null);
  await graph.applyDelta(first); const before = graph.snapshot();
  await assert.rejects(() => graph.applyDelta(first), /chain\/order mismatch/);
  assert.deepEqual(graph.snapshot(), before);
  assert.throws(() => new ObservedFrontier(3, 17), /bounded by 16/);
  assert.throws(() => new ObservedFrontier(3, 16, { schema: 'other' }), /Unsupported frontier snapshot/);
});

test('V6 frontier oracle and native policy retain the pinned original sources', async () => {
  for (const [path, expected] of Object.entries(fixture.sourceHashes)) {
    const bytes = await readFile(new URL(`../reference/v6/${fixture.commit}/source/${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
    if (path.endsWith('common_frontier_policy.drm.json')) {
      const native = await readFile(new URL('../src/logos-engine/v6/frontier-policy.json', import.meta.url));
      assert.equal(createHash('sha256').update(native).digest('hex'), expected);
    }
  }
});
