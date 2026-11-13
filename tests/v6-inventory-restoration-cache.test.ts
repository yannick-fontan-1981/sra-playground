import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { ObservedInventory } from '../src/logos-engine/v6-observed-inventory.ts';
import { InventoryCallerContext } from '../src/logos-engine/v6-inventory-caller-context.ts';
import { CellProjection } from '../src/logos-engine/v6-inventory-project.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-inventory-family-reference.json.gz', import.meta.url))).toString()) as R;
const seed = fixture.cases.find((row: R) => row.id === 'current_display_preservation').seedState;
const meterState = fixture.meterCases.find((row: R) => row.id === 'constant_loss:False:False').values.at(-1).state;
const collectionState = fixture.collectionCases.find((row: R) => row.id === 'gain_on_anchored_entry').afterState;

async function seeded(withCaller = true): Promise<ObservedInventory> {
  const family = await ObservedInventory.create(); family.restore(structuredClone(seed));
  if (withCaller) {
    family.enableCallerContext(() => []);
    const caller = (family as unknown as R).callerContext as InventoryCallerContext;
    caller.meter.restore(structuredClone(meterState)); caller.collection.restore(structuredClone(collectionState));
  }
  return family;
}

test('unchanged inventory checkpoints and recall avoid reserializing mutable source and caller state', async context => {
  const family = await seeded(), state = family.nativeState(), revision = family.nativeRevision;
  const clone = structuredClone;
  const observed = context.mock.method(globalThis, 'structuredClone', function <T>(value: T): T { return clone(value); });
  for (let i = 0; i < 4; i++) {
    assert.equal(family.nativeState(), state); family.restoreNative(state); assert.equal(family.nativeRevision, revision);
  }
  assert.equal(observed.mock.callCount(), 0, 'Exact unchanged working values need no detached state copies on internal checkpoint/recall');
  const publicState = family.state();
  assert.ok(observed.mock.callCount() > 0, 'The source-facing state API still produces a detached copy');
  publicState.tracker.controls.ACTION4.delta[0]++;
  assert.notDeepEqual(publicState, family.state()); assert.equal(family.nativeState(), state);
});

const sourceMutations: [string, (family: ObservedInventory) => void][] = [
  ['tracker nested control', family => { family.tracker.controls.ACTION4.delta[0]++; }],
  ['seen pairs', family => { family.seen_pairs[0]!.target_bbox[0]++; }],
  ['failed command', family => { family.failed.push('synthetic:direct-refusal'); }],
  ['access returns', family => { family.access_returns.push({ status: 'synthetic:direct-return' }); }],
  ['endpoint memory', family => { family.endpoint_memory[0]!.route_actions.push('ACTION1'); }],
  ['boundary memory', family => { family.boundary_memory = { active: true }; }],
  ['pending access', family => { family.pending_access = { status: 'synthetic:pending' }; }],
  ['retained effect scope', family => { family.retained_effect_scope = { status: 'synthetic:effect' }; }],
  ['tracker Map entry content', family => { family.tracker.underlays.values().next().value!.patch[0][0]++; }],
  ['tracker Map membership', family => { family.tracker.underlays.delete(family.tracker.underlays.keys().next().value!); }],
  ['equal-size Map replacement', family => {
    const map = family.tracker.underlays, [key, value] = [...map][0]!;
    map.delete(key); map.set('90,91,92,93', value);
  }],
];
for (const [name, mutate] of sourceMutations) test(`inventory checkpoint detects ${name} and restores authoritative values`, async () => {
  const family = await seeded(), checkpoint = family.nativeState(), revision = family.nativeRevision;
  mutate(family); const expected = family.state(), next = family.nativeState();
  assert.notEqual(next, checkpoint); assert.deepEqual(next.source_state, expected); assert.equal(family.nativeRevision, revision + 1);
  family.restoreNative(checkpoint); assert.equal(family.nativeState(), checkpoint); assert.deepEqual(family.state(), checkpoint.source_state);
});

