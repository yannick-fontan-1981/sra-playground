import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { FramedWindowMemory, freshFramedWindowMemory, framedWindowBefore, framedWindowAfter,
  proposeFramedWindowCommon, bindFramedWindow } from '../src/logos-engine/v6-framed-window-access.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const fixture: R = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-framed-window-reference.json.gz', import.meta.url))).toString());
const copy = <T>(value: T): T => structuredClone(value);
const ownOperations = new Set(['propose', 'window_proposal', 'common_propose', 'record', 'apply_events', 'bind', 'before', 'after']);
const seeded = (events: R[] = []): FramedWindowMemory => {
  const memory = new FramedWindowMemory();
  for (const event of events) memory.applyEvent(copy(event));
  return memory;
};
function assertState(memory: FramedWindowMemory, expected: R): void {
  assert.deepEqual(memory.currentState(), expected.projection);
  assert.equal(memory.retainedDigest(expected.parentDigest), expected.digest);
}
function boundDomain(bindings: [number, string][]): ObservedInputDomain {
  const domain = new ObservedInputDomain(4096);
  for (const [epoch, frame] of bindings) domain.bindings.set(`${epoch}:${frame}`, new Map());
  return domain;
}
async function execute(memory: FramedWindowMemory, operation: string, a: R): Promise<unknown> {
  switch (operation) {
    case 'propose': return memory.propose(a.observation, a.rows, a.inputs, a.limit, a.config, a.deadlineMs, () => a.nowMs);
    case 'window_proposal': return memory.windowProposal(a.observation, a.rows, a.scene, a.receipt, a.key, a.cfg);
    case 'common_propose': return proposeFramedWindowCommon(memory, a.observation, a.rows, a.inputs, a.remaining, a.config,
      a.deadlineMs, () => a.nowMs);
    case 'record': return memory.record(a.before, a.command, a.after, a.rows, a.later, a.proposal, a.index);
    case 'apply_events': for (const event of a.events) memory.applyEvent(event); return memory.currentState();
    case 'bind': bindFramedWindow(a.proposal, boundDomain(a.bindings)); return a.proposal;
    case 'before': return framedWindowBefore(a.proposal, a.index, a.rows, a.meta);
    case 'after': return framedWindowAfter(a.proposal, a.index, a.rows, a.later, a.meta);
    default: throw new Error('Unexpected own operation ' + operation);
  }
}
function ownExpected(item: R): unknown {
  return item.operation === 'propose' || item.operation === 'common_propose' ? item.expectedOwn
    : item.operation === 'record' ? item.expectedOwnEvents : item.expected;
}
function proposalCase(): R {
  const item = fixture.cases.find((value: R) => value.operation === 'propose' && value.expectedOwn?.status === 'proposed');
  assert.ok(item, 'The unchanged source fixture must contain an admitted own proposal');
  return item;
}

for (const item of fixture.cases.filter((value: R) => ownOperations.has(value.operation)) as R[]) {
  test('original framed window ' + item.id, async () => {
    const a = copy(item.arguments), memory = seeded(item.seedEvents);
    if (item.beforeState) assertState(memory, item.beforeState);
    assert.deepEqual(await execute(memory, item.operation, a), ownExpected(item), item.id);
    if (item.afterState) assertState(memory, item.afterState);
    if (item.operation !== 'bind') assert.deepEqual(a, item.arguments, 'Only bind may update the supplied proposal');
  });
}

for (const item of fixture.guards as R[]) test('original framed window guard ' + item.id, () => {
  const value = copy(item);
  const actual = value.phase === 'before' ? framedWindowBefore(value.proposal, value.index, value.rows, value.meta)
    : framedWindowAfter(value.proposal, value.index, value.rows, value.later, value.meta);
  assert.deepEqual(actual, value.expected); assert.deepEqual(value, item);
});

for (const item of fixture.sourceExceptions.filter((value: R) => ownOperations.has(value.operation)) as R[]) {
  test('original framed window rejection ' + item.id, async () => {
    const a = copy(item.arguments), memory = seeded(item.seedEvents);
    if (item.beforeState) assertState(memory, item.beforeState);
    await assert.rejects(() => execute(memory, item.operation, a));
    if (item.afterState) assertState(memory, item.afterState);
  });
}

