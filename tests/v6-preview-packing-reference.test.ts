import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyPreviewPackingReference } from '../scripts/compare-v6-preview-packing-reference.ts';

test('PreviewPacking matches the independent pinned Python oracle, including complete proposals, acquisition and restored next decisions', async () => {
  const report = await verifyPreviewPackingReference();
  assert.equal(report.status, 'passed');
  assert.equal(report.gameExecution, false);
  assert.equal(report.historicalResultsReused, false);
  assert.ok(report.sourceSteps > 0 && report.sourceFiles > 0);
});
