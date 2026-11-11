import assert from 'node:assert/strict';
import test from 'node:test';
import { captureSelectedRigid } from './helpers/capture-selected-rigid.ts';

type R = Record<string, any>;
function instrument(overrides: R = {}) {
  const events: R[] = [], state = { format: 'selected_rigid_events.v1', events: [] as unknown[] };
  const context = { configuration: { compose: 'measured prior', control: 'discriminate', scope: 'public' },
    requestedStopReason: null, levelDeadlineMs: null, remainingLevelActions: null, observedNowMs: null };
  let clockObserver: ((value: number) => void) | null = null;
  const owner: R = { sourceState: () => structuredClone(state), captureContext: () => structuredClone(context),
    attachClockObserver(listener: (value: number) => void) { clockObserver = listener; return () => { clockObserver = null; }; },
    setCurrentBudget: () => {}, propose: () => null, bind: () => {},
    before: () => ({ admitted: true }), after: () => ({ matched: null, seal_prefix: true }),
    record: () => null, restoreNative: () => {}, restoreSourceState: () => {}, ...overrides };
  const capture = captureSelectedRigid(owner as any, events);
  return { owner, events, state, context, capture, clockRead: (value: number) => clockObserver?.(value) };
}

test('SelectedRigid capture preserves input, output, domain and receiver identity', () => {
  const input = { frame: [1] }, output = { admitted: true }, domain = { opaque: () => true };
  let received: unknown, receivedDomain: unknown, receiver: unknown;
  const { owner, events } = instrument({ bind(value: unknown, authority: unknown) {
    received = value; receivedDomain = authority; receiver = this; return output;
  } });
  assert.equal(owner.bind(input, domain), output);
  assert.equal(received, input); assert.equal(receivedDomain, domain); assert.equal(receiver, owner);
  assert.deepEqual(events[0].arguments, [input]); assert.equal(events[0].domainSupplied, true);
  input.frame.push(2); output.admitted = false;
  assert.deepEqual(events[0].arguments, [{ frame: [1] }]);
  assert.deepEqual(events[0].result, { admitted: true });
  assert.deepEqual(events[0].observationErrors, []);
});

test('SelectedRigid capture observes actual budgets without invoking clock or scheduler', async () => {
  let clockCalls = 0, yieldCalls = 0, observedExecution: unknown, observedRemaining: unknown;
  const controller = new AbortController();
  const execution = { now: () => { clockCalls++; return 8; }, yieldControl: async () => { yieldCalls++; },
    deadlineMs: 361000, remainingLevelActions: 17, signal: controller.signal };
  let resolve!: (value: unknown) => void;
  const promise = new Promise(value => { resolve = value; });
  const { owner, events } = instrument({
    setCurrentBudget(value: unknown, remaining: unknown) { observedExecution = value; observedRemaining = remaining; },
    propose(...args: unknown[]) { observedExecution = args[4]; return promise; },
  });
  owner.setCurrentBudget(execution, 17);
  const returned = owner.propose({}, [[0]], [], 3, execution);
  assert.equal(returned, promise); assert.equal(observedExecution, execution); assert.equal(observedRemaining, 17);
  assert.equal(clockCalls, 0); assert.equal(yieldCalls, 0);
  assert.deepEqual(events[0].arguments, [{ deadlineMs: 361000, remainingLevelActions: 17,
    hasNow: true, hasYieldControl: true, hasSignal: true, aborted: false }, 17]);
  assert.deepEqual(events[1].execution, events[0].arguments[0]);
  assert.equal(events[1].arguments.length, 4); assert.equal(events[1].completion, 'pending');
  const result = { status: 'proposed' }; resolve(result);
  assert.equal(await returned, result); assert.equal(events[1].completion, 'resolved');
  assert.equal(clockCalls, 0); assert.equal(yieldCalls, 0);
});

test('SelectedRigid capture keeps a null selected return distinct from a void bind', () => {
  let records = 0;
  const { owner, events } = instrument({ record() { records++; return null; } });
  owner.bind({}, {}); assert.equal(owner.record({}, {}, {}, [], [], {}, 0, []), null);
  assert.equal(records, 1); assert.equal(events[0].resultKind, 'undefined');
  assert.equal(events[1].resultKind, 'null');
  assert.equal(events[0].result, null); assert.equal(events[1].result, null);
  assert.equal(events[1].returnedNormally, true);
});

test('SelectedRigid capture preserves thrown errors and rejected promise identity', async () => {
  const error = new RangeError('cancelled'), promise = Promise.reject(error); let calls = 0;
  const { owner, events } = instrument({ before() { calls++; throw error; }, propose() { return promise; } });
  assert.throws(() => owner.before({}, 0, {}, {}), value => value === error);
  const returned = owner.propose({}, [], [], 1); assert.equal(returned, promise);
  await assert.rejects(returned, value => value === error);
  assert.equal(calls, 1); assert.equal(events[0].completion, 'threw');
  assert.equal(events[1].completion, 'rejected');
  assert.equal(events[0].returnedNormally, false); assert.equal(events[1].returnedNormally, false);
  assert.equal(events[0].depthAfter, 0); assert.equal(events[1].depthAfter, 0);
});

