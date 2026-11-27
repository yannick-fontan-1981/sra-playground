import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { requireCarrierPreparation } from '../scripts/sic-carrier-preparation-contract.mjs';
import { checkRun } from '../scripts/verify-sic-continuity.mjs';

const receipt = JSON.parse(gunzipSync(readFileSync(new URL('../docs/diagnostics/sic-10-lf52-20261127/lf52-strict-6cd93391.jsonl.gz', import.meta.url))));
// The strict runner captured the same native tickets and passive measurements.
// Only its top-level field names differ from the continuity campaign schema.
function campaignReceipt() {
  return { code: receipt.code, solver: receipt.mode, start: 1, initialCompleted: 0,
    parallelWorkers: receipt.parallelWorkers, issued: receipt.actions, sic: receipt.authority,
    levels: structuredClone(receipt.levelStats), executedTickets: structuredClone(receipt.executedTickets) };
}
test('the full continuity gate retains all ten carrier levels in one native session', () => {
  assert.equal(checkRun(campaignReceipt()).length, 10);
  for (const mutation of [
    run => { run.start = 2; },
    run => { run.parallelWorkers = 2; },
    run => { run.levels.pop(); },
    run => { run.executedTickets[0].resets = 1; },
  ]) {
    const run = campaignReceipt(); mutation(run);
    assert.throws(() => checkRun(run));
  }
});
function level(number) {
  const issued = structuredClone(receipt.executedTickets.filter(ticket => ticket.level === number));
  const groups = new Map();
  for (const ticket of issued) { const group = groups.get(ticket.planId) ?? []; group.push(ticket); groups.set(ticket.planId, group); }
  return { issued, groups };
}
test('the complete chronological receipt satisfies native and separate physical carrier requirements', () => {
  assert.equal(receipt.reason, 'target_levels_completed');
  assert.equal(receipt.levels, 10);
  assert.equal(receipt.parallelWorkers, 1);
  assert.equal(receipt.mode, 'sic');
  assert.deepEqual(receipt.recoveries, { reset: 0, undo: 0 });
  assert.equal(receipt.authority, receipt.actions);
  assert.equal(receipt.executedTickets.length, receipt.actions);
  for (const row of receipt.levelStats) {
    assert.ok(row.won && row.actions <= row.budget.actions && row.activeMs <= row.budget.activeTimeMs);
    const { issued, groups } = level(row.level);
    requireCarrierPreparation(row.level, issued, groups);
  }
});
for (const [number, role, message] of [[5, 'carriers', /same carrier/], [8, 'pegs', /same carried piece/], [6, 'auxiliaries', /same carried auxiliary/]])
  test('native walking cannot replace missing physical ' + role, () => {
    const { issued, groups } = level(number);
    for (const ticket of issued) if (ticket.carrierPreparation) {
      if (ticket.carrierPreparation.before) ticket.carrierPreparation.before[role] = [];
      if (ticket.carrierPreparation.after) ticket.carrierPreparation.after[role] = [];
    }
    assert.throws(() => requireCarrierPreparation(number, issued, groups), message);
  });
for (const kind of ['stale frame', 'unexecuted ticket', 'early acquisition', 'missing final acquisition'])
  test('the carrier contract rejects ' + kind, () => {
    const { issued, groups } = level(6), group = [...groups.values()].find(group => group.length > 1);
    if (kind === 'stale frame') group[0].carrierPreparation.before.frame = 'stale';
    if (kind === 'unexecuted ticket') group[0].outcomeCount = 0;
    if (kind === 'early acquisition') group[0].carrierPreparation.acquisition = group.at(-1).carrierPreparation.acquisition;
    if (kind === 'missing final acquisition') group.at(-1).carrierPreparation.acquisition = null;
    assert.throws(() => requireCarrierPreparation(6, issued, groups));
  });