const callerMutations: [string, (context: InventoryCallerContext) => void][] = [
  ['meter frame pixel', context => { context.meter.previous_rows![0]![0]++; }],
  ['meter nested recent Map', context => {
    const map = context.meter.recent[0]![1], key = map.keys().next().value!; map.set(key, map.get(key)! + 1);
  }],
  ['meter hypothesis tuple', context => { context.meter.hypotheses.values().next().value![0]++; }],
  ['meter Map membership', context => { context.meter.peaks.clear(); }],
  ['collection retained event', context => { Object.values(context.collection.history)[0]!.epoch++; }],
];
for (const [name, mutate] of callerMutations) test(`inventory caller annex detects ${name} and restores from the retained checkpoint`, async () => {
  const family = await seeded(), checkpoint = family.nativeState(), revision = family.nativeRevision;
  mutate((family as unknown as R).callerContext); const expected = family.callerContextState(), next = family.nativeState();
  assert.notEqual(next, checkpoint); assert.deepEqual(next.caller_context, expected); assert.equal(family.nativeRevision, revision + 1);
  family.restoreNative(checkpoint); assert.equal(family.nativeState(), checkpoint); assert.deepEqual(family.callerContextState(), checkpoint.caller_context);
});

test('a direct working mutation is not hidden by recalling the identical previously accepted checkpoint', async () => {
  const family = await seeded(), checkpoint = family.nativeState(); family.restoreNative(checkpoint);
  family.tracker.controls.ACTION4.evidence.push(['synthetic:forged-before', 'synthetic:forged-after']);
  (family as unknown as R).callerContext.meter.previous_rows[0][0]++;
  family.restoreNative(checkpoint);
  assert.deepEqual(family.state(), checkpoint.source_state); assert.deepEqual(family.callerContextState(), checkpoint.caller_context);
  assert.equal(family.nativeState(), checkpoint);
});

test('source numeric equality still determines revision when a working witness changes', async () => {
  const family = await seeded(false); family.boundary_memory = { active: false, offset: -0 };
  const checkpoint = family.nativeState(), revision = family.nativeRevision;
  family.boundary_memory.active = 0; family.boundary_memory.offset = 0;
  assert.equal(family.nativeState(), checkpoint); assert.equal(family.nativeRevision, revision);
  family.restoreNative(checkpoint);
  assert.equal(family.boundary_memory.active, 0, 'The legacy Python-equal early return does not overwrite the mutable working representation');
  assert.ok(Object.is(family.boundary_memory.offset, 0));
});

test('frozen outer arrays cannot conceal mutable descendants from checkpoint validation', async () => {
  const family = await seeded(false);
  family.seen_pairs = Object.freeze(family.seen_pairs) as unknown as R[];
  const checkpoint = family.nativeState(); family.seen_pairs[0]!.target_bbox[0]++;
  assert.notEqual(family.nativeState(), checkpoint);
  family.restoreNative(checkpoint); assert.deepEqual(family.state(), checkpoint.source_state);
});

test('a Map iterator replaced after certification cannot hide a changed source projection', async () => {
  const family = await seeded(false), checkpoint = family.nativeState(), map = family.tracker.underlays;
  const entries = Map.prototype.entries;
  Object.defineProperty(map, Symbol.iterator, { configurable: true, value: function* (this: Map<string, R>) {
    for (const [key, value] of entries.call(this)) yield [key, { ...value, synthetic_projection: 'changed' }];
  } });
  const next = family.nativeState(); assert.notEqual(next, checkpoint);
  assert.ok(next.source_state.tracker.underlays.every(([, value]: [unknown, R]) => value.synthetic_projection === 'changed'));
  family.restoreNative(checkpoint); assert.equal(family.nativeState(), checkpoint);
});

