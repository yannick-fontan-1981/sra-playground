import assert from 'node:assert/strict';
import test from 'node:test';
import { canonical } from '../src/logos-engine/canonical.ts';
import { retainNativeJson } from '../src/logos-engine/v6-native-owned.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import type { NativeStoreWrite } from '../src/logos-engine/v6-knowledge-store.ts';

const cause = (statement: string) => ({ workflow: 'publication-test', step: 'family', statement });
const family = (value: unknown, metadata: Partial<NativeStoreWrite> = {}): NativeStoreWrite => ({
  id: 'family:carrier', kind: 'family_state', family: 'carrier', value, ...metadata,
});

/** The control receives fresh mutable inputs, so it cannot use a previously
 * certified frozen source. Compare the complete graph after every transaction. */
function pairedStores() {
  const actual = new NativeKnowledgeStore('same-source', 'same-scope');
  const control = new NativeKnowledgeStore('same-source', 'same-scope');
  return { actual, control, async commit(writes: NativeStoreWrite[], statement: string) {
    const receipt = await actual.commit(writes, cause(statement));
    await control.commit(structuredClone(writes), cause(statement));
    assert.equal(canonical(actual.memory), canonical(control.memory));
    return receipt;
  } };
}

test('repeated immutable family checkpoints preserve the full graph and accepted receipt', async () => {
  const pair = pairedStores();
  const state = retainNativeJson({ rows: Array.from({ length: 40 }, (_, y) =>
    Array.from({ length: 40 }, (_, x) => (x + y) % 9)), negativeZero: -0, fraction: 0.125,
    reserved: { $v6_float64: 'ordinary user data' } });
  await pair.commit([family(state, { evidence: ['observed:1'], relations: [{ relation: 'derived_from', target: 'return:1' }],
    definition: { version: 1 } })], 'initial');
  const before = pair.actual.memory, node = pair.actual.node('family:carrier');
  for (const statement of ['caller.prepare', 'another-unchanged-checkpoint']) {
    const receipt = await pair.commit([family(state)], statement);
    assert.equal(pair.actual.memory, before);
    assert.equal(receipt.get('family:carrier')!.source, state);
    assert.equal(receipt.get('family:carrier')!.node, node);
  }
  assert.ok(Object.is((pair.actual.value('family:carrier') as any).negativeZero, -0));
});

test('evidence, status, relationships and owner changes retain every ordinary delta', async () => {
  const pair = pairedStores(), state = retainNativeJson({ effects: ['attach', 'translate'], count: 3 });
  await pair.commit([family(state)], 'initial');
  let revision = pair.actual.revision;
  for (const metadata of [
    { evidence: ['return:1'] },
    { status: 'observed' as const },
    { relations: [{ relation: 'derived_from', target: 'return:1' }] },
    { evidence: ['return:2', 'return:1'] },
    { family: 'another-owner' },
    { component: 'component:carrier' },
    { definition: { version: 1 } },
    { evidence: [], relations: [] },
  ]) {
    const node = pair.actual.node('family:carrier');
    await pair.commit([family(state, metadata)], 'outcome.acquire');
    assert.equal(pair.actual.revision, ++revision);
    assert.equal(pair.actual.node('family:carrier').value, node.value);
    assert.equal(pair.actual.memory.deltas.at(-1)!.cause.statement, 'outcome.acquire');
  }
  const before = pair.actual.memory;
  // A supplied definition does not replace an existing definition in the
  // native-store contract. This remains identical to ordinary publication.
  await pair.commit([family(state, { definition: { version: 99 } })], 'unchanged-definition');
  assert.equal(pair.actual.memory, before);
});

test('a family no-op reads the staged node, including changes and reversions in the same transaction', async () => {
  const pair = pairedStores(), state = retainNativeJson({ count: 2 });
  await pair.commit([family(state, { evidence: ['return:old'] })], 'initial');
  const revision = pair.actual.revision;
  const receipt = await pair.commit([
    family(state), family(state, { evidence: ['return:new'] }), family(state),
    family(state, { evidence: ['return:old'] }), family(state),
  ], 'mixed-checkpoint');
  assert.equal(pair.actual.revision, revision + 2);
  assert.deepEqual(pair.actual.node('family:carrier').evidence, ['return:old']);
  assert.equal(receipt.get('family:carrier')!.node, pair.actual.node('family:carrier'));
  assert.equal(receipt.get('family:carrier')!.source, state);
});

