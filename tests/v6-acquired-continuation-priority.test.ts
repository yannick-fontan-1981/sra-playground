import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeSelectionGroup } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeCommand, NativeExecution, NativeFamily, NativeObservation, NativeProposal,
  NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { nativeProgramDescriptions } from '../src/logos-engine/v6-src-program.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';
import { continuationProposalDigest, CONTINUATION_PROPOSAL_DIGEST_PROFILE } from '../src/logos-engine/v6-acquired-continuation.ts';

type R = Record<string, any>;
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const policy = JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8'));
const strategy = JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')).declarations[0].configuration;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const copy = <T>(value: T): T => structuredClone(value);

// This is a synthetic contract test, not a game campaign. Anonymous providers
// receive one controlled public score boundary through the real acquisition
// path. The new priority is then exercised through the actual SRC and WHY/ACT.
function packet(step = 0): NativePublicObservation {
  const rows = Array.from({ length: 8 }, () => Array<number>(8).fill(step ? 2 : 1));
  return { frame_rows: rows, frame_packet: [rows], level: step ? 2 : 1, levels_completed: step ? 1 : 0,
    state: 'NOT_FINISHED', step_index: step, available_action_refs: ['ACTION1', 'ACTION2', 'ACTION3'],
    frame_hash: symbolicDigest(rows).slice(0, 16) };
}

interface Behavior {
  cold?: boolean;
  seed?: boolean;
  guard?: (proposal: R, observation: NativeObservation, call: number) => boolean;
  changeProposal?: (proposal: R, observation: NativeObservation) => R | null;
  changeUnacquired?: (witness: R, proposal: R, observation: NativeObservation) => R | null;
  changeRetained?: (witness: R | null, observation: NativeObservation) => R | null;
  changeAcquired?: (witness: R | null, proposal: R, observation: NativeObservation) => R | null;
}

