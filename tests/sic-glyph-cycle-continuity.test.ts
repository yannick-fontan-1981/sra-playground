import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation, type V6Ticket } from '../src/runtime/v6-agent-protocol.ts';
import { createSicFramedContact } from '../src/sic/framed-contact.ts';
import { glyphCycleRoom, type CycleChange } from './helpers/sic-glyph-cycle-room.ts';

async function start(varied = false) {
  const room = glyphCycleRoom(varied), family = createSicFramedContact();
  family.restore({ ...family.state(), ...room.retainedLayout() });
  assert.equal(family.state().glyphWorkshop.cycle, undefined, 'No station cycle is planted in the fixture');
  const records: { index: number; before: string; after: string }[] = [];
  const record = family.record.bind(family);
  family.record = (...args) => {
    records.push({ index: args[6], before: args[0].observation_ref, after: args[1].observation_ref });
    return record(...args);
  };
  const runtime = new NativeV6Runtime({ families: [family], sourceDigest: 'observed-glyph-cycle', maxPointOccurrences: 250 });
  const service = new V6AgentService(() => runtime), sessionId = 'glyph-cycle-' + varied;
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: toV6PublicObservation(room.packet()), budgets: { targetLevels: 1, levelActionCaps: [60] } });
  const tickets: V6Ticket[] = [];
  async function resume() {
    reply = await service.handle({ type: 'resume', sessionId, sequence });
    return reply;
  }
  async function next(change?: CycleChange, resume = true) {
    assert.ok(reply.ticket, JSON.stringify({ reason: reply.snapshot.reason, count: tickets.length }));
    const ticket = reply.ticket; tickets.push(ticket); room.act(ticket, change);
    reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: ticket.id, executionMs: 1,
      observation: toV6PublicObservation(room.packet(change), sequence) });
    if (resume && reply.kind === 'boundary' && !room.completed) reply = await service.handle({ type: 'resume', sessionId, sequence });
    return reply;
  }
  while (reply.ticket && reply.snapshot.proposal?.actions.length === 1) {
    assert.ok(tickets.length < 25, 'The native returns must establish the moving cycle');
    await next();
  }
  assert.ok(reply.snapshot.proposal?.actions.length >= 3);
  assert.equal(family.state().glyphWorkshop.cycle.length, 5);
  assert.ok(records.length >= 10, 'The period requires two physical repetitions before reuse');
  assert.ok(family.state().glyphWorkshop.refs.every((ref: string) => ref.startsWith(sessionId + ':')));
  assert.ok(family.state().glyphWorkshop.refs.every((ref: string) => records.some(row => row.after === ref)),
    'The phase witnesses belong to actual native acquisitions in this session');
  return { room, family, runtime, records, tickets, next, resume, get reply() { return reply; } };
}

for (const varied of [false, true]) test('native measured station phases continue until the actual walking prefix is sealed'
  + (varied ? ' with reflected positions, changed shape, pitch, palette and opposite commands' : ''), async () => {
  const run = await start(varied);
  try {
    const before = structuredClone(run.family.state()), count = run.records.length;
    const proposal = run.reply.snapshot.proposal!, decision = run.reply.ticket!.decisionRevision, length = proposal.actions.length;
    assert.ok(proposal.actions.every(action => action.action_ref === run.room.forward));
    for (let index = 0; index < length; index++) {
      assert.equal(run.reply.ticket?.decisionRevision, decision);
      assert.equal(run.reply.ticket?.actionIndex, index);
      await run.next(undefined, false);
      const outcome = run.reply.snapshot.trace.findLast(event => event.kind === 'actual_outcome');
      assert.equal(outcome?.matched, true);
      if (index + 1 < length) {
        assert.equal(run.records.length, count, 'Guard observations do not acquire before sealing');
        assert.deepEqual(run.family.state(), before);
      }
    }
    assert.equal(run.records.length, count + length);
    assert.deepEqual(run.records.slice(-length).map(row => row.index), Array.from({ length }, (_, i) => i));
    assert.equal(new Set(run.records.map(row => row.before + '/' + row.after)).size, run.records.length);
    assert.equal(run.reply.snapshot.trace.filter(event => event.kind === 'sealed_prefix' && event.revision === decision).length, 1);
    assert.equal(run.reply.snapshot.trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, length);
    assert.equal(run.family.state().glyphWorkshop.cycle.length, 5);
    if (run.reply.kind === 'boundary' && !run.room.completed) {
      const reply = await run.resume();
      assert.equal(reply.ticket?.actionIndex, 0);
      assert.equal(reply.snapshot.proposal?.actions.length, 1, 'The first goal contact remains its own decision');
    }
    while (!run.room.completed) { assert.ok(run.tickets.length < 30); await run.next(); }
    assert.equal(run.reply.snapshot.levelsCompleted, 1);
    assert.equal(run.records.length, run.tickets.length);
    assert.equal(new Set(run.records.map(row => row.before + '/' + row.after)).size, run.tickets.length);
  } finally { run.runtime.close('test_complete'); }
});

for (const change of ['phase', 'position', 'ambiguous', 'missing'] as const) test('native workshop continuation seals its executed prefix on a contradictory ' + change, async () => {
  const run = await start(change === 'position');
  try {
    const count = run.records.length, retained = structuredClone(run.family.state().transfer);
    const layout = structuredClone(run.family.state().glyphWorkshop.layout);
    await run.next(undefined, false);
    assert.equal(run.reply.ticket?.actionIndex, 1);
    assert.equal(run.records.length, count);
    await run.next(change, false);
    assert.equal(run.reply.kind, 'boundary');
    assert.equal(run.reply.ticket, null);
    assert.equal(run.reply.snapshot.trace.findLast(event => event.kind === 'actual_outcome')?.matched, false);
    assert.equal(run.reply.snapshot.trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 2);
    assert.deepEqual(run.records.slice(-2).map(row => row.index), [0, 1]);
    assert.equal(run.records.length, count + 2);
    assert.deepEqual(run.family.state().transfer, retained);
    assert.deepEqual(run.family.state().glyphWorkshop.layout.actor, layout.actor);
    assert.deepEqual(run.family.state().glyphWorkshop.layout.reserve, layout.reserve);
    if (change === 'phase') {
      assert.equal(run.family.state().glyphWorkshop.cycle, undefined, 'Only the contradicted phase law is withdrawn');
      assert.equal(run.family.state().glyphWorkshop.history.length, 1);
    }
  } finally { run.runtime.close('test_complete'); }
});
