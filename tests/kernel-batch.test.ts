import assert from 'node:assert/strict';
import test from 'node:test';
import { canonical, digest, immutableJson } from '../src/logos-engine/canonical.ts';
import { emptyMemory, Kernel } from '../src/logos-engine/kernel.ts';
import type { DeltaCause, KnowledgeMemory, KernelTransaction } from '../src/logos-engine/kernel.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import type { NativeStoreWrite } from '../src/logos-engine/v6-knowledge-store.ts';
import type { JsonObject } from '../src/logos-engine/ir.ts';

const CAUSE: DeltaCause = { workflow: 'test.delta', step: 'checkpoint', statement: 'acquired.public.return' };
function kernel(limit = 128): Kernel {
  return new Kernel({ node_fields: ['id', 'kind', 'revision', 'status', 'scope', 'origin', 'evidence', 'value'],
    kinds: { fact: [], other: [] }, statuses: ['retained', 'observed'] },
  { limits: { nodes: limit }, templates: {} }, 'test:ordered-kernel-batch');
}
function node(id: string, value: unknown = 0): JsonObject {
  return immutableJson({ id, kind: 'fact', revision: 0, status: 'retained', scope: 'test',
    origin: { observed: true }, evidence: [], value }) as JsonObject;
}

test('a batch preserves every sequential delta, hash, cause and revision, including repeated identities', async () => {
  const owner = kernel();
  let expected = await owner.commit(emptyMemory(), node('retained', { first: true }), CAUSE);
  const initial = expected, batch = owner.beginTransaction(initial);
  for (const [index, id] of ['alpha', '\ue000', '\u{10000}', 'alpha', 'retained', 'alpha'].entries()) {
    const current = expected.nodes[id];
    const input = current ? { ...current, value: { ordinal: index, boolean: index % 2 === 0 } } : node(id, { ordinal: index });
    const cause = { ...CAUSE, statement: `step:${index}` };
    expected = await owner.commit(expected, input, cause);
    await batch.commit(input, cause);
    assert.deepEqual(batch.node(id), expected.nodes[id]);
  }
  // A true no-op uses the current revision and does not create a delta.
  expected = await owner.commit(expected, expected.nodes.alpha!, CAUSE);
  await batch.commit(batch.node('alpha')!, CAUSE);
  const actual = batch.finish();
  assert.deepEqual(actual, expected);
  assert.equal(canonical(actual), canonical(expected));
  assert.equal(actual.deltas[0], initial.deltas[0]);
  assert.equal(initial.nodes.retained!.revision, 1);
  for (const delta of actual.deltas) {
    const { digest: recorded, ...payload } = delta;
    assert.equal(await digest(payload), recorded);
  }
});

test('empty and unchanged batches return the original immutable graph', async () => {
  const owner = kernel(), initial = await owner.commit(emptyMemory(), node('a'), CAUSE);
  assert.equal(owner.beginTransaction(initial).finish(), initial);
  const unchanged = owner.beginTransaction(initial);
  await unchanged.commit(initial.nodes.a!, CAUSE);
  assert.equal(unchanged.finish(), initial);
  assert.throws(() => unchanged.finish(), /closed/);
  await assert.rejects(unchanged.commit(node('b'), CAUSE), /closed/);
});

test('only the final containers change; earlier snapshots and unchanged nodes remain immutable', async () => {
  const owner = kernel(), initial = await owner.commit(emptyMemory(), node('a', { rows: [[1, 2]] }), CAUSE);
  const before = canonical(initial), batch = owner.beginTransaction(initial);
  await batch.commit(node('b'), CAUSE);
  const result = batch.finish();
  assert.notEqual(result.nodes, initial.nodes);
  assert.notEqual(result.deltas, initial.deltas);
  assert.equal(result.nodes.a, initial.nodes.a);
  assert.equal(result.deltas[0], initial.deltas[0]);
  assert.equal(canonical(initial), before);
  assert.ok(Object.isFrozen(result.nodes));
  assert.ok(Object.isFrozen(result.deltas));
  assert.ok(Object.isFrozen(result.deltas.at(-1)));
  assert.throws(() => { (result.nodes as Record<string, unknown>).b = null; }, TypeError);
});

