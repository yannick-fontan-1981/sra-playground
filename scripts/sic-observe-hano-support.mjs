import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_HANO_ENGINE_ROOT: root, SIC_HANO_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { OrderedSupportTransfer } = await load('logos-engine/v6-ordered-support.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
let acquired;
const record = OrderedSupportTransfer.prototype.record;
OrderedSupportTransfer.prototype.record = async function (...args) {
  const result = await record.apply(this, args);
  for (const e of result.events) {
    acquired.push({ kind: e.kind, before: e.before, after: e.after, epoch: e.origin_epoch,
      selection: e.selection_observed, transfer: e.transfer_observed, progress: e.official_progress,
      parent: e.parent, closed: [...this.closed].sort() });
  }
  return result;
};
const handle = V6AgentService.prototype.handle, sessions = [];
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  acquired = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), s = reply.snapshot;
  if (message.type === 'advance') {
    const r = s.trace.findLast(e => e.kind === 'actual_outcome'), o = message.observation;
    rows.push({ kind: 'return', turn: message.sequence, ref: r?.observation_ref, owner: r?.family, matched: r?.matched,
      reason: r?.reason, seal: r?.seal_prefix, levels: o.levelsCompleted, acquired,
      frame: createHash('sha256').update(JSON.stringify(o.frame)).digest('hex') });
  }
  if (reply.ticket) {
    const t = reply.ticket, p = s.proposal, plan = p.support_plan, ordered = plan?.ordered_support_transfer ? plan : null;
    const bbox = ordered?.member.bbox;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, id: t.id, ref: t.observationRef, level: t.level,
      owner: s.lastDecision, offer: p.kind, action: t.actionRef, point: t.data, index: t.actionIndex,
      configuration: ordered?.scene.configuration, source: ordered?.source, destination: ordered?.destination,
      member: bbox, extent: bbox ? bbox[2] - bbox[0] + 1 : undefined, context: ordered?.context_key,
      expectedConfiguration: ordered?.expected_configuration, refs: p.question?.hypothesis_refs,
      guard: s.trace.findLast(e => e.kind === 'before_guard')?.reason });
  }
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
