import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { OutlineService } from '../src/logos-engine/v6-outline-service.ts';
import { measureOutlinePerimeterAccompaniment } from '../src/logos-engine/v6-outline-geometry.ts';
import { OUTLINE_PUBLIC_OPERATOR_SUBSET, evaluateOutlinePublicOperatorSubset, makeOutlinePublicTransition,
  retainOutlinePublicTransition } from '../src/logos-engine/v6-outline-public-context.ts';
import { factConditionHolds } from '../src/logos-engine/v6-drm-projector.ts';
import { bindPreservation } from '../src/logos-engine/v6-transition-learning.ts';
import { rowsDigest } from '../src/logos-engine/v6-native-observer.ts';

const read = path => JSON.parse(gunzipSync(readFileSync(new URL(path, import.meta.url))).toString());
const fixture = read('./fixtures/v6-outline-prior-raster-reference.json.gz');
const declarations = new Map(fixture.subset.sourceDeclarations.map(value => [value.id, value.declaration]));
const matches = (rule, facts) => (rule.all_conditions ?? []).every(condition => factConditionHolds(condition, facts))
  && (!(rule.any_conditions?.length) || rule.any_conditions.some(condition => factConditionHolds(condition, facts)));
for (const row of fixture.conditionCases) test(`outline public operator source conditions ${row.id}`, () => {
  assert.equal(matches(declarations.get(row.ruleRef), row.facts), row.value);
});
for (const row of fixture.projectionCases) test(`outline public operator source projections ${row.id}`, async () => {
  if (row.error) await assert.rejects(() => evaluateOutlinePublicOperatorSubset(row.facts));
  else assert.deepEqual(await evaluateOutlinePublicOperatorSubset(row.facts), row.value);
});
for (const row of fixture.tierOrderCases) test(`outline exact adjacent V5 tiers ${row.id}`, () => {
  const tiers = [fixture.subset.selectionTier, fixture.subset.followingTier.declaration], index = tiers.findIndex(tier => matches(tier, row.facts));
  assert.deepEqual({ matched_tier_ref: index < 0 ? null : tiers[index].id, relativeTierIndex: index < 0 ? tiers.length : index }, row.value);
});
for (const row of fixture.geometryCases) test(`outline previous public raster original helper ${row.id}`, async () => {
  assert.deepEqual(await measureOutlinePerimeterAccompaniment(row.arguments.rows, row.arguments.fields), row.value);
});
test('outline public operator document and external tier are accepted unchanged by the source loader', () => {
  assert.equal(fixture.subset.originalStrictLoaderAccepted, true);
  assert.deepEqual(OUTLINE_PUBLIC_OPERATOR_SUBSET.document, fixture.subset.document);
  assert.deepEqual(OUTLINE_PUBLIC_OPERATOR_SUBSET.selectionTier, fixture.subset.selectionTier);
});

