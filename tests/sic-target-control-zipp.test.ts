import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import { Snapshot } from '../src/logos-engine/v6-composition-memory.ts';
import { NativeCallerCoordinator } from '../src/logos-engine/v6-native-caller.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { ObservedFrontier } from '../src/logos-engine/v6-observed-frontier.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation, type V6Command } from '../src/runtime/v6-agent-protocol.ts';

type Row = Record<string, any>;
const root = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const read = (p: string) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const declarations = { common: read('laya_proto/common_frontier_policy.drm.json'), strategy: read('morphology_policy/strategy.drm') };
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-control-zipp-public.json.gz', import.meta.url))).toString());
const pair = 'f375e1c12e0a8e64cee898cbd1ac38f40e447ac8d2cc9858dd4bb99a5d37336c';
const role = '3da0201963e8a489478c6d250f50d32ebc32e24bad145c945a21bcc382ba0fe2';
const ref = (revision: number, frame: string) => fixture.sessionId + ':epoch:2:revision:' + revision + ':frame:' + frame;
const current = ref(15, 'd247c339b72c5e8a');
const evidence = [current, ref(10, 'eef05abae50b9912'), ref(11, 'd247c339b72c5e8a')];

async function historicalPrefix(live: boolean) {
  const backend = live && process.env.SIC_TARGET_GAME_ROOT ? await sourceBackend(process.env.SIC_TARGET_GAME_ROOT) : null;
  function input(sequence: number, command?: V6Command) {
    const historical = fixture.observations[sequence];
    if (!backend) return historical;
    const board = backend.dispatch(command ? { type: 'action', actionId: Number(command.actionRef.slice(6)), data: command.data } : { type: 'load', code: 'ZIPP', level: 1 });
    const packet = toV6PublicObservation(board, sequence);
    const { palette, ...fields } = packet;
    assert.deepEqual(fields, historical, 'public return ' + sequence);
    return packet;
  }
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const service = new V6AgentService(() => runtime), sessionId = fixture.sessionId;
  let sequence = 0;
  let result = await service.handle({ type: 'init', sessionId, sequence, budgets: fixture.budgets, observation: input(0) });
  const ticket = async () => {
    if (result.kind === 'boundary') result = await service.handle({ type: 'resume', sessionId, sequence });
    assert.equal(result.kind, 'action');
    const trace = result.snapshot.trace as readonly Row[];
    const proposal = result.snapshot.proposal as Row;
    return { proposal, command: result.command!, release: trace.findLast(e => e.kind === 'sic_native_plan')!, guard: trace.findLast(e => e.kind === 'before_guard')! };
  };
  const advance = async () => {
    const expected = fixture.commands[sequence], command = result.command!;
    assert.equal(command.actionRef, 'ACTION' + expected.id);
    assert.deepEqual(command.data ?? {}, expected.data ?? {});
    result = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: result.ticket!.id, observation: input(sequence, command), executionMs: 0 });
    return result.snapshot.trace as readonly Row[];
  };
  for (let turn = 1; turn < 15; turn++) {
    assert.notEqual((await ticket()).release.family, 'acquire_control_for_target');
    await advance();
  }
  return { ticket, advance, history() {
    const graph = runtime.inspectKnowledge();
    return (hydrateNativeState(graph.nodes['caller:goal']!.value!, id => graph.nodes[id]!.value) as Row).episode as [Row, string, Row][];
  } };
}

