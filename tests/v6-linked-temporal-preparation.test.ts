import test from 'node:test';
import assert from 'node:assert/strict';
import { LinkedTemporalPreparation, LINKED_CONTACT_SOURCE_POLICY, LINKED_TEMPORAL_NATIVE_SEARCH_BOUNDS } from '../src/logos-engine/v6-linked-temporal-preparation.ts';
import { LinkedTemporalContact, linkedOpenEnclosures, linkedNodes, linkedPhaseSlots } from '../src/logos-engine/v6-linked-temporal-contact.ts';
import { LinkedTemporalPhaseRelations, LinkedTemporalPhaseTransfer } from '../src/logos-engine/v6-linked-temporal-phase.ts';
import { temporalDigest, temporalPatch, temporalBytePatch } from '../src/logos-engine/v6-linked-temporal-common.ts';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const refs = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'];
const inputs = refs.map(action_ref => ({ action_ref, data: {} }));
function rowsAt(position: readonly [number, number], remote = 4): number[][] {
  const rows = Array.from({ length: 28 }, () => Array(40).fill(0));
  const fill = (x: number, y: number, width: number, height: number, color: number) => {
    for (let j = y; j < y + height; j++) for (let i = x; i < x + width; i++) rows[j]![i] = color;
  };
  // Public geometry only: a smaller dense support, its thin link and larger peer.
  fill(12, 12, 2, 2, 4); fill(14, 13, 3, 1, 4); fill(17, 12, 3, 3, remote);
  // Three sides of a same-appearance open enclosure with a 3x3 cavity.
  fill(21, 11, 5, 1, 2); fill(21, 15, 5, 1, 2); fill(25, 11, 1, 5, 2);
  fill(2, 2, 2, 2, 2); rows[3]![3] = 0; fill(7, 2, 2, 2, 5); fill(12, 2, 2, 2, 5);
  fill(position[0], position[1], 3, 3, 2);
  return rows;
}
async function packet(position: readonly [number, number], revision: number, remote = 4, epoch = 1, score = 0, state = 'NOT_FINISHED') {
  const rows = rowsAt(position, remote), frame_hash = await publicFrameHash(rows);
  const publicPacket = { frame_rows: rows, frame_packet: [rows], level: epoch, levels_completed: score, state,
    step_index: revision, available_action_refs: refs, frame_hash };
  return { rows, publicPacket, observation: await measureNativeObservation(publicPacket, revision, 'synthetic:linked-temporal-unit') };
}
async function acquired(options: any = {}) {
  const family = new LinkedTemporalPreparation(LINKED_CONTACT_SOURCE_POLICY, options);
  const packets = [await packet([2, 12], 0), await packet([7, 12], 1), await packet([2, 12], 2), await packet([7, 12], 3)];
  for (let i = 0; i < 3; i++) family.recordSource(packets[i]!.observation, packets[i + 1]!.observation,
    { action_ref: i === 1 ? 'ACTION2' : 'ACTION1' }, packets[i]!.rows, packets[i + 1]!.rows);
  return { family, packets, current: packets[3]! };
}

test('cold linked preparation abstains and the public adapter preserves full observation identity', async () => {
  const family = new LinkedTemporalPreparation(), p = await packet([2, 12], 0);
  assert.equal(family.propose(p.observation, p.rows, inputs, 40), null);
  assert.equal(await LinkedTemporalPreparation.fullObservation(p.observation, p.rows), p.observation);
  const { entities, ...partial } = p.observation;
  assert.deepEqual(await LinkedTemporalPreparation.fullObservation(partial, p.rows), p.observation);
  assert.deepEqual(family.preservationObligations(p.observation, p.rows), []);
});

