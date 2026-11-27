import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import { OccurrenceRecallAccess } from '../src/logos-engine/v6-occurrence-recall.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation, type V6Command, type V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

type Row = Record<string, any>;
const archive = JSON.parse(gunzipSync(readFileSync(new URL('../docs/migration/native-campaigns-v39/diagnostics/stck-six-level-attempt-public.json.gz', import.meta.url))).toString());
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, source), 'utf8'));
const declarations = { common: read('laya_proto/common_frontier_policy.drm.json'), strategy: read('morphology_policy/strategy.drm') };
const edit = 'marked_collection_edit', program = 'public_program_composition', probe = 'public_program_respondent_probe';

function observation(turn: number): V6PublicObservation {
  const p = archive.packets[turn].packet;
  return { frame: p.frame_rows, frames: p.frame_packet, availableActionIds: p.available_action_refs.map((a: string) => Number(a.slice(6))),
    state: p.state, level: p.level, levelsCompleted: p.levels_completed, stepIndex: p.step_index };
}

function swapOperatorLabels(packet: V6PublicObservation): V6PublicObservation {
  const repaint = (rows: V6PublicObservation['frame']) => rows.map(row => row.map(color => color === 9 ? 11 : color === 11 ? 9 : color));
  return { ...packet, frame: repaint(packet.frame), frames: packet.frames.map(repaint) };
}

async function start(live = false, swap = false) {
  const backend = live && process.env.SIC_STCK_GAME_ROOT ? await sourceBackend(process.env.SIC_STCK_GAME_ROOT) : null;
  function input(turn: number, command?: V6Command) {
    const expected = observation(turn);
    if (!backend) return swap ? swapOperatorLabels(expected) : expected;
    const board = backend.dispatch(command ? { type: 'action', actionId: Number(command.actionRef.slice(6)), data: command.data } : { type: 'load', code: 'STCK', level: 1 });
    const packet = toV6PublicObservation(board, turn), { palette, ...fields } = packet;
    assert.deepEqual(fields, expected, 'public STCK return ' + turn);
    return packet;
  }
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 }), service = new V6AgentService(() => runtime);
  const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence, observation: input(0),
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: 16 } });
  return {
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      const trace = reply.snapshot.trace as readonly Row[], proposal = reply.snapshot.proposal as Row;
      return { command: reply.command, kind: reply.kind, id: reply.ticket?.id, reason: reply.reason, proposal,
        family: reply.snapshot.lastDecision, guard: trace.findLast(e => e.kind === 'before_guard') };
    },
    async advance(publicReturn?: V6PublicObservation) {
      assert.equal(reply.kind, 'action');
      const historical = archive.packets[sequence + 1].command, command = reply.command!;
      assert.deepEqual([command.actionRef, command.data], [historical.action_ref, historical.data]);
      reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket!.id,
        observation: publicReturn ?? input(sequence, command), executionMs: 0 });
      return (reply.snapshot.trace as readonly Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}


