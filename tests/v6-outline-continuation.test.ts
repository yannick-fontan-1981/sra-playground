import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readEvidenceSync } from './helpers/chunked-evidence.ts';
import { OutlineService } from '../src/logos-engine/v6-outline-service.ts';
import { OutlineMeasurementDomainError } from '../src/logos-engine/v6-outline-geometry.ts';
import { OUTLINE_CONTINUATION_SUBSET } from '../src/logos-engine/v6-outline-continuation.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';

const read = path => JSON.parse(gunzipSync(readEvidenceSync(new URL(path, import.meta.url))).toString());
const reference = read('./fixtures/v6-outline-service-reference.json.gz');
const campaign = read('../docs/migration/native-campaigns-v53/attempt1/esct-campaign.json.gz');
const packets = read('../docs/migration/native-campaigns-v53/attempt1/esct-public-trace.json.gz').packets;
const namespace = campaign.prefixes[7].outlineAcquisition.sourceState.control.transitions.at(-1).after.split(':epoch:')[0];
const copy = value => structuredClone(value);
function observation(packet, step) {
  return { observation_ref: `${namespace}:epoch:${packet.level}:revision:${step + 1}:frame:${packet.frame_hash}`,
    level_epoch: packet.level, levels_completed: packet.levels_completed, frame_hash: packet.frame_hash,
    available_action_refs: packet.available_action_refs, state: packet.state, revision: step + 1 };
}
// This supplies only a labelled component-contract trial. The independent
// Kernel arbitration suite obtains its trial from the actual caller memory.
function trial(obs, proposal) {
  return { status: 'untried_exact_public_context', observation_ref: obs.observation_ref, level_epoch: obs.level_epoch,
    frame_hash: obs.frame_hash, action_ref: proposal.actions[0].action_ref, trial_key: `controlled-trial:${symbolicDigest([obs, proposal.actions])}`,
    domain_complete: true, attempted_without_effect_in_current_context: false, evidence_refs: [obs.observation_ref],
    context_projection: 'labelled_component_contract', v5_caller_context_parity: false,
    qualification: 'Synthetic exact-context trial for the witness component contract, not a real caller selection or game success.' };
}

// Reacquire from the first eight actual public transitions, retaining the
// genuinely selected local-operator proposal. No old native state or future
// response is used as an expectation, and no host action is dispatched.
const acquired = await OutlineService.create();
for (let step = 1; step <= 8; step++) {
  const first = packets[step - 1].packet, second = packets[step].packet;
  const before = observation(first, step - 1), after = observation(second, step), action = campaign.actions[step - 1];
  const proposal = action.family === acquired.id ? await acquired.propose(before, first.frame_rows, [], 16) : null;
  if (proposal) assert.equal(proposal.actions[0].action_ref, action.command.action_ref);
  await acquired.recordSource(before, after, action.command, first.frame_rows, second.frame_rows, proposal, 0);
}
const state8 = acquired.state(), packet8 = packets[8].packet, obs8 = observation(packet8, 8);
async function current(options = {}) {
  const owner = await OutlineService.create(options); owner.restore(state8);
  const proposal = await owner.propose(obs8, packet8.frame_rows, [], 16);
  assert.equal(proposal.outline_plan.meaning.kind, 'announced_correspondence_hypothesis');
  return { owner, proposal, currentTrial: trial(obs8, proposal) };
}

