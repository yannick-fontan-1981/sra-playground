import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_TRIA_ENGINE_ROOT: root, SIC_TRIA_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { RelativeArrangements } = await load('logos-engine/v6-relative-arrangements.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
const sessions = [];
let recorded;

const record = RelativeArrangements.prototype.record;
RelativeArrangements.prototype.record = function (...args) {
  const e = record.apply(this, args);
  if (e) recorded.push({ status: e.status, from: e.from, to: e.to, delta: e.delta, objects: e.preserved_objects,
    selection: e.selection_ref });
  return e;
};

const handle = V6AgentService.prototype.handle;
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  recorded = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const r = snapshot.trace.findLast(e => e.kind === 'actual_outcome');
    rows.push({ kind: 'return', turn: message.sequence, matched: r?.matched, reason: r?.reason,
      levels: message.observation.levelsCompleted, recorded,
      packet: createHash('sha256').update(JSON.stringify(message.observation)).digest('hex') });
  }
  if (reply.ticket) {
    const t = reply.ticket, p = snapshot.proposal, plan = p.arrangement_plan;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, ref: t.observationRef,
      owner: snapshot.lastDecision, action: t.actionRef, point: t.data, offer: plan?.offer.kind,
      move: plan?.offer.move, evidence: plan?.offer.model_evidence,
      participants: plan?.projection.objects.map(item => [item.xy, item.value]) });
  }
  return reply;
};

process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