for (const swapped of [false, true]) {
  test('STCK binds edits, executions and respondents in ' + (swapped ? 'a relabelled operator configuration' : 'the historical game'), async t => {
    const recorded = new Map<string, Row>(), apply = OccurrenceRecallAccess.prototype.applyEvent;
    t.mock.method(OccurrenceRecallAccess.prototype, 'applyEvent', function (this: OccurrenceRecallAccess, e: Row) {
      if (['marked_collection_result', 'program_composition_reconciled', 'respondent_probe_result', 'observed_respondent_order'].includes(e.kind)) {
        recorded.set(e.kind + ':' + e.evidence.at(-1), e);
      }
      return apply.call(this, e);
    });
    const label = (n: number) => swapped ? (n === 9 ? 11 : n === 11 ? 9 : n) : n;
    const game = await start(!swapped, swapped), counts = new Map<string, number>();
    let startTime = performance.now();
    for (let turn = 1; turn <= 13; turn++) {
      const ticket = await game.decision(), p = ticket.proposal, index = ticket.guard?.index;
      assert.deepEqual([ticket.kind, ticket.family, p.field_subquestion, ticket.guard?.admitted], ['action', 'public_occurrence_recall', 'observed_program_composition', true]);
      counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1);
      const plan = p.marked_collection_plan ?? p.program_composition_plan ?? p.respondent_probe_plan;
      assert.ok(p.bundle_template.evidence.includes(plan.observation_ref));
      const outcome = await game.advance(), event = (kind: string) => {
        const found = recorded.get(kind + ':' + outcome.observation_ref);
        assert.ok(found, kind);
        return found;
      };
      if (turn === 1 || turn === 2) {
        assert.deepEqual([p.kind, plan.mode, plan.before_collection, outcome.reason, event('marked_collection_result').outcome.matched],
          [edit, turn === 1 ? 'remove' : 'insert', (turn === 1 ? [14, 11, 9, 10] : [14, 11, 9]).map(label), 'collection_edit_confirmed', true]);
      }
      if (turn === 3) assert.deepEqual([p.kind, plan.mode, plan.before_collection, outcome.reason],
        [edit, 'execute', [8, 14, 11, 9].map(label), 'official_boundary_or_terminal']);
      if (turn === 4 || turn === 11) {
        assert.deepEqual([p.kind, plan.mode, plan.word, plan.steps.length, plan.own_base, outcome.reason],
          [program, 'bind_single_member', [label(9)], 1, null, 'program_edit_projected']);
        assert.ok(p.route_refs.includes(plan.model.model_id));
      }
      if (turn === 5 || turn === 9) {
        assert.deepEqual([p.kind, plan.mode, plan.word, index], [program, 'construct_and_execute', [8, 8, 14, 9, 9].map(label), turn === 5 ? 0 : 4]);
        if (turn === 9) {
          const receipt = event('program_composition_reconciled');
          assert.deepEqual([outcome.reason, receipt.outcome.matched, receipt.continuation.own_base],
            ['returned_program_projection_matched', true, [44, 21]]);
        }
      }
      if (turn === 10) assert.deepEqual([plan.mode, plan.own_base, outcome.matched, outcome.reason], ['execute', [44, 21], null, 'official_boundary_or_terminal']);
      if (turn === 12) {
        assert.deepEqual([p.kind, index, plan.prepared_word, plan.expected_final_own_base, plan.candidates[0].object.base, outcome.reason],
          [probe, 0, [11, 9].map(label), [38, 37], [38, 13], 'return_operator_inserted']);
      }
      if (turn === 13) {
        const receipt = event('respondent_probe_result'), order = event('observed_respondent_order');
        assert.deepEqual([index, ticket.command!.actionRef, outcome.matched, outcome.reason, receipt.editing_composition_restored, receipt.official_progress],
          [1, 'ACTION5', null, 'respondent_packet_requires_scoped_reconciliation', true, false]);
        assert.deepEqual(receipt.results.map((s: Row) => [s.candidate.object.word, s.matching_packet_indices[0], s.universal_rule_confirmed]),
          [[[11, 8].map(label), 12, false], [[11, 9].map(label), 2, false]]);
        assert.deepEqual(order.order.map((s: Row) => [s.word, s.first_effect]), [[[11, 8].map(label), 12], [[10, 8, 8], 23]]);
        assert.deepEqual(order.evidence, receipt.evidence);
      }
      if (turn === 3 || turn === 11 || turn === 13) {
        t.diagnostic('line ' + ({ 3: 52, 11: 57, 13: 58 })[turn] + ' elapsed ms ' + Math.round(performance.now() - startTime));
        startTime = performance.now();
      }
    }
    assert.deepEqual([counts.get(edit), counts.get(program), counts.get(probe)], [3, 8, 2]);
    const next = await game.decision();
    assert.deepEqual([next.family, next.proposal.kind, next.command?.actionRef], ['containment', 'containment_and_contact', 'ACTION5']);
  });
}

test('52 refuses the same edit in this epoch after the returned collection stayed unchanged', async () => {
  const game = await start(), first = await game.decision();
  assert.deepEqual([first.proposal.kind, first.command?.data], [edit, { x: 4, y: 50 }]);
  const outcome = await game.advance({ ...observation(0), stepIndex: 1 }), next = await game.decision();
  assert.deepEqual([outcome.matched, outcome.reason, next.family, next.proposal.kind, next.command?.actionRef],
    [false, 'collection_edit_refuted', 'observed_frontier', 'experiment', 'ACTION5']);
});

test('57 loses the learned program at the identical level-two input without the fitted model', async t => {
  const apply = OccurrenceRecallAccess.prototype.applyEvent;
  let removed = 0;
  t.mock.method(OccurrenceRecallAccess.prototype, 'applyEvent', function (this: OccurrenceRecallAccess, e: Row) {
    if (e.kind === 'fitted_program_composition') { removed++; return; }
    return apply.call(this, e);
  });
  const game = await start();
  for (let i = 1; i <= 3; i++) { await game.decision(); await game.advance(); }
  const next = await game.decision();
  assert.ok(removed > 0);
  assert.deepEqual([next.family, next.proposal.kind, next.command?.data], ['animated_contact', 'measured_animated_contact', { x: 33, y: 24 }]);
});

test('58 retains witnessed movement with an incomplete animation and cannot establish respondent order', async t => {
  const apply = OccurrenceRecallAccess.prototype.applyEvent, orders: Row[] = [];
  let receipt: Row | undefined;
  t.mock.method(OccurrenceRecallAccess.prototype, 'applyEvent', function (this: OccurrenceRecallAccess, e: Row) {
    if (e.kind === 'respondent_probe_result') receipt = e;
    if (e.kind === 'observed_respondent_order') orders.push(e);
    return apply.call(this, e);
  });
  const game = await start();
  for (let i = 1; i < 13; i++) { await game.decision(); await game.advance(); }
  const ticket = await game.decision(), packet = observation(13);
  assert.equal(ticket.proposal.kind, probe);
  const outcome = await game.advance({ ...packet, frames: [packet.frame] }), next = await game.decision();
  assert.deepEqual([outcome.matched, receipt?.editing_composition_restored, orders.length, next.kind, next.command], [null, true, 0, 'stopped', null]);
  assert.deepEqual(receipt?.results.map((s: Row) => [s.candidate.object.word, s.matching_packet_indices, s.universal_rule_confirmed]),
    [[[11, 8], [0], false], [[11, 9], [], false]]);
  assert.equal(receipt?.evidence.at(-1), outcome.observation_ref);
});
