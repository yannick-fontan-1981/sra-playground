import { createHash } from 'node:crypto';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';

// Passive observer only. The solver never reads these measurements.
export const passengerOwners = new Set(['sic_carry_to_frame', 'sic_learn_transport_from_motion']);
const copy = value => structuredClone(value);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const point = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const box = value => Array.isArray(value) && value.length === 4 && value.every(Number.isSafeInteger);
const center = value => [(value[0] + value[2]) / 2, (value[1] + value[3]) / 2];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const inside = (bounds, x, y) => bounds && x >= bounds[0] && x <= bounds[2] && y >= bounds[1] && y <= bounds[3];
const refs = value => Array.isArray(value) && value.every(item => typeof item === 'string') ? [...value] : [];

function mass(rows, bounds, ink) {
  let visible = 0;
  for (let y = bounds[1]; y <= bounds[3]; y++) for (let x = bounds[0]; x <= bounds[2]; x++) {
    if (!Number.isSafeInteger(rows[y]?.[x])) throw Error('Missing public passenger pixel');
    visible += Number(rows[y][x] === ink);
  }
  return visible;
}

async function measure(rows, geometry) {
  if (!rows) return null;
  const observation = await measureNativeObservation({ frame_rows: rows, frame_hash: hash(rows), level: 1,
    levels_completed: 0, state: 'NOT_FINISHED', available_action_refs: [] }, 1, 'passive-passenger-observer');
  const actors = observation.entities.filter(body => body.signature === geometry.actor);
  const actor = actors.length === 1 && !actors[0].identity_ambiguous ? actors[0] : null;
  const held = geometry.held;
  let carried = null;
  if (held !== null && actor) {
    const passenger = geometry.cargo[held], at = center(actor.bbox);
    const candidates = observation.entities.filter(body => body.palette_value === passenger.ink
      && body.area >= Math.ceil(passenger.area / 2)
      && body.bbox[2] - body.bbox[0] <= passenger.shape[2] - passenger.shape[0] + 3
      && Math.max(...center(body.bbox).map((v, axis) => Math.abs(v - at[axis]))) <= geometry.pickup + 4);
    if (candidates.length === 1 && !candidates[0].identity_ambiguous)
      carried = { box: [...candidates[0].bbox], pixels: mass(rows, candidates[0].bbox, passenger.ink) };
  }
  const passengers = geometry.cargo.map(passenger => ({
    visible: passenger.berths.map(bounds => mass(rows, bounds, passenger.ink)),
    occluded: passenger.berths.map((bounds, bank) => {
      const dx = passenger.centers[bank][0] - center(passenger.shape)[0], shifted = passenger.shape.map((v, axis) => v + (axis % 2 ? 0 : dx));
      let hidden = 0;
      for (let y = shifted[1]; y <= shifted[3]; y++) for (let x = shifted[0]; x <= shifted[2]; x++) {
        if (rows[y]?.[x] !== passenger.ink && (inside(actor?.bbox, x, y) || inside(carried?.box, x, y))) hidden++;
      }
      return hidden;
    }),
  }));
  return { actor: actor ? center(actor.bbox) : null, actorBox: actor ? [...actor.bbox] : null,
    actorCount: actors.length, carried, passengers };
}

export async function capturePassengerContinuity(proposal, ticket, rows) {
  try {
    const run = proposal?.guarded, index = ticket?.actionIndex, leg = run?.plan?.[index];
    if (!passengerOwners.has(proposal?.kind) || !run || !ticket || !leg
      || proposal.actions?.[index]?.action_ref !== ticket.actionRef || leg.input !== ticket.actionRef
      || !Array.isArray(run.ferry?.cargo) || !run.ferry.cargo.length
      || run.ferry.cargo.some(passenger => !box(passenger.shape) || !passenger.berths.every(box)
        || !passenger.centers.every(point) || !Number.isSafeInteger(passenger.ink)
        || !Number.isSafeInteger(passenger.area) || passenger.area < 1)) return null;
    const expectedFrom = index === 0 ? run.at : run.plan[index - 1].expect;
    const geometry = { actor: run.ferry.model.actor, cargo: copy(run.ferry.cargo), held: expectedFrom.held,
      pickup: run.ferry.pickup };
    return { actionRef: ticket.actionRef, role: leg.role, bindingRef: proposal.binding?.observation_ref ?? null,
      beforeRef: ticket.observationRef, levelEpoch: proposal.binding?.level_epoch ?? null,
      scoreBefore: ticket.levelsCompleted, strategy: proposal.sicSituationCard?.strategy ?? null,
      expectedFrom: copy(expectedFrom), expectedTo: copy(leg.expect),
      motion: copy(run.ferry.model.motion[ticket.actionRef] ?? null),
      cargo: run.ferry.cargo.map(passenger => ({ area: passenger.area, ink: passenger.ink })),
      roleFingerprint: hash([run.ferry.model.actor, run.ferry.model.motion, run.ferry.cargo, run.ferry.pickup]),
      learnedEvidence: refs(run.refs), hazards: copy(run.hazards), hazardRefs: refs(run.hazardRefs),
      before: await measure(rows, geometry), geometry };
  } catch { return null; }
}

export async function observePassengerReturn(capture, rows, levelsCompleted) {
  if (!capture) return null;
  const { geometry, ...before } = capture;
  const boundary = levelsCompleted > capture.scoreBefore;
  try {
    return { ...before, boundary, scoreAfter: levelsCompleted,
      after: boundary ? null : await measure(rows, { ...geometry, held: capture.expectedTo.held }) };
  } catch { return { ...before, boundary, scoreAfter: levelsCompleted, after: null }; }
}

export function completePassengerContinuity(capture, readOwnerState, returned) {
  if (!capture) return null;
  let acquisition = null;
  try {
    const acquired = returned?.sealCount === 1 ? readOwnerState?.()?.guarded : null;
    if (acquired) acquisition = { epoch: acquired.epoch, frame: acquired.frame, at: copy(acquired.at),
      evidence: refs(acquired.refs), heldBox: acquired.heldBox ? [...acquired.heldBox] : null,
      hazards: copy(acquired.hazards), hazardRefs: refs(acquired.hazardRefs) };
  } catch { /* An unavailable acquisition remains unknown. */ }
  return { ...capture, afterRef: returned?.outcome?.observation_ref ?? null, acquisition };
}

export function passengerArrangementMeasured(measured, arrangement, cargo) {
  if (!measured || measured.actorCount !== 1 || !same(measured.actor, arrangement.actor)
    || measured.passengers.length !== cargo.length) return false;
  return cargo.every((passenger, index) => {
    if (index === arrangement.held) return !!measured.carried
      && measured.carried.pixels >= Math.ceil(passenger.area / 2);
    const actual = measured.passengers[index], bank = arrangement.banks[index];
    return (bank === 0 || bank === 1) && actual.visible[bank] + actual.occluded[bank] >= Math.ceil(passenger.area / 2)
      && actual.visible[1 - bank] < Math.ceil(passenger.area / 2);
  });
}
