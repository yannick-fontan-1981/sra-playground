import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { enumerateSupportPeriodicCellGrids } from '../src/logos-engine/v6-periodic-cell-grids.ts';

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-periodic-pattern-reference.json.gz', import.meta.url))).toString());
test('periodic counting expectations execute the unchanged V5 sources', () => {
  for (const [path, digest] of Object.entries(fixture.sourceHashes)) {
    const bytes = readFileSync(new URL(`../reference/v6/${fixture.sourceCommit}/source/${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), digest);
  }
  assert.ok(fixture.cases.some((item: any) => item.distinctHorizontalFragments > 256));
});
for (const item of fixture.cases) test(`exact source pattern counts: ${item.id}`, () => {
  const rows = structuredClone(item.rows);
  assert.deepEqual(enumerateSupportPeriodicCellGrids(rows, item.options), item.expected);
  // The same owned pixels may be changed by a caller between measurements.
  rows[0][0] = (rows[0][0] + 1) % 256;
  const next = enumerateSupportPeriodicCellGrids(rows, item.options);
  assert.deepEqual(next, enumerateSupportPeriodicCellGrids(structuredClone(rows), item.options));
  assert.deepEqual(enumerateSupportPeriodicCellGrids(item.rows, item.options), item.expected);
});

test('nonordinary matrices preserve their slice hook and original JSON counting', () => {
  const item = fixture.cases.find((value: any) => value.id === 'bordered-repetition:True');
  const rows = structuredClone(item.rows);
  let calls = 0;
  Object.defineProperty(rows, 'slice', { value: function (...args: [number?, number?]) {
    calls++; return Array.prototype.slice.apply(this, args);
  } });
  assert.deepEqual(enumerateSupportPeriodicCellGrids(rows, item.options), item.expected);
  assert.ok(calls > 0, 'The prior public slice hook must still execute.');
});

test('stable palette accessors and row subclasses retain the ordinary measurement result', () => {
  const item = fixture.cases.find((value: any) => value.id === 'palette-byte-boundaries:True');
  const rows = structuredClone(item.rows), value = rows[0][0];
  let reads = 0;
  Object.defineProperty(rows[0], '0', { enumerable: true, get() { reads++; return value; } });
  assert.deepEqual(enumerateSupportPeriodicCellGrids(rows, item.options), item.expected);
  assert.ok(reads > 0);
  class Row extends Array<number> {}
  const subclassed = item.rows.map((row: number[]) => Row.from(row));
  assert.deepEqual(enumerateSupportPeriodicCellGrids(subclassed, item.options), item.expected);
});
