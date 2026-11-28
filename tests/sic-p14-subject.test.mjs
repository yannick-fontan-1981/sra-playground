import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemporalEvidence, inferDelayedResponse } from '../src/sic/temporal-evidence.ts';
import { inferWitnessedSuffixCycle } from '../src/sic/witnessed-cycle.ts';
import { FAMILIES, generateCase, shiftOrigin, signature } from '../scripts/sic-p14/generator.mjs';
import { createSubject } from '../scripts/sic-p14/subject.mjs';
import { createEnvironment } from '../scripts/sic-p14/environment.mjs';
import { runEpisode, compareCase, digest } from '../scripts/sic-p14/compare.mjs';

test('replays all six published early-extrapolation regressions under their original budgets', () => {
  const cases = [
    ['transient_then_period', 83, '930964aa2efb8bbfac16571587ce77dad5b00e2e292a0498b988a1e6660c5025'],
    ['ambiguous_periods', 143, '8e90b36a4137f11168fc25b3432e9794aeb6201920a41d3e2df5a2c5f9ae5797'],
    ['independent_clocks', 189, 'cee5774534c56b10e36d780e903bbec7dd6e92899b4d47429e5647df135710ce'],
    ['ambiguous_periods', 191, '280ec2a8a7bd58ec4b17a8c69491e13f2ae871825ae2119cbd086367316d09f7'],
    ['independent_clocks', 440, '70b0b388bf53a0bd564cbf0548d26cb36f419408d77adf4b45c17f1f6a9411ef'],
    ['ambiguous_periods', 732, '62f5d72a6ed5e8579b35f36b7e947d5862f827df6854e86b85e94b23bcff7b69'],
  ];
  for (const [family, index, expected] of cases) {
    const spec = generateCase(family, index, 26112814);
    assert.equal(digest(signature(spec)), expected);
    for (const world of spec.worlds.keys()) for (const variant of ['frozen', 'candidate']) {
      const episode = runEpisode(spec, world, variant);
      assert.equal(episode.success, true, `${family}/${index}/${world}/${variant}`);
      assert.equal(episode.metrics.mistimed, 0);
    }
  }
  const spec = generateCase('transient_then_period', 83, 26112814);
  spec.budget = { ...spec.budget, states: 1 };
  for (const variant of ['frozen', 'candidate']) {
    const episode = runEpisode(spec, 0, variant, { meterSearch: true });
    assert.equal(episode.expanded, 1);
    assert.equal(episode.success, false);
  }
});

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
