import assert from 'node:assert/strict';
import { continuityObservation } from './sic-continuity-contract.mjs';

const owners = new Set(['sic_verify_reference_placement', 'sic_learn_reference_placement']);
const key = cell => JSON.stringify(cell);
const copy = value => value == null ? null : structuredClone(value);
const refs = value => Array.isArray(value) ? value.filter(ref => typeof ref === 'string' && ref.length > 0) : [];

// The retained geometry and measured marker describe what to read. Neither
// planned positions nor expected effects are accepted as physical observations.
export function observePopulationContinuity(rows, proposal, readScene) {
  try {
    if (!owners.has(proposal?.kind) || typeof readScene !== 'function') return null;
    const scene = readScene(rows, proposal.local?.scene);
    if (!scene) return null;
    const patterns = [...(scene.observed_marker_overlays ?? []).map(pixel => [pixel]),
      ...(scene.observed_marker_patterns ?? [])];
    const marked = scene.bodies.filter(body => patterns.some(pattern => pattern.length > 0
      && pattern.every(([dy, dx, ink]) => ink !== body.appearance
        && rows[scene.offset[0] + body.cell[0] * scene.q + dy]?.[scene.offset[1] + body.cell[1] * scene.q + dx] === ink)));
    return { pitch: scene.q, offset: [...scene.offset], reference: scene.reference_digest,
      bodies: scene.bodies.map(body => ({cell: [...body.cell], appearance: body.appearance})),
      selected: marked.length === 1 ? [...marked[0].cell] : null, markerCount: marked.length };
  } catch { return null; }
}

export function capturePopulationControl(proposal, ticket, rows, readScene) {
  try {
    if (!owners.has(proposal?.kind) || !ticket
      || proposal.actions?.[ticket.actionIndex]?.action_ref !== ticket.actionRef) return null;
    const local = proposal.local, delta = local?.controls?.[ticket.actionRef]?.delta;
    return { actionRef: ticket.actionRef, point: ticket.actionRef === 'ACTION6' ? copy(ticket.data) : null,
      levelEpoch: proposal.binding?.level_epoch ?? null, scoreBefore: ticket.levelsCompleted,
      beforeRef: ticket.observationRef, learnedEvidence: refs(local?.evidence),
      knownDelta: Array.isArray(delta) && delta.length === 2 ? [...delta] : null,
      neighborEffectRef: local?.neighborEffectRef ?? null,
      support: local?.support ? { cells: copy(local.support.cells), evidence: refs(local.support.evidence),
        unknownMasks: copy(local.support.unknownMasks ?? []),
        unknownAssigned: (local.support.unknownMasks ?? []).some(mask => local.neighborhood?.[mask] !== undefined) } : null,
      before: observePopulationContinuity(rows, proposal, readScene) };
  } catch { return null; }
}

export function measurePopulationReturn(capture, rows, proposal, readScene, levelsCompleted) {
  if (!capture) return null;
  try {
    const boundary = levelsCompleted > capture.scoreBefore;
    const after = boundary ? null : observePopulationContinuity(rows, proposal, readScene);
    const beforeBodies = capture.before?.bodies ?? [], afterBodies = after?.bodies ?? [];
    const beforeKeys = new Set(beforeBodies.map(body => key(body.cell)));
    const afterKeys = new Set(afterBodies.map(body => key(body.cell)));
    const gone = beforeBodies.filter(body => !afterKeys.has(key(body.cell)));
    const added = afterBodies.filter(body => !beforeKeys.has(key(body.cell)));
    const movement = capture.before && after && gone.length === 1 && added.length === 1
      ? { from: [...gone[0].cell], to: [...added[0].cell] } : null;
    const changedNeighbors = capture.before && after && movement ? beforeBodies.flatMap(body => {
      const current = afterBodies.find(candidate => key(candidate.cell) === key(body.cell));
      const adjacent = cell => cell.reduce((distance, value, axis) => distance + Math.abs(value - body.cell[axis]), 0) === 1;
      return current && current.appearance !== body.appearance && (adjacent(movement.from) || adjacent(movement.to))
        ? [{ cell: [...body.cell], before: body.appearance, after: current.appearance }] : [];
    }) : [];
    return { ...capture, after, movement, changedNeighbors, scoreAfter: levelsCompleted, boundary };
  } catch { return null; }
}

// Read acquisition only after the actual native prefix was sealed. A copied
// prediction cannot manufacture a measured selection, displacement or receipt.
export function completePopulationControl(capture, readOwnerState, continuityReturn) {
  if (!capture) return null;
  try {
    const owner = continuityReturn?.sealCount === 1 ? readOwnerState?.() : null;
    return { ...capture, afterRef: continuityReturn?.outcome?.observation_ref ?? null,
      acquisition: owner ? { epoch: owner.state?.epoch ?? null, frame: owner.state?.frame ?? null,
        evidence: refs(owner.state?.evidence), neighborEffectRef: owner.state?.neighborEffectRef ?? null,
        witnessNeighborEffectRef: owner.witness?.neighborEffectRef ?? null } : null };
  } catch { return null; }
}

