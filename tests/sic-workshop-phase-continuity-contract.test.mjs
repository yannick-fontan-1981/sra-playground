import assert from 'node:assert/strict';
import test from 'node:test';
import { measureWorkshopPhaseContinuity } from '../scripts/sic-workshop-phase-continuity-contract.mjs';
import { workshopPhaseEvidence } from './helpers/sic-workshop-phase-evidence.mjs';

const measure = run => measureWorkshopPhaseContinuity(run, run.executedTickets, new Map([[7, run.executedTickets]]));

test('the physical contract counts ordered station-phase walking with one native acquisition', () => {
  const run = workshopPhaseEvidence().run();
  assert.deepEqual(measure(run), [{ kind: 'observed workshop phase walking', first: 0, last: 2, continued: 2, period: 4 }]);
});

const counterexamples = {
  'lost ticket binding': run => { run.executedTickets[1].outcome.index = 0; },
  'unbound pixel effect': run => { run.steps[1].to = 'wrong-frame'; },
  'repeated stale phase': run => { run.executedTickets[1].workshop.stationsAfter = run.executedTickets[0].workshop.stationsAfter; },
  'expected position replacing observed position': run => { run.executedTickets[1].workshop.actorAfter = null; },
  'ambiguous station': run => { run.executedTickets[1].workshop.stationsAfter[0] = null; },
  'changed displayed glyph': run => { run.executedTickets[1].workshop.glyphAfter = 'a'.repeat(64); },
  'unobserved reserve debit': run => { run.executedTickets[1].workshop.reserveAfter++; },
  'foreign learned phase': run => { run.executedTickets.forEach(t => { t.workshop.learnedEvidence[0] = 'other:epoch:6:revision:20:frame:a'; }); },
  'future learned phase': run => { run.executedTickets.forEach(t => { t.workshop.learnedEvidence[0] = 'phase-study:epoch:6:revision:99:frame:a'; }); },
  'publication before closure': run => { run.executedTickets[0].workshop.acquisition = run.executedTickets[2].workshop.acquisition; },
  'stale acquired phase': run => { run.executedTickets[2].workshop.acquisition.cycle = run.executedTickets[0].workshop.cycle; },
  'missing intermediate acquisition': run => { run.executedTickets[2].workshop.acquisition.evidence = [run.executedTickets[2].workshop.afterRef]; },
  'foreign acquired epoch': run => { run.executedTickets[2].workshop.acquisition.epoch = 99; },
  'continuation after contradiction': run => { run.executedTickets[0].outcome.matched = false; },
  'early sealed prefix': run => { run.executedTickets[0].outcome.seal_prefix = true; },
  'duplicate reconciliation': run => { run.executedTickets[1].sealCount = 1; },
  'missing actual workshop measurement': run => { run.executedTickets[1].workshop = null; },
};
for (const [name, mutate] of Object.entries(counterexamples)) test('the workshop phase contract refuses ' + name, () => {
  const run = workshopPhaseEvidence().run(); mutate(run);
  assert.throws(() => measure(run));
});