function provider(id: string, command: string, role: 'exploration' | 'continuation' | 'ordinary', behavior: Behavior = {}) {
  let retained: R = { events: [], passed: [] };
  const calls = { offers: [] as R[], guards: 0, bindings: 0, retained: 0, acquired: 0, unacquired: 0 };
  function success(observation: NativeObservation): R | null {
    const passed = retained.passed.at(-1);
    if (!passed || passed.score !== observation.levels_completed) return null;
    return { status: 'conditional_acquired_continuation', observation_ref: observation.observation_ref,
      score: passed.score, success_ref: passed.ref, evidence_refs: [passed.ref],
      effect_known: false, qualification: 'Controlled provider attestation; the current effect remains unknown.' };
  }
  function propose(observation: NativeObservation): NativeProposal | null {
    if (!observation.levels_completed && !behavior.seed && !behavior.cold) return null;
    const action = { action_ref: command, data: {} }, ref = `C_controlled_${id}_${observation.revision}`;
    const why = 'Ask one controlled current question; reconcile its actual returned observation.';
    let proposal: R | null = {
      status: 'proposed', kind: 'controlled_current_inquiry', proposal_id: ref,
      provider_id: id, actions: [action],
      steps: [{ action, mode: 'calibrate', expected_after: null,
        expected_before: { level_epoch: observation.level_epoch, frame_hash: observation.frame_hash } }],
      facts: { current_observation_available: true },
      compositions: [{ id: ref, role: 'information_question', observed: false, open_question: why,
        properties: { scope: 'synthetic provider contract' }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: [observation.observation_ref] }, route_refs: [observation.observation_ref],
      binding: { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch,
        levels_completed: observation.levels_completed },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion',
        preserve_refs: [], purpose: why, preconditions: { current_observation_available: true },
        evidence: [observation.observation_ref], actions: [action], outcome_guard: { path: ['value'], contains: ref } },
    };
    if (observation.levels_completed && behavior.changeProposal) proposal = behavior.changeProposal(proposal, observation);
    calls.offers.push({ observation_ref: observation.observation_ref, score: observation.levels_completed,
      proposal: copy(proposal) });
    return proposal as NativeProposal | null;
  }
  const family: NativeFamily = {
    id, propose,
    bind: () => { calls.bindings++; },
    before: (proposal, _index, publicPacket, observation) => {
      calls.guards++;
      const p = proposal as R, binding = p.binding;
      const current = binding?.observation_ref === observation.observation_ref
        && binding.level_epoch === publicPacket.level && binding.levels_completed === publicPacket.levels_completed
        && publicPacket.available_action_refs.includes(p.actions[0]?.action_ref);
      return { admitted: Boolean(current && (!behavior.guard || behavior.guard(p, observation, calls.guards))),
        reason: 'controlled_current_context' };
    },
    after: () => ({ matched: null, seal_prefix: true, reason: 'controlled_public_boundary' }),
    record: (before, after) => {
      const event = { before: before.observation_ref, after: after.observation_ref, score: after.levels_completed };
      retained.events.push(event);
      if (after.levels_completed > before.levels_completed) retained.passed.push({ score: after.levels_completed, ref: after.observation_ref });
      return { events: [event] };
    },
    state: () => copy(retained), restore: value => { retained = copy(value); },
  };
  if (role === 'exploration') family.unacquiredInquiryWitness = (proposal, observation) => {
    calls.unacquired++;
    if (retained.events.length) return null;
    const witness = { status: 'unacquired_exploration', observation_ref: observation.observation_ref,
      evidence_refs: [], qualification: 'No acquired event in this controlled provider.' };
    return behavior.changeUnacquired ? behavior.changeUnacquired(witness, proposal, observation) : witness;
  };
  if (role === 'continuation') {
    family.retainedSuccessWitness = observation => {
      calls.retained++;
      const witness = success(observation);
      return behavior.changeRetained ? behavior.changeRetained(witness, observation) : witness;
    };
    family.acquiredContinuationWitness = (proposal, observation) => {
      calls.acquired++;
      const witness = (proposal as R).provider_id === id ? success(observation) : null;
      return behavior.changeAcquired ? behavior.changeAcquired(witness, proposal, observation) : witness;
    };
  }
  return { family, behavior, calls, clearCalls() {
    calls.offers.length = 0; calls.guards = 0; calls.bindings = 0;
    calls.retained = 0; calls.acquired = 0; calls.unacquired = 0;
  } };
}

function rig(options: { cold?: boolean; caller?: boolean; now?: () => number; groups?: NativeSelectionGroup[]; sameEntry?: boolean } = {}) {
  const explorer = provider('anonymous_explorer', 'ACTION1', 'exploration', { cold: options.cold });
  const unsupported = provider('anonymous_unsupported', 'ACTION2', 'ordinary');
  const continuation = provider('anonymous_continuation', 'ACTION3', 'continuation', { seed: !options.cold });
  const families = [explorer.family, unsupported.family, continuation.family];
  if (options.sameEntry) for (const owner of [unsupported, continuation]) {
    owner.family.proposeInSubquestion = (_group, _entry, ...args) => owner.family.propose(...args);
  }
  const groups: NativeSelectionGroup[] = options.groups ?? (options.sameEntry ? [
    { id: 'prior_empty_group', families: [] },
    { id: 'exploration_group', families: [explorer.family.id] },
    { id: 'shared_entry_group', families: [unsupported.family.id, continuation.family.id], entryPoints: ['same_entry', 'same_entry'] },
  ] : [
    { id: 'prior_empty_group', families: [] },
    { id: 'exploration_group', families: [explorer.family.id] },
    { id: 'earlier_unsupported_group', families: [unsupported.family.id] },
    { id: 'continuation_group', families: [continuation.family.id] },
  ]);
  const runtime = new NativeV6Runtime({ sourceDigest: 'controlled-acquired-continuation-coordination',
    families, groups, maxPointOccurrences: 32, now: options.now ?? (() => 0),
    ...(options.caller === false ? {} : { callerStrategy: strategy, authorityPolicy: policy }) });
  const initialize = () => runtime.initialize({ sessionId: 'anonymous-coordination-contract', observation: packet(),
    budgets: { targetLevels: 3, levelActionCaps: [30, 30, 30], maxActions: 90 } }, execution);
  return { runtime, explorer, unsupported, continuation, initialize };
}

