import assert from 'node:assert/strict';
import { continuityObservation, requireExecutedPrefix } from './sic-continuity-contract.mjs';

export const orientedDeliveryCeilings = [32, 64, 92, 58, 136, 58, 51];
// Actual [commands, continued commands, successive translations of the same cargo].
// The historical seven-level receipt remains the floor for its existing levels.
export const orientedDeliveryContinuity = [
  [26, 5, 1], [59, 18, 7], [76, 22, 10], [48, 0, 0], [113, 59, 41], [48, 24, 15], [42, 20, 13],
];
export const orientedDeliverySeriesLevels = new Set(orientedDeliveryContinuity.flatMap((row, index) => row[1] ? [index + 1] : []));

export function measureOrientedDelivery(issued, groups) {
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === 2 && b.length === 2
    && a.every((value, axis) => Number.isFinite(value) && value === b[axis]);
  const delta = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === 2 && b.length === 2
    && [...a, ...b].every(Number.isFinite) ? b.map((value, axis) => value - a[axis]) : null;
  const ownMove = ticket => {
    const result = ticket.outcome, observed = ticket.oriented;
    if (!observed || typeof ticket.planId !== 'string' || !ticket.planId || ticket.outcomeCount !== 1
      || result?.matched !== true || result.sic_plan !== ticket.planId
      || result.index !== ticket.actionIndex || !['sic_verify_oriented_delivery', 'sic_learn_oriented_delivery'].includes(result.family)
      || !/^ACTION[1-4]$/.test(ticket.action)) return null;
    const movement = delta(observed.poseBefore, observed.poseAfter);
    return movement?.some(value => value !== 0) ? movement : null;
  };
  const physical = [];
  for (const group of groups.values()) for (let index = 1; index < group.length; index++) {
    const before = group[index - 1], after = group[index], a = before.oriented, b = after.oriented;
    const first = ownMove(before), second = ownMove(after);
    if (!first || !second || before.planId !== after.planId || !same(a.poseAfter, b.poseBefore)) continue;
    const start = issued.indexOf(before), end = issued.indexOf(after);
    physical.push({ kind: 'own carrier walk', first: start, last: end });
    if (same(delta(a.cargoBefore, a.cargoAfter), first) && same(delta(b.cargoBefore, b.cargoAfter), second)
      && same(a.cargoAfter, b.cargoBefore)) physical.push({ kind: 'same cargo translation', first: start, last: end });
  }
  assert.ok(physical.some(effect => effect.kind === 'own carrier walk'), 'WA30 lost its measured own-carrier series');
  return physical;
}

export function requireOrientedDelivery(level, issued, groups) {
  const reference = orientedDeliveryContinuity[level - 1];
  assert.ok(reference && issued.length > 0 && issued.length <= orientedDeliveryCeilings[level - 1]
    && issued.every(ticket => ticket.level === level && ticket.resets === 0), 'WA30 exceeded its original action ceiling or reset');
  const [commands, minimumContinued, minimumCargo] = reference;
  assert.ok(issued.filter(ticket => ticket.actionIndex > 0).length >= Math.min(issued.length - 1,
    Math.ceil(minimumContinued * issued.length / commands)), 'WA30 L' + level + ' lost its executed native continuity');
  for (const group of groups.values()) {
    requireExecutedPrefix('WA30', group);
    assert.ok(group.length <= 16 && group.every((ticket, index) => ticket.actionIndex === index
      && ticket.planId === group[0].planId && ticket.decisionRevision === group[0].decisionRevision),
    'WA30 lost its bounded native prefix identity');
    assert.equal(group.at(-1).sealed, group.length, 'WA30 must reconcile every executed command exactly once');
    const first = continuityObservation(group[0].planId.slice('sic-plan:'.length));
    assert.ok(first && first.epoch === level && first.revision === group[0].decisionRevision, 'WA30 lost its opening observation');
    for (const [index, ticket] of group.entries()) {
      const after = continuityObservation(ticket.outcome.observation_ref);
      assert.ok(after && after.scope === first.scope && after.revision === first.revision + index + 1
        && (after.epoch === first.epoch || index === group.length - 1 && ticket.outcome.reason === 'official_boundary'
          && after.epoch === first.epoch + 1), 'WA30 lost its ordered actual observations');
      assert.equal(ticket.outcome.family, group[0].outcome.family, 'WA30 changed owner inside a native prefix');
    }
  }
  const physical = orientedDeliverySeriesLevels.has(level) ? measureOrientedDelivery(issued, groups) : [];
  assert.ok(physical.filter(effect => effect.kind === 'same cargo translation').length
    >= Math.ceil(minimumCargo * issued.length / commands), 'WA30 L' + level + ' lost consecutive translations of the same cargo');
  return physical;
}
