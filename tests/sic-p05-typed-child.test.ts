import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeCommand, NativeObservation } from '../src/logos-engine/v6-native-types.ts';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { controlEffectReturnMatches, measureControlEffectChild,
  type ControlEffectChild, type ControlEffectReturn } from '../src/sic/control-effect-child.ts';
import { createSicVerifyRemoteReplay } from '../src/sic/replay-access.ts';

const sample: Omit<V6PublicObservation, 'frame' | 'frames' | 'palette' | 'stepIndex'>
  & { frames: V6PublicObservation['frame'][] } = JSON.parse(gunzipSync(readFileSync(
    new URL('./fixtures/sic-replay-control-g50t-l1.json.gz', import.meta.url))).toString('utf8'));

function packet(stepIndex: number): V6PublicObservation {
  const { frames, ...state } = sample;
  const frame = frames[stepIndex]!;
  return { ...state, frame, frames: [frame], stepIndex };
}

async function replayChild(corruptOpening = false) {
  const family = createSicVerifyRemoteReplay(), original = family.record.bind(family);
  let fifth: { child: ControlEffectChild; result: ControlEffectReturn;
    transition: { before: NativeObservation; after: NativeObservation; command: NativeCommand } } | undefined;
  family.record = async (...args) => {
    const [before, after, command, , , proposal] = args;
    const child = proposal.controlEffectChild;
    if (child && command.action_ref === 'ACTION4') {
      if (corruptOpening) args[5] = { ...proposal, controlEffectChild: { ...child, opening: 'stale' } };
      const record = await original(...args);
      if (record.controlEffectReturn) fifth = { child, result: record.controlEffectReturn, transition: { before, after, command } };
      return record;
    }
    return original(...args);
  };
  const service = new V6AgentService(() => new NativeV6Runtime({
    families: [family], groups: [{ id: 'replay', families: [family.id] }], sourceDigest: 'p05-child',
    now: () => 0, maxPointOccurrences: 250, controlTrialAgenda: { mode: 'active', actionBudget: 1 },
  }));
  const sessionId = 'g50t-child-native';
  let reply = await service.handle({ type: 'init', sessionId, sequence: 0,
    observation: packet(0), budgets: { targetLevels: 1, levelActionCaps: [20] } });
  const conclusions: ControlEffectReturn[] = [];
  for (const [index, action] of ['ACTION1', 'ACTION2', 'ACTION1', 'ACTION3', 'ACTION4'].entries()) {
    if (!reply.ticket) reply = await service.handle({ type: 'resume', sessionId, sequence: index });
    const ticket = reply.ticket;
    assert.ok(ticket);
    assert.equal(ticket.actionRef, action);
    const plan = reply.snapshot.trace.findLast(event => event.kind === 'sic_native_plan')!;
    const child = plan.controlEffectChild as ControlEffectChild;
    assert.equal(child.status, 'awaiting_native_return');
    assert.equal(child.actionBudget, 1);
    assert.equal(child.need.parentObjective, (plan.need as { id: string }).id);
    assert.equal(child.opening, ticket.observationRef);
    assert.ok(!conclusions.some(result => result.beforeRef === child.opening));
    if (index === 4) assert.equal((family.state().state as { controls: Record<string, unknown> }).controls.ACTION4, undefined);
    reply = await service.handle({ type: 'advance', sessionId, sequence: index + 1, ticketId: ticket.id,
      observation: packet(index + 1), executionMs: 0 });
    const result = reply.snapshot.trace.filter(event => event.kind === 'native_composition_dependency')
      .map(event => event.control_effect_return as ControlEffectReturn | undefined).findLast(result => result?.beforeRef === child.opening);
    if (result) conclusions.push(result);
  }
  if (!reply.ticket) reply = await service.handle({ type: 'resume', sessionId, sequence: 5 });
  return { conclusions, fifth, next: reply.snapshot.proposal,
    state: family.state().state as { controls: Record<string, unknown>; controlEvidence: Record<string, string> } };
}

test('sealed native returns close the P05 child before the replay parent uses a measured direction', async () => {
  const run = await replayChild();
  assert.equal(run.conclusions[0]?.status, 'unresolved');
  assert.equal(run.conclusions[0]?.status === 'unresolved' && run.conclusions[0].reason, 'no_single_axis_step');
  const fifth = run.fifth!;
  assert.ok(fifth);
  assert.ok(fifth.result.status === 'observed_translation');
  assert.deepEqual(fifth.result.displacement, [6, 0]);
  assert.deepEqual(run.conclusions.at(-1), fifth.result);
  assert.equal(run.state.controlEvidence.ACTION4, fifth.result.afterRef);
  assert.deepEqual(run.state.controls.ACTION4, fifth.result.displacement);
  assert.equal(run.next?.sicLocalDecision?.strategy, 'P07');
  assert.deepEqual(run.next?.actions[0], { action_ref: 'ACTION4', data: {} });
  assert.deepEqual(run.next?.steps?.[0]?.expected_after, [26, 8]);
  assert.equal(run.next?.controlEffectChild, undefined);
});

test('a stale opening in the selected family record leaves the exact return without an acquired P05 vector', async () => {
  const wrong = await replayChild(true);
  assert.equal(wrong.fifth, undefined);
  assert.equal(wrong.conclusions.some(result => result.command.action_ref === 'ACTION4'), false);
  assert.equal(wrong.state.controlEvidence.ACTION4, undefined);
  assert.equal(wrong.state.controls.ACTION4, undefined);
  assert.notEqual(wrong.next?.sicLocalDecision?.strategy, 'P07');
});

test('a typed P05 result needs its exact subject, native command, two observations and measured vector', async () => {
  const { fifth } = await replayChild();
  const { child, result, transition } = fifth!;
  const { before, after, command } = transition;
  assert.ok(result.status === 'observed_translation');
  assert.ok(controlEffectReturnMatches(child, result, transition));
  for (const invalid of [{ ...result, subjectId: 'foreign' }, { ...result, beforeRef: after.observation_ref },
    { ...result, afterRef: before.observation_ref }, { ...result, command: { ...command, action_ref: 'ACTION5' } },
    { ...result, parentId: 'foreign' }, { ...result, displacement: [-6, 0] as const },
    { ...result, destination: [child.subject.start[0] - 6, child.subject.start[1]] as const, displacement: [-6, 0] as const }]) {
    assert.equal(controlEffectReturnMatches(child, invalid, transition), false);
  }
  assert.equal(controlEffectReturnMatches(child, result, { ...transition, after: { ...after, level_epoch: after.level_epoch + 1 } }), false);
  assert.equal(measureControlEffectChild({ ...child, subject: { ...child.subject, id: 'foreign' } }, transition), null);
});
