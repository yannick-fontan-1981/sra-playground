import assert from 'node:assert/strict';
import test from 'node:test';
import { capturePreviewPacking } from './helpers/capture-preview-packing.ts';

type R = Record<string, any>;
function instrument(overrides: R = {}) {
  const events: R[] = [], state = { value: 0 };
  const owner: R = { sourceState: () => structuredClone(state), propose: () => null,
    before: () => ({ admitted: true }), after: () => ({ matched: true }), record: () => null,
    restoreNative: () => {}, restoreSourceState: () => {}, ...overrides };
  capturePreviewPacking(owner as any, events);
  return { owner, events, state };
}

test('passive capture keeps synchronous return and argument identities, with detached evidence', () => {
  const input = { frame: [1] }, output = { admitted: true }; let received: unknown;
  const { owner, events } = instrument({ before(value: unknown) { received = value; return output; } });
  assert.equal(owner.before(input, 0, {}, {}), output);
  assert.equal(received, input); assert.equal(events.length, 1);
  assert.equal(events[0].completion, 'returned'); assert.equal(events[0].returnedNormally, true);
  input.frame.push(2); output.admitted = false;
  assert.deepEqual(events[0].arguments[0], { frame: [1] });
  assert.deepEqual(events[0].result, { admitted: true });
  events[0].arguments[0].frame.push(9);
  assert.deepEqual(input.frame, [1, 2]);
});

test('proposal observer excludes execution capabilities and preserves the original promise', async () => {
  let resolve!: (value: unknown) => void, executionSeen: unknown;
  const promise = new Promise(value => { resolve = value; });
  const { owner, events } = instrument({ propose(...args: unknown[]) { executionSeen = args[4]; return promise; } });
  const execution = { signal: new AbortController().signal, yieldControl: async () => {} };
  const returned = owner.propose({}, [[0]], [], 3, execution);
  assert.equal(returned, promise); assert.equal(executionSeen, execution);
  assert.equal(events[0].completion, 'pending'); assert.equal(events[0].arguments.length, 4);
  const result = { status: 'unknown' }; resolve(result);
  assert.equal(await returned, result);
  assert.equal(events[0].completion, 'resolved'); assert.equal(events[0].depthAfter, 0);
  assert.deepEqual(events[0].observationErrors, []);
});

test('synchronous exceptions retain their identity and are observed once', () => {
  const error = new RangeError('retained refusal'); let calls = 0;
  const { owner, events } = instrument({ before() { calls++; throw error; } });
  assert.throws(() => owner.before({}, 0, {}, {}), value => value === error);
  assert.equal(calls, 1); assert.equal(events.length, 1);
  assert.equal(events[0].completion, 'threw'); assert.equal(events[0].returnedNormally, false);
  assert.equal(events[0].error, 'RangeError: retained refusal'); assert.equal(events[0].depthAfter, 0);
});

test('asynchronous rejection retains the original promise and reason', async () => {
  const error = new Error('cancelled source call'), promise = Promise.reject(error);
  const { owner, events } = instrument({ propose() { return promise; } });
  const returned = owner.propose({}, [], [], 1);
  assert.equal(returned, promise);
  await assert.rejects(returned, value => value === error);
  assert.equal(events[0].completion, 'rejected'); assert.equal(events[0].returnedNormally, false);
  assert.equal(events[0].depthAfter, 0);
});

test('real nested restorations retain invocation order, depths and input identity', () => {
  const incoming = { value: 7 }, state = { value: 0 }; let nativeCalls = 0, sourceCalls = 0;
  const { owner, events } = instrument({ sourceState: () => ({ ...state }),
    restoreNative(value: R) { nativeCalls++; assert.equal(value, incoming); this.restoreSourceState(value); },
    restoreSourceState(value: R) { sourceCalls++; assert.equal(value, incoming); state.value = value.value; } });
  assert.equal(owner.restoreNative(incoming), undefined);
  assert.equal(nativeCalls, 1); assert.equal(sourceCalls, 1);
  assert.deepEqual(events.map(row => [row.sequence, row.method, row.depthBefore, row.depthAfter]),
    [[0, 'restoreNative', 0, 0], [1, 'restoreSourceState', 1, 1]]);
  assert.deepEqual(events[0].sourceBefore, { value: 0 });
  assert.deepEqual(events[0].sourceAfter, { value: 7 });
  assert.deepEqual(events[1].sourceAfter, { value: 7 });
  incoming.value = 8; assert.equal(events[0].arguments[0].value, 7);
});

test('failed state inspection is retained without changing a successful source call', () => {
  const result = { matched: null }; let calls = 0;
  const { owner, events } = instrument({ sourceState() { throw new Error('observer unavailable'); },
    after() { calls++; return result; } });
  assert.equal(owner.after({}, 0, {}, {}, [], []), result);
  assert.equal(calls, 1); assert.equal(events[0].returnedNormally, true);
  assert.deepEqual(events[0].observationErrors.map((row: R) => row.field), ['sourceBefore', 'sourceAfter']);
});

test('captured source arities exclude native-only arguments without altering actual calls', () => {
  const observed: number[] = [], args = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const { owner, events } = instrument(Object.fromEntries(['before', 'after', 'record'].map(method =>
    [method, (...values: unknown[]) => { observed.push(values.length); return null; }])));
  owner.before(...args); owner.after(...args); owner.record(...args);
  assert.deepEqual(observed, [9, 9, 9]);
  assert.deepEqual(events.map(row => row.arguments.length), [4, 6, 8]);
});

test('an uncloneable evidence argument does not prevent or duplicate the actual invocation', () => {
  const arg = () => true; let received: unknown, calls = 0;
  const { owner, events } = instrument({ record(value: unknown) { calls++; received = value; return null; } });
  assert.equal(owner.record(arg), null); assert.equal(received, arg); assert.equal(calls, 1);
  assert.equal(events[0].returnedNormally, true);
  assert.equal(events[0].observationErrors[0].field, 'arguments');
});
