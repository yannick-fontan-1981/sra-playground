import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { evaluateOutlineRecoverySubset } from '../src/logos-engine/v6-outline-recovery-policy.ts';

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-outline-recovery-policy-reference.json.gz', import.meta.url))).toString());
for (const item of fixture.cases) test(`outline recovery original V5 evaluator ${item.id}`, async () => {
  assert.deepEqual(await evaluateOutlineRecoverySubset(item.mode, item.facts), item.value);
});