async function acquired(options: Parameters<typeof rig>[0] = {}) {
  const setup = rig(options);
  const first = await setup.initialize();
  assert.equal(first.kind, 'action', first.reason ?? 'The controlled seed must be authorized');
  assert.equal(first.snapshot.lastDecision, setup.continuation.family.id);
  const boundary = await setup.runtime.advance({ command: first.command!, observation: packet(1), executionMs: 0 }, execution);
  assert.equal(boundary.kind, 'boundary', boundary.reason);
  assert.equal(boundary.snapshot.actions, 1);
  assert.equal((setup.continuation.family.state() as R).passed.length, 1);
  setup.explorer.clearCalls(); setup.unsupported.clearCalls(); setup.continuation.clearCalls();
  return { ...setup, boundary };
}

function readState(runtime: NativeV6Runtime, id: string): R {
  const graph = runtime.inspectKnowledge();
  return hydrateNativeState(graph.nodes[id]!.value, ref => graph.nodes[ref]!.value) as R;
}
function assertSourceChoice(result: R, setup: ReturnType<typeof rig>): void {
  assert.equal(result.kind, 'action', result.reason);
  assert.equal(result.snapshot.lastDecision, setup.explorer.family.id);
  assert.equal(result.command.action_ref, 'ACTION1');
  assert.equal(result.snapshot.proposal.strategy_receipt.selected, 'exploration_group');
  assert.equal(result.snapshot.proposal.strategy_receipt.native_coordination, undefined);
  assert.equal(result.snapshot.actions, 1);
  assert.equal(setup.explorer.family.state().events.length, 0);
}

test('the exact acquired candidate replaces an earlier unacquired offer, retaining the real source cursor separately', async () => {
  const setup = await acquired(), { runtime, explorer, unsupported, continuation } = setup;
  const previous = continuation.family.state(), graph = runtime.inspectKnowledge();
  const result = await runtime.resume(execution), proposal = result.snapshot.proposal as R;
  assert.equal(result.kind, 'action', result.reason);
  assert.equal(result.snapshot.lastDecision, continuation.family.id);
  assert.equal(result.command!.action_ref, 'ACTION3');
  assert.deepEqual(unsupported.calls.offers, [], 'An unsupported intermediate offer cannot borrow the later proof');
  assert.equal(continuation.calls.offers.length, 1, 'The exact candidate is measured once');
  assert.equal(continuation.calls.guards, 2, 'Priority guard and ordinary authorization guard both run');
  assert.equal(continuation.calls.bindings, 1);
  assert.deepEqual(proposal.strategy_receipt.visited, ['prior_empty_group', 'exploration_group']);
  assert.equal(proposal.strategy_receipt.selected, 'continuation_group');
  const [receipt] = proposal.strategy_receipt.native_coordination;
  assert.equal(receipt.rule, 'current_acquired_continuation_before_unacquired_exploration');
  assert.equal(receipt.source_trigger_group, 'exploration_group');
  assert.equal(receipt.source_trigger_index, 1);
  assert.equal(receipt.source_trigger_entry, null);
  assert.equal(receipt.selected_group, 'continuation_group');
  assert.equal(receipt.selected_group_index, 3);
  assert.equal(receipt.selected_entry, null);
  assert.equal(receipt.deferred_family, explorer.family.id);
  assert.equal(receipt.preferred_family, continuation.family.id);
  assert.equal(receipt.preferred_proposal_ref, proposal.proposal_id);
  assert.equal(receipt.preferred_proposal_digest, continuationProposalDigest(continuation.calls.offers[0]!.proposal));
  assert.equal(receipt.preferred_proposal_digest_profile, CONTINUATION_PROPOSAL_DIGEST_PROFILE);
  assert.equal(receipt.acquired_kernel_contribution.family, continuation.family.id);
  assert.equal(receipt.acquired_kernel_contribution.levels_completed_before, 0);
  assert.equal(receipt.acquired_kernel_contribution.levels_completed_after, 1);
  assert.equal(receipt.acquired_kernel_contribution.primitive_release_authorized, false);
  assert.equal(receipt.source_state_revision, graph.nodes[`family_state:${continuation.family.id}`]!.revision);
  assert.equal(receipt.deferred_state_revision, graph.nodes[`family_state:${explorer.family.id}`]!.revision);
  assert.equal(receipt.acquired_continuation.success_ref, (previous as R).passed[0].ref);
  assert.equal(receipt.physical_action_authorized, false, 'The coordination receipt is not an action ticket');
  assert.match(receipt.scope, /Explicit native selection extension/);
  assert.match(receipt.scope, /unknown|uncalibrated/);
  assert.ok(result.authorization);
  assert.equal((result.snapshot.whyAct as R).decision.decision.status, 'action_set_released');
  assert.equal(proposal.steps[0].expected_after, null);
  assert.equal(receipt.acquired_continuation.effect_known, false);
  assert.deepEqual(continuation.family.state(), previous, 'Offering an unknown effect acquires no simulated response');
  assert.deepEqual(readState(runtime, `family_state:${explorer.family.id}`).events, []);
  assert.equal(result.snapshot.actions, 1);
});

