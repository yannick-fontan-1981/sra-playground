import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { checkRun } from '../scripts/verify-sic-continuity.mjs';
import { surfaceCeilings, surfaceContinuity } from '../scripts/sic-surface-continuity-contract.mjs';

const archive = '../docs/diagnostics/sic-surface-goal-access-20261127/continuity/';
const sample = JSON.parse(gunzipSync(readFileSync(new URL(archive + 'etag.jsonl.gz', import.meta.url))));
const lastLevel = run => run.executedTickets.filter(ticket => ticket.level === 6);
const movement = run => lastLevel(run).find(ticket => ticket.surface?.kind === 'move' && ticket.actionIndex === 1);
const crossing = run => lastLevel(run).find(ticket => ticket.surface?.kind === 'probe' && ticket.actionIndex > 0);

test('the complete surface campaign keeps the original ceilings and each measured continuity profile', () => {
  assert.deepEqual(surfaceCeilings, [80, 80, 80, 80, 80, 80]);
  assert.deepEqual(checkRun(sample).map(row => [row.commands, row.continued]), surfaceContinuity.map(row => row.slice(0, 2)));
  const strict = JSON.parse(gunzipSync(readFileSync(new URL('../docs/diagnostics/sic-surface-goal-access-20261127/strict/results.jsonl.gz', import.meta.url))));
  assert.equal(sample.trajectory, strict.trace, 'Passive collection must preserve every public command and animation return');
  assert.equal(sample.issued, 274);
});

for (const [name, mutate, error] of [
  ['another native plan', run => { movement(run).outcome.sic_plan = 'other'; }, /ticket identity/],
  ['intermediate reconciliation', run => { movement(run).sealCount = 1; }, /reconciled before/],
  ['continuation after a contradiction', run => { movement(run).outcome.matched = false; }, /without a confirmed return/],
  ['missing physical observations', run => { delete movement(run).surface; }, /passive observations/],
  ['a foreign acquired role', run => { movement(run).surface.learnedEvidence = ['other:epoch:1:revision:1:frame:aaa']; }, /acquired role/],
  ['a future local observation', run => { const s = movement(run).surface; s.localEvidence = [s.beforeRef.replace(/:revision:\d+:/, ':revision:99999:')]; }, /local map evidence/],
  ['stale role identity', run => { movement(run).surface.roleEpoch = 5; }, /acquired role/],
  ['an invented measured actor', run => { movement(run).surface.after.actor[0]++; }, /public pixels or unique actor/],
  ['forged public pixels', run => { movement(run).surface.after.frame[0][0]++; }, /public pixels or unique actor/],
  ['a predicted movement without its effect', run => { const s = movement(run).surface; s.after = structuredClone(s.before); }, /public pixels or unique actor/],
  ['a shifted expected landing', run => { movement(run).surface.expectedActor[0]++; }, /supported translation/],
  ['an incompatible opening', run => { crossing(run).surface.openingAfter = crossing(run).surface.openingBefore; }, /paired openings/],
  ['an acquired destination invented by planning', run => { crossing(run).surface.expectedTo = crossing(run).surface.after.address; }, /experiment before/],
  ['a lost actual passage acquisition', run => { crossing(run).surface.acquisition.step = null; }, /experiment before/],
  ['premature state acquisition', run => { movement(run).surface.acquisition = {}; }, /before the native prefix closed/],
  ['an unrelated acquired passage', run => { const s = run.executedTickets.find(ticket => ticket.surface?.kind === 'linked').surface; s.knownPassage = null; }, /previously acquired passage/],
  ['a score without acquired completion', run => { lastLevel(run).at(-1).surface.acquisition.roleEvidence = []; }, /official and acquired success/],
  ['a score without contact with the visible goal', run => { lastLevel(run).at(-1).surface.expectedActor[0]++; }, /official and acquired success/],
]) test('surface continuity rejects ' + name, () => {
  const run = structuredClone(sample); mutate(run); assert.throws(() => checkRun(run), error);
});

test('surface qualification requires a complete L1 campaign with no reset', () => {
  const partial = structuredClone(sample); partial.levels.pop();
  assert.throws(() => checkRun(partial), /incomplete campaign/);
  const direct = structuredClone(sample); direct.start = 2;
  assert.throws(() => checkRun(direct), /start at level one/);
  const reset = structuredClone(sample); lastLevel(reset)[0].resets++;
  assert.throws(() => checkRun(reset), /ceiling or reset/);
});