function actualMovement(ticket) {
  const p = ticket.population;
  return p?.movement && p.knownDelta && p.before?.markerCount === 1 && p.after?.markerCount === 1
    && key(p.before.selected) === key(p.movement.from) && key(p.after.selected) === key(p.movement.to)
    && p.movement.to.every((value, axis) => value - p.movement.from[axis] === p.knownDelta[axis]);
}

export function measuredPopulationPreparation(run, issued, groups) {
  const prepared = [];
  for (const ticket of issued) {
    const p = ticket.population;
    if (!p) continue;
    const effect = run.steps?.[run.executedTickets.indexOf(ticket)];
    const before = continuityObservation(p.beforeRef), after = continuityObservation(p.afterRef);
    assert.ok(owners.has(ticket.outcome?.family) && p.actionRef === ticket.action
      && before && after && before.scope === after.scope && after.revision > before.revision
      && p.levelEpoch === ticket.level && before.epoch === p.levelEpoch
      && p.scoreBefore === ticket.level - 1 && p.afterRef === ticket.outcome.observation_ref
      && effect?.a === Number(ticket.action.slice(6)) && effect.family === ticket.outcome.family
      && before.frame === effect.from && after.frame === effect.to
      && (p.boundary ? p.scoreAfter === ticket.level && after.epoch >= before.epoch && after.epoch <= before.epoch + 1
        : p.scoreAfter === p.scoreBefore && after.epoch === before.epoch),
    'VOIS receipt is not bound to its actual ticket, public frames, score and epoch');
    for (const ref of [...p.learnedEvidence, ...(p.neighborEffectRef ? [p.neighborEffectRef] : [])]) {
      const learned = continuityObservation(ref);
      assert.ok(learned && learned.scope === before.scope && learned.epoch <= before.epoch
        && learned.revision <= before.revision,
      'VOIS reused a foreign or future learned observation');
    }
    if (p.before && p.after) assert.equal(p.before.reference, p.after.reference,
      'VOIS changed its public reference within a prepared movement');
  }
  const neighborEffects = issued.filter(ticket => ticket.population?.changedNeighbors?.length);
  for (const ticket of neighborEffects) {
    const p = ticket.population;
    assert.ok(ticket.sealCount === 1 && ticket.outcome?.seal_prefix === true,
      'VOIS continued through a newly observed neighbor response');
    assert.equal(p.acquisition?.neighborEffectRef, p.afterRef,
      'VOIS did not acquire the stationary neighbor response from its actual return');
  }
  for (const group of groups.values()) {
    if (group.length < 2 || group[0].action !== 'ACTION6' || !owners.has(group[0].outcome?.family)) continue;
    const first = group[0], p = first.population;
    assert.ok(p?.before && p.after && p.after.markerCount === 1 && p.movement === null,
      'VOIS prepared movement without a unique physical selection');
    assert.deepEqual(p.before.bodies.map(body => body.cell), p.after.bodies.map(body => body.cell),
      'VOIS selection changed the measured population');
    const [row, column] = p.after.selected, [oy, ox] = p.after.offset, q = p.after.pitch;
    assert.ok(p.point && p.point.x >= ox + column * q && p.point.x <= ox + column * q + q - 2
      && p.point.y >= oy + row * q && p.point.y <= oy + row * q + q - 2,
    'VOIS selection mark does not belong to the executed click');
    assert.ok(p.learnedEvidence.length && p.afterRef === group[1].population?.beforeRef,
      'VOIS lost the learned selection receipt before movement');
    for (const ticket of group.slice(1)) {
      const physical = ticket.population;
      assert.ok(physical && ticket.action !== 'ACTION6' && physical.knownDelta,
        'VOIS preparation lost its learned movement');
      assert.ok(actualMovement(ticket) || physical.boundary && ticket === group.at(-1)
        && ticket.outcome?.reason === 'official_boundary' && physical.scoreAfter > physical.scoreBefore,
      'VOIS movement is not supported by the actual selected position or official score');
    }
    for (let index = 0; index + 1 < group.length; index++) {
      assert.equal(group[index].population.afterRef, group[index + 1].population.beforeRef,
        'VOIS lost contiguous public returns within its prepared selection');
    }
    prepared.push(group);
  }
  const supports = issued.filter(ticket => ticket.population?.support?.unknownMasks?.length);
  const admittedSupports = new Set();
  for (const ticket of supports) {
    const p = ticket.population;
    const supportKey = JSON.stringify([p.levelEpoch, p.support.cells, p.support.unknownMasks]);
    if (!admittedSupports.has(supportKey)) {
      assert.equal(p.support.unknownAssigned, false, 'VOIS assigned an unobserved neighborhood response');
      admittedSupports.add(supportKey);
    }
    const acquired = run.executedTickets.find(prior => prior.population?.afterRef === p.neighborEffectRef
      && prior.population.changedNeighbors.length > 0 && prior.sealCount === 1);
    assert.ok(acquired && run.executedTickets.indexOf(acquired) < run.executedTickets.indexOf(ticket),
      'VOIS reused neighbor dependence without a preceding actual stationary response');
  }
  return { preparedSelections: prepared.length, movementsAfterSelection: prepared.reduce((sum, group) => sum + group.length - 1, 0),
    neighborEffects: neighborEffects.length, unknownSupportTickets: supports.length };
}