test('batch hashing closes input nodes and causes before asynchronous work', async () => {
  const owner = kernel(), batch = owner.beginTransaction(emptyMemory());
  const input = structuredClone(node('mutable', { value: 1 })), cause = { ...CAUSE };
  const pending = batch.commit(input, cause);
  (input.value as Record<string, unknown>).value = 99; cause.statement = 'changed.after.call';
  await pending;
  const result = batch.finish();
  assert.deepEqual(result.nodes.mutable!.value, { value: 1 });
  assert.equal(result.deltas[0]!.cause.statement, CAUSE.statement);
});

test('a late invalid write cannot publish earlier staged writes or mutate the input graph', async () => {
  const owner = kernel(), initial = await owner.commit(emptyMemory(), node('a'), CAUSE);
  const batch = owner.beginTransaction(initial);
  await batch.commit(node('b'), CAUSE);
  await assert.rejects(batch.commit({ ...node('invalid'), kind: 'undeclared' }, CAUSE), /Undeclared/);
  assert.throws(() => batch.finish(), /failed/);
  assert.throws(() => batch.node('b'), /failed/);
  assert.equal(Object.keys(initial.nodes).length, 1);
  assert.equal(initial.deltas.length, 1);
});

test('the batch node budget counts distinct additions and permits updates at the ceiling', async () => {
  const owner = kernel(2), initial = await owner.commit(emptyMemory(), node('a'), CAUSE);
  const batch = owner.beginTransaction(initial);
  await batch.commit(node('b'), CAUSE);
  await batch.commit({ ...batch.node('b')!, value: 2 }, CAUSE);
  await batch.commit({ ...batch.node('a')!, value: 3 }, CAUSE);
  const full = batch.finish();
  assert.equal(Object.keys(full.nodes).length, 2);
  assert.equal(full.nodes.b!.revision, 2);
  const overflow = owner.beginTransaction(full);
  await assert.rejects(overflow.commit(node('c'), CAUSE), /budget exhausted/);
  assert.throws(() => overflow.finish(), /failed/);
  assert.equal(full.deltas.length, 4);
});

test('batch identities are own data properties, including prototype-like and Unicode names', async () => {
  const owner = kernel(), batch = owner.beginTransaction(emptyMemory());
  let expected = emptyMemory();
  for (const id of ['__proto__', 'constructor', 'toString', '\u{10000}', '\ue000']) {
    const input = node(id, id);
    assert.equal(batch.node(id), undefined);
    await batch.commit(input, CAUSE);
    expected = await owner.commit(expected, input, CAUSE);
  }
  const actual = batch.finish();
  assert.deepEqual(actual, expected);
  for (const id of ['__proto__', 'constructor', 'toString']) assert.equal(Object.hasOwn(actual.nodes, id), true);
});

test('overlapping writes fail the batch instead of publishing an ambiguous delta order', async () => {
  const batch = kernel().beginTransaction(emptyMemory());
  const first = batch.commit(node('a'), CAUSE);
  const second = batch.commit(node('b'), CAUSE);
  const settled = await Promise.allSettled([first, second]);
  assert.ok(settled.every(result => result.status === 'rejected'));
  assert.throws(() => batch.finish(), /failed/);
});

test('a pending hash cannot publish a partial graph', async () => {
  const batch = kernel().beginTransaction(emptyMemory()), pending = batch.commit(node('a'), CAUSE);
  assert.throws(() => batch.finish(), /pending write/);
  await pending;
  assert.equal(batch.finish().nodes.a!.revision, 1);
});

