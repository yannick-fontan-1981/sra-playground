import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  deriveSummary,
  loadRegistry,
  renderMarkdown,
  validateRegistry,
  verifyRepository,
} from '../scripts/verify-v6-current-entry-registry.mjs';

const ROOT = resolve(import.meta.dirname, '..');

test('current V6 entry registry validates against the repository tree', () => {
  const { summary } = verifyRepository(ROOT);
  assert.equal(summary.currentCapabilityEntries, 32);
  assert.equal(summary.productActiveEntries, 24);
  assert.equal(summary.qualificationHarnessEntries, 6);
  assert.equal(summary.openEntries, 5);
});

test('registry summary is fully derived from entries', () => {
  const registry = loadRegistry(ROOT);
  assert.deepEqual(registry.summary, deriveSummary(registry.entries));
});

test('deterministic Markdown matches the committed view', () => {
  const registry = loadRegistry(ROOT);
  const committed = readFileSync(
    resolve(ROOT, 'docs/migration/v6-current-entry-registry.md'),
    'utf8',
  );
  assert.equal(committed, `${renderMarkdown(registry)}\n`);
});

test('historical comparison cannot be enabled', () => {
  const registry = structuredClone(loadRegistry(ROOT));
  registry.historicalReference.comparableToCurrentRegistry = true;
  assert.throws(
    () => validateRegistry(registry, { root: ROOT }),
    /may not be compared to the historical denominator/,
  );
});

test('a counted capability cannot lose its consumer', () => {
  const registry = structuredClone(loadRegistry(ROOT));
  const entry = registry.entries.find(item => item.status === 'product-active');
  assert.ok(entry);
  entry.consumerPaths = [];
  assert.throws(
    () => validateRegistry(registry, { root: ROOT }),
    /qualified entry requires consumer paths/,
  );
});

test('a referenced proof path must exist', () => {
  const registry = structuredClone(loadRegistry(ROOT));
  const entry = registry.entries.find(item => item.status === 'qualified-library');
  assert.ok(entry);
  entry.functionalProofPaths = ['docs/recovery/does-not-exist.md'];
  assert.throws(
    () => validateRegistry(registry, { root: ROOT }),
    /missing path/,
  );
});

test('open and historical entries never increase the current capability count', () => {
  const registry = loadRegistry(ROOT);
  const current = registry.entries.filter(entry =>
    ['product-active', 'qualified-library'].includes(entry.status));
  assert.equal(current.length, registry.summary.currentCapabilityEntries);
  assert.ok(registry.entries.some(entry => entry.status === 'open'));
  assert.ok(registry.entries.some(entry => entry.status === 'historical-only'));
});
