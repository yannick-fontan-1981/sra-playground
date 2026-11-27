import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readCrossedPiercing, crossedPiercingKey } from '../src/sic/crossed-piercing.ts';
import { continuityObservation, requireExecutedPrefix } from './sic-continuity-contract.mjs';

export const supportSelectionOwner = 'sic_verify_contact_order';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function measure(rows, layout) {
  const scene = readCrossedPiercing(rows, layout.stride, layout);
  return scene ? { frame: hash(rows).slice(0, 16), pose: scene.pose, markings: scene.tints,
    rails: scene.layout.shafts.map(shaft => shaft.links),
    controls: scene.layout.shafts.map(shaft => ({ point: shaft.select, ink: rows[shaft.select[1]][shaft.select[0]] })) } : null;
}

export function captureSupportSelection(proposal, ticket, rows, readOwnerState) {
  if (proposal?.kind !== supportSelectionOwner || !proposal.crossed || !ticket) return null;
  try {
    const { scene, path, active, markings } = proposal.crossed, index = ticket.actionIndex, leg = path[index];
    if (!leg || proposal.actions[index]?.action_ref !== ticket.actionRef) return null;
    const previousActive = path[index - 1]?.active ?? active;
    const beforeMarkings = index > 0 ? markings?.[index - 1] ?? scene.tints : scene.tints;
    const state = (typeof readOwnerState === 'function' ? readOwnerState() : readOwnerState)?.crossed;
    const witness = leg.select ? state?.selections?.find(effect => effect.from === previousActive && effect.to === leg.active
      && effect.action === ticket.actionRef && same(effect.point, leg.select) && same(effect.before, beforeMarkings)) : null;
    return { layout: structuredClone(scene.layout), action: ticket.actionRef, selecting: !!leg.select,
      bindingRef: proposal.binding?.observation_ref, beforeRef: ticket.observationRef, level: ticket.level,
      scoreBefore: ticket.levelsCompleted, previousActive, active: leg.active,
      expected: structuredClone(leg.pose), expectedMarkings: markings?.[index] ?? null,
      witness: witness ? structuredClone(witness) : null,
      evidence: [...(proposal.route_refs ?? [])], before: measure(rows, scene.layout), after: null };
  } catch { return null; }
}

export function observeSupportSelectionReturn(capture, rows) {
  if (!capture) return null;
  const { layout, ...rest } = capture;
  try { return { ...rest, after: measure(rows, layout) }; }
  catch { return { ...rest, after: null }; }
}

export function completeSupportSelection(capture, readOwnerState, returned, scoreAfter) {
  if (!capture) return null;
  let acquisition = null;
  try {
    const state = returned?.sealCount === 1 ? (typeof readOwnerState === 'function' ? readOwnerState() : readOwnerState) : null;
    if (state?.crossed) acquisition = { epoch: state.epoch, active: state.crossed.active, pose: state.crossed.pose,
      refs: [...state.crossed.refs], pending: state.crossed.pending.length, refused: state.refused };
  } catch { /* An absent acquisition is not credited. */ }
  return { ...capture, afterRef: returned?.outcome?.observation_ref ?? null, scoreAfter, acquisition };
}

export function measureSupportSelection(issued, groups) {
  const physical = [];
  for (const group of groups.values()) {
    if (group.length < 2 || !group.some(ticket => ticket.supportSelection)) continue;
    requireExecutedPrefix('SK48', group);
    assert.ok(group.length <= 16 && group.every((ticket, index) => ticket.actionIndex === index
      && ticket.planId === group[0].planId && ticket.decisionRevision === group[0].decisionRevision
      && ticket.outcome.family === supportSelectionOwner), 'SK48 lost its bounded native owner');
    const first = continuityObservation(group[0].supportSelection.beforeRef);
    let selections = 0, movements = 0, continued = 0;
    for (const [index, ticket] of group.entries()) {
      const q = ticket.supportSelection, before = continuityObservation(q?.beforeRef), after = continuityObservation(q?.afterRef);
      assert.ok(q && before && after && q.action === ticket.action && q.level === ticket.level
        && before.scope === after.scope && before.epoch === ticket.level && after.revision > before.revision
        && q.before?.frame === before.frame && q.afterRef === ticket.outcome.observation_ref
        && q.scoreBefore === ticket.level - 1 && q.bindingRef === group[0].supportSelection.beforeRef
        && ticket.planId === 'sic-plan:' + q.bindingRef, 'SK48 lost its public ticket binding');
      assert.ok(q.evidence.length && q.evidence.every(ref => {
        const proof = continuityObservation(ref);
        return proof && proof.scope === before.scope && proof.epoch <= before.epoch && proof.revision <= before.revision;
      }), 'SK48 lost acquired public control evidence');
      if (index > 0) {
        const prior = group[index - 1].supportSelection;
        assert.ok(prior.afterRef === q.beforeRef && prior.after?.frame === q.before.frame
          && same(prior.after.pose, q.before.pose) && same(prior.after.markings, q.before.markings)
          && prior.active === q.previousActive, 'SK48 lost successive measured support returns');
      }
      if (ticket.outcome.reason === 'official_boundary') {
        assert.ok(index === group.length - 1 && ticket.outcome.matched === true && ticket.outcome.seal_prefix === true
          && q.scoreAfter === q.scoreBefore + 1, 'SK48 lost its official final return');
        continue;
      }
      assert.ok(q.after?.frame === after.frame && q.scoreAfter === q.scoreBefore && after.epoch === before.epoch
        && ticket.outcome.matched === true && crossedPiercingKey(q.after.pose) === crossedPiercingKey(q.expected)
        && same(q.after.markings, q.expectedMarkings), 'SK48 lacks the expected actual support return');
      if (q.selecting) {
        const effect = q.witness;
        assert.ok(ticket.action === 'ACTION6' && effect && effect.from === q.previousActive && effect.to === q.active
          && effect.action === q.action && effect.point[0] === ticket.data?.x && effect.point[1] === ticket.data?.y
          && same(q.before.pose, q.after.pose) && same(effect.before, q.before.markings) && same(effect.after, q.after.markings)
          && q.before.markings.every((mark, i) => mark !== q.after.markings[i])
          && q.before.controls[q.active].ink === effect.ink && q.after.controls[q.active].ink === effect.ink,
        'SK48 selection lost its measured effect or preserved stock');
        assert.ok(effect.refs.length === 2 && effect.refs.every(ref => {
          const proof = continuityObservation(ref);
          return proof && proof.scope === first.scope && proof.epoch === first.epoch && proof.revision <= first.revision
            && q.evidence.includes(ref);
        }), 'SK48 selection was not learned before its native prefix');
        selections++;
      } else {
        assert.ok(ticket.action !== 'ACTION6' && q.active === q.previousActive
          && !same(q.before.pose, q.after.pose) && same(q.before.markings, q.after.markings),
        'SK48 lacks actual support motion under a stable selection');
        movements++;
      }
      if (index > 0) continued++;
      if (index === group.length - 1) assert.ok(q.acquisition?.epoch === q.level && q.acquisition.refused === false
        && q.acquisition.active === q.active && q.acquisition.pose === crossedPiercingKey(q.after.pose)
        && q.acquisition.refs.includes(q.afterRef), 'SK48 did not acquire its actual final support state');
    }
    assert.equal(group.at(-1).sealed, group.length, 'SK48 lost its final reconciliation');
    physical.push({ kind: 'observed support movements and selections', first: issued.indexOf(group[0]),
      last: issued.indexOf(group.at(-1)), movements, selections, continued });
  }
  return physical;
}
