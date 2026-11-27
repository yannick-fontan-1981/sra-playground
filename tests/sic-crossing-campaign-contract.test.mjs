import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { checkRun } from '../scripts/verify-sic-continuity.mjs';

const source = JSON.parse(gunzipSync(readFileSync(new URL('../docs/diagnostics/sic-crossing-active-swatch-20261127/continuity/weav.jsonl.gz', import.meta.url))));
test('six actual crossing levels retain their original ceilings and measured native cell advances', () => {
  assert.equal(checkRun(source).length, 6);
});
test('an official victory cannot substitute for the real changed cell', () => {
  const run = structuredClone(source);
  const ticket = run.executedTickets.find(ticket => ticket.actionIndex > 0 && ticket.crossing?.after);
  assert.ok(ticket);
  ticket.crossing.after = structuredClone(ticket.crossing.before);
  assert.throws(() => checkRun(run), /actual expected cell change/);
});
test('a later unitary level still requires its entire chronological command receipt', () => {
  const run = structuredClone(source);
  run.executedTickets.splice(run.executedTickets.findIndex(ticket => ticket.level === 4), 1);
  assert.throws(() => checkRun(run));
});
test('a crossing series cannot borrow another session’s learned pair', () => {
  const run = structuredClone(source);
  const ticket = run.executedTickets.find(ticket => ticket.crossing?.pair && ticket.actionIndex > 0);
  assert.ok(ticket);
  ticket.crossing.learnedEvidence.push('foreign:epoch:1:revision:1:frame:abcd');
  assert.throws(() => checkRun(run), /acquired input evidence/);
});
