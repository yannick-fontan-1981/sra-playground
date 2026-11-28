import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeCommand, NativeObservation, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';
import { SlidingCavity } from '../src/logos-engine/v6-sliding-cavity.ts';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import type { ControlTrialComparison } from '../src/sic/control-effect-next.ts';
import { bindMissingControlTrial, evaluateMissingControl, missingControlNeed, missingControlWitness } from '../src/sic/missing-control-strategy.ts';
import { createSicVerifyRemoteReplay, verifyRemoteReplayId } from '../src/sic/replay-access.ts';

function fixture<T>(name: string): T {
  return JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/' + name, import.meta.url))).toString('utf8'));
}

test('P05 shadow independently ranks one prepared trial, records the first difference and isolates the observer', () => {
  const action = 'ACTION1', observationRef = 'revision:4';
  const proposal = { actions: [{ action_ref: action, data: {} }], binding: { observation_ref: observationRef } };
  const context = { observationRef, availableActions: [action], objectiveSupported: true, subjectBound: true,
    effectKnown: false, triedInContext: false, evidence: [observationRef, 'method:retained'] };
  const comparisons: ControlTrialComparison[] = [];
  const observer = { family: 'test', remaining: 1, observe: (receipt: ControlTrialComparison) => comparisons.push(receipt) };

  for (const [facts, expected] of [[{ ...context, evidence: [] }, 'undetermined'],
    [{ ...context, effectKnown: true }, 'inapplicable'], [context, 'applicable']] as const) {
    const active = evaluateMissingControl(proposal, action, facts, observer);
    const receipt = comparisons.at(-1)!;
    assert.equal(receipt.need, missingControlNeed);
    assert.equal(receipt.shadow.applicability, expected);
    assert.equal(receipt.shadow.selected, expected === 'applicable');
    assert.deepEqual(receipt.shadow.evidence, active.evidence ?? []);
    assert.equal(receipt.firstDifference, null);
  }
  assert.match(comparisons[0]!.shadow.reason, /Evidence missing/);
  assert.match(comparisons[1]!.shadow.reason, /Condition not met/);

  const active = evaluateMissingControl(proposal, action, context, { ...observer, remaining: 0 });
  assert.equal(active.result, 'selected'); // Deliberate out-of-budget invocation at the comparison boundary.
  const exhausted = comparisons.at(-1)!;
  assert.equal(exhausted.cost, 1);
  assert.equal(exhausted.shadow.selected, false);
  assert.equal(exhausted.firstDifference, 'selected');
  assert.match(exhausted.shadow.reason, /One action/);

  bindMissingControlTrial(proposal, context, { ...observer, observe(receipt) {
    (receipt.reference.evidence as string[]).push('foreign');
    throw new Error('Diagnostic sink failed');
  } });
  assert.deepEqual(missingControlWitness(proposal, action, observationRef)?.evidence, context.evidence);
});

type CavityStep = {
  beforeState: Parameters<SlidingCavity['restore']>[0];
  before: { observation: NativeObservation; public: NativePublicObservation };
  after: { observation: NativeObservation; public: NativePublicObservation };
  remaining: number;
  command: NativeCommand;
};

test('recorded AS66 direction questions keep their proposal, witness, guards and acquired state with shadow', async () => {
  const { steps } = fixture<{ games: { code: string; steps: CavityStep[] }[] }>('v6-sliding-cavity-reference.json.gz')
    .games.find(game => game.code === 'AS66')!;
  for (const [index, action] of [[4, 'ACTION1'], [5, 'ACTION4']] as const) {
    const step = steps[index]!;
    const { before, after } = step;
    const comparisons: ControlTrialComparison[] = [];
    async function run(enabled: boolean) {
      const family = new SlidingCavity();
      family.restore(step.beforeState);
      const rows = before.public.frame_rows, returned = after.public.frame_rows;
      const proposal = await family.propose(before.observation, rows, [], step.remaining, {
        yieldControl: async () => {},
        ...(enabled ? { observeControlTrialShadow: (receipt: ControlTrialComparison) => comparisons.push(receipt) } : {}),
      });
      assert.equal(proposal?.kind, 'cavity_direction_question');
      assert.equal(proposal?.actions[0].action_ref, action);
      const witness = missingControlWitness(proposal!, action, before.observation.observation_ref);
      assert.ok(witness);
      const guard = family.before(proposal!, 0, before.public, before.observation);
      const outcome = family.after(proposal!, 0, before.observation, after.observation, rows, returned);
      const record = family.record(before.observation, after.observation, step.command, rows, returned, proposal!, 0, after.public.frame_packet);
      return { proposal, witness, guard, outcome, record, state: family.state() };
    }
    const reference = await run(false);
    assert.deepEqual(comparisons, []);
    assert.deepEqual(await run(true), reference);
    assert.equal(comparisons.length, 1);
    const receipt = comparisons[0]!;
    assert.equal(receipt.family, 'sliding_cavity');
    assert.equal(receipt.action, action);
    assert.equal(receipt.observationRef, before.observation.observation_ref);
    assert.deepEqual(receipt.shadow.evidence, reference.witness.evidence);
    assert.equal(receipt.shadow.selected, true);
    assert.equal(receipt.firstDifference, null);
  }
});

