import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemporalEvidence, inferDelayedResponse } from '../src/sic/temporal-evidence.ts';
import { inferWitnessedSuffixCycle } from '../src/sic/witnessed-cycle.ts';
import { FAMILIES, generateCase, shiftOrigin } from '../scripts/sic-p14/generator.mjs';
import { createSubject } from '../scripts/sic-p14/subject.mjs';
import { createEnvironment } from '../scripts/sic-p14/environment.mjs';
import { runEpisode, compareCase } from '../scripts/sic-p14/compare.mjs';

test('dated inference learns after a long transient without collapsing missing ticks', () => {
  const learner = createTemporalEvidence();
  const prefix = [0, 1, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0];
  const cycle = [0, 1, 1, 1, 0, 0, 0];
  const value = tick => tick < prefix.length ? prefix[tick] : cycle[(tick - prefix.length) % cycle.length];
  const dense = [];
  for (let tick = 0; tick < 90; tick++) {
    dense.push(value(tick));
    const masked = tick % 11 === 2;
    learner.observe({ tick, value: masked ? null : value(tick), reliable: !masked, ref: `f${tick}` });
  }
  assert.equal(inferWitnessedSuffixCycle(dense), undefined, 'the frozen implementation retains its onset bounds');
  for (let tick = 90; tick < 105; tick++) {
    const prediction = learner.predict(tick);
    assert.equal(prediction?.value, value(tick));
    assert.ok(prediction.evidence.length >= 21);
    assert.ok(prediction.evidence.every(ref => Number(ref.slice(1)) < 90));
  }
});

test('a delayed effect needs the complete reliable command-relative interval', () => {
  const samples = [0, 0, 0, 1, 1, 0].map((value, tick) => ({ tick: tick + 17, value, reliable: true, ref: `p${tick}` }));
  assert.deepEqual(inferDelayedResponse(samples, 17), { delay: 3, width: 2, evidence: samples.map(sample => sample.ref) });
  assert.equal(inferDelayedResponse(samples.filter(sample => sample.tick !== 19), 17), undefined);
  assert.equal(inferDelayedResponse(samples.map(sample => sample.tick === 20 ? { ...sample, reliable: false } : sample), 17), undefined);
  assert.equal(inferDelayedResponse(samples.slice(0, -1), 17), undefined);
});

test('indistinguishable public histories produce the same decision without private metadata', () => {
  for (const family of FAMILIES) {
    const spec = generateCase(family, 0, 26112814);
    const observations = spec.worlds.map((_, world) => createEnvironment(spec, world).observation());
    assert.deepEqual(observations[0], observations[1]);
    const decisions = observations.map(observation => createSubject(spec.public, spec.budget).decide([observation]));
    assert.deepEqual(decisions[0], decisions[1]);
    const reversed = structuredClone(spec.public);
    reversed.actions.reverse();
    assert.deepEqual(createSubject(reversed, spec.budget).decide([observations[0]]), decisions[0]);
  }
});

test('both subjects retain clock-origin invariance and report actual guarded crossing', () => {
  const spec = generateCase('cycle_intervention', 0, 26112814);
  for (const variant of ['frozen', 'candidate']) {
    const first = runEpisode(spec, 0, variant);
    const shifted = runEpisode(shiftOrigin(spec, 987654), 0, variant);
    assert.equal(first.traceHash, shifted.traceHash);
    assert.equal(first.metrics.proofViolations, 0);
    assert.equal(first.metrics.unguardedTimedActions, 0);
    assert.equal(first.metrics.unsupportedRevisions, 0);
    if (first.success) {
      assert.equal(first.position, spec.public.goal);
      assert.equal(first.terminal, 'crossed');
      assert.ok(first.metrics.rightInstant >= 2);
      assert.ok(first.metrics.supportedRevisions >= 1);
    }
  }
});

test('ablation removes a consumed gate witness but preserves its game time and action receipt', () => {
  const spec = generateCase('ordered_intermediates', 0, 26112814);
  const comparison = compareCase(spec);
  const world = comparison.worlds.find(row => row.ablation?.witness);
  assert.ok(world, 'a real candidate gain supplies the counterfactual witness');
  const witness = world.ablation.witness;
  const original = runEpisode(spec, world.world, 'candidate');
  const removed = runEpisode(spec, world.world, 'candidate', { removeFrame: witness.ref });
  const decision = original.decisions[witness.consumedAtOrdinal];
  assert.ok(decision.composition.executedGuards.some(guard => guard.evidence.includes(witness.ref)));
  const originalEvent = original.history.find(event => event.frames.some(frame => frame.ref === witness.ref));
  const removedEvent = removed.history.find(event => event.frames.some(frame => frame.ref === witness.ref));
  assert.equal(removedEvent.tick, originalEvent.tick);
  assert.deepEqual(removedEvent.receipt, originalEvent.receipt);
  const removedFrame = removedEvent.frames.find(frame => frame.ref === witness.ref);
  assert.equal(removedFrame.tick, witness.tick);
  assert.ok(Object.values(removedFrame.values).every(value => value === null));
  assert.ok(Object.values(removedFrame.reliable).every(value => value === false));
  assert.equal(world.ablation.clocksUnchanged, true);
});
