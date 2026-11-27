import { createHash } from 'node:crypto';

// Passive observation only. These functions are called by the study collector
// when SIC_STUDY_CONTINUITY is enabled, never by the production caller.
export const passageOwners = new Set(['sic_paired_passage', 'sic_follow_paired_passages_after_motion']);
const integer = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const point = value => Array.isArray(value) && value.length === 2 && value.every(Number.isSafeInteger) ? [...value] : null;
const box = value => Array.isArray(value) && value.length === 4 && value.every(Number.isSafeInteger) ? [...value] : null;
const same = (a, b) => !!a && !!b && a.length === b.length && a.every((value, index) => value === b[index]);
const references = values => Array.isArray(values) && values.every(value => typeof value === 'string') ? [...values] : [];
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function observeActor(rows, geometry) {
  const { color, side, floor } = geometry;
  if (!Number.isSafeInteger(color) || !Number.isSafeInteger(side) || side < 2 || side > 4 || !floor.length) return null;
  // Search every retained floor cell rather than substituting the predicted
  // landing for an observation. Duplicate or absent pieces remain unreadable.
  const candidates = floor.filter(([left, top]) => {
    for (let y = top; y < top + side; y++) for (let x = left; x < left + side; x++) {
      if (rows[y]?.[x] !== color) return false;
    }
    for (let offset = 0; offset < side; offset++) {
      if (rows[top - 1]?.[left + offset] === color || rows[top + side]?.[left + offset] === color
        || rows[top + offset]?.[left - 1] === color || rows[top + offset]?.[left + side] === color) return false;
    }
    return true;
  });
  return candidates.length === 1 ? [...candidates[0]] : null;
}

function observeContext(rows, geometry) {
  const samples = geometry.context.map(([left, top, right, bottom]) => {
    const pixels = [];
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const ink = rows[y]?.[x];
      if (!Number.isSafeInteger(ink)) throw Error('Unreadable public passage context');
      pixels.push(ink);
    }
    return pixels;
  });
  return hash(samples);
}

export function capturePassageContinuity(proposal, ticket, rows) {
  try {
    if (!passageOwners.has(proposal?.kind) || !ticket
      || proposal.actions?.[ticket.actionIndex]?.action_ref !== ticket.actionRef) return null;
    const scene = proposal.scene, step = proposal.route?.steps?.[ticket.actionIndex], actor = scene?.actor;
    if (!step || !actor || !scene.floor) return null;
    const actorBox = box(actor.bbox), target = point(step.point);
    if (!actorBox || !target) return null;
    const context = [...(scene.pairs ?? []).flatMap(pair => pair.frames.map(frame => frame.box)),
      ...(scene.unpaired ?? []).map(frame => frame.box), ...(scene.flags ?? []).map(flag => flag.bbox),
      ...(scene.goal?.box ? [scene.goal.box] : []),
      ...(scene.switches?.badge ? [scene.switches.badge] : [])].map(box);
    const floor = Object.values(scene.floor).map(point);
    if (context.some(value => !value) || floor.some(value => !value)) return null;
    const geometry = { color: actor.color, side: actorBox[2] - actorBox[0] + 1,
      floor, context: context.sort((a, b) => a.join(',').localeCompare(b.join(','))) };
    const sites = (scene.switches?.sites ?? []).map(point);
    const role = step.crossing ? 'crossing' : sites.some(site => same(site, target)) ? 'switch' : 'walk';
    return {
      actionRef: ticket.actionRef, levelEpoch: integer(proposal.binding?.level_epoch),
      beforeRef: typeof ticket.observationRef === 'string' ? ticket.observationRef : null,
      scoreBefore: integer(ticket.levelsCompleted), strategy: proposal.sicSituationCard?.strategy ?? null,
      learnedEvidence: references(proposal.memory?.evidence),
      role, neutral: scene.neutral === true, pitch: integer(scene.pitch),
      expectedFrom: point(ticket.actionIndex ? proposal.route.steps[ticket.actionIndex - 1]?.point : actorBox.slice(0, 2)),
      expectedTo: target, actorBefore: observeActor(rows, geometry), contextBefore: observeContext(rows, geometry),
      // Private until the physical return is observed; not written into tickets.
      geometry,
    };
  } catch {
    return null;
  }
}

export function observePassageReturn(capture, rows) {
  if (!capture) return null;
  const { geometry, ...before } = capture;
  try {
    return { ...before, actorAfter: observeActor(rows, geometry), contextAfter: observeContext(rows, geometry) };
  } catch {
    return { ...before, actorAfter: null, contextAfter: null };
  }
}

export function completePassageContinuity(observed, readOwnerState, continuityReturn, levelsCompleted) {
  if (!observed) return null;
  let state = null;
  try {
    if (continuityReturn?.sealCount === 1) state = typeof readOwnerState === 'function' ? readOwnerState() : readOwnerState;
  } catch {
    // Missing acquisition is retained as missing, never inferred from motion.
  }
  return { ...observed,
    afterRef: typeof continuityReturn?.outcome?.observation_ref === 'string' ? continuityReturn.outcome.observation_ref : null,
    scoreAfter: integer(levelsCompleted),
    acquisition: state ? {
      epoch: integer(state.local?.epoch), evidence: references(state.local?.evidence),
      completed: integer(state.previous?.completed), successRef: typeof state.previous?.ref === 'string' ? state.previous.ref : null,
    } : null,
  };
}