test('framed-window owner starts detached and rejects foreign or incomplete native journals atomically', () => {
  const memory = new FramedWindowMemory(), first = freshFramedWindowMemory(), second = freshFramedWindowMemory();
  first.window_events.push({ kind: 'foreign' }); first.window_blocked.push('foreign');
  assert.deepEqual(memory.currentState(), second);
  for (const event of [{ kind: 'rooted_quota_state' }, { kind: 'framed_window_response' },
    { kind: 'framed_window_response', official_progress: false }]) assert.throws(() => memory.applyEvent(event));
  assert.deepEqual(memory.currentState(), second);
  assert.equal(memory.nativeRevision, 0); assert.equal(memory.eventCount, 0);
  assert.deepEqual(memory.record({}, {}, {}, [], [], {}, 0), []);
});

test('framed-window fallback preserves the supplied ancestor offer without acquiring evidence', () => {
  const item = proposalCase(), a = copy(item.arguments), memory = seeded(item.seedEvents), before = memory.currentState();
  const parent = { status: 'proposed', rooted_quota_plan: { own: true } };
  assert.equal(memory.propose(a.observation, a.rows, a.inputs, 0, a.config, a.deadlineMs, () => a.nowMs, parent), parent);
  assert.equal(memory.propose(a.observation, a.rows, a.inputs, a.limit, {}, a.deadlineMs, () => a.nowMs, parent), parent);
  assert.deepEqual(memory.currentState(), before); assert.equal(memory.nativeRevision, item.seedEvents?.length ?? 0);
});

test('framed-window proposals and returned state do not mutate retained knowledge', async () => {
  const item = proposalCase(), a = copy(item.arguments), memory = seeded(item.seedEvents), before = memory.currentState();
  const digest = memory.retainedDigest('ancestor'), revision = memory.nativeRevision;
  const proposal = memory.propose(a.observation, a.rows, a.inputs, a.limit, a.config, a.deadlineMs, () => a.nowMs)!;
  const wrapped = await proposeFramedWindowCommon(memory, a.observation, a.rows, a.inputs, a.limit, a.config, a.deadlineMs, () => a.nowMs);
  assert.ok(wrapped);
  proposal.framed_window_plan.point[0] += 100; proposal.framed_window_plan.method_receipt.values.foreign = true;
  const snapshot = memory.currentState(); snapshot.window_events.push({ kind: 'foreign' }); snapshot.window_blocked.push('foreign');
  assert.deepEqual(memory.currentState(), before); assert.equal(memory.retainedDigest('ancestor'), digest); assert.equal(memory.nativeRevision, revision);
  assert.deepEqual(a, item.arguments);
});

test('a real nonprogress response blocks the exact epoch/frame/window trial and survives reconstruction', () => {
  const item = proposalCase(), a = copy(item.arguments), memory = seeded(item.seedEvents);
  const proposal = memory.propose(a.observation, a.rows, a.inputs, a.limit, a.config, a.deadlineMs, () => a.nowMs)!;
  const after = { ...a.observation, observation_ref: a.observation.observation_ref + ':returned' };
  const events = memory.record(a.observation, proposal.actions[0], after, a.rows, a.rows, proposal, 0);
  assert.equal(events.length, 1); assert.equal(events[0]!.official_progress, false); assert.equal(events[0]!.canonical_changed, false);
  assert.deepEqual(memory.currentState().window_blocked, [proposal.framed_window_plan.trial_key]);
  assert.equal(memory.propose(after, a.rows, a.inputs, a.limit, a.config, a.deadlineMs, () => a.nowMs), null,
    'A fresh observation identity alone cannot forget this same measured trial');
  const rebuilt = seeded(memory.currentState().window_events);
  assert.deepEqual(rebuilt.currentState(), memory.currentState());
  assert.equal(rebuilt.retainedDigest('ancestor'), memory.retainedDigest('ancestor'));
  assert.equal(rebuilt.propose(after, a.rows, a.inputs, a.limit, a.config, a.deadlineMs, () => a.nowMs), null);
  const nextEpoch = { ...after, level_epoch: after.level_epoch + 1 };
  assert.ok(rebuilt.propose(nextEpoch, a.rows, a.inputs, a.limit, a.config, a.deadlineMs, () => a.nowMs)?.framed_window_plan,
    'An old scoped failure is not an acquired universal reference law');
});

