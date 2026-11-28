import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_GRIL_ENGINE_ROOT: root, SIC_GRIL_RECEIPT: output } = process.env;
const load = path => import(pathToFileURL(resolve(root, 'src', path)));
const { OccludedCatalogueMemory } = await load('logos-engine/v6-occluded-catalogue-access.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
let observed, prior;
const record = OccludedCatalogueMemory.prototype.record;
OccludedCatalogueMemory.prototype.record = function (...args) {
  const events = record.apply(this, args);
  for (const e of events ?? []) {
    observed.push({ kind: e.kind, evidence: e.evidence, command: e.command, mode: e.mode,
      palette: e.palette, key: e.trial_key, fieldChanged: e.field_changed,
      structurePreserved: e.structure_preserved, progress: e.official_progress, candidates: e.candidate_ids });
  }
  return events;
};
const handle = V6AgentService.prototype.handle, sessions = [];
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') { sessions.push([]); prior = message.observation.frame; }
  observed = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const result = snapshot.trace.findLast(e => e.kind === 'actual_outcome'), observation = message.observation;
    const changed = observation.frame.reduce((n, row, y) => n + row.filter((v, x) => v !== prior[y][x]).length, 0);
    rows.push({ kind: 'return', turn: message.sequence, ref: result?.observation_ref, owner: result?.family,
      matched: result?.matched, reason: result?.reason, changed, observed,
      frame: createHash('sha256').update(JSON.stringify(observation.frame)).digest('hex'), levels: observation.levelsCompleted });
    prior = observation.frame;
  }
  if (reply.ticket) {
    const t = reply.ticket, p = snapshot.proposal, plan = p.occluded_catalogue_plan;
    const proof = plan?.evidence && {
      candidate: plan.evidence.candidate, backgrounds: plan.evidence.backgrounds, prior_candidate_ids: plan.evidence.prior_candidate_ids,
      supporting_event_digests: plan.evidence.supporting_event_digests, supporting_observation_refs: plan.evidence.supporting_observation_refs
    };
    rows.push({ kind: 'ticket', turn: message.sequence + 1, id: t.id, ref: t.observationRef, level: t.level,
      owner: snapshot.lastDecision, offer: p.kind, mode: plan?.mode, action: t.actionRef, point: t.data, palette: plan?.target_palette,
      key: plan?.trial_key, evidence: proof, details: plan?.details, expected: p.steps[t.actionIndex]?.expected_after,
      guard: snapshot.trace.findLast(e => e.kind === 'before_guard')?.reason });
  }
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
