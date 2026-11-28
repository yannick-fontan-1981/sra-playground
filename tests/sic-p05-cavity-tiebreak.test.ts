import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeExecution, NativeObservation, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';
import { SlidingCavity } from '../src/logos-engine/v6-sliding-cavity.ts';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import type { ControlTrialComparison } from '../src/sic/control-effect-next.ts';
import { missingControlWitness } from '../src/sic/missing-control-strategy.ts';

function fixture<T>(name: string): T {
  return JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/' + name, import.meta.url))).toString('utf8'));
}

type RecordedStep = {
  beforeState: Parameters<SlidingCavity['restore']>[0];
  before: { observation: NativeObservation; public: NativePublicObservation };
  remaining: number;
};
const { steps } = fixture<{ games: { code: string; steps: RecordedStep[] }[] }>('v6-sliding-cavity-reference.json.gz')
  .games.find(game => game.code === 'AS66')!;
const beforeTie = steps[4]!;

function restored(step: RecordedStep) {
  const family = new SlidingCavity();
  family.restore(step.beforeState);
  return family;
}

function configuration(receipts: ControlTrialComparison[], budget?: 0 | 1): NativeExecution {
  return { yieldControl: async () => {}, observeControlTrialShadow: receipt => receipts.push(receipt),
    ...(budget === undefined ? {} : { controlTrialAgenda: { mode: 'active', actionBudget: budget } }) };
}

test('AS66 ranks both prepared directions with the same facts and historical order', async () => {
  const { observation, public: packet } = beforeTie.before;
  assert.equal(observation.frame_hash, 'fb4c841eea2f859a');
  const baseline = await restored(beforeTie).propose(observation, packet.frame_rows, [], beforeTie.remaining);
  assert.equal(baseline?.actions[0].action_ref, 'ACTION1');
  for (const budget of [undefined, 1, 0] as const) {
    const family = restored(beforeTie), receipts: ControlTrialComparison[] = [];
    const reversed = { ...observation, available_action_refs: [...observation.available_action_refs].reverse() };
    const offered = await family.propose(reversed, packet.frame_rows, [], beforeTie.remaining, configuration(receipts, budget));
    assert.deepEqual(offered, budget === 0 ? null : baseline);
    assert.deepEqual(family.directions, beforeTie.beforeState.directions);
    assert.equal(receipts.length, 1);
    const receipt = receipts[0]!;
    assert.equal(receipt.observationRef, observation.observation_ref);
    assert.deepEqual(receipt.offers?.map(({ action, cost, applicability, result }) => [action, cost, applicability, result]), [
      ['ACTION1', 1, 'applicable', budget === 0 ? 'skipped' : 'selected'],
      ['ACTION4', 1, 'applicable', budget === 0 ? 'skipped' : 'lower_priority'],
    ]);
    assert.deepEqual(receipt.offers?.[0]?.evidence, receipt.offers?.[1]?.evidence);
    assert.equal(receipt.firstDifference, budget === 0 ? 'selected' : null);
  }
  const afterFirst = steps[5]!, single: ControlTrialComparison[] = [];
  await restored(afterFirst).propose(afterFirst.before.observation, afterFirst.before.public.frame_rows,
    [], afterFirst.remaining, configuration(single, 1));
  assert.deepEqual(single[0]?.offers?.map(offer => offer.action), ['ACTION4']);
});

test('withholding just the first scoped offer lets ACTION4 acquire its real direction and a verified access', async () => {
  const { observation, public: packet } = beforeTie.before;
  const family = restored(beforeTie);
  const first = await family.propose(observation, packet.frame_rows, [], beforeTie.remaining);
  assert.equal(first?.actions[0].action_ref, 'ACTION1');
  family.control_questions.attempted.add(first!.support_plan.question_key);
  const receipts: ControlTrialComparison[] = [];
  const alternative = await family.propose(observation, packet.frame_rows, [], beforeTie.remaining, configuration(receipts, 1));
  assert.equal(alternative?.actions[0].action_ref, 'ACTION4');
  assert.deepEqual(receipts[0]?.offers?.map(({ action, result }) => [action, result]), [['ACTION4', 'selected']]);
  assert.equal(missingControlWitness(alternative!, 'ACTION4', observation.observation_ref)?.action, 'ACTION4');
  assert.equal(family.before(alternative!, 0, packet, observation).admitted, true);
  assert.equal(family.directions.ACTION4, undefined);

  const captured = fixture<V6PublicObservation>('sic-as66-p05-action4-return.json.gz');
  const after: NativePublicObservation = { frame_rows: captured.frame, frame_packet: captured.frames, level: captured.level,
    levels_completed: captured.levelsCompleted, state: captured.state, step_index: captured.stepIndex, palette: captured.palette,
    frame_hash: await publicFrameHash(captured.frame), available_action_refs: captured.availableActionIds.map(action => 'ACTION' + action) };
  assert.equal(after.frame_hash, '1d4db55871a6a88a');
  assert.equal(captured.frame.reduce((count, row, y) => count + row.filter((value, x) => value !== packet.frame_rows[y]![x]).length, 0), 82);
  const observed = await measureNativeObservation(after, observation.revision + 1, 'as66-alternate');
  assert.equal(family.after(alternative!, 0, observation, observed, packet.frame_rows, after.frame_rows).matched, null);
  family.record(observation, observed, alternative!.actions[0], packet.frame_rows, after.frame_rows, alternative!, 0, after.frame_packet);
  assert.deepEqual(family.directions.ACTION4, [0, 1]);
  assert.equal(family.directions.ACTION1, undefined);
  const next = await family.propose(observed, after.frame_rows, [], beforeTie.remaining - 1);
  assert.equal(next?.kind, 'sliding_cavity_access');
  assert.equal(next?.actions[0].action_ref, 'ACTION2');
});
