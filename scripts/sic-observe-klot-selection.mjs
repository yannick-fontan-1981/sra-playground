import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_KLOT_ENGINE_ROOT: root, SIC_KLOT_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { NativeSelectedRigid } = await load('logos-engine/v6-selected-rigid.ts');
const { selectedRigidPoses } = await load('logos-engine/v6-selected-rigid-geometry.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
const sessions = [];
let recorded;

const record = NativeSelectedRigid.prototype.record;
NativeSelectedRigid.prototype.record = function (...args) {
  const result = record.apply(this, args);
  const event = result?.events?.[0];
  if (event) {
    const { detail, state } = event;
    recorded.push({ refs: [detail.before, detail.after], moved: detail.moved,
      role: detail.role_status, models: detail.compatible_model_count, selectionPixels: detail.selection_pixels_changed,
      active: state.scene.bodies[state.active]?.key, poses: selectedRigidPoses(state.scene) });
  }
  return result;
};

const handle = V6AgentService.prototype.handle;
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  recorded = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const o = message.observation, r = snapshot.trace.findLast(e => e.kind === 'actual_outcome');
    rows.push({ kind: 'return', turn: message.sequence, matched: r?.matched, reason: r?.reason,
      levels: o.levelsCompleted, recorded, packet: createHash('sha256').update(JSON.stringify(o)).digest('hex') });
  }
  if (reply.ticket) {
    const t = reply.ticket, p = snapshot.proposal, plan = p.selected_rigid_plan;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, ref: t.observationRef,
      owner: snapshot.lastDecision, action: t.actionRef, point: t.data, offer: p.kind, mode: plan?.mode });
  }
  return reply;
};

process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
