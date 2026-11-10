import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { CrossedPrefixMemory, freshCrossedPrefixMemory, crossedPrefixBefore, crossedPrefixAfter,
  proposeCrossedPrefixCommon, bindCrossedPrefix, CROSSED_PREFIX_NATIVE_ASSIGNMENT_BOUNDS } from '../src/logos-engine/v6-crossed-prefix-access.ts';
import { crossedPrefixMeasureControls } from '../src/logos-engine/v6-crossed-prefix-observation.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const fixture: R = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-crossed-prefix-reference.json.gz', import.meta.url))).toString());
const copy = <T>(value: T): T => structuredClone(value);
const seeded = (events: R[] = []): CrossedPrefixMemory => {
  const memory = new CrossedPrefixMemory();
  for (const event of events) memory.applyEvent(copy(event));
  return memory;
};
function assertState(memory: CrossedPrefixMemory, state: R): void {
  assert.deepEqual(memory.currentState(), state.projection);
  assert.equal(memory.retainedDigest(state.parentDigest), state.digest);
}
function domain(bindings: [number, string][] = []): ObservedInputDomain {
  const value = new ObservedInputDomain(4096);
  for (const [epoch, frame] of bindings) value.bindings.set(`${epoch}:${frame}`, new Map());
  return value;
}
async function access(memory: CrossedPrefixMemory, value: R): Promise<unknown> {
  if (value.method === 'cross_question') return memory.crossQuestion(value.observation, value.rows, value.inputs);
  if (value.method === 'cross_propose') return proposeCrossedPrefixCommon(memory, value.observation, value.rows, value.inputs, value.remaining, null, () => 0);
  if (value.method === 'propose') {
    // The source superclass result is outside this own layer. Passing that
    // unchanged result isolates config gating from untransferred parent search.
    const parent = value.expected?.crossed_prefix_plan ? null : value.expected;
    return memory.propose(value.observation, value.rows, value.inputs, value.limit, value.config, parent);
  }
  throw new Error('Unrecognized fixture access method ' + value.method);
}
for (const item of fixture.accessCases as R[]) test('original crossed-prefix access ' + item.id, async () => {
  const value = copy(item), memory = seeded(value.initialEvents);
  assertState(memory, value.beforeState);
  if (value.error) await assert.rejects(() => access(memory, value));
  else assert.deepEqual(await access(memory, value), value.expected);
  assertState(memory, value.afterState);
  assert.deepEqual(value, item, 'Planning cannot modify inputs, source event seeds or expectations');
});

for (const item of fixture.guardCases as R[]) test('original crossed-prefix guard ' + item.id, () => {
  const value = copy(item);
  const run = (): unknown => {
    if (value.method === 'before') return crossedPrefixBefore(value.proposal, value.index, value.rows, value.meta);
    if (value.method === 'after') return crossedPrefixAfter(value.proposal, value.index, value.rows, value.later, value.meta);
    if (value.method === 'bind') { bindCrossedPrefix(value.proposal, domain(value.bindings)); return value.proposal; }
    throw new Error('Unrecognized fixture guard method ' + value.method);
  };
  if (value.error) assert.throws(run);
  else assert.deepEqual(run(), value.expected);
  if (value.method !== 'bind') assert.deepEqual(value, item);
});

for (const item of fixture.recordCases as R[]) test('original crossed-prefix acquisition ' + item.id, () => {
  const value = copy(item), memory = seeded(value.initialEvents);
  assertState(memory, value.beforeState);
  const run = () => memory.record(value.before, value.command, value.after, value.rows, value.later, value.proposal, value.index);
  if (value.error) assert.throws(run);
  else assert.deepEqual(run(), value.expectedOwnEvents);
  assertState(memory, value.afterState);
  assert.deepEqual(value, item);
});

for (const item of fixture.eventCases as R[]) test('original crossed-prefix retained event ' + item.id, () => {
  const memory = new CrossedPrefixMemory(); assertState(memory, item.beforeState);
  const run = () => { for (const event of item.events) memory.applyEvent(copy(event)); return memory.currentState(); };
  if (item.error) assert.throws(run);
  else { run(); assertState(memory, item.afterState); }
});

