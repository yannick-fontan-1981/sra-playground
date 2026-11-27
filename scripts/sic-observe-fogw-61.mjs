import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Load alongside the pinned FOGW test. Observe the service only after it responds.
const { SIC_RECEIVER_SOURCE: root, SIC_RECEIVER_RECEIPT: output } = process.env;
assert.ok(root && output, 'Set SIC_RECEIVER_SOURCE and SIC_RECEIVER_RECEIPT');
const path = resolve(root, 'src/runtime/v6-agent-service.ts');
const { V6AgentService } = await import(pathToFileURL(path).href);
const handle = V6AgentService.prototype.handle;
const sessions = [];
let current;
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') {
    current = [];
    sessions.push(current);
  }
  const response = await handle.call(this, message);
  const snapshot = response.snapshot;
  if (!snapshot || !current) return response;
  if (message.type === 'advance') {
    const result = snapshot.trace.findLast(event => event.kind === 'actual_outcome');
    if (result) current.push({ turn: message.sequence, kind: 'return', ref: result.observation_ref,
      matched: result.matched, reason: result.reason, status: result.status });
  }
  const ticket = response.ticket;
  if (ticket) {
    const p = snapshot.proposal?.reception_service_plan;
    const guard = snapshot.trace.findLast(event => event.kind === 'before_guard');
    current.push({ turn: message.sequence + 1, kind: 'ticket', id: ticket.id, action: ticket.actionRef,
      ref: ticket.observationRef, index: ticket.actionIndex, planRef: p?.observation_ref, plan: p?.kind,
      subjects: p?.scene?.counterparts.map(item => item.request_shape), length: p?.steps?.length,
      waitSpent: p?.memory?.wait_spent, confirmed: p?.steps?.[ticket.actionIndex]?.stationary_confirmed,
      admitted: guard?.admitted, guard: guard?.reason });
  }
  return response;
};
process.on('exit', () => {
  if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' });
});
