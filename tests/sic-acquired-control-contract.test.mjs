import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { checkRun } from '../scripts/verify-sic-continuity.mjs';
import { matchingEdgeCeilings, publicPanelCeilings } from '../scripts/sic-acquired-control-contract.mjs';

const archive = '../docs/diagnostics/sic-acquired-controls-20261127/continuity/';
const samples = Object.fromEntries(['GRAV', 'DC22'].map(code => [code,
  JSON.parse(gunzipSync(readFileSync(new URL(archive + code.toLowerCase() + '.jsonl.gz', import.meta.url))))]));
const level = (run, number = 6) => run.executedTickets.filter(ticket => ticket.level === number);
function prepared(run) {
  const tickets = level(run), groups = new Map();
  for (const ticket of tickets) {
    const group = groups.get(ticket.decisionRevision) ?? [];
    group.push(ticket); groups.set(ticket.decisionRevision, group);
  }
  const group = [...groups.values()].find(group => group.length > 1 && group.every(ticket => ticket.panel?.role === 'walk')
    && tickets[tickets.indexOf(group.at(-1)) + 1]?.panel?.role === 'contact');
  assert.ok(group);
  return { group, contact: tickets[tickets.indexOf(group.at(-1)) + 1] };
}

test('both complete archived campaigns retain unchanged ceilings, native prefixes and physical compositions', () => {
  assert.deepEqual(matchingEdgeCeilings, [16, 57, 11, 13, 28, 15]);
  assert.deepEqual(publicPanelCeilings, [27, 53, 54, 92, 215, 271]);
  assert.deepEqual(checkRun(samples.GRAV).map(row => [row.commands, row.continued]),
    [[11, 0], [32, 0], [6, 0], [8, 0], [13, 6], [10, 9]]);
  const rows = checkRun(samples.DC22);
  assert.deepEqual(rows.map(row => [row.commands, row.continued]), [[22, 7], [44, 22], [45, 22], [76, 0], [185, 0], [258, 80]]);
  assert.equal(rows[5].physical.split(', ').length, 3, 'Only three actual prepared contacts qualify');
});

for (const [name, mutate, error] of [
  ['another actual plan', run => { level(run)[0].outcome.sic_plan = 'unrelated-plan'; }, /ticket identity/],
  ['an intermediate reconciliation', run => { level(run)[0].sealCount = 1; }, /reconciled before/],
  ['continued execution after contradiction', run => { level(run)[0].outcome.matched = false; }, /without a confirmed return/],
  ['an unacquired switch', run => { const t = level(run).find(t => t.action === 'ACTION5'); t.edge.learnedSwitches = {}; }, /attachment direction before/],
  ['foreign directional proof', run => { const t = level(run)[0]; t.edge.learnedControls[t.action].refs[0] = 'other:epoch:1:revision:1:frame:aaa'; }, /acquired direction evidence/],
  ['missing ordered directional return', run => { const t = level(run)[0]; t.edge.learnedControls[t.action].refs.reverse(); }, /acquired direction evidence/],
  ['a changed physical attachment', run => { level(run)[0].edge.after.attached = false; }, /measured settling/],
  ['a changed fixed obstacle', run => { level(run)[0].edge.after.blockers = 'different'; }, /fixed obstacles/],
  ['forged captured public pixels', run => { level(run)[0].edge.after.frame[0][0] += 1; }, /captured public pixels/],
  ['a lost acquired final return', run => { const t = level(run).at(-1); t.edge.acquisition.controls[t.action].refs.reverse(); }, /actual acquired command return/],
]) test('matching-edge contract rejects ' + name, () => {
  const run = structuredClone(samples.GRAV); mutate(run); assert.throws(() => checkRun(run), error);
});

for (const [name, mutate, error] of [
  ['missing actor measurement', run => { prepared(run).group[0].panel.after.actor = null; }, /actual actor translation/],
  ['ambiguous actor measurement', run => { const p = prepared(run).group[0].panel; p.before.actor = null; p.before.actorCandidates = 2; }, /actual actor translation/],
  ['a predicted position without the physical move', run => { const p = prepared(run).group[0].panel; p.after.actor = [...p.before.actor]; }, /actual actor translation/],
  ['a stale walking role', run => { const p = prepared(run).group[0].panel; p.control.evidence = p.control.evidence.replace(':epoch:6:', ':epoch:5:'); }, /actual actor translation/],
  ['a lost walking acquisition', run => { prepared(run).group.at(-1).panel.acquisition = null; }, /acquired walking role/],
  ['contact coordinates from another command', run => { prepared(run).contact.data.x += 1; }, /actual command/],
  ['a preparation without its actual contact', run => { delete prepared(run).contact.panel; }, /actual physical contact/],
  ['a contact without physical effect', run => { const t = prepared(run).contact; run.steps[run.executedTickets.indexOf(t)].pixels = 0; }, /observed physical effect/],
  ['a contact without acquired effects', run => { prepared(run).contact.panel.acquisition.effects = []; }, /observed physical effect/],
]) test('public-panel contract rejects ' + name, () => {
  const run = structuredClone(samples.DC22); mutate(run); assert.throws(() => checkRun(run), error);
});

test('moving DC22 into a complete campaign preserves its previous level-one mixed-series gate', () => {
  const run = structuredClone(samples.DC22);
  for (const ticket of level(run, 1)) if (ticket.action === 'ACTION6') ticket.action = 'ACTION1';
  assert.throws(() => checkRun(run), /lost its mixed series/);
});

test('both new cohorts require one full chronological campaign without a reset', () => {
  for (const code of ['GRAV', 'DC22']) {
    const incomplete = structuredClone(samples[code]); incomplete.levels.pop();
    assert.throws(() => checkRun(incomplete), /incomplete campaign/);
    const restarted = structuredClone(samples[code]); level(restarted)[0].resets++;
    assert.throws(() => checkRun(restarted), /ceiling or reset/);
  }
});
