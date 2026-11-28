import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_SERI_ENGINE_ROOT: root, SIC_SERI_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { VisualSequences } = await load('logos-engine/v6-visual-sequences.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
const sessions = [];
let recorded, publicObservation;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const record = VisualSequences.prototype.record;
VisualSequences.prototype.record = function (...args) {
  const e = record.apply(this, args);
  if (e) recorded.push({ status: e.status, evidence: e.evidence, filled: e.expected_card_filled,
    preserved: e.other_cards_preserved });
  return e;
};

const handle = V6AgentService.prototype.handle;
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  if (message.observation) publicObservation = digest(message.observation);
  recorded = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const r = snapshot.trace.findLast(e => e.kind === 'actual_outcome');
    rows.push({ kind: 'return', turn: message.sequence, matched: r?.matched, reason: r?.reason,
      levels: message.observation.levelsCompleted, recorded, packet: publicObservation });
  }
  if (reply.ticket) {
    const t = reply.ticket, p = snapshot.proposal, plan = p.sequence_plan;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, ref: t.observationRef,
      owner: snapshot.lastDecision, action: t.actionRef, point: t.data, offer: p.kind,
      row: plan?.row, rank: plan?.missing_rank, witnesses: plan?.continuation_witnesses,
      expected: plan?.expected_raster ? digest(plan.expected_raster) : undefined, observation: publicObservation });
  }
  return reply;
};

process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
