import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { OutlineService } from '../src/logos-engine/v6-outline-service.ts';
import { evaluateOutlineContinuationSubset, OUTLINE_CONTINUATION_SUBSET } from '../src/logos-engine/v6-outline-continuation.ts';
import { factConditionHolds } from '../src/logos-engine/v6-drm-projector.ts';

// Independent unchanged-Python matcher and projector results for the declared
// subset. They are not outputs of a complete V5 selection or a native game.
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-outline-continuation-reference.json.gz', import.meta.url))).toString());
const declarations = new Map(fixture.subset.sourceDeclarations.map(value => [value.id, value.declaration]));
for (const row of fixture.conditionCases) test(`outline continuation original condition ${row.id}`, () => {
  const declaration = declarations.get(row.ruleRef);
  const matched = (declaration.all_conditions ?? []).every(condition => factConditionHolds(condition, row.facts))
    && (!(declaration.any_conditions?.length) || declaration.any_conditions.some(condition => factConditionHolds(condition, row.facts)));
  assert.equal(matched, row.value);
});
for (const row of fixture.projectionCases) test(`outline continuation original projection ${row.id}`, async () => {
  if (row.error) await assert.rejects(() => evaluateOutlineContinuationSubset(row.facts));
  else assert.deepEqual(await evaluateOutlineContinuationSubset(row.facts), row.value);
});

test('outline continuation subset is accepted by the unchanged source loader and preserves all five source fragments', () => {
  assert.equal(fixture.subset.originalStrictLoaderAccepted, true);
  assert.deepEqual(OUTLINE_CONTINUATION_SUBSET.document, fixture.subset.document);
  assert.deepEqual(OUTLINE_CONTINUATION_SUBSET.selectionTier, fixture.subset.selectionTier);
  const document = JSON.parse(OUTLINE_CONTINUATION_SUBSET.document.text);
  const entries = [document.declarations[0], ...document.declarations[1].fact_projections, OUTLINE_CONTINUATION_SUBSET.selectionTier];
  for (const expected of fixture.subset.sourceDeclarations) assert.deepEqual(entries.find(value => value.id === expected.id), expected.declaration);
});

test('original current question after actual8 requires the separate caller premise and matches the native strict component', async () => {
  const a = fixture.actualCurrentQuestion, owner = await OutlineService.create(); owner.restore(a.sourceState);
  const before = owner.state(), current = await owner.propose(a.observation, a.rows, [], 16);
  const receipt = value => Object.fromEntries(['workflow', 'src_hash', 'src_status', 'executed_statements'].map(key => [key, value[key]]));
  const measured = value => ({ ...value, control_workflow: receipt(value.control_workflow) });
  const normalized = { ...current, outline_plan: { ...current.outline_plan, measurement: measured(current.outline_plan.measurement), workflow: receipt(current.outline_plan.workflow) },
    compositions: current.compositions.map(value => ({ ...value, properties: { ...value.properties, current_measurement: measured(value.properties.current_measurement) } })) };
  assert.deepEqual(normalized, a.proposal);
  assert.deepEqual(owner.beforeSource(current, 0, { frame_rows: a.rows }, a.observation), a.sourceGuard);
  assert.deepEqual(await evaluateOutlineContinuationSubset(a.measuredFactsWithoutCallerTrial), a.withoutCallerNoEffectPremise);
  assert.deepEqual(await evaluateOutlineContinuationSubset({ ...a.measuredFactsWithoutCallerTrial, attempted_without_effect_in_current_context: false }), a.conditionalOnCallerNoEffectPremiseFalse);
  const trial = { status: 'untried_exact_public_context', observation_ref: a.observation.observation_ref,
    level_epoch: a.observation.level_epoch, frame_hash: a.observation.frame_hash, action_ref: current.actions[0].action_ref,
    trial_key: 'controlled:independent-component-trial', evidence_refs: [a.observation.observation_ref], domain_complete: true,
    qualification: 'Conditional component trial only; actual caller context is checked by the Kernel contract.' };
  assert.equal(await owner.currentRequiredServiceWitness(current, a.observation, a.rows, trial), null);
  const witness = await owner.currentRequiredServiceWitness(current, a.observation, a.rows, { ...trial, attempted_without_effect_in_current_context: false });
  assert.equal(witness.status, 'current_required_service'); assert.equal(witness.release_authority, false);
  assert.deepEqual(owner.state(), before);
});
