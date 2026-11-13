import assert from 'node:assert/strict';
import test from 'node:test';
import { runProtocolShapedOpDiagnostic } from '../scripts/measure-op01-op31-protocol-shaped-costs.mjs';

test('protocol-shaped OP diagnostic uses the full restored ABBA schedule without claiming official qualification', async () => {
  const report = await runProtocolShapedOpDiagnostic();
  assert.equal(report.status, 'protocol_shaped_diagnostic_only');
  assert.equal(report.officialPerformanceQualification, false);
  assert.equal(report.result.totals.invocations, 40);
  assert.equal(report.result.totals.measuredSessions, 32);
  assert.equal(report.result.totals.measuredActions, 400);
  assert.equal(report.result.games.STCK.baselineMeasuredSessions, 8);
  assert.equal(report.result.games.STCK.candidateMeasuredSessions, 8);
  assert.equal(report.result.games.SMLP.baselineMeasuredSessions, 8);
  assert.equal(report.result.games.SMLP.candidateMeasuredSessions, 8);

  for (const series of report.result.series) {
    for (const measured of series.measured) {
      assert.equal(measured.sample.metadata?.diagnosticOnly, true);
      assert.equal(measured.sample.metadata?.syntheticCycles, measured.descriptor.actions);
      assert.equal(measured.sample.metadata?.released, measured.descriptor.actions);
    }
  }
});
