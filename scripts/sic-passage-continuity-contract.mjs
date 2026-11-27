import assert from 'node:assert/strict';
import { continuityObservation, requireExecutedPrefix } from './sic-continuity-contract.mjs';
import { passageOwners } from './sic-passage-continuity.mjs';

export const passageCeilings = [21, 23, 32, 22, 22, 21];
// Actual [commands, continued walks, continued neutral-passage walks],
// chronological 4034654d / GitHub 4b611313, 2026-11-27.
export const passageContinuity = [[16, 10, 0], [18, 12, 12], [26, 17, 17], [19, 11, 11], [19, 10, 10], [18, 5, 5]];
const direction = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] };
const samePoint = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === 2 && b.length === 2
  && a.every((value, axis) => Number.isSafeInteger(value) && value === b[axis]);
const fingerprint = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

// Count actual known walking, not planned route length or unrelated movement.
// Crossings and switch contacts retain their separate observed decisions.
export function measurePassageContinuity(run, issued, groups) {
  const offset = run.executedTickets.indexOf(issued[0]);
  const effects = new Map(issued.map((ticket, index) => [ticket, run.steps?.[offset + index]]));
  const series = [];
  for (const group of groups.values()) {
    if (!group.some(ticket => passageOwners.has(ticket.outcome?.family))) continue;
    assert.ok(group.every(ticket => passageOwners.has(ticket.outcome?.family)), 'PORT mixed passage owners with another family');
    requireExecutedPrefix('PORT', group);
    assert.ok(group.length <= 16 && group.every((ticket, index) => ticket.actionIndex === index
      && ticket.planId === group[0].planId && ticket.decisionRevision === group[0].decisionRevision
      && ticket.outcome.family === group[0].outcome.family), 'PORT lost its bounded native prefix identity');
    assert.equal(group.at(-1).sealed, group.length, 'PORT final reconciliation lost executed commands');
    for (const ticket of group) {
      const p = ticket.passage;
      assert.ok(p && p.actionRef === ticket.action && ['walk', 'crossing', 'switch'].includes(p.role),
        'PORT lost its observed passage role');
      if (p.role !== 'walk') assert.equal(group.length, 1, 'PORT crossed or touched a switch inside a walking series');
    }
    if (group.length < 2) continue;
    assert.equal(group[0].planId, 'sic-plan:' + group[0].passage.beforeRef, 'PORT walking plan lost its initial observation');
    for (const [index, ticket] of group.entries()) {
      const p = ticket.passage, effect = effects.get(ticket), before = continuityObservation(p.beforeRef), after = continuityObservation(p.afterRef);
      const move = direction[ticket.action];
      assert.ok(p.role === 'walk' && p.strategy === 'P07' && move
        && typeof p.neutral === 'boolean' && p.neutral === group[0].passage.neutral
        && Number.isSafeInteger(p.pitch) && p.pitch > 0 && p.levelEpoch === ticket.level
        && p.scoreBefore === ticket.level - 1 && before && after && before.scope === after.scope
        && before.epoch === p.levelEpoch && after.revision > before.revision
        && p.afterRef === ticket.outcome.observation_ref && ticket.outcome.matched === true,
      'PORT walking lost its known role or current actual return');
      assert.ok(Array.isArray(p.learnedEvidence) && p.learnedEvidence.length > 0 && p.learnedEvidence.every(ref => {
        const learned = continuityObservation(ref);
        return learned && learned.scope === before.scope && learned.epoch <= before.epoch && learned.revision <= before.revision;
      }), 'PORT walking lacks acquired evidence from the current session');
      assert.ok(effect?.a === Number(ticket.action.slice(6)) && effect.family === ticket.outcome.family
        && effect.pixels > 0 && effect.from === before.frame && effect.to === after.frame,
      'PORT walking lost the physical effect bound to its actual ticket');
      assert.ok(samePoint(p.actorBefore, p.expectedFrom) && samePoint(p.expectedTo,
        p.actorBefore.map((value, axis) => value + move[axis] * p.pitch)),
      'PORT walking lost its public actor or one-step displacement');
      if (ticket.outcome.reason === 'official_boundary') {
        assert.ok(index === group.length - 1 && p.scoreAfter === ticket.level && ticket.outcome.seal_prefix === true
          && p.acquisition?.completed === ticket.level && p.acquisition.successRef === p.afterRef,
        'PORT final score lost its exact retained passage witness');
      } else {
        assert.ok(p.scoreAfter === p.scoreBefore && after.epoch === before.epoch
          && samePoint(p.actorAfter, p.expectedTo) && fingerprint(p.contextBefore) && p.contextAfter === p.contextBefore,
        'PORT walking changed its actor, indicators, partners or contact context');
        if (index === group.length - 1) assert.ok(p.acquisition?.epoch === p.levelEpoch
          && p.acquisition.evidence.includes(p.afterRef), 'PORT final walking prefix was not reacquired');
      }
      if (index > 0) {
        const prior = group[index - 1].passage;
        assert.ok(prior.afterRef === p.beforeRef && samePoint(prior.actorAfter, p.actorBefore)
          && prior.contextAfter === p.contextBefore, 'PORT walking lost the measured continuity between its returns');
      }
    }
    const first = issued.indexOf(group[0]);
    const last = group.at(-1);
    if (last.outcome.reason !== 'official_boundary' && group.length < 16) {
      const contact = issued[first + group.length], q = contact?.passage, effect = effects.get(contact);
      const returned = continuityObservation(q?.afterRef), before = continuityObservation(last.passage.afterRef);
      assert.ok(contact?.actionIndex === 0 && passageOwners.has(contact.outcome?.family)
        && ['crossing', 'switch'].includes(q?.role) && contact.outcomeCount === 1
        && contact.outcome.matched === true && contact.sealCount === 1 && contact.sealed === 1
        && q.beforeRef === last.passage.afterRef && q.afterRef === contact.outcome.observation_ref
        && samePoint(q.actorBefore, last.passage.actorAfter) && q.contextBefore === last.passage.contextAfter
        && returned && returned.scope === before.scope && returned.revision > before.revision
        && contact.level === last.level && q.levelEpoch === contact.level && before.epoch === q.levelEpoch
        && q.scoreBefore === last.passage.scoreAfter
        && (contact.outcome.reason === 'official_boundary'
          ? q.scoreAfter === q.scoreBefore + 1 && [q.levelEpoch, q.levelEpoch + 1].includes(returned.epoch)
          : q.scoreAfter === q.scoreBefore && returned.epoch === q.levelEpoch)
        && effect?.a === Number(contact.action.slice(6))
        && effect.family === contact.outcome.family && effect.pixels > 0
        && effect.from === before.frame && effect.to === returned.frame,
      'PORT continuous approach lost the separate actual passage contact');
    }
    series.push({ kind: 'known walking between passage contacts', first, last: first + group.length - 1,
      neutral: group[0].passage.neutral === true, continued: group.length - 1 });
  }
  return series;
}
