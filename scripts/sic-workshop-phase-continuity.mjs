import { createHash } from 'node:crypto';

// Passive study instrumentation. Production selection, guards and acquisition
// never call this module or read its measurements.
export const workshopPhaseOwners = new Set(['sic_framed_contact', 'sic_learn_pattern_access']);
const integer = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const point = value => Array.isArray(value) && value.length === 2 && Array.from(value).every(Number.isSafeInteger) ? [...value] : null;
const points = value => Array.isArray(value) && value.length > 0 && Array.from(value).every(item => point(item))
  ? value.map(item => [...item]) : null;
const refs = value => Array.isArray(value) && Array.from(value).every(item => typeof item === 'string' && item.length > 0) ? [...value] : [];
const same = (a, b) => !!a && !!b && a.length === b.length && a.every((value, index) => value === b[index]);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const cycle = value => Array.isArray(value) && value.length >= 2 && value.length <= 12
  && Array.from(value).every(snapshot => points(snapshot)?.length === 3)
  ? value.map(snapshot => snapshot.map(item => [...item])) : null;

function readPixels(rows, [left, top], width, height = width) {
  const pixels = [];
  for (let y = top; y < top + height; y++) for (let x = left; x < left + width; x++) {
    const value = rows[y]?.[x];
    if (!Number.isSafeInteger(value)) throw Error('Unreadable public workshop pixel');
    pixels.push(value);
  }
  return pixels;
}

function measure(rows, geometry) {
  const { pitch, positions, actor, images, shownBox, reserve } = geometry;
  const bodies = [], stations = images.map(() => []);
  // Scan every observed lattice position. The predicted landing and phase are
  // never substituted for a missing, ambiguous or changed public instance.
  for (const at of positions) {
    const pixels = readPixels(rows, at, pitch);
    if (same(pixels, actor)) bodies.push(at);
    images.forEach((image, index) => { if (same(pixels, image)) stations[index].push(at); });
  }
  const display = readPixels(rows, shownBox, shownBox[2] - shownBox[0] + 1, shownBox[3] - shownBox[1] + 1);
  const gauge = readPixels(rows, [reserve.left, reserve.row], reserve.right - reserve.left, 1);
  return { actor: bodies.length === 1 ? [...bodies[0]] : null,
    stations: stations.map(candidates => candidates.length === 1 ? [...candidates[0]] : null),
    glyph: hash(display),
    reserve: gauge.every(ink => ink === reserve.active || ink === reserve.depleted)
      ? gauge.filter(ink => ink === reserve.active).length : null };
}

export function captureWorkshopPhase(proposal, ticket, rows) {
  try {
    if (!workshopPhaseOwners.has(proposal?.kind) || !ticket || proposal.actions?.length < 2
      || proposal.actions?.[ticket.actionIndex]?.action_ref !== ticket.actionRef) return null;
    const local = proposal.glyphWorkshop?.local, step = proposal.glyphWorkshop?.step;
    const layout = local?.layout, leg = step?.walk?.[ticket.actionIndex], knownCycle = cycle(local?.cycle);
    if (!layout || !leg || !knownCycle || !same(point(leg.entry), point(leg.step))) return null;
    const pitch = integer(layout.pitch), positions = points(layout.positions), shownBox = layout.shownBox, reserve = layout.reserve;
    if (!pitch || pitch > 64 || !positions || new Set(positions.map(at => at.join(','))).size !== positions.length
      || !Array.isArray(layout.actor) || layout.actor.length !== pitch ** 2 || !Array.from(layout.actor).every(Number.isSafeInteger)
      || !Array.isArray(shownBox) || shownBox.length !== 4 || !Array.from(shownBox).every(Number.isSafeInteger)
      || shownBox[2] < shownBox[0] || shownBox[3] < shownBox[1]
      || !reserve || ![reserve.row, reserve.left, reserve.right, reserve.active, reserve.depleted].every(Number.isSafeInteger)
      || reserve.right <= reserve.left || !integer(reserve.cost) || reserve.active === reserve.depleted
      || !Array.isArray(layout.stations) || layout.stations.length !== 3) return null;
    const roles = layout.stations.map(station => station.role);
    if (new Set(roles).size !== 3 || !roles.every(role => ['shape', 'color', 'rotation'].includes(role))) return null;
    const images = layout.stations.map(station => typeof station.image === 'string'
      && station.image.split(',').every(value => /^-?\d+$/.test(value)) ? station.image.split(',').map(Number) : []);
    if (images.some(image => image.length !== pitch ** 2 || !image.every(Number.isSafeInteger))
      || new Set(images.map(image => image.join(','))).size !== 3) return null;
    const geometry = { pitch, positions, actor: [...layout.actor], images, shownBox: [...shownBox], reserve: { ...reserve } };
    const before = measure(rows, geometry);
    return { actionRef: ticket.actionRef, levelEpoch: integer(proposal.binding?.level_epoch),
      bindingRef: typeof proposal.binding?.observation_ref === 'string' ? proposal.binding.observation_ref : null,
      beforeRef: typeof ticket.observationRef === 'string' ? ticket.observationRef : null,
      scoreBefore: integer(ticket.levelsCompleted), strategy: proposal.sicSituationCard?.strategy ?? null,
      learnedEvidence: refs(local.refs), pitch, cycle: knownCycle, roles,
      roleFingerprint: hash([pitch, positions, geometry.actor, images, shownBox,
        [reserve.row, reserve.left, reserve.right, reserve.active, reserve.depleted, reserve.cost]]), reserveCost: reserve.cost,
      expectedFrom: point(ticket.actionIndex ? step.walk[ticket.actionIndex - 1]?.step : local.at), expectedTo: point(leg.step),
      actorBefore: before.actor, stationsBefore: before.stations, glyphBefore: before.glyph, reserveBefore: before.reserve,
      geometry };
  } catch {
    return null;
  }
}

export function observeWorkshopPhaseReturn(capture, rows) {
  if (!capture) return null;
  const { geometry, ...before } = capture;
  try {
    const after = measure(rows, geometry);
    return { ...before, actorAfter: after.actor, stationsAfter: after.stations, glyphAfter: after.glyph, reserveAfter: after.reserve };
  } catch {
    return { ...before, actorAfter: null, stationsAfter: null, glyphAfter: null, reserveAfter: null };
  }
}

export function completeWorkshopPhase(observed, readOwnerState, returned, levelsCompleted) {
  if (!observed) return null;
  let acquired = null;
  try {
    if (returned?.sealCount === 1) {
      const state = typeof readOwnerState === 'function' ? readOwnerState() : readOwnerState;
      const local = state?.glyphWorkshop;
      if (local) acquired = { epoch: integer(local.epoch), at: point(local.at), cycle: cycle(local.cycle), evidence: refs(local.refs) };
    }
  } catch {
    // Preserve a missing receipt; never infer acquisition from the forecast.
  }
  return { ...observed,
    afterRef: typeof returned?.outcome?.observation_ref === 'string' ? returned.outcome.observation_ref : null,
    scoreAfter: integer(levelsCompleted), acquisition: acquired };
}
