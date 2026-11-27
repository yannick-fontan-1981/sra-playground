import { createHash } from 'node:crypto';
import { geometricComponents } from '../src/logos-engine/v6-native-observer.ts';

export const publicPanelOwner = 'sic_public_input_exploration';
const copy = value => value === undefined ? null : structuredClone(value);
const box = value => Array.isArray(value) && value.length === 4 && value.every(Number.isSafeInteger) ? [...value] : null;
const same = (a, b) => !!a && !!b && a.length === b.length && a.every((value, index) => value === b[index]);
const contains = (outer, inner) => outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];
const patch = (rows, bounds) => {
  const [left, top, right, bottom] = bounds, values = [];
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    if (!Number.isSafeInteger(rows?.[y]?.[x])) return null;
    values.push(rows[y][x]);
  }
  return values;
};
const digest = values => values ? createHash('sha256').update(JSON.stringify(values)).digest('hex') : null;

export function observePublicPanel(rows, geometry) {
  try {
    if (!rows || !geometry) return null;
    const { field, panel, ink } = geometry;
    if (!box(field) || !box(panel) || !Number.isSafeInteger(ink)) return null;
    const actors = geometricComponents(rows).filter(part => part.color === ink && part.rectangular && part.area === 4
      && part.bbox[2] - part.bbox[0] === 1 && contains(field, part.bbox));
    return { actor: actors.length === 1 ? [...actors[0].bbox] : null, actorCandidates: actors.length,
      panel: digest(patch(rows, panel)), field: digest(patch(rows, field)), frame: copy(rows) };
  } catch { return null; }
}

export function capturePublicPanel(proposal, ticket, rows, readOwnerState) {
  try {
    if (proposal?.kind !== publicPanelOwner || !proposal.panelContinuation
      || proposal.actions?.[ticket?.actionIndex]?.action_ref !== ticket?.actionRef) return null;
    const state = typeof readOwnerState === 'function' ? readOwnerState() : readOwnerState;
    const walker = state?.panelWalker, walk = proposal.panelApproach ?? proposal.panelContact, step = walk?.route?.[ticket.actionIndex];
    const field = box(walk?.field ?? walker?.field ?? proposal.panel?.area), panel = box(proposal.panel?.panel);
    if (!walker || !field || !panel) return null;
    const geometry = { field, panel, ink: walker.ink };
    const contact = proposal.panelComparison?.control ?? proposal.revealedControl ?? null;
    return {
      actionRef: ticket.actionRef, levelEpoch: proposal.binding?.level_epoch ?? null,
      beforeRef: ticket.observationRef, scoreBefore: ticket.levelsCompleted,
      role: step ? 'walk' : proposal.panelComparison ? 'contact' : 'other',
      expectedFrom: box(step?.from), expectedTo: box(step?.to),
      control: copy(walker.controls?.[ticket.actionRef]), contact: copy(contact),
      learnedEffects: copy(state.panelEffects), learnedEvidence: copy(proposal.route_refs),
      before: observePublicPanel(rows, geometry), geometry,
    };
  } catch { return null; }
}

export function observePublicPanelReturn(capture, rows) {
  if (!capture) return null;
  const { geometry, ...before } = capture;
  return { ...before, after: observePublicPanel(rows, geometry) };
}

export function completePublicPanel(observed, readOwnerState, returned, scoreAfter) {
  if (!observed) return null;
  let state;
  try { if (returned?.sealCount === 1) state = typeof readOwnerState === 'function' ? readOwnerState() : readOwnerState; } catch { /* Preserve absence. */ }
  return { ...observed, afterRef: returned?.outcome?.observation_ref ?? null, scoreAfter,
    acquisition: state ? { epoch: state.epoch ?? null, controls: copy(state.panelWalker?.controls), effects: copy(state.panelEffects) } : null };
}
