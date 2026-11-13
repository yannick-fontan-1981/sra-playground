import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { NativeReasoningMemory } from '../src/logos-engine/v6-reasoning-memory.ts';
import { retainNativeJson } from '../src/logos-engine/v6-native-owned.ts';
import { assessRetainedTransition, validateRetainedEmpiricalRule } from '../src/logos-engine/v6-transition-learning.ts';
import { hydrateNativeState, splitNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';

const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-transition-reference.json', import.meta.url), 'utf8'));

test('native fact deltas share retained branches while public reads and snapshots remain independent', () => {
  const memory = new NativeReasoningMemory();
  const mutable = { condition: { points: [[2, 3], [4, 5]], weight: -0 }, checks: [{ status: 'observed' }] };
  memory.nativePut('episode', 'rule', mutable, 'observation:1', 1);
  const first = memory.nativeGet('episode', 'rule');
  mutable.condition.points[0]![0] = 99;
  assert.equal(first.value.condition.points[0][0], 2);
  assert.ok(Object.is(first.value.condition.weight, -0));
  assert.throws(() => { first.value.condition.points[0][0] = 7; }, TypeError);
  memory.nativePut('episode', 'rule', { ...first.value, checks: [...first.value.checks, { status: 'confirmed' }] }, 'observation:2', 2);
  const second = memory.nativeGet('episode', 'rule');
  assert.equal(second.value.condition, first.value.condition, 'only the acquired check is a new branch');
  assert.equal(first.value.checks.length, 1);
  assert.equal(second.value.checks.length, 2);
  const publicRead = memory.get('episode', 'rule'); publicRead.value.condition.points[0][0] = 42;
  const snapshot = memory.dynamicState(); snapshot.facts[0]!.value.condition.points[0][0] = 43;
  assert.equal(memory.nativeGet('episode', 'rule').value.condition.points[0][0], 2);
  memory.put('episode', 'rule', { sourceEdit: true }, 'explicit-revision', 3);
  assert.deepEqual(memory.nativeGet('episode', 'rule').value, { sourceEdit: true });
  assert.equal(second.value.condition.points[0][0], 2, 'older immutable snapshots stay valid');
});

test('a shallow frozen container cannot conceal a mutable descendant from retained ownership', () => {
  const leaf = { points: [[1, 2]] }, input = Object.freeze({ leaf });
  const first = retainNativeJson(input);
  leaf.points[0]![0] = 9;
  const second = retainNativeJson(input);
  assert.equal(first.leaf.points[0]![0], 1);
  assert.equal(second.leaf.points[0]![0], 9);
  assert.notEqual(first, second);
  assert.equal(retainNativeJson(first), first);
});

test('retained native values reject malformed graphs without getters, partial writes or warmed depth bypasses', () => {
  const memory = new NativeReasoningMemory(); memory.nativePut('e', 'value', { accepted: true });
  const before = memory.nativeCheckpoint(); let called = false;
  const cyclic: unknown[] = []; cyclic.push(cyclic);
  for (const value of [cyclic, new Date(), [1, , 3], { get value() { called = true; return 2; } }, { [Symbol('field')]: 1 }]) {
    assert.throws(() => memory.nativePut('e', 'value', value));
    assert.equal(memory.nativeCheckpoint().revision, before.revision);
  }
  assert.equal(called, false);
  assert.deepEqual(memory.get('e', 'value').value, { accepted: true });
  let deep: unknown = retainNativeJson({ frame: Array.from({ length: 16 }, () => [1, 2, 3, 4]) });
  retainNativeJson(deep);
  for (let i = 0; i < 127; i++) deep = { child: deep };
  assert.throws(() => retainNativeJson(deep), /nesting/);
});

for (const row of fixture.cases.filter((item: any) => ['validate_empirical_rule', 'assess_transition'].includes(item.function))) {
  test(`incremental native rule evidence equals unchanged original: ${row.name}`, async () => {
    const args = retainNativeJson(structuredClone(row.args));
    const prior = retainNativeJson(structuredClone(row.kwargs.prior_rules ?? []));
    const invoke = () => row.function === 'validate_empirical_rule'
      ? validateRetainedEmpiricalRule(args[0], args[1], args[2], args[3])
      : assessRetainedTransition(args[0], args[1], args[2], prior);
    if (row.error) await assert.rejects(invoke);
    else {
      const result = await invoke();
      assert.deepEqual(result, row.expected);
      assert.ok(Object.isFrozen(result));
      if (row.function === 'validate_empirical_rule') {
        assert.equal(result.conditions, args[0].conditions);
        assert.equal(result.effect, args[0].effect);
      }
      assert.deepEqual(await invoke(), row.expected, 'repeated checks retain the same public evidence');
    }
    assert.deepEqual(args, row.args, 'the retained prior and observed inputs are unchanged');
  });
}

test('incremental state encoding preserves canonical fragment identities and complete exports', () => {
  const branch = retainNativeJson({
    '2': Array.from({ length: 80 }, (_, i) => ({ i, v: i / 7 })),
    '11': 'integer-like keys still use Unicode order', '🙂': ['é', '漢字', -0],
    '\uE000': { kind: 'ref', id: 'literal caller data' },
  });
  const first = splitNativeState({ branch, count: 1 }, 'first', { maxFragmentNodes: 64 });
  const second = splitNativeState({ branch, count: 2 }, 'second', { maxFragmentNodes: 64 });
  for (const fragment of second.fragments) assert.equal(fragment.id, `state_fragment:${symbolicDigest(fragment.value, false)}`);
  const fragments = new Map(second.fragments.map(item => [item.id, item.value]));
  assert.deepEqual(hydrateNativeState(second.root, id => fragments.get(id)), { branch, count: 2 });
  for (const fragment of first.fragments) assert.ok(fragments.has(fragment.id), 'old branches are exported to the new destination');
  let tooDeep: unknown = branch;
  for (let i = 0; i < 126; i++) tooDeep = { nested: tooDeep };
  assert.throws(() => splitNativeState(tooDeep, 'deep', { maxFragmentNodes: 64 }), /nesting/);
});