test('a stable customized Map iterator is not assumed to be a pure source projection', async () => {
  const family = await seeded(false), map = family.tracker.underlays, entries = Map.prototype.entries; let version = 0;
  Object.defineProperty(map, Symbol.iterator, { configurable: true, value: function* (this: Map<string, R>) {
    const current = ++version;
    for (const [key, value] of entries.call(this)) yield [key, { ...value, synthetic_projection: current }];
  } });
  const first = family.nativeState(), second = family.nativeState();
  assert.notEqual(first, second); assert.notDeepEqual(first.source_state, second.source_state);
});

test('a detached Map inherited iterator cannot certify a closure-dependent inventory projection', async () => {
  const family = await seeded(false), checkpoint = family.nativeState(), map = family.tracker.underlays;
  const entries = Map.prototype.entries; let version = 0;
  Object.setPrototypeOf(map, { [Symbol.iterator]: function* (this: Map<string, R>) {
    const current = ++version;
    for (const [key, value] of entries.call(this)) yield [key, { ...value, synthetic_detached_projection: current }];
  } });
  assert.equal(map instanceof Map, false, 'The working object still has Map slots but no longer inherits Map.prototype');
  const first = family.nativeState(), second = family.nativeState();
  assert.notEqual(first, checkpoint);
  assert.notEqual(second, first, 'Inherited iterator closures must be reevaluated by the source projection');
  assert.notDeepEqual(first.source_state, second.source_state);
  family.restoreNative(checkpoint);
  assert.ok(family.tracker.underlays instanceof Map);
  assert.equal(family.nativeState(), checkpoint);
  assert.deepEqual(family.state(), checkpoint.source_state);
});

test('a customized caller-array mapper cannot certify a closure-dependent projection', async () => {
  const family = await seeded(), checkpoint = family.nativeState();
  const recent = ((family as unknown as R).callerContext as InventoryCallerContext).meter.recent;
  const map = Array.prototype.map; let version = 0;
  Object.defineProperty(recent, 'map', { configurable: true, value: function (this: unknown[], callback: (value: unknown, index: number, array: unknown[]) => unknown): unknown[] {
    const current = ++version;
    return map.call(this, callback).map(([ref, values]: any) => [`${ref}:projection:${current}`, values]);
  } });
  const first = family.nativeState(), second = family.nativeState();
  assert.notEqual(first, checkpoint); assert.notEqual(first, second); assert.notDeepEqual(first.caller_context, second.caller_context);
  family.restoreNative(checkpoint); assert.equal(family.nativeState(), checkpoint);
});

test('source field getters use the existing serialization path and remain observable', async () => {
  const family = await seeded(false), failed = family.failed; let reads = 0;
  Object.defineProperty(family, 'failed', { configurable: true, enumerable: true, get: () => { reads++; return failed; } });
  const checkpoint = family.nativeState(), firstReads = reads;
  assert.equal(family.nativeState(), checkpoint); assert.ok(reads > firstReads);
  failed.push('synthetic:getter-refusal'); assert.notEqual(family.nativeState(), checkpoint);
});

test('custom source projection methods retain their original uncached behavior', async () => {
  const family = await seeded(false), original = family.state.bind(family); let calls = 0;
  family.state = () => ({ ...original(), failed: [`synthetic:projection:${++calls}`] });
  const first = family.nativeState(), second = family.nativeState();
  assert.notEqual(first, second); assert.notDeepEqual(first.source_state, second.source_state);
  assert.equal(calls, 2, 'A stable function identity does not prove a customized projection is pure');
});

test('replacing a tracker projection after certification cannot reuse the old source checkpoint', async () => {
  const family = await seeded(false), checkpoint = family.nativeState(); let calls = 0;
  const original = CellProjection.prototype.state;
  family.tracker.state = function (): R {
    const own = Object.getOwnPropertyDescriptor(this, 'state');
    delete (this as R).state;
    try { return { ...original.call(this), initial_ref: `synthetic:projection:${++calls}` }; }
    finally { Object.defineProperty(this, 'state', own!); }
  };
  const next = family.nativeState(); assert.notEqual(next, checkpoint);
  assert.notEqual(family.nativeState(), next); assert.equal(calls, 2);
});