test('public displacement acquires the current linked geometry and preserves the source candidate order', async () => {
  const { family, current } = await acquired(), contact = family.phase.linked_contact, body = contact.body!;
  assert.equal(body.quantum, 5); assert.deepEqual(body.size, [3, 3]); assert.deepEqual(body.start, [2, 12]);
  assert.deepEqual(linkedOpenEnclosures(current.observation, body, 5), [[22, 12]]);
  const nodes = linkedNodes(current.observation, body, 5); assert.equal(nodes.length, 1); assert.deepEqual(nodes[0]!.position, [12, 12]);
  assert.equal(linkedPhaseSlots(current.observation, body), 3);
  assert.equal(linkedPhaseSlots({ ...current.observation, entities: [] }, body), null);
  const proposal = family.propose(current.observation, current.rows, inputs, 40)!;
  assert.equal(proposal.linked_preparation_plan, true); assert.equal(proposal.kind, 'linked_contact_experiment');
  assert.deepEqual(proposal.actions, [{ action_ref: 'ACTION1' }]); assert.deepEqual(proposal.steps[0].to, [12, 12]);
  assert.equal(proposal.phase_plan.mode, 'access'); assert.equal(proposal.facts.terminal_role_is_hypothesis, true);
});

test('contact, departure and a persistent effect change the next question through actual public records', async () => {
  const { family, current } = await acquired(), proposal = family.propose(current.observation, current.rows, inputs, 40)!;
  assert.equal((await family.before(proposal, 0, current.publicPacket, current.observation)).admitted, true);
  const entered = await packet([12, 12], 4, 1);
  assert.deepEqual(await family.after(proposal, 0, current.observation, entered.observation, current.rows, entered.rows),
    { matched: true, seal_prefix: true, reason: 'linked_contact_conditional_response' });
  const events = family.recordSource(current.observation, entered.observation, proposal.actions[0], current.rows, entered.rows);
  assert.equal(events.filter(e => e.kind === 'linked_contact_effect').length, 1);
  assert.ok(family.phase.linked_contact.contact!.pixels.length >= 2);
  const departure = family.propose(entered.observation, entered.rows, inputs, 40)!;
  assert.equal(departure.phase_plan.why, 'Leave the contacted occurrence and compare the frozen remote pixels.');
  const exited = await packet([7, 12], 5, 1);
  family.recordSource(entered.observation, exited.observation, { action_ref: 'ACTION2' }, entered.rows, exited.rows);
  assert.equal(family.phase.linked_contact.departure!.remote_persisted, true);
  const checkpoint = family.state(), restored = new LinkedTemporalPreparation(); restored.restore(checkpoint);
  const next = family.propose(exited.observation, exited.rows, inputs, 40);
  assert.deepEqual(restored.propose(exited.observation, exited.rows, inputs, 40), next);
  assert.equal(family.phase.linked_contact.prepared_effects.length, 1);
  assert.equal(family.phase.linked_contact.prepared_effects[0]!.kind, 'persistent_after_observed_departure');
  const obligations = family.preservationObligations(exited.observation, exited.rows); assert.equal(obligations.length, 1);
  assert.equal(obligations[0]!.meaning, 'persistent_after_observed_departure'); assert.ok(obligations[0]!.pixels.length >= 2);
  assert.deepEqual(restored.nativeState(), family.nativeState());
});

test('reversible contact is distinguished from persistence and freezes a source path before a phase input', async () => {
  const { family, current } = await acquired(); family.propose(current.observation, current.rows, inputs, 40);
  const entered = await packet([12, 12], 4, 1), exited = await packet([7, 12], 5, 4), reentered = await packet([12, 12], 6, 1);
  family.recordSource(current.observation, entered.observation, { action_ref: 'ACTION1' }, current.rows, entered.rows);
  family.recordSource(entered.observation, exited.observation, { action_ref: 'ACTION2' }, entered.rows, exited.rows);
  family.recordSource(exited.observation, reentered.observation, { action_ref: 'ACTION1' }, exited.rows, reentered.rows);
  assert.equal(family.phase.linked_contact.reversal!.conditional_hold_supported, true);
  const candidateInputs = inputs.filter(x => ['ACTION1', 'ACTION2', 'ACTION5'].includes(x.action_ref));
  const proposal = family.propose(reentered.observation, reentered.rows, candidateInputs, 40)!;
  assert.equal(proposal.phase_plan.mode, 'phase'); assert.deepEqual(proposal.actions, [{ action_ref: 'ACTION5' }]);
  assert.equal(Object.keys(proposal.preservation_changes).length, 2);
  assert.deepEqual(family.phase.linked_contact.history_paths[0], [[2, 12], [7, 12], [2, 12], [7, 12], [12, 12], [7, 12], [12, 12]]);
  const restored = new LinkedTemporalPreparation(); restored.restore(family.state()); assert.deepEqual(restored.sourceState(), family.sourceState());
});

