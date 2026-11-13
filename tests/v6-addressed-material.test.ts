/** Native extension contracts, separate from the independent Python parity
 * suite. All learning below uses declared public-return fixtures or synthetic
 * measured rasters; it is not a game run or an official completion claim. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { AddressedMaterial, ADDRESSED_FIELD_SOURCE_POLICY, ADDRESSED_MATERIAL_STATE_SCHEMA } from '../src/logos-engine/v6-addressed-material.ts';
import { ObservedInputDomain, measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeExecution, NativePublicObservation, NativeRows } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-addressed-material-reference.json.gz', import.meta.url))).toString('utf8')) as R;
assert.equal(fixture.schema, 'logos-engine.v6.addressed-material-reference.v1');

async function invoke(owner: AddressedMaterial, row: R): Promise<unknown> {
  const g = copy(row.input);
  if (row.method === 'propose') return owner.propose(g.observation, g.rows, g.inputs, g.remaining);
  if (row.method === 'bind') { owner.bind(g.proposal, new ObservedInputDomain(4096)); return g.proposal; }
  if (row.method === 'before') return owner.before(g.proposal, g.index, g.public, g.observation);
  if (row.method === 'after') return owner.after(g.proposal, g.index, g.before, g.after, g.first, g.second);
  if (row.method === 'record') return owner.recordSource(g.before, g.after, g.command, g.first, g.second, g.proposal ?? undefined, g.index ?? undefined, g.frames ?? undefined);
  if (row.method === 'preservation_obligations') return owner.preservationObligations(g.observation, g.rows);
  if (row.method === 'stock.bodies') { assert.ok(owner.stock); return owner.stock.bodies(g.rows); }
  if (row.method === 'stock.allocations') { assert.ok(owner.stock); return owner.stock.allocations(g.bodies); }
  if (row.method === 'stock.retained') { assert.ok(owner.stock); return owner.stock.retained(g.boundary); }
  throw new Error('Unexpected extension fixture method: ' + row.method);
}
/** Return the actual acquired owner immediately before a designated source
 * call. No learned state is injected from an expectation. */
async function context(id: string, choose: (row: R) => boolean): Promise<{ owner: AddressedMaterial; input: R; expected: R; row: R }> {
  const chain = (fixture.chains as R[]).find(c => c.id === id); assert.ok(chain, 'Missing original chain ' + id);
  const owner = new AddressedMaterial(); assert.deepEqual(owner.sourceState(), chain.initialState);
  for (const row of chain.operations as R[]) {
    if (choose(row)) return { owner, input: copy(row.input), expected: copy(row.result), row };
    assert.equal(row.exception, undefined, 'Learning prefix must not silently omit an original exception');
    await invoke(owner, row); assert.deepEqual(owner.sourceState(), row.state, id + ' acquired prefix');
  }
  throw new Error('Missing designated source call in ' + id);
}
const modelContext = () => context('field-calibrated-positive', row => row.method === 'propose' && row.result?.field_plan?.experiment === 'navigation');
const stockContext = () => context('stock-independent-rewrite-witnesses', row => row.method === 'propose'
  && (row.state.stock?.rules as R[] | undefined)?.some((entry: R) => entry[1].confirmations >= 2) === true);

function deeplyFrozen(value: unknown): void {
  const queue: unknown[] = [value], seen = new Set<object>();
  while (queue.length) { const current = queue.pop(); if (current === null || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current); assert.equal(Object.isFrozen(current), true); queue.push(...Object.values(current)); }
}
async function blank(revision: number, epoch = 1): Promise<{ rows: number[][]; observation: R }> {
  const rows = Array.from({ length: 8 }, () => Array<number>(8).fill(0)), frame_hash = await publicFrameHash(rows);
  const observation = await measureNativeObservation({ frame_rows: rows, frame_hash, level: epoch, levels_completed: 0,
    state: 'NOT_FINISHED', available_action_refs: ['ACTION1'] }, revision, 'synthetic:addressed-native-checkpoint');
  return { rows, observation };
}

