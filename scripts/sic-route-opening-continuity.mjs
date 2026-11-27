import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { continuityObservation, requireExecutedPrefix } from './sic-continuity-contract.mjs';

export const openingOwner = 'sic_intervene_on_observed_route';
const copy = value => value == null ? null : structuredClone(value);
const refs = value => Array.isArray(value) && value.every(ref => typeof ref === 'string') ? [...value] : [];
const natural = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length
  && a.every((value, index) => value === b[index]);
const frameHash = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16);
const point = (cell, width) => [cell % width, Math.floor(cell / width)];
const directions = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] };

// Geometry and acquired colours identify what to measure. No planned position,
// expected_after value or hypothetical terrain is used as physical evidence.
export function observeOpeningContinuity(rows, grid, roles, target) {
  try {
    const { bounds, pitch, width, height, floor, inset, frame } = grid ?? {};
    if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isSafeInteger)
      || ![pitch, width, height, floor, inset, frame, roles?.actor, roles?.carrier, roles?.wall].every(Number.isSafeInteger)
      || pitch < 4 || width < 3 || height < 3 || width * height > 256
      || !Number.isSafeInteger(target) || target < 0 || target >= width * height) return null;
    const [left, top, right, bottom] = bounds;
    if (left < 0 || top < 0 || right - left !== width * pitch + 1 || bottom - top !== height * pitch + 1
      || !Array.isArray(rows) || bottom >= rows.length
      || rows.slice(top, bottom + 1).some(row => !Array.isArray(row) || right >= row.length)) return null;
    const outline = (x, y, edge, color) => {
      for (let offset = 0; offset < edge; offset++) {
        if (rows[y][x + offset] !== color || rows[y + edge - 1][x + offset] !== color
          || rows[y + offset][x] !== color || rows[y + offset][x + edge - 1] !== color) return false;
      }
      return true;
    };
    for (let x = left; x <= right; x++) if (rows[top][x] !== frame || rows[bottom][x] !== frame) return null;
    for (let y = top; y <= bottom; y++) if (rows[y][left] !== frame || rows[y][right] !== frame) return null;
    const actors = [], carriers = [];
    let wall = null;
    for (let cell = 0; cell < width * height; cell++) {
      const [column, row] = point(cell, width), x = left + 1 + column * pitch, y = top + 1 + row * pitch;
      const controlled = outline(x, y, pitch, roles.actor), inner = [], sprite = [];
      if (controlled) actors.push(cell);
      for (let dy = 1; dy < pitch; dy++) for (let dx = 1; dx < pitch; dx++) {
        const ink = rows[y + dy][x + dx];
        sprite.push(ink);
        if (dy < pitch - 1 && dx < pitch - 1) inner.push(ink);
      }
      const body = controlled ? inner : sprite;
      if (body.filter(ink => ink === roles.carrier).length >= body.length - Number(!controlled)) carriers.push(cell);
      if (cell === target) {
        const free = ink => ink === floor || ink === inset;
        const knownCue = inner[0] === roles.carrier && inner.slice(1).every(free);
        wall = inner.includes(roles.wall) ? true : inner.every(free) || knownCue ? false : null;
      }
    }
    return { actor: actors.length === 1 ? point(actors[0], width) : null,
      carrier: carriers.length === 1 ? point(carriers[0], width) : null,
      actorCount: actors.length, carrierCount: carriers.length,
      target: point(target, width), wall, frame: frameHash(rows) };
  } catch { return null; }
}

export function captureOpeningControl(proposal, ticket, rows, readOwnerState) {
  try {
    if (proposal?.kind !== openingOwner || !ticket
      || proposal.actions?.[ticket.actionIndex]?.action_ref !== ticket.actionRef) return null;
    const owner = readOwnerState?.(), roles = owner?.roles;
    if (!roles) return null;
    const grid = copy(proposal.memory?.grid), target = natural(proposal.choice?.target);
    const role = { actor: roles.actor, carrier: roles.carrier, wall: roles.wall, pitch: roles.pitch,
      epoch: natural(roles.epoch), score: natural(roles.score), routeVerified: roles.routeVerified === true,
      evidence: refs(roles.refs) };
    return { actionRef: ticket.actionRef, levelEpoch: natural(proposal.binding?.level_epoch),
      beforeRef: typeof ticket.observationRef === 'string' ? ticket.observationRef : null,
      scoreBefore: natural(ticket.levelsCompleted), prepared: Array.isArray(proposal.route) && proposal.route.length > 1
        && proposal.choice?.kind === 'open', target, grid, role,
      retainedEvidence: refs(proposal.memory?.refs), recordCountBefore: natural(owner.state?.count),
      before: observeOpeningContinuity(rows, grid, role, target) };
  } catch { return null; }
}