test('guards reject stale origin, unavailable input and displaced receiver; official boundaries stay unknown', async () => {
  const { family, current } = await acquired(), proposal = family.propose(current.observation, current.rows, inputs, 40)!;
  assert.equal((await family.before(proposal, 0, { ...current.publicPacket, available_action_refs: [] }, current.observation)).admitted, false);
  assert.equal((await family.before(proposal, 0, current.publicPacket, { ...current.observation, observation_ref: 'stale' })).admitted, false);
  const elsewhere = await packet([2, 12], 4);
  assert.equal((await family.after(proposal, 0, current.observation, elsewhere.observation, current.rows, elsewhere.rows)).matched, false);
  const boundary = await packet([2, 12], 4, 4, 2, 1);
  assert.deepEqual(await family.after(proposal, 0, current.observation, boundary.observation, current.rows, boundary.rows), { matched: null, seal_prefix: true, reason: 'official_boundary' });
});

test('native work exhaustion produces a current refusal and rolls back partial proposal changes', async () => {
  const { family, current } = await acquired({ boundedSearch: { maximumNodes: 0, maximumWork: 1000 } }), before = family.sourceState();
  assert.equal(family.propose(current.observation, current.rows, inputs, 40), null);
  assert.deepEqual(family.sourceState(), before);
  const refusal = family.currentProposalRefusal(current.observation)!;
  assert.equal(refusal.status, 'unknown'); assert.equal(refusal.release_authority, false); assert.equal(refusal.block_unrelated_probe, true);
  assert.equal(refusal.exhausted_bound, 'maximum_nodes'); assert.equal(family.currentProposalRefusal({ ...current.observation, frame_hash: 'changed' }), null);
});

test('deadline exhaustion and abort preserve evidence instead of acquiring refutation', async () => {
  const { family, current } = await acquired({ boundedSearch: LINKED_TEMPORAL_NATIVE_SEARCH_BOUNDS }), before = family.sourceState();
  assert.equal(family.propose(current.observation, current.rows, inputs, 40, { yieldControl: async () => {}, now: () => 7, deadlineMs: 7 }), null);
  assert.equal(family.currentProposalRefusal(current.observation)!.exhausted_bound, 'deadline'); assert.deepEqual(family.sourceState(), before);
  const controller = new AbortController(); controller.abort();
  assert.equal(family.propose(current.observation, current.rows, inputs, 40, { yieldControl: async () => {}, signal: controller.signal }), null);
  assert.equal(family.currentProposalRefusal(current.observation)!.exhausted_bound, 'aborted'); assert.deepEqual(family.sourceState(), before);
});

test('snapshots own foreign rasters and immutable native checkpoints reuse prior acquired snapshots', async () => {
  const { family, packets, current } = await acquired(); const a = family.nativeState(), snapshot = a.phase.states[0];
  assert.equal(Object.isFrozen(snapshot.rows[0]), true); const old = snapshot.rows[0][0]; packets[0]!.rows[0]![0] = 255;
  assert.equal(snapshot.rows[0][0], old);
  const next = await packet([2, 12], 4); family.recordSource(current.observation, next.observation, { action_ref: 'ACTION2' }, current.rows, next.rows);
  const b = family.nativeState(); assert.equal(b.phase.states[0], snapshot); assert.notEqual(a, b);
  const publicCopy = family.state(); publicCopy.phase.states[0].rows[0][0] = 254; assert.equal(family.nativeState().phase.states[0].rows[0][0], old);
});

