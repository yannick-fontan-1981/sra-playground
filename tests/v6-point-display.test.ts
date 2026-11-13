import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SceneRelations, PointExperimentMemory, contrastModels, contrastOffers, forecast, proposeContrast,
  support, testedOccurrence } from '../src/logos-engine/v6-point-contrasts.ts';
import { CoupledDisplays, framedRows, value } from '../src/logos-engine/v6-coupled-displays.ts';

const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-point-display-reference.json', import.meta.url), 'utf8'));
type RecordValue = Record<string, any>;

async function checkOutcome(call: () => unknown | Promise<unknown>, expected: RecordValue) {
  if (expected.accepted) assert.deepEqual(await call(), expected.value);
  else await assert.rejects(async () => call(), (error: unknown) => {
    assert.ok(error instanceof Error); assert.equal(error.message, expected.error.message); return true;
  });
}

for (const sample of fixture.scenes) test(`V6 public point-occurrence features match original: ${sample.id}`, async () => {
  const observation = structuredClone(sample.observation);
  if (sample.error) {
    await checkOutcome(() => new SceneRelations(observation, { previous_moving_signatures: sample.anchors }), sample.error);
    return;
  }
  const scene = new SceneRelations(observation, { previous_moving_signatures: sample.anchors });
  const supports = Object.fromEntries([...scene.entities].map(([key, entity]) => [key, support(entity).sort((a, b) => a[0] - b[0] || a[1] - b[1])]));
  assert.deepEqual(supports, sample.supports);
  for (let i = 0; i < sample.commands.length; i++) assert.deepEqual(await scene.features(sample.commands[i]), sample.features[i]);
  assert.deepEqual(observation, sample.observation);
});

for (const sample of fixture.contrasts) test(`V6 literal feature/refutation/contrast source parity: ${sample.id}`, async () => {
  const records = structuredClone(sample.records), candidates = structuredClone(sample.candidates);
  const models = await contrastModels(records); assert.deepEqual(models, sample.models);
  assert.deepEqual(candidates.map((binding: RecordValue | null) => binding === null ? null : forecast(models, binding)), sample.forecasts);
  assert.deepEqual(await contrastOffers(records, candidates, { compared_pairs: sample.compared_pairs }), sample.offers);
  assert.deepEqual(await proposeContrast(records, candidates, { compared_pairs: sample.compared_pairs }), sample.proposal);
  assert.deepEqual(records, sample.records); assert.deepEqual(candidates, sample.candidates);
});

test('point-experiment memory replays every actual observation, frozen prediction and epoch boundary', async () => {
  const memory = new PointExperimentMemory();
  for (const sample of fixture.pointMemorySteps) {
    const restored = new PointExperimentMemory(); restored.restore(memory.state());
    const inputs = structuredClone(sample.arguments), replayInputs = structuredClone(sample.arguments);
    const method = sample.method as 'offers' | 'offer' | 'observe';
    await checkOutcome(() => (memory[method] as (...args: any[]) => unknown).apply(memory, inputs), sample.outcome);
    await checkOutcome(() => (restored[method] as (...args: any[]) => unknown).apply(restored, replayInputs), sample.outcome);
    assert.deepEqual(memory.state(), sample.state, sample.id);
    assert.deepEqual(restored.state(), sample.state, `restored ${sample.id}`);
    assert.deepEqual(inputs, sample.arguments, `input immutability ${sample.id}`);
  }
  const prior = fixture.pointMemorySteps.find((sample: RecordValue) => sample.id === 'first-positive-addressed-support');
  const boundary = fixture.pointMemorySteps.find((sample: RecordValue) => sample.id === 'epoch-boundary-clears-moving-only');
  assert.ok(boundary.state.records.length >= prior.state.records.length);
  assert.equal(boundary.state.has_positive, true); assert.deepEqual(boundary.state.moving_signatures, []);
  assert.ok(boundary.state.compared_pairs.length > 0, 'already tested alternatives are not erased');
  const mismatch = fixture.pointMemorySteps.find((sample: RecordValue) => sample.id === 'mismatch-retains-observation-before-rejection');
  assert.equal(mismatch.outcome.accepted, false, 'source observes before its frozen-witness rejection');
  const invalid = memory.state(); invalid.compared_pairs = [['one'] as unknown as [string, string]];
  const before = memory.state(); assert.throws(() => memory.restore(invalid), /Invalid point/); assert.deepEqual(memory.state(), before);
  const detached = memory.state(); detached.records.length = 0; assert.deepEqual(memory.state(), before);
});

