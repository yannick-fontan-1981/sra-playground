import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_DC22_ENGINE_ROOT: root, SIC_DC22_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { SupportNavigation } = await load('logos-engine/v6-support-navigation.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
const cell = (frame, y) => frame.slice(y, y + 2).flatMap(row => row.slice(10, 12));
const surface = frame => ({ start: cell(frame, 38), next: cell(frame, 36) });
let acquired, guards;
const record = SupportNavigation.prototype.recordExisting;
SupportNavigation.prototype.recordExisting = async function (...args) {
  const result = await record.apply(this, args);
  for (const event of result.events) {
    acquired.push({ kind: event.kind, command: event.command, delta: event.delta, after: event.after,
      effectRef: event.effect?.after, cells: event.effect?.typed_transition_measurements?.cell_transition_rows?.length,
      usefulness: event.usefulness, question: event.question_key });
  }
  return result;
};
const before = SupportNavigation.prototype.before;
SupportNavigation.prototype.before = async function (proposal, index, packet, observation) {
  const decision = await before.call(this, proposal, index, packet, observation);
  if (proposal.support_plan?.positions[index]?.join() === '10,36') {
    guards.push({ admitted: decision.admitted, reason: decision.reason, action: proposal.actions[index].action_ref,
      ref: observation.observation_ref, surface: surface(packet.frame_rows) });
  }
  return decision;
};
const handle = V6AgentService.prototype.handle, sessions = [];
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  acquired = [];
  guards = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const event = snapshot.trace.findLast(item => item.kind === 'actual_outcome'), o = message.observation;
    rows.push({ kind: 'return', turn: message.sequence, ref: event?.observation_ref, matched: event?.matched,
      reason: event?.reason, owner: event?.family, levels: o.levelsCompleted, acquired,
      surface: surface(o.frame), packet: createHash('sha256').update(JSON.stringify(o)).digest('hex') });
  }
  if (reply.ticket) {
    const t = reply.ticket, offer = snapshot.proposal, plan = offer.support_plan;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, id: t.id, ref: t.observationRef,
      owner: snapshot.lastDecision, action: t.actionRef, point: t.data,
      positions: plan?.positions, actor: plan?.actor_bbox, question: plan?.experiment_key,
      guard: snapshot.trace.findLast(item => item.kind === 'before_guard')?.reason, guards });
  }
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
