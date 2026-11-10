import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { readEvidenceSync } from './helpers/chunked-evidence.ts';
import { createNativeV6Runtime, NativeV6Runtime, relativeArrangementFamily } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import { hydrateNativeState, isNativeStateGraph } from '../src/logos-engine/v6-native-state-graph.ts';
import { decodeNativeState } from '../src/logos-engine/v6-knowledge-store.ts';
import { relativeArrangementTrialKey } from '../src/logos-engine/v6-relative-arrangements-planner.ts';
import type { NativeCommand, NativeFamily, NativeObservation, NativeProposal, NativeRuntimeYield } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const fixture = JSON.parse(gunzipSync(readEvidenceSync(new URL('./fixtures/v6-relative-arrangements-reference.json.gz', import.meta.url))).toString());
const declarations: NativeV6Declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
};
const execution = { yieldControl: async () => {} };
const copy = <T>(value: T): T => structuredClone(value);
const BUDGETS = { targetLevels: 3, levelActionCaps: [80, 80, 80] };
const OWNER = 'relative_arrangements';
const session = (id: string): R => {
  const row = fixture.sessions.find((candidate: R) => candidate.id === id);
  assert.ok(row, `original public session ${id}`); return row;
};
const initial = (id: string): R => {
  const row = fixture.initial.find((candidate: R) => candidate.id === id);
  assert.ok(row, `original initial interface ${id}`); return row;
};
const commandValue = (command: NativeCommand | R) => ({ action_ref: command.action_ref, data: command.data ?? {} });
function stateValue(value: R): R {
  const result = copy(value);
  result.failed.sort((a: any, b: any) => {
    const x = relativeArrangementTrialKey(a), y = relativeArrangementTrialKey(b); return x < y ? -1 : x > y ? 1 : 0;
  });
  return result;
}
function graphValue(runtime: NativeV6Runtime, id: string): R {
  const graph = runtime.inspectKnowledge(), raw = graph.nodes[id]!.value;
  return (isNativeStateGraph(raw) ? hydrateNativeState(raw, key => graph.nodes[key]!.value) : decodeNativeState(raw)) as R;
}
function facts(runtime: NativeV6Runtime): R[] {
  return graphValue(runtime, 'reasoning:memory').facts.map((id: string) => graphValue(runtime, id));
}
function retainedState(runtime: NativeV6Runtime): R {
  const retained = facts(runtime).find(fact => fact.key === 'relative_arrangement_state');
  assert.ok(retained, 'Common acquisition retains the exact arrangement owner state'); return retained.value;
}
// Rebind only references witnessed by the native observation/authorization and
// actual outcome. The source oracle starts its observation numbering at zero.
function rebind(value: any, references: Map<string, string>): any {
  if (typeof value === 'string') {
    if (value.startsWith(`${fixture.provenance.observationScope}:`)) {
      assert.ok(references.has(value), `unwitnessed source observation ${value}`); return references.get(value);
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(item => rebind(item, references));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rebind(item, references)]));
  return value;
}
function watchOwner(runtime: NativeV6Runtime) {
  const inner = runtime as unknown as R, owners = inner.families.filter((family: NativeFamily) => family.id === OWNER);
  assert.equal(owners.length, 1, 'The arrangement entry has one acquired owner');
  const owner = owners[0] as NativeFamily, calls: R[] = [], restorations: R[] = [];
  assert.equal(Object.values(inner.acquisitionFamilies).includes(owner), false, 'Arrangement has no passive-acquisition registration');
  const record = owner.record.bind(owner), restore = owner.restore.bind(owner);
  owner.record = async (...args) => {
    const result = await record(...args);
    calls.push({ argc: args.length, before: args[0].observation_ref, after: args[1].observation_ref,
      selected: args[5] !== undefined, index: args[6], result: copy(result) });
    return result;
  };
  owner.restore = state => { restorations.push(copy(state)); restore(state); };
  return { owner, calls, restorations };
}
interface Journal {
  runtime: NativeV6Runtime; owner: NativeFamily; calls: R[]; restorations: R[];
  references: Map<string, string>; result: NativeRuntimeYield;
}
function isolatedArrangementPolicy(): NativeV6Declarations {
  // An explicit source-configuration variant isolates this entry for lifecycle
  // coverage. Providers, proposals, memory, acquisition and WHY/ACT stay real;
  // this test does not claim unchanged full-router or game-selection parity.
  const policy = copy(declarations);
  policy.strategy.declarations[0]!.configuration.families = ['window_constraints'];
  policy.strategy.declarations[0]!.configuration.window_constraints.ordered_subquestions = ['relative_arrangement'];
  return policy;
}
async function start(id: string): Promise<Journal> {
  const runtime = await createNativeV6Runtime(isolatedArrangementPolicy(), { now: () => 0 });
  const watched = watchOwner(runtime);
  try {
    const result = await runtime.initialize({ sessionId: `relative-arrangement-integration-${id}`,
      observation: copy(session(id).steps[0].beforePublic), budgets: BUDGETS }, execution);
    return { runtime, ...watched, references: new Map(), result };
  } catch (error) { runtime.close('arrangement_initialization_failed'); throw error; }
}
function assertReleased(result: NativeRuntimeYield, family = OWNER): void {
  const snapshot = result.snapshot as R;
  assert.equal(result.kind, 'action', String(result.reason)); assert.equal(snapshot.lastDecision, family);
  assert.equal(snapshot.caller.enabled, true); assert.equal(snapshot.whyAct.enabled, true);
  assert.equal(snapshot.whyAct.decision.decision.status, 'action_set_released');
  assert.equal(snapshot.whyAct.decision.decision.model_calls.length, 0);
  assert.equal(snapshot.srcDecision.workflow, 'v6.composition_strategy.choose');
  const guard = snapshot.trace.findLast((row: R) => row.kind === 'before_guard');
  assert.equal(guard.admitted, true);
  if (result.command!.action_ref === 'ACTION6') assert.equal(guard.point_bound, true);
}
async function decide(journal: Journal, row: R): Promise<R | null> {
  if (journal.result.kind === 'boundary') journal.result = await journal.runtime.resume(execution);
  const current = (journal.runtime as unknown as R).observation as NativeObservation;
  journal.references.set(row.beforeObservation.observation_ref, current.observation_ref);
  assert.deepEqual(stateValue(journal.owner.state()), stateValue(rebind(row.stateAfterPropose, journal.references)), 'Source proposal epoch transition');
  if (!row.proposal) {
    assert.notEqual(journal.result.kind, 'action', 'A recognized source abstention does not become a symmetric point repair');
    return null;
  }
  assertReleased(journal.result);
  const proposal = (journal.result.snapshot as R).proposal;
  assert.equal(proposal.field_subquestion, 'relative_arrangement');
  assert.equal(proposal.strategy_receipt.selected, 'window_constraints');
  assert.deepEqual(proposal.strategy_receipt.visited, ['window_constraints']);
  assert.deepEqual(commandValue(journal.result.command!), commandValue(row.proposal.actions[0]));
  assert.equal(journal.result.authorization!.observation_ref, current.observation_ref);
  assert.deepEqual(proposal.arrangement_plan, rebind(row.proposal.arrangement_plan, journal.references), 'Complete source plan, including workflow and numerical ranks');
  assert.equal(proposal.actions.length, 1); assert.equal(proposal.steps.length, 1);
  return proposal;
}
async function acquire(journal: Journal, row: R): Promise<void> {
  const proposal = await decide(journal, row);
  assert.ok(proposal); assert.ok(row.command);
  assert.deepEqual(commandValue(journal.result.command!), commandValue(row.command), 'Check the computed command before providing its public return');
  const oldCount = journal.calls.length;
  journal.result = await journal.runtime.advance({ command: journal.result.command!, observation: copy(row.afterPublic), executionMs: 0 }, execution);
  assert.equal(journal.result.kind, 'boundary', String(journal.result.reason));
  const snapshot = journal.result.snapshot as R, outcome = snapshot.trace.findLast((entry: R) => entry.kind === 'actual_outcome');
  assert.ok(outcome); journal.references.set(row.afterObservation.observation_ref, outcome.observation_ref);
  const expected = rebind(row.stateAfter, journal.references);
  assert.equal(journal.calls.length, oldCount + 1, 'Each selected primitive is acquired once at its sealed boundary');
  const call = journal.calls.at(-1)!;
  assert.equal(call.selected, true); assert.equal(call.argc, 8); assert.equal(call.index, 0);
  assert.deepEqual(call.result, { events: [rebind(row.record, journal.references)] });
  assert.deepEqual(stateValue(journal.owner.state()), stateValue(expected));
  assert.deepEqual(stateValue(graphValue(journal.runtime, `family_state:${OWNER}`)), stateValue(expected));
  assert.deepEqual(stateValue(retainedState(journal.runtime)), stateValue(expected));
  assert.equal(snapshot.actions, journal.calls.length); assert.equal(snapshot.caller.acquiredTransitions, journal.calls.length);
}

