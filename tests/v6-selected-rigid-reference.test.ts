import assert from 'node:assert/strict';
import test from 'node:test';
import { verifySelectedRigidReference } from '../scripts/compare-v6-selected-rigid-reference.ts';

test('SelectedRigid matches independently executed original public geometry, proposals, acquisition and event replay', { timeout: 90000 }, async () => {
  const report = await verifySelectedRigidReference();
  assert.equal(report.status, 'passed');
  assert.equal(report.originalFilesVerified, 1786);
  assert.equal(report.gameExecution, false);
  assert.equal(report.nativeStatesUsedToGenerateExpected, false);
  assert.equal(report.nativePlansUsedToGenerateExpected, false);
  assert.ok(report.coldSessions > 0 && report.sourceSteps > 0 && report.selectedRecords > 0);
  assert.ok(report.behaviorChecks > 0 && report.declaredStateInterventions > 0);
});
