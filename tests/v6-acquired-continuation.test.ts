import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import {
  cellUnacquiredInquiryWitness, retainedReductionSuccess, reductionAcquiredContinuationWitness,
} from '../src/logos-engine/v6-acquired-continuation.ts';

type R = Record<string, any>;
const load = (name: string): R => JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/${name}.json.gz`, import.meta.url))).toString());
const cells = load('v6-cell-placement-reference');
const cell = cells.proposalCases.find((item: R) => item.id === 'common_current_pixel_support');
const emptyCell = cells.states.empty.projection;
const reduction = load('v6-reduction-transport-lf52-original-public');
const firstCalibration = reduction.prefixes.find((prefix: R) => prefix.beforeState.passed.length > 0 && prefix.proposal.steps[0].mode === 'calibrate');
const calibrationObservation = reduction.packets[firstCalibration.steps[0].actionIndex - 1].observation;
const copy = <T>(value: T): T => structuredClone(value);

test('unchanged source Cell experiment supplies only an unacquired inquiry witness', () => {
  const before = copy([emptyCell, cell.expected, cell.observation]);
  const witness = cellUnacquiredInquiryWitness(emptyCell, cell.expected, cell.observation);
  assert.ok(witness); assert.equal(witness.status, 'unacquired_exploration');
  assert.equal(witness.observation_ref, cell.observation.observation_ref);
  assert.equal(witness.proposal_ref, cell.expected.proposal_id); assert.deepEqual(witness.evidence_refs, []);
  assert.deepEqual([emptyCell, cell.expected, cell.observation], before);
});

for (const [field, value] of [
  ['cell_events', [{ kind: 'observed_cell_response' }]], ['cell_models', { retained: { status: 'candidate' } }],
  ['cell_refused', ['refused_trial']], ['cell_paths', { retained: [] }], ['cell_returns', { retained: {} }],
] as const) test(`an acquired Cell ${field} prevents exploratory deferral`, () => {
  assert.equal(cellUnacquiredInquiryWitness({ ...copy(emptyCell), [field]: value }, cell.expected, cell.observation), null);
});

test('missing acquired-state collections are unknown rather than empty', () => {
  const state = copy(emptyCell); delete state.cell_events;
  assert.equal(cellUnacquiredInquiryWitness(state, cell.expected, cell.observation), null);
});

for (const [name, change] of [
  ['model', (p: R) => { p.cell_placement_plan.model = {}; }],
  ['search', (p: R) => { p.cell_placement_plan.search = {}; }],
  ['expected motif', (p: R) => { p.cell_placement_plan.expected_motif = 'observed-motif'; }],
  ['proposal kind', (p: R) => { p.kind = 'supported_ternary_reduction'; }],
  ['binding ref', (p: R) => { p.binding.observation_ref = 'stale-observation'; }],
  ['binding epoch', (p: R) => { p.binding.level_epoch++; }],
  ['plan ref', (p: R) => { p.cell_placement_plan.observation_ref = 'stale-observation'; }],
  ['plan score', (p: R) => { p.cell_placement_plan.score++; }],
  ['frame binding', (p: R) => { p.steps[0].expected_before.frame_hash = 'stale-frame'; }],
  ['point support ref', (p: R) => { p.steps[0].point_support.observation_ref = 'stale-support'; }],
  ['command envelope', (p: R) => { p.actions[0].data.x++; }],
  ['acquired evidence', (p: R) => { p.question.hypothesis_refs.push('prior-acquired-response'); }],
] as [string, (p: R) => void][]) test(`Cell witness rejects changed ${name}`, () => {
  const proposal = copy(cell.expected); change(proposal);
  assert.equal(cellUnacquiredInquiryWitness(emptyCell, proposal, cell.observation), null);
});

test('a learned Cell relation retains its normal source priority', () => {
  const learned = cells.proposalCases.find((item: R) => item.id === 'common_learned_support');
  assert.equal(cellUnacquiredInquiryWitness(cells.states.learned.projection, learned.expected, learned.observation), null);
});

test('latest official success is a read-only prefilter, not a claim of current control knowledge', () => {
  const state = copy(firstCalibration.beforeState), before = copy(state);
  const witness = retainedReductionSuccess(state, calibrationObservation);
  assert.ok(witness); assert.equal(witness.status, 'conditional_acquired_continuation');
  assert.equal(witness.score, calibrationObservation.levels_completed);
  assert.equal(witness.observation_ref, calibrationObservation.observation_ref);
  assert.equal(witness.success_ref, state.passed.at(-1).ref);
  assert.deepEqual(witness.evidence_refs, [witness.success_ref]);
  assert.equal(witness.action_effect_known, undefined); assert.deepEqual(state, before);
});

test('a success remains evidence after the next public return at the same official score', () => {
  const step = firstCalibration.steps[0], after = reduction.packets[step.actionIndex].observation;
  const witness = retainedReductionSuccess(step.afterState, after);
  assert.ok(witness); assert.notEqual(witness.success_ref, after.observation_ref);
  assert.equal(witness.observation_ref, after.observation_ref);
});

for (const [name, change] of [
  ['no success', (s: R) => { s.passed = []; }],
  ['empty success ref', (s: R) => { s.passed.at(-1).ref = ''; }],
  ['blank success ref', (s: R) => { s.passed.at(-1).ref = ' '; }],
  ['older official score', (s: R) => { s.passed.at(-1).score--; }],
  ['future official score', (s: R) => { s.passed.at(-1).score++; }],
  ['malformed latest evidence', (s: R) => { s.passed.push({}); }],
] as [string, (s: R) => void][]) test(`Reduction prefilter rejects ${name}`, () => {
  const state = copy(firstCalibration.beforeState); change(state);
  assert.equal(retainedReductionSuccess(state, calibrationObservation), null);
  assert.equal(reductionAcquiredContinuationWitness(state, firstCalibration.proposal, calibrationObservation), null);
});

test('current calibration is expressly an unknown-effect question despite prior official success', () => {
  const state = firstCalibration.beforeState, proposal = firstCalibration.proposal;
  const before = copy([state, proposal, calibrationObservation]);
  const witness = reductionAcquiredContinuationWitness(state, proposal, calibrationObservation);
  assert.ok(witness); assert.equal(witness.step_mode, 'calibrate'); assert.equal(witness.action_effect_known, false);
  assert.equal(witness.effect_scope, 'current_effect_remains_an_information_question');
  assert.match(witness.qualification, /unknown control vector/);
  assert.equal(witness.proposal_ref, proposal.bundle_template.composition_ref);
  assert.equal(Object.hasOwn(witness, 'learned_vector'), false);
  assert.deepEqual([state, proposal, calibrationObservation], before);
});

for (const [name, change] of [
  ['retired hypothesis', (s: R) => { s.retired = true; }],
  ['old state epoch', (s: R) => { s.epoch--; }],
  ['missing measured model', (s: R) => { s.model = null; }],
  ['missing current scene', (s: R) => { s.scene = null; }],
  ['changed camera offset', (s: R) => { s.offset = [99, 99]; }],
  ['calibration presented as known', (s: R) => { s.motion[firstCalibration.proposal.actions[0].action_ref] = [1, 0]; }],
] as [string, (s: R) => void][]) test(`Reduction continuation rejects ${name}`, () => {
  const state = copy(firstCalibration.beforeState); change(state);
  assert.equal(reductionAcquiredContinuationWitness(state, firstCalibration.proposal, calibrationObservation), null);
});

for (const [name, change] of [
  ['different kind', (p: R) => { p.kind = 'cell_patch_placement'; }],
  ['binding ref', (p: R) => { p.binding.observation_ref = 'stale-observation'; }],
  ['binding epoch', (p: R) => { p.binding.level_epoch++; }],
  ['binding score', (p: R) => { p.binding.levels_completed++; }],
  ['frame hash', (p: R) => { p.steps[0].expected_before.frame_hash = 'stale-frame'; }],
  ['missing finite continuation fact', (p: R) => { p.facts.bounded_continuation_found = false; }],
  ['empty route', (p: R) => { p.reduction_plan.continuation_operations = 0; }],
  ['nonfinite route', (p: R) => { p.reduction_plan.continuation_operations = Infinity; }],
  ['completed population', (p: R) => { p.reduction_plan.population = 1; }],
  ['command mismatch', (p: R) => { p.actions[0].action_ref = 'ACTION5'; }],
  ['invented calibration outcome', (p: R) => { p.steps[0].expected_after = [[], []]; }],
] as [string, (p: R) => void][]) test(`Reduction witness rejects ${name}`, () => {
  const proposal = copy(firstCalibration.proposal); change(proposal);
  assert.equal(reductionAcquiredContinuationWitness(firstCalibration.beforeState, proposal, calibrationObservation), null);
});

test('an actually acquired control relation is reported with its dated evidence', () => {
  const prefix = reduction.prefixes.find((p: R) => p.beforeState.passed.length > 0 && p.proposal.steps[0].mode === 'move');
  const observation = reduction.packets[prefix.steps[0].actionIndex - 1].observation;
  const witness = reductionAcquiredContinuationWitness(prefix.beforeState, prefix.proposal, observation);
  assert.ok(witness); assert.equal(witness.action_effect_known, true);
  assert.ok(witness.evidence_refs.includes(prefix.beforeState.refs[prefix.proposal.actions[0].action_ref]));
  assert.equal(witness.effect_scope, 'observed_relation_under_current_conditional_model');
});

test('witnesses read the retained delta without replaying the Reduction event history', () => {
  const state = copy(firstCalibration.beforeState);
  Object.defineProperty(state, 'events', { get() { throw new Error('History must not be scanned for continuity'); } });
  assert.ok(retainedReductionSuccess(state, calibrationObservation));
  assert.ok(reductionAcquiredContinuationWitness(state, firstCalibration.proposal, calibrationObservation));
});

test('evidence from an earlier completion count cannot lend priority after another official success', () => {
  const observation = { ...calibrationObservation, levels_completed: calibrationObservation.levels_completed + 1 };
  assert.equal(retainedReductionSuccess(firstCalibration.beforeState, observation), null);
  assert.equal(reductionAcquiredContinuationWitness(firstCalibration.beforeState, firstCalibration.proposal, observation), null);
});
