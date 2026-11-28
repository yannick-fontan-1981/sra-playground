import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_ZIPP_67_71_ENGINE_ROOT: root, SIC_ZIPP_67_71_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { TraceFieldMemory } = await load('logos-engine/v6-trace-field-access.ts');
const { OutlineService } = await load('logos-engine/v6-outline-service.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
let edges, outlines, guards;
const record = TraceFieldMemory.prototype.record;
TraceFieldMemory.prototype.record = function (...args) {
  const result = record.apply(this, args);
  for (const event of result) edges.push(event.transition);
  return result;
};
const recordOutline = OutlineService.prototype.recordSource;
OutlineService.prototype.recordSource = async function (...args) {
  const r = await recordOutline.apply(this, args);
  if (r) outlines.push({ status: r.status, pixels: r.local_count, scope: r.scope, refs: r.evidence });
  return r;
};
const beforeOutline = OutlineService.prototype.beforeSource;
OutlineService.prototype.beforeSource = function (proposal, index, packet, observation) {
  const r = beforeOutline.call(this, proposal, index, packet, observation);
  if (proposal.outline_plan?.operator) guards.push({ ...r, frame: digest(packet.frame_rows) });
  return r;
};
const handle = V6AgentService.prototype.handle, sessions = [];
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  edges = [];
  outlines = [];
  guards = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const o = message.observation, r = snapshot.trace.findLast(item => item.kind === 'actual_outcome');
    rows.push({ kind: 'return', turn: message.sequence, ref: r?.observation_ref, matched: r?.matched, seal: r?.seal_prefix,
      owner: r?.family, reason: r?.reason, levels: o.levelsCompleted, edges, outlines,
      frame: digest(o.frame), packet: digest(o) });
  }
  if (reply.ticket) {
    const t = reply.ticket, offer = snapshot.proposal, trace = offer.trace_field_plan, outline = offer.outline_plan;
    const step = offer.steps?.[t.actionIndex];
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, id: t.id, ref: t.observationRef,
      owner: snapshot.lastDecision, action: t.actionRef, point: t.data, strategy: offer.sicLocalDecision?.strategy,
      subquestion: offer.field_subquestion ?? offer.material_access_subquestion, guard: snapshot.trace.findLast(e => e.kind === 'before_guard')?.reason,
      trace: trace && { commands: trace.commands.length, geometry: trace.scene.geometry, prefix: trace.scene.prefix,
        successes: trace.state.successes.map(event => event.after_ref), relation: step?.relation_observed },
      outline: outline && { bbox: outline.measurement.current.bbox, exact: outline.measurement.facts.exact_locus,
        observed: outline.measurement.facts.local_operator_observed, expected: step?.expected_after,
        meaning: outline.meaning.kind, scope: outline.control?.level_epoch, refs: outline.control?.evidence },
      guards });
  }
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