test('mutable descendants and newly supplied sources remain validated and reflected in the graph', async () => {
  const pair = pairedStores(), child = { count: 1 }, shallow = Object.freeze({ child });
  await pair.commit([family(shallow)], 'initial');
  child.count = 2;
  await pair.commit([family(shallow)], 'changed-mutable-child');
  assert.deepEqual(pair.actual.value('family:carrier'), { child: { count: 2 } });
  const known = retainNativeJson({ child: { count: 2 } });
  await pair.commit([family(known)], 'publish-closed');
  await pair.commit([family(retainNativeJson({ child: { count: 3 } }))], 'replace-closed');
  await pair.commit([family(known)], 'restore-earlier-closed-source');
  assert.deepEqual(pair.actual.value('family:carrier'), known);
});

test('invalid metadata and failed transactions roll back repeated family checkpoints atomically', async () => {
  const pair = pairedStores(), state = retainNativeJson({ value: [1, 2, 3] });
  await pair.commit([family(state)], 'initial');
  const original = pair.actual.memory;
  const invalidWrites: NativeStoreWrite[][] = [
    [family(state, { status: 'unknown' as any })],
    [family(state, { evidence: [undefined as any] })],
    [family(state, { relations: [{ value: NaN }] })],
    [family(state, { family: (() => 1) as any })],
    [family(state), family(state, { evidence: ['new'] }), { id: 'missing-owner', kind: 'family_state', value: {} }],
    [family(state, { kind: 'component_state', component: 'changed-kind' })],
  ];
  for (const writes of invalidWrites) {
    await assert.rejects(pair.actual.commit(writes, cause('invalid')));
    assert.equal(pair.actual.memory, original);
  }
  await assert.rejects(pair.actual.commit([family(state)], cause('stale'), 'stale-chain'), /graph changed/);
  assert.equal(pair.actual.memory, original);
  const malformed = Object.freeze(Object.defineProperty({}, 'value', { enumerable: true, get: () => [1, 2, 3] }));
  await assert.rejects(pair.actual.commit([family(malformed)], cause('invalid-source')), /data properties/);
  assert.equal(pair.actual.memory, original);
  // A failed transaction must not poison the published-source cache or the
  // accepted node identity used by the next successful transaction.
  await pair.commit([family(state), family(state, { evidence: ['after-rejection'] })], 'recovered');
  assert.equal(pair.actual.revision, original.deltas.length + 1);
});

test('the same frozen source never lends its node identity to another family', async () => {
  const pair = pairedStores(), state = retainNativeJson({ position: [4, 8], known: true });
  await pair.commit([family(state)], 'first-owner');
  await pair.commit([family(state, { id: 'family:other', family: 'other' })], 'second-owner');
  assert.equal((pair.actual.node('family:other').value as any).component, 'family:other');
  assert.equal((pair.actual.node('family:carrier').value as any).component, 'family:carrier');
  await pair.commit([family(state)], 'first-owner-again');
  assert.deepEqual(pair.actual.value('family:carrier'), state);
});

test('untrusted metadata arrays still receive the full ordinary validation', async () => {
  const pair = pairedStores(), state = retainNativeJson({ count: 1 });
  // The Kernel accepts JSON metadata beyond the caller's TypeScript shape.
  // It must still reject holes, decorations and accessors on later writes.
  await pair.commit([family(state, { family: ['carrier'] as any })], 'initial');
  let getterCalls = 0;
  const accessor = Object.defineProperty([], '0', { enumerable: true, get() { getterCalls++; return 'carrier'; } });
  const malformed = [new Array(1), Object.assign(['carrier'], { extra: true }), accessor];
  for (const metadata of malformed) {
    for (const store of [pair.actual, pair.control]) {
      const before = store.memory;
      await assert.rejects(store.commit([family(store === pair.actual ? state : structuredClone(state),
        { family: metadata as any })], cause('invalid-metadata-array')));
      assert.equal(store.memory, before);
    }
  }
  assert.equal(getterCalls, 0);
  assert.equal(canonical(pair.actual.memory), canonical(pair.control.memory));
});

test('a repeated family write preserves the asynchronous boundary before the next input', async () => {
  const pair = pairedStores(), state = retainNativeJson({ count: 1 });
  await pair.commit([family(state)], 'initial');
  for (const store of [pair.actual, pair.control]) {
    const next = { count: 0 };
    queueMicrotask(() => { next.count = 2; });
    await store.commit([
      family(store === pair.actual ? state : structuredClone(state)),
      family(next, { id: 'family:next', family: 'next' }),
    ], cause('queued-input-change'));
    assert.deepEqual(store.value('family:next'), { count: 2 });
  }
  assert.equal(canonical(pair.actual.memory), canonical(pair.control.memory));
});