const campaign = read('../docs/migration/native-campaigns-v53/attempt2/esct-campaign.json.gz');
const packets = read('../docs/migration/native-campaigns-v53/attempt2/esct-public-trace.json.gz').packets;
const copy = value => structuredClone(value), options = { currentPublicAnnouncementContext: true, retainDomainRefusal: true };
const namespace = 'controlled:outline:actual-public-prefix';
function observation(packet, step) {
  return { observation_ref: `${namespace}:epoch:${packet.level}:revision:${step + 1}:frame:${packet.frame_hash}`,
    revision: step + 1, level_epoch: packet.level, levels_completed: packet.levels_completed,
    frame_hash: packet.frame_hash, available_action_refs: packet.available_action_refs, state: packet.state };
}
async function acquire({ limit = 11, lastPassive = false, protectLast = false } = {}) {
  const owner = await OutlineService.create(options), known = new Set(), evidence = new Set();
  let sourceRecords = 0;
  const original = owner.recordSource.bind(owner);
  owner.recordSource = async (...args) => { sourceRecords++; return original(...args); };
  for (let step = 1; step <= limit; step++) {
    const first = packets[step - 1].packet, second = packets[step].packet, before = observation(first, step - 1), after = observation(second, step);
    const action = campaign.actions[step - 1], consulted = await owner.propose(before, first.frame_rows, [], 16);
    let proposal = action.family === owner.id && !(lastPassive && step === limit) ? consulted : null;
    if (proposal) assert.equal(proposal.actions[0].action_ref, action.command.action_ref);
    if (proposal && protectLast && step === limit) {
      [proposal] = bindPreservation(proposal, [{ id: 'controlled:preserve-current-pixel', meaning: 'Current observed pixel',
        pixels: [[0, 0, first.frame_rows[0][0]]], evidence: [before.observation_ref], revision_inputs: [] }], before, first.frame_rows);
    }
    await owner.recordPublicTransition(before, after, action.command, first.frame_rows, second.frame_rows, proposal, 0);
    if (before.frame_hash !== after.frame_hash) { known.add(action.command.action_ref); evidence.add(before.observation_ref); evidence.add(after.observation_ref); }
  }
  assert.equal(sourceRecords, limit, 'Source acquisition is called exactly once per actual return');
  const packet = packets[limit].packet, obs = observation(packet, limit), proposal = await owner.propose(obs, packet.frame_rows, [], 16);
  const trial = { status: 'untried_exact_public_context', observation_ref: obs.observation_ref, level_epoch: obs.level_epoch,
    frame_hash: obs.frame_hash, action_ref: proposal?.actions[0].action_ref, trial_key: 'controlled:component-trial',
    domain_complete: true, attempted_without_effect_in_current_context: false, evidence_refs: [obs.observation_ref],
    qualification: 'Conditional component trial only; the separate Kernel contract obtains the real caller trial.',
    effectful_action_context: { observation_ref: obs.observation_ref, level_epoch: obs.level_epoch, levels_completed: obs.levels_completed,
      available_action_refs: [...obs.available_action_refs], known_effectful_action_refs: [...known], evidence_refs: [...evidence],
      domain_complete: true, level_start_checkpoint_action_ref: null, v5_producer_parity: false,
      qualification: 'Positive differences in the actual first eleven public final rasters; no extra action was dispatched.' } };
  return { owner, packet, obs, proposal, trial };
}
const acquired = await acquire();
async function restoreAcquired() {
  const owner = await OutlineService.create(options); owner.restoreNative(acquired.owner.nativeState());
  const packet = acquired.packet, obs = acquired.obs, proposal = await owner.propose(obs, packet.frame_rows, [], 16);
  return { owner, packet, obs, proposal, trial: copy(acquired.trial) };
}

test('real preceding raster exposes the source operator question, which cannot pass before its actual-trial gate', async () => {
  const { owner, packet, obs, proposal, trial } = await restoreAcquired();
  assert.equal(await owner.proposeSource(obs, packet.frame_rows, [], 16), null);
  assert.equal(proposal.requires_current_service_witness, true);
  assert.equal(proposal.native_outline_public_context.kind, 'obstructing_inset_operator');
  assert.equal(proposal.outline_plan.workflow, undefined);
  assert.equal(proposal.outline_plan.native_construction.status, 'pending_actual_caller_service_witness');
  assert.equal(proposal.steps[0].expected_after, null); assert.equal(proposal.actions.length, 1);
  assert.equal((await owner.before(proposal, 0, packet, obs)).admitted, false);
  const checkpoint = owner.nativeState(), revision = owner.nativeRevision;
  const witness = await owner.currentRequiredServiceWitness(proposal, obs, packet.frame_rows, trial);
  assert.equal(witness.status, 'current_required_service'); assert.equal(witness.source_condition_receipt.matched_tier_ref, fixture.subset.selectionTier.id);
  assert.equal(witness.global_operator_evidence.candidate_count, 1); assert.equal(witness.action_effect_known, false);
  assert.equal(witness.release_authority, false); assert.equal(witness.current_trial.effectful_action_context.v5_producer_parity, false);
  proposal.native_current_service_witness = witness;
  assert.equal((await owner.before(proposal, 0, packet, obs)).admitted, true);
  assert.equal(owner.nativeState(), checkpoint); assert.equal(owner.nativeRevision, revision);
  const annex = checkpoint.public_transition;
  assert.deepEqual(annex.before_rows, packets[10].packet.frame_rows); assert.equal(annex.after.frame_hash, packets[11].packet.frame_hash);
  assert.equal(annex.selected_outline.active_goal_ref, 'goal.accompany_mobile_entity_to_compatible_hollow_perimeter');
});

