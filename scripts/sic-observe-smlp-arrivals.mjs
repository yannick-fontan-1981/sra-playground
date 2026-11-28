import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_SMLP_ENGINE_ROOT: root, SIC_SMLP_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { ConfiguredArrivals, configuredScene, configuredTrajectories } = await load('logos-engine/v6-configured-arrivals.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
let eventsThisTurn;
const record = ConfiguredArrivals.prototype.record;
ConfiguredArrivals.prototype.record = function (...args) {
  const result = record.apply(this, args);
  for (const e of result?.events ?? []) {
    const entry = { kind: e.kind, before: e.before, after: e.after, tracks: e.tracks,
      compatible: e.compatible_route_orders, samples: e.samples_per_cell, point: e.point };
    if (e.kind === 'public_configured_arrival_packet') {
      const scene = configuredScene(args[3], this.grid);
      entry.measured = Object.fromEntries([...configuredTrajectories(scene, args[7])].map(([actor, [path, ticks]]) => (
        [actor, { target: path.at(-1), tick: ticks.at(-1) }]
      )));
    }
    eventsThisTurn.push(entry);
  }
  return result;
};
const handle = V6AgentService.prototype.handle, sessions = [];
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  eventsThisTurn = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), s = reply.snapshot;
  if (message.type === 'advance') {
    const r = s.trace.findLast(e => e.kind === 'actual_outcome'), o = message.observation;
    rows.push({ kind: 'return', turn: message.sequence, ref: r?.observation_ref, owner: r?.family,
      matched: r?.matched, reason: r?.reason, frames: o.frames.length, levels: o.levelsCompleted, events: eventsThisTurn,
      frame: createHash('sha256').update(JSON.stringify(o.frame)).digest('hex') });
  }
  if (reply.ticket) {
    const t = reply.ticket, p = s.proposal, plan = p.support_plan;
    const proof = s.lastDecision === 'configured_arrivals' ? plan?.v5_proof : null;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, ref: t.observationRef, id: t.id, level: t.level,
      owner: s.lastDecision, offer: p.kind, action: t.actionRef, point: t.data, index: t.actionIndex, target: plan?.target,
      latestFit: plan?.fit?.at(-1)?.evidence, refs: p.question?.hypothesis_refs,
      proof: proof ? { question: proof.question, policies: proof.conditional_predictions.length,
        intervals: [...new Set(proof.conditional_predictions.map(c => JSON.stringify(c.arrival_intervals)))].map(times => JSON.parse(times)),
        routeDomains: proof.route_domains.map(r => r.status), cohorts: proof.dated_cohorts } : null,
      guard: s.trace.findLast(e => e.kind === 'before_guard')?.reason });
  }
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