test('a mutable property changing enumerability invalidates the serialized tracker view', async () => {
  const family = await seeded(false); (family.tracker as R).synthetic_annotation = { label: 'visible' };
  const checkpoint = family.nativeState();
  Object.defineProperty(family.tracker, 'synthetic_annotation', { enumerable: false });
  const next = family.nativeState(); assert.notEqual(next, checkpoint); assert.equal(Object.hasOwn(next.source_state.tracker, 'synthetic_annotation'), false);
});

test('replacing a working owner with equal values is conservative and preserves effective revision', async () => {
  const family = await seeded(), checkpoint = family.nativeState(), revision = family.nativeRevision;
  const tracker = new CellProjection(); tracker.restore(structuredClone(checkpoint.source_state.tracker)); family.tracker = tracker;
  const caller = new InventoryCallerContext(); caller.restore(structuredClone(checkpoint.caller_context)); (family as unknown as R).callerContext = caller;
  assert.equal(family.nativeState(), checkpoint); assert.equal(family.nativeRevision, revision);
});

test('malformed caller or source restoration remains atomic after a certified cache hit', async () => {
  const family = await seeded(), checkpoint = family.nativeState(), revision = family.nativeRevision; family.restoreNative(checkpoint);
  for (const mutate of [
    (value: R) => { value.source_state.failed = [7]; },
    (value: R) => { value.caller_context.meter.recent = {}; },
    (value: R) => { value.caller_context.collection.events = [null]; },
  ]) {
    const rejected = structuredClone(checkpoint); mutate(rejected); assert.throws(() => family.restoreNative(rejected));
    assert.equal(family.nativeState(), checkpoint); assert.equal(family.nativeRevision, revision);
    assert.deepEqual(family.state(), checkpoint.source_state); assert.deepEqual(family.callerContextState(), checkpoint.caller_context);
  }
});

test('a rejected caller annex never publishes the already prepared inventory owners', async () => {
  const family = await seeded(), checkpoint = family.nativeState(), revision = family.nativeRevision;
  const tracker = family.tracker, pairs = family.seen_pairs, endpoints = family.endpoint_memory;
  const caller = (family as unknown as R).callerContext;
  const rejected = structuredClone(checkpoint);
  rejected.source_state.tracker.controls.ACTION4.delta[0] += 50;
  rejected.source_state.seen_pairs[0].target_bbox[0] += 50;
  rejected.source_state.endpoint_memory[0].route_actions.push('ACTION2');
  rejected.caller_context.collection.events = [null];
  assert.throws(() => family.restoreNative(rejected), /Invalid collection checkpoint/);
  assert.equal(family.tracker, tracker); assert.equal(family.seen_pairs, pairs);
  assert.equal(family.endpoint_memory, endpoints); assert.equal((family as unknown as R).callerContext, caller);
  assert.equal(family.nativeState(), checkpoint); assert.equal(family.nativeRevision, revision);
  assert.deepEqual(family.state(), checkpoint.source_state); assert.deepEqual(family.callerContextState(), checkpoint.caller_context);
});

test('prepared source and native restores preserve detached inputs, snapshots and working owners', async () => {
  const family = await seeded(), checkpoint = family.nativeState(), revision = family.nativeRevision;
  const input = structuredClone(checkpoint), oldTracker = family.tracker;
  family.restoreNative(input);
  const accepted = family.nativeState();
  assert.notEqual(family.tracker, oldTracker); assert.equal(family.nativeRevision, revision);
  input.source_state.tracker.controls.ACTION4.delta[0]++;
  input.source_state.seen_pairs[0].target_bbox[0]++;
  input.caller_context.meter.previous_rows[0][0]++;
  assert.deepEqual(family.state(), accepted.source_state); assert.deepEqual(family.callerContextState(), accepted.caller_context);
  const publicSource = family.state(), publicCaller = family.callerContextState()!;
  publicSource.tracker.controls.ACTION4.delta[0]++;
  publicSource.endpoint_memory[0].route_actions.push('ACTION3'); publicCaller.meter.previous_rows[0][0]++;
  assert.equal(family.nativeState(), accepted);
  const sourceInput = structuredClone(accepted.source_state), expected = structuredClone(sourceInput);
  family.restore(sourceInput);
  sourceInput.tracker.controls.ACTION4.delta[0]++; sourceInput.seen_pairs[0].target_bbox[0]++;
  assert.deepEqual(family.state(), expected);
  family.tracker.controls.ACTION4.delta[0]++;
  assert.notDeepEqual(family.state(), expected); assert.deepEqual(accepted.source_state, expected);
});

