import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { requireOrientedDelivery } from '../scripts/sic-oriented-delivery-contract.mjs';

const historical = JSON.parse(gunzipSync(readFileSync(new URL('../docs/diagnostics/sic-resume-20261126/wa30-continuity.jsonl.gz', import.meta.url))));
const atLevel = (run, level) => structuredClone(run.executedTickets.filter(ticket => ticket.level === level));
function groupsFor(tickets) {
  const groups = new Map();
  for (const ticket of tickets) {
    const group = groups.get(ticket.planId) ?? [];
    group.push(ticket);
    groups.set(ticket.planId, group);
  }
  return groups;
}

test('the oriented contract preserves the historical seven-level native and physical floors', () => {
  for (let level = 1; level <= 7; level++) {
    const tickets = atLevel(historical, level);
    const physical = requireOrientedDelivery(level, tickets, groupsFor(tickets));
    if (level !== 4) assert.ok(physical.some(effect => effect.kind === 'same cargo translation'));
  }
});

for (const condition of ['missingCargo', 'missingContinuation', 'earlyReconciliation', 'incompleteReconciliation', 'foreignReturn', 'contradictedIntermediate'])
  test('the oriented contract rejects ' + condition, () => {
    const tickets = atLevel(historical, 5), groups = groupsFor(tickets);
    const series = [...groups.values()].find(group => group.length > 2);
    assert.ok(series);
    if (condition === 'missingCargo') for (const ticket of tickets) {
      if (ticket.oriented) ticket.oriented.cargoBefore = ticket.oriented.cargoAfter = null;
    }
    if (condition === 'missingContinuation') for (const ticket of tickets) ticket.actionIndex = 0;
    if (condition === 'earlyReconciliation') series[0].sealCount = 1;
    if (condition === 'incompleteReconciliation') series.at(-1).sealed--;
    if (condition === 'foreignReturn') series[0].outcome.observation_ref = series[0].outcome.observation_ref.replace(/^.*?:epoch:/, 'unrelated-session:epoch:');
    if (condition === 'contradictedIntermediate') series[0].outcome.matched = false;
    assert.throws(() => requireOrientedDelivery(5, tickets, groups));
  });