for (const item of fixture.chains as R[]) test('original crossed-prefix cold chain ' + item.id, () => {
  let memory = seeded(item.initialEvents);
  assertState(memory, item.initialState);
  for (const step of item.steps) {
    assert.deepEqual(memory.crossQuestion(step.before, step.rows, []), step.proposal);
    assert.deepEqual(memory.record(step.before, step.command, step.after, step.rows, step.later, step.proposal, step.index), step.expectedOwnEvents);
    assertState(memory, step.afterState);
    const rebuilt = seeded(memory.currentState().cross_events);
    assertState(rebuilt, step.restoredState); memory = rebuilt;
  }
  assertState(memory, item.finalState);
  const last = item.steps.at(-1);
  assert.deepEqual(memory.crossQuestion(last.after, last.later, []), item.following);
});

function freshCase(): R { return copy(fixture.accessCases.find((value: R) => value.id === 'fresh_select')); }
function recordCase(id: string): R { const item = fixture.recordCases.find((value: R) => value.id === id); assert.ok(item); return copy(item); }

// Independent native contracts complement the unchanged-source oracle. They
// exercise bounded refusal, isolation and mandatory current physical authority.
test('crossed-prefix native state is detached, observations do not acquire and parents are explicit', async () => {
  const value = freshCase(), memory = new CrossedPrefixMemory(), baseline = memory.currentState();
  const first = freshCrossedPrefixMemory(); first.cross_events.push({ kind: 'foreign' }); first.cross_axis_inputs['0'].push('foreign');
  assert.deepEqual(memory.currentState(), freshCrossedPrefixMemory());
  const proposal = memory.crossQuestion(value.observation, value.rows, []);
  assert.ok(proposal); proposal.crossed_prefix_plan.state_before.progress['0:0:-1'] = 999;
  const common = await proposeCrossedPrefixCommon(memory, value.observation, value.rows, [], 1, 100, () => 0);
  assert.ok(common); common.point_support.point[0] += 10;
  assert.deepEqual(memory.currentState(), baseline); assert.equal(memory.nativeRevision, 0);
  const parent = { status: 'unknown', reason: 'ancestor_contract' };
  assert.equal(memory.propose(value.observation, value.rows, [], 1, {}, parent), parent);
  assert.deepEqual(memory.record({}, {}, {}, [], [], {}, 0), []);
});

test('crossed-prefix journal rejects malformed events without any partial state or revision', () => {
  const memory = new CrossedPrefixMemory(), baseline = memory.currentState(), digest = memory.retainedDigest('parent');
  for (const event of [
    { kind: 'foreign' }, { kind: 'crossed_prefix_state' },
    { kind: 'crossed_prefix_input', axis: 2, action: 'ACTION1' }, { kind: 'crossed_prefix_input', axis: 0 },
    { kind: 'crossed_prefix_input', axis: 0, action: 2 },
    { kind: 'crossed_prefix_pair', owner: undefined },
    { kind: 'crossed_prefix_state', state: { progress: Infinity } },
  ]) {
    assert.throws(() => memory.applyEvent(event));
    assert.deepEqual(memory.currentState(), baseline); assert.equal(memory.nativeRevision, 0);
    assert.equal(memory.retainedDigest('parent'), digest);
  }
});

test('historical opaque state and pair fragments remain retained without inventing missing planning dependencies', () => {
  const events = [{ kind: 'crossed_prefix_state', state: { epoch: 1 } },
    { kind: 'crossed_prefix_pair', owner: 0 }, { kind: 'crossed_prefix_input', axis: 0, action: 'ACTION2' }];
  const memory = seeded(events), retained = memory.currentState();
  assert.deepEqual(retained.cross_state, { epoch: 1 });
  assert.deepEqual(retained.cross_pairs, [{ kind: 'crossed_prefix_pair', owner: 0 }]);
  assert.deepEqual(retained.cross_axis_inputs, { '0': ['ACTION2'], '1': [] });
  assert.deepEqual(retained.cross_events, events);
  assert.equal(seeded(retained.cross_events).retainedDigest('parent'), memory.retainedDigest('parent'));
  const value = freshCase(); value.observation.level_epoch = 1;
  assert.throws(() => memory.crossQuestion(value.observation, value.rows, []), /invalid/);
  assert.deepEqual(memory.currentState(), retained, 'An incomplete historic state is not silently repaired or acquired during planning');
});