test('a cold caller without an acquired success keeps the ordinary exploration', async () => {
  const setup = rig({ cold: true }), result = await setup.initialize();
  assert.equal(result.kind, 'action', result.reason);
  assert.equal(result.snapshot.lastDecision, setup.explorer.family.id);
  assert.equal((result.snapshot.proposal as R).strategy_receipt.native_coordination, undefined);
  assert.deepEqual(setup.continuation.calls.offers, [], 'No costly continuation is proposed without its retained preflight proof');
  assert.equal(result.snapshot.actions, 0);
});

test('two owners with the same entry name cannot share or substitute their cached proposals', async () => {
  const setup = await acquired({ sameEntry: true });
  // A copied preflight reference cannot borrow another owner's acquired
  // official contribution, even when their declared entry names agree.
  setup.unsupported.family.retainedSuccessWitness = observation => setup.continuation.family.retainedSuccessWitness!(observation);
  setup.unsupported.family.acquiredContinuationWitness = () => null;
  const result = await setup.runtime.resume(execution), proposal = result.snapshot.proposal as R;
  assert.equal(result.kind, 'action', result.reason);
  assert.equal(result.snapshot.lastDecision, setup.continuation.family.id);
  assert.equal(result.command!.action_ref, 'ACTION3');
  assert.equal(setup.unsupported.calls.offers.length, 0);
  assert.equal(setup.continuation.calls.offers.length, 1);
  assert.equal(proposal.provider_id, setup.continuation.family.id);
  const [receipt] = proposal.strategy_receipt.native_coordination;
  assert.equal(receipt.selected_group, 'shared_entry_group');
  assert.equal(receipt.selected_entry, 'same_entry');
  assert.equal(receipt.preferred_proposal_digest, continuationProposalDigest(setup.continuation.calls.offers[0]!.proposal));
  assert.equal(setup.unsupported.calls.bindings, 0);
  assert.equal(setup.unsupported.calls.guards, 0);
  assert.equal(result.snapshot.actions, 1);
});

test('a runtime without the native common caller keeps source order even when hooks exist', async () => {
  const setup = await acquired({ caller: false });
  const result = await setup.runtime.resume(execution);
  assert.equal(result.kind, 'action');
  assert.equal(result.snapshot.lastDecision, setup.explorer.family.id);
  assert.deepEqual(setup.continuation.calls.offers, []);
});

