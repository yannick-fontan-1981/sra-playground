import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_LS20_ENGINE_ROOT: root, SIC_LS20_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { NativeMorphologyFamily } = await load('logos-engine/v6-morphology-family.ts');
const { NativeMorphologyPolicy } = await load('logos-engine/v6-morphology-policy.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
let acquired, assessments;
const record = NativeMorphologyFamily.prototype.record;
NativeMorphologyFamily.prototype.record = async function (...args) {
  const result = await record.apply(this, args);
  for (const event of result.events) {
    acquired.push({ ref: event.observation_ref, pair: event.pair_key, unchanged: event.unchanged_peer });
  }
  return result;
};
const evaluate = NativeMorphologyPolicy.prototype.evaluate;
NativeMorphologyPolicy.prototype.evaluate = async function (...args) {
  const result = await evaluate.apply(this, args);
  const add = assessments;
  if (add) add.push({ ref: result.observation_ref, route: result.route_key, reason: result.reason,
    authority: result.release_authority, bindings: result.route_bindings });
  return result;
};
const handle = V6AgentService.prototype.handle, sessions = [];
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  acquired = [];
  assessments = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const event = snapshot.trace.findLast(item => item.kind === 'actual_outcome'), o = message.observation;
    rows.push({ kind: 'return', turn: message.sequence, ref: event?.observation_ref, matched: event?.matched,
      reason: event?.reason, owner: event?.family, levels: o.levelsCompleted, acquired,
      packet: createHash('sha256').update(JSON.stringify(o)).digest('hex') });
  }
  if (reply.ticket) {
    const t = reply.ticket, offer = snapshot.proposal, plan = offer.morphology_plan;
    const facts = plan?.facts, step = plan?.steps[t.actionIndex];
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, id: t.id, ref: t.observationRef,
      owner: snapshot.lastDecision, action: t.actionRef, point: t.data,
      route: plan?.route_key, from: step?.from, to: step?.to, pair: facts?.pair_ref,
      orientation: facts?.orientation_relation, alternatives: facts?.feature_residuals.orientation_alternatives,
      contactChange: facts?.single_pattern_contact_change, contactRef: facts?.single_pattern_change_observation_ref,
      guard: snapshot.trace.findLast(item => item.kind === 'before_guard')?.reason, assessments: assessments.slice() });
  }
  assessments = undefined;
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