test('point alternatives carry no release authority, causal claim or terminal role', () => {
  const offers = fixture.contrasts.flatMap((sample: RecordValue) => sample.offers);
  assert.ok(offers.length > 0);
  for (const offer of offers) {
    assert.equal(offer.release_authority, false); assert.equal(offer.terminal_relevance, 'unknown');
    assert.ok(offer.new_contrast_pairs.length > 0);
  }
  const record = testedOccurrence({ exact: 'public witness' }, [], 'after');
  assert.deepEqual(record, { exact: 'public witness', observed_local_change: false, after_ref: 'after' });
});

for (const sample of fixture.displayCases) test(`V6 framed coupled displays source parity: ${sample.id}`, () => {
  const display = new CoupledDisplays(); if (sample.initialState) display.restore({ ...display.state(), ...sample.initialState });
  const observation = structuredClone(sample.observation), rows = structuredClone(sample.rows), inputs = structuredClone(sample.inputs);
  assert.deepEqual(framedRows(observation, rows), sample.groups);
  assert.deepEqual(display.offers(observation, rows, inputs, sample.policy), sample.offers);
  assert.deepEqual(display.state(), sample.state);
  assert.deepEqual(observation, sample.observation); assert.deepEqual(rows, sample.rows); assert.deepEqual(inputs, sample.inputs);
});

test('coupled-display memory replays local, remote, unchanged, ambiguous and scored-boundary outcomes', async () => {
  const memory = new CoupledDisplays();
  for (const sample of fixture.displaySteps) {
    const restored = new CoupledDisplays(); restored.restore(memory.state());
    const inputs = structuredClone(sample.arguments), replayInputs = structuredClone(sample.arguments);
    const method = sample.method as 'offers' | 'observe';
    await checkOutcome(() => (memory[method] as (...args: any[]) => unknown).apply(memory, inputs), sample.outcome);
    await checkOutcome(() => (restored[method] as (...args: any[]) => unknown).apply(restored, replayInputs), sample.outcome);
    assert.deepEqual(memory.state(), sample.state, sample.id); assert.deepEqual(restored.state(), sample.state, `restored ${sample.id}`);
    assert.deepEqual(inputs, sample.arguments, `input immutability ${sample.id}`);
  }
  const inherited = fixture.displaySteps.find((sample: RecordValue) => sample.id === 'scaled-shape-inheritance');
  assert.equal(inherited.state.epoch, 2); assert.deepEqual(inherited.state.history, []);
  assert.deepEqual(inherited.state.scored_schema.source_shape, [4, 3]);
  assert.deepEqual(inherited.state.scored_schema.receiver_shape, [2, 2]);
  assert.equal(inherited.outcome.value.length, 1);
  const detached = memory.state(), before = memory.state(); detached.history.length = 0; detached.controls.length = 0;
  assert.deepEqual(memory.state(), before);
  assert.throws(() => memory.restore({ ...before, history: null as any }), /Invalid coupled-display/);
  assert.deepEqual(memory.state(), before);
});

for (const [index, sample] of fixture.valueCases.entries()) test(`V6 public rectangular uniformity value: ${index}`, () => {
  assert.equal(value(sample.rows, sample.box), sample.expected);
});

test('point and coupled display source files retain exact pinned SHA256', async () => {
  assert.equal(fixture.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  for (const [path, expected] of Object.entries(fixture.sourceHashes)) {
    const bytes = await readFile(new URL(`../reference/v6/${fixture.commit}/source/${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, path);
  }
});