test('cold unresolved returns retain every source envelope while reusing the unchanged checkpoint', async () => {
  const owner = new AddressedMaterial(), first = await blank(1), second = await blank(2), third = await blank(3), fourth = await blank(4);
  assert.equal(Object.hasOwn(owner.sourceState(), 'current_observation'), false);
  const initial = owner.nativeState(); assert.equal(initial.schema, ADDRESSED_MATERIAL_STATE_SCHEMA);
  const firstEvent = owner.recordSource(first.observation, second.observation, { action_ref: 'ACTION1' }, first.rows, second.rows);
  assert.deepEqual(firstEvent, { status: 'field_unresolved', events: [] });
  const scoped = owner.nativeState(); assert.notStrictEqual(scoped, initial, 'The first actual epoch is acquired');
  const nextEvent = owner.recordSource(second.observation, third.observation, { action_ref: 'ACTION1' }, second.rows, third.rows);
  assert.deepEqual(nextEvent, { status: 'field_unresolved', events: [] }); assert.notStrictEqual(firstEvent, nextEvent);
  assert.strictEqual(owner.nativeState(), scoped);
  const selected = owner.record(third.observation, fourth.observation, { action_ref: 'ACTION1' }, third.rows, fourth.rows);
  assert.deepEqual(selected, { events: [{ status: 'field_unresolved', events: [] }] });
  assert.strictEqual(owner.nativeState(), scoped, 'The native selected adapter preserves the whole envelope without another state change');
  assert.equal(Object.hasOwn(owner.nativeState(), 'current_observation'), false); deeplyFrozen(scoped);
});

test('learned field snapshots are immutable, cached and detached from both public state projections', async () => {
  const { owner } = await modelContext(), checkpoint = owner.nativeState(), source = owner.sourceState();
  assert.ok(source.model); assert.ok(source.samples.length >= 2); assert.ok(Object.hasOwn(source, 'current_observation'));
  assert.strictEqual(owner.nativeState(), checkpoint); deeplyFrozen(checkpoint);
  const publicCheckpoint = owner.state(), publicSource = owner.sourceState();
  assert.notStrictEqual(publicCheckpoint, checkpoint); assert.notStrictEqual(publicCheckpoint.model.mask, checkpoint.model.mask);
  publicCheckpoint.model.mask[0][0] = -99; publicCheckpoint.samples[0].point[0] = -99;
  publicSource.model.goal.shadow.bbox[0] = -99; publicSource.current_observation.entities.length = 0;
  assert.deepEqual(owner.sourceState(), source); assert.strictEqual(owner.nativeState(), checkpoint);
  assert.throws(() => { (checkpoint.model.mask[0] as number[])[0] = -99; }, TypeError);
});

test('native restoration preserves absence of current_observation and does not invent a source restore API', async () => {
  const { owner } = await modelContext(), learned = owner.state(), cold = new AddressedMaterial().state();
  let records = 0; const acquire = owner.recordSource.bind(owner);
  owner.recordSource = (...args) => { records++; return acquire(...args); };
  owner.restore(cold); assert.equal(Object.hasOwn(owner.sourceState(), 'current_observation'), false);
  assert.equal(Object.hasOwn(owner.nativeState(), 'current_observation'), false); assert.deepEqual(owner.sourceState(), new AddressedMaterial().sourceState());
  owner.restore(learned); assert.ok(Object.hasOwn(owner.sourceState(), 'current_observation')); assert.deepEqual(owner.state(), learned);
  assert.equal(records, 0, 'Restoration never replays an observed return');
  const checkpoint = owner.nativeState(); owner.restoreNative(checkpoint); assert.strictEqual(owner.nativeState(), checkpoint);
  assert.throws(() => owner.restore(owner.sourceState()), /checkpoint|schema|missing/);
  assert.strictEqual(owner.nativeState(), checkpoint);
});