test('production factory registers the source arrangement entry once, before window repair, with one persistent owner', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  try {
    const snapshot = runtime.snapshot() as R, groups = snapshot.coverage.sourceGroups;
    assert.deepEqual(groups.map((group: R) => group.id), declarations.strategy.declarations[0]!.configuration.families);
    const window = groups.find((group: R) => group.id === 'window_constraints');
    const index = window.entryPoints.indexOf('relative_arrangement');
    assert.ok(index > 0); assert.equal(window.families[index], OWNER);
    assert.deepEqual(window.families.slice(index, index + 3), [OWNER, 'window_constraints', 'public_occurrence_recall']);
    assert.equal(window.entryPoints[index + 2], 'recurrent_series');
    assert.equal(window.families.at(-1), 'regular_field_correspondence');
    assert.equal(snapshot.coverage.registeredFamilies.filter((id: string) => id === OWNER).length, 1);
    assert.equal(snapshot.coverage.fullV6Parity, false);
    const { owner } = watchOwner(runtime);
    assert.deepEqual(owner.state(), { models: [], events: [], failed: [], selection_ref: null, epoch: null });
  } finally { runtime.close('arrangement_factory_registration_complete'); }
});

for (const id of ['selected_displacement', 'failed_trial', 'official_boundary']) test(`common WHY/ACT acquires, persists and restores original arrangement responses: ${id}`, async () => {
  const journal = await start(id), rows = session(id).steps;
  try {
    let restoredAfterAcquisition = false;
    for (const row of rows) {
      if (!row.command) { await decide(journal, row); continue; }
      await acquire(journal, row);
      if (!restoredAfterAcquisition && journal.calls.length === 2) {
        const retained = copy(journal.owner.state());
        journal.owner.restore(copy(rows[0].stateBefore));
        assert.equal((journal.owner.state().events as unknown[]).length, 0);
        (journal.runtime as unknown as R).restoreFamilies();
        assert.deepEqual(stateValue(journal.owner.state()), stateValue(retained), 'Restore the acquired Kernel state after discarding the working copy');
        restoredAfterAcquisition = true;
      }
    }
    const acquired = rows.filter((row: R) => row.command);
    assert.equal(journal.calls.length, acquired.length);
    assert.equal(new Set(journal.calls.map(call => `${call.before}:${call.after}`)).size, acquired.length);
    assert.equal(facts(journal.runtime).filter(fact => /^relative_arrangement_event:\d+$/.test(fact.key)).length, acquired.length);
    assert.deepEqual(journal.calls.map(call => call.result.events[0].status), acquired.map((row: R) => row.record.status));
    assert.ok(journal.restorations.some(state => state.events.length > 0));
    const state = journal.owner.state() as R;
    assert.deepEqual(Object.keys(state).sort(), ['epoch', 'events', 'failed', 'models', 'selection_ref']);
    if (id === 'failed_trial') assert.ok(state.failed.length > 0);
    if (id === 'official_boundary') {
      assert.equal(state.epoch, 2); assert.deepEqual(state.models, []); assert.deepEqual(state.failed, []); assert.equal(state.selection_ref, null);
      assert.deepEqual(state.events.map((event: R) => event.status), ['selection_observed', 'official_boundary']);
      assert.equal((journal.result.snapshot.caller as R).boundaryReplays, 1);
    }
  } finally { journal.runtime.close(`arrangement_${id}_complete`); }
});

