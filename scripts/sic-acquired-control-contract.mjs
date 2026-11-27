import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { continuityObservation, requireExecutedPrefix } from './sic-continuity-contract.mjs';
import { matchingEdgeOwner } from './sic-matching-edge-continuity.mjs';
import { publicPanelOwner } from './sic-public-panel-continuity.mjs';

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const frameHash = rows => Array.isArray(rows) ? createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16) : null;
const positions = pieces => Array.isArray(pieces) ? pieces.map(({ x, y, ink }) => [ink, x, y].join(':')).sort().join('|') : null;
const known = (refs, current, sameEpoch = false) => Array.isArray(refs) && refs.length > 0 && refs.every(ref => {
  const prior = continuityObservation(ref);
  return prior && prior.scope === current.scope && (sameEpoch ? prior.epoch === current.epoch : prior.epoch <= current.epoch)
    && prior.revision <= current.revision;
});
const learnedPair = (refs, current) => Array.isArray(refs) && refs.length === 2 && known(refs, current)
  && continuityObservation(refs[0]).revision < continuityObservation(refs[1]).revision;
function actualTicket(ticket, observed, effect) {
  const before = continuityObservation(observed?.beforeRef), after = continuityObservation(observed?.afterRef);
  assert.ok(before && after && before.scope === after.scope && after.revision > before.revision
    && before.epoch === ticket.level && observed.levelEpoch === ticket.level
    && observed.scoreBefore === ticket.level - 1 && observed.actionRef === ticket.action
    && observed.afterRef === ticket.outcome?.observation_ref && effect?.a === Number(ticket.action.slice(6))
    && effect.family === ticket.outcome.family && effect.from === before.frame && effect.to === after.frame,
  'Acquired control lost its actual command, observation or public return');
  assert.ok(frameHash(observed.before?.frame) === before.frame
    && (!observed.after || frameHash(observed.after.frame) === after.frame),
  'Acquired control measurement lost its captured public pixels');
  return { before, after };
}
function effectMap(run, issued) {
  const offset = run.executedTickets.indexOf(issued[0]);
  return new Map(issued.map((ticket, index) => [ticket, run.steps?.[offset + index]]));
}

export function measureMatchingEdgeContinuity(run, issued, groups) {
  const effects = effectMap(run, issued), series = [];
  for (const group of groups.values()) {
    if (!group.some(ticket => ticket.outcome?.family === matchingEdgeOwner && ticket.edge?.switched)) continue;
    requireExecutedPrefix('GRAV', group);
    assert.ok(group.every(ticket => ticket.outcome?.family === matchingEdgeOwner && ticket.edge?.switched),
      'GRAV mixed attachment role owners or lost measured evidence');
    for (const [index, ticket] of group.entries()) {
      const e = ticket.edge, effect = effects.get(ticket), { before, after } = actualTicket(ticket, e, effect);
      assert.ok(e.roleWins >= 2 && e.before && e.before.pieces.length >= 2 && e.learnedControls,
        'GRAV lost the publicly acquired directional role or measured board');
      const control = e.learnedControls[ticket.action];
      if (ticket.action === 'ACTION5') {
        const witness = e.learnedSwitches?.[e.expectedAttached ? 'attach' : 'release'];
        assert.ok(witness?.input === ticket.action && learnedPair(witness.refs, before)
          || group.length === 1 && ticket.actionIndex === 0,
        'GRAV continued an attachment direction before its actual return was learned');
      } else assert.ok(control && learnedPair(control.refs, before), 'GRAV lost the acquired direction evidence');
      if (ticket.outcome.reason === 'official_boundary') {
        assert.ok(index === group.length - 1 && e.scoreAfter === ticket.level
          && e.acquisition?.wins > e.roleWins && ticket.outcome.matched === true,
        'GRAV score boundary lost its observed and acquired success');
      } else {
        assert.ok(after.epoch === before.epoch && e.scoreAfter === e.scoreBefore && e.after
          && positions(e.after.pieces) === positions(e.expected) && e.after.attached === e.expectedAttached
          && e.after.blockers === e.before.blockers && effect.pixels > 0 && ticket.outcome.matched === true,
        'GRAV lost the measured settling, attachment mode or fixed obstacles');
        if (index === group.length - 1) assert.ok(e.acquisition, 'GRAV final prefix lost its acquired state');
      }
      if (index > 0) assert.ok(group[index - 1].edge.afterRef === e.beforeRef
        && equal(group[index - 1].edge.after, e.before), 'GRAV physical board changed between continued tickets');
      if (index === group.length - 1) {
        const acquired = ticket.action === 'ACTION5'
          ? e.acquisition?.switches?.[e.expectedAttached ? 'attach' : 'release'] : e.acquisition?.controls?.[ticket.action];
        assert.ok(acquired && equal(acquired.refs, [e.beforeRef, e.afterRef]),
          'GRAV final reconciliation lost the actual acquired command return');
      }
    }
    if (group.length > 1) {
      const first = issued.indexOf(group[0]);
      series.push({ kind: 'known settling and attachment', first, last: first + group.length - 1,
        continued: group.length - 1, switches: group.filter(ticket => ticket.action === 'ACTION5').length });
    }
  }
  return series;
}