test('deep field checkpoint corruptions fail atomically even behind a superficially frozen root', async () => {
  const { owner } = await modelContext(), checkpoint = owner.nativeState(), before = owner.sourceState();
  const corruptions: [string, (s: R) => void][] = [
    ['schema', s => { s.schema = 'unqualified-source-state'; }],
    ['policy', s => { s.policy.enabled = !s.policy.enabled; }],
    ['unexpected root', s => { s.unacquired_shortcut = true; }],
    ['model offset', s => { s.model.offset[0] = s.model.size[0]; }],
    ['model support', s => { s.model.mask[0][0] = -1; }],
    ['duplicate shadow pixel', s => { s.model.goal.shadow.mask.push(copy(s.model.goal.shadow.mask[0])); }],
    ['exemplar position', s => { s.model.exemplar.position[0]++; }],
    ['goal role', s => { s.model.goal.shadow.palette_value = s.model.palette; }],
    ['sample distance', s => { s.samples[0].distance_squared = -1; }],
    ['sample movement', s => { s.samples[0].stationary = s.samples[0].moved_to_anchor; }],
    ['contour extent', s => { s.indicator.axis_extent++; }],
    ['current measured area', s => { s.current_observation.entities[0].area--; }],
    ['non-finite bound', s => { s.lower_squared = Infinity; }],
    ['non-JSON collection', s => { s.model.mask = new Map(); }],
  ];
  for (const [label, corrupt] of corruptions) {
    const altered = owner.state(); corrupt(altered); Object.freeze(altered);
    assert.throws(() => owner.restoreNative(altered), TypeError, label);
    assert.strictEqual(owner.nativeState(), checkpoint, label + ' must not publish partial state'); assert.deepEqual(owner.sourceState(), before, label);
  }
  let getterCalls = 0; const accessor = owner.state(); Object.defineProperty(accessor.model, 'offset', { enumerable: true, get() { getterCalls++; return [0, 0]; } });
  assert.throws(() => owner.restoreNative(accessor), /enumerable data properties/); assert.equal(getterCalls, 0);
  const cyclic = owner.state(); cyclic.model.loop = cyclic; assert.throws(() => owner.restoreNative(cyclic), /Cyclic/);
  assert.strictEqual(owner.nativeState(), checkpoint);
});

test('restored stock retains all source collections and rejects damaged rules, geometry or prior bindings atomically', async () => {
  const { owner } = await stockContext(), state = owner.state(), source = owner.sourceState(), target = new AddressedMaterial();
  assert.ok(source.stock.rules.some(([, rule]: [number, R]) => rule.confirmations >= 2));
  target.restoreNative(state); assert.deepEqual(target.sourceState(), source); const checkpoint = target.nativeState(); deeplyFrozen(checkpoint);
  const changed = target.state(); changed.stock.source.rules[0][1].evidence.push('external mutation');
  assert.deepEqual(target.sourceState(), source); assert.strictEqual(target.nativeState(), checkpoint);
  const corruptions: [string, (s: R) => void][] = [
    ['stock schema', s => { s.stock.schema = 'source-dict-without-checkpoint-contract'; }],
    ['rewrite confirmation', s => { s.stock.source.rules[0][1].confirmations++; }],
    ['duplicate rewrite', s => { s.stock.source.rules.push(copy(s.stock.source.rules[0])); }],
    ['duplicate type', s => { s.stock.source.order[1] = s.stock.source.order[0]; }],
    ['demand', s => { s.stock.source.demands[0][1]++; }],
    ['request support', s => { s.stock.source.requests[0].mask = []; }],
    ['zone provenance', s => { s.stock.source.zones[0].source_ref += ':stale'; }],
    ['lineage', s => { s.stock.source.lineages[0][1] = [42]; }],
    ['deep prior binding', s => { s.stock.source.prior.boundary += ':other'; }],
    ['parent prior count', s => { s.prior.upper_squared++; }],
    ['second owner', s => { s.model = copy((state as R).stock); }],
  ];
  for (const [label, corrupt] of corruptions) {
    const altered = target.state(); corrupt(altered); Object.freeze(altered);
    assert.throws(() => target.restoreNative(altered), TypeError, label); assert.strictEqual(target.nativeState(), checkpoint, label); assert.deepEqual(target.sourceState(), source, label);
  }
});

