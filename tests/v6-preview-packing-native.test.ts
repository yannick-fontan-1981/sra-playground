import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { NativePreviewPacking, PREVIEW_PACKING_STATE_SCHEMA } from '../src/logos-engine/v6-preview-packing.ts';
import { previewPackingAssignments, previewPackingLimits, PREVIEW_PACKING_LIMITS, PreviewPackingIncomplete } from '../src/logos-engine/v6-preview-packing-calculus.ts';
import { previewPackingDictPointSet } from '../src/logos-engine/v6-preview-packing-geometry.ts';
import type { NativeRecord } from '../src/logos-engine/v6-native-types.ts';

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-preview-packing/reference.json.gz', import.meta.url))).toString('utf8'));
const clone = <T>(value: T): T => structuredClone(value);
const initial = fixture.initial[0], learned = fixture.sessions[0].steps[2];
const restore = (source: NativeRecord): NativePreviewPacking => { const owner = new NativePreviewPacking(); owner.restoreSourceState(clone(source)); return owner; };
const deepFrozen = (value: any): boolean => value === null || typeof value !== 'object' || Object.isFrozen(value) && Object.values(value).every(deepFrozen);

test('native checkpoint owns exactly the four source fields inside the explicit schema', () => {
  const owner = new NativePreviewPacking(), native = owner.nativeState();
  assert.deepEqual(Object.keys(native).sort(), ['schema', 'packing_events', 'packing_model', 'packing_controls', '_packing_scene_cache'].sort());
  assert.equal(native.schema, PREVIEW_PACKING_STATE_SCHEMA);
  assert.deepEqual(owner.sourceState(), { packing_events: [], packing_model: null, packing_controls: {}, _packing_scene_cache: {} });
  assert.equal(owner.hasRetainedModel(), false);
  assert.equal(deepFrozen(native), true);
  assert.strictEqual(owner.nativeState(), native);
});

test('cached abstention is retained for its epoch without inventing a new observation', async () => {
  const row = fixture.initial.find((r: any) => r.id === 'broken-frame-ring'), owner = new NativePreviewPacking();
  const empty = owner.nativeState();
  assert.equal(await owner.propose(row.observation, row.public.frame_rows, row.inputs, row.remaining), null);
  const cached = owner.nativeState(); assert.notStrictEqual(cached, empty);
  assert.equal(cached._packing_scene_cache[String(row.observation.level_epoch)], null);
  assert.equal(await owner.propose(initial.observation, initial.public.frame_rows, initial.inputs, initial.remaining), null);
  assert.strictEqual(owner.nativeState(), cached);
});

test('CPython dictionary construction preserves the source five-cell pop order', () => {
  const table = previewPackingDictPointSet([[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]]), result = [];
  while (table.size) result.push(table.pop());
  assert.deepEqual(result, [[0, 1], [0, 2], [0, 4], [0, 0], [0, 3]]);
});

test('native checkpoint restoration preserves a learned multi-action source decision', async () => {
  const owner = restore(learned.stateBefore), saved = owner.state(), restored = new NativePreviewPacking();
  restored.restore(saved);
  assert.equal(restored.hasRetainedModel(), true);
  assert.deepEqual(restored.sourceState(), learned.stateBefore);
  assert.deepEqual(await restored.propose(learned.beforeObservation, learned.beforePublic.frame_rows, learned.inputs, learned.remaining), learned.proposal);
  assert.deepEqual(restored.sourceState(), learned.stateAfterPropose);
  assert.equal(restored.retainedDigest(), owner.retainedDigest());
});

test('foreign mutable state and exported state are detached from the authoritative owner', () => {
  const owner = restore(learned.stateBefore), checkpoint = owner.state(), restored = new NativePreviewPacking();
  restored.restoreNative(checkpoint);
  checkpoint.packing_model!.pieces[0]!.anchor = [999, 999]; checkpoint.packing_events.length = 0;
  assert.deepEqual(restored.sourceState(), learned.stateBefore);
  const output = restored.sourceState(); output.packing_controls = {}; output.packing_model!.tried.length = 0;
  assert.deepEqual(restored.sourceState(), learned.stateBefore);
});

