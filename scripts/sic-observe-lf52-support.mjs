import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_LF52_ENGINE_ROOT: root, SIC_LF52_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { ReductionTransport } = await load('logos-engine/v6-reduction-transport.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
const sessions = [];
let recorded, observation;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const record = ReductionTransport.prototype.record;
ReductionTransport.prototype.record = function (...args) {
  const e = record.apply(this, args);
  if (e) recorded.push({ status: e.status, population: [e.before_population, e.after_population], selected: this.selected,
    firstLanding: this.scene?.floor.has('4,3') });
  return e;
};

const handle = V6AgentService.prototype.handle;
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  if (message.observation) observation = digest(message.observation);
  recorded = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const r = snapshot.trace.findLast(e => e.kind === 'actual_outcome');
    rows.push({ kind: 'return', turn: message.sequence, matched: r?.matched, reason: r?.reason,
      levels: message.observation.levelsCompleted, recorded, packet: observation });
  }
  if (reply.ticket) {
    const t = reply.ticket, p = snapshot.proposal, step = p.steps?.[t.actionIndex];
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, ref: t.observationRef,
      owner: snapshot.lastDecision, action: t.actionRef, point: t.data, mode: step?.mode, cell: step?.cell,
      carried: p.reduction_plan?.carriers, observation });
  }
  return reply;
};

process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
