import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { OutlineService } from '../src/logos-engine/v6-outline-service.ts';

const load = name => JSON.parse(gunzipSync(readFileSync(new URL(`../docs/migration/native-campaigns-v53/attempt3/${name}`, import.meta.url))).toString());
const campaign = load('esct-campaign.json.gz'), trace = load('esct-public-trace.json.gz');
async function actualPrefix(action, sourceCampaign = campaign, sourceTrace = trace) {
  const prefix = sourceCampaign.prefixes.find(item => item.callerAcquiredTransitions === action);
  const checkpoint = prefix.outlineAcquisition.nativeCheckpoint, packet = sourceTrace.packets[action].packet;
  const owner = await OutlineService.create({ retainDomainRefusal: true, currentPublicAnnouncementContext: true, currentRecoveryQuestions: true });
  owner.restoreNative(checkpoint);
  const scope = checkpoint.public_transition?.after ?? sourceCampaign.prefixes.find(item => item.callerAcquiredTransitions === action + 1).outlineAcquisition.nativeCheckpoint.public_transition.before;
  const observation = { ...scope, state: packet.state, available_action_refs: packet.available_action_refs };
  const proposal = await owner.propose(observation, packet.frame_rows, [], 16);
  const trial = { status: 'untried_exact_public_context', observation_ref: observation.observation_ref, level_epoch: observation.level_epoch,
    frame_hash: observation.frame_hash, action_ref: proposal.actions[0].action_ref, trial_key: 'controlled:actual-prefix-question',
    domain_complete: true, attempted_without_effect_in_current_context: false, evidence_refs: [observation.observation_ref],
    qualification: 'Controlled component admission only. No hypothetical return or game success is supplied.' };
  return { owner, packet, observation, proposal, trial };
}

test('actual local intervention permits the exact V5 rejoin question without inventing a return', async () => {
  const { owner, packet, observation, proposal, trial } = await actualPrefix(12);
  assert.equal(proposal.native_outline_public_context.kind, 'announced_rejoin');
  assert.equal(proposal.actions[0].action_ref, 'ACTION1');
  assert.equal((await owner.before(proposal, 0, packet, observation)).admitted, false);
  const state = owner.nativeState(), witness = await owner.currentRequiredServiceWitness(proposal, observation, packet.frame_rows, trial);
  assert.equal(witness.source_condition_receipt.matched_tier_ref, 'tier.post_capture_announced_cell_rejoin');
  assert.equal(witness.source_condition_receipt.projected_facts.remaining_action_bound, 1);
  assert.equal(witness.source_condition_receipt.projected_facts.full_metaplan_reprojection_required_after_primitive, true);
  proposal.native_current_service_witness = witness;
  assert.equal((await owner.before(proposal, 0, packet, observation)).admitted, true);
  assert.equal(owner.nativeState(), state, 'A question has acquired no new outcome');
});

test('actual selected access arrival asks one historical local test without asserting a complete current body', async () => {
  const read = name => JSON.parse(gunzipSync(readFileSync(new URL(`../docs/migration/native-campaigns-v53/attempt6/${name}`, import.meta.url))).toString());
  const campaign6 = read('esct-campaign.json.gz'), trace6 = read('esct-public-trace.json.gz');
  const { owner, packet, observation, proposal, trial } = await actualPrefix(23, campaign6, trace6);
  assert.equal(proposal.native_outline_public_context.kind, 'observed_body_arrival_local_test');
  assert.equal(proposal.actions[0].action_ref, 'ACTION5');
  assert.equal(proposal.outline_plan.operator, true);
  assert.equal(proposal.steps[0].expected_after, null);
  assert.equal(proposal.steps[0].seal_after, true);
  assert.ok(proposal.outline_plan.measurement.recovery.contact);
  assert.equal(proposal.outline_plan.measurement.recovery.access, undefined);
  assert.ok(owner.methods.every(method => method.scope !== observation.level_epoch));
  trial.effectful_action_context = { status: 'observed_effectful_action_inventory', domain_complete: true,
    observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, levels_completed: observation.levels_completed,
    available_action_refs: observation.available_action_refs,
    known_effectful_action_refs: [...new Set(owner.control.transitions.map(value => value.action))],
    evidence_refs: owner.control.evidence, level_start_checkpoint_action_ref: null,
    qualification: 'Controlled admission inventory from the actual acquired current directional transitions; no current local effect supplied.' };
  assert.equal(trial.effectful_action_context.known_effectful_action_refs.includes('ACTION5'), false);
  const state = owner.nativeState(), witness = await owner.currentRequiredServiceWitness(proposal, observation, packet.frame_rows, trial);
  assert.ok(witness);
  assert.equal(witness.source_subset, null);
  assert.equal(witness.global_operator_evidence, null);
  assert.equal(witness.source_condition_receipt.interpretation_kind, 'explicit_native_composition');
  assert.equal(witness.source_condition_receipt.projected_facts.current_complete_body_asserted, false);
  assert.equal(witness.source_condition_receipt.projected_facts.original_completed_bfs_endpoint_premise_reused, false);
  assert.equal(witness.source_condition_receipt.local_method_evidence.current_effect_observed, false);
  assert.ok(witness.source_condition_receipt.local_method_evidence.current_available_nondirectional_action_refs.includes('ACTION7'),
    'An available input with unknown effect is retained as unknown');
  assert.equal(witness.action_effect_known, false);
  proposal.native_current_service_witness = witness;
  assert.equal((await owner.before(proposal, 0, packet, observation)).admitted, true);
  assert.equal(owner.nativeState(), state, 'No new operator effect has been acquired by asking the question');
  const stale = structuredClone(trial); stale.effectful_action_context.level_epoch--;
  assert.equal(await owner.currentRequiredServiceWitness(proposal, observation, packet.frame_rows, stale), null);
  const competing = structuredClone(trial); competing.effectful_action_context.known_effectful_action_refs.push('ACTION7');
  assert.equal(await owner.currentRequiredServiceWitness(proposal, observation, packet.frame_rows, competing), null,
    'A second positively observed nondirectional effect makes this local method ambiguous');
  const repeated = { ...trial, attempted_without_effect_in_current_context: true };
  assert.equal(await owner.currentRequiredServiceWitness(proposal, observation, packet.frame_rows, repeated), null);
  const changed = structuredClone(proposal); changed.outline_plan.measurement.recovery.contact.current_rows_sha256 = 'stale';
  assert.equal((await owner.before(changed, 0, packet, observation)).admitted, false);
  assert.notEqual(trace6.packets[24].command.action_ref, proposal.actions[0].action_ref,
    'The old next return cannot be reused as evidence for this new command');
});