test('SelectedRigid capture preserves real nested binds and restorations', () => {
  const state = { format: 'selected_rigid_events.v1', events: [{ kind: 'observed_selected_rigid' }] };
  const { owner, events } = instrument({ sourceState: () => state,
    before(p: unknown) { this.bind(p, null); return { admitted: true }; },
    restoreNative(value: unknown) { this.restoreSourceState(value); },
  });
  owner.before({}, 0, {}, {}); owner.restoreNative(state);
  assert.deepEqual(events.map(row => [row.sequence, row.method, row.depthBefore, row.depthAfter]),
    [[0, 'before', 0, 0], [1, 'bind', 1, 1], [2, 'restoreNative', 0, 0], [3, 'restoreSourceState', 1, 1]]);
  assert.deepEqual(events[2].sourceBefore, state); assert.deepEqual(events[2].sourceAfter, state);
});

test('SelectedRigid capture observes contexts without acquiring or manufacturing clock values', () => {
  const context: R = { configuration: {}, requestedStopReason: null,
    levelDeadlineMs: 360000, remainingLevelActions: 4, observedNowMs: null };
  const { owner, events, state } = instrument({ captureContext: () => context,
    propose() { context.observedNowMs = 900; context.requestedStopReason = 'rigid_direction_domain_incomplete'; return null; } });
  owner.propose({}, [], [], 4);
  assert.equal(events[0].contextBefore.observedNowMs, null);
  assert.equal(events[0].contextAfter.observedNowMs, 900);
  assert.equal(events[0].contextAfter.requestedStopReason, 'rigid_direction_domain_incomplete');
  assert.deepEqual(state.events, []); assert.deepEqual(events[0].sourceBefore, events[0].sourceAfter);
});

test('SelectedRigid capture cannot attach twice or partially attach to an incomplete owner', () => {
  const { owner, events } = instrument();
  assert.throws(() => captureSelectedRigid(owner as any, []), /already has/);
  assert.equal(events.length, 0);
  const incomplete: R = { sourceState: () => ({}), captureContext: () => ({}), propose: () => null };
  const original = incomplete.propose;
  assert.throws(() => captureSelectedRigid(incomplete as any, []), /Missing SelectedRigid/);
  assert.equal(incomplete.propose, original);
});

test('SelectedRigid observation failures do not suppress or repeat a physical acquisition', () => {
  let calls = 0; const result = { events: [] };
  const { owner, events } = instrument({ sourceState() { throw new Error('state unavailable'); },
    captureContext() { throw new Error('context unavailable'); }, record() { calls++; return result; } });
  assert.equal(owner.record({}, {}, {}, [], [], {}, 0, []), result); assert.equal(calls, 1);
  assert.equal(events[0].returnedNormally, true);
  assert.deepEqual(events[0].observationErrors.map((row: R) => row.field),
    ['sourceBefore', 'contextBefore', 'sourceAfter', 'contextAfter']);
});

test('SelectedRigid capture preserves all actual arguments while recording source arities', () => {
  const lengths: number[] = [], args = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const { owner, events } = instrument(Object.fromEntries(['before', 'after', 'record'].map(method =>
    [method, (...values: unknown[]) => { lengths.push(values.length); return null; }])));
  owner.before(...args); owner.after(...args); owner.record(...args);
  assert.deepEqual(lengths, [9, 9, 9]); assert.deepEqual(events.map(row => row.arguments.length), [4, 6, 8]);
});

test('SelectedRigid capture journals only already-consumed clock reads, including missing scope', () => {
  let callback!: (value: number) => void, clockCalls = 0;
  const context: R = { configuration: {}, requestedStopReason: null,
    levelDeadlineMs: 360000, remainingLevelActions: 4, observedNowMs: null };
  const { owner, events, capture } = instrument({ captureContext: () => context,
    attachClockObserver(listener: (value: number) => void) { callback = listener; return () => {}; },
    before(p: unknown) { this.bind(p, null); clockCalls++; context.observedNowMs = 123; callback(123); return { admitted: true }; },
  });
  assert.equal(clockCalls, 0); owner.before({}, 0, {}, {}); assert.equal(clockCalls, 1);
  assert.deepEqual(events[0].clockReads, [123]); assert.deepEqual(events[1].clockReads, []);
  assert.equal(events[0].contextAfter.observedNowMs, 123);
  callback(124); assert.deepEqual(capture.unscopedClockReads, [124]);
});