test('outline service witness remeasures actual acquired relation and retains one conditional primitive without mutation', async () => {
  const { owner, proposal, currentTrial } = await current();
  const state = owner.state(), checkpoint = owner.nativeState(), revision = owner.nativeRevision;
  const witness = await owner.currentRequiredServiceWitness(proposal, obs8, packet8.frame_rows, currentTrial);
  assert.equal(witness.status, 'current_required_service'); assert.equal(witness.primitive_bound, 1);
  assert.equal(witness.replan_after_each_primitive, true); assert.equal(witness.release_authority, false);
  assert.equal(witness.action_effect_known, false); assert.equal(witness.terminal_rule_known, false);
  assert.equal(witness.source_guard.admitted, true); assert.equal(witness.source_condition_receipt.matched, true);
  assert.equal(witness.source_condition_receipt.projection_result.projection_refs.length, 3);
  assert.equal(witness.source_condition_receipt.matched_tier_ref, OUTLINE_CONTINUATION_SUBSET.selectionTier.id);
  assert.deepEqual(witness.current_trial, currentTrial); assert.equal(witness.current_trial.v5_caller_context_parity, false);
  assert.equal(witness.local_operator_evidence[0].local_count, 4);
  assert.equal(witness.local_operator_evidence[0].remote_change_count, 62, 'The new replay preserves the unchanged source expression');
  assert.equal(owner.nativeState(), checkpoint); assert.equal(owner.nativeRevision, revision); assert.deepEqual(owner.state(), state);
  assert.ok(Object.isFrozen(witness)); assert.ok(Object.isFrozen(witness.current_trial.evidence_refs));
  currentTrial.evidence_refs.push('mutated:external'); assert.equal(witness.current_trial.evidence_refs.length, 1);
});

test('outline witness rejects absent, attempted, incomplete or stale caller evidence and unavailable command', async () => {
  const { owner, proposal, currentTrial } = await current();
  for (const mutate of [value => { delete value.status; }, value => { value.attempted_without_effect_in_current_context = true; },
    value => { delete value.attempted_without_effect_in_current_context; }, value => { value.domain_complete = false; },
    value => { value.frame_hash = 'stale'; }, value => { value.level_epoch++; }, value => { value.observation_ref += ':stale'; },
    value => { value.action_ref = 'not:current'; }, value => { value.trial_key = ''; }, value => { value.evidence_refs = []; }]) {
    const changed = copy(currentTrial); mutate(changed);
    assert.equal(await owner.currentRequiredServiceWitness(proposal, obs8, packet8.frame_rows, changed), null);
  }
  assert.equal(await owner.currentRequiredServiceWitness(proposal, { ...obs8, available_action_refs: [] }, packet8.frame_rows, currentTrial), null);
});

test('outline witness rejects changed proposal geometry, changed rows, duplicate actions and historical-only operator evidence', async () => {
  const { owner, proposal, currentTrial } = await current();
  for (const mutate of [value => { value.steps[0].body_before[0]++; }, value => { value.steps[0].expected_after.body_bbox[0]++; },
    value => { value.outline_plan.measurement.relation.same_value_compact_body_hollow_perimeter_marker_triplet_count = 2; },
    value => { value.outline_plan.measurement.accompaniment[value.actions[0].action_ref].compact_body_origin[0]++; },
    value => { value.actions.push(copy(value.actions[0])); value.steps.push(copy(value.steps[0])); }]) {
    const changed = copy(proposal); mutate(changed);
    assert.equal(await owner.currentRequiredServiceWitness(changed, obs8, packet8.frame_rows, currentTrial), null);
  }
  const rows = copy(packet8.frame_rows), [left, top] = proposal.outline_plan.measurement.current.bbox;
  rows[top][left] = rows[top - 1][left];
  assert.equal(await owner.currentRequiredServiceWitness(proposal, obs8, rows, currentTrial), null);
  for (const stale of [[], state8.methods.map(value => ({ ...value, scope: obs8.level_epoch - 1 }))]) {
    owner.restore({ ...state8, methods: stale });
    assert.equal(await owner.currentRequiredServiceWitness(proposal, obs8, packet8.frame_rows, currentTrial), null);
  }
});

