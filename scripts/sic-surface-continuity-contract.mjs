import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { continuityObservation, requireExecutedPrefix } from './sic-continuity-contract.mjs';
import { surfaceOwners, observeSurfaceBoard, observeSurfaceOpening } from './sic-surface-continuity.mjs';

export const surfaceCeilings = [80, 80, 80, 80, 80, 80];
// Actual [commands, continued, crossings in series, acquired crossings,
// continued preparation movements, crossings with continued preparation].
// Frozen be09f7e5 collection; full public trace equals the e531143b strict.
export const surfaceContinuity = [
  [7, 2, 0, 0, 0, 0], [35, 29, 5, 1, 25, 4], [40, 33, 5, 0, 28, 5],
  [46, 37, 7, 0, 30, 7], [66, 55, 9, 0, 46, 9], [80, 67, 11, 0, 56, 11],
];
const equal = isDeepStrictEqual;
const vectors = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] };
const opposite = [1, 0, 3, 2];
const known = (refs, current) => Array.isArray(refs) && refs.length && refs.every(ref => {
  const prior = continuityObservation(ref);
  return prior && prior.scope === current.scope && prior.epoch <= current.epoch && prior.revision <= current.revision;
});

function publicTicket(ticket, surface, effect) {
  const before = continuityObservation(surface?.beforeRef), after = continuityObservation(surface?.afterRef);
  assert.ok(before && after && before.scope === after.scope && after.revision > before.revision
    && before.epoch === ticket.level && surface.levelEpoch === ticket.level && surface.scoreBefore === ticket.level - 1
    && surface.actionRef === ticket.action && surface.afterRef === ticket.outcome?.observation_ref
    && effect?.a === Number(ticket.action.slice(6)) && effect.family === ticket.outcome.family
    && effect.from === before.frame && effect.to === after.frame, 'Surface lost its actual command and public return');
  const first = observeSurfaceBoard(surface.before?.frame, surface.roles);
  const second = surface.after ? observeSurfaceBoard(surface.after.frame, surface.roles) : null;
  assert.ok(first && equal(first, surface.before) && first.frameHash.slice(0, 16) === before.frame
    && (!surface.after || second && equal(second, surface.after) && second.frameHash.slice(0, 16) === after.frame),
  'Surface lost its independently measured public pixels or unique actor');
  return { before, after };
}

export function measureSurfaceContinuity(run, issued, groups) {
  const offset = run.executedTickets.indexOf(issued[0]);
  const effects = new Map(issued.map((ticket, index) => [ticket, run.steps[offset + index]]));
  const series = [];
  for (const group of groups.values()) {
    if (!group.some(ticket => surfaceOwners.has(ticket.outcome?.family))) continue;
    requireExecutedPrefix('ETAG', group);
    assert.ok(group.every(ticket => surfaceOwners.has(ticket.outcome?.family) && ticket.surface), 'Surface lost its passive observations');
    let successful = true, crossings = 0, knownCrossings = 0, preparations = 0, preparedCrossings = 0, preparing = 0;
    for (const [index, ticket] of group.entries()) {
      const s = ticket.surface, effect = effects.get(ticket), { before, after } = publicTicket(ticket, s, effect);
      if (ticket.level > 1) assert.ok(s.roleEpoch === ticket.level && s.roleScore === ticket.level - 1
        && known(s.learnedEvidence, before) && known(s.localEvidence, before), 'Surface lost the acquired role or local map evidence');
      if (group.length > 1) assert.ok(known(s.learnedEvidence, before), 'Surface continued without earlier acquired role evidence');
      if (index > 0) assert.ok(group[index - 1].surface.afterRef === s.beforeRef
        && equal(group[index - 1].surface.after, s.before), 'Surface changed between continued native tickets');
      if (ticket.outcome.reason === 'official_boundary') {
        const target = s.expectedActor, delta = vectors[ticket.action];
        const targetInk = target && [s.before.frame[target[1]]?.[target[0]], s.before.frame[target[1]]?.[target[0] + 1],
          s.before.frame[target[1] + 1]?.[target[0]], s.before.frame[target[1] + 1]?.[target[0] + 1]];
        assert.ok(index === group.length - 1 && s.scoreAfter === ticket.level && ticket.outcome.matched === true
          && s.acquisition?.roleScore === ticket.level && s.acquisition.roleEvidence.includes(s.afterRef)
          && targetInk?.every(ink => ink === s.roles.goal) && delta
          && target[0] === s.before.actor[0] + delta[0] * s.roles.pitch
          && target[1] === s.before.actor[1] + delta[1] * s.roles.pitch,
        'Surface completion lost its official and acquired success');
        continue;
      }
      assert.ok(after.epoch === before.epoch && s.scoreAfter === s.scoreBefore, 'Surface return crossed an unobserved score boundary');
      if (ticket.outcome.matched !== true) { successful = false; continue; }
      assert.ok(s.after && effect.pixels > 0, 'Surface confirmed a movement without a physical return');
      const delta = vectors[ticket.action];
      if (s.kind === 'move') {
        assert.ok(delta && s.before.address.floor === s.after.address.floor
          && s.after.actor[0] === s.before.actor[0] + delta[0] * s.roles.pitch
          && s.after.actor[1] === s.before.actor[1] + delta[1] * s.roles.pitch
          && equal(s.after.actor.slice(0, 2), s.expectedActor), 'Surface lost its actual supported translation');
        if (index > 0) preparing++;
      } else if (s.kind === 'linked' || s.kind === 'probe') {
        assert.ok(s.before.address.floor !== s.after.address.floor && equal(s.after.address.cell, s.focus?.cell)
          && s.openingBefore !== null && s.openingAfter === opposite[s.openingBefore]
          && s.openingBefore === observeSurfaceOpening(s.before.frame, s.roles, s.focus.cell)
          && s.openingAfter === observeSurfaceOpening(s.after.frame, s.roles, s.focus.cell),
        'Surface crossing lost its measured arrival or paired openings');
        if (s.kind === 'linked') assert.ok(equal(s.expectedTo, s.knownPassage) && equal(s.after.address, s.expectedTo),
          'Surface continued crossing lost its previously acquired passage');
        else assert.ok(s.expectedTo === null && index === group.length - 1
          && s.acquisition && equal(s.acquisition.step, s.after.address), 'Surface acquired an experiment before its actual crossing closed');
        crossings++;
        if (s.kind === 'linked') knownCrossings++;
        preparations += preparing;
        if (preparing > 0) preparedCrossings++;
        preparing = 0;
      }
      if (index === group.length - 1) assert.ok(s.acquisition && s.acquisition.evidence.includes(s.afterRef),
        'Surface final reconciliation lost its actual return');
      else assert.equal(s.acquisition, null, 'Surface acquired state before the native prefix closed');
    }
    if (successful && group.length > 1) {
      const first = issued.indexOf(group[0]);
      series.push({ kind: 'surface route and measured passage', first, last: first + group.length - 1,
        continued: group.length - 1, crossings, knownCrossings, preparations, preparedCrossings });
    }
  }
  return series;
}
