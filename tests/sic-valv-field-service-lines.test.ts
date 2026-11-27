import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import { FieldServiceMemory, fieldServiceBefore } from '../src/logos-engine/v6-field-service-access.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation, type V6Command, type V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

type Row = Record<string, any>;
const archive = JSON.parse(gunzipSync(readFileSync(new URL('../docs/migration/native-campaigns-v51/valv-public-trace.json.gz', import.meta.url))).toString());
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, source), 'utf8'));
const declarations = { common: read('laya_proto/common_frontier_policy.drm.json'), strategy: read('morphology_policy/strategy.drm') };
const fill = 'envelope_fill_experiment', field = 'field_service_experiment', transfer = 'field_service_transfer_experiment';

function observation(turn: number): V6PublicObservation {
  const p = archive.packets[turn].packet;
  return { frame: p.frame_rows, frames: p.frame_packet, availableActionIds: p.available_action_refs.map((a: string) => Number(a.slice(6))),
    state: p.state, level: p.level, levelsCompleted: p.levels_completed, stepIndex: p.step_index };
}

async function start(live = false) {
  const backend = live && process.env.SIC_VALV_GAME_ROOT ? await sourceBackend(process.env.SIC_VALV_GAME_ROOT) : null;
  function input(turn: number, command?: V6Command) {
    const expected = observation(turn);
    if (!backend) return expected;
    const board = backend.dispatch(command ? { type: 'action', actionId: Number(command.actionRef.slice(6)), data: command.data } : { type: 'load', code: 'VALV', level: 1 });
    const packet = toV6PublicObservation(board, turn), { palette, ...fields } = packet;
    assert.deepEqual(fields, expected, 'public VALV return ' + turn);
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
      return { command: reply.command, kind: reply.kind, id: reply.ticket?.id, proposal,
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

test('VALV releases the three catalog experiments, acquires their distinct measurements and resumes through the same service', async t => {
  const acquired = new Map<string, Row[]>(), record = FieldServiceMemory.prototype.record;
  t.mock.method(FieldServiceMemory.prototype, 'record', function (this: FieldServiceMemory, ...args: Parameters<typeof record>) {
    const events = record.apply(this, args);
    acquired.set(args[2].observation_ref, events);
    return events;
  });
  const game = await start(true), counts = new Map<string, number>();
  for (let turn = 1; turn <= 16; turn++) {
    const ticket = await game.decision(), p = ticket.proposal, plan = p.nested_control_plan;
    assert.deepEqual([ticket.family, p.field_subquestion, ticket.guard?.admitted, ticket.guard?.index],
      ['public_occurrence_recall', 'field_service_composition', true, 0]);
    counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1);
    const meta = { epoch: plan.epoch, score: plan.score, available: ['ACTION6'], observation_ref: 'expired' };
    assert.equal(fieldServiceBefore(p, 0, observation(turn - 1).frame, meta).admitted, false);
    const outcome = await game.advance(), events = acquired.get(outcome.observation_ref)!;
    assert.deepEqual([outcome.matched, outcome.reason], [null, 'unknown_control_response_observed']);
    const event = (kind: string) => {
      const found = events.find(e => e.kind === kind);
      assert.ok(found, kind);
      assert.deepEqual(found.evidence, [plan.observation_ref, outcome.observation_ref]);
      return found;
    };
    if (turn === 1) assert.equal(event('envelope_fill_context').context.phase, 'repeat');
    if (turn === 2) {
      assert.deepEqual([p.kind, plan.phase, plan.selected.point], [fill, 'repeat', [32, 50]]);
      const ctx = event('envelope_fill_context').context;
      assert.deepEqual([ctx.repeatable_extent_change, ctx.phase], [false, 'contrast']);
    }
    if (turn === 3) assert.deepEqual([p.kind, plan.phase, plan.selected.point], [fill, 'contrast', [8, 50]]);
    if (turn === 4) assert.equal(event('envelope_fill_context').context.restored_measured_fields, true);
    if (turn === 5) {
      assert.deepEqual([p.kind, plan.phase, plan.selected.point], [field, 'isolate', [50, 33]]);
      const ctx = event('field_service_context').context;
      assert.deepEqual([ctx.field_contents_preserved, ctx.paired_control_orientation_changed, ctx.phase], [true, true, 'serve']);
    }
    if (turn === 6) assert.deepEqual([p.kind, plan.phase, plan.selected.point], [field, 'serve', [32, 50]]);
    if (turn === 10) assert.deepEqual(event('field_service_transfer').model.official_boundary_witness, [plan.observation_ref, outcome.observation_ref]);
    if (turn === 11) {
      assert.deepEqual([p.kind, plan.epoch, plan.phase, plan.selected.point], [transfer, 2, 'revalidate_source_access', [11, 35]]);
      const attempts = event('field_service_transfer').context.attempted_controls;
      assert.deepEqual([attempts.at(-1).point, attempts.at(-1).from, attempts.at(-1).to], [[11, 35], 'horizontal', 'vertical']);
    }
    if (turn === 12) assert.deepEqual([p.kind, plan.phase, plan.selected.point], [transfer, 'revalidate_conditional_service', [32, 51]]);
  }
  assert.deepEqual([counts.get(fill), counts.get(field), counts.get(transfer)], [3, 6, 6]);
});

for (const [prior, excluded] of [[1, fill], [4, field]] as const) {
  test('VALV rejects ' + excluded + ' when the previous click returns the unchanged board', async () => {
    const game = await start();
    for (let i = 1; i < prior; i++) { await game.decision(); await game.advance(); }
    const previous = await game.decision();
    const same = { ...observation(prior - 1), stepIndex: prior };
    assert.deepEqual(previous.command?.data, archive.packets[prior].command.data);
    await game.advance(same);
    const next = await game.decision();
    if (prior === 1) {
      assert.deepEqual([next.kind, next.family, next.proposal.kind, next.command?.data], ['action', 'observed_frontier', 'experiment', { x: 12, y: 33 }]);
    } else {
      assert.equal(next.kind, 'stopped');
      assert.equal(next.command, null);
    }
  });
}

test('VALV rejects transfer on the same new epoch image without its dated official boundary', async t => {
  const apply = FieldServiceMemory.prototype.applyEvent;
  let removed = 0;
  t.mock.method(FieldServiceMemory.prototype, 'applyEvent', function (this: FieldServiceMemory, event: Row) {
    if (event.kind === 'field_service_transfer' && event.model?.official_boundary_witness) {
      event = structuredClone(event);
      delete event.model.official_boundary_witness;
      removed++;
    }
    return apply.call(this, event);
  });
  const game = await start();
  for (let i = 1; i <= 10; i++) { await game.decision(); await game.advance(); }
  const decision = await game.decision();
  assert.ok(removed > 0);
  assert.deepEqual([decision.kind, decision.family, decision.proposal.kind, decision.command?.data],
    ['action', 'public_occurrence_recall', 'nested_control_experiment', { x: 32, y: 51 }]);
});