test('ZIPP L2 historical ACTION2 replicates one measured translation and then releases a different frontier question', async t => {
  const frontier = t.mock.method(ObservedFrontier.prototype, 'propose');
  const acquire = t.mock.method(NativeCallerCoordinator.prototype, 'acquireControlForTarget');
  const game = await historicalPrefix(true);
  const { proposal, command, guard, release } = await game.ticket();
  const ac = proposal.question.control_acquisition;
  assert.equal(proposal.morphology.status, 'retained');
  assert.equal(proposal.morphology.reason, 'control_not_currently_attested');
  assert.deepEqual([ac.pair_ref, proposal.morphology.measured_facts.pair_ref], [pair, pair]);
  assert.deepEqual([ac.experiment, ac.action_ref, ac.observation_ref, ac.expected_motion, ac.evidence],
    ['replicate_translation', 'ACTION2', current, { [role]: [0, 12] }, evidence]);
  const offers = frontier.mock.calls.flatMap(c => c.arguments[2]?.control_acquisition ?? []).filter(a => a.observation_ref === current);
  assert.ok(offers.some(a => a.action_ref === 'ACTION2' && a.experiment === ac.experiment && a.pair_ref === pair));
  assert.deepEqual([release.family, release.strategy, release.authority, release.objective, release.strategyObjective.observationRef],
    ['acquire_control_for_target', 'acquire_control_for_target', 'native', 'G_protocol_completion', current]);
  assert.deepEqual([guard.admitted, guard.reason, proposal.kind, proposal.actions.length, command.actionRef, release.missingControl],
    [true, 'current_public_premises_match_provisional_step', 'experiment', 1, 'ACTION2', undefined]);
  const prior = game.history().filter(row => row[1] === 'ACTION2');
  assert.equal(prior.length, 1);
  assert.deepEqual([prior[0]![0].roles[role], prior[0]![2].roles[role]], [[11, 31, 17, 37], [11, 43, 17, 49]]);
  const trace = await game.advance();
  const outcome = trace.findLast(row => row.kind === 'actual_outcome')!, [before, action, after] = game.history().at(-1)!;
  assert.deepEqual([before.ref, action, after.ref, before.roles[role], after.roles[role]],
    [current, 'ACTION2', outcome.observation_ref, [11, 43, 17, 49], [11, 43, 17, 49]]);
  assert.deepEqual([outcome.family, outcome.matched], [release.family, null]);
  const next = await game.ticket();
  const attempt = acquire.mock.calls.findLast(c => c.arguments[0].observation_ref === after.ref)!;
  assert.equal(attempt.arguments[3]!.measured_facts.pair_ref, pair);
  assert.equal(await attempt.result, null);
  assert.equal(game.history().filter(([, action]) => action === 'ACTION2').length, 2);
  assert.deepEqual([next.release.family, next.release.strategy, next.command, next.guard.admitted],
    ['observed_frontier', 'test_local_input', { actionRef: 'ACTION6', data: { x: 14, y: 10 } }, true]);
  await game.advance();
});

test('ZIPP same observation, pair and ACTION2, with the sole trial in an earlier epoch, opens a P05 sample', async t => {
  const acquire = NativeCallerCoordinator.prototype.acquireControlForTarget;
  const previousEpoch = (s: Snapshot) => new Snapshot(s.rows, s.roles, s.epoch - 1, s.score, s.ref.replace(':epoch:2:', ':epoch:1:'), s.frame_hash);
  let changed = false;
  t.mock.method(NativeCallerCoordinator.prototype, 'acquireControlForTarget', async function (this: NativeCallerCoordinator, ...args: Parameters<typeof acquire>) {
    if (args[0].observation_ref !== current) return acquire.apply(this, args);
    const memory = this.goal.memory, actual = memory.episode;
    assert.equal(actual.filter(([, command]) => command === 'ACTION2').length, 1);
    memory.episode = actual.map(([before, command, after]) =>
      command === 'ACTION2' ? [previousEpoch(before), command, previousEpoch(after)] : [before, command, after]);
    try { changed = true; return await acquire.apply(this, args); }
    finally { memory.episode = actual; }
  });
  const game = await historicalPrefix(false);
  const { proposal, release, guard, command } = await game.ticket();
  assert.ok(changed);
  const ac = proposal.question.control_acquisition;
  assert.deepEqual([ac.experiment, ac.observation_ref, ac.pair_ref, ac.expected_motion, ac.evidence],
    ['sample_unused_control', current, pair, undefined, [current]]);
  assert.deepEqual([release.family, command.actionRef, guard.admitted, release.missingControl.id, release.missingControl.evidence],
    ['acquire_control_for_target', 'ACTION2', true, 'test_missing_control', [current]]);
});