test('identity and value restore fast paths preserve source fields and immutable ownership', () => {
  const owner = restore(learned.stateBefore), retained = owner.nativeState();
  owner.restoreNative(retained); assert.strictEqual(owner.nativeState(), retained);
  owner.restoreNative(clone(retained)); const fresh = owner.nativeState();
  assert.deepEqual(owner.sourceState(), learned.stateBefore); assert.equal(deepFrozen(fresh), true);
  assert.strictEqual(owner.nativeState(), fresh);
});

test('restoring an empty checkpoint actually removes a previous acquired model', () => {
  const owner = restore(learned.stateBefore); assert.equal(owner.hasRetainedModel(), true);
  const empty = new NativePreviewPacking().nativeState(); owner.restoreNative(empty);
  assert.equal(owner.hasRetainedModel(), false); assert.deepEqual(owner.sourceState(), new NativePreviewPacking().sourceState());
});

test('source restoration recreates only present source fields and normalizes decimal cache keys', () => {
  const model = clone(initial.state._packing_scene_cache[String(initial.observation.level_epoch)]);
  const owner = restore(learned.stateBefore); owner.restoreSourceState({ _packing_scene_cache: { '0002': model } });
  assert.deepEqual(owner.sourceState(), { packing_events: [], packing_model: null, packing_controls: {}, _packing_scene_cache: { '2': model } });
});

const corruptions: [string, (value: any) => void][] = [
  ['schema', v => { v.schema = 'native.preview_packing.v0'; }],
  ['missing source field', v => { delete v.packing_controls; }],
  ['unexpected envelope field', v => { v.learnedTerminalLaw = true; }],
  ['noninteger epoch', v => { v.packing_model.epoch = 1.5; }],
  ['duplicate piece identity', v => { v.packing_model.pieces[1].id = v.packing_model.pieces[0].id; }],
  ['duplicate full-mask cell', v => { v.packing_model.pieces[0].mask.push(v.packing_model.pieces[0].mask[0]); }],
  ['unnormalized full mask', v => { v.packing_model.pieces[0].mask = v.packing_model.pieces[0].mask.map(([y, x]: number[]) => [y + 1, x]); }],
  ['unknown selected owner', v => { v.packing_model.selected = 'missing-piece'; }],
  ['board outside current world', v => { v.packing_model.board.push([999, 999]); }],
  ['unsupported learned transform', v => { v.packing_controls.EXTRA = { kind: 'transform', transform: 'invented', evidence: [] }; }],
  ['nonunit learned translation', v => { v.packing_controls.EXTRA = { kind: 'translation', delta: [2, 0], evidence: [] }; }],
  ['cache epoch spelling', v => { v._packing_scene_cache['not-an-epoch'] = null; }],
  ['event owner kind', v => { v.packing_events[0].kind = 'foreign_event'; }],
  ['source trial mask shape', v => { v.packing_model.tried.push({ action: 'ACTION1', pose: [[0, 0], []] }); }],
  ['palette outside public domain', v => { v.packing_model.preview_color = 256; }],
  ['nonfinite retained value', v => { v.packing_model.q = Number.NaN; }],
];
for (const [label, mutate] of corruptions) test(`native restore rejects ${label} atomically`, () => {
  const owner = restore(learned.stateBefore), before = owner.nativeState(), candidate = clone(before); mutate(candidate);
  assert.throws(() => owner.restoreNative(candidate));
  assert.strictEqual(owner.nativeState(), before); assert.deepEqual(owner.sourceState(), learned.stateBefore);
});

test('native restore does not execute foreign getters or admit cyclic state', () => {
  const owner = restore(learned.stateBefore), before = owner.nativeState(), candidate: any = owner.state(); let getterCalls = 0;
  Object.defineProperty(candidate, 'packing_model', { enumerable: true, get() { getterCalls++; return null; } });
  assert.throws(() => owner.restoreNative(candidate), /enumerable data properties/); assert.equal(getterCalls, 0);
  const cyclic: any = owner.state(); cyclic.packing_events.push(cyclic);
  assert.throws(() => owner.restoreNative(cyclic), /Cyclic/); assert.strictEqual(owner.nativeState(), before);
});

