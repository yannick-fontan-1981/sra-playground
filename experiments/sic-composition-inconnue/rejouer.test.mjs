import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { initialModels, observationKey, transitions } from './models.mjs';
import { run } from './rejouer.mjs';
import { navigation, scenario } from './terrain.mjs';

const fixture = JSON.parse(readFileSync(new URL('./developpement.json', import.meta.url)));
const measurement = JSON.parse(readFileSync(new URL('./mesure-armement.json', import.meta.url)));
const markers = JSON.parse(readFileSync(new URL('./transfert-reperes.json', import.meta.url)));

test('the public hypothesis set covers the independent terrain returns', () => {
  for (const spec of fixture.cases) {
    const terrain = scenario(spec);
    assert.equal(Object.hasOwn(terrain.rules, 'control'), false);
    assert.equal(Object.hasOwn(terrain.rules, 'target'), false);
    assert.equal(Object.hasOwn(terrain.rules, 'delay'), false);
    let observed = terrain.read(), models = initialModels(terrain.rules);
    for (const action of ['inspect', spec.control, 'advance', 'wait', 'advance', 'inspect', spec.target]) {
      const alternatives = transitions(terrain.rules, observed, models, action);
      observed = terrain.step(action);
      const actual = alternatives.get(observationKey(observed));
      assert.ok(actual, spec.id + ' after ' + action);
      assert.ok(actual.models.some(model => model.control === spec.control && model.delay === spec.delay
        && model.window === spec.window && model.destination === spec.target));
      models = actual.models;
      if (observed.outcome) break;
    }
  }
});

test('the frozen procedure and online composition get equal budgets and expose the first divergence', () => {
  const result = run(fixture);
  const row = result.cases['pulse-vue-porte'];
  assert.equal(row.fixed.stop.reason, 'move_budget_exhausted');
  assert.equal(row.composed.stop.reason, 'win');
  assert.ok(row.firstDifference.turn > 0);
  for (const spec of fixture.cases) for (const arm of ['fixed', 'composed']) {
    const receipt = result.cases[spec.id][arm];
    assert.ok(receipt.gestures <= spec.moveBudget);
    assert.ok(receipt.expanded <= spec.searchBudget);
    assert.ok(receipt.steps.every(step => [...navigation, ...spec.controls].includes(step.decision.action)));
  }
});

test('indistinguishable worlds stop on the same missing observation before an irreversible action', () => {
  const { cases } = run(fixture);
  const left = cases['indiscernable-gauche'].composed;
  const right = cases['indiscernable-droite'].composed;
  assert.deepEqual(left, right);
  assert.equal(left.gestures, 0);
  assert.equal(left.stop.missing, 'observation_identifying_the_goal_exit');
});

test('a conditional prefix can overlap the delay and approach when no all-world plan exists', () => {
  const { fixed, composed } = run(fixture).cases['charge-bloquee'];
  assert.equal(fixed.stop.reason, 'move_budget_exhausted');
  assert.equal(composed.stop.reason, 'win');
  const first = composed.steps[0].decision;
  assert.ok(first.supportedHypotheses > 0 && first.supportedHypotheses < first.hypotheses);
});

test('reuse orders a new trial and a conflicting prior can be discarded with an observed return', () => {
  const [reused, changed] = run(fixture).transfers;
  assert.equal(reused.withEvidence.stop.reason, 'win');
  assert.equal(reused.without.stop.reason, 'win');
  assert.ok(reused.withEvidence.gestures < reused.without.gestures);
  assert.equal(reused.withEvidence.steps[0].decision.action, reused.withEvidence.prior.control);
  assert.ok(reused.withEvidence.steps[0].possibleControls.length > 1);
  assert.equal(changed.withEvidence.stop.reason, 'win');
  assert.notEqual(changed.withEvidence.learned.control, changed.withEvidence.prior.control);
});

test('a public arming acknowledgement enables an approach without changing the physical window', () => {
  const [masked, visible] = measurement.cases.map(scenario);
  for (const action of ['alpha', 'advance', 'advance', 'inspect', 'right']) {
    const { armed, ...rest } = visible.step(action);
    assert.equal(armed, true);
    assert.deepEqual(masked.step(action), rest);
  }
  const { cases } = run(measurement);
  const a = cases['temoin-sans-accuse'].composed;
  const b = cases['temoin-avec-accuse'].composed;
  assert.equal(a.stop.reason, 'no_justified_plan_within_move_budget');
  assert.equal(b.stop.reason, 'win');
  assert.equal(b.steps[0].returned.armed, true);
  assert.equal(b.steps[0].returned.open, false);
  assert.equal(b.steps[1].decision.action, 'advance');
});

test('a uniquely observed marker binds across alphabets and still requires a fresh effect', () => {
  const [renamed, ambiguous, absent, discordant, contradicted] = run(markers).transfers;
  assert.equal(renamed.withEvidence.prior.sourceControl, 'bravo');
  assert.equal(renamed.withEvidence.prior.control, 'z');
  assert.equal(renamed.withEvidence.steps[0].decision.action, 'z');
  assert.deepEqual(renamed.withEvidence.steps[0].possibleControls, ['y', 'z']);
  assert.equal(renamed.withEvidence.stop.reason, 'win');
  assert.ok(renamed.withEvidence.gestures < renamed.without.gestures);
  for (const row of [ambiguous, absent, discordant]) {
    assert.deepEqual(row.withEvidence, row.without);
    assert.equal(row.firstDifference, null);
  }
  assert.equal(contradicted.withEvidence.prior.control, 'z');
  assert.equal(contradicted.withEvidence.learned.control, 'y');
  assert.equal(contradicted.withEvidence.stop.reason, 'win');
});
