/** Native extensions only. Learned priors below are acquired by replaying the
 * independent original public fixture from a cold owner; no expected tracker
 * is installed to manufacture admission. The oracle suite covers source parity. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { ObservedBinding, BindingWorkBound, OBSERVED_BINDING_NATIVE_SEARCH_BOUNDS } from '../src/logos-engine/v6-observed-binding.ts';
import { BINDING_TRACKER_FIELDS } from '../src/logos-engine/v6-object-binding-tracker.ts';
import { offers } from '../src/logos-engine/v6-object-binding-planning.ts';
import { AttentionMemory } from '../src/logos-engine/v6-attention-memory.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';
import type { NativeExecution } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const fixture: R = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-observed-binding-reference.json.gz', import.meta.url))).toString());
const clone = <T>(value: T): T => structuredClone(value);
const execution = (overrides: Partial<NativeExecution> = {}): NativeExecution => ({ yieldControl: async () => {}, ...overrides });
class PutMemory {
  readonly facts = new Map<string, R>();
  readonly puts: R[] = [];
  get(episode: string, key: string): R {
    const value = this.facts.get(JSON.stringify([episode, key]));
    if (!value) throw new RangeError('Missing attention fact');
    return clone(value);
  }
  put(episode: string, key: string, value: any, evidence: string, revision: number): void {
    const item = { value: clone(value), evidence, revision };
    this.facts.set(JSON.stringify([episode, key]), clone(item)); this.puts.push({ episode, key, ...clone(item) });
  }
}
type Cursor = { owner: ObservedBinding; memory: PutMemory; attention: AttentionMemory; proposal: R | null; episode: string };
function fresh(episode = 'native-extension'): Cursor {
  const memory = new PutMemory(), attention = new AttentionMemory(memory as any, episode), owner = new ObservedBinding();
  owner.enableCallerContext({ attention: () => attention });
  return { owner, memory, attention, proposal: null, episode };
}
function inputFor(cursor: Cursor, op: R): R {
  const input = clone(op.input);
  if (op.useLatestSourceProposal) {
    assert.ok(cursor.proposal, 'This owner computed the preceding proposal itself');
    assert.deepEqual(cursor.proposal, input.proposal, 'The acquired proposal matches the original public chain');
    input.proposal = clone(cursor.proposal);
  }
  return input;
}
async function invoke(cursor: Cursor, op: R): Promise<any> {
  const i = inputFor(cursor, op), owner = cursor.owner;
  const attention: Record<string, (a: R) => any> = {
    open: a => cursor.attention.open(a.question, a.obs), revalidate: a => cursor.attention.revalidate(a.obs),
    observe: a => cursor.attention.observe(a.before, a.after, a.command, a.focus_id),
    take_parent_return: a => cursor.attention.takeParentReturn(a.obs),
    composition_for: a => cursor.attention.compositionFor(a.owner, a.obs),
    retain_composition: a => cursor.attention.retainComposition(a.owner, a.target_ref, a.question, a.evidence, a.obs, a.binding ?? null),
    return_composition: a => cursor.attention.returnComposition(a.owner, a.target_ref, a.status, a.evidence, a.obs),
  };
  if (op.method.startsWith('attention.')) return await attention[op.method.slice(10)]!(i);
  switch (op.method) {
    case 'propose': return cursor.proposal = await owner.proposeSource(i.obs, i.rows, i.inputs, i.remaining, cursor.attention);
    case 'record': return await owner.recordSource(i.before, i.after, i.command, i.first, i.second, i.proposal, i.index ?? 0);
    case 'bind': owner.bind(i.proposal, null); if (op.useLatestSourceProposal) cursor.proposal = clone(i.proposal); return;
    case 'before': return owner.before(i.proposal, i.index, i.public, i.obs);
    case 'after': return owner.after(i.proposal, i.index, i.before, i.after, i.first, i.second);
    default: throw new Error('Unexpected cold acquisition operation: ' + op.method);
  }
}
function chain(id = 'cold-positive'): R {
  const result = fixture.chains.find((item: R) => item.id === id); assert.ok(result, 'Original cold chain is available'); return result;
}
async function beforeOperation(predicate: (cursor: Cursor, op: R) => boolean, id = 'cold-positive'): Promise<{ cursor: Cursor; op: R; input: R }> {
  const source = chain(id), cursor = fresh(source.episode);
  for (const op of source.operations) {
    if (predicate(cursor, op)) return { cursor, op, input: inputFor(cursor, op) };
    const actual = await invoke(cursor, op);
    assert.deepEqual(actual === undefined ? null : actual, op.result, 'Cold acquisition result');
    assert.deepEqual(cursor.owner.sourceState(), op.state, 'Cold acquisition state');
  }
  throw new Error('No matching source operation in ' + id);
}
async function acquire(predicate: (state: R) => boolean, id = 'cold-positive'): Promise<Cursor> {
  const source = chain(id), cursor = fresh(source.episode);
  for (const op of source.operations) {
    const actual = await invoke(cursor, op);
    assert.deepEqual(actual === undefined ? null : actual, op.result, 'Cold acquisition result');
    const state = cursor.owner.sourceState(); assert.deepEqual(state, op.state, 'Cold acquisition state');
    if (predicate(state)) return cursor;
  }
  throw new Error('No matching acquired source state in ' + id);
}
const withCore = () => beforeOperation((cursor, op) => op.method === 'propose' && !!cursor.owner.tracker.core && Object.keys(cursor.owner.tracker.moves).length === 2);
const withHeld = () => acquire(state => !!state.held);
function frozen(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true); Object.values(value).forEach(frozen);
}
function preserved(cursor: Cursor): R {
  return { tracker: cursor.owner.sourceState(), attention: cursor.attention.state(), puts: clone(cursor.memory.puts),
    facts: clone([...cursor.memory.facts]), checkpoint: cursor.owner.nativeState(), selected: clone(cursor.owner.selected) };
}
function unchanged(cursor: Cursor, prior: R): void {
  assert.deepEqual(cursor.owner.sourceState(), prior.tracker); assert.deepEqual(cursor.attention.state(), prior.attention);
  assert.deepEqual(cursor.memory.puts, prior.puts); assert.deepEqual([...cursor.memory.facts], prior.facts);
  assert.strictEqual(cursor.owner.nativeState(), prior.checkpoint); assert.deepEqual(cursor.owner.selected, prior.selected);
}
function assertRefusal(owner: ObservedBinding, obs: R, bound: string, acquisition = false): R {
  const refusal = owner.currentProposalRefusal(obs); assert.ok(refusal);
  assert.equal(refusal.status, 'unknown'); assert.equal(refusal.release_authority, false);
  assert.equal(refusal.frontier.complete, false); assert.equal(refusal.exhausted_bound, bound);
  assert.equal(refusal.reason, acquisition ? 'observed_binding_acquisition_work_bound' : 'observed_binding_search_work_bound');
  assert.equal(refusal.observation_ref, obs.observation_ref); assert.equal(refusal.level_epoch, obs.level_epoch); assert.equal(refusal.frame_hash, obs.frame_hash);
  for (const field of ['observation_ref', 'level_epoch', 'frame_hash'])
    assert.equal(owner.currentProposalRefusal({ ...obs, [field]: field === 'level_epoch' ? obs.level_epoch + 1 : 'changed' }), null);
  refusal.frontier.complete = true; assert.equal(owner.currentProposalRefusal(obs)!.frontier.complete, false);
  return refusal;
}
function blank(revision: number): R {
  return { observation_ref: 'blank:' + revision, revision, level_epoch: 1, levels_completed: 0,
    frame_hash: 'blank', available_action_refs: ['ACTION1'], entities: [] };
}

test('shared attention registration is lazy and resolves the current caller on propose and record', async () => {
  const owner = new ObservedBinding(), memory = new PutMemory(); let current: AttentionMemory | undefined, reads = 0;
  owner.enableCallerContext({ attention: () => { reads++; assert.ok(current); return current; } });
  assert.equal(reads, 0, 'Factory registration must not access the caller before its construction');
  current = new AttentionMemory(memory as any, 'shared-first');
  const first = chain().operations.find((op: R) => op.method === 'propose').input;
  await owner.proposeSource(first.obs, first.rows, first.inputs, first.remaining);
  assert.strictEqual(owner.attention, current);
  const replacement = new AttentionMemory(memory as any, 'shared-restored'); current = replacement;
  const returned = chain().operations.find((op: R) => op.method === 'record').input;
  await owner.recordSource(returned.before, returned.after, returned.command, returned.first, returned.second);
  assert.strictEqual(owner.attention, replacement); assert.ok(reads >= 4, 'Both acquisition and proposal recheck the attached instance');
  assert.equal(Object.hasOwn(owner.nativeState(), 'attention'), false);
});

test('passive source null remains an empty native event and unchanged cold state reuses its snapshot', async () => {
  const cursor = fresh(), rows = [[0, 0], [0, 0]], command = { action_ref: 'ACTION1' };
  assert.equal(await cursor.owner.recordSource(blank(1), blank(2), command, rows, rows), null);
  const first = cursor.owner.nativeState(), revision = cursor.owner.revision;
  assert.equal(first.source.epoch, 1);
  assert.deepEqual(await cursor.owner.record(blank(2), blank(3), command, rows, rows), { events: [] });
  assert.strictEqual(cursor.owner.nativeState(), first); assert.equal(cursor.owner.revision, revision);
  assert.deepEqual(cursor.memory.puts, []); assert.equal(cursor.owner.currentProposalRefusal(blank(3)), null);
});

test('learned checkpoints are deeply immutable and cached while public source snapshots are detached', async () => {
  const cursor = await withHeld(), checkpoint = cursor.owner.nativeState(); frozen(checkpoint);
  assert.strictEqual(cursor.owner.nativeState(), checkpoint);
  assert.deepEqual(Object.keys(checkpoint), ['schema', 'source']);
  assert.deepEqual(Object.keys(checkpoint.source).sort(), [...BINDING_TRACKER_FIELDS].sort());
  const state = cursor.owner.state(), source = cursor.owner.sourceState();
  state.core.evidence.push('external'); state.held.frame.center[0]++; source.moves.ACTION4.delta[0] = 99;
  assert.notDeepEqual(state, cursor.owner.state()); assert.notDeepEqual(source, cursor.owner.sourceState());
  assert.strictEqual(cursor.owner.nativeState(), checkpoint); assert.equal(checkpoint.source.moves.ACTION4.delta[0], 1);
  assert.throws(() => { checkpoint.source.core.evidence.push('forbidden'); }, TypeError);
});

test('restoration owns the acquired input without repeating source acquisition or duplicating attention', async () => {
  const acquired = await withHeld(), transported = clone(acquired.owner.nativeState()), restored = fresh('restored');
  const ownAttention = restored.owner.attention, puts = clone(restored.memory.puts);
  restored.owner.restoreNative(transported);
  assert.deepEqual(restored.owner.sourceState(), acquired.owner.sourceState()); assert.deepEqual(restored.memory.puts, puts);
  assert.strictEqual(restored.owner.attention, ownAttention); assert.equal(restored.owner.attention.composition, null);
  transported.source.core.evidence.push('foreign-mutation'); transported.source.held.frame.center[0]++;
  assert.deepEqual(restored.owner.sourceState(), acquired.owner.sourceState()); frozen(restored.owner.nativeState());
  const same = restored.owner.nativeState(), revision = restored.owner.revision;
  restored.owner.restoreNative(same); assert.strictEqual(restored.owner.nativeState(), same); assert.equal(restored.owner.revision, revision);
});

test('deep and superficially frozen corruptions fail closed without changing tracker or attention', async () => {
  const cursor = await withHeld(), prior = preserved(cursor);
  const cases: ((state: R) => void)[] = [
    state => { state.schema = 'foreign'; }, state => { state.source.foreign = true; }, state => { delete state.source.observed_frames; },
    state => { state.source.core.offsets[0][0] = -1; }, state => { state.source.core.palette_value = 256; },
    state => { state.source.held.ref = 'foreign'; }, state => { state.source.held.frame.center[0]++; },
    state => { state.source.held.identity_binding.alternatives[0].matching_visible_foreground = [[0, 0], [0, 1]]; },
    state => { state.source.moves.ACTION4.delta = [0, 0]; }, state => { state.source.core.area = Number.NaN; },
    state => { Object.defineProperty(state.source.core, 'evidence', { get() { throw new Error('Accessor must never run'); }, enumerable: true }); },
    state => { state.source.core.offsets.push(state.source); },
  ];
  for (const corrupt of cases) {
    const input = clone(prior.checkpoint); corrupt(input); Object.freeze(input);
    assert.throws(() => cursor.owner.restoreNative(input)); unchanged(cursor, prior);
  }
  const validShallowFrozen = Object.freeze(clone(prior.checkpoint)); cursor.owner.restoreNative(validShallowFrozen);
  validShallowFrozen.source.core.evidence.push('mutable-child');
  assert.deepEqual(cursor.owner.sourceState(), prior.tracker); frozen(cursor.owner.nativeState());
});

test('acquired pending reception and portable methods restore with their exact deep relationships', async () => {
  const pending = await acquire(state => !!state.pending_reception), completed = await acquire(state => state.reception_receipts.length > 0),
    boundary = await acquire(state => state.goal_evidence.length > 0, 'cold-official-boundary');
  for (const cursor of [pending, completed, boundary]) {
    const owner = new ObservedBinding(); owner.restoreNative(clone(cursor.owner.nativeState()));
    assert.deepEqual(owner.sourceState(), cursor.owner.sourceState());
  }
  const examples: [Cursor, (state: R) => void][] = [
    [pending, state => { state.source.pending_reception.object_ref = 'foreign'; }],
    [pending, state => { state.source.pending_reception.gained_pixels.push([999, 999]); }],
    [pending, state => { state.source.held.status = 'joint_transport_observed'; }],
    [completed, state => { state.source.reception_receipts[0].bound_translation_counterexamples = []; }],
    [completed, state => { state.source.methods[0].evidence.push('forged-method'); }],
    [boundary, state => { state.source.methods = []; }],
  ];
  for (const [cursor, corrupt] of examples) {
    const prior = preserved(cursor), input = clone(prior.checkpoint); corrupt(input);
    assert.throws(() => cursor.owner.restoreNative(input)); unchanged(cursor, prior);
  }
});

test('source restore merges extra keys and reset preserves them while native checkpoints remain closed', () => {
  const owner = new ObservedBinding(), native = owner.nativeState(), extra = { declared: true, nested: [1, 2] };
  owner.restore({ epoch: 3, extra_source_key: extra }); extra.nested.push(3);
  owner.restore({ moves: {} }); owner.tracker.reset(4);
  assert.equal(owner.state().epoch, 4); assert.deepEqual(owner.state().extra_source_key, { declared: true, nested: [1, 2] });
  assert.throws(() => owner.nativeState(), /Invalid observed binding checkpoint/);
  owner.restoreNative(native); assert.deepEqual(owner.sourceState(), native.source); assert.strictEqual(owner.nativeState(), native);
});

test('node, work, deadline and abort bounds yield scoped unknown refusals without partial acquisition', async () => {
  const input = chain().operations.find((op: R) => op.method === 'propose').input, aborted = new AbortController(); aborted.abort();
  const cases = [
    { bounds: { maximumNodes: 0 }, bound: 'maximum_nodes' }, { bounds: { maximumWork: 0 }, bound: 'maximum_work' },
    { bounds: OBSERVED_BINDING_NATIVE_SEARCH_BOUNDS, bound: 'deadline', run: execution({ now: () => 5, deadlineMs: 5 }) },
    { bounds: OBSERVED_BINDING_NATIVE_SEARCH_BOUNDS, bound: 'aborted', run: execution({ signal: aborted.signal }) },
  ];
  for (const item of cases) {
    const cursor = fresh(); cursor.owner = new ObservedBinding({ boundedSearch: item.bounds });
    cursor.owner.enableCallerContext({ attention: () => cursor.attention }); const prior = preserved(cursor);
    assert.equal(await cursor.owner.proposeSource(input.obs, input.rows, input.inputs, input.remaining, undefined, item.run), null);
    assertRefusal(cursor.owner, input.obs, item.bound); unchanged(cursor, prior);
  }
  assert.throws(() => new ObservedBinding({ boundedSearch: { maximumWork: -1 } }), TypeError);
});

test('an interruption after compositionFor discards its staged boundary fact and attention change', async () => {
  const cursor = fresh(), input = clone(chain().operations.find((op: R) => op.method === 'propose').input), controller = new AbortController();
  await cursor.attention.retainComposition(cursor.owner.owner, 'prior-target', 'source-question', [input.obs.observation_ref], input.obs);
  input.obs.level_epoch++; input.obs.observation_ref += ':next-scope'; const prior = preserved(cursor);
  const original = AttentionMemory.prototype.compositionFor; let witnessed = false;
  AttentionMemory.prototype.compositionFor = function (owner, obs) {
    const result = original.call(this, owner, obs);
    if (this !== cursor.attention && this.composition?.status === 'boundary') { witnessed = true; controller.abort(); }
    return result;
  };
  try {
    assert.equal(await cursor.owner.proposeSource(input.obs, input.rows, input.inputs, input.remaining, undefined,
      execution({ signal: controller.signal })), null);
  } finally { AttentionMemory.prototype.compositionFor = original; }
  assert.equal(witnessed, true, 'The source boundary write really occurred in staging');
  assertRefusal(cursor.owner, input.obs, 'aborted'); unchanged(cursor, prior);
});

test('an interruption after retainComposition discards both acquired motion and the actual staged put', async () => {
  const { cursor, input } = await beforeOperation((_cursor, op) => op.method === 'record' && op.useLatestSourceProposal === true),
    controller = new AbortController(), prior = preserved(cursor), original = AttentionMemory.prototype.retainComposition;
  let witnessed = false;
  assert.equal(cursor.attention.composition, null, 'The first selected return has not yet acquired composition attention');
  AttentionMemory.prototype.retainComposition = async function (...args) {
    const result = await original.apply(this, args);
    if (this !== cursor.attention && result) { witnessed = true; controller.abort(); }
    return result;
  };
  try {
    assert.equal(await cursor.owner.recordSource(input.before, input.after, input.command, input.first, input.second,
      input.proposal, input.index ?? 0, execution({ signal: controller.signal })), null);
  } finally { AttentionMemory.prototype.retainComposition = original; }
  assert.equal(witnessed, true, 'The source retain operation reached its staged memory.put');
  assertRefusal(cursor.owner, input.after, 'aborted', true); unchanged(cursor, prior);
  assert.equal(Object.keys(cursor.owner.tracker.moves).length, 1, 'The interrupted second motion is not retained');
});

test('SRC wrapped bounds remain unknown but a real source error propagates despite late deadline expiry', async () => {
  const { cursor, input } = await withCore(), prior = preserved(cursor), measure = cursor.owner.measure;
  cursor.owner.measure = () => { throw new BindingWorkBound('maximum_nodes', 3, 7); };
  assert.equal(await cursor.owner.proposeSource(input.obs, input.rows, input.inputs, input.remaining, undefined, execution()), null);
  assertRefusal(cursor.owner, input.obs, 'maximum_nodes'); unchanged(cursor, prior);
  let now = 0;
  cursor.owner.measure = () => { now = 20; throw new Error('real-source-failure-before-expiry'); };
  try {
    await assert.rejects(cursor.owner.proposeSource(input.obs, input.rows, input.inputs, input.remaining, undefined,
      execution({ deadlineMs: 10, now: () => now })), /real-source-failure-before-expiry/);
  } finally { cursor.owner.measure = measure; }
  assert.equal(cursor.owner.currentProposalRefusal(input.obs), null, 'A real source failure cannot become acquired impossibility or a bound');
  unchanged(cursor, prior);
});

test('native ninth execution argument distinguishes incomplete acquisition from a completed source null', async () => {
  const cursor = fresh(), rows = [[0, 0], [0, 0]], command = { action_ref: 'ACTION1' }, before = blank(1), after = blank(2), prior = preserved(cursor);
  const result = await cursor.owner.record(before, after, command, rows, rows, undefined, 0, [], execution({ now: () => 1, deadlineMs: 1 }));
  assert.deepEqual(result.events, []); assert.equal(result.native_acquisition_incomplete, true);
  const refusal = assertRefusal(cursor.owner, after, 'deadline', true); refusal.frontier.complete = false;
  assert.deepEqual(result.native_acquisition_refusal, refusal); unchanged(cursor, prior);
  assert.deepEqual(await cursor.owner.record(before, after, command, rows, rows), { events: [] });
  assert.equal(cursor.owner.currentProposalRefusal(after), null); assert.equal(cursor.owner.state().epoch, 1);
});

test('conditional movement prefixes obey remaining budget and the original sixteen-action maximum', async () => {
  const { cursor } = await withCore(), rows = Array.from({ length: 36 }, () => Array(72).fill(0));
  const fill = (l: number, t: number, r: number, b: number, value: number) => {
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) rows[y]![x] = value;
  };
  // A new declared public observation keeps the acquired body appearance and
  // supplies a distant same-appearance object/frame. No learned state is edited.
  for (let x = 56; x < 63; x++) rows[7]![x] = rows[15]![x] = 4;
  for (let y = 8; y < 15; y++) rows[y]![55] = rows[y]![63] = 4;
  fill(35, 10, 38, 13, 4); fill(3, 10, 4, 11, 9);
  const packet = { frame_rows: rows, frame_hash: symbolicDigest(rows).slice(0, 16), level: 1, levels_completed: 0,
    state: 'NOT_FINISHED', available_action_refs: ['ACTION3', 'ACTION4'], step_index: 2 };
  const observation = await measureNativeObservation(packet as any, 3, 'native-prefix-extension');
  assert.equal(cursor.owner.config.maximum_prefix, 16);
  const unrestricted = offers(cursor.owner.tracker, observation, rows, 100, cursor.owner.config);
  assert.ok(unrestricted.some(plan => plan.kind === 'approach_correspondence' && plan.actions.length === 16));
  assert.ok(unrestricted.every(plan => plan.actions.length <= 16));
  for (const remaining of [1, 3]) {
    const bounded = offers(cursor.owner.tracker, observation, rows, remaining, cursor.owner.config);
    assert.ok(bounded.length); assert.ok(bounded.every(plan => plan.actions.length <= remaining));
  }
  assert.deepEqual(offers(cursor.owner.tracker, observation, rows, 0, cursor.owner.config), []);
});