test('v2 annex is immutable, restores atomically, and source-only restore has no previous-raster authority', async () => {
  const { owner, packet, obs } = await restoreAcquired(), checkpoint = owner.nativeState(), state = owner.state(), revision = owner.nativeRevision;
  assert.equal(checkpoint.format, 'native.public_outline_service.v2');
  assert.ok(Object.isFrozen(checkpoint.public_transition.before_rows[0]));
  for (const mutate of [value => { value.public_transition.before_rows[0][0]++; }, value => { value.public_transition.after.frame_hash = 'stale'; },
    value => { value.public_transition.after.revision++; }, value => { value.public_transition.after.level_epoch++; },
    value => { value.public_transition.selected_outline.command.action_ref = 'changed'; },
    value => { value.public_transition.selected_outline.active_goal_ref = 'fabricated:goal'; },
    value => { value.source_state.last = { action_ref: 'changed' }; }]) {
    const changed = copy(checkpoint); mutate(changed);
    assert.throws(() => owner.restoreNative(changed), TypeError);
    assert.equal(owner.nativeState(), checkpoint); assert.equal(owner.nativeRevision, revision); assert.deepEqual(owner.state(), state);
  }
  owner.restore(state); assert.equal(owner.nativeState().public_transition, null); assert.deepEqual(owner.state(), state);
  assert.equal(await owner.propose(obs, packet.frame_rows, [], 16), null);
  owner.restoreNative(checkpoint); assert.equal((await owner.propose(obs, packet.frame_rows, [], 16)).native_outline_public_context.kind, 'obstructing_inset_operator');
});

test('optional annex declines alternate public hash domains while strict source acquisition continues unchanged', async context => {
  for (const variant of [
    { name: 'alternate after hash', first: false, second: true },
    { name: 'alternate before hash', first: true, second: false },
    { name: 'alternate before and after hashes', first: true, second: true },
  ]) await context.test(variant.name, async () => {
    const { owner } = await restoreAcquired(), strict = await OutlineService.create();
    strict.restore(owner.state());
    const first = copy(packets[11].packet), second = copy(packets[12].packet);
    if (variant.first) first.frame_hash = await rowsDigest(first.frame_rows);
    if (variant.second) second.frame_hash = await rowsDigest(second.frame_rows);
    const before = observation(first, 11), after = observation(second, 12), action = campaign.actions[11].command;
    assert.ok(owner.nativeState().public_transition, 'A previous in-domain annex exists before the actual return');
    const expected = await strict.recordSource(before, after, action, first.frame_rows, second.frame_rows);
    assert.deepEqual(await owner.recordPublicTransition(before, after, action, first.frame_rows, second.frame_rows), expected);
    assert.deepEqual(owner.state(), strict.state(), 'Optional evidence cannot change the ordinary source acquisition');
    assert.equal(owner.nativeState().public_transition, null, 'Unsupported current identity clears any stale prior annex');
  });
});

test('declining unsupported production does not relax restored annex or supported-domain byte validation', async () => {
  const { owner, packet } = await restoreAcquired(), checkpoint = owner.nativeState(), state = owner.state(), revision = owner.nativeRevision;
  const annex = checkpoint.public_transition, alternate = copy(checkpoint);
  alternate.public_transition.before.frame_hash = await rowsDigest(annex.before_rows);
  assert.throws(() => owner.restoreNative(alternate), TypeError);
  assert.equal(owner.nativeState(), checkpoint); assert.equal(owner.nativeRevision, revision); assert.deepEqual(owner.state(), state);
  const make = after => makeOutlinePublicTransition(annex.before, after, annex.command, annex.before_rows,
    packet.frame_rows, state, annex.selected_outline);
  assert.throws(() => make({ ...annex.after, frame_hash: '0'.repeat(16) }), /Invalid native outline public transition/);
  assert.throws(() => make({ ...annex.after, revision: annex.after.revision + 1 }), /Invalid native outline public transition/);
});

test('current observed-body arrival local test retains only the operator goal binding', async () => {
  const { owner } = await restoreAcquired(), state = owner.state(), annex = copy(owner.nativeState().public_transition);
  const selected = annex.selected_outline;
  selected.meaning_kind = 'native_current_observed_body_arrival_local_test_hypothesis';
  selected.active_goal_ref = 'goal.reveal_action_conditioned_structure';
  assert.deepEqual(retainOutlinePublicTransition(annex, state), annex);
  const changedGoal = copy(annex);
  changedGoal.selected_outline.active_goal_ref = 'goal.accompany_mobile_entity_to_compatible_hollow_perimeter';
  assert.throws(() => retainOutlinePublicTransition(changedGoal, state), /Invalid native outline dispatched goal binding/);
  const inventedAccess = copy(annex); inventedAccess.selected_outline.access_relation = {};
  assert.throws(() => retainOutlinePublicTransition(inventedAccess, state), /Invalid native outline retained current access relation/);
});