test('epoch boundaries release old raster history but retain the independently scored adapter witnesses', async () => {
  const { family, current } = await acquired(), oldEvents = family.events.length, oldSnapshot = family.phase.states[0];
  const boundary = await packet([2, 12], 4, 4, 2, 1);
  family.recordSource(current.observation, boundary.observation, { action_ref: 'ACTION1' }, current.rows, boundary.rows);
  assert.equal(family.phase.states.length, 1); assert.equal(family.phase.commands.length, 0); assert.equal(family.phase.states.includes(oldSnapshot!), false);
  assert.equal(family.phase.linked_contact.body, null); assert.equal(family.phase.portable, null);
  assert.equal(family.events.length, oldEvents); assert.deepEqual(family.passed, [{ score: 1, observation_ref: boundary.observation.observation_ref }]);
  const next = new LinkedTemporalPreparation(); next.restore(family.state()); assert.deepEqual(next.sourceState(), family.sourceState());
});

test('malformed checkpoints are rejected before changing the current owner', async () => {
  const { family } = await acquired(), baseline = family.state();
  const edits: ((state: R) => void)[] = [s => { s.schema = 'wrong'; }, s => { s.phase.commands.pop(); },
    s => { s.phase.linked_contact.seen = 1000; }, s => { delete s.phase.geometry[s.phase.linked_contact.body.signature]; },
    s => { s.phase.states[0].rows[0].push(0); }, s => { s.phase.linked_contact.phase_changed = true; },
    s => { s.phase.linked_contact.vectors.push(s.phase.linked_contact.vectors[0]); },
    s => { s.phase.linked_contact.policy.enabled = false; }, s => { s.phase.states[1].ref = s.phase.states[0].ref; },
    s => { s.phase.geometry[s.phase.linked_contact.body.signature] = '0'.repeat(64); },
    s => { s.phase.masks[s.phase.linked_contact.body.signature][0] = [99, 99]; },
    s => { s.phase.linked_contact.body.mask[0] = [99, 99]; },
    s => { s.phase.size[s.phase.linked_contact.body.signature] = [4, 4]; }];
  for (const edit of edits) { const malformed = structuredClone(baseline); edit(malformed); assert.throws(() => family.restore(malformed)); assert.deepEqual(family.state(), baseline); }
});

test('noncontiguous actual observations are refused instead of filling a fictional history', async () => {
  const { family, current } = await acquired(), next = await packet([2, 12], 4), before = family.sourceState();
  assert.throws(() => family.recordSource({ ...current.observation, observation_ref: 'missing-transition' }, next.observation,
    { action_ref: 'ACTION2' }, current.rows, next.rows), /Phase records must follow actual observations/);
  assert.deepEqual(family.sourceState(), before);
});

test('cached immutable geometry cannot be rebound to a different digest or size', async () => {
  const { family } = await acquired(), state = family.nativeState(), signature = state.phase.linked_contact.body.signature;
  const changedDigest = { ...state, phase: { ...state.phase, geometry: { ...state.phase.geometry, [signature]: 'f'.repeat(64) } } };
  const changedSize = { ...state, phase: { ...state.phase, size: { ...state.phase.size, [signature]: [4, 4] } } };
  assert.throws(() => family.restoreNative(changedDigest), /geometry/);
  assert.throws(() => family.restoreNative(changedSize), /geometry/);
  assert.equal(family.nativeState(), state);
});

test('contact digest retains Python default spaces and compact phase digest stays distinct', () => {
  const value = { b: [1, 'é'], a: true };
  assert.equal(temporalDigest(value), '266ff9dd8be4a4dbb34e1dbb98727b94db9c93a1cc3f7930c14482994ecbe8e7');
  assert.notEqual(temporalDigest(value), temporalDigest(value, false));
  assert.deepEqual(temporalPatch([[1, 2, 3], [4, 5, 6]], [-2, 0], [2, 2]), [[], []]);
  assert.equal(temporalBytePatch([[1, 2, 3]], [-1, 0], [1, 1]), null);
});
