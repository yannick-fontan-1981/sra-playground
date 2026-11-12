import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCommonValueAttribution } from '../../../consolidate-owner-costs.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../../..');
const read = async path => JSON.parse(await readFile(path, 'utf8'));
let data, retained;
try {
  const attribution = await read(resolve(here, '../qualified-functional-attribution.json'));
  const fixture = await read(resolve(here, '../qualified-functional-fixture.json'));
  const receipts = {};
  for (const role of ['baseline', 'candidate']) receipts[role] = await read(resolve(root, fixture.captures[role].receipt.path));
  data = { attribution, fixture, receipts }; retained = structuredClone(data);
  assert.equal(validateCommonValueAttribution(attribution, receipts, fixture), true);
  assert.deepEqual(data, retained);
  console.log(JSON.stringify({ consumer: 'consolidate-owner-costs.mjs', passed: true, evidenceUnchanged: true }));
} catch (error) {
  let evidenceUnchanged = false;
  try { assert.deepEqual(data, retained); evidenceUnchanged = true; } catch {}
  console.log(JSON.stringify({ consumer: 'consolidate-owner-costs.mjs', passed: false, evidenceUnchanged,
    error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : null }));
  process.exitCode = 1;
}
