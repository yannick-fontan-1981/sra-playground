import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import { RecurrentSeriesMemory } from '../src/logos-engine/v6-recurrent-series-access.ts';
import { recurrentSeriesFields, recurrentSeriesExtensions } from '../src/logos-engine/v6-recurrent-series-observation.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation, type V6Command, type V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

type Row = Record<string, any>;
const archive = JSON.parse(gunzipSync(readFileSync(new URL('../docs/migration/lot3i-evidence/final/conn-recurrent-series-session/conn-public-trace.json.gz', import.meta.url))).toString());
const alternatives: Record<number, V6PublicObservation> = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-conn-alternate-returns.json.gz', import.meta.url))).toString());
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, source), 'utf8'));
const declarations = { common: read('laya_proto/common_frontier_policy.drm.json'), strategy: read('morphology_policy/strategy.drm') };
const line = 'repeated_line_completion', support = 'supported_line_preparation';

function observation(turn: number): V6PublicObservation {
  const p = archive.packets[turn].packet;
  return { frame: p.frame_rows, frames: p.frame_packet, availableActionIds: p.available_action_refs.map((a: string) => Number(a.slice(6))),
    state: p.state, level: p.level, levelsCompleted: p.levels_completed, stepIndex: p.step_index };
}

async function start(live = false, initial?: V6PublicObservation) {
  const backend = live && process.env.SIC_CONN_GAME_ROOT ? await sourceBackend(process.env.SIC_CONN_GAME_ROOT) : null;
  function input(turn: number, command?: V6Command, expected = observation(turn)) {
    if (!backend) return expected;
    const board = backend.dispatch(command ? { type: 'action', actionId: Number(command.actionRef.slice(6)), data: command.data } : { type: 'load', code: 'CONN', level: 1 });
    const packet = toV6PublicObservation(board, turn), { palette, ...fields } = packet;
    assert.deepEqual(fields, expected, 'public CONN return ' + turn);
    return packet;
  }
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 }), service = new V6AgentService(() => runtime);
  const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence, observation: initial ?? input(0),
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: 16 } });
  return {
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      const trace = reply.snapshot.trace as readonly Row[], proposal = reply.snapshot.proposal as Row;
      return { command: reply.command, kind: reply.kind, id: reply.ticket?.id, proposal,
        family: reply.snapshot.lastDecision, guard: trace.findLast(e => e.kind === 'before_guard') };
    },
    async advance(publicReturn?: V6PublicObservation, alternativePoint?: { x: number; y: number }) {
      assert.equal(reply.kind, 'action');
      const historical = archive.packets[sequence + 1].command, command = reply.command!;
      assert.deepEqual([command.actionRef, command.data], alternativePoint ? ['ACTION6', alternativePoint] : [historical.action_ref, historical.data]);
      reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket!.id,
        observation: publicReturn ?? input(sequence, command, alternativePoint ? alternatives[sequence] : observation(sequence)), executionMs: 0 });
      return (reply.snapshot.trace as readonly Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}

function retainFirstField(packet: V6PublicObservation): V6PublicObservation {
  const field = recurrentSeriesFields(packet.frame)[0]!, [left, top] = field.origin;
  const right = left + (field.shape[0] - 1) * field.pitch[0] + field.size[0];
  const bottom = top + (field.shape[1] - 1) * field.pitch[1] + field.size[1];
  const mask = (frame: V6PublicObservation['frame']) => frame.map((row, y) => row.map((value, x) =>
    x >= left - 1 && x <= right && y >= top - 1 && y <= bottom ? value : frame[0]![0]!));
  return { ...packet, frame: mask(packet.frame), frames: packet.frames.map(mask) };
}

