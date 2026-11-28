import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_LKEY_ENGINE_ROOT: root, SIC_LKEY_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { RankedWorkshop } = await load('logos-engine/v6-ranked-workshop.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
const sessions = [];
let recorded, observation;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const record = RankedWorkshop.prototype.recordSource;
RankedWorkshop.prototype.recordSource = function (...args) {
  const value = record.apply(this, args);
  const from = args[0].observation_ref, to = args[1].observation_ref;
  const effect = this.input_effects.find(e => e.evidence.at(-1) === to);
  if (value || effect) recorded.push({ from, to, status: value?.status, displacement: effect?.slot_delta,
    geometryChanged: effect?.changes.profile_geometry_changed, receiverChanged: effect?.changes.receiver_changed,
    mode: this.mode_evidence.map(e => ({ contrast: e.observed_change, evidence: e.evidence })) });
  return value;
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
    const t = reply.ticket, p = snapshot.proposal, plan = p.workshop_plan;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, ref: t.observationRef,
      owner: snapshot.lastDecision, action: t.actionRef, point: t.data, stage: plan?.stage, refs: plan?.evidence,
      above: plan?.context.station_profile_neighbor_above_equal_marked_cut_count,
      extension: plan?.extension, observation });
  }
  return reply;
};

process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
