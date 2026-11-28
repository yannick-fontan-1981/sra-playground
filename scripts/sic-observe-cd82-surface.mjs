import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_CD82_ENGINE_ROOT: root, SIC_CD82_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { SurfaceProgram } = await load('logos-engine/v6-surface-program.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
const sessions = [];
let previous, learned;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const boxes = [[3, 3, 12, 12], [27, 34, 36, 43]];

const record = SurfaceProgram.prototype.record;
SurfaceProgram.prototype.record = function (...args) {
  const result = record.apply(this, args);
  learned.push({ before: args[0].observation_ref, after: args[1].observation_ref, compatible: result?.compatible_labels });
  return result;
};

const handle = V6AgentService.prototype.handle;
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') {
    sessions.push([]);
    previous = message.observation;
  }
  learned = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const o = message.observation, r = snapshot.trace.findLast(e => e.kind === 'actual_outcome');
    const pixels = boxes.map(([left, top, right, bottom]) =>
      o.frame.slice(top, bottom + 1).reduce((n, line, k) =>
        n + line.slice(left, right + 1).filter((pixel, j) => pixel !== previous.frame[top + k][left + j]).length, 0));
    rows.push({ kind: 'return', turn: message.sequence, matched: r?.matched, reason: r?.reason,
      levels: o.levelsCompleted, learned, pixels, packet: digest(o) });
    previous = o;
  }
  if (reply.ticket) {
    const t = reply.ticket, p = snapshot.proposal, plan = p.surface_plan;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, ref: t.observationRef,
      owner: snapshot.lastDecision, action: t.actionRef, point: t.data, offer: p.kind,
      fixed: plan?.fixed_reference, editable: plan?.editable_candidate, candidates: plan?.label_assignments_left,
      program: plan?.backward_program, observation: digest(previous) });
  }
  return reply;
};

process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