test('CONN uses a scored length from 63 and current support evidence for 66 across the historical prefix', async t => {
  const record = RecurrentSeriesMemory.prototype.record, byReturn = new Map<string, Row[]>();
  t.mock.method(RecurrentSeriesMemory.prototype, 'record', function (this: RecurrentSeriesMemory, ...args: Parameters<typeof record>) {
    const events = record.apply(this, args);
    byReturn.set(args[2].observation_ref, events);
    return events;
  });
  const game = await start(true), counts = new Map<string, number>();
  let scored: Row | undefined;
  const issued = new Set<string>();
  for (let turn = 1; turn <= 16; turn++) {
    const next = await game.decision(), p = next.proposal;
    assert.ok(next.id && !issued.has(next.id));
    issued.add(next.id);
    counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1);
    const result = await game.advance(), events = byReturn.get(result.observation_ref) ?? [];
    if (turn <= 5 || turn >= 13) {
      assert.deepEqual([next.family, p.field_subquestion, next.guard?.admitted, next.guard?.index],
        ['public_occurrence_recall', 'recurrent_series', true, 0]);
    }
    if (turn <= 5) {
      assert.deepEqual([next.guard?.reason, p.question.reason], ['pointed_series_bound', 'complete_a_recurrent_geometric_series']);
      assert.equal(result.reason, turn === 5 ? 'official_boundary_or_terminal' : turn === 4 ? 'series_continuation_refuted' : 'series_continuation_observed');
      const plan = p.line_plan, trial = events.find(e => e.kind === 'repeated_line_trial')!;
      assert.deepEqual([p.kind, plan.observed_length, plan.candidate_length, plan.expected_palette, plan.support_fields.length], [line, 3, 4, 11, 4]);
      assert.deepEqual([trial.before, trial.after], [plan.observation_ref, result.observation_ref]);
      assert.deepEqual([trial.result, result.matched], turn === 5 ? ['boundary', null] : turn === 4 ? ['refuted', false] : ['matched', true]);
      if (turn === 5) {
        scored = events.find(e => e.kind === 'repeated_line_scored');
        assert.deepEqual([scored?.epoch, scored?.source, scored?.candidate_length, scored?.palette], [1, result.observation_ref, 4, 11]);
      } else assert.ok(events.every(e => e.kind !== 'repeated_line_scored'));
    }
    if (turn >= 10 && turn <= 12) {
      const sample = events.find(e => e.kind === 'supported_insertion_observation')!;
      assert.equal(next.family, 'observed_frontier');
      assert.deepEqual([sample.epoch, sample.after, sample.blocked_goal_extension], [3, result.observation_ref, turn === 12]);
    }
    if (turn >= 13) {
      assert.deepEqual([next.guard?.reason, p.question.reason], ['supported_preparation_bound', 'prepare_a_supported_geometric_goal_under_response']);
      const plan = p.supported_line_plan;
      assert.ok(scored && p.route_refs.includes(scored.source));
      assert.deepEqual([p.kind, plan.epoch, plan.goal_length, plan.support_axis, plan.support_sign], [support, 3, 4, 1, 1]);
      assert.deepEqual([result.matched, result.reason], [true, 'prepared_contribution_and_compatible_response_observed']);
      const sample = events.find(e => e.kind === 'supported_insertion_observation')!;
      assert.deepEqual([sample.source, sample.after], [plan.observation_ref, result.observation_ref]);
      if (turn === 13) assert.deepEqual([plan.target, plan.selected.point, sample.own, sample.other], [[36, 44], [4, 5], 11, 8]);
    }
  }
  assert.deepEqual([counts.get(line), counts.get(support)], [5, 4]);
});

test('63 declines a locally extendible series when no other field supports it', async () => {
  const packet = retainFirstField(observation(0)), fields = recurrentSeriesFields(packet.frame);
  assert.equal(fields.length, 1);
  assert.equal(fields[0]!.ref, recurrentSeriesFields(observation(0).frame)[0]!.ref);
  assert.ok(recurrentSeriesExtensions(fields[0]!).some(e => e.color === 11 && e.length === 3));
  const game = await start(false, packet), ticket = await game.decision();
  assert.deepEqual([ticket.family, ticket.proposal.kind, ticket.command?.data], ['observed_frontier', 'experiment', { x: 11, y: 15 }]);
});

