import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_CN04_ENGINE_ROOT: root, SIC_CN04_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { PortAssembly, portAgreement, compatiblePorts, portAccessPath, placedPorts, portCells } =
  await load('logos-engine/v6-port-assembly.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
let acquired, guards, owner, previous;
const record = PortAssembly.prototype.record;
PortAssembly.prototype.record = function (...args) {
  const result = record.apply(this, args);
  acquired.push({ ref: result.ref, status: result.status, poses: result.poses, up: this.motion.get('ACTION1') });
  return result;
};
const before = PortAssembly.prototype.before;
PortAssembly.prototype.before = function (proposal, index, packet, obs) {
  owner = this;
  const r = before.call(this, proposal, index, packet, obs);
  if (obs.revision === 8) guards.push(r);
  return r;
};
const handle = V6AgentService.prototype.handle, sessions = [];
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  acquired = [];
  guards = [];
  let contact;
  if (message.type === 'advance' && [17, 18].includes(message.sequence)) {
    const model = owner.model, goal = previous.joint_goal;
    const points = placedPorts(model, 0, goal[0])[1].intersection(placedPorts(model, 1, goal[1])[1]).sorted();
    contact = { points, frames: message.observation.frames.map(frame => {
      const cells = portCells(frame, model);
      return [portAgreement(frame, model, goal), points.map(point => cells.get(point.join(','))?.value)];
    }) };
  }
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const o = message.observation, r = snapshot.trace.findLast(e => e.kind === 'actual_outcome');
    rows.push({ kind: 'return', turn: message.sequence, ref: r?.observation_ref, matched: r?.matched,
      reason: r?.reason, owner: r?.family, levels: o.levelsCompleted, acquired, contact,
      packet: createHash('sha256').update(JSON.stringify(o)).digest('hex') });
  }
  if (reply.ticket) {
    const t = reply.ticket, p = snapshot.proposal, plan = p.port_plan, step = p.steps[t.actionIndex];
    const goal = plan.joint_goal;
    const route = [4, 7].includes(message.sequence) && goal ? {
      compatible: compatiblePorts(owner.model, 0, goal[0], new Map([[1, goal[1]]])),
      path: portAccessPath(owner.model, plan.poses, 0, goal[0], owner.motion),
      withoutDown: portAccessPath(owner.model, plan.poses, 0, goal[0],
        new Map([...owner.motion].filter(([action]) => action !== 'ACTION2'))),
    } : undefined;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, id: t.id, ref: t.observationRef,
      owner: snapshot.lastDecision, action: t.actionRef, point: t.data, mode: step.mode, materials: plan.materials,
      poses: plan.poses, ports: plan.known_ports, goal, expected: step.expected_after, route, guards });
    previous = plan;
  }
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
