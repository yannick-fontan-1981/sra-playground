import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { crossedPrefixSlot } from '../src/logos-engine/v6-crossed-prefix-observation.ts';
import { continuityObservation, requireExecutedPrefix } from './sic-continuity-contract.mjs';

export const crossingOwners = new Set(['sic_crossing_rows', 'sic_verify_crossing_rows', 'sic_learn_crossing_rows']);
export const crossingCeilings = [33, 34, 29, 48, 48, 48];
// Actual [commands, native continuations, changed cells, crossing cells,
// physically measured continuations]. Later rooms are deliberately unitary.
export const crossingContinuity = [[27, 10, 15, 7, 9], [28, 0, 0, 0, 0], [24, 0, 0, 0, 0],
  [40, 0, 0, 0, 0], [40, 0, 0, 0, 0], [40, 0, 0, 0, 0]];
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const point = value => Array.isArray(value) && value.length === 2 && value.every(Number.isSafeInteger);
const same = (first, second) => point(first) && point(second) && first.every((value, axis) => value === second[axis]);
const references = value => Array.isArray(value) && value.every(ref => typeof ref === 'string') ? [...value] : [];

function measure(rows, layout) {
  if (!rows || !point(layout.origin) || !point(layout.shape) || !point(layout.pitch) || !point(layout.size)
    || [...layout.shape, ...layout.pitch, ...layout.size].some(value => value <= 0)
    || layout.shape[0] * layout.shape[1] > 64) return null;
  const cells = [];
  for (let y = 0; y < layout.shape[1]; y++) for (let x = 0; x < layout.shape[0]; x++) {
    const pixels = crossedPrefixSlot(rows, layout, [x, y]);
    if (pixels.length !== layout.size[1] || pixels.some(row => row.length !== layout.size[0] || row.some(ink => !Number.isSafeInteger(ink)))) return null;
    cells.push({ cell: [x, y], hash: hash(pixels), center: pixels[Math.floor(pixels.length / 2)][Math.floor(pixels[0].length / 2)] });
  }
  const { origin: [rx, ry], scale: [sx, sy] } = layout.reference;
  const reference = [];
  for (let y = ry; y < ry + sy * layout.shape[1]; y++) for (let x = rx; x < rx + sx * layout.shape[0]; x++) {
    if (!Number.isSafeInteger(rows[y]?.[x])) return null;
    reference.push(rows[y][x]);
  }
  return { cells, frame: hash(rows).slice(0, 16), reference: hash(reference) };
}

// The proposal identifies the acquired role and the public lattice. All cell
// colours, patch changes and frame hashes are measured from actual rasters.
export function captureCrossingContinuity(proposal, ticket, rows) {
  try {
    if (!crossingOwners.has(proposal?.kind) || !ticket || proposal.actions?.[ticket.actionIndex]?.action_ref !== ticket.actionRef) return null;
    const local = proposal.local, choice = proposal.route?.[ticket.actionIndex] ?? proposal.choice;
    if (!local?.layout || !choice?.controller || !point(choice.cell)) return null;
    const { controller, interaction } = choice, expected = choice.crossing
      ? local.layout.reference.values[choice.cell[1]]?.[choice.cell[0]] : controller.color;
    const pair = interaction && local.pairs?.find(pair => pair.commands[controller.axis] === ticket.actionRef
      && pair.commands[interaction.peer.axis] === interaction.input
      && (pair.owner === controller.axis ? controller.color : interaction.peer.color) === expected);
    return { layout: structuredClone(local.layout), actionRef: ticket.actionRef, levelEpoch: local.epoch,
      beforeRef: ticket.observationRef, bindingRef: proposal.binding?.observation_ref ?? null,
      scoreBefore: ticket.levelsCompleted, selecting: choice.selecting, crossing: choice.crossing,
      controller: { key: controller.key, axis: controller.axis, side: controller.side, color: controller.color },
      cell: [...choice.cell], expected, knownCommand: local.axisCommands?.[controller.axis]?.includes(ticket.actionRef) === true,
      initialProgress: local.progress?.[controller.key] ?? null,
      learnedEvidence: [...new Set([...references(local.evidence), ...(pair ? [pair.proof] : [])])],
      peer: interaction ? { axis: interaction.peer.axis, color: interaction.peer.color, input: interaction.input } : null,
      pair: pair ? structuredClone(pair) : null,
      layoutFingerprint: hash([local.layout.origin, local.layout.pitch, local.layout.size, local.layout.shape]),
      before: measure(rows, local.layout), after: null };
  } catch { return null; }
}

export function observeCrossingContinuityReturn(capture, rows) {
  if (!capture) return null;
  const { layout, ...before } = capture;
  try { return { ...before, after: measure(rows, layout) }; }
  catch { return { ...before, after: null }; }
}

export function completeCrossingContinuity(capture, readOwnerState, returned, scoreAfter) {
  if (!capture) return null;
  let acquisition = null;
  try {
    const state = returned?.sealCount === 1 ? (typeof readOwnerState === 'function' ? readOwnerState() : readOwnerState)?.state : null;
    if (state) acquisition = { epoch: state.epoch, evidence: references(state.evidence), selected: state.selected,
      progress: state.progress?.[capture.controller.key] ?? null, stopped: state.stopped };
  } catch { /* An absent acquisition stays absent. */ }
  return { ...capture, afterRef: returned?.outcome?.observation_ref ?? null, scoreAfter, acquisition };
}