const unacquiredChanges: [string, NonNullable<Behavior['changeUnacquired']>][] = [
  ['missing attestation', () => null],
  ['wrong status', witness => ({ ...witness, status: 'observed_exploration' })],
  ['old observation', witness => ({ ...witness, observation_ref: 'previous-observation' })],
  ['any acquired event evidence', witness => ({ ...witness, evidence_refs: ['already-acquired'] })],
  ['missing evidence array', witness => { const result = { ...witness }; delete result.evidence_refs; return result; }],
];
for (const [name, change] of unacquiredChanges) test(`source exploration retains priority with ${name}`, async () => {
  const setup = await acquired(); setup.explorer.behavior.changeUnacquired = change;
  assertSourceChoice(await setup.runtime.resume(execution), setup);
  assert.deepEqual(setup.continuation.calls.offers, []);
  assert.equal(setup.continuation.calls.retained, 0);
});

const retainedChanges: [string, NonNullable<Behavior['changeRetained']>][] = [
  ['missing success', () => null],
  ['unqualified status', witness => ({ ...witness!, status: 'hypothetical_success' })],
  ['old observation', witness => ({ ...witness!, observation_ref: 'previous-observation' })],
  ['old score', witness => ({ ...witness!, score: 0 })],
  ['missing success reference', witness => ({ ...witness!, success_ref: '' })],
  ['success without evidence', witness => ({ ...witness!, evidence_refs: [] })],
  ['unrelated evidence', witness => ({ ...witness!, evidence_refs: ['different-boundary'] })],
  ['invented but internally consistent success reference', witness => ({ ...witness!, success_ref: 'unacquired-success', evidence_refs: ['unacquired-success'] })],
];
for (const [name, change] of retainedChanges) test(`retained continuation preflight refuses ${name}`, async () => {
  const setup = await acquired(); setup.continuation.behavior.changeRetained = change;
  assertSourceChoice(await setup.runtime.resume(execution), setup);
  assert.deepEqual(setup.continuation.calls.offers, [], 'A rejected retained proof triggers no candidate search');
  assert.equal(setup.continuation.calls.acquired, 0);
});

const currentChanges: [string, NonNullable<Behavior['changeAcquired']>][] = [
  ['missing current attestation', () => null],
  ['wrong current status', witness => ({ ...witness!, status: 'known_effect' })],
  ['old current observation', witness => ({ ...witness!, observation_ref: 'previous-observation' })],
  ['old current score', witness => ({ ...witness!, score: 0 })],
  ['missing current evidence', witness => ({ ...witness!, evidence_refs: [] })],
  ['different success from preflight', witness => ({ ...witness!, success_ref: 'different-boundary', evidence_refs: ['different-boundary'] })],
];
for (const [name, change] of currentChanges) test(`fresh continuation validation refuses ${name}`, async () => {
  const setup = await acquired(); setup.continuation.behavior.changeAcquired = change;
  assertSourceChoice(await setup.runtime.resume(execution), setup);
  assert.equal(setup.continuation.calls.offers.length, 1);
  assert.equal(setup.continuation.calls.guards, 0);
});

for (const hook of ['unacquiredInquiryWitness', 'retainedSuccessWitness', 'acquiredContinuationWitness'] as const) {
  test(`coordination is opt-in and refuses an absent ${hook}`, async () => {
    const setup = await acquired();
    delete (hook === 'unacquiredInquiryWitness' ? setup.explorer.family : setup.continuation.family)[hook];
    assertSourceChoice(await setup.runtime.resume(execution), setup);
    assert.deepEqual(setup.continuation.calls.offers, []);
  });
}

