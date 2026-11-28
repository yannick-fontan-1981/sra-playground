import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_RE86_ENGINE_ROOT: root, SIC_RE86_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { ConstellationEvidence } = await load('logos-engine/v6-constellation-cover.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
let records;
const record = ConstellationEvidence.prototype.record;
ConstellationEvidence.prototype.record = async function (...args) {
  const e = await record.apply(this, args);
  records.push({ ref: e.ref, status: e.status, vector: e.measured_vector, bodies: e.acquired_bodies,
    supports: e.acquired_supports?.map(item => ({ owner: item.owner, palette: item.palette_value,
      pixels: item.relative_support_pixels.length, refs: item.evidence_refs })),
    occlusion: e.selection_local_occlusion_observed });
  return e;
};
const handle = V6AgentService.prototype.handle, sessions = [];
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  records = [];
  const reply = await handle.call(this, message);
  const s = reply.snapshot, rows = sessions.at(-1);
  if (message.type === 'advance') {
    const r = s.trace.findLast(e => e.kind === 'actual_outcome'), o = message.observation;
    rows.push({ kind: 'return', turn: message.sequence, ref: r?.observation_ref, owner: r?.family, matched: r?.matched,
      reason: r?.reason, levels: o.levelsCompleted, records,
      frame: createHash('sha256').update(JSON.stringify(o.frame)).digest('hex') });
  }
  if (reply.ticket) {
    const t = reply.ticket, p = s.proposal, step = p.steps[t.actionIndex], plan = p.constellation_plan;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, id: t.id, ref: t.observationRef, owner: s.lastDecision,
      action: t.actionRef, mode: step.mode, poses: step.poses, active: plan?.active, selector: plan?.selector,
      bodies: plan?.acquired_bodies, vectors: plan?.control_vectors, ownership: plan?.ownership_complete,
      forecast: step.expected_after, refs: p.question?.hypothesis_refs,
      guard: s.trace.findLast(e => e.kind === 'before_guard')?.reason });
  }
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
