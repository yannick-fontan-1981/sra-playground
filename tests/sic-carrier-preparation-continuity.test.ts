import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { captureCarrierPreparation, observeCarrierPreparationReturn, completeCarrierPreparation,
  measureCarrierPreparation, carrierPreparationOwner } from '../scripts/sic-carrier-preparation-continuity.mjs';

const captured = JSON.parse(gunzipSync(readFileSync(new URL('../docs/diagnostics/sic-10-lf52-20261127/executed-carrier-prefix.json.gz', import.meta.url))).toString());
function measure() {
  return captured.map((step: any) => {
    const planId = 'sic-plan:' + captured[0].before.observation_ref;
    const ticket = { actionIndex: step.index, actionRef: step.command.action_ref, observationRef: step.before.observation_ref,
      levelsCompleted: step.before.levels_completed };
    const outcome = { ...step.outcome, family: carrierPreparationOwner, index: step.index, sic_plan: planId,
      observation_ref: step.after.observation_ref };
    const returned = { planId, outcomeCount: 1, outcome, sealCount: step.index === 1 ? 1 : 0, sealed: step.index === 1 ? 2 : null };
    const capture = captureCarrierPreparation(step.proposal, ticket, step.first);
    return { action: ticket.actionRef, actionIndex: step.index, ...returned,
      carrierPreparation: completeCarrierPreparation(observeCarrierPreparationReturn(capture, step.second), step.local,
        returned, step.after.levels_completed) };
  });
}
const physical = (tickets: any[]) => measureCarrierPreparation(tickets, new Map([[tickets[0].planId, tickets]]));

test('the passive carrier collector counts the actual repeated translation of one carried piece', () => {
  const tickets = measure(), result = physical(tickets);
  assert.equal(result.filter((item: any) => item.kind === 'same carrier translation').length, 1);
  assert.equal(result.filter((item: any) => item.kind === 'same carried piece translation').length, 1);
  assert.ok(!result.some((item: any) => item.kind === 'same carried auxiliary translation'));
  assert.equal(tickets[1].carrierPreparation.acquisition.ref, tickets[1].outcome.observation_ref);
  assert.ok(!Object.hasOwn(tickets[0].carrierPreparation, 'model'), 'Final evidence omits the temporary scan model');
});

for (const condition of ['offered-only', 'different-decision', 'stale-return', 'unknown-control', 'camera-shift', 'missing-body'] as const)
  test('carrier continuity refuses ' + condition, () => {
    const tickets = measure();
    if (condition === 'offered-only') tickets[1].outcomeCount = 0;
    if (condition === 'different-decision') tickets[1].planId += ':other';
    if (condition === 'stale-return') tickets[1].carrierPreparation.beforeRef = tickets[0].carrierPreparation.beforeRef;
    if (condition === 'unknown-control') tickets[1].carrierPreparation.control.ref = 'unobserved';
    if (condition === 'camera-shift') tickets[1].outcome.reason = 'tracked_population_preserved_across_camera_shift';
    if (condition === 'missing-body') tickets[1].carrierPreparation.after.carriers = [];
    assert.deepEqual(physical(tickets), []);
  });

test('a planned carried effect does not replace missing public cargo', () => {
  const tickets = measure();
  tickets[1].carrierPreparation.after.pegs = [];
  const result = physical(tickets);
  assert.equal(result.filter((item: any) => item.kind === 'same carrier translation').length, 1);
  assert.ok(!result.some((item: any) => item.kind === 'same carried piece translation'));
});
