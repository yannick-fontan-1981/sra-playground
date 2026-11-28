import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeV6Runtime, type NativeV6RuntimeConfiguration } from '../src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation, type V6Ticket } from '../src/runtime/v6-agent-protocol.ts';
import { createSicPairedPassage, pairedPassageId } from '../src/sic/paired-passage.ts';
import type { ControlTrialComparison } from '../src/sic/control-effect-next.ts';
import { pairedPassageRoom, type PassageChange } from './helpers/sic-paired-passage-room.ts';
import { nativeAfterPublicBoundaries } from './helpers/sic-native-public-boundaries.ts';

async function start(variant = false, evaluation?: Pick<NativeV6RuntimeConfiguration, 'observeControlTrialShadow' | 'controlTrialAgenda'>) {
  const room = pairedPassageRoom(variant), family = createSicPairedPassage();
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [family], sourceDigest: 'paired-passage-transfer',
    maxPointOccurrences: 250, groups: [{ id: 'follow_visible_passages', families: [pairedPassageId] }], ...evaluation }));
  const sessionId = 'passage-' + variant;
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: toV6PublicObservation(room.packet()), budgets: { targetLevels: 3, levelActionCaps: [30, 30, 30] } });
  const tickets: V6Ticket[] = [];
  async function next(options: { contradictory?: boolean; change?: PassageChange; resume?: boolean } = {}) {
    assert.ok(reply.ticket, JSON.stringify({ reason: reply.snapshot.reason, status: reply.kind, level: room.level }));
    const ticket = reply.ticket; tickets.push(ticket); room.act(ticket, options.contradictory);
    reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: ticket.id, executionMs: 1,
      observation: toV6PublicObservation(room.packet(options.change), sequence) });
    if (!reply.ticket && room.completed < 3 && options.resume !== false) reply = await service.handle({ type: 'resume', sessionId, sequence });
    return reply;
  }
  while (room.level < 3) { assert.ok(tickets.length < 40); await next(); }
  return { room, family, tickets, next, get reply() { return reply; } };
}

for (const variant of [false, true]) test('native known walking approaches a rewiring contact and keeps the contact unitary'
  + (variant ? ' with reflected positions, larger shapes, recoloring and opposite commands' : ''), async () => {
  const run = await start(variant), previous = structuredClone(run.family.state().previous);
  assert.ok(previous.outlet?.refs.length >= 2 && previous.visitedInk !== undefined);
  const proposal = run.reply.snapshot.proposal!;
  assert.equal(proposal.sicSituationCard?.strategy, 'P07');
  assert.equal(proposal.actions.length, 2);
  assert.ok(proposal.actions.every(action => action.action_ref === run.room.forward));
  assert.equal(proposal.route.steps.length, 3);
  assert.deepEqual(proposal.route.switchTest, run.room.point(3));
  assert.ok(proposal.sicSituationCard?.evidence.includes(previous.ref));
  await run.next();
  assert.equal(run.reply.ticket?.actionIndex, 1);
  assert.equal(run.room.rewired, false);
  await run.next();
  assert.equal(run.reply.ticket?.actionIndex, 0);
  assert.equal(run.reply.snapshot.proposal?.actions.length, 1);
  assert.equal(run.reply.snapshot.proposal?.sicSituationCard?.strategy, 'P05');
  await run.next();
  assert.equal(run.room.rewired, true);
  assert.ok(run.reply.snapshot.trace.some(event => event.kind === 'actual_outcome'
    && event.reason === 'passage_connections_rewritten_at_landing'));
  while (run.room.completed < 3) { assert.ok(run.tickets.length < 60); await run.next(); }
  assert.equal(run.room.completed, 3);
  assert.ok(run.reply.snapshot.trace.some(event => event.kind === 'sealed_prefix' && event.acquired_actions === 2));
});

for (const change of ['actor', 'indicator', 'outlet', 'switch', 'command'] as const) test('native passage continuation refuses a changed '
  + change + ' before dispatching its next walk', async () => {
  const run = await start(), previous = structuredClone(run.family.state().previous), count = run.tickets.length;
  await run.next({ change, resume: false });
  assert.equal(run.tickets.length, count + 1);
  assert.ok(!run.reply.ticket);
  assert.equal(run.reply.kind, 'boundary');
  assert.deepEqual(run.family.state().previous, previous);
  assert.ok(run.reply.snapshot.trace.some(event => event.kind === 'sealed_prefix' && event.acquired_actions === 1));
});

test('a contradictory passage walk seals only its executed prefix and keeps earlier transfer evidence', async () => {
  const run = await start(true), previous = structuredClone(run.family.state().previous);
  await run.next({ contradictory: true, resume: false });
  assert.ok(!run.reply.ticket);
  assert.equal(run.reply.kind, 'boundary');
  assert.ok(run.reply.snapshot.trace.some(event => event.kind === 'actual_outcome' && event.matched === false));
  assert.ok(run.reply.snapshot.trace.some(event => event.kind === 'sealed_prefix' && event.acquired_actions === 1));
  assert.deepEqual(run.family.state().previous, previous);
});

test('the patterned walk is not admitted without the earlier passage and outlet witness', async () => {
  const run = await start(), saved = structuredClone(run.family.state()), isolatedFamily = createSicPairedPassage();
  isolatedFamily.restore({ ...saved, previous: null });
  const isolated = await nativeAfterPublicBoundaries(isolatedFamily, run.room.packet(), 'missing-passage-witness', 30,
    'follow_visible_passages');
  assert.ok(!isolated.reply.ticket);
  assert.equal(isolatedFamily.state().previous, null);
});

for (const variant of [false, true]) test('the local P05 budget controls the switch contact after a retained approach, variant ' + variant, async () => {
  const reference = await start(variant);
  const accepted: ControlTrialComparison[] = [], refused: ControlTrialComparison[] = [];
  const active = await start(variant, { controlTrialAgenda: { mode: 'active', actionBudget: 1 },
    observeControlTrialShadow: comparison => { accepted.push(comparison); } });
  const withheld = await start(variant, { controlTrialAgenda: { mode: 'active', actionBudget: 0 },
    observeControlTrialShadow: comparison => { refused.push(comparison); } });
  for (const passage of [reference, active, withheld]) {
    assert.equal(passage.reply.snapshot.proposal?.sicSituationCard?.strategy, 'P07');
    await passage.next();
    assert.equal(passage.reply.ticket?.actionIndex, 1);
    await passage.next();
    assert.equal(passage.room.rewired, false);
  }
  assert.equal(accepted.length, 1);
  assert.equal(refused.length, 1);
  assert.equal(accepted[0]?.firstDifference, null);
  assert.equal(refused[0]?.firstDifference, 'selected');
  assert.equal(withheld.reply.ticket, null);
  assert.equal(active.reply.ticket?.actionRef, reference.reply.ticket?.actionRef);
  assert.equal(active.reply.snapshot.proposal?.sicSituationCard?.strategy, 'P05');
  await Promise.all([reference.next(), active.next()]);
  assert.deepEqual(active.room.packet(), reference.room.packet());
  assert.ok(active.reply.snapshot.trace.some(event => event.kind === 'actual_outcome'
    && event.reason === 'passage_connections_rewritten_at_landing'));
  assert.equal(withheld.room.rewired, false);
});