test('work limits and current deadline are unknown questions with no acquired effect or partial model', async () => {
  const { owner: learned, input } = await modelContext(), checkpoint = learned.state();
  const cases: { name: string; bounds?: R; execution?: NativeExecution }[] = [
    { name: 'maximum_nodes', bounds: { maximumNodes: 0 } },
    { name: 'maximum_work', bounds: { maximumWork: 0 } },
    { name: 'deadline', execution: { yieldControl: async () => {}, deadlineMs: 5, now: () => 5 } },
  ];
  for (const c of cases) {
    const owner = new AddressedMaterial(ADDRESSED_FIELD_SOURCE_POLICY, { boundedSearch: c.bounds }); owner.restore(checkpoint);
    const before = owner.sourceState(), retained = owner.nativeState();
    assert.equal(await owner.propose(input.observation, input.rows, [], input.remaining, c.execution), null, c.name);
    const refusal = owner.currentProposalRefusal(input.observation)!;
    assert.equal(refusal.status, 'unknown'); assert.equal(refusal.exhausted_bound, c.name); assert.equal(refusal.release_authority, false);
    assert.equal(refusal.block_unrelated_probe, true); assert.equal((refusal.frontier as R).complete, false);
    assert.deepEqual(owner.sourceState(), before); assert.strictEqual(owner.nativeState(), retained);
    for (const field of ['observation_ref', 'frame_hash', 'level_epoch']) {
      const other = copy(input.observation); other[field] = typeof other[field] === 'number' ? other[field] + 1 : other[field] + ':other';
      assert.equal(owner.currentProposalRefusal(other), null, field + ' scope');
    }
    refusal.release_authority = true; assert.equal(owner.currentProposalRefusal(input.observation)!.release_authority, false);
  }
  assert.throws(() => new AddressedMaterial(ADDRESSED_FIELD_SOURCE_POLICY, { boundedSearch: { maximumNodes: -1 } }), /work bound/);
  assert.throws(() => new AddressedMaterial(ADDRESSED_FIELD_SOURCE_POLICY, { boundedSearch: { maximumWork: Infinity } }), /work bound/);
});

test('cooperative cancellation yields no action and a later complete question clears the scoped refusal', async () => {
  const { owner, input } = await modelContext(), source = owner.sourceState(), controller = new AbortController(); let yields = 0;
  const execution: NativeExecution = { signal: controller.signal, yieldControl: async () => { yields++; controller.abort(); } };
  assert.equal(await owner.propose(input.observation, input.rows, [], input.remaining, execution), null); assert.equal(yields, 1);
  assert.equal(owner.currentProposalRefusal(input.observation)!.exhausted_bound, 'aborted'); assert.deepEqual(owner.sourceState(), source);
  const alreadyAborted = new AbortController(); alreadyAborted.abort();
  assert.equal(await owner.propose(input.observation, input.rows, [], input.remaining, { signal: alreadyAborted.signal, yieldControl: async () => assert.fail('An already canceled question must not yield work') }), null);
  assert.deepEqual(owner.sourceState(), source);
  const proposal = await owner.propose(input.observation, input.rows, [], input.remaining, { yieldControl: async () => {} });
  assert.ok(proposal?.actions.length); assert.equal(owner.currentProposalRefusal(input.observation), null); assert.deepEqual(owner.sourceState(), source);
});

test('an interrupted stock proposal rolls back both lazy construction and minimum bookkeeping', async () => {
  const { owner: acquired, input } = await context('stock-cold-boundary-base', row => row.method === 'preservation_obligations' && row.state.stock !== null);
  assert.equal(acquired.stock, null); assert.ok(acquired.prior);
  const owner = new AddressedMaterial(ADDRESSED_FIELD_SOURCE_POLICY, { boundedSearch: { maximumWork: 0 } }); owner.restore(acquired.state());
  const cold = owner.sourceState(), checkpoint = owner.nativeState();
  assert.equal(await owner.propose(input.observation, input.rows, [], 16), null); assert.equal(owner.stock, null);
  assert.deepEqual(owner.sourceState(), cold); assert.strictEqual(owner.nativeState(), checkpoint);
  assert.equal(owner.currentProposalRefusal(input.observation)!.exhausted_bound, 'maximum_work');

  const live = acquired.ensureStock(input.observation, input.rows); assert.ok(live);
  assert.deepEqual(live.sourceState().minimums, []);
  const before = acquired.sourceState(), retained = acquired.nativeState(), originalRevision = live.revision;
  const execution: NativeExecution = { yieldControl: async () => {}, deadlineMs: 5,
    now: () => acquired.stock?.revision === originalRevision ? 0 : 5 };
  assert.equal(await acquired.propose(input.observation, input.rows, [], 16, execution), null);
  assert.equal(acquired.currentProposalRefusal(input.observation)!.exhausted_bound, 'deadline');
  assert.deepEqual(acquired.sourceState(), before, 'Even minimum updates completed inside the interrupted proposal are rolled back');
  assert.strictEqual(acquired.nativeState(), retained); assert.deepEqual(acquired.stock!.sourceState().minimums, []);
});

