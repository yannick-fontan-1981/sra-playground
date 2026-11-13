import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadAndValidateV6CurrentRegistry,
  loadV6CurrentRegistry,
  validateV6CurrentRegistry,
} from '../scripts/verify-v6-current-reconstruction-registry.mjs';

function registry() {
  return loadV6CurrentRegistry();
}

function clone(value) {
  return structuredClone(value);
}

test('canonical current reconstruction registry validates without using 76 as a denominator', () => {
  const result = loadAndValidateV6CurrentRegistry();
  assert.equal(result.summary.inventoriedCapabilities, 47);
  assert.equal(result.summary.countedCurrentCapabilities, 47);
  assert.equal(result.summary.performanceQualifiedCapabilities, 6);
  assert.equal(result.summary.historicallyMappedCapabilities, 0);
  assert.equal(result.summary.currentCountDenominator, null);
  assert.equal(result.historical.comparableToCurrentRegistry, false);
  assert.deepEqual(result.categoryCounts, {
    'symbolic-engine': 12,
    'addressed-learning': 11,
    'public-perception': 9,
    region: 3,
    'runtime-product': 12,
  });
  assert.equal(result.registrySourceFiles.length, 8);
});

test('summary counters are derived rather than trusted', () => {
  const value = clone(registry());
  value.summary.countedCurrentCapabilities += 1;
  assert.throws(
    () => validateV6CurrentRegistry(value, { exists: () => true }),
    /does not match computed value/,
  );
});

test('historical 70/76 evidence cannot become a current comparison without a proved mapping', () => {
  const value = clone(registry());
  value.historicalReference.comparableToCurrentRegistry = true;
  assert.throws(
    () => validateV6CurrentRegistry(value, { exists: () => true }),
    /historical identity and mapping must remain explicitly unresolved/,
  );
});

test('the OP01-OP31 catalogue cannot inflate the current count into 31 entries', () => {
  const value = clone(registry());
  value.entries[0].aggregation.operationsRepresented = 30;
  assert.throws(
    () => validateV6CurrentRegistry(value, { exists: () => true }),
    /exactly one 31-operation aggregate entry/,
  );
});

test('qualified performance claims require durable proof files', () => {
  const value = clone(registry());
  const smlp = value.entries.find(entry => entry.id === 'RC028');
  smlp.performanceProofPaths = [];
  assert.throws(
    () => validateV6CurrentRegistry(value, { exists: () => true }),
    /performanceProofPaths must not be empty/,
  );
});

test('the registry fails closed when a referenced implementation or proof disappears', () => {
  const value = clone(registry());
  const missing = value.entries[0].implementationPaths[0];
  assert.throws(
    () => validateV6CurrentRegistry(value, {
      exists: path => !path.endsWith(missing),
    }),
    new RegExp(`does not exist: ${missing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  );
});

test('fragment files are themselves part of the durable registry contract', () => {
  const value = clone(registry());
  const missing = value.registrySourceFiles[1];
  assert.throws(
    () => validateV6CurrentRegistry(value, {
      exists: path => !path.endsWith(missing),
    }),
    new RegExp(`does not exist: ${missing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  );
});
