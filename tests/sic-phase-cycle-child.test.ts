import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand } from '../src/logos-engine/v6-native-types.ts';
import type { SicNeed } from '../src/sic/need-registry.ts';
import { sicNeedId } from '../src/sic/need-identity.ts';
import { bindPhaseCycleClosure, phaseCycleNeed, readPhaseCycleDecision } from '../src/sic/phase-cycle-child.ts';
import { maxObservedSupportPhases, supportPhaseProbeBudget } from '../src/sic/phased-support-route.ts';

test('the probe budget is bounded by the parent, measured phase count and one closing probe', () => {
  assert.equal(supportPhaseProbeBudget(50, 1), maxObservedSupportPhases);
  assert.equal(supportPhaseProbeBudget(50, 5), 8);
  assert.equal(supportPhaseProbeBudget(3, 5), 3);
  assert.equal(supportPhaseProbeBudget(50, maxObservedSupportPhases), 1);
  assert.equal(supportPhaseProbeBudget(0, 1), 0);
});

for (const [index, control] of ([[12, 5, 18, 9], [30, 36, 38, 45]] as NativeBox[]).entries()) {
  test('the closing pair is scoped to the measured control and the current epoch, geometry ' + index, async () => {
    const observe = (revision: number, frame: string, level = 4) => measureNativeObservation({
      frame_rows: Array.from({ length: 64 }, () => Array(64).fill(0)),
      frame_hash: frame, level, levels_completed: level - 1, state: 'NOT_FINISHED', available_action_refs: ['ACTION6', 'ACTION2'],
    }, revision, 'phased-proof');
    const before = await observe(10, 'aaaa'), after = await observe(11, 'bbbb');
    const { observation_ref: ref } = before;
    const goal = { kind: 'reach_target_on_observed_support_phases', scope: ref.split(':revision:', 1)[0]!, subjects: ['site'],
      parentObjective: 'G_official_completion', satisfactionContract: 'observe_official_progress_after_supported_navigation' };
    const parent: SicNeed = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence: [ref] };
    const need = phaseCycleNeed(parent, control, [ref]);
    const measurement = { kind: 'measure' as const, parent, control, opening: ref, actionBudget: 3 };
    const command: NativeCommand = { action_ref: 'ACTION6', data: {
      x: Math.floor((control[0] + control[2]) / 2), y: Math.floor((control[1] + control[3]) / 2),
    } };
    const proof = bindPhaseCycleClosure(measurement, need, before, after, command);
    assert.ok(proof);
    assert.deepEqual([proof.need.id, proof.control, proof.beforeRef, proof.afterRef], [need.id, control, ref, after.observation_ref]);
    assert.equal(bindPhaseCycleClosure(measurement, need, before, after, { ...command,
      data: { ...command.data, x: command.data.x! + 1 } }), undefined);
    assert.equal(bindPhaseCycleClosure(measurement, need, before, await observe(11, 'aaaa', 5), command), undefined);
    assert.equal(bindPhaseCycleClosure(measurement, need, before, await observe(12, 'cccc'), command), undefined);
    assert.equal(readPhaseCycleDecision({ ...measurement, actionBudget: maxObservedSupportPhases + 1 }, need, before, command), undefined);
    const resume = { kind: 'resume', closures: [proof] };
    const walk: NativeCommand = { action_ref: 'ACTION2', data: {} };
    assert.deepEqual(readPhaseCycleDecision(resume, parent, after, walk), resume);
    assert.equal(readPhaseCycleDecision(resume, parent, await observe(11, 'dddd'), walk), undefined);
    assert.equal(readPhaseCycleDecision({ ...resume, closures: [proof, proof] }, parent, after, walk), undefined);
  });
}