test('a source refusal with zero actions remains selected at its one declared subquestion', async () => {
  const { owner, input, expected } = await context('stock-confirmed-rewrite-counterexample', row => row.method === 'propose' && row.result?.status === 'typed_field_applicability_refuted');
  const source = owner.sourceState();
  assert.equal(await owner.proposeInSubquestion('factored_material_return', 'observed_object_binding', input.observation, input.rows, [], input.remaining), null);
  const refusal = await owner.proposeInSubquestion('factored_material_return', 'observed_addressed_material', input.observation, input.rows, [], input.remaining);
  assert.deepEqual(refusal, { ...expected, material_access_subquestion: 'observed_addressed_material' }); assert.deepEqual(refusal!.actions, []);
  assert.equal(owner.currentProposalRefusal(input.observation), null, 'The acquired source refusal is not an incomplete native search');
  assert.deepEqual(owner.sourceState(), source);
});

/** A longer public geometry exercises the source 16-step bound. The two
 * relocation returns are declared observations; no simulator is consulted. */
async function longPublicField(): Promise<{ owner: AddressedMaterial; rows: number[][]; observation: R }> {
  const scene = (position: readonly number[]): number[][] => {
    const rows = Array.from({ length: 24 }, () => Array<number>(150).fill(0));
    const rect = (x: number, y: number, w: number, h: number, value: number) => { for (let v = y; v < y + h; v++) for (let u = x; u < x + w; u++) rows[v]![u] = value; };
    rect(2, 2, 2, 2, 2);
    // Filled public enclosure: an empty interior background component would
    // itself be a second centered enclosure and correctly leave the fit open.
    rect(135, 2, 6, 6, 6);
    rect(137, 4, 2, 2, 5); rows[9]![6] = 8; rect(position[0]!, position[1]!, 2, 2, 2); return rows;
  };
  const packet = async (rows: NativeRows, revision: number): Promise<NativePublicObservation> => ({ frame_rows: rows, frame_packet: [rows],
    frame_hash: await publicFrameHash(rows), level: 1, levels_completed: 0, state: 'NOT_FINISHED', step_index: revision, available_action_refs: ['ACTION1', 'ACTION6'] });
  const firstRows = scene([2, 8]), secondRows = scene([5, 8]), first = await packet(firstRows, 1), second = await packet(secondRows, 2),
    before = await measureNativeObservation(first, 1, 'synthetic:addressed-long-field'), after = await measureNativeObservation(second, 2, 'synthetic:addressed-long-field'), owner = new AddressedMaterial();
  owner.recordSource(before, after, { action_ref: 'ACTION6', data: { x: 6, y: 9 } }, firstRows, secondRows);
  const contrast = await owner.propose(after, secondRows, [], 16); assert.equal(contrast?.field_plan.experiment, 'different_offset');
  const action = contrast!.actions[0], offset = owner.model!.offset, rows = scene([action.data.x - offset[0], action.data.y - offset[1]]), third = await packet(rows, 3),
    observation = await measureNativeObservation(third, 3, 'synthetic:addressed-long-field');
  assert.equal((await owner.before(contrast!, 0, second, after)).admitted, true);
  await owner.after(contrast!, 0, after, observation, secondRows, rows);
  owner.recordSource(after, observation, action, secondRows, rows, contrast!, 0);
  assert.equal(owner.calibration, 'navigation'); return { owner, rows, observation };
}

test('conditional paths obey both the original 16-step ceiling and the remaining budget', async () => {
  const { owner, rows, observation } = await longPublicField(), source = owner.sourceState();
  const complete = await owner.propose(observation, rows, [], 64); assert.equal(complete?.actions.length, 16);
  for (const remaining of [1, 3, 16, 64]) {
    const proposal = await owner.propose(observation, rows, [], remaining); assert.equal(proposal?.actions.length, Math.min(16, remaining));
    assert.deepEqual(proposal!.actions, complete!.actions.slice(0, Math.min(16, remaining)));
    assert.equal(proposal!.steps[0].expected_before.frame_hash, observation.frame_hash);
    for (const step of proposal!.steps.slice(1)) assert.equal(step.expected_before.frame_hash, null);
  }
  assert.equal(await owner.propose(observation, rows, [], 0), null); assert.deepEqual(owner.sourceState(), source, 'A proposed path acquires none of its predicted effects');
});