test('different public actuator returns acquire different models and justify different next commands after graph restoration', async () => {
  const branches: { prior: NativeCommand; next: NativeCommand; model: R; evidence: string[] }[] = [];
  for (const suffix of ['unit', 'opposite']) {
    const id = `discriminating-return-${suffix}`, journal = await start(id), rows = session(id).steps;
    try {
      await acquire(journal, rows[0]);
      const prior = copy(rows[1].command) as NativeCommand;
      await acquire(journal, rows[1]);
      const retained = copy(journal.owner.state()) as R;
      assert.equal(retained.models.length, 1);
      assert.equal('expected' in retained.models[0], false); assert.equal('risks' in retained.models[0], false);
      journal.owner.restore(copy(rows[0].stateBefore));
      (journal.runtime as unknown as R).restoreFamilies();
      assert.deepEqual(stateValue(journal.owner.state()), stateValue(retained));
      const next = await decide(journal, rows[2]); assert.ok(next);
      const evidence = next.arrangement_plan.offer.model_evidence as string[];
      assert.ok(evidence.length > 0);
      assert.ok(evidence.every(reference => [...journal.references.values()].includes(reference)));
      branches.push({ prior, next: copy(journal.result.command!), model: retained.models[0], evidence });
      assert.equal(journal.calls.length, 2, 'The alternative next experiment is not supplied an invented return');
    } finally { journal.runtime.close(`arrangement_discriminating_${suffix}_complete`); }
  }
  assert.deepEqual(branches[0]!.prior, branches[1]!.prior);
  assert.notDeepEqual(branches[0]!.model.delta, branches[1]!.model.delta);
  assert.notDeepEqual(branches[0]!.next, branches[1]!.next);
});

