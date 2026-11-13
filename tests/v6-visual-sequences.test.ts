import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { VisualSequences, numericPredictions, featureValue } from '../src/logos-engine/v6-visual-sequences.ts';
import { ObservedInputDomain, measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
const f = JSON.parse(await readFile(new URL('./fixtures/v6-sequence-reference.json', import.meta.url), 'utf8'));
const root = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/', import.meta.url);
test('visual sequence oracle is bound to original sources', async () => {
  for (const [name, expected] of Object.entries(f.provenance.sources) as [string, { bytes: number; sha256: string }][]) {
    const bytes = await readFile(new URL(name, root)); assert.equal(bytes.length, expected.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256);
  }
});
for (const row of f.numeric) test(`finite visual laws match Python: ${JSON.stringify(row.values)}`, () => {
  assert.deepEqual(numericPredictions(row.values, row.index, f.configuration), row.expected);
});
for (const item of f.cases) test(`visual family preserves original refusal on real ${item.game}`, async () => {
  const family = new VisualSequences(), domain = new ObservedInputDomain(250), current = item.initial.public;
  const obs = await measureNativeObservation(current, 0, 'native-sequence-oracle');
  assert.deepEqual(obs, item.initial.observation);
  assert.equal(await family.propose(obs, current.frame_rows, domain.candidates(obs), 160), null);
  assert.equal(item.steps.length, 0, 'This refusal test must be extended if the oracle acquires a new supported scene');
});
for (const item of f.synthetic) test(`original visual program and evidence: ${item.id}`, async () => {
  const family = new VisualSequences(), obs = item.initial.observation, first = item.initial.public;
  const proposal = await family.propose(obs, first.frame_rows, item.inputs, 100);
  assert.deepEqual(proposal, item.proposal);
  assert.deepEqual(family.last, item.last);
  assert.deepEqual(family.state(), item.state);
  if (!proposal) return;
  assert.deepEqual(family.before(proposal, 0, first, obs), item.beforeGuard);
  assert.deepEqual(family.record(obs, item.afterObservation, proposal.actions[0]!, first.frame_rows, item.afterPublic.frame_rows, proposal, 0), item.record);
  assert.deepEqual(family.state(), item.stateAfter);
  const next = await family.propose(item.afterObservation, item.afterPublic.frame_rows, new ObservedInputDomain(250).candidates(item.afterObservation), 99);
  assert.deepEqual(next, item.nextProposal);
  const restored = new VisualSequences(); restored.restore(family.state());
  assert.deepEqual(await restored.propose(item.afterObservation, item.afterPublic.frame_rows, new ObservedInputDomain(250).candidates(item.afterObservation), 99), next);
});
test('finite value kernel preserves cumulative/reflected arithmetic and explicit refusals', () => {
  assert.equal(featureValue({ law_ref: 'cumulative_arithmetic_increment', start: 1, step: 2, increment_step: 1 }, 4), 15);
  assert.equal(featureValue({ law_ref: 'reflected_bounded_value', start: 0, step: -1, lower: 0, upper: 3 }, 1), 1);
  assert.equal(featureValue({ law_ref: 'reflected_bounded_value', start: 5, step: 7, lower: 2, upper: 2 }, 5), 2);
  assert.throws(() => featureValue({ law_ref: 'finite_cyclic_value', cycle_values: [] }, 0), /FINITE_CYCLE/);
  assert.throws(() => featureValue({ law_ref: 'arithmetic_value', start: 0 }, 0), /PARAMETERS/);
});
