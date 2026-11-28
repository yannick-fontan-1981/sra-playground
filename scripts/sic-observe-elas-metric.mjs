import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_ELAS_ENGINE_ROOT: root, SIC_ELAS_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { MetricComposition, measuredMetricScene } = await load('logos-engine/v6-metric-composition.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function metric(frame) {
  const scene = measuredMetricScene(frame);
  return scene && { selected: scene.selected, grid: scene.grid_ref, target: scene.target_ref,
    targetContains9: scene.target.flat().includes('9'), fills: digest(scene.fills) };
}
let measurements, guards, comparisons;
const record = MetricComposition.prototype.record;
MetricComposition.prototype.record = function (...args) {
  const result = record.apply(this, args);
  for (const e of result.events) measurements.push({
    kind: e.kind, after: e.after, projected: e.expected_visible_matched, unknown: e.unknown_underlay_revealed,
  });
  return result;
};
const before = MetricComposition.prototype.before;
MetricComposition.prototype.before = function (proposal, index, packet, observation) {
  const result = before.call(this, proposal, index, packet, observation);
  if (proposal.support_plan?.transitions[index]?.primitive.occurrence_ref === 'visible:24') {
    guards.push({ index, selected: metric(packet.frame_rows)?.selected, ...result });
  }
  return result;
};
const after = MetricComposition.prototype.after;
MetricComposition.prototype.after = function (proposal, index, old, current, first, later) {
  const result = after.call(this, proposal, index, old, current, first, later);
  comparisons.push({ index, selected: metric(later)?.selected, ...result });
  return result;
};
const handle = V6AgentService.prototype.handle, sessions = [];
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  measurements = [];
  guards = [];
  comparisons = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const o = message.observation, r = snapshot.trace.findLast(item => item.kind === 'actual_outcome');
    rows.push({ kind: 'return', turn: message.sequence, ref: r?.observation_ref, matched: r?.matched, seal: r?.seal_prefix,
      reason: r?.reason, owner: r?.family, levels: o.levelsCompleted, measurements,
      metric: metric(o.frame), comparisons, packet: digest(o) });
  }
  if (reply.ticket) {
    const t = reply.ticket, offer = snapshot.proposal, plan = offer.support_plan;
    const step = plan?.transitions?.[t.actionIndex]?.primitive;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, id: t.id, ref: t.observationRef,
      owner: snapshot.lastDecision, action: t.actionRef, point: t.data, scale: plan?.target?.scale,
      anchor: plan?.target?.anchor, target: plan?.target_ref, grid: plan?.grid_ref, control: !!plan?.control_facts,
      receiver: step?.occurrence_ref, destination: step?.destination_ref, refs: offer.route_refs,
      guard: snapshot.trace.findLast(item => item.kind === 'before_guard')?.reason, guards });
  }
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