test('official boundary rebinds historical control conditionally before any new current displacement', async () => {
  const { owner, packet, observation, proposal, trial } = await actualPrefix(16);
  assert.equal(owner.nativeState().public_transition, null);
  assert.equal(owner.control.status, 'recalled_outline_hypothesis_current_unique');
  assert.equal(owner.control.transitions.length, 0); assert.equal(owner.control.evidence.length, 0);
  assert.equal(proposal.native_outline_public_context.context_kind, 'recalled_current_scene');
  assert.equal(proposal.native_outline_public_context.before, null);
  assert.equal(proposal.native_outline_public_context.prior_command, null);
  const access = proposal.outline_plan.measurement.recovery.access;
  assert.equal(access.motion_basis, 'declared_revisable_interface_prior');
  const witness = await owner.currentRequiredServiceWitness(proposal, observation, packet.frame_rows, trial);
  assert.equal(witness.source_condition_receipt.control_evidence_status, 'historical_control_current_unique_hypothesis');
  assert.equal(witness.action_effect_known, false);
  proposal.native_current_service_witness = witness;
  assert.equal((await owner.before(proposal, 0, packet, observation)).admitted, true);
  // The old campaign happened to ask this exact physical input. Its observed
  // packet may therefore test this component transition, never a new game WIN.
  assert.equal(proposal.actions[0].action_ref, trace.packets[17].command.action_ref);
  const nextPacket = trace.packets[17].packet;
  const nextScope = campaign.prefixes.find(item => item.callerAcquiredTransitions === 17).outlineAcquisition.nativeCheckpoint.public_transition.after;
  const nextObs = { ...nextScope, state: nextPacket.state, available_action_refs: nextPacket.available_action_refs };
  await owner.recordPublicTransition(observation, nextObs, trace.packets[17].command, packet.frame_rows, nextPacket.frame_rows, proposal);
  const current = await owner.propose(nextObs, nextPacket.frame_rows, [], 16);
  assert.equal(current.native_outline_public_context.kind, 'observed_body_access');
  assert.equal(current.outline_plan.measurement.recovery.access.marker_cell_bbox, null);
  assert.equal(current.outline_plan.measurement.recovery.access.relation.cardinal_marker, null);
  assert.equal(current.outline_plan.measurement.recovery.access.action_effect_known, false);
  const checkpoint = owner.nativeState(), corrupted = structuredClone(checkpoint);
  corrupted.public_transition.selected_outline.access_relation.current_rows_sha256 = 'stale';
  assert.throws(() => owner.restoreNative(corrupted), TypeError);
  assert.equal(owner.nativeState(), checkpoint);
});

test('reacquired outline composes one current access experiment from historical method evidence', async () => {
  const { owner, packet, observation, proposal, trial } = await actualPrefix(20);
  assert.equal(observation.level_epoch, 2);
  assert.equal(proposal.native_outline_public_context.kind, 'announced_access');
  assert.equal(proposal.actions.length, 1); assert.equal(proposal.steps[0].seal_after, true);
  assert.ok(owner.methods.every(method => method.scope !== observation.level_epoch), 'Earlier methods are historical, not relabeled current');
  const access = proposal.outline_plan.measurement.recovery.access;
  assert.equal(access.relation_count, 1); assert.ok(access.distance_after < access.distance_before);
  assert.equal(access.route_safety_established, false);
  assert.equal((await owner.before(proposal, 0, packet, observation)).admitted, false);
  const witness = await owner.currentRequiredServiceWitness(proposal, observation, packet.frame_rows, trial);
  assert.equal(witness.source_subset, null, 'Initial access is not claimed as an original V5 rule match');
  assert.equal(witness.source_condition_receipt.interpretation_kind, 'explicit_native_composition');
  assert.equal(witness.source_condition_receipt.projected_facts.source_rejoin_last_nondirectional_premise_reused, false);
  assert.equal(witness.action_effect_known, false); assert.equal(witness.release_authority, false);
  proposal.native_current_service_witness = witness;
  assert.equal((await owner.before(proposal, 0, packet, observation)).admitted, true);
  for (const patch of [{ frame_hash: 'stale' }, { level_epoch: 1 }, { attempted_without_effect_in_current_context: true }]) {
    assert.equal(await owner.currentRequiredServiceWitness(proposal, observation, packet.frame_rows, { ...trial, ...patch }), null);
  }
  const changed = structuredClone(proposal); changed.steps[0].expected_after.body_bbox[0]++;
  assert.equal((await owner.before(changed, 0, packet, observation)).admitted, false);
});
