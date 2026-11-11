import assert from 'node:assert/strict';
import test from 'node:test';
import { RankedWorkshop } from '../src/logos-engine/v6-ranked-workshop.ts';
import { syntheticWorkshopPublicState as publicState } from './helpers/v6-synthetic-workshop.ts';
import type { NativeObservation } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);


async function acquiredCurrent() {
  const owner = await RankedWorkshop.create(), free = await publicState(false, 1), held = await publicState(true, 2);
  assert.equal(await owner.propose(free.observation, free.rows, [], 16), null);
  const event = owner.recordSource(free.observation, held.observation, { action_ref: 'ACTION5' }, free.rows, held.rows);
  assert.equal(event?.status, 'mode_marker_contrast');
  assert.equal(owner.mode_methods.length, 1); assert.equal(owner.mode_methods[0]!.contrasts.length, 1);
  assert.deepEqual(owner.mode_evidence[0]!.observed_change, [0, 1]);
  const proposal = await owner.proposeInSubquestion('factored_material_return', 'observed_ranked_workshop', held.observation, held.rows, [], 16) as R;
  assert.ok(proposal, 'Original DRM must actually select a proposal from the synthetic public geometry');
  return { owner, free, held, proposal };
}

async function acquiredPortable() {
  const { owner, free, held } = await acquiredCurrent(), returned = await publicState(false, 3), next = await publicState(false, 4, 2);
  owner.recordSource(held.observation, returned.observation, { action_ref: 'ACTION5' }, held.rows, returned.rows);
  assert.deepEqual(owner.mode_methods[0]!.contrasts.map((row: R) => row.change), [[0, 1], [1, 0]]);
  owner.recordSource(returned.observation, next.observation, { action_ref: 'ACTION5' }, returned.rows, next.rows);
  assert.equal(owner.mode_evidence.length, 0);
  const proposal = await owner.propose(next.observation, next.rows, [], 16) as R;
  assert.equal(proposal?.workshop_plan.extension.kind, 'revalidate_mode');
  return { owner, free, held, returned, next, proposal };
}

test('independent public mode acquisition grounds the exact source continuation, whose input differs from the mode input', async () => {
  const { owner, held, proposal } = await acquiredCurrent(), state = owner.state();
  assert.deepEqual(proposal.actions, [{ action_ref: 'ACTION4' }]);
  assert.notDeepEqual(proposal.actions[0], owner.mode_evidence[0]!.action);
  assert.equal(proposal.bundle_template.operation_key, 'OP18');
  const witness = owner.groundedInquiryWitness(proposal, held.observation);
  assert.equal(witness?.status, 'acquired_context_for_unknown_effect');
  assert.deepEqual(witness?.context_model_ids, [owner.mode_methods[0]!.ref]);
  assert.deepEqual(witness?.evidence_refs, owner.mode_evidence[0]!.evidence);
  assert.match(witness!.qualification, /effect remains unknown/);
  assert.deepEqual(owner.state(), state, 'Reading the witness must not mutate acquired source state');
  owner.bind(proposal);
  assert.equal(owner.before(proposal, 0, held.publicPacket, held.observation).admitted, true);
  assert.equal(owner.before(proposal, 0, { ...held.publicPacket, available_action_refs: [] }, held.observation).admitted, false,
    'An acquired-context receipt cannot bypass the ordinary current-input guard');
});

test('portable revalidation requires both public contrasts and remains conditional in a restored new scope', async () => {
  const { owner, next, proposal } = await acquiredPortable(), state = owner.nativeState();
  assert.equal(owner.groundedInquiryWitness(proposal, next.observation)?.status, 'acquired_context_for_unknown_effect');
  assert.equal(owner.before(proposal, 0, next.publicPacket, next.observation).admitted, true);
  const restored = await RankedWorkshop.create(); restored.restoreNative(state);
  assert.equal(restored.groundedInquiryWitness(proposal, next.observation), null, 'A persistent method is not a transient current selection');
  const current = await restored.propose(next.observation, next.rows, [], 16) as R;
  assert.deepEqual(current, proposal);
  assert.ok(restored.groundedInquiryWitness(current, next.observation));
  assert.equal(restored.mode_evidence.length, 0, 'Portable evidence does not pretend current mode acquisition');
  const failed = await publicState(false, 5, 2);
  restored.recordSource(next.observation, failed.observation, current.actions[0], next.rows, failed.rows, current);
  assert.deepEqual(restored.method_refutations, [[current.workshop_plan.extension.method_ref, 2]]);
  assert.equal(restored.groundedInquiryWitness(current, next.observation), null);
  assert.equal(await restored.propose(failed.observation, failed.rows, [], 16), null);
});

