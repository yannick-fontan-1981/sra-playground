import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { captureCrossingContinuity, observeCrossingContinuityReturn, completeCrossingContinuity,
  measureCrossingContinuity } from '../scripts/sic-crossing-continuity.mjs';

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-crossing-executed-public.json.gz', import.meta.url))).toString());
function collected(crossing = false) {
  return fixture.slice(crossing ? 2 : 0, crossing ? 4 : 2).map((step: any) => {
    const capture = captureCrossingContinuity(step.proposal, step.ticket, step.before);
    const returned = observeCrossingContinuityReturn(capture, step.after);
    return { level: step.ticket.level, decisionRevision: step.ticket.decisionRevision, actionIndex: step.ticket.actionIndex,
      action: step.ticket.actionRef, ...step.returned,
      crossing: completeCrossingContinuity(returned, step.owner, step.returned, step.scoreAfter) };
  });
}
function measured(tickets: any[]) { return measureCrossingContinuity(tickets, new Map([[tickets[0].planId, tickets]])); }

for (const crossing of [false, true]) test('passive crossing continuity binds real ' + (crossing ? 'composed crossings' : 'plain cell advances') + ' to executed native tickets', () => {
  const tickets = collected(crossing), result = measured(tickets);
  assert.equal(result.length, 1);
  assert.equal(result[0].changedCells, 2);
  assert.equal(result[0].crossingCells, crossing ? 2 : 0);
  assert.equal(result[0].continuedCells, 1);
  assert.ok(!Object.hasOwn(tickets[0].crossing, 'layout'), 'Temporary scan geometry is omitted after measurement');
});

for (const condition of ['offered-only', 'different-plan', 'early-acquisition', 'stale-frame', 'unchanged-cell', 'wrong-cell', 'unknown-input', 'missing-pair', 'missing-acquisition'] as const)
  test('crossing continuity refuses ' + condition, () => {
    const tickets = collected(true), last = tickets[1], q = last.crossing;
    if (condition === 'offered-only') last.outcomeCount = 0;
    if (condition === 'different-plan') last.planId += ':other';
    if (condition === 'early-acquisition') tickets[0].sealCount = 1;
    if (condition === 'stale-frame') q.after.frame = q.before.frame;
    if (condition === 'unchanged-cell') q.after.cells = structuredClone(q.before.cells);
    if (condition === 'wrong-cell') q.cell = [99, 99];
    if (condition === 'unknown-input') q.knownCommand = false;
    if (condition === 'missing-pair') q.pair = null;
    if (condition === 'missing-acquisition') q.acquisition = null;
    assert.throws(() => measured(tickets));
  });

test('an absent public return cannot be replaced with the predicted cell', () => {
  const step = fixture[0], capture = captureCrossingContinuity(step.proposal, step.ticket, step.before);
  const missing = observeCrossingContinuityReturn(capture, null);
  assert.equal(missing.after, null);
  const tickets = collected();
  tickets[0].crossing = completeCrossingContinuity(missing, step.owner, step.returned, step.scoreAfter);
  assert.throws(() => measured(tickets));
});
