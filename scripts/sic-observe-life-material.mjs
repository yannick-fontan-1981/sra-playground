import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { SIC_LIFE_ENGINE_ROOT: root, SIC_LIFE_RECEIPT: output } = process.env;
const load = path => import(pathToFileURL(resolve(root, 'src', path)));
const { AnimatedContactAccess } = await load('logos-engine/v6-animated-contact.ts');
const { TypedMaterialMemory } = await load('logos-engine/v6-typed-material-access.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
const sessions = [];
let acquired;
for (const [owner, method] of [[AnimatedContactAccess, 'recordPacket'], [TypedMaterialMemory, 'record']]) {
  const record = owner.prototype[method];
  owner.prototype[method] = function (...args) {
    const events = record.apply(this, args);
    for (const e of events ?? []) {
      acquired.push({ kind: e.kind, mode: e.mode, effect: e.effect, evidence: e.evidence,
        model: e.model, packetFrames: e.packet_frames, changed: e.changed_public_pixels?.length,
        context: e.contact_context?.kind, child: e.child?.id,
        children: e.added_children?.map(c => ({ id: c.id, ref: c.source_ref })) });
    }
    return events;
  };
}
const handle = V6AgentService.prototype.handle;
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  acquired = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), s = reply.snapshot;
  if (message.type === 'advance') {
    const r = s.trace.findLast(e => e.kind === 'actual_outcome');
    rows.push({ kind: 'return', turn: message.sequence, ref: r?.observation_ref, owner: r?.family,
      matched: r?.matched, reason: r?.reason, acquired, frames: message.observation.frames.length });
  }
  if (reply.ticket) {
    const t = reply.ticket, p = s.proposal, c = p.typed_carrier_plan, f = p.material_flow_plan;
    const guard = s.trace.findLast(e => e.kind === 'before_guard');
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, ref: t.observationRef, id: t.id,
      owner: s.lastDecision, entry: p.field_subquestion, offer: p.kind, action: t.actionRef, point: t.data,
      guard: guard?.admitted, evidence: p.route_refs, subjects: c?.scene?.carriers?.map(r => r.point),
      selected: c?.contact_context?.selected?.point, child: f?.child?.id, childSource: f?.child?.source_ref,
      target: f?.target?.bbox, mode: f?.mode });
  } else if (reply.kind === 'stopped') rows.push({ kind: 'stop', turn: message.sequence + 1, reason: reply.reason });
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