test('source seals permit caller routing only and reject mutation of every source-produced proposal field', async () => {
  const { owner, held, proposal } = await acquiredCurrent();
  const routed = { ...copy(proposal), proposal_id: 'kernel:proposal', strategy_receipt: { selected: 'factored_material_return' },
    material_access_subquestion: 'observed_ranked_workshop' };
  assert.ok(owner.groundedInquiryWitness(routed, held.observation));
  for (const key of ['status', 'kind', 'actions', 'steps', 'facts', 'binding', 'workshop_plan', 'compositions', 'question', 'route_refs', 'bundle_template']) {
    const changed = copy(proposal); changed[key] = null;
    assert.equal(owner.groundedInquiryWitness(changed, held.observation), null, key);
    const missing = copy(proposal); delete missing[key];
    assert.equal(owner.groundedInquiryWitness(missing, held.observation), null, `missing ${key}`);
  }
  for (const key of ['revision', 'level_epoch', 'levels_completed', 'frame_hash', 'observation_ref', 'state', 'available_action_refs', 'entities']) {
    const changed = copy(held.observation) as R; changed[key] = Array.isArray(changed[key]) ? [] : typeof changed[key] === 'number' ? changed[key] + 1 : changed[key] + ':changed';
    assert.equal(owner.groundedInquiryWitness(proposal, changed as NativeObservation), null, key);
  }
});

test('all restore paths and each new proposal consultation clear the transient source selection', async () => {
  const { owner, held, proposal } = await acquiredCurrent(), checkpoint = owner.nativeState();
  assert.ok(owner.groundedInquiryWitness(proposal, held.observation));
  owner.restoreNative(checkpoint);
  assert.equal(owner.groundedInquiryWitness(proposal, held.observation), null, 'The unchanged-checkpoint fast path clears the seal');
  const second = await owner.propose(held.observation, held.rows, [], 16) as R;
  assert.ok(owner.groundedInquiryWitness(second, held.observation));
  owner.restore(owner.state());
  assert.equal(owner.groundedInquiryWitness(second, held.observation), null);
  const third = await owner.propose(held.observation, held.rows, [], 16) as R;
  assert.ok(owner.groundedInquiryWitness(third, held.observation));
  assert.equal(await owner.propose(held.observation, held.rows, [], 0), null);
  assert.equal(owner.groundedInquiryWitness(third, held.observation), null, 'Even a null consultation supersedes the old selection');
});

test('current continuation rejects lost contrast, wrong epoch, changed method and scoped rejection', async () => {
  for (const alter of [
    (owner: RankedWorkshop) => { owner.mode_evidence = []; },
    (owner: RankedWorkshop) => { owner.mode_evidence[0]!.same_profiles_and_marker_position = false; },
    (owner: RankedWorkshop) => { owner.mode_evidence[0]!.observed_change = [1, 0]; },
    (owner: RankedWorkshop) => { owner.mode_methods[0]!.contrasts[0].source_epoch++; },
    (owner: RankedWorkshop) => { owner.mode_methods[0]!.action = { action_ref: 'ACTION3' }; },
    (owner: RankedWorkshop) => { owner.method_refutations.push([owner.mode_methods[0]!.ref, owner.epoch]); },
    (owner: RankedWorkshop, proposal: R) => { owner.rejected.push([proposal.workshop_plan.rule_ref, proposal.workshop_plan.context_sha256]); },
  ]) {
    const { owner, held, proposal } = await acquiredCurrent(); alter(owner, proposal);
    assert.equal(owner.groundedInquiryWitness(proposal, held.observation), null);
  }
});

test('portable evidence cannot reuse one public contrast as both directions or survive a current refutation', async () => {
  for (const alter of [
    (owner: RankedWorkshop) => { owner.mode_methods[0]!.contrasts.pop(); },
    (owner: RankedWorkshop) => { owner.mode_methods[0]!.contrasts[1].evidence = copy(owner.mode_methods[0]!.contrasts[0].evidence); },
    (owner: RankedWorkshop) => { owner.mode_methods[0]!.contrasts[0].evidence[1] = owner.mode_methods[0]!.contrasts[0].evidence[0]; },
    (owner: RankedWorkshop) => { owner.method_refutations.push([owner.mode_methods[0]!.ref, owner.epoch]); },
  ]) {
    const { owner, next, proposal } = await acquiredPortable(); alter(owner);
    assert.equal(owner.groundedInquiryWitness(proposal, next.observation), null);
  }
});
