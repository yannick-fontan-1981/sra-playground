import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_LP85_ENGINE_ROOT: root, SIC_LP85_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { OrbitConstraints, orbitValues } = await load('logos-engine/v6-orbit-constraints.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
let acquired, guards, previous;
const record = OrbitConstraints.prototype.record;
OrbitConstraints.prototype.record = function (...args) {
  const result = record.apply(this, args);
  acquired.push({ ref: result.ref, status: result.status, matches: result.matches });
  return result;
};
const before = OrbitConstraints.prototype.before;
OrbitConstraints.prototype.before = async function (proposal, index, packet, obs) {
  const result = await before.call(this, proposal, index, packet, obs);
  if (obs.level_epoch === 1 && index === 1) {
    guards.push({ ...result, values: orbitValues(packet.frame_rows, proposal.orbit_plan.positions, proposal.orbit_plan.size) });
  }
  return result;
};
const handle = V6AgentService.prototype.handle, sessions = [];
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') {
    sessions.push([]);
    previous = undefined;
  }
  acquired = [];
  guards = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const o = message.observation, r = snapshot.trace.findLast(e => e.kind === 'actual_outcome');
    rows.push({ kind: 'return', turn: message.sequence, ref: r?.observation_ref, matched: r?.matched,
      reason: r?.reason, owner: r?.family, levels: o.levelsCompleted, acquired,
      values: previous && orbitValues(o.frame, previous.positions, previous.size),
      packet: createHash('sha256').update(JSON.stringify(o)).digest('hex') });
  }
  if (reply.ticket) {
    const t = reply.ticket, p = snapshot.proposal, plan = p.orbit_plan, step = p.steps?.[t.actionIndex];
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, id: t.id, ref: t.observationRef,
      owner: snapshot.lastDecision, action: t.actionRef, point: t.data, offer: p.kind,
      guard: snapshot.trace.findLast(e => e.kind === 'before_guard')?.reason, refs: p.route_refs,
      orbit: plan && { count: plan.positions.length, size: plan.size, controls: plan.candidate_control_count,
        targets: plan.targets, operators: plan.unique_observed_operators, why: plan.why,
        actions: p.actions.length, values: step?.before_values, expected: step?.expected_after }, guards });
    previous = plan;
  }
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