const proposalChanges: [string, NonNullable<Behavior['changeProposal']>][] = [
  ['no candidate', () => null],
  ['source refusal', proposal => ({ ...proposal, status: 'unknown', actions: [] })],
  ['empty physical prefix', proposal => ({ ...proposal, actions: [], steps: [] })],
  ['another kind on the same owner', proposal => ({ ...proposal, kind: 'unacquired_different_kind' })],
  ['old epoch binding', proposal => ({ ...proposal, binding: { ...proposal.binding, level_epoch: 1 } })],
  ['old observation binding', proposal => ({ ...proposal, binding: { ...proposal.binding, observation_ref: 'previous-observation' } })],
  ['old score binding', proposal => ({ ...proposal, binding: { ...proposal.binding, levels_completed: 0 } })],
  ['unavailable input', proposal => ({ ...proposal, actions: [{ action_ref: 'ACTION5', data: {} }] })],
];
for (const [name, change] of proposalChanges) test(`the current proposal and guard reject ${name}`, async () => {
  const setup = await acquired(); setup.continuation.behavior.changeProposal = change;
  assertSourceChoice(await setup.runtime.resume(execution), setup);
  assert.equal(setup.continuation.calls.bindings, 0);
});

test('an epoch change without a public score increase cannot corroborate a forged success preflight', async () => {
  const setup = rig(), first = await setup.initialize();
  assert.equal(first.snapshot.lastDecision, setup.continuation.family.id);
  const boundary = await setup.runtime.advance({ command: first.command!, executionMs: 0,
    observation: { ...packet(1), levels_completed: 0 } }, execution);
  assert.equal(boundary.kind, 'boundary');
  setup.explorer.behavior.cold = true;
  setup.continuation.behavior.changeRetained = (_witness, observation) => ({ status: 'conditional_acquired_continuation',
    observation_ref: observation.observation_ref, score: observation.levels_completed,
    success_ref: observation.observation_ref, evidence_refs: [observation.observation_ref] });
  setup.continuation.clearCalls();
  const result = await setup.runtime.resume(execution);
  assertSourceChoice(result, setup);
  assert.deepEqual(setup.continuation.calls.offers, [], 'The actual acquired boundary has no score increase');
});

test('a real public score increase is sufficient even when the level epoch does not change', async () => {
  const setup = rig(), first = await setup.initialize();
  const boundary = await setup.runtime.advance({ command: first.command!, executionMs: 0,
    observation: { ...packet(1), level: 1 } }, execution);
  assert.equal(boundary.kind, 'boundary');
  const result = await setup.runtime.resume(execution);
  assert.equal(result.snapshot.lastDecision, setup.continuation.family.id);
  const receipt = (result.snapshot.proposal as R).strategy_receipt.native_coordination[0].acquired_kernel_contribution;
  assert.equal(receipt.levels_completed_before, 0);
  assert.equal(receipt.levels_completed_after, 1);
});

test('a single provider without explicit group entries retains its proposal subquestion identity', async () => {
  const setup = rig(), original = setup.continuation.family.propose;
  setup.continuation.family.propose = async (...args) => {
    const proposal = await original(...args);
    return proposal ? { ...proposal, material_access_subquestion: 'anonymous_material_question' } : null;
  };
  const first = await setup.initialize();
  await setup.runtime.advance({ command: first.command!, executionMs: 0, observation: packet(1) }, execution);
  const result = await setup.runtime.resume(execution), proposal = result.snapshot.proposal as R;
  assert.equal(result.kind, 'action', result.reason);
  assert.equal(result.snapshot.lastDecision, setup.continuation.family.id);
  assert.equal(proposal.material_access_subquestion, 'anonymous_material_question');
  assert.equal(proposal.strategy_receipt.native_coordination[0].acquired_kernel_contribution.entry, 'anonymous_material_question');
});

test('a shared owner cannot lend a successful entry to another entry before proposing it', async () => {
  const setup = rig({ sameEntry: true, groups: [
    { id: 'exploration_group', families: ['anonymous_explorer'] },
    { id: 'shared_group', families: ['anonymous_continuation', 'anonymous_continuation'],
      entryPoints: ['acquired_entry', 'unacquired_entry'] },
  ] });
  const entries: string[] = [];
  setup.continuation.family.proposeInSubquestion = async (_group, entry, ...args) => {
    entries.push(entry);
    if (args[0].levels_completed && entry === 'acquired_entry') return null;
    const proposal = await setup.continuation.family.propose(...args);
    return proposal ? { ...proposal, field_subquestion: entry } : null;
  };
  const first = await setup.initialize();
  assert.equal((first.snapshot.proposal as R).field_subquestion, 'acquired_entry');
  await setup.runtime.advance({ command: first.command!, executionMs: 0, observation: packet(1) }, execution);
  entries.length = 0;
  const result = await setup.runtime.resume(execution);
  assertSourceChoice(result, setup);
  assert.deepEqual(entries, ['acquired_entry'], 'The sibling entry has no acquired contribution of its own');
});