test('a customized inventory restore still receives the native source and can transform it', async context => {
  const family = await seeded(), checkpoint = family.nativeState(), original = family.restore;
  const restored = context.mock.method(family, 'restore', function (this: ObservedInventory, value: R): void {
    original.call(this, value); this.failed.push('synthetic:custom-restore');
  });
  family.restoreNative(structuredClone(checkpoint));
  assert.equal(restored.mock.callCount(), 1);
  assert.deepEqual(restored.mock.calls[0]!.arguments[0], checkpoint.source_state);
  assert.deepEqual(family.failed, [...checkpoint.source_state.failed, 'synthetic:custom-restore']);
  assert.deepEqual(family.nativeState().source_state.failed, family.failed);
});

test('customized CellProjection restoration retains the original three dynamic calls', async context => {
  const family = await seeded(), checkpoint = family.nativeState(), original = CellProjection.prototype.restore;
  let calls = 0;
  context.mock.method(CellProjection.prototype, 'restore', function (this: CellProjection, value: R): void {
    original.call(this, value); (this as unknown as R).synthetic_restore_pass = ++calls;
  });
  family.restoreNative(structuredClone(checkpoint));
  assert.equal(calls, 3);
  assert.equal((family.tracker as unknown as R).synthetic_restore_pass, 3);
  assert.equal(family.nativeState().source_state.tracker.synthetic_restore_pass, 3);
});

const normalizedInputs: [string, (state: R) => void][] = [
  ['an incomplete tracker', state => { state.source_state.tracker = {}; }],
  ['duplicate tracker underlays', state => {
    const [key, value] = state.source_state.tracker.underlays[0];
    state.source_state.tracker.underlays.push([key, { ...value, synthetic_last_entry: true }]);
  }],
  ['duplicate caller meter entries', state => {
    const [key, value] = state.caller_context.meter.peaks[0];
    state.caller_context.meter.peaks.push([key, value + 1]);
  }],
];
for (const [name, mutate] of normalizedInputs) test(`native restoration projects ${name} before checkpoint certification`, async () => {
  const family = await seeded(), checkpoint = family.nativeState(), revision = family.nativeRevision;
  const input = structuredClone(checkpoint); mutate(input);
  family.restoreNative(input);
  const source = family.state(), caller = family.callerContextState();
  assert.ok(JSON.stringify(source) !== JSON.stringify(input.source_state)
    || JSON.stringify(caller) !== JSON.stringify(input.caller_context), 'The accepted source restorer normalizes this input');
  const normalized = family.nativeState();
  assert.deepEqual(normalized.source_state, source);
  assert.deepEqual(normalized.caller_context, caller);
  assert.equal(family.nativeRevision, revision + 2, 'The accepted input and its subsequently projected normalization each retain the existing effective revision transition');
  assert.equal(family.nativeState(), normalized);
});

test('planning-only fields do not become persisted state or create a new checkpoint revision', async () => {
  const family = await seeded(), checkpoint = family.nativeState(), revision = family.nativeRevision;
  family.selected = { synthetic: true }; family.context.push({ synthetic: true }); family.measured = { options: [{ synthetic: true }] };
  assert.equal(family.nativeState(), checkpoint); assert.equal(family.nativeRevision, revision);
});
