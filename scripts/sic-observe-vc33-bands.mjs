import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_VC33_ENGINE_ROOT: root, SIC_VC33_RECEIPT: output } = process.env;
const load = path => import(pathToFileURL(resolve(root, 'src', path)));
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
const { BandTransfer } = await load('logos-engine/v6-band-transfer.ts');
const record = BandTransfer.prototype.record;
const sessions = [];
let acquired;
BandTransfer.prototype.record = function (...args) {
  const e = record.apply(this, args);
  if (e) acquired.push({ ref: e.ref, before: e.before, after: e.after, control: e.control,
    signed: e.signed_relation, status: e.status });
  return e;
};
const handle = V6AgentService.prototype.handle;
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  acquired = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const r = snapshot.trace.findLast(e => e.kind === 'actual_outcome');
    rows.push({ kind: 'return', turn: message.sequence, reason: r?.reason, matched: r?.matched,
      ref: r?.observation_ref, frames: message.observation.frames.length, acquired });
  }
  if (reply.ticket) {
    const t = reply.ticket, p = snapshot.proposal, plan = p.band_plan, step = p.steps?.[t.actionIndex];
    const guard = snapshot.trace.findLast(e => e.kind === 'before_guard');
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, id: t.id,
      ref: t.observationRef, family: snapshot.lastDecision, offer: p.kind, action: t.actionRef, data: t.data,
      index: t.actionIndex, expected: step?.expected_after, quantities: step?.quantities, signed: plan?.signed_relation,
      target: plan?.constrained_lengths, axis: plan?.alignment_axis, quantum: plan?.quantum, evidence: p.route_refs,
      admitted: guard?.admitted, guard: guard?.reason });
  } else if (reply.kind === 'stopped') rows.push({ kind: 'stop', turn: message.sequence + 1, reason: snapshot.reason });
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