test('real official progress retains its event without inventing acceptance or clearing earlier blocked trials', () => {
  const item = proposalCase(), a = copy(item.arguments), memory = seeded(item.seedEvents);
  const proposal = memory.propose(a.observation, a.rows, a.inputs, a.limit, a.config, a.deadlineMs, () => a.nowMs)!;
  const after = { ...a.observation, observation_ref: a.observation.observation_ref + ':advanced', levels_completed: a.observation.levels_completed + 1 };
  const events = memory.record(a.observation, proposal.actions[0], after, a.rows, a.rows, proposal, 0);
  assert.equal(events[0]!.official_progress, true); assert.equal(events[0]!.canonical_changed, false);
  assert.deepEqual(memory.currentState().window_blocked, []);
  assert.ok(memory.propose(a.observation, a.rows, a.inputs, a.limit, a.config, a.deadlineMs, () => a.nowMs));
  memory.applyEvent({ ...events[0], official_progress: false }); memory.applyEvent(events[0]!);
  assert.deepEqual(memory.currentState().window_blocked, [proposal.framed_window_plan.trial_key]);
  assert.equal(memory.propose(a.observation, a.rows, a.inputs, a.limit, a.config, a.deadlineMs, () => a.nowMs), null);
});

test('framed-window returned responses and caller payloads cannot change acquired memory', () => {
  const item = proposalCase(), a = copy(item.arguments), memory = seeded(item.seedEvents);
  const proposal = memory.propose(a.observation, a.rows, a.inputs, a.limit, a.config, a.deadlineMs, () => a.nowMs)!;
  const command = copy(proposal.actions[0]), after = { ...a.observation, observation_ref: 'actual-return' };
  const events = memory.record(a.observation, command, after, a.rows, a.rows, proposal, 0), retained = memory.currentState();
  const digest = memory.retainedDigest('parent');
  command.data.x += 10; proposal.framed_window_plan.point[0] += 20;
  events[0]!.point[0] += 30; events[0]!.evidence.push('foreign'); events[0]!.command.data.x += 40;
  assert.deepEqual(memory.currentState(), retained); assert.equal(memory.retainedDigest('parent'), digest);
});

test('framed-window common wrapper bounds the prefix and attaches the exact current support before binding', async () => {
  const item = proposalCase(), a = copy(item.arguments), memory = seeded(item.seedEvents);
  let received: R | null = null;
  const real = memory.propose.bind(memory);
  memory.propose = (observation, rows, inputs, limit, config, deadline, now, base) => {
    received = { limit, config, deadline };
    return real(observation, rows, inputs, limit, config, deadline, now, base);
  };
  const proposal = await proposeFramedWindowCommon(memory, a.observation, a.rows, a.inputs, 100, a.config, a.deadlineMs, () => a.nowMs);
  assert.ok(proposal); assert.equal(received!.limit, 16); assert.equal(received!.config.remaining_level_actions, 100);
  assert.equal(received!.config.level_deadline, a.deadlineMs);
  assert.deepEqual(proposal.steps[0].expected_before, { level_epoch: a.observation.level_epoch, frame_hash: a.observation.frame_hash,
    levels_completed: a.observation.levels_completed, state: a.observation.state });
  const domain = boundDomain([[a.observation.level_epoch, a.observation.frame_hash]]);
  bindFramedWindow(proposal, domain);
  assert.deepEqual(proposal.steps[0].point_binding, proposal.steps[0].point_support);
  assert.notEqual(proposal.steps[0].point_binding, proposal.steps[0].point_support);
  assert.equal(proposal.steps[0].point_binding.point, proposal.steps[0].point_support.point, 'Source bind copies its support dictionary shallowly');
});

test('framed-window common wrapper needs positive remaining actions and a deadline only after structural admission', async () => {
  const item = proposalCase(), a = copy(item.arguments), memory = seeded(item.seedEvents);
  assert.equal(await proposeFramedWindowCommon(memory, a.observation, a.rows, a.inputs, 0, a.config, null), null);
  assert.equal(await proposeFramedWindowCommon(memory, { ...a.observation, available_action_refs: [] }, a.rows, a.inputs, 1, a.config, null), null);
  await assert.rejects(() => proposeFramedWindowCommon(memory, a.observation, a.rows, a.inputs, 1, a.config, null), /current level deadline/);
  assert.deepEqual(memory.currentState(), freshFramedWindowMemory());
});
