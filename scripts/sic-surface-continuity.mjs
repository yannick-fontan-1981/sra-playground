import { createHash } from 'node:crypto';

// Passive public raster measurements. No data from this module enters SIC.
export const surfaceOwners = new Set(['sic_switched_surface', 'sic_follow_observed_surface_change']);
const copy = value => value === undefined ? null : structuredClone(value);
const integer = value => Number.isSafeInteger(value) ? value : null;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const vectors = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] };
const cellKey = point => point.join(',');
const addressKey = address => address.floor + '/' + cellKey(address.cell);
const direction = command => Object.keys(vectors).indexOf(command);

export function observeSurfaceOpening(rows, roles, cell) {
  try {
    const size = roles.pitch - 1, x = roles.origin[0] + cell[0] * roles.pitch, y = roles.origin[1] + cell[1] * roles.pitch;
    const sides = [rows[y - 1].slice(x, x + size), rows[y + size].slice(x, x + size),
      rows.slice(y, y + size).map(row => row[x - 1]), rows.slice(y, y + size).map(row => row[x + size])];
    const open = sides.flatMap((pixels, side) => pixels.length === size && pixels.every(ink => ink === roles.gap) ? [side] : []);
    const rim = sides.flatMap((pixels, side) => side === open[0] ? [] : pixels);
    return open.length === 1 && new Set(rim).size === 1 ? open[0] : null;
  } catch { return null; }
}

export function observeSurfaceBoard(rows, roles) {
  try {
    const { origin: [left, top], pitch, actor, support, gap, goal } = roles;
    if (![left, top, pitch, actor, support, gap, goal].every(Number.isSafeInteger)
      || left < 1 || top < 1 || pitch < 4 || new Set([actor, support, gap, goal]).size !== 4
      || !Array.isArray(rows) || !rows.length || !rows.every(row => row.length === rows[0].length)) return null;
    const columns = Math.floor((rows[0].length - left) / pitch), count = Math.floor((rows.length - top) / pitch);
    const right = left + columns * pitch, bottom = top + count * pitch;
    if (right >= rows[0].length || columns * count > 240) return null;
    const rail = rows.slice(0, bottom).map(row => row.slice(right));
    if (new Set(rail.flat()).size < 2) return null;
    const actors = [];
    for (let row = 0; row < count; row++) for (let column = 0; column < columns; column++) {
      const x = left + column * pitch + 1, y = top + row * pitch + 1;
      if ([rows[y]?.[x], rows[y]?.[x + 1], rows[y + 1]?.[x], rows[y + 1]?.[x + 1]].every(ink => ink === actor))
        actors.push({ cell: [column, row], box: [x, y, x + 1, y + 1] });
    }
    if (actors.length !== 1) return null;
    return { address: { floor: hash(rail), cell: actors[0].cell }, actor: actors[0].box, frameHash: hash(rows), frame: copy(rows) };
  } catch { return null; }
}

function rolesFor(proposal, rows) {
  if (proposal.transfer?.roles) return copy(proposal.transfer.roles);
  const model = proposal.scene?.model;
  if (!model?.actor || !model.peer || !Number.isSafeInteger(model.pitch)) return null;
  const origin = model.actor.point.map(value => (value - 1) % model.pitch);
  return { origin, pitch: model.pitch, actor: model.actor.color, goal: model.peer.color,
    support: model.ground, gap: rows[origin[1] - 1]?.[origin[0] - 1] };
}

export function captureSurfaceContinuity(proposal, ticket, rows, readOwnerState) {
  try {
    if (!surfaceOwners.has(proposal?.kind) || !ticket
      || proposal.actions?.[ticket.actionIndex]?.action_ref !== ticket.actionRef) return null;
    const roles = rolesFor(proposal, rows), before = roles && observeSurfaceBoard(rows, roles);
    if (!roles || !before) return null;
    const state = typeof readOwnerState === 'function' ? readOwnerState() : readOwnerState;
    const step = proposal.transfer?.walk?.[ticket.actionIndex];
    const simple = proposal.walk?.[ticket.actionIndex] ?? proposal.step;
    const expectedActor = step?.expected ? [roles.origin[0] + step.expected.cell[0] * roles.pitch + 1,
      roles.origin[1] + step.expected.cell[1] * roles.pitch + 1] : simple?.at ?? null;
    const from = ticket.actionIndex ? proposal.transfer?.walk?.[ticket.actionIndex - 1]?.expected : proposal.transfer?.view?.address;
    const known = step && (proposal.transfer.local.memory.steps[addressKey(before.address) + '/' + step.direction]
      ?? proposal.transfer.local.memory.links[addressKey(step.focus)] ?? null);
    return { actionRef: ticket.actionRef, levelEpoch: integer(proposal.binding?.level_epoch), beforeRef: ticket.observationRef,
      scoreBefore: integer(ticket.levelsCompleted), kind: step?.kind ?? (simple?.floor ? 'move' : 'initial-probe'),
      expectedFrom: copy(from), expectedTo: copy(step?.expected), expectedActor: copy(expectedActor),
      focus: copy(step?.focus), knownPassage: copy(known), roles,
      openingBefore: step?.focus ? observeSurfaceOpening(rows, roles, step.focus.cell) : null,
      learnedEvidence: copy(state?.witness?.refs ?? proposal.scene?.model?.refs ?? []),
      localEvidence: copy(proposal.transfer?.local?.refs ?? proposal.scene?.model?.refs ?? []),
      decisionEvidence: copy(proposal.route_refs ?? []), roleEpoch: integer(state?.witness?.epoch),
      roleScore: integer(state?.witness?.score), passageEvidence: copy(state?.passageEvidence ?? []), before };
  } catch { return null; }
}

export function observeSurfaceReturn(capture, rows) {
  return capture ? { ...capture, after: observeSurfaceBoard(rows, capture.roles),
    openingAfter: capture.focus ? observeSurfaceOpening(rows, capture.roles, capture.focus.cell) : null } : null;
}

export function completeSurfaceContinuity(observed, readOwnerState, returned, scoreAfter) {
  if (!observed) return null;
  let state;
  try { if (returned?.sealCount === 1) state = typeof readOwnerState === 'function' ? readOwnerState() : readOwnerState; } catch { /* Preserve absence. */ }
  const key = addressKey(observed.before.address) + '/' + direction(observed.actionRef);
  return { ...observed, afterRef: returned?.outcome?.observation_ref ?? null, scoreAfter: integer(scoreAfter), acquisition: state ? {
    epoch: integer(state.mapped?.epoch ?? state.model?.epoch), evidence: copy(state.mapped?.refs ?? state.model?.refs ?? []),
    step: copy(state.mapped?.memory?.steps?.[key]), passage: copy(observed.focus && state.mapped?.memory?.links?.[addressKey(observed.focus)]),
    roleEpoch: integer(state.witness?.epoch), roleScore: integer(state.witness?.score),
    roleEvidence: copy(state.witness?.refs ?? []), passageEvidence: copy(state.passageEvidence ?? []),
  } : null };
}
