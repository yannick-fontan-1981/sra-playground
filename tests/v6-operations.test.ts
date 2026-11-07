import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { execute, canonical, pythonEqual, pythonTruthy } from '../src/logos-engine/v6-operations.ts';
import { NativeReasoningMemory, OPERATIONS, TREE_SHA256 } from '../src/logos-engine/v6-reasoning-memory.ts';

const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-operations-reference.json', import.meta.url), 'utf8'));

for (const sample of fixture.cases) test(`V6 symbolic operation original parity: ${sample.id}`, () => {
  const input = structuredClone(sample.state), actual = execute(sample.operation, input);
  assert.deepEqual(actual, sample.expected);
  assert.deepEqual(input, sample.state, 'queries must not mutate supplied evidence');
});

test('V6 operation equality, Python truth and canonical source serialization', () => {
  for (const sample of fixture.canonical) assert.equal(canonical(sample.value), sample.expected);
  assert.equal(pythonEqual({ a: [true, false] }, { a: [1, 0] }), true);
  assert.equal(pythonEqual({}, []), false);
  assert.equal(pythonEqual([1], ['1']), false);
  assert.equal(pythonEqual({ a: null }, {}), false);
  for (const value of [null, false, 0, '', [], {}]) assert.equal(pythonTruthy(value), false);
  for (const value of [true, -1, '0', [false], { value: false }]) assert.equal(pythonTruthy(value), true);
  assert.throws(() => execute('OP32', {}), /Unknown symbolic operation/);
});

test('V6 catalog windows match exact normative identities and documentary-only adjacency', () => {
  const memory = new NativeReasoningMemory();
  assert.deepEqual(memory.importCatalog(), fixture.imported);
  assert.deepEqual(memory.stats(), fixture.initialStats);
  assert.equal(Object.keys(OPERATIONS).length, 31);
  assert.equal(TREE_SHA256, fixture.imported.tree_sha256);
  for (const sample of fixture.windows) assert.deepEqual(memory.window(sample.key), sample.expected, sample.key);
  assert.throws(() => memory.window('absent'), /Unknown reasoning node/);
});

test('V6 reasoning memory preserves revisions, provenance, jumps and archive semantics', () => {
  const memory = new NativeReasoningMemory({ clock: () => 1234.5 }); memory.importCatalog();
  const replay = new NativeReasoningMemory({ clock: () => 1234.5 });
  for (const sample of fixture.memoryCases) {
    const a = sample.arguments; let actual: unknown;
    if (sample.kind === 'put') actual = memory.put(a[0], a[1], a[2], a[3], a[4]);
    else if (sample.kind === 'get') actual = memory.get(a[0], a[1]);
    else if (sample.kind === 'trace') actual = memory.trace(a[0], a[1], a[2]);
    else if (sample.kind === 'jump') actual = memory.jump(a[0], a[1], a[2], a[3]);
    else if (sample.kind === 'seed_archive') actual = memory.seedArchive({ encode: text => [...text] }, a[0]);
    else if (sample.kind === 'import_catalog') actual = memory.importCatalog();
    else assert.fail(`Unknown memory oracle operation: ${sample.kind}`);
    assert.deepEqual(actual ?? null, sample.result, sample.kind);
    assert.deepEqual(memory.stats(), sample.stats);
    replay.restore(memory.state()); assert.deepEqual(replay.state(), memory.state());
  }
  assert.deepEqual(memory.state().traces, fixture.traces);
  assert.throws(() => memory.get('unseen', 'state'), /Unknown reasoning fact/);
  const before = memory.state(); const damaged = structuredClone(before); damaged.edges.push({ src: 'absent', relation: 'invalid', dst: 'also-absent' });
  assert.throws(() => memory.restore(damaged), /Unbound reasoning edge/);
  assert.deepEqual(memory.state(), before, 'invalid restore is atomic');
  const result = memory.get('ep', 'state'); result.value.facts['é'] = 'edited outside the store';
  assert.deepEqual(memory.get('ep', 'state').value, { facts: { 'é': false } });
  memory.close(); assert.throws(() => memory.stats(), /closed/);
});

test('V6 memory edit changes the actual node window and slices Unicode code points', () => {
  const memory = new NativeReasoningMemory(); memory.importCatalog();
  const state = memory.state(), node = state.nodes[0]!; node.text = '😀'.repeat(181);
  memory.restore(state); const window = memory.window(node.key);
  assert.equal([...window.current.navigation_excerpt].length, 180);
  assert.equal(window.current.navigation_excerpt, '😀'.repeat(180));
  assert.equal(window.current.excerpt_only, true);
});

test('V6 operations and normative catalog remain bound to exact original source bytes', async () => {
  assert.equal(fixture.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  for (const [path, expected] of Object.entries(fixture.sourceHashes)) {
    const bytes = await readFile(new URL(`../reference/v6/${fixture.commit}/source/${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, path);
  }
});