// No thresholds are inferred here. The campaign contract can compare measured
// cell advances, crossings and native continuations independently per level.
export function measureCrossingContinuity(issued, groups) {
  const physical = [];
  for (const group of groups.values()) {
    if (group.length < 2 || !group.some(ticket => crossingOwners.has(ticket.outcome?.family))) continue;
    requireExecutedPrefix('WEAV', group);
    assert.ok(group.length <= 16 && group.every((ticket, index) => ticket.actionIndex === index
      && ticket.planId === group[0].planId && ticket.decisionRevision === group[0].decisionRevision
      && ticket.outcome.family === group[0].outcome.family), 'WEAV lost its bounded native decision');
    assert.equal(group.at(-1).sealed, group.length, 'WEAV lost its one final reconciliation');
    const changed = [];
    for (const [index, ticket] of group.entries()) {
      const q = ticket.crossing, before = continuityObservation(q?.beforeRef), after = continuityObservation(q?.afterRef);
      assert.ok(q && crossingOwners.has(ticket.outcome.family) && q.actionRef === ticket.action
        && /^ACTION[1-4]$/.test(ticket.action) && q.selecting === false && q.knownCommand === true
        && before && after && before.scope === after.scope && before.epoch === ticket.level && q.levelEpoch === ticket.level
        && after.revision > before.revision && q.afterRef === ticket.outcome.observation_ref
        && q.before?.frame === before.frame && q.scoreBefore === ticket.level - 1
        && q.bindingRef === group[0].crossing?.beforeRef && ticket.planId === 'sic-plan:' + q.bindingRef,
      'WEAV lost the observed role bound to the actual ticket');
      assert.ok(q.learnedEvidence.length && q.learnedEvidence.every(ref => {
        const proof = continuityObservation(ref);
        return proof && proof.scope === before.scope && proof.epoch <= before.epoch && proof.revision <= before.revision;
      }), 'WEAV lost its acquired input evidence');
      if (q.crossing && q.peer?.color !== q.controller.color) {
        assert.ok(q.pair && q.pair.commands[q.controller.axis] === q.actionRef && q.pair.commands[q.peer.axis] === q.peer.input
          && (q.pair.owner === q.controller.axis ? q.controller.color : q.peer.color) === q.expected
          && q.learnedEvidence.includes(q.pair.proof), 'WEAV crossing lost its learned composition');
      }
      if (index > 0) {
        const prior = group[index - 1].crossing;
        assert.ok(prior.afterRef === q.beforeRef && prior.after?.frame === q.before.frame
          && q.controller.key === prior.controller.key && q.controller.color === prior.controller.color
          && q.layoutFingerprint === prior.layoutFingerprint
          && q.cell[q.controller.axis] === prior.cell[q.controller.axis] - q.controller.side
          && q.cell[1 - q.controller.axis] === prior.cell[1 - q.controller.axis], 'WEAV lost successive measured cell addresses');
      }
      if (ticket.outcome.reason === 'official_boundary') {
        assert.ok(index === group.length - 1 && ticket.outcome.matched === true && ticket.outcome.seal_prefix === true
          && q.scoreAfter === q.scoreBefore + 1, 'WEAV lost its official final return');
        continue;
      }
      const first = q.before.cells.find(item => same(item.cell, q.cell)), last = q.after?.cells.find(item => same(item.cell, q.cell));
      assert.ok(after.epoch === before.epoch && q.scoreAfter === q.scoreBefore && q.after?.frame === after.frame
        && q.before.reference === q.after.reference && first && last && first.hash !== last.hash && last.center === q.expected
        && ticket.outcome.matched === true && ticket.outcome.reason === 'prefix_advanced',
      'WEAV lacks the actual expected cell change');
      changed.push({ index, crossing: q.crossing });
      if (index === group.length - 1) assert.ok(q.acquisition?.epoch === q.levelEpoch && q.acquisition.stopped === false
        && q.acquisition.selected === q.controller.key && q.acquisition.evidence.includes(q.afterRef)
        && q.acquisition.progress === q.initialProgress + group.length, 'WEAV did not acquire its executed advances once');
    }
    if (changed.length >= 2) physical.push({ kind: 'known crossing-cell advances', first: issued.indexOf(group[0]),
      last: issued.indexOf(group.at(-1)), changedCells: changed.length, crossingCells: changed.filter(item => item.crossing).length,
      continuedCells: changed.filter(item => item.index > 0).length });
  }
  return physical;
}

export function requireCrossingContinuity(run, issued, groups) {
  const index = issued[0]?.level - 1, reference = crossingContinuity[index];
  assert.ok(reference && issued.length <= crossingCeilings[index]
    && issued.every(ticket => ticket.resets === 0), 'WEAV exceeded its original ceiling or reset');
  const [actions, native, cells, crossings, continued] = reference;
  const minimum = count => Math.ceil(count * issued.length / actions);
  assert.ok(issued.length - groups.size >= minimum(native), 'WEAV lost its native continuation');
  const physical = measureCrossingContinuity(issued, groups);
  assert.ok(physical.reduce((sum, item) => sum + item.changedCells, 0) >= minimum(cells)
    && physical.reduce((sum, item) => sum + item.crossingCells, 0) >= minimum(crossings)
    && physical.reduce((sum, item) => sum + item.continuedCells, 0) >= minimum(continued),
  'WEAV lost its actual cell advances or acquired crossings');
  return physical;
}