test('selected acquisition creates a new checkpoint while all earlier snapshots remain unchanged', () => {
  const row = fixture.sessions[0].steps[1], owner = restore(row.stateAfterPropose), before = owner.nativeState(), immutableBefore = clone(before);
  const event = owner.record(row.beforeObservation, row.afterObservation, row.command, row.beforePublic.frame_rows, row.afterPublic.frame_rows, row.boundProposal, 0);
  assert.deepEqual(event, row.record); assert.deepEqual(owner.sourceState(), row.stateAfter);
  assert.notStrictEqual(owner.nativeState(), before); assert.deepEqual(before, immutableBefore);
  event!.events[0]!.model.evidence.length = 0;
  assert.deepEqual(owner.sourceState(), row.stateAfter);
});

test('a foreign return cannot acquire a Preview event or change its current checkpoint', () => {
  const owner = restore(learned.stateBefore), before = owner.nativeState();
  assert.equal(owner.record(learned.beforeObservation, learned.afterObservation, learned.command,
    learned.beforePublic.frame_rows, learned.afterPublic.frame_rows, null), null);
  assert.strictEqual(owner.nativeState(), before);
});

test('an epoch boundary returns the source empty event without resetting learned controls', () => {
  const row = fixture.sessions[0].steps.find((s: any) => s.record?.boundary), owner = restore(row.stateAfterPropose), before = owner.nativeState();
  assert.deepEqual(owner.record(row.beforeObservation, row.afterObservation, row.command, row.beforePublic.frame_rows, row.afterPublic.frame_rows, row.boundProposal, 0), row.record);
  assert.strictEqual(owner.nativeState(), before); assert.deepEqual(owner.sourceState(), row.stateAfter);
});

test('known source transport respects remaining actions and exact paired projections', async () => {
  const owner = restore(learned.stateBefore), proposal = await owner.propose(learned.beforeObservation, learned.beforePublic.frame_rows, learned.inputs, 2);
  assert.ok(proposal && proposal.status === 'proposed');
  assert.deepEqual(proposal.actions, learned.proposal.actions.slice(0, 2));
  assert.deepEqual(proposal.preview_packing_plan.expected, learned.proposal.preview_packing_plan.expected.slice(0, 2));
  assert.equal(proposal.steps.length, 2); assert.equal(proposal.preview_packing_plan.before_poses.length, 2);
  assert.equal(Object.hasOwn(proposal.actions[0]!, 'data'), false);
});

for (const [name, expected] of [['nodeBound', 'NODE_BOUND'], ['domainBound', 'WORLD_DOMAIN_BOUND'],
  ['depthBound', 'PARTITION_RECURSION_DEPTH_BOUND'], ['timeBoundMs', 'TIME_BOUND']] as const) {
  test(`exhausted ${name} returns an explicit blocked unknown without a partial plan`, async () => {
    const owner = new NativePreviewPacking({ limits: { [name]: 0 } });
    const result = await owner.propose(initial.observation, initial.public.frame_rows, initial.inputs, initial.remaining);
    assert.ok(result && result.status === 'unknown'); assert.equal(result.block_unrelated_probe, true);
    assert.equal(result.native_incomplete?.cause, expected); assert.equal(Object.hasOwn(result, 'actions'), false);
    assert.deepEqual(owner.sourceState().packing_events, []); assert.equal(owner.hasRetainedModel(), false);
  });
}

test('transport-state exhaustion blocks without releasing an unfinished path or fallback probe', async () => {
  const owner = new NativePreviewPacking({ limits: { transportStates: 1 } }); owner.restoreSourceState(learned.stateBefore);
  const before = owner.nativeState(), result = await owner.propose(learned.beforeObservation, learned.beforePublic.frame_rows, learned.inputs, learned.remaining);
  assert.ok(result && result.status === 'unknown'); assert.equal(result.native_incomplete?.cause, 'PREVIEW_TRANSPORT_STATE_BOUND');
  assert.equal(Object.hasOwn(result, 'actions'), false); assert.strictEqual(owner.nativeState(), before);
});

