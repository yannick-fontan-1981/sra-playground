import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { VisibleBoxRayBudget, VisibleBoxRayInterrupted, visibleBoxFirstHit } from '../src/logos-engine/v6-visible-box-ray.ts';
type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const fixture = JSON.parse(gunzipSync(await readFile(new URL('fixtures/v6-visible-box-ray-reference.json.gz', import.meta.url))).toString()) as R;
test('box kernel reference uses unchanged source and declares its exact partial scope', async () => {
  assert.equal(fixture.sourceModified, false); assert.equal(fixture.gameHostRun, false);
  assert.match(fixture.scope, /no disk interval or full optical state machine/);
  const manifest = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/manifest.json`, root), 'utf8'));
  assert.equal(fixture.pinnedSourceFilesVerifiedBeforeImport, Object.keys(manifest.files).length);
  for (const [path, expected] of Object.entries(fixture.sourceHashes)) {
    const bytes = await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/${path}`, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, path);
    assert.equal(manifest.files[path].sha256, expected);
  }
  assert.equal(createHash('sha256').update(await readFile(new URL(fixture.generator, root))).digest('hex'), fixture.generatorSha256);
});
for (const row of fixture.cases as R[]) test(`Python ↔ TypeScript exact box FIRST_HIT: ${row.id}`, () => {
  const visits: R[] = [], model = structuredClone(row.model), ray = structuredClone(row.ray);
  const invoke = () => visibleBoxFirstHit(model, ray, { visit: value => { visits.push(structuredClone(value)); } });
  if (row.expected.rejected) assert.throws(invoke, error => error instanceof Error && error.message === row.expected.cause);
  else assert.deepEqual(invoke(), row.expected);
  assert.deepEqual(visits, row.visits); assert.deepEqual(model, row.model); assert.deepEqual(ray, row.ray);
});
test('receiver visit budget is shared, bounded, and never returns a fabricated completion', () => {
  let clock = 0;
  const budget = new VisibleBoxRayBudget({ node_bound: 2, time_bound_ms: 10 }, () => clock);
  budget.visit({ receiver: 'a' }); budget.visit({ receiver: 'b' }); clock = 10;
  assert.throws(() => budget.visit({ receiver: 'c' }), error => error instanceof VisibleBoxRayInterrupted
    && error.cause === 'NODE_BOUND' && error.frontier.receiver === 'c');
  assert.equal(budget.examined, 2);
  assert.throws(() => budget.finish(), /TIME_BOUND/);
  const timed = new VisibleBoxRayBudget({ node_bound: 10, time_bound_ms: 2 }, () => clock);
  clock = 12; assert.throws(() => timed.visit({ receiver: 'late' }), /TIME_BOUND/); assert.equal(timed.examined, 0);
});
test('native rational receipts refuse precision loss instead of rounding geometry', () => {
  const row = fixture.cases[0], model = structuredClone(row.model), ray = structuredClone(row.ray);
  model.boundary_bounds = [[0,1],[0,1],[Number.MAX_SAFE_INTEGER,1],[20,1]];
  model.directions[0].vector = [[1,Number.MAX_SAFE_INTEGER],[0,1]];
  assert.throws(() => visibleBoxFirstHit(model, ray, { visit: () => {} }), /EXACT_RATIONAL_RECEIPT_EXCEEDS_NATIVE_SAFE_INTEGER_DOMAIN/);
  model.directions[0].vector = [[Number.MAX_SAFE_INTEGER + 1,1],[0,1]];
  assert.throws(() => visibleBoxFirstHit(model, ray, { visit: () => {} }), /EXACT_RATIONAL_GEOMETRY_OR_DIRECTION_REQUIRED/);
});
