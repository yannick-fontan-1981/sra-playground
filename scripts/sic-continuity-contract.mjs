import assert from 'node:assert/strict';

// A final exploratory contact may have matched=null. Every intermediate
// return must be confirmed, and all actual commands are reconciled once.
export function requireExecutedPrefix(code, group) {
  for (const ticket of group) {
    assert.equal(ticket.outcomeCount, 1, code + ' requires exactly one actual return per ticket');
    assert.ok(typeof ticket.planId === 'string' && ticket.planId.length > 0
      && ticket.outcome?.sic_plan === ticket.planId && ticket.outcome.index === ticket.actionIndex,
    code + ' actual return lost its executed ticket identity');
  }
  for (const ticket of group.slice(0, -1)) {
    assert.equal(ticket.sealCount, 0, code + ' reconciled before its series ended');
    assert.equal(ticket.outcome.matched, true, code + ' continued without a confirmed return');
    assert.equal(ticket.outcome.seal_prefix, false, code + ' continued after its owner closed the prefix');
  }
  assert.equal(group.at(-1).sealCount, 1, code + ' requires exactly one final reconciliation');
}

export function continuityObservation(ref) {
  const match = typeof ref === 'string' && /^(.*):epoch:(\d+):revision:(\d+):frame:([0-9a-f]+)$/.exec(ref);
  return match ? { scope: match[1], epoch: Number(match[2]), revision: Number(match[3]), frame: match[4] } : null;
}