function nullProbe(id: string, calls: string[]): NativeFamily {
  return { id, propose: () => { calls.push(id); return null; },
    before: () => assert.fail('A null routing probe cannot release an action'),
    after: () => assert.fail('A null routing probe cannot receive a response'),
    record: () => assert.fail('A null routing probe cannot acquire a response'),
    state: () => ({}), restore: state => assert.deepEqual(state, {}) };
}
for (const id of ['already_arranged', 'action6-unavailable', 'unrecognized_no_model']) test(`source recognition barrier closes only the remaining window entries: ${id}`, async () => {
  // The arrangement provider and its compiled SRC are real. Null probes make
  // routing observable without attributing any synthetic action or effect.
  const calls: string[] = [], arrangement = relativeArrangementFamily();
  const later = nullProbe('later_window_contract', calls), symmetric = nullProbe('regular_field_correspondence', calls), outside = nullProbe('outside_window_contract', calls);
  const runtime = new NativeV6Runtime({ sourceDigest: `arrangement-source-stop-contract:${id}`, now: () => 0,
    families: [arrangement, later, symmetric, outside], maxPointOccurrences: declarations.common.input_domain.max_point_occurrences,
    authorityPolicy: declarations.common, callerStrategy: declarations.strategy.declarations[0]!.configuration,
    groups: [{ id: 'window_constraints', families: [arrangement.id, later.id, symmetric.id], entryPoints: ['relative_arrangement', null, null] },
      { id: 'view', families: [outside.id] }] });
  try {
    const row = initial(id); assert.equal(row.proposal, null);
    const result = await runtime.initialize({ sessionId: `arrangement-source-stop-${id}`, observation: copy(row.public), budgets: BUDGETS }, execution);
    assert.notEqual(result.kind, 'action'); assert.equal(result.snapshot.actions, 0);
    assert.equal((result.snapshot.caller as R).enabled, true); assert.equal((result.snapshot.whyAct as R).enabled, true);
    const stops = (result.snapshot.trace as R[]).filter(entry => entry.kind === 'source_group_stop');
    if (id === 'unrecognized_no_model') {
      assert.equal(row.layout, null); assert.deepEqual(calls, [later.id, symmetric.id, outside.id]); assert.deepEqual(stops, []);
    } else {
      assert.ok(row.layout); assert.deepEqual(calls, [outside.id]); assert.equal(stops.length, 1);
      assert.equal(stops[0].family, OWNER); assert.equal(stops[0].group, 'window_constraints');
      assert.equal(stops[0].entry, 'relative_arrangement'); assert.equal(stops[0].refusal.release_authority, false);
      const obs = (runtime as unknown as R).observation;
      assert.equal(stops[0].refusal.observation_ref, obs.observation_ref);
      assert.equal(stops[0].refusal.level_epoch, obs.level_epoch); assert.equal(stops[0].refusal.frame_hash, obs.frame_hash);
    }
  } finally { runtime.close(`arrangement_source_stop_${id}_complete`); }
});