test('native G50T compares the prepared probes and the real fifth return still gives the sixth access ticket', async () => {
  const sample = fixture<Omit<V6PublicObservation, 'frame' | 'frames' | 'palette' | 'stepIndex'>
    & { frames: V6PublicObservation['frame'][] }>('sic-replay-control-g50t-l1.json.gz');
  const { frames, ...publicState } = sample;
  const comparisons: ControlTrialComparison[] = [];
  async function run(enabled: boolean) {
    const family = createSicVerifyRemoteReplay();
    const service = new V6AgentService(() => new NativeV6Runtime({ families: [family], sourceDigest: 'p05-shadow',
      now: () => 0, maxPointOccurrences: 250, groups: [{ id: 'replay', families: [family.id] }],
      ...(enabled ? { observeControlTrialShadow: receipt => comparisons.push(receipt) } : {}),
    }));
    const sessionId = 'g50t-shadow-parity';
    const observation = (stepIndex: number): V6PublicObservation => {
      const frame = frames[stepIndex]!;
      return { ...publicState, frame, frames: [frame], stepIndex };
    };
    let reply = await service.handle({ type: 'init', sessionId, sequence: 0, observation: observation(0),
      budgets: { targetLevels: 1, levelActionCaps: [20] } });
    const observed = [];
    for (const [index, actionRef] of ['ACTION1', 'ACTION2', 'ACTION1', 'ACTION3', 'ACTION4', 'ACTION4'].entries()) {
      if (!reply.ticket) reply = await service.handle({ type: 'resume', sessionId, sequence: index });
      const ticket = reply.ticket;
      assert.ok(ticket, `G50T turn ${index + 1}: ${reply.snapshot.reason}`);
      assert.equal(ticket.actionRef, actionRef);
      assert.equal(reply.snapshot.proposal?.sicLocalDecision?.strategy, index < 5 ? 'P05' : 'P07');
      observed.push({ command: { actionRef: ticket.actionRef, data: ticket.data }, proposal: reply.snapshot.proposal, state: family.state(),
        returns: reply.snapshot.trace.filter(event => event.kind === 'actual_outcome') });
      if (index < 5) reply = await service.handle({ type: 'advance', sessionId, sequence: index + 1, ticketId: ticket.id,
        executionMs: 1, observation: observation(index + 1) });
    }
    return observed;
  }
  const reference = await run(false);
  assert.deepEqual(comparisons, []);
  assert.deepEqual(await run(true), reference);
  assert.deepEqual(comparisons.map(({ family, action, reference, shadow, firstDifference }) =>
    [family, action, reference.selected, shadow.selected, firstDifference]),
  ['ACTION1', 'ACTION2', 'ACTION1', 'ACTION3', 'ACTION4'].map(action => [verifyRemoteReplayId, action, true, true, null]));
  const last = reference.at(-1)!;
  assert.equal(last.returns.length, 5);
  assert.equal(last.returns.at(-1)?.matched, null);
  assert.deepEqual(last.state.state.controls.ACTION4, [6, 0]);
  assert.equal(last.state.state.controlEvidence.ACTION4, last.returns.at(-1)?.observation_ref);
  assert.deepEqual(last.proposal?.steps?.[0]?.expected_after, [26, 8]);
});