export function measureOpeningReturn(capture, rows, levelsCompleted) {
  if (!capture) return null;
  try {
    return { ...capture, scoreAfter: natural(levelsCompleted),
      after: levelsCompleted === capture.scoreBefore
        ? observeOpeningContinuity(rows, capture.grid, capture.role, capture.target) : null };
  } catch { return null; }
}

export function completeOpeningControl(capture, readOwnerState, returned) {
  if (!capture) return null;
  try {
    const owner = returned?.sealCount === 1 ? readOwnerState?.() : null, state = owner?.state;
    return { ...capture, afterRef: typeof returned?.outcome?.observation_ref === 'string' ? returned.outcome.observation_ref : null,
      acquisition: state ? { epoch: natural(state.epoch), count: natural(state.count), opening: natural(state.opening),
        lastMatched: typeof state.lastMatched === 'boolean' ? state.lastMatched : null,
        evidence: refs(state.refs), roleEvidence: refs(owner.roles?.refs) } : null };
  } catch { return null; }
}

export function measuredOpeningPreparation(run, issued, groups) {
  const offset = run.executedTickets.indexOf(issued[0]);
  const effects = new Map(issued.map((ticket, index) => [ticket, run.steps?.[offset + index]]));
  const known = ticket => {
    const p = ticket.opening, effect = effects.get(ticket), before = continuityObservation(p?.beforeRef), after = continuityObservation(p?.afterRef);
    return p?.prepared === true && p.actionRef === ticket.action && p.role?.routeVerified === true
      && ticket.outcome?.family === openingOwner && p.role.epoch === ticket.level && p.role.score === ticket.level - 1
      && p.levelEpoch === ticket.level && p.scoreBefore === ticket.level - 1 && p.scoreAfter === p.scoreBefore
      && before && after && before.scope === after.scope && before.epoch === p.levelEpoch && after.epoch === before.epoch
      && after.revision > before.revision && p.afterRef === ticket.outcome.observation_ref
      && p.role.evidence.length >= 2 && p.retainedEvidence.length >= 2
      && [...p.role.evidence, ...p.retainedEvidence].every(ref => {
        const observed = continuityObservation(ref);
        return observed && observed.scope === before.scope && observed.epoch <= before.epoch && observed.revision <= before.revision;
      })
      && effect?.a === Number(ticket.action.slice(6)) && effect.family === openingOwner && effect.pixels > 0
      && effect.from === before.frame && effect.to === after.frame
      && p.before?.frame === effect.from && p.after?.frame === effect.to
      && p.before.actorCount === 1 && p.after.actorCount === 1 && p.before.carrierCount === 1 && p.after.carrierCount === 1
      && same(p.before.target, p.after.target);
  };
  const prepared = [];
  for (const group of groups.values()) {
    if (group.length < 2 || !group.some(ticket => ticket.opening?.prepared)) continue;
    requireExecutedPrefix(run.code, group);
    assert.ok(group.every(ticket => known(ticket) && ticket.planId === group[0].planId),
      'ESCT preparation lost its actual learned role, measured grid or bound return');
    const first = group[0], last = group.at(-1), start = first.opening;
    assert.equal(last.action, 'ACTION5', 'ESCT preparation omitted its first opening contact');
    assert.ok(group.slice(0, -1).every((ticket, index) => {
      const p = ticket.opening, delta = directions[ticket.action];
      return delta && p.before.wall === true && p.after.wall === true
        && same(p.before.carrier, start.before.carrier) && same(p.after.carrier, start.before.carrier)
        && same(p.after.actor, p.before.actor.map((value, axis) => value + delta[axis]))
        && p.afterRef === group[index + 1].opening.beforeRef
        && same(p.after.actor, group[index + 1].opening.before.actor);
    }), 'ESCT lost its measured cursor preparation while the same carrier waits');
    const contact = last.opening, acquired = contact.acquisition;
    assert.ok(contact.before.wall === true && contact.after.wall === false
      && same(contact.before.actor, contact.before.target) && same(contact.after.actor, contact.before.target)
      && same(contact.before.carrier, start.before.carrier)
      && last.outcome.matched === true && last.outcome.seal_prefix === true,
    'ESCT contact did not remove the measured target wall at the cursor');
    assert.ok(acquired?.epoch === last.level && acquired.lastMatched === true && acquired.opening === start.target
      && Number.isSafeInteger(start.recordCountBefore) && acquired.count === start.recordCountBefore + group.length
      && group.every(ticket => acquired.evidence.includes(ticket.opening.afterRef))
      && start.role.evidence.every(ref => acquired.roleEvidence.includes(ref)),
    'ESCT final reconciliation did not acquire every actual preparation and preserve the learned role');
    const at = issued.indexOf(first);
    prepared.push({ kind: 'cursor preparation then observed opening', first: at, last: at + group.length - 1 });
  }
  return prepared;
}
