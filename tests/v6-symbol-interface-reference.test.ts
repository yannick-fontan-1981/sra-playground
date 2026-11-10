import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { Interface, scene, signature, pairSignature, inside, at, countInside } from '../src/logos-engine/v6-symbol-interface.ts';
import { factConditionHolds } from '../src/logos-engine/v6-drm-projector.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-symbol-interface-reference.json.gz', import.meta.url))).toString()) as R;
const copy = <T>(value: T): T => structuredClone(value);
const holds = (conditions: readonly R[], facts: R): boolean => conditions.every(condition => factConditionHolds(condition as any, facts));
const make = (config: R = fixture.config): Interface => new Interface(copy(config), holds);
const pure: R = { scene, signature, pair_signature: pairSignature, inside, at, count_inside: countInside };
const result = (value: unknown): unknown => value === undefined ? null : value;

for (const row of fixture.pureCases) test(`symbol interface original measurement: ${row.id}`, () => {
  const run = () => pure[row.operation](...copy(row.arguments));
  if (row.error) assert.throws(run); else assert.deepEqual(run(), row.value);
});

for (const row of fixture.cases) test(`symbol interface original state operation: ${row.id}`, () => {
  const native = make(row.config ?? fixture.config); native.restore(copy(row.seedState));
  const run = () => (native as unknown as R)[row.operation](...copy(row.arguments));
  if (row.error) assert.throws(run); else assert.deepEqual(result(run()), row.value);
  assert.deepEqual(native.state(), row.afterState, 'Compare all six source state fields, including mutations before a refusal');
});

for (const row of fixture.sequences) test(`symbol interface original sequence: ${row.id}`, () => {
  const native = make(); native.restore(copy(row.seedState));
  for (const [index, step] of row.steps.entries()) {
    const run = () => (native as unknown as R)[step.operation](...copy(step.arguments));
    if (step.error) assert.throws(run); else assert.deepEqual(result(run()), step.value, `step ${index}`);
    assert.deepEqual(native.state(), step.afterState, `full state after step ${index}`);
  }
});

test('symbol interface learns from four actual original contrasts and installs only at the explicit boundary', () => {
  const native = make();
  for (const [index, step] of fixture.acquisitionSteps.entries()) {
    assert.equal(step.operation, 'record');
    assert.deepEqual(result((native as unknown as R).record(...copy(step.arguments))), step.value, step.id);
    assert.deepEqual(native.state(), step.afterState, step.id);
    if (index < fixture.acquisitionSteps.length - 1) assert.equal(native.methods.length, 0);
  }
  assert.deepEqual(native.state(), fixture.acquiredState);
  assert.equal(native.methods.length, 1);
  assert.equal(native.samples.length, 0);
  assert.equal(native.contrasts.length, 0);
  assert.equal(native.bound, null);
  assert.equal(native.methods[0]!.status, 'observed_interface_method_requires_current_revalidation');
  assert.equal(native.methods[0]!.terminal_scope, 'receipt_contribution_and_boundary; not_universal_all_slots_law');
  const next = fixture.next;
  const expected = fixture.cases.find((row: R) => row.id === 'learned_method_current_options');
  assert.deepEqual(native.options(copy(next.observation), copy(next.rows), copy(next.inputs), next.remaining), expected.value);
});

test('symbol interface restoration preserves the learned method while current actions still require raster revalidation', () => {
  const original = make();
  for (const step of fixture.acquisitionSteps) (original as unknown as R).record(...copy(step.arguments));
  const saved = original.state(), restored = make(); restored.restore(saved);
  saved.methods[0].evidence.push('external-mutation'); saved.samples.push({ scene: {}, ref: 'external' });
  assert.deepEqual(restored.state(), fixture.acquiredState, 'Restore copies incoming state');
  const exported = restored.state(); exported.methods[0].evidence.push('mutated-export');
  assert.deepEqual(restored.state(), fixture.acquiredState, 'State exports do not expose live references');
  const current = fixture.cases.find((row: R) => row.id === 'learned_method_current_options');
  assert.deepEqual((restored as unknown as R).options(...copy(current.arguments)), current.value);
  const stale = fixture.cases.find((row: R) => row.id === 'two_current_sources_do_not_establish_unique_binding');
  assert.deepEqual((restored as unknown as R).options(...copy(stale.arguments)), []);
});

test('symbol interface retains multiplicity unknowns and ordered prefixes from the original Counter contract', () => {
  const repeated = fixture.cases.find((row: R) => row.id === 'repeated_operand_with_one_stock_glyph_remains_unknown');
  const native = make(); native.restore(copy(repeated.seedState));
  const offers = (native as unknown as R).options(...copy(repeated.arguments)) as R[];
  assert.deepEqual(offers, repeated.value);
  assert.ok(offers.some(o => o.facts.offer_kind === 'select_operand'));
  for (const offer of offers) assert.deepEqual(offer.interface_offer.unknown,
    ['current_effect_requires_sealed_return', 'inventory_exact_multiplicities', 'recipe_generalization_to_untried_row']);
  const permuted = fixture.cases.find((row: R) => row.id === 'permuted_operands_abstain');
  native.restore(copy(permuted.seedState));
  assert.deepEqual((native as unknown as R).options(...copy(permuted.arguments)), []);
});

test('symbol interface records the contrast before preservation can refute its acceptance', () => {
  const row = fixture.cases.find((item: R) => item.id === 'other_request_change_refutes_but_retains_recorded_contrast');
  const native = make(); native.restore(copy(row.seedState));
  const returned = (native as unknown as R).record(...copy(row.arguments));
  assert.deepEqual(returned, row.value);
  assert.deepEqual(returned.kinds, []);
  assert.equal(native.contrasts.at(-1)!.kind, 'receive');
  assert.equal(native.refutations.at(-1)!.expected, 'receive');
  assert.deepEqual(native.state(), row.afterState);
});

test('symbol interface original oracle discloses synthetic inputs and executes unchanged source before and after the export', () => {
  assert.equal(fixture.referenceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.sourceModified, false);
  assert.ok(fixture.sourceFilesVerifiedBeforeAndAfter > 1700);
  assert.match(fixture.qualification, /synthetic/);
  assert.match(fixture.qualification, /No game dispatch/);
  for (const [path, expected] of Object.entries(fixture.sourceHashes)) {
    const raw = readFileSync(new URL(`../reference/v6/${fixture.referenceCommit}/source/${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'), expected, path);
  }
  for (const name of ['Interface.record', 'Interface.build_method', 'Interface.options', 'Interface.scope',
    'Interface.remember', 'Interface.restore', 'Interface.state', 'scene']) {
    assert.ok(fixture.executedSourceFunctions.some((row: R) => row.path.endsWith('/symbol_transactions/interface.py')
      && row.function === name && row.calls > 0), name);
  }
  assert.ok(fixture.executedSourceFunctions.some((row: R) => row.path.endsWith('/guarded_binding/geometry.py')
    && row.function === 'revalidate_frame' && row.calls > 0));
  for (const name of ['measure_diagram_rows', 'measure_equal_row_pairs', 'measure_diagram_transition']) {
    assert.ok(fixture.executedSourceFunctions.some((row: R) => row.path.endsWith('/symbolic_diagrams.py')
      && row.function === name && row.calls > 0), name);
  }
});
