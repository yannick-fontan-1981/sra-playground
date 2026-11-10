import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { RootedLineMemory, freshRootedLineMemory, proposeRootedLine, rootedLineBefore,
  rootedLineAfter } from '../src/logos-engine/v6-rooted-line-access.ts';
import { measureRootedLine, physicalRootedLine } from '../src/logos-engine/v6-rooted-line-observation.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';

type R = Record<string, any>;
const fixture: R = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-rooted-line-reference.json.gz', import.meta.url))).toString());
const clone = <T>(value: T): T => structuredClone(value);
const accessOperations = new Set(['propose', 'record', 'apply_events']);
const caseOf = (id: string): R => {
  const value = fixture.cases.find((item: R) => item.id === id);
  assert.ok(value, 'Missing source fixture: ' + id); return value;
};
const seeded = (events: R[] = []): RootedLineMemory => {
  const memory = new RootedLineMemory();
  for (const event of events) memory.applyEvent(clone(event));
  return memory;
};
function assertState(memory: RootedLineMemory, state: R): void {
  assert.deepEqual(memory.currentState(), state.projection);
  assert.equal(memory.retainedDigest(state.parentDigest), state.digest);
}

for (const item of fixture.cases.filter((value: R) => accessOperations.has(value.operation)) as R[]) {
  test('original rooted-line access ' + item.id, () => {
    const a = clone(item.arguments), memory = seeded(item.seedEvents);
    if (item.beforeState) assertState(memory, item.beforeState);
    let actual: unknown;
    switch (item.operation) {
      case 'propose': actual = proposeRootedLine(memory, a.observation, a.rows, a.inputs, a.limit, a.config); break;
      case 'record': actual = memory.record(a.before, a.command, a.after, a.rows, a.later, a.proposal, a.index); break;
      case 'apply_events': actual = a.events.map((event: R) => { memory.applyEvent(event); return null; }); break;
      default: throw new Error('Unknown rooted-line access operation: ' + item.operation);
    }
    assert.deepEqual(actual, item.expected, item.id);
    if (item.afterState) assertState(memory, item.afterState);
    assert.deepEqual(a, item.arguments, 'own-layer contracts do not mutate caller values');
  });
}

for (const item of fixture.guards as R[]) test('original rooted-line guard ' + item.id, () => {
  const value = clone(item);
  const actual = value.phase === 'before'
    ? rootedLineBefore(value.proposal, value.index, value.rows, value.meta)
    : rootedLineAfter(value.proposal, value.index, value.rows, value.later, value.meta);
  assert.deepEqual(actual, value.expected, value.id);
  assert.deepEqual(value, item);
});

test('disabled or unmeasured rooted question delegates without acquiring memory', () => {
  const memory = new RootedLineMemory(), a = caseOf('propose:initial_calibration').arguments;
  assert.equal(memory.propose(a.observation, a.rows, [], 16, {}), null);
  assert.equal(memory.propose(a.observation, a.rows, [], 16, { rooted_line_question: {} }), null);
  const blank = Array.from({ length: 64 }, () => Array(64).fill(0));
  assert.equal(memory.propose(a.observation, blank, [], 16, a.config), null);
  assert.deepEqual(memory.currentState(), { line_memory: freshRootedLineMemory(), line_events: [] });
  assert.equal(memory.nativeRevision, 0); assert.equal(memory.eventCount, 0);
  assert.deepEqual(memory.record({}, {}, {}, blank, blank, {}, 0), []);
  assert.throws(() => memory.applyEvent({ kind: 'observed_panel_service' }), /Outside rooted-line/);
  assert.throws(() => memory.applyEvent({ kind: 'observed_rooted_line' }), /lacks its memory/);
  assert.equal(memory.nativeRevision, 0);
});