test('actual next public return loses correspondence and grants no service continuation', async () => {
  const { owner, proposal } = await current(), packet9 = packets[9].packet, obs9 = observation(packet9, 9);
  await owner.recordSource(obs8, obs9, campaign.actions[8].command, packet8.frame_rows, packet9.frame_rows);
  const measured = await owner.measure(obs9, packet9.frame_rows);
  assert.equal(measured.relation.same_value_compact_body_hollow_perimeter_marker_triplet_count, 0);
  assert.equal(await owner.propose(obs9, packet9.frame_rows, [], 16), null);
  const rebound = { ...proposal, binding: { ...proposal.binding, observation_ref: obs9.observation_ref, frame_hash: obs9.frame_hash } };
  assert.equal(await owner.currentRequiredServiceWitness(rebound, obs9, packet9.frame_rows, trial(obs9, rebound)), null);
});

test('exact V5 entries remain unchanged in the explicitly limited declarative subset', () => {
  const sourcePath = `../reference/v6/${OUTLINE_CONTINUATION_SUBSET.referenceCommit}/source/${OUTLINE_CONTINUATION_SUBSET.sourcePath}`;
  const bytes = readFileSync(new URL(sourcePath, import.meta.url)), source = JSON.parse(bytes.toString());
  assert.equal(createHash('sha256').update(bytes).digest('hex'), OUTLINE_CONTINUATION_SUBSET.sourceSha256);
  const document = JSON.parse(OUTLINE_CONTINUATION_SUBSET.document.text);
  assert.equal(createHash('sha256').update(OUTLINE_CONTINUATION_SUBSET.document.text).digest('hex'), OUTLINE_CONTINUATION_SUBSET.document.sha256);
  const entries = [document.declarations[0], ...document.declarations[1].fact_projections, OUTLINE_CONTINUATION_SUBSET.selectionTier];
  for (const pointer of OUTLINE_CONTINUATION_SUBSET.sourcePointers) {
    const original = pointer.pointer.reduce((value, key) => value[key], source);
    assert.deepEqual(entries.find(value => value.id === pointer.id), original);
  }
  assert.equal(entries.length, 5);
});

test('source count65 still throws by default; opt-in retains unknown refusal and all learned transitions', async () => {
  const row = reference.memoryCases.find(value => value.id === 'measure:transition_count_65');
  const strict = await OutlineService.create(), retained = await OutlineService.create({ retainDomainRefusal: true });
  strict.restore(row.seedState); retained.restore(row.seedState);
  await assert.rejects(() => strict.propose(row.arguments.obs, row.arguments.rows, [], 16), OutlineMeasurementDomainError);
  const before = retained.state(), checkpoint = retained.nativeState(), revision = retained.nativeRevision;
  assert.equal(await retained.propose(row.arguments.obs, row.arguments.rows, [], 16), null);
  assert.deepEqual(retained.state(), before); assert.equal(retained.nativeState(), checkpoint); assert.equal(retained.nativeRevision, revision);
  assert.equal(retained.control.transitions.length, 65); assert.equal(retained.currentProposalRefusal({ ...row.arguments.obs, frame_hash: 'stale' }), null);
  const refusal = retained.currentProposalRefusal(row.arguments.obs);
  assert.equal(refusal.status, 'unknown'); assert.equal(refusal.field, 'observed_controlled_translation_count');
  assert.equal(refusal.value, 65); assert.equal(refusal.limit, 64); assert.equal(refusal.acquisition_truncated, false);
  assert.equal(refusal.release_authority, false); assert.equal(refusal.impossibility_established, false);
  refusal.evidence_refs.push('external:mutation'); assert.equal(retained.currentProposalRefusal(row.arguments.obs).evidence_refs.includes('external:mutation'), false);
  retained.restore({ last: { action_ref: 'changed:owner' } }); assert.equal(retained.currentProposalRefusal(row.arguments.obs), null);
  const valid = reference.memoryCases.find(value => value.id === 'measure:transition_count_64');
  retained.restore(valid.seedState); await retained.propose(valid.arguments.obs, valid.arguments.rows, [], 16);
  assert.equal(retained.currentProposalRefusal(valid.arguments.obs), null);
});
