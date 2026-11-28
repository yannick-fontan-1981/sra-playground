import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_SC25_ENGINE_ROOT: root, SIC_SC25_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { MotifAccess } = await load('logos-engine/v6-motif-access.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
let acquired;
const record = MotifAccess.prototype.record;
MotifAccess.prototype.record = function (...args) {
  const result = record.apply(this, args);
  acquired.push({ ref: result.ref, status: result.status, mode: result.mode, before: result.before,
    after: result.after, clear: result.grid_cleared, remoteContact: result.remote_color_contact_hypothesis });
  return result;
};
const handle = V6AgentService.prototype.handle, sessions = [];
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  acquired = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const o = message.observation, r = snapshot.trace.findLast(e => e.kind === 'actual_outcome');
    rows.push({ kind: 'return', turn: message.sequence, ref: r?.observation_ref, matched: r?.matched,
      owner: r?.family, reason: r?.reason, levels: o.levelsCompleted, frames: o.frames?.length, acquired,
      packet: createHash('sha256').update(JSON.stringify(o)).digest('hex') });
  }
  if (reply.ticket) {
    const t = reply.ticket, p = snapshot.proposal, plan = p.motif_plan, step = p.steps?.[t.actionIndex];
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, id: t.id, ref: t.observationRef,
      owner: snapshot.lastDecision, action: t.actionRef, point: t.data, offer: p.kind, refs: p.route_refs,
      mode: step?.mode, expected: step?.expected_after, card: plan?.selected, available: plan?.cards,
      translations: plan?.measured_translations, actor: plan?.actor, goal: plan?.homologous_goal });
  }
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
