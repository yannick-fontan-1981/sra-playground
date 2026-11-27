import assert from 'node:assert/strict';
import { continuityObservation, requireExecutedPrefix } from './sic-continuity-contract.mjs';
import { carrierPreparationOwner, measureCarrierPreparation } from './sic-carrier-preparation-continuity.mjs';

export const carrierPreparationCeilings = [13, 48, 56, 60, 119, 110, 178, 82, 135, 57];
// Actual [commands, continued commands, same carrier, same piece, same auxiliary]
// from chronological 6cd93391 / GitHub b4b6458e, 2026-11-27. The unitary L2–4
// and L9 have no invented physical-continuity floor; all ten wins remain required.
export const carrierPreparationContinuity = [
  [8, 7, 0, 0, 0], [40, 0, 0, 0, 0], [46, 0, 0, 0, 0], [54, 0, 0, 0, 0],
  [99, 38, 29, 3, 0], [91, 18, 21, 1, 10], [148, 87, 87, 23, 18],
  [68, 14, 6, 2, 0], [112, 0, 0, 0, 0], [47, 13, 17, 4, 1],
];
export const carrierPreparationSeriesLevels = new Set(carrierPreparationContinuity.flatMap((row, index) => row[1] ? [index + 1] : []));

export function requireCarrierPreparation(level, issued, groups) {
  const reference = carrierPreparationContinuity[level - 1];
  assert.ok(reference && issued.length > 0 && issued.length <= carrierPreparationCeilings[level - 1]
    && issued.every(ticket => ticket.level === level && ticket.resets === 0), 'LF52 exceeded its original action ceiling or reset');
  const [commands, minimumContinued, ...minimumPhysical] = reference;
  assert.ok(issued.filter(ticket => ticket.actionIndex > 0).length >= Math.min(issued.length - 1,
    Math.ceil(minimumContinued * issued.length / commands)), 'LF52 L' + level + ' lost its executed native continuity');
  for (const group of groups.values()) {
    requireExecutedPrefix('LF52', group);
    assert.ok(group.length <= 16 && group.every((ticket, index) => ticket.actionIndex === index
      && ticket.planId === group[0].planId && ticket.decisionRevision === group[0].decisionRevision),
    'LF52 lost its bounded native prefix identity');
    assert.equal(group.at(-1).sealed, group.length, 'LF52 must reconcile every executed command exactly once');
    if (!group.some(ticket => ticket.outcome.family === carrierPreparationOwner)) continue;
    assert.ok(group.every(ticket => ticket.outcome.family === carrierPreparationOwner), 'LF52 changed owner within a native prefix');
    for (const [index, ticket] of group.entries()) {
      const q = ticket.carrierPreparation, before = continuityObservation(q?.beforeRef), after = continuityObservation(q?.afterRef);
      const official = ticket.outcome.reason === 'official_boundary';
      assert.ok(q && before && after && q.actionRef === ticket.action && q.afterRef === ticket.outcome.observation_ref
        && q.levelEpoch === level && q.scoreBefore === level - 1 && before.epoch === level
        && before.scope === after.scope && after.revision === before.revision + 1
        && q.before?.frame === before.frame && (official && q.after === null || q.after?.frame === after.frame),
      'LF52 carrier measurements lost their actual ticket or frame identities');
      if (index === 0) assert.equal(ticket.planId, 'sic-plan:' + q.beforeRef, 'LF52 lost the initial carrier observation');
      else assert.equal(q.beforeRef, group[index - 1].carrierPreparation.afterRef, 'LF52 lost its ordered actual carrier returns');
      if (index < group.length - 1) assert.equal(q.acquisition, null, 'LF52 acquired before its native prefix ended');
      else if (!official) assert.ok(q.acquisition?.epoch === level
        && q.acquisition.ref === q.afterRef, 'LF52 did not acquire the final actual carrier return');
      // A new level or victory image need not fit the old scan model. It cannot
      // supply a final translated position; only the official score is checked.
      if (official) assert.ok(q.scoreAfter === level && index === group.length - 1
        && ticket.outcome.matched === true && ticket.outcome.seal_prefix === true && [level, level + 1].includes(after.epoch),
      'LF52 lost its official level completion');
      else assert.ok(q.scoreAfter === q.scoreBefore && after.epoch === before.epoch, 'LF52 changed the level inside its carrier prefix');
    }
  }
  const physical = measureCarrierPreparation(issued, groups);
  const kinds = ['same carrier translation', 'same carried piece translation', 'same carried auxiliary translation'];
  for (const [index, kind] of kinds.entries()) assert.ok(physical.filter(effect => effect.kind === kind).length
    >= Math.ceil(minimumPhysical[index] * issued.length / commands), 'LF52 L' + level + ' lost ' + kind);
  return physical;
}
