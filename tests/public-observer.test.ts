import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { perceiveFrame } from '../src/logos-engine/public-observer.ts';
import type { PublicFrameInput } from '../src/logos-engine/public-observer.ts';

const fixture = JSON.parse(await readFile(new URL('./fixtures/public-observer-python.json', import.meta.url), 'utf8'));
const reference = new URL('../reference/v7/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/public-observer/', import.meta.url);

test('public observer oracle retains the exact pinned Python function sources', async () => {
  assert.equal(fixture.provenance.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  for (const [filename, entry] of Object.entries(fixture.provenance.sources) as [string, { bytes: number; sha256: string; git_blob_sha1: string }][]) {
    const bytes = await readFile(new URL(filename, reference));
    assert.equal(bytes.length, entry.bytes, filename);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, filename);
    assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), entry.git_blob_sha1, filename);
  }
});

for (const item of fixture.cases) {
  test(`public pixel projection matches original Python: ${item.id}`, async () => {
    const observed = await perceiveFrame(item.input, item.identity);
    assert.deepEqual(observed, item.expected);
    assert.equal(Object.keys(observed.values).length, 8);
  });
}

test('full frame hash distinguishes images with the same component statistics', async () => {
  const a = fixture.cases.find((item: { id: string }) => item.id === 'equal-counts-vertical');
  const b = fixture.cases.find((item: { id: string }) => item.id === 'equal-counts-horizontal');
  const left = await perceiveFrame(a.input, a.identity);
  const right = await perceiveFrame(b.input, b.identity);
  for (const key of ['width', 'height', 'monochrome_components', 'palette_count', 'rectangular_components']) {
    assert.equal(left.values[key], right.values[key]);
  }
  assert.notEqual(left.values.frame_sha256, right.values.frame_sha256);
});

test('projection is detached before hashing and cannot receive hidden engine fields', async () => {
  const source = structuredClone(fixture.cases[0].input);
  const identity = { id: 'host-controlled-observation', scope: 'host-controlled-session' };
  Object.defineProperty(source, 'hiddenBoard', { enumerable: true, get() { throw new Error('Private engine data must not be read'); } });
  const pending = perceiveFrame(source, identity);
  source.frame[0][0] = 15;
  source.availableActionIds[0] = 7;
  source.state = 'CHANGED';
  source.levelsCompleted = 9;
  identity.id = 'mutated-after-ingress';
  const observation = await pending;
  assert.deepEqual(observation, { ...fixture.cases[0].expected, id: 'host-controlled-observation', scope: 'host-controlled-session' });
  assert.deepEqual(Object.keys(observation).sort(), ['actions', 'id', 'scope', 'values']);
  assert.ok(Object.isFrozen(observation));
  assert.ok(Object.isFrozen(observation.values));
  assert.ok(Object.isFrozen(observation.actions));
});

test('malformed, ambiguous and over-budget public inputs are refused', async () => {
  const base: PublicFrameInput = { frame: [[0]], availableActionIds: [1], state: 'NOT_FINISHED', levelsCompleted: 0 };
  const identity = { id: 'observation:0', scope: 'session:0' };
  const invalid: unknown[] = [
    { ...base, frame: [] },
    { ...base, frame: [[]] },
    { ...base, frame: [[0], [0, 1]] },
    { ...base, frame: Array.from({ length: 65 }, () => Array(64).fill(0)) },
    ...[-1, 16, 0.5, -0, NaN, Infinity, true, null].map(value => ({ ...base, frame: [[value]] })),
    { ...base, frame: [[,]] },
    { ...base, availableActionIds: [1, 1] },
    ...[-1, 8, 1.5, -0, '1'].map(value => ({ ...base, availableActionIds: [value] })),
    ...[-1, 0.5, -0, Number.MAX_SAFE_INTEGER + 1, '1'].map(value => ({ ...base, levelsCompleted: value })),
    { ...base, state: '' },
  ];
  for (const value of invalid) await assert.rejects(perceiveFrame(value as PublicFrameInput, identity));
  await assert.rejects(perceiveFrame(base, { ...identity, id: '' }));
  await assert.rejects(perceiveFrame(base, { ...identity, scope: '' }));
});