test('crossed-prefix acquisition owns all returned events and never aliases plan or caller payloads', () => {
  const value = recordCase('one_cell_advance'), memory = seeded(value.initialEvents);
  const events = memory.record(value.before, value.command, value.after, value.rows, value.later, value.proposal, value.index);
  const expected = memory.currentState(), digest = memory.retainedDigest('parent'), revision = memory.nativeRevision;
  events[0].action = 'ACTION5'; events.at(-1).state.progress['0:0:-1'] = 999;
  value.command.action_ref = 'ACTION5'; value.proposal.crossed_prefix_plan.state_before.invalid = true;
  const detached = memory.currentState(); detached.cross_events.length = 0; detached.cross_axis_inputs['0'].push('foreign');
  assert.deepEqual(memory.currentState(), expected); assert.equal(memory.retainedDigest('parent'), digest); assert.equal(memory.nativeRevision, revision);
});

test('a malformed final state rejects the entire own return batch before its earlier input event is acquired', () => {
  const value = recordCase('one_cell_advance'), memory = seeded(value.initialEvents);
  const baseline = memory.currentState(), digest = memory.retainedDigest('parent'), revision = memory.nativeRevision;
  value.proposal.crossed_prefix_plan.state_before.invalid_native_field = undefined;
  assert.throws(() => memory.record(value.before, value.command, value.after, value.rows, value.later, value.proposal, value.index), /explicit JSON/);
  assert.deepEqual(memory.currentState(), baseline); assert.equal(memory.retainedDigest('parent'), digest);
  assert.equal(memory.nativeRevision, revision);
});

test('crossed-prefix repeated input events retain history while acquired action sets stay unique', () => {
  const event = { kind: 'crossed_prefix_input', axis: 0, action: 'ACTION3', evidence: 'actual-return', epoch: 1 };
  const memory = new CrossedPrefixMemory(); memory.applyEvent(event); memory.applyEvent(event);
  event.action = 'ACTION4';
  assert.deepEqual(memory.currentState().cross_axis_inputs, { '0': ['ACTION3'], '1': [] });
  assert.equal(memory.eventCount, 2); assert.equal(memory.nativeRevision, 2);
});

test('crossed-prefix acquisition uses the higher inherited outcome dispatch when supplied', () => {
  const value = recordCase('one_cell_advance'), memory = seeded(value.initialEvents);
  let calls = 0;
  const events = memory.record(value.before, value.command, value.after, value.rows, value.later, value.proposal, value.index,
    { after: (proposal, index, rows, later, meta) => {
      calls++; assert.equal(proposal, value.proposal); assert.equal(index, value.index);
      assert.equal(rows, value.rows); assert.equal(later, value.later); assert.equal(meta.epoch, value.after.level_epoch);
      return { matched: null, seal_prefix: true, reason: 'higher_inherited_question' };
    } });
  assert.equal(calls, 1); assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'crossed_prefix_state'); assert.equal(events[0].state.invalid, true);
  assert.deepEqual(memory.currentState().cross_axis_inputs, { '0': [], '1': [] });
});

test('native assignment bounds are explicit and preserve the exact completed source result at the limit', async () => {
  const value = freshCase(), memory = new CrossedPrefixMemory();
  const expected = memory.crossQuestion(value.observation, value.rows, []);
  const controls = crossedPrefixMeasureControls(value.rows, expected.crossed_prefix_plan.state_before.layout);
  const total = controls.reduce((product: number, control: R) => product * new Set([control.color, ...control.alternatives.map((a: R) => a.color)]).size, 1);
  assert.ok(total > 1); assert.equal(CROSSED_PREFIX_NATIVE_ASSIGNMENT_BOUNDS.maxControllers, 128);
  assert.equal(CROSSED_PREFIX_NATIVE_ASSIGNMENT_BOUNDS.maxAssignments, 65_536);
  const exact = memory.crossQuestion(value.observation, value.rows, [], { nativeBounds: true, maxControllers: controls.length,
    maxAssignments: total, deadlineMs: 100, now: () => 0 });
  assert.deepEqual(exact, expected);
  const wrapper = await proposeCrossedPrefixCommon(memory, value.observation, value.rows, [], 1, 100, () => 0,
    { maxControllers: controls.length, maxAssignments: total });
  assert.equal(wrapper.status, 'proposed'); assert.equal(wrapper.proposal_id, expected.proposal_id);
  assert.deepEqual(memory.currentState(), freshCrossedPrefixMemory());
});