test('proposal provenance preserves Float64 values and distinguishes negative zero through the native codec', async () => {
  const setup = await acquired();
  setup.continuation.behavior.changeProposal = proposal => ({ ...proposal, measured_numeric_context: { angle: Math.PI / 6, offset: -0 } });
  const result = await setup.runtime.resume(execution), proposal = result.snapshot.proposal as R;
  assert.equal(result.kind, 'action', result.reason);
  const receipt = proposal.strategy_receipt.native_coordination[0], actual = setup.continuation.calls.offers[0]!.proposal;
  assert.equal(receipt.preferred_proposal_digest, continuationProposalDigest(actual));
  assert.equal(receipt.preferred_proposal_digest_profile, CONTINUATION_PROPOSAL_DIGEST_PROFILE);
  assert.notEqual(continuationProposalDigest(actual), continuationProposalDigest({ ...actual,
    measured_numeric_context: { ...actual.measured_numeric_context, offset: 0 } }));
  assert.throws(() => symbolicDigest(actual), /integer|number/i, 'The V7 canonical scalar domain remains unchanged');
});

test('a current guard veto leaves the exploration available and acquires nothing', async () => {
  const setup = await acquired(), retained = setup.continuation.family.state();
  setup.continuation.behavior.guard = () => false;
  assertSourceChoice(await setup.runtime.resume(execution), setup);
  assert.equal(setup.continuation.calls.guards, 1);
  assert.deepEqual(setup.continuation.family.state(), retained);
});

test('a later normal before-action guard still vetoes an already preferred candidate', async () => {
  const setup = await acquired(); setup.continuation.behavior.guard = (_proposal, _observation, call) => call === 1;
  const result = await setup.runtime.resume(execution);
  assert.equal(result.kind, 'stopped'); assert.equal(result.command, null); assert.equal(result.authorization, null);
  assert.equal(setup.continuation.calls.guards, 2);
  assert.equal(result.snapshot.actions, 1);
  assert.equal((result.snapshot.proposal as R).strategy_receipt.native_coordination[0].physical_action_authorized, false);
});

test('a disabled acquired provider is never proposed for arbitration', async () => {
  const setup = await acquired();
  await setup.runtime.edit({ expectedGraphChain: setup.boundary.snapshot.graphChain!, reason: 'Controlled provider activation refusal',
    changes: [{ type: 'set_family_enabled', familyId: setup.continuation.family.id, enabled: false }] }, execution);
  assertSourceChoice(await setup.runtime.resume(execution), setup);
  assert.equal(setup.continuation.calls.retained, 0);
  assert.deepEqual(setup.continuation.calls.offers, []);
});

test('an already selected hard refusal is not weakened by acquired-continuation arbitration', async () => {
  const setup = await acquired();
  setup.explorer.behavior.changeProposal = proposal => ({ ...proposal, status: 'unknown', actions: [], block_unrelated_probe: true });
  const result = await setup.runtime.resume(execution);
  assert.equal(result.kind, 'stopped'); assert.equal(result.reason, 'frontier_unknown');
  assert.equal(result.command, null); assert.equal(result.snapshot.actions, 1);
  assert.equal(setup.explorer.calls.unacquired, 0);
  assert.deepEqual(setup.continuation.calls.offers, []);
});