test('an already-aborted request leaves source memory untouched and blocks unrelated routing', async () => {
  const controller = new AbortController(); controller.abort(); const owner = new NativePreviewPacking(), before = owner.nativeState();
  const result = await owner.propose(initial.observation, initial.public.frame_rows, initial.inputs, initial.remaining,
    { signal: controller.signal, yieldControl: async () => {} });
  assert.ok(result && result.status === 'unknown'); assert.equal(result.native_incomplete?.cause, 'aborted');
  assert.strictEqual(owner.nativeState(), before);
});

test('the active request deadline is checked before any source measurement', async () => {
  const owner = new NativePreviewPacking(), before = owner.nativeState();
  const result = await owner.propose(initial.observation, initial.public.frame_rows, initial.inputs, initial.remaining,
    { deadlineMs: 10, now: () => 10, yieldControl: async () => {} });
  assert.ok(result && result.status === 'unknown'); assert.equal(result.native_incomplete?.cause, 'deadline');
  assert.strictEqual(owner.nativeState(), before);
});

test('finite-domain construction yields and observes cancellation before publishing assignments', async () => {
  const model = clone(fixture.helpers.assignments[0].model);
  model.board = Array.from({ length: 4 }, (_, y) => Array.from({ length: 10 }, (_, x) => [y, x])).flat();
  model.world = Array.from({ length: 4 }, (_, y) => Array.from({ length: 50 }, (_, x) => [y, x])).flat();
  model.pieces = Array.from({ length: 20 }, (_, i) => ({ id: `piece:${i}`, color: i + 20,
    mask: [[0, 0], [0, 1]], anchor: [i % 4, 10 + 2 * Math.floor(i / 4)], movable: true }));
  const controller = new AbortController(); let yields = 0;
  await assert.rejects(() => previewPackingAssignments(model, { signal: controller.signal,
    yieldControl: async () => { yields++; controller.abort(); } }), (error: unknown) => error instanceof PreviewPackingIncomplete && error.cause === 'aborted');
  assert.equal(yields, 1);
});

for (const [name, amount] of Object.entries(PREVIEW_PACKING_LIMITS)) test(`a host cannot enlarge the source ${name} budget`, () => {
  assert.throws(() => previewPackingLimits({ [name]: amount + 1 }), /enlarged/);
  assert.throws(() => previewPackingLimits({ [name]: -1 }), /Invalid/);
});

test('the checked search limits cannot be enlarged while a cooperative request is in flight', () => {
  const owner = new NativePreviewPacking();
  assert.equal(Object.isFrozen(owner.limits), true);
  assert.throws(() => { (owner.limits as any).transportStates = 1000000; }, TypeError);
  assert.equal(owner.limits.transportStates, PREVIEW_PACKING_LIMITS.transportStates);
});

test('learned command identifiers are dictionary keys, including a JavaScript prototype spelling', () => {
  const row = fixture.sessions[0].steps[1], owner = restore(row.stateAfterPropose);
  const command = { ...clone(row.command), action_ref: '__proto__' };
  owner.record(row.beforeObservation, row.afterObservation, command, row.beforePublic.frame_rows, row.afterPublic.frame_rows, row.boundProposal, 0);
  const controls = owner.sourceState().packing_controls;
  assert.equal(Object.hasOwn(controls, '__proto__'), true);
  assert.equal(controls['__proto__']!.kind, 'translation');
  assert.strictEqual(Object.getPrototypeOf(controls), Object.prototype);
  const restored = new NativePreviewPacking(); restored.restore(owner.state());
  assert.deepEqual(restored.sourceState(), owner.sourceState());
});

test('before-action binding rejects an invalid action index without consuming a return', () => {
  const owner = restore(learned.stateAfterPropose), before = owner.nativeState();
  for (const index of [-1, 0.5, learned.proposal.actions.length]) {
    assert.equal(owner.before(learned.proposal, index, learned.beforePublic, learned.beforeObservation).admitted, false);
  }
  assert.strictEqual(owner.nativeState(), before);
});
