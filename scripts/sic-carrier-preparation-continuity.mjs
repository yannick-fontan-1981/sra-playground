import { createHash } from 'node:crypto';
import { reductionScan } from '../src/logos-engine/v6-reduction-transport.ts';

export const carrierPreparationOwner = 'sic_transport_and_reduce_visible_population';
const points = values => [...values].map(value => typeof value === 'string' ? value.split(',').map(Number) : [...value]);
const same = (first, second) => Array.isArray(first) && Array.isArray(second)
  && first.length === 2 && second.length === 2 && first.every((value, index) => Number.isFinite(value) && value === second[index]);
const has = (values, point) => Array.isArray(values) && values.some(value => same(value, point));
function measure(rows, model) {
  if (!rows) return null;
  const scene = reductionScan(rows, model);
  return { carriers: points(scene.carriers), pegs: points(scene.pegs), auxiliaries: points(scene.auxiliaries ?? []),
    frame: createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16) };
}

// Passive snapshots. The raster, observed model and issued ticket are the only
// inputs; neither a planned effect nor a stored trajectory supplies positions.
export function captureCarrierPreparation(proposal, ticket, rows) {
  try {
    if (proposal?.kind !== carrierPreparationOwner || !ticket || !proposal.local?.model
      || proposal.actions?.[ticket.actionIndex]?.action_ref !== ticket.actionRef) return null;
    const local = proposal.local, choice = proposal.directionalSeries?.[ticket.actionIndex] ?? proposal.choice;
    const control = local.controls?.[ticket.actionRef];
    return { model: structuredClone(local.model), stage: choice?.stage ?? null, actionRef: ticket.actionRef,
      beforeRef: ticket.observationRef, scoreBefore: ticket.levelsCompleted, levelEpoch: local.epoch,
      evidence: [...(proposal.route_refs ?? [])],
      control: control ? structuredClone(control) : null,
      source: choice?.source ? [...choice.source] : null,
      landing: choice?.landing ? [...choice.landing] : null,
      before: measure(rows, local.model), after: null };
  } catch { return null; }
}

export function observeCarrierPreparationReturn(capture, rows) {
  if (!capture) return null;
  try { return { ...capture, after: measure(rows, capture.model) }; }
  catch { return { ...capture, after: null }; }
}

export function completeCarrierPreparation(capture, readOwnerState, returned, scoreAfter) {
  if (!capture) return null;
  try {
    const { model: _model, ...publicEvidence } = capture;
    const owner = returned?.sealCount === 1 ? (typeof readOwnerState === 'function' ? readOwnerState() : readOwnerState)?.state : null;
    return { ...publicEvidence, afterRef: returned?.outcome?.observation_ref ?? null, scoreAfter,
      acquisition: owner ? { epoch: owner.epoch, ref: owner.refs?.at(-1) ?? null, stopped: owner.stopped,
        remainingOperations: owner.segment?.path.length ?? 0 } : null };
  } catch { return null; }
}

function measuredTranslation(ticket) {
  const q = ticket.carrierPreparation, outcome = ticket.outcome;
  if (!q?.before || !q.after || q.stage !== 'move' || !/^ACTION[1-4]$/.test(ticket.action)
    || ticket.action !== q.actionRef || ticket.outcomeCount !== 1 || !ticket.planId
    || outcome?.family !== carrierPreparationOwner || outcome.sic_plan !== ticket.planId
    || outcome.index !== ticket.actionIndex || outcome.matched !== true
    || outcome.reason !== 'carrier_and_population_projection_confirmed'
    || q.afterRef !== outcome.observation_ref || q.beforeRef === q.afterRef
    || q.scoreBefore !== q.scoreAfter || !q.control?.ref || !q.evidence.includes(q.control.ref)) return [];
  const parsed = ref => typeof ref === 'string' && /^(.*):epoch:(\d+):revision:(\d+):frame:([0-9a-f]+)$/.exec(ref);
  const learned = parsed(q.control.ref), before = parsed(q.beforeRef), after = parsed(q.afterRef);
  if (!learned || !before || !after || learned[1] !== before[1] || before[1] !== after[1]
    || Number(learned[2]) > Number(before[2]) || Number(learned[3]) > Number(before[3])
    || Number(before[2]) !== q.levelEpoch || Number(after[2]) !== q.levelEpoch
    || Number(after[3]) <= Number(before[3]) || q.before.frame !== before[4] || q.after.frame !== after[4]) return [];
  const vector = q.control.vector;
  if (!Array.isArray(vector) || vector.length !== 2 || !vector.every(Number.isFinite)
    || Math.abs(vector[0]) + Math.abs(vector[1]) !== 1) return [];
  return q.before.carriers.flatMap(from => {
    const to = from.map((value, axis) => value + vector[axis]);
    if (!has(q.after.carriers, to) || has(q.before.carriers, to) || has(q.after.carriers, from)) return [];
    const roles = ['pegs', 'auxiliaries'].filter(role => has(q.before[role], from) && has(q.after[role], to)
      && !has(q.before[role], to) && !has(q.after[role], from));
    return [{ from, to, roles }];
  });
}

// Count physical pairs only inside one executed native decision. A route
// offered by a planner, an unrelated walk or a camera shift cannot qualify.
export function measureCarrierPreparation(issued, groups) {
  const physical = [];
  for (const group of groups.values()) for (let index = 1; index < group.length; index++) {
    const first = group[index - 1], second = group[index];
    if (first.planId !== second.planId || second.actionIndex !== first.actionIndex + 1
      || first.carrierPreparation?.afterRef !== second.carrierPreparation?.beforeRef) continue;
    for (const a of measuredTranslation(first)) for (const b of measuredTranslation(second)) {
      if (!same(a.to, b.from)) continue;
      const span = { first: issued.indexOf(first), last: issued.indexOf(second) };
      physical.push({ kind: 'same carrier translation', ...span });
      for (const role of a.roles.filter(role => b.roles.includes(role)))
        physical.push({ kind: role === 'pegs' ? 'same carried piece translation' : 'same carried auxiliary translation', ...span });
    }
  }
  return physical;
}