test('native assignment exhaustion is an unknown frontier without candidate action or acquisition', async () => {
  const value = freshCase(), memory = new CrossedPrefixMemory(), baseline = memory.currentState();
  for (const [bounds, expectedBound, examined] of [
    [{ maxControllers: 0 }, 'controllers', 0],
    [{ maxAssignments: 0 }, 'assignments', 0],
    [{ maxAssignments: 2 }, 'assignments', 2],
  ] as [R, string, number][]) {
    const result = await proposeCrossedPrefixCommon(memory, value.observation, value.rows, [], 1, 100, () => 0, bounds);
    assert.equal(result.status, 'unknown'); assert.equal(result.block_unrelated_probe, true); assert.equal(result.exhausted_bound, expectedBound);
    assert.equal(result.frontier.assignments_examined, examined); assert.equal(result.frontier.complete, false);
    assert.equal(Object.hasOwn(result, 'actions'), false); assert.equal(Object.hasOwn(result, 'crossed_prefix_plan'), false);
    assert.deepEqual(memory.currentState(), baseline); assert.equal(memory.nativeRevision, 0);
  }
});

test('native assignment deadline cuts before or during the same request-wide enumeration', async () => {
  const value = freshCase(), memory = new CrossedPrefixMemory();
  const before = await proposeCrossedPrefixCommon(memory, value.observation, value.rows, [], 1, 10, () => 10);
  assert.equal(before.exhausted_bound, 'deadline'); assert.equal(before.frontier.assignments_examined, 0);
  let ticks = 0;
  const during = await proposeCrossedPrefixCommon(memory, value.observation, value.rows, [], 1, 2, () => ticks++);
  assert.equal(during.exhausted_bound, 'deadline'); assert.equal(during.frontier.assignments_examined, 2);
  assert.equal(ticks, 3); assert.deepEqual(memory.currentState(), freshCrossedPrefixMemory());
  assert.equal(await proposeCrossedPrefixCommon(memory, value.observation, value.rows, [], 0, 0, () => 0), null);
});

test('native assignment bounds reject invalid request parameters without creating knowledge', () => {
  const value = freshCase(), memory = new CrossedPrefixMemory();
  for (const bounds of [{ maxAssignments: -1 }, { maxAssignments: 0.5 }, { maxControllers: Infinity }, { deadlineMs: NaN }]) {
    assert.throws(() => memory.crossQuestion(value.observation, value.rows, [], { nativeBounds: true, ...bounds }));
  }
  assert.deepEqual(memory.currentState(), freshCrossedPrefixMemory());
});

test('current point support bypasses only the sampler and still needs the exact observed domain and full frame', async () => {
  const value = freshCase(), memory = new CrossedPrefixMemory();
  const proposal = await proposeCrossedPrefixCommon(memory, value.observation, value.rows, [], 1, 100, () => 0);
  assert.throws(() => bindCrossedPrefix(proposal, domain()));
  bindCrossedPrefix(proposal, domain([[value.observation.level_epoch, value.observation.frame_hash]]));
  assert.equal(proposal.steps[0].point_binding.point, proposal.point_support.point, 'Source copies support shallowly');
  const packet = { level: value.observation.level_epoch, frame_hash: value.observation.frame_hash, frame_rows: value.rows };
  assert.equal(await ObservedInputDomain.pointGuard(packet, proposal.actions[0], proposal.steps[0]), true);
  assert.equal(await ObservedInputDomain.pointGuard({ ...packet, frame_hash: 'other' }, proposal.actions[0], proposal.steps[0]), false);
  const changed = copy(value.rows); changed[0][0] = (changed[0][0] + 1) % 16;
  assert.equal(crossedPrefixBefore(proposal, 0, changed, { epoch: value.observation.level_epoch, score: value.observation.levels_completed,
    observation_ref: value.observation.observation_ref, available: value.observation.available_action_refs }).admitted, false);
});
