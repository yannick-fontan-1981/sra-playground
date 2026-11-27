import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { requireSupportSelection } from '../scripts/sic-support-selection-contract.mjs';
import { measureSupportSelection } from '../scripts/sic-support-selection-continuity.mjs';

const receipt = JSON.parse(gunzipSync(readFileSync(new URL('../docs/diagnostics/sic-ordered-contact-continuity-20261127/physical/sk48-continuity-531e03d6-r3.jsonl.gz', import.meta.url))));
function level(number) {
  const issued = structuredClone(receipt.executedTickets.filter(ticket => ticket.level === number));
  const groups = new Map();
  for (const ticket of issued) { const group = groups.get(ticket.decisionRevision) ?? []; group.push(ticket); groups.set(ticket.decisionRevision, group); }
  return { issued, groups };
}
test('all eight chronological levels retain the original native and physical requirements', () => {
  assert.equal(receipt.start, 1); assert.equal(receipt.initialCompleted, 0);
  assert.equal(receipt.parallelWorkers, 1); assert.equal(receipt.solver, 'sic');
  assert.equal(receipt.issued, 348); assert.equal(receipt.issued, receipt.sic);
  assert.deepEqual(receipt.levels.map(row => row.actions), [19, 39, 33, 33, 33, 69, 80, 42]);
  for (const row of receipt.levels) {
    assert.equal(row.won, true);
    const { issued, groups } = level(row.level);
    requireSupportSelection(row.level, issued, groups);
  }
});
for (const kind of ['missing measurements', 'missing acquired selector', 'foreign selector evidence', 'changed physical markings', 'early reconciliation', 'early acquisition'])
  test('the support campaign refuses ' + kind, () => {
    const { issued, groups } = level(6);
    const group = [...groups.values()].find(group => group.length > 2 && group.some(ticket => ticket.supportSelection?.selecting));
    const selection = group.find(ticket => ticket.supportSelection?.selecting);
    if (kind === 'missing measurements') for (const ticket of issued) delete ticket.supportSelection;
    if (kind === 'missing acquired selector') selection.supportSelection.witness = null;
    if (kind === 'foreign selector evidence') selection.supportSelection.witness.refs = selection.supportSelection.witness.refs.map(ref => 'foreign:' + ref);
    if (kind === 'changed physical markings') selection.supportSelection.after.markings = selection.supportSelection.before.markings;
    if (kind === 'early reconciliation') group[0].sealCount = 1;
    if (kind === 'early acquisition') group[0].supportSelection.acquisition = group.at(-1).supportSelection.acquisition;
    assert.throws(() => requireSupportSelection(6, issued, groups));
  });
test('a contradicted final return closes and acquires the actual pose without crediting a physical series', () => {
  const { issued, groups } = level(7);
  const group = [...groups.values()].find(group => group.length > 1 && group.at(-1).outcome.matched === false);
  const isolated = new Map([[group[0].decisionRevision, group]]);
  assert.deepEqual(measureSupportSelection(issued, isolated), []);
  group.at(-1).supportSelection.acquisition.pending = 1;
  assert.throws(() => measureSupportSelection(issued, isolated), /contradicted support return/);
});
test('a contradicted stock pose cannot be recast as a confirmed expected movement', () => {
  const { issued, groups } = level(7);
  const group = [...groups.values()].find(group => group.length > 1 && group.at(-1).outcome.matched === false);
  group.at(-1).outcome.matched = true;
  assert.throws(() => measureSupportSelection(issued, new Map([[group[0].decisionRevision, group]])), /expected actual support return/);
});