test('consulting an outline offer cannot create a dispatched goal in passive acquisition', async () => {
  const passive = await acquire({ lastPassive: true });
  assert.equal(passive.owner.nativeState().public_transition.selected_outline, null);
  assert.notEqual(passive.proposal?.native_outline_public_context?.kind, 'obstructing_inset_operator');
});

test('operator witness requires the complete global current effectful inventory and rejects a second eligible operator', async () => {
  const { owner, packet, obs, proposal, trial } = await restoreAcquired();
  for (const mutate of [value => { delete value.effectful_action_context; }, value => { value.effectful_action_context.domain_complete = false; },
    value => { value.effectful_action_context.level_epoch++; }, value => { value.effectful_action_context.levels_completed++; },
    value => { value.effectful_action_context.known_effectful_action_refs = []; }, value => { value.effectful_action_context.evidence_refs = []; },
    value => { value.attempted_without_effect_in_current_context = true; }]) {
    const changed = copy(trial); mutate(changed);
    assert.equal(await owner.currentRequiredServiceWitness(proposal, obs, packet.frame_rows, changed), null);
  }
  const alternate = { ...obs, available_action_refs: [...obs.available_action_refs, 'controlled:other-local-input'] };
  const candidate = await owner.propose(alternate, packet.frame_rows, [], 16), changed = copy(trial);
  changed.effectful_action_context.available_action_refs = alternate.available_action_refs;
  changed.effectful_action_context.known_effectful_action_refs.push('controlled:other-local-input');
  assert.equal(await owner.currentRequiredServiceWitness(candidate, alternate, packet.frame_rows, changed), null);
});

test('common preservation additions are re-produced exactly, retained, and cannot mutate the service plan', async () => {
  const { owner, packet, obs, proposal, trial } = await restoreAcquired();
  proposal.native_current_service_witness = await owner.currentRequiredServiceWitness(proposal, obs, packet.frame_rows, trial);
  const obligations = [{ id: 'controlled:keep-current-pixel', meaning: 'Preserve this actual current pixel',
    pixels: [[0, 0, packet.frame_rows[0][0]]], evidence: [obs.observation_ref], revision_inputs: [] }];
  const [protectedProposal, rejected] = bindPreservation(proposal, obligations, obs, packet.frame_rows);
  assert.equal(rejected.length, 0); assert.equal(protectedProposal.compositions.at(-1).role, 'preserved_condition');
  const guard = await owner.before(protectedProposal, 0, packet, obs);
  assert.equal(guard.admitted, true); assert.equal(guard.native_binding_receipt.common_preservation_revalidated, true);
  assert.deepEqual(protectedProposal.preservation.obligations, obligations);
  assert.deepEqual(protectedProposal.bundle_template.preserve_refs, [obligations[0].id]);
  for (const mutate of [value => { value.compositions.at(-1).properties.condition = 'changed'; },
    value => { value.bundle_template.preservation_evidence[obligations[0].id].current_condition_measure.matched = false; },
    value => { value.steps[0].expected_after = { invented: true }; }, value => { value.preservation.obligations[0].pixels = null; }]) {
    const changed = copy(protectedProposal); mutate(changed);
    assert.equal((await owner.before(changed, 0, packet, obs)).admitted, false);
  }
  const selected = await acquire({ protectLast: true });
  assert.equal(selected.owner.nativeState().public_transition.selected_outline.active_goal_ref, 'goal.accompany_mobile_entity_to_compatible_hollow_perimeter');
});

test('official scope boundary clears the one-transition annex without truncating historical source methods', async () => {
  const { owner, packet, obs } = await restoreAcquired();
  const boundary = { ...obs, observation_ref: 'controlled:next-epoch', revision: obs.revision + 1,
    level_epoch: obs.level_epoch + 1, levels_completed: obs.levels_completed + 1 };
  const methods = copy(owner.state().methods);
  const event = await owner.recordPublicTransition(obs, boundary, { action_ref: 'controlled:boundary' }, packet.frame_rows, packet.frame_rows);
  assert.equal(event.status, 'boundary'); assert.equal(owner.nativeState().public_transition, null);
  assert.deepEqual(owner.state().methods, methods);
});
