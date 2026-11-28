import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_ISOS_ENGINE_ROOT: root, SIC_ISOS_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { NativeFacetExamples } = await load('logos-engine/v6-facet-examples.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
let acquired;
const record = NativeFacetExamples.prototype.record;
NativeFacetExamples.prototype.record = function (...args) {
  const event = record.apply(this, args);
  const state = this.state(), portable = state.portable;
  let substitutedBoundary;
  if (process.env.SIC_ISOS_STALE_BOUNDARY === '1' && event.status === 'official_boundary'
      && args[0].level_epoch === 1 && args[1].level_epoch === 2 && portable) {
    substitutedBoundary = { expected: portable.boundary_ref, supplied: args[0].observation_ref };
    this.restore({ ...state, portable: { ...portable, boundary_ref: substitutedBoundary.supplied } });
  }
  acquired.push({ status: event.status, refs: event.evidence, shift: event.cap_shift,
    preserved: event.outside_preserved, sides: event.side_changes?.map(side => side.vertical_extension),
    rendered: event.whole_colored_render_matched, boundary: substitutedBoundary?.supplied ?? portable?.boundary_ref,
    substitutedBoundary, upShift: portable?.up_shift });
  return event;
};
const handle = V6AgentService.prototype.handle, sessions = [];
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  acquired = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const o = message.observation, r = snapshot.trace.findLast(e => e.kind === 'actual_outcome');
    rows.push({ kind: 'return', turn: message.sequence, ref: r?.observation_ref, matched: r?.matched,
      reason: r?.reason, owner: r?.family, levels: o.levelsCompleted, acquired,
      packet: createHash('sha256').update(JSON.stringify(o)).digest('hex') });
  }
  if (reply.ticket) {
    const t = reply.ticket, p = snapshot.proposal, plan = p.facet_plan, model = plan?.projection;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, id: t.id, ref: t.observationRef,
      owner: snapshot.lastDecision, action: t.actionRef, point: t.data, offer: p.kind,
      guard: snapshot.trace.findLast(e => e.kind === 'before_guard')?.reason, refs: p.route_refs,
      facet: model && { scope: model.scope_ref, offer: model.offer.kind, world: model.world, box: model.example_box,
        scale: model.scale_hypothesis, support: model.offer.support?.bbox, port: model.compound?.port_status,
        shift: plan.method?.shift, offset: plan.method?.offset } });
  }
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
