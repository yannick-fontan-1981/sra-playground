import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const auditPath = 'docs/recovery/lot9c-joint-channels-audit.json';
const statusPath = 'docs/recovery/lot9c-joint-channels-contract-status.json';

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

test('Lot 9C audit counts remain internally consistent', async () => {
  const audit = await json(auditPath);
  const status = await json(statusPath);
  assert.equal(audit.version, 1);
  assert.equal(status.version, 1);

  const classified = audit.classifiedContentHits;
  assert.ok(classified && typeof classified === 'object');
  assert.equal(status.counts.productSourceHits, classified.product_source.length);
  assert.equal(status.counts.testHits, classified.tests.length);
  assert.equal(status.counts.docsOrMetadataHits, classified.docs_or_metadata.length);
  assert.equal(status.counts.commitMessageHits, audit.commitMessageHits.length);
  assert.equal(status.counts.historyPatchHits, audit.historyPatchHits.length);
});

test('automated matching never admits a historical implementation or contract', async () => {
  const audit = await json(auditPath);
  const status = await json(statusPath);
  assert.equal(audit.admission.historicalProductSourceAdmitted, false);
  assert.equal(status.historicalImplementationAdmitted, false);
  assert.equal(status.historicalContractAdmitted, false);

  const allowedStatuses = new Set([
    'manual-source-review-required',
    'trace-only-contract-reconstruction-required',
    'no-durable-evidence-found',
  ]);
  assert.ok(allowedStatuses.has(status.status), status.status);
  if (status.counts.productSourceHits > 0) {
    assert.equal(status.status, 'manual-source-review-required');
  }
});

test('every joint_channels contract field remains explicitly unproven', async () => {
  const status = await json(statusPath);
  const entries = Object.entries(status.contractFields);
  assert.ok(entries.length >= 15);
  for (const [key, value] of entries) {
    assert.equal(value.status, 'unproven', key);
    assert.deepEqual(value.evidence, [], key);
    assert.equal(value.admittedValue, null, key);
  }
});

test('9C guardrails preserve Lot 9B and the 76-entry counter', async () => {
  const status = await json(statusPath);
  const text = status.guardrails.join('\n');
  assert.match(text, /No semantics inferred from the name joint_channels/);
  assert.match(text, /Lot 9B contracts and official performance qualification remain frozen/);
  assert.match(text, /76-entry counter remains unchanged/);
});