test('proposal formation preserves the acquired state and current evidence is never omitted or capped', () => {
  const a = caseOf('propose:initial_calibration').arguments, memory = new RootedLineMemory();
  const evidence = Array.from({ length: 40 }, (_, index) => 'prior:' + index);
  const seed = { kind: 'observed_rooted_line', memory: { ...freshRootedLineMemory(), evidence }, detail: {} };
  memory.applyEvent(seed);
  const prior = memory.currentState(), digest = memory.retainedDigest('parent'), revision = memory.nativeRevision;
  const proposal = memory.propose(a.observation, a.rows, [], 16, a.config)!;
  assert.equal(proposal.rooted_line_plan.kind, 'calibrate');
  assert.deepEqual(proposal.bundle_template.evidence, [...evidence, a.observation.observation_ref]);
  assert.deepEqual(proposal.question.hypothesis_refs, proposal.bundle_template.evidence);
  assert.deepEqual(proposal.route_refs, proposal.bundle_template.evidence);
  assert.deepEqual(memory.currentState(), prior); assert.equal(memory.retainedDigest('parent'), digest);
  assert.equal(memory.nativeRevision, revision);
  proposal.rooted_line_plan.memory.evidence.length = 0;
  proposal.rooted_line_plan.commands[0].action_ref = 'changed';
  assert.deepEqual(memory.currentState(), prior);
  for (const item of fixture.cases.filter((candidate: R) => candidate.operation === 'propose') as R[]) {
    assert.deepEqual(item.beforeState, item.afterState, item.id);
  }
});

test('restored source events reproduce state and digest with detached mutable imports and exports', () => {
  const items = fixture.cases.filter((item: R) => item.operation === 'record') as R[];
  assert.ok(items.length >= 8);
  for (const item of items) {
    const events = clone([...(item.seedEvents ?? []), ...item.expected]), memory = seeded(events);
    assertState(memory, item.afterState);
    assert.equal(memory.eventCount, events.length); assert.equal(memory.nativeRevision, events.length);
    const prior = memory.retainedDigest(item.afterState.parentDigest);
    const exported = memory.currentState();
    exported.line_memory.evidence.push('mutated:export'); exported.line_events.length = 0;
    events[events.length - 1].memory.evidence.push('mutated:input');
    assert.equal(memory.retainedDigest(item.afterState.parentDigest), prior);
  }
  const item = caseOf('record:calibrated_translation'), event = clone(item.expected[0]);
  const memory = new RootedLineMemory(); memory.applyEvent(event);
  event.memory.controls.ACTION1.root_translation[0] = 999;
  event.detail.command.action_ref = 'mutated';
  assertState(memory, item.afterState);
});

test('a journaled record is detached from its returned event and invalidated exactly once', () => {
  const item = caseOf('record:calibrated_translation'), a = clone(item.arguments), memory = seeded(item.seedEvents);
  const revision = memory.nativeRevision, eventCount = memory.eventCount;
  const events = memory.record(a.before, a.command, a.after, a.rows, a.later, a.proposal, a.index);
  assert.equal(memory.nativeRevision, revision + 1); assert.equal(memory.eventCount, eventCount + 1);
  assertState(memory, item.afterState);
  events[0].memory.evidence.length = 0; events[0].detail.command.action_ref = 'mutated';
  assertState(memory, item.afterState);
});

test('unreadable scene returns still retain evidence and own events without acquiring a control or refutation', () => {
  for (const id of ['record:calibration_missing_scene', 'record:conditional_missing_scene']) {
    const item = caseOf(id), a = clone(item.arguments), memory = seeded(item.seedEvents), count = memory.eventCount;
    const events = memory.record(a.before, a.command, a.after, a.rows, a.later, a.proposal, a.index);
    assert.equal(events.length, 1); assert.equal(memory.eventCount, count + 1);
    assert.equal(events[0].detail.matched, null);
    assert.deepEqual(events[0].memory.refuted, item.beforeState.projection.line_memory.refuted);
    assert.ok(events[0].memory.evidence.includes(a.after.observation_ref));
    assert.equal(events[0].detail.observed_effect, undefined);
  }
});

test('epoch refutation blocks only its epoch and calibration history survives the next epoch', () => {
  const item = caseOf('record:conditional_projection_refuted'), memory = seeded([...(item.seedEvents ?? []), ...item.expected]);
  const a = clone(caseOf('propose:conditional_composition').arguments);
  assert.deepEqual(memory.propose(a.observation, a.rows, [], 16, a.config), {
    status: 'unknown', reason: 'conditional_contact_model_refuted', block_unrelated_probe: true,
  });
  const state = memory.currentState(), changed = { ...a.observation, level_epoch: a.observation.level_epoch + 1 };
  const next = memory.propose(changed, a.rows, [], 16, a.config)!;
  assert.notEqual(next.reason, 'conditional_contact_model_refuted');
  if (next.rooted_line_plan) {
    assert.deepEqual(next.rooted_line_plan.memory.controls, state.line_memory.controls);
    assert.deepEqual(next.rooted_line_plan.memory.refuted, state.line_memory.refuted);
    assert.deepEqual(next.rooted_line_plan.memory.tried, []);
    assert.equal(next.rooted_line_plan.memory.current, null);
  }
  assert.deepEqual(memory.currentState(), state, 'proposal epoch reset remains tentative');
});