test('WHY/ACT can refuse the preferred candidate through its real edited SRC node', async () => {
  const setup = await acquired(), workflow = 'prototype.laya_router.route';
  const module = copy(nativeProgramDescriptions().find(program => program.id === workflow)!.module);
  let replacements = 0;
  function change(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(change); return; }
    const record = value as R;
    if (record.kind === 'call' && record.value === 'prototype.unique') { record.value = 'prototype.abstain'; replacements++; }
    Object.values(record).forEach(change);
  }
  change(module); assert.equal(replacements, 1);
  await setup.runtime.edit({ expectedGraphChain: setup.boundary.snapshot.graphChain!, reason: 'Controlled actual WHY/ACT refusal',
    changes: [{ type: 'replace_program', programId: workflow, module }] }, execution);
  const result = await setup.runtime.resume(execution);
  assert.equal(result.kind, 'stopped'); assert.equal(result.command, null); assert.equal(result.authorization, null);
  assert.equal((result.snapshot.proposal as R).strategy_receipt.selected, 'continuation_group');
  assert.equal((result.snapshot.whyAct as R).decision.decision.status, 'abstained');
  assert.equal(result.snapshot.actions, 1);
});

test('a caller preservation veto remains effective after native priority', async context => {
  const setup = await acquired();
  const caller = (setup.runtime as unknown as { caller: { preservation: (...args: unknown[]) => R } }).caller;
  // The priority test isolates the ordinary authorization gate. Independent
  // preservation tests cover measurement; this controlled veto supplies no law.
  context.mock.method(caller, 'preservation', () => ({ admitted: false, reason: 'controlled_acquired_condition_changed' }));
  const result = await setup.runtime.resume(execution);
  assert.equal(result.kind, 'stopped'); assert.equal(result.command, null); assert.equal(result.authorization, null);
  assert.equal(result.snapshot.actions, 1);
  assert.ok(result.snapshot.trace.some((entry: R) => entry.kind === 'before_guard'
    && entry.admitted === false && entry.reason === 'controlled_acquired_condition_changed'));
});

test('a measured preservation obligation rejects a preferred revision input on both selection attempts', async () => {
  const setup = await acquired(), success = (setup.continuation.family.state() as R).passed[0];
  setup.explorer.family.preservationObligations = () => [{ id: 'C_controlled_preserved_pixel',
    pixels: [[0, 0, 2]], evidence: [success.ref], revision_inputs: ['ACTION3'],
    meaning: 'The synthetic public return currently contains this observed pixel.' }];
  const result = await setup.runtime.resume(execution);
  assert.equal(result.kind, 'stopped');
  assert.equal(result.reason, 'frontier_preservation_conflict');
  assert.equal(result.command, null); assert.equal(result.authorization, null);
  assert.equal(result.snapshot.actions, 1);
  assert.equal(setup.continuation.calls.offers.length, 2, 'The ordinary caller retries with revision inputs removed');
  assert.equal(setup.continuation.calls.bindings, 0, 'A provider repeating a forbidden input cannot bypass preservation');
});

test('exhausting the active budget during continuation search releases no action', async () => {
  let clock = 0;
  const setup = await acquired({ now: () => clock });
  setup.continuation.behavior.changeProposal = proposal => { clock += 360_001; return proposal; };
  const result = await setup.runtime.resume(execution);
  assert.equal(result.kind, 'stopped'); assert.equal(result.reason, 'level_active_time_budget');
  assert.equal(result.command, null); assert.equal(result.authorization, null);
  assert.equal(result.snapshot.actions, 1);
});

test('cancellation during lookahead cannot release or acquire a candidate', async () => {
  const setup = await acquired(), controller = new AbortController();
  let yields = 0;
  await assert.rejects(setup.runtime.resume({ signal: controller.signal, yieldControl: async () => {
    if (++yields === 3) controller.abort();
  } }), /cancelled|Native reasoning cancelled/);
  assert.equal(setup.runtime.snapshot().actions, 1);
  assert.equal(setup.continuation.family.state().events.length, 1);
  assert.deepEqual(setup.continuation.calls.offers, []);
});
