import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { AnimatedContact } from '../src/logos-engine/v6-animated-contact.ts';
import { animatedUnacquiredInquiryWitness, retainedTraceBoundaryCandidate,
  traceAcquiredContinuationWitness } from '../src/logos-engine/v6-acquired-continuation.ts';
import { commonTraceFieldProposal, TraceFieldMemory, traceFieldBefore } from '../src/logos-engine/v6-trace-field-access.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const root = new URL('../', import.meta.url);
const report = JSON.parse(await readFile(new URL('docs/migration/native-campaigns-v47/zipp-six-levels.json', root), 'utf8')) as R;
const trace = JSON.parse(gunzipSync(await readFile(new URL('docs/migration/native-campaigns-v47/zipp-public-trace.json.gz', root))).toString()) as R;
const config = JSON.parse(await readFile(new URL('src/logos-engine/v6/frontier-policy.json', root), 'utf8'));
const strategy = JSON.parse(await readFile(new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm', root), 'utf8'));
const traceConfig = strategy.declarations[0].configuration.window_constraints.trace_field_composition;
const prefix = report.prefixes.findLast((entry: R) => entry.proposalKind === 'trace_field_experiment');
const event = prefix.sharedSeries.traceFieldLatestExtension;
const packet = trace.packets[77].packet;
const observation = await measureNativeObservation(packet, 78, 'controlled-acquired-trace-boundary');
const memory = new TraceFieldMemory();
// This reuses a public acquired event only to test the read-only witness
// contract. It is not a cold game campaign or a substitute for Kernel proof.
memory.applyEvent(event);
const state = memory.currentState();
const native = await commonTraceFieldProposal(memory, observation, packet.frame_rows, [], 600, traceConfig, 360_000, () => 0);
assert.ok(native);
const proposal = { ...native, field_subquestion: 'trace_field_composition' };
const animation = new AnimatedContact(config.animated_contact_question);
const invitation = await animation.propose(observation, packet.frame_rows, [], 600);
assert.ok(invitation);

test('a retained source boundary is only a preflight reference until actual Kernel scores corroborate it', () => {
  assert.equal(event.transition.outcome, 'official_boundary');
  assert.equal(event.transition.levels_completed, undefined, 'The pinned source event has no official score pair');
  const witness = retainedTraceBoundaryCandidate(state, observation);
  assert.ok(witness);
  assert.equal(witness.success_ref, event.transition.after_ref);
  assert.equal(witness.kernel_score_corroboration_required, true);
  assert.equal(witness.source_entry, 'trace_field_composition');
  assert.equal(witness.source_kind, 'trace_field_experiment');
  assert.match(witness.qualification, /boundary reference only/);
  assert.equal(retainedTraceBoundaryCandidate({ trace_state: null, trace_events: [] }, observation), null);
  assert.equal(retainedTraceBoundaryCandidate(state, { ...observation, levels_completed: 0 }), null);
  const notBoundary = copy(state); notBoundary.trace_events[0]!.transition.outcome = 'local_extension_observed';
  assert.equal(retainedTraceBoundaryCandidate(notBoundary, observation), null);
});

test('the public next-epoch trace has a freshly measured cover while its control effect remains unacquired', () => {
  const before = copy(state), witness = traceAcquiredContinuationWitness(state, proposal, observation);
  assert.ok(witness);
  assert.equal(witness.bounded_cover_cells, 25);
  assert.equal(witness.action_effect_known, false);
  assert.equal(witness.current_epoch_local_effects, 0);
  assert.equal(witness.effect_scope, 'current_effect_remains_an_information_question');
  assert.equal(proposal.actions.length, 1);
  assert.equal(proposal.steps[0].relation_observed, false);
  assert.equal(proposal.steps[0].expected_after, null);
  assert.ok(proposal.trace_field_plan.estimate.search_nodes > 0);
  assert.equal(traceFieldBefore(proposal, 0, packet.frame_rows, { epoch: packet.level, score: packet.levels_completed,
    observation_ref: observation.observation_ref, available: packet.available_action_refs }).admitted, true);
  assert.deepEqual(state, before, 'Neither preflight nor current attestation acquires a projected effect');
  assert.deepEqual(memory.currentState(), before);
});

const changes: [string, (value: R) => void][] = [
  ['another shared entry', value => { value.field_subquestion = 'queued_field_composition'; }],
  ['another proposal kind', value => { value.kind = 'queued_field_composition'; }],
  ['stale binding', value => { value.binding.observation_ref = 'previous-observation'; }],
  ['old epoch', value => { value.trace_field_plan.epoch--; }],
  ['old public score', value => { value.trace_field_plan.score--; }],
  ['altered command', value => { value.actions[0].data.x++; }],
  ['invented learned step', value => { value.steps[0].relation_observed = true; }],
  ['invented learned state', value => { value.trace_field_plan.state.successes = copy(state.trace_state!.successes); }],
  ['invented terminal law', value => { value.facts.official_terminal_law_unknown = false; }],
  ['changed point support', value => { value.steps[0].point_support.point[0]++; }],
  ['changed first-step expected frame', value => { value.steps[0].expected_before.frame_hash = 'stale-frame'; }],
  ['a truncated covering witness', value => { value.trace_field_plan.estimate.path.pop();
    value.proposal_id = 'C_trace_' + symbolicDigest(value.trace_field_plan).slice(0, 20); value.bundle_template.composition_ref = value.proposal_id; }],
];
for (const [name, change] of changes) test(`trace continuation refuses ${name}`, () => {
  const changed = copy(proposal); change(changed);
  assert.equal(traceAcquiredContinuationWitness(state, changed, observation), null);
});

test('current trace guard still refuses unavailable control and changed public pixels', () => {
  const meta = { epoch: packet.level, score: packet.levels_completed,
    observation_ref: observation.observation_ref, available: [] };
  assert.equal(traceFieldBefore(proposal, 0, packet.frame_rows, meta).admitted, false);
  const rows = copy(packet.frame_rows); rows[0][0] = (rows[0][0] + 1) % 16;
  assert.equal(traceFieldBefore(proposal, 0, rows, { ...meta, available: packet.available_action_refs }).admitted, false);
});

test('the same public view supplies an unacquired visual invitation with no contact effect evidence', () => {
  const witness = animation.unacquiredInquiryWitness(invitation, observation);
  assert.ok(witness);
  assert.equal(invitation.animated_contact_plan.mode, 'invitation');
  assert.equal(witness.status, 'unacquired_exploration');
  assert.deepEqual(witness.evidence_refs, []);
  assert.equal(witness.proposal_ref, invitation.proposal_id);
  assert.equal(animation.before(invitation, 0, packet, observation).admitted, true);
});

test('even an old unsuccessful contact event or a pending return prevents wholly-unacquired attestation', () => {
  const empty = animation.state();
  for (const prior of [{ epoch: observation.level_epoch - 1, mode: 'invitation', model: null },
    { epoch: observation.level_epoch - 1, mode: 'contact_solution', model: { untrusted: true } }]) {
    assert.equal(animatedUnacquiredInquiryWitness({ ...empty, events: [prior] }, null, invitation, observation), null);
  }
  assert.equal(animatedUnacquiredInquiryWitness(empty, { pending: true }, invitation, observation), null);
});

test('the invitation witness refuses borrowed evidence, changed modes, stale context and changed payloads', () => {
  const altered: [(value: R) => void][] = [
    [value => { value.question.hypothesis_refs.push('earlier-return'); }],
    [value => { value.animated_contact_plan.mode = 'contact_solution'; }],
    [value => { value.binding.frame_hash = 'different-frame'; }],
    [value => { value.actions[0].data.x++; }],
  ];
  for (const [change] of altered) {
    const changed = copy(invitation); change(changed);
    assert.equal(animation.unacquiredInquiryWitness(changed, observation), null);
  }
});