test('score-only boundaries seal execution while source acquisition still distinguishes epoch changes', () => {
  const item = caseOf('record:score_only_boundary_is_not_epoch_boundary'), a = clone(item.arguments), memory = seeded(item.seedEvents);
  const outcome = rootedLineAfter(a.proposal, a.index, a.rows, a.later, {
    epoch: a.after.level_epoch, score: a.after.levels_completed,
  });
  assert.equal(outcome.matched, null); assert.equal(outcome.seal_prefix, true);
  const [event] = memory.record(a.before, a.command, a.after, a.rows, a.later, a.proposal, a.index);
  assert.equal(event.detail.boundary, false);
  assert.deepEqual(event.detail.observed_effect, { root_translation: [2, 0], extent_delta: 0 });
});

test('continuation requires the prior measured prediction, current availability and immutable plan identity', () => {
  const item = caseOf('propose:conditional_composition'), proposal = clone(item.expected), rows = clone(item.arguments.rows);
  const physical = physicalRootedLine(measureRootedLine(rows)!);
  const plan = proposal.rooted_line_plan;
  plan.commands = [clone(proposal.actions[0]), clone(proposal.actions[0])];
  plan.predictions = [physical, physical]; plan.configurations = [null, null];
  proposal.actions = clone(plan.commands); proposal.bundle_template.actions = clone(plan.commands);
  proposal.proposal_id = 'rooted-line:' + symbolicDigest(plan);
  const meta = { epoch: plan.epoch, score: plan.score, observation_ref: 'later:observed',
    available: proposal.actions.map((action: R) => action.action_ref) };
  assert.equal(rootedLineBefore(proposal, 1, rows, meta).admitted, true);
  assert.equal(rootedLineBefore(proposal, 1, rows, { ...meta, available: [] }).admitted, false);
  plan.predictions[0] = null; proposal.proposal_id = 'rooted-line:' + symbolicDigest(plan);
  assert.equal(rootedLineBefore(proposal, 1, rows, meta).admitted, false);
});

test('current execution clock rejects an expired deadline without advancing memory', () => {
  const item = caseOf('propose:initial_calibration'), a = clone(item.arguments), memory = seeded(item.seedEvents);
  const before = memory.currentState();
  const result = memory.propose(a.observation, a.rows, [], 16, {
    ...a.config, level_deadline: 500, native_rooted_now: () => 500,
  });
  assert.deepEqual(result, { status: 'unknown', reason: 'rooted_line_level_deadline', block_unrelated_probe: true });
  assert.deepEqual(memory.currentState(), before);
  assert.equal(memory.propose(a.observation, a.rows, [], 16, {
    ...a.config, level_deadline: 500, native_rooted_now: () => 499,
  })!.status, 'proposed');
});

test('an interrupted conditional search reports its bound and does not acquire a prediction', () => {
  const item = caseOf('propose:conditional_composition'), a = clone(item.arguments), memory = seeded(item.seedEvents);
  const prior = memory.currentState(), revision = memory.nativeRevision;
  const result = memory.propose(a.observation, a.rows, [], 16, {
    ...a.config, native_rooted_line_work_budget: { shouldStop: () => true },
  })!;
  assert.equal(result.status, 'unknown'); assert.equal(result.reason, 'rooted_contact_plan_unresolved');
  assert.equal(result.search.truncated, true);
  assert.ok(result.search.bounds.includes('bound.native_interruption'));
  assert.equal(result.block_unrelated_probe, true);
  assert.deepEqual(memory.currentState(), prior); assert.equal(memory.nativeRevision, revision);
});

test('a shorter native work deadline remains binding inside the shared level deadline', () => {
  const item = caseOf('propose:conditional_composition'), a = clone(item.arguments), memory = seeded(item.seedEvents);
  const result = memory.propose(a.observation, a.rows, [], 16, { ...a.config, level_deadline: 100,
    native_rooted_now: () => 55, native_rooted_line_work_budget: { deadlineMs: 50 },
  })!;
  assert.equal(result.status, 'unknown'); assert.equal(result.reason, 'rooted_contact_plan_unresolved');
  assert.ok(result.search.bounds.includes('bound.native_interruption'));
  assert.equal(result.search.truncated, true);
});