function controlledQuestion(observation: NativeObservation, id: string, entry?: string): NativeProposal {
  const action = { action_ref: 'ACTION5', data: {} }, focus = `controlled-arrangement-stop:${id}:${observation.observation_ref}`;
  const facts = { controlled_current_public_question: true };
  return { status: 'proposed', kind: `controlled_${id}`, actions: [action], steps: [{ action, expected_after: null }], facts,
    ...(entry ? { field_subquestion: entry } : {}),
    binding: { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch,
      levels_completed: observation.levels_completed, frame_hash: observation.frame_hash },
    compositions: [{ id: focus, role: 'controlled_public_contract_question', observed: false,
      properties: { unknown: ['current_effect', 'terminal_role'] }, relations: ['contributes_to:G_official_completion'],
      open_question: 'Observe this controlled public input without claiming its effect' }],
    question: { reason: 'Synthetic routing contract; no effect is asserted' },
    bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion',
      purpose: 'Test one current public question', actions: [action], preconditions: facts,
      evidence: [observation.observation_ref], preserve_refs: [], preservation_evidence: {} } };
}
for (const id of ['already_arranged', 'unrecognized_no_model']) test(`native current-service look-ahead respects the earlier source arrangement barrier: ${id}`, async () => {
  // These two providers are deliberately controlled routing contracts. Only
  // RelativeArrangements measures a real source interface. No return, retained
  // success or geometric relation is fabricated for either synthetic provider.
  const calls: string[] = [], arrangement = relativeArrangementFamily();
  const deferred: NativeFamily = {
    id: 'controlled_independent_question', propose: observation => controlledQuestion(observation, 'independent_question'),
    unacquiredInquiryWitness: (_proposal, observation) => ({ status: 'unknown_effect_inquiry_with_measured_access',
      observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, effect_status: 'unobserved', contact_evidence: [] }),
    before: (proposal, _index, publicPacket, observation) => ({ admitted: proposal.binding!.observation_ref === observation.observation_ref
      && publicPacket.available_action_refs.includes('ACTION5'), reason: 'controlled_current_question_bound' }),
    after: () => assert.fail('No invented response to the controlled independent question'),
    record: () => assert.fail('No invented acquisition for the controlled independent question'),
    state: () => ({}), restore: state => assert.deepEqual(state, {}),
  };
  const later: NativeFamily = {
    id: 'controlled_later_service',
    propose: observation => { calls.push('candidate'); return controlledQuestion(observation, 'later_service', 'later_service_contract'); },
    proposeInSubquestion: (_group, _entry, observation) => later.propose(observation, [], [], 1),
    currentRequiredServiceWitness: () => { calls.push('witness'); return null; },
    before: () => assert.fail('No current service witness was supplied'),
    after: () => assert.fail('No controlled later service is executed'),
    record: () => assert.fail('No controlled later service is acquired'),
    state: () => ({}), restore: state => assert.deepEqual(state, {}),
  };
  const runtime = new NativeV6Runtime({ sourceDigest: `arrangement-current-service-barrier:${id}`, now: () => 0,
    families: [deferred, arrangement, later], maxPointOccurrences: declarations.common.input_domain.max_point_occurrences,
    authorityPolicy: declarations.common, callerStrategy: declarations.strategy.declarations[0]!.configuration,
    groups: [{ id: 'goal_access', families: [deferred.id] },
      { id: 'window_constraints', families: [arrangement.id, later.id], entryPoints: ['relative_arrangement', 'later_service_contract'] }] });
  try {
    const result = await runtime.initialize({ sessionId: `arrangement-current-service-${id}`, observation: copy(initial(id).public), budgets: BUDGETS }, execution);
    assertReleased(result, deferred.id); assert.deepEqual(commandValue(result.command!), { action_ref: 'ACTION5', data: {} });
    const stops = (result.snapshot.trace as R[]).filter(entry => entry.kind === 'source_group_stop');
    assert.equal(result.snapshot.actions, 0);
    if (id === 'already_arranged') {
      assert.deepEqual(calls, [], 'The look-ahead does not even propose a service beyond the earlier recognized source stop');
      assert.equal(stops.length, 1); assert.equal(stops[0].family, OWNER); assert.equal(stops[0].refusal.release_authority, false);
    } else {
      assert.deepEqual(calls, ['candidate', 'witness'], 'Without a recognized interface, the ordinary service admission path remains reachable');
      assert.deepEqual(stops, []);
    }
  } finally { runtime.close(`arrangement_current_service_${id}_complete`); }
});