test('invalid portable payloads and accessor inputs fail without executing caller getters', async () => {
  for (const value of [0.5, -0, Number.MAX_SAFE_INTEGER + 1]) {
    const batch = kernel().beginTransaction(emptyMemory());
    await assert.rejects(batch.commit(node('a', value), CAUSE), /Portable V7/);
    assert.throws(() => batch.finish(), /failed/);
  }
  let called = false;
  const input = { ...node('a') };
  Object.defineProperty(input, 'value', { enumerable: true, get() { called = true; return 1; } });
  const batch = kernel().beginTransaction(emptyMemory());
  await assert.rejects(batch.commit(input, CAUSE), /data properties/);
  assert.equal(called, false);
});

/** The unchanged public single-commit API supplies the sequential reference. */
function sequentialTransactions(store: NativeKnowledgeStore): void {
  store.kernel.beginTransaction = (initial: KnowledgeMemory): KernelTransaction => {
    let current = initial;
    return {
      node: identity => Object.hasOwn(current.nodes, identity) ? current.nodes[identity] : undefined,
      commit: async (input, cause) => { current = await store.kernel.commit(current, input, cause); },
      finish: () => current,
    };
  };
}

test('native checkpoint batching matches sequential Kernel commits for fragments and metadata revisions', async () => {
  const actual = new NativeKnowledgeStore('store:batch', 'same'), expected = new NativeKnowledgeStore('store:batch', 'same');
  sequentialTransactions(expected);
  const repeated = Object.freeze(Array.from({ length: 96 }, (_, i) => Object.freeze([i, i + 1, i + 2])));
  const history = Object.freeze(Array.from({ length: 96 }, (_, i) => Object.freeze({ index: i, frame: repeated })));
  const values = { history, fraction: 0.5, negativeZero: -0, $v6_float64: 'ordinary user key', '\ue000': 1, '\u{10000}': 2 };
  const rounds: NativeStoreWrite[][] = [
    [{ id: 'family_state:a', kind: 'family_state', family: 'a', value: values },
      { id: 'component:b', kind: 'component_state', component: 'b', value: { seen: 1 } }],
    [{ id: 'family_state:a', kind: 'family_state', family: 'a', value: values, evidence: ['public:1'] },
      { id: 'component:b', kind: 'component_state', component: 'b', value: { seen: 2 } },
      { id: 'component:b', kind: 'component_state', component: 'b', value: { seen: 3 } }],
    [{ id: 'family_state:a', kind: 'family_state', family: 'a', value: values, evidence: ['public:1'] }],
  ];
  let previous: KnowledgeMemory | null = null, previousValue: unknown;
  for (const [round, writes] of rounds.entries()) {
    await actual.commit(writes, CAUSE); await expected.commit(writes, CAUSE);
    assert.deepEqual(actual.memory, expected.memory);
    assert.equal(actual.graphChain, expected.graphChain);
    assert.deepEqual(actual.value('family_state:a'), values);
    if (round === 1) assert.equal(actual.node('family_state:a').value, previousValue);
    if (round === 2) assert.equal(actual.memory, previous);
    previous = actual.memory; previousValue = actual.node('family_state:a').value;
  }
  assert.ok(Object.values(actual.memory.nodes).some(value => value.kind === 'state_fragment'));
  assert.equal(actual.node('component:b').revision, 3);
});

test('a failed native batch preserves fragments, hydration, chain and future usability', async () => {
  const store = new NativeKnowledgeStore('store:atomic-batch', 'scope');
  const write: NativeStoreWrite = { id: 'family_state:a', kind: 'family_state', family: 'a', value: { count: 0 } };
  await store.commit([write], CAUSE);
  const before = store.memory, value = store.value(write.id);
  await assert.rejects(store.commit([{ ...write, value: { count: 1, payload: Array.from({ length: 9000 }, (_, i) => i) } },
    { id: 'invalid', kind: 'family_state', value: {} }], CAUSE), /Logos contract/);
  assert.equal(store.memory, before);
  assert.equal(store.value(write.id), value);
  await assert.rejects(store.commit([write], CAUSE, 'stale'), /graph changed/);
  assert.equal(store.memory, before);
  await store.commit([{ ...write, value: { count: 2 } }], CAUSE);
  assert.equal(store.node(write.id).revision, 2);
  assert.equal(store.memory.deltas.at(-1)!.previous, before.chain);
});
