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

test('the production agenda preserves frontier commands and declares why it probes locally or follows an observed route', async () => {
  const choices = new Set<string>();
  for (const scenario of fixture.scenarios) {
    const source = new ObservedFrontier(scenario.target, scenario.maximum);
    const saved = new Map<string, any>();
    for (const row of scenario.steps) {
      if (row.error) continue;
      if (row.operation === 'propose' && row.expected?.status === 'proposed'
          && row.kwargs?.return_episode == null && row.kwargs?.curiosity == null && row.kwargs?.control_acquisition == null) {
        const candidate = new ObservedFrontier(scenario.target, scenario.maximum, source.snapshot());
        const result = await candidate.propose(...[row.args[0], row.args[1], { ...row.kwargs, sic_agenda: true }] as Parameters<ObservedFrontier['propose']>);
        assert.ok(result?.sic_frontier_decision);
        const { sic_frontier_decision: receipt, ...proposal } = result!;
        choices.add(receipt.strategy);
        assert.deepEqual(proposal.actions, row.expected.actions);
        assert.deepEqual(proposal.steps, row.expected.steps);
        assert.equal(receipt.objective.parent, proposal.bundle_template.objective_ref);
      }
      const result = await runOperation(source, row, saved);
      if (row.save) saved.set(row.save, structuredClone(result));
    }
  }
  assert.ok(choices.has('test_local_input'));
  assert.ok(choices.has('reach_open_input'));
});

test('an exhausted public board records the absence of a plan without releasing a command', async () => {
  const graph = new ObservedFrontier();
  const board = { observation_ref: 'frontier-empty:epoch:1:revision:1:frame:unchanged', frame_hash: 'unchanged',
    level_epoch: 1, levels_completed: 0, state: 'NOT_FINISHED', available_action_refs: ['ACTION1'], entities: [] };
  const command = { action_ref: 'ACTION1' };
  assert.deepEqual((await graph.propose(board, [command], { sic_agenda: true }))?.actions, [command]);
  const unchanged = { ...board, observation_ref: 'frontier-empty:epoch:1:revision:2:frame:unchanged' };
  await graph.recordTransition(board, command, unchanged);
  const refused = await graph.propose(unchanged, [command], { sic_agenda: true });
  assert.equal(refused?.status, 'frontier_exhausted');
  assert.deepEqual(refused?.actions, []);
  assert.deepEqual(refused?.sic_frontier_refusal.agenda.map((entry: { result: string }) => entry.result), ['skipped', 'no_plan']);
});

test('the SIC input order breaks ties between equally supported commands on the same board', async () => {
  const graph = new ObservedFrontier();
  const board = { observation_ref: 'frontier-test:epoch:1:revision:1:frame:test', frame_hash: 'test',
    level_epoch: 1, levels_completed: 0, state: 'NOT_FINISHED', available_action_refs: ['ACTION1', 'ACTION2'], entities: [] };
  const commands = [{ action_ref: 'ACTION1' }, { action_ref: 'ACTION2' }];
  graph.action_counts[`1:${await frontierActionKey(commands[0]!)}`] = 3;
  const stable = new ObservedFrontier(3, 16, graph.snapshot());
  const normal = await graph.propose(board, commands, { sic_agenda: true });
  const alternate = await stable.propose(board, commands, { sic_agenda: true, sic_frontier: { inputOrder: 'command_order' } });
  assert.deepEqual(normal?.actions, [commands[1]]);
  assert.deepEqual(alternate?.actions, [commands[0]]);
  assert.deepEqual(normal?.sic_frontier_decision.choices, alternate?.sic_frontier_decision.choices);
  assert.equal((await stable.guard(alternate!, board)).admitted, true);
  const after = { ...board, observation_ref: 'frontier-test:epoch:1:revision:2:frame:after', frame_hash: 'after' };
  await stable.recordTransition(board, commands[0]!, after);
  const restored = new ObservedFrontier(3, 16, stable.snapshot());
  assert.deepEqual(restored.pending?.sic_frontier, alternate?.sic_frontier_decision);
  assert.equal(restored.pending?.sic_outcome.status, 'observed');
  assert.equal(restored.pending?.sic_outcome.objective, alternate?.sic_frontier_decision.objective.id);
  assert.equal(restored.pending?.sic_outcome.need, alternate?.sic_frontier_decision.need.id);
});

test('an authored frontier rule can observe, apply, or decline the same choice', async () => {
  const graph = new ObservedFrontier();
  const board = { observation_ref: 'author:epoch:1:revision:1:frame:test', frame_hash: 'test',
    level_epoch: 1, levels_completed: 0, state: 'NOT_FINISHED', available_action_refs: ['ACTION1', 'ACTION2'], entities: [] };
  const commands = [{ action_ref: 'ACTION1' }, { action_ref: 'ACTION2' }];
  graph.action_counts[`1:${await frontierActionKey(commands[0]!)}`] = 2;
  const localRule = { title: 'Study recurring directions', mode: 'active', commands: 'directions', minimumUsageGap: 2, prefer: 'command_order' } as const;
  const run = (rule: typeof localRule | { mode: 'shadow' } | { minimumUsageGap: 3 } | { commands: 'clicks' }) =>
    new ObservedFrontier(3, 16, graph.snapshot()).propose(board, commands, {
      sic_agenda: true, sic_frontier: { inputOrder: 'least_tried', localRule: { ...localRule, ...rule } },
    });
  const [active, shadow, belowThreshold, outsideDomain] = await Promise.all([
    run(localRule), run({ mode: 'shadow' }), run({ minimumUsageGap: 3 }), run({ commands: 'clicks' }),
  ]);
  assert.deepEqual(active?.actions, [commands[0]]);
  assert.deepEqual(shadow?.actions, [commands[1]]);
  assert.deepEqual(belowThreshold?.actions, shadow?.actions);
  assert.deepEqual(outsideDomain?.actions, shadow?.actions);
  assert.equal(active?.sic_frontier_decision.effectiveOrder, 'command_order');
  assert.equal(shadow?.sic_frontier_decision.localRule.matched, true);
  assert.equal(belowThreshold?.sic_frontier_decision.localRule.matched, false);
  assert.equal(outsideDomain?.sic_frontier_decision.localRule.matched, false);
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