export function measurePublicPanelContinuity(run, issued, groups) {
  const effects = effectMap(run, issued), preparations = [];
  for (const group of groups.values()) {
    if (group.length < 2 || !group.some(ticket => ticket.panel?.role === 'walk')) continue;
    requireExecutedPrefix('DC22', group);
    assert.ok(group.every(ticket => ticket.outcome?.family === publicPanelOwner && ticket.panel?.role === 'walk'),
      'DC22 lost a bounded public panel approach');
    for (const [index, ticket] of group.entries()) {
      const p = ticket.panel, effect = effects.get(ticket), { before, after } = actualTicket(ticket, p, effect);
      assert.ok(p.before?.actor && p.after?.actor && equal(p.before.actor, p.expectedFrom) && equal(p.after.actor, p.expectedTo)
        && p.control && known([p.control.evidence], before, true) && known(p.learnedEvidence, before, true)
        && p.expectedTo.every((coordinate, axis) => coordinate === p.expectedFrom[axis] + p.control.delta[axis % 2])
        && after.epoch === before.epoch && p.scoreAfter === p.scoreBefore
        && p.before.field !== p.after.field && effect.pixels > 0 && ticket.outcome.matched === true,
      'DC22 lost the actual actor translation supported by an acquired control');
      if (index > 0) assert.ok(group[index - 1].panel.afterRef === p.beforeRef
        && equal(group[index - 1].panel.after.actor, p.before.actor), 'DC22 approach lost successive physical returns');
      if (index === group.length - 1) assert.ok(p.acquisition?.epoch === p.levelEpoch
        && equal(p.acquisition.controls?.[ticket.action], p.control),
      'DC22 final reconciliation lost the acquired walking role');
    }
    const last = group.at(-1), first = issued.indexOf(group[0]), contact = issued[first + group.length], p = contact?.panel;
    if (p?.role !== 'contact') continue;
    requireExecutedPrefix('DC22 contact', [contact]);
    const effect = effects.get(contact), { before, after } = actualTicket(contact, p, effect);
    assert.ok(contact.actionIndex === 0 && contact.outcome.family === publicPanelOwner && contact.action === 'ACTION6'
      && contact.planId !== last.planId && p.beforeRef === last.panel.afterRef
      && equal(p.before?.actor, last.panel.after.actor) && p.learnedEffects?.some(witness =>
        witness.command?.action_ref === contact.action && equal(witness.command.data, contact.data)
        && known([witness.evidence], before, true))
      && effect.pixels > 0 && (p.scoreAfter === ticketScore(contact)
        || after.epoch === before.epoch && p.scoreAfter === p.scoreBefore
          && p.after && (p.after.field !== p.before.field || p.after.panel !== p.before.panel))
      && p.acquisition?.epoch === p.levelEpoch && p.acquisition.effects?.some(witness =>
        witness.command?.action_ref === contact.action && equal(witness.command.data, contact.data)
        && known([witness.evidence], after, true)),
    'DC22 approach lost its separate executed contact and observed physical effect');
    preparations.push({ kind: 'known panel approach then actual contact', first, last: first + group.length - 1,
      contact: first + group.length, continued: group.length - 1 });
  }
  return preparations;
}
const ticketScore = ticket => ticket.level;
