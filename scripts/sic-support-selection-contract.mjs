import assert from 'node:assert/strict';
import { requireExecutedPrefix } from './sic-continuity-contract.mjs';
import { measureSupportSelection } from './sic-support-selection-continuity.mjs';

export const supportSelectionCeilings = [24, 45, 40, 35, 40, 83, 96, 51];
// Actual [commands, continued commands, measured movements, measured selections,
// mixed prefixes] from chronological source531e03d6, 2026-11-27. The physical
// observer applies to the crossed supports; earlier stock levels retain their
// native continuity without inventing support measurements. A contradicted
// final stock return at L7 closes its prefix and credits no physical series.
export const supportSelectionContinuity = [
  [19, 13, 0, 0, 0], [39, 35, 0, 0, 0], [33, 30, 0, 0, 0], [33, 25, 0, 0, 0],
  [33, 30, 0, 0, 0], [69, 60, 53, 12, 4], [80, 70, 59, 8, 4], [42, 34, 35, 2, 2],
];

export function requireSupportSelection(level, issued, groups) {
  const reference = supportSelectionContinuity[level - 1];
  assert.ok(reference && issued.length > 0 && issued.length <= supportSelectionCeilings[level - 1]
    && issued.every(ticket => ticket.level === level && ticket.resets === 0),
  'SK48 exceeded its original action ceiling or reset');
  const [commands, minimumContinued, minimumMovements, minimumSelections, minimumMixed] = reference;
  assert.ok(issued.filter(ticket => ticket.actionIndex > 0).length >= Math.min(issued.length - 1,
    Math.ceil(minimumContinued * issued.length / commands)), 'SK48 lost its executed native continuity');
  for (const group of groups.values()) {
    requireExecutedPrefix('SK48', group);
    assert.ok(group.length <= 16 && group.every((ticket, index) => ticket.actionIndex === index
      && ticket.planId === group[0].planId && ticket.decisionRevision === group[0].decisionRevision),
    'SK48 lost its bounded native prefix identity');
    assert.equal(group.at(-1).sealed, group.length, 'SK48 must reconcile its actual commands exactly once');
  }
  const physical = measureSupportSelection(issued, groups);
  const counts = [physical.reduce((n, row) => n + row.movements, 0),
    physical.reduce((n, row) => n + row.selections, 0),
    physical.filter(row => row.movements > 0 && row.selections > 0).length];
  for (const [index, minimum] of [minimumMovements, minimumSelections, minimumMixed].entries())
    assert.ok(counts[index] >= Math.ceil(minimum * issued.length / commands),
      'SK48 L' + level + ' lost its measured ' + ['support movements', 'acquired selections', 'mixed selection and movement prefixes'][index]);
  return physical;
}
