import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation, type V6Ticket } from '../src/runtime/v6-agent-protocol.ts';
import { createSicCarryToFrame } from '../src/sic/carry-to-frame.ts';
import { passengerRoom, type PassengerChange } from './helpers/sic-passenger-room.ts';

async function start(varied = false) {
  const room = passengerRoom(varied), family = createSicCarryToFrame();
  family.restore!(await room.priorTransport());
  assert.equal(family.state().guarded, null, 'No passenger association, route or hazard is planted');
  const records: { index: number; before: string; after: string }[] = [];
  let activeProposal: any;
  const beforeGuard = family.before.bind(family);
  family.before = (...args) => { activeProposal = args[0]; return beforeGuard(...args); };
  const record = family.record.bind(family);
  family.record = (...args) => {
    records.push({ index: args[6], before: args[0].observation_ref, after: args[1].observation_ref });
    return record(...args);
  };
  const runtime = new NativeV6Runtime({ families: [family], sourceDigest: 'public-guarded-passenger-room', maxPointOccurrences: 100 });
  const service = new V6AgentService(() => runtime), sessionId = 'guarded-passengers-' + varied;
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: toV6PublicObservation(room.packet()), budgets: { targetLevels: 1, levelActionCaps: [250] } });
  const tickets: V6Ticket[] = [];
  async function resume() { reply = await service.handle({ type: 'resume', sessionId, sequence }); return reply; }
  async function next(change?: PassengerChange, keepRunning = true) {
    assert.ok(reply.ticket, JSON.stringify({ reason: reply.snapshot.reason, count: tickets.length }));
    const ticket = reply.ticket; tickets.push(ticket); room.act(ticket, change);
    reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: ticket.id, executionMs: 1,
      observation: toV6PublicObservation(room.packet(change), sequence) });
    if (keepRunning && reply.kind === 'boundary' && !room.completed) await resume();
    return reply;
  }
  assert.ok(reply.snapshot.proposal?.guarded, 'The native owner rebinds the declared transport to this new public room');
  assert.ok(reply.snapshot.proposal.actions.length >= 2, 'The first needed route retains its ordinary walking prefix');
  return { room, family, runtime, records, tickets, next, resume, get reply() { return reply; }, get activeProposal() { return activeProposal; } };
}

for (const varied of [false, true]) test('native passenger transport retains known walks before distinct pickup, crossing and release contacts'
  + (varied ? ' with other shapes, palette, positions, stride and commands' : ''), async () => {
  const run = await start(varied);
  try {
    const before = structuredClone(run.family.state()), decision = run.reply.ticket!.decisionRevision;
    const length = run.reply.snapshot.proposal!.actions.length;
    for (let index = 0; index < length; index++) {
      assert.equal(run.reply.ticket?.actionIndex, index);
      assert.equal(run.reply.ticket?.decisionRevision, decision);
      await run.next(undefined, false);
      assert.equal(run.reply.snapshot.trace.findLast(event => event.kind === 'actual_outcome')?.matched, true);
      if (index + 1 < length) {
        assert.equal(run.records.length, 0, 'Guard returns do not publish acquired state before sealing');
        assert.deepEqual(run.family.state(), before);
      }
    }
    assert.equal(run.records.length, length);
    assert.deepEqual(run.records.map(row => row.index), Array.from({ length }, (_, i) => i));
    assert.equal(run.reply.snapshot.trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, length);
    await run.resume();
    assert.equal(run.reply.snapshot.proposal?.actions.length, 1);
    assert.equal(run.reply.ticket?.actionRef, 'ACTION5', 'Pickup is an actual separate contact');
    let carriedContinuation = false;
    while (!run.room.completed) {
      assert.ok(run.tickets.length < 230);
      const proposal = run.activeProposal;
      if (proposal?.guarded?.at.held !== null && proposal?.actions.length > 1) carriedContinuation = true;
      if (proposal?.guarded && proposal.guarded.plan[0]?.role !== 'move') assert.equal(proposal?.actions.length, 1);
      await run.next();
    }
    assert.equal(run.reply.snapshot.levelsCompleted, 1);
    assert.equal(carriedContinuation, true);
    assert.ok(run.room.resets >= 2, 'The new room supplies actual contradictory animations before unsafe pairs are acquired');
    const state = run.family.state() as any;
    assert.equal(state.guarded.hazards.length, 2);
    assert.ok(state.guarded.hazardRefs.every((ref: string) => run.records.some(record => record.after === ref)));
    assert.equal(run.records.length, run.tickets.length);
    assert.equal(new Set(run.records.map(record => record.before + '/' + record.after)).size, run.tickets.length);
  } finally { run.runtime.close('test_complete'); }
});

for (const change of ['blocked', 'missing', 'ambiguous', 'passenger'] as const) test('native passenger series stops on a contradictory ' + change, async () => {
  const run = await start();
  try {
    const prior = structuredClone(run.family.state().previousDelivery);
    await run.next(change, false);
    assert.equal(run.reply.kind, 'boundary');
    assert.equal(run.reply.ticket, null);
    assert.equal(run.reply.snapshot.trace.findLast(event => event.kind === 'actual_outcome')?.matched, false);
    assert.equal(run.reply.snapshot.trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 1);
    assert.equal(run.records.length, 1);
    assert.equal(run.tickets.length, 1);
    assert.deepEqual(run.family.state().previousDelivery, prior, 'Independent transport knowledge remains documented');
  } finally { run.runtime.close('test_complete'); }
});

test('a passenger continuation requires its actual preceding observation and cannot acquire twice through repeated guards', async () => {
  const run = await start();
  try {
    const proposal = run.activeProposal;
    await run.next(undefined, false);
    assert.equal(run.reply.ticket?.actionIndex, 1);
    const current = (run.runtime as any).observation, packet = toV6PublicObservation(run.room.packet());
    const before = structuredClone(run.family.state());
    assert.equal((await run.family.before(proposal, 1, packet, current)).admitted, true);
    assert.equal((await run.family.before(proposal, 1, packet, current)).admitted, true);
    for (const changed of [{ ...current, observation_ref: 'missing-predecessor' },
      { ...current, observation_ref: current.observation_ref.replace('guarded-passengers-', 'foreign-session-') },
      { ...current, level_epoch: current.level_epoch + 1 }]) {
      assert.equal((await run.family.before(proposal, 1, packet, changed)).admitted, false);
    }
    assert.equal(run.records.length, 0);
    assert.deepEqual(run.family.state(), before);
    await run.next(undefined, false);
    assert.equal(run.records.length, 2);
    assert.deepEqual(run.records.map(row => row.index), [0, 1]);
  } finally { run.runtime.close('test_complete'); }
});