for (const id of ['already_arranged', 'unrecognized_no_model']) test(`native acquired-continuation look-ahead respects the arrangement barrier after real Kernel acquisition: ${id}`, async () => {
  // Synthetic provider contract, following acquired-continuation-priority.test.
  // One controlled public score boundary is actually acquired through common
  // WHY/ACT. No retained success, prefix or transition is injected in the graph.
  // This establishes routing behavior, not physical causality or game parity.
  const entry = 'controlled_later_continuation';
  const calls = { proposals: 0, retained: 0, acquired: 0, guards: 0, records: 0 };
  let memory: R = { events: [], passed: [] };
  const success = (observation: NativeObservation): R | null => {
    const passed = memory.passed.at(-1);
    if (!passed || passed.score !== observation.levels_completed) return null;
    return { status: 'conditional_acquired_continuation', observation_ref: observation.observation_ref,
      score: passed.score, success_ref: passed.ref, evidence_refs: [passed.ref], source_entry: entry,
      source_kind: 'controlled_later_continuation', effect_known: false,
      qualification: 'Controlled acquired provider boundary; the current effect remains unknown.' };
  };
  const explorer: NativeFamily = {
    id: 'controlled_continuation_explorer',
    propose: observation => observation.levels_completed ? controlledQuestion(observation, 'continuation_explorer') : null,
    unacquiredInquiryWitness: (_proposal, observation) => ({ status: 'unacquired_exploration',
      observation_ref: observation.observation_ref, evidence_refs: [], qualification: 'No acquired response belongs to this synthetic explorer.' }),
    before: (proposal, _index, publicPacket, observation) => ({ admitted: proposal.binding!.observation_ref === observation.observation_ref
      && publicPacket.available_action_refs.includes('ACTION5'), reason: 'controlled_exploration_bound' }),
    after: () => assert.fail('No response is supplied to the synthetic explorer'),
    record: () => assert.fail('No acquisition is attributed to the synthetic explorer'),
    state: () => ({}), restore: state => assert.deepEqual(state, {}),
  };
  const continuation: NativeFamily = {
    id: 'controlled_acquired_continuation',
    propose: observation => { calls.proposals++; return controlledQuestion(observation, 'later_continuation', entry); },
    proposeInSubquestion: (_group, subquestion, observation) => subquestion === entry ? continuation.propose(observation, [], [], 1) : null,
    retainedSuccessWitness: observation => { calls.retained++; return success(observation); },
    acquiredContinuationWitness: (proposal, observation) => {
      calls.acquired++;
      return proposal.kind === 'controlled_later_continuation' && proposal.field_subquestion === entry ? success(observation) : null;
    },
    before: (proposal, _index, publicPacket, observation) => {
      calls.guards++;
      return { admitted: proposal.binding!.observation_ref === observation.observation_ref
        && proposal.binding!.level_epoch === publicPacket.level && proposal.binding!.levels_completed === publicPacket.levels_completed
        && publicPacket.available_action_refs.includes('ACTION5'), reason: 'controlled_continuation_bound' };
    },
    after: () => ({ matched: null, seal_prefix: true, reason: 'controlled_public_score_boundary' }),
    record: (before, after, command, _first, _second, proposal, index) => {
      assert.deepEqual(commandValue(command), commandValue(proposal.actions[index]!));
      assert.equal(before.observation_ref, proposal.binding!.observation_ref);
      calls.records++;
      const event = { before: before.observation_ref, after: after.observation_ref, score: after.levels_completed };
      memory.events.push(event);
      if (after.levels_completed > before.levels_completed) memory.passed.push({ score: after.levels_completed, ref: after.observation_ref });
      return { events: [event] };
    },
    state: () => copy(memory), restore: state => { memory = copy(state); },
  };
  const arrangement = relativeArrangementFamily();
  const runtime = new NativeV6Runtime({ sourceDigest: `arrangement-acquired-continuation-barrier:${id}`, now: () => 0,
    families: [explorer, arrangement, continuation], maxPointOccurrences: declarations.common.input_domain.max_point_occurrences,
    authorityPolicy: declarations.common, callerStrategy: declarations.strategy.declarations[0]!.configuration,
    groups: [{ id: 'goal_access', families: [explorer.id] },
      { id: 'window_constraints', families: [arrangement.id, continuation.id], entryPoints: ['relative_arrangement', entry] }] });
  try {
    const first = await runtime.initialize({ sessionId: `arrangement-acquired-continuation-${id}`,
      observation: copy(initial('unrecognized_no_model').public), budgets: BUDGETS }, execution);
    assertReleased(first, continuation.id);
    assert.deepEqual(commandValue(first.command!), { action_ref: 'ACTION5', data: {} });
    assert.deepEqual(continuation.state(), { events: [], passed: [] });
    // The frame comes from the original interface fixture; the score/epoch
    // transition is explicitly controlled contract input, not a game result.
    const returned = { ...copy(initial(id).public), level: 2, levels_completed: 1, step_index: 1 };
    const boundary = await runtime.advance({ command: first.command!, observation: returned, executionMs: 0 }, execution);
    assert.equal(boundary.kind, 'boundary'); assert.equal(boundary.snapshot.actions, 1); assert.equal(boundary.snapshot.levelsCompleted, 1);
    assert.equal((boundary.snapshot.caller as R).acquiredTransitions, 1); assert.equal(calls.records, 1);
    const retained = copy(continuation.state()) as R;
    assert.equal(retained.events.length, 1); assert.equal(retained.passed.length, 1);
    assert.deepEqual(graphValue(runtime, `family_state:${continuation.id}`), retained);
    const prefixNode = Object.values(runtime.inspectKnowledge().nodes).find(node => node.kind === 'prefix_evidence' && node.family === continuation.id);
    assert.ok(prefixNode);
    const prefix = graphValue(runtime, prefixNode.id), boundaryRef = prefix.composed_reconciliation.boundary_refs[0];
    assert.equal(prefix.transitions.length, 1); assert.equal(prefix.proposal.field_subquestion, entry);
    assert.equal(boundaryRef.after, retained.passed[0].ref);
    const transition = graphValue(runtime, boundaryRef.node);
    assert.equal(transition.status, 'official_boundary_witness');
    assert.equal(transition.boundary_witness.levels_completed_before, 0); assert.equal(transition.boundary_witness.levels_completed_after, 1);

    // Observe the actual read-only Kernel corroboration without changing its
    // arguments, return value, evidence graph or success-provider contracts.
    const inner = runtime as unknown as R, original = inner.acquiredContribution.bind(inner), corroborated: R[] = [];
    inner.acquiredContribution = (...args: any[]) => {
      const result = original(...args);
      if (args[0] === continuation) corroborated.push(copy(result));
      return result;
    };
    calls.proposals = 0; calls.retained = 0; calls.acquired = 0; calls.guards = 0;
    const result = await runtime.resume(execution);
    assert.equal(corroborated.length, 1); assert.ok(corroborated[0], 'The real Kernel contribution reaches this priority path before the source barrier');
    assert.equal(corroborated[0].status, 'acquired_official_contribution'); assert.equal(corroborated[0].family, continuation.id);
    assert.equal(corroborated[0].entry, entry); assert.equal(corroborated[0].prefix_evidence_ref, prefixNode.id);
    assert.equal(corroborated[0].transition_ref, boundaryRef.node); assert.equal(corroborated[0].after_observation_ref, retained.passed[0].ref);
    assert.equal(corroborated[0].primitive_release_authorized, false);
    assert.equal(calls.retained, 1); assert.equal(calls.records, 1); assert.equal(result.snapshot.actions, 1);
    assert.deepEqual(continuation.state(), retained, 'No simulated response is acquired by the continuation preflight');
    const proposal = result.snapshot.proposal as R, stops = (result.snapshot.trace as R[]).filter(row => row.kind === 'source_group_stop');
    if (id === 'already_arranged') {
      assertReleased(result, explorer.id);
      assert.equal(calls.proposals, 0, 'A corroborated continuation cannot bypass the earlier recognized arrangement stop');
      assert.equal(calls.acquired, 0); assert.equal(calls.guards, 0);
      assert.equal(stops.length, 1); assert.equal(stops[0].family, OWNER); assert.equal(stops[0].refusal.release_authority, false);
      assert.equal(proposal.strategy_receipt.native_coordination, undefined);
    } else {
      assertReleased(result, continuation.id);
      assert.equal(calls.proposals, 1); assert.equal(calls.acquired, 1); assert.equal(calls.guards, 2); assert.deepEqual(stops, []);
      const receipt = proposal.strategy_receipt.native_coordination[0];
      assert.equal(receipt.rule, 'current_acquired_continuation_before_unacquired_exploration');
      assert.equal(receipt.source_trigger_group, 'goal_access'); assert.equal(receipt.selected_group, 'window_constraints');
      assert.equal(receipt.selected_entry, entry); assert.equal(receipt.preferred_family, continuation.id);
      assert.deepEqual(receipt.acquired_kernel_contribution, corroborated[0]);
      assert.equal(receipt.physical_action_authorized, false);
    }
  } finally { runtime.close(`arrangement_acquired_continuation_${id}_complete`); }
});
