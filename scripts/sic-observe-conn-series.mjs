// Observe CONN's actual tickets, returns and newly recorded evidence while running the pinned tests.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_CONN_SOURCE: source, SIC_CONN_RECEIPT: receipt } = process.env;
const load = p => import(pathToFileURL(resolve(source, 'src', p)));
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
const { RecurrentSeriesMemory } = await load('logos-engine/v6-recurrent-series-access.ts');
const sessions = [];
let acquired;
const record = RecurrentSeriesMemory.prototype.record;
RecurrentSeriesMemory.prototype.record = function (...args) {
  const events = record.apply(this, args);
  for (const e of events) acquired.push({ kind: e.kind, source: e.source, after: e.after, epoch: e.epoch,
    length: e.candidate_length, palette: e.palette, own: e.own, other: e.other, blocked: e.blocked_goal_extension });
  return events;
};
const handle = V6AgentService.prototype.handle;
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  acquired = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const r = snapshot.trace.findLast(e => e.kind === 'actual_outcome');
    rows.push({ turn: message.sequence, kind: 'return', ref: r.observation_ref, frames: message.observation.frames.length,
      reason: r.reason, matched: r.matched, acquired });
  }
  if (reply.ticket) {
    const t = reply.ticket, p = snapshot.proposal, plan = p.line_plan ?? p.supported_line_plan;
    const guard = snapshot.trace.findLast(e => e.kind === 'before_guard');
    rows.push({ turn: message.sequence + 1, kind: 'ticket', id: t.id, level: t.level, ref: t.observationRef,
      family: snapshot.lastDecision, offer: p.kind, question: p.question?.reason, guard: guard?.reason,
      admitted: guard?.admitted, action: t.actionRef, point: t.data, route: p.route_refs,
      length: plan?.candidate_length ?? plan?.goal_length, supportFields: plan?.support_fields, target: plan?.target,
      axis: plan?.support_axis, sign: plan?.support_sign });
  } else if (reply.kind === 'stopped') rows.push({ turn: message.sequence + 1, kind: 'stop', reason: snapshot.reason });
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(receipt, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