test('66 keeps the scored line but declines support when the arrivals have no observed order', async t => {
  const propose = RecurrentSeriesMemory.prototype.propose;
  let checked = false;
  t.mock.method(RecurrentSeriesMemory.prototype, 'propose', function (this: RecurrentSeriesMemory, ...args: Parameters<typeof propose>) {
    const result = propose.apply(this, args);
    if (args[0].revision === 13) {
      const samples = this.insertSamples.filter(e => e.epoch === 3);
      assert.equal(this.lineGoals.at(-1)?.candidate_length, 4);
      assert.equal(samples.length, 3);
      assert.ok(samples.some(e => e.blocked_goal_extension));
      assert.ok(samples.every(e => this.insertOrders[e.source].own_before_response === false));
      assert.equal(result.status, 'abstained');
      checked = true;
    }
    return result;
  });
  const game = await start();
  for (let i = 1; i <= 12; i++) {
    await game.decision();
    const packet = observation(i);
    await game.advance(i >= 10 ? { ...packet, frames: [packet.frame] } : undefined);
  }
  const ticket = await game.decision();
  assert.ok(checked);
  assert.deepEqual([ticket.family, ticket.proposal.kind, ticket.command?.data], ['observed_frontier', 'experiment', { x: 10, y: 25 }]);
});

for (const [turn, omitted, replacement] of [[1, { x: 15, y: 13 }, { x: 47, y: 22 }], [13, { x: 38, y: 46 }, { x: 31, y: 46 }]] as const) {
  test('CONN reuses the isolated producer on a second legal point at T' + turn, async t => {
    const propose = RecurrentSeriesMemory.prototype.propose;
    let substituted = false;
    t.mock.method(RecurrentSeriesMemory.prototype, 'propose', function (this: RecurrentSeriesMemory, ...args: Parameters<typeof propose>) {
      const [observation, rows, inputs, remaining, config, bounds] = args;
      if (observation.revision !== turn) return propose.apply(this, args);
      const nominal = propose.apply(this, args);
      assert.deepEqual(nominal.actions[0].data, omitted);
      const otherInputs = inputs.filter(a => a.action_ref !== 'ACTION6' || a.data?.x !== omitted.x || a.data?.y !== omitted.y);
      const chosen = turn === 1 ? this.lineQuestion(observation, rows, otherInputs) :
        propose.call(this, observation, rows, otherInputs, remaining, { ...config, repeated_line_completion: false }, bounds);
      assert.ok(chosen);
      assert.deepEqual(chosen.actions[0].data, replacement);
      substituted = true;
      return chosen;
    });
    const game = await start(true);
    for (let i = 1; i < turn; i++) { await game.decision(); await game.advance(); }
    const ticket = await game.decision();
    assert.ok(substituted);
    assert.deepEqual([ticket.family, ticket.proposal.kind, ticket.command?.data], ['public_occurrence_recall', turn === 1 ? line : support, replacement]);
    const result = await game.advance(undefined, replacement), next = await game.decision();
    assert.deepEqual([result.matched, result.reason], [true, turn === 1 ? 'series_continuation_observed' : 'prepared_contribution_and_compatible_response_observed']);
    assert.deepEqual([next.kind, next.family, next.proposal.kind, next.command?.data],
      ['action', 'public_occurrence_recall', turn === 1 ? line : support, turn === 1 ? omitted : { x: 52, y: 32 }]);
  });
}

for (const turn of [1, 13]) {
  test('CONN releases a frontier ticket when the nominal offer at T' + turn + ' is withdrawn', async t => {
    const propose = RecurrentSeriesMemory.prototype.propose;
    let withdrawn = false;
    t.mock.method(RecurrentSeriesMemory.prototype, 'propose', function (this: RecurrentSeriesMemory, ...args: Parameters<typeof propose>) {
      if (args[0].revision !== turn) return propose.apply(this, args);
      const [observation, rows, inputs, remaining, config, bounds] = args;
      assert.equal(propose.apply(this, args).kind, turn === 1 ? line : support);
      withdrawn = true;
      const restricted = turn === 1 ? { ...config, repeated_line_completion: false } : { ...config, prepare_supported_lines: false };
      return propose.call(this, observation, rows, inputs, remaining, restricted, bounds);
    });
    const game = await start();
    for (let i = 1; i < turn; i++) { await game.decision(); await game.advance(); }
    const ticket = await game.decision();
    assert.ok(withdrawn);
    assert.deepEqual([ticket.kind, ticket.family, ticket.proposal.kind, ticket.command?.data],
      ['action', 'observed_frontier', 'experiment', turn === 1 ? { x: 1, y: 61 } : { x: 10, y: 25 }]);
  });
}
