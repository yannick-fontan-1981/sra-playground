import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_KATA_ENGINE_ROOT: root, SIC_KATA_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { NativePreviewPacking } = await load('logos-engine/v6-preview-packing.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
let acquired;
const record = NativePreviewPacking.prototype.record;
NativePreviewPacking.prototype.record = function (...args) {
  const result = record.apply(this, args);
  for (const { detail, model, controls } of result.events) {
    acquired.push({ before: detail.before, after: detail.after, selection: detail.selection_observed,
      pose: detail.observed_pose?.anchor, selected: model.selected, previewColor: model.preview_color,
      pieces: model.pieces.filter(p => p.movable).map(({ id, color, anchor }) => ({ id, color, anchor })),
      controls });
  }
  return result;
};
const handle = V6AgentService.prototype.handle, sessions = [];
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  acquired = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const event = snapshot.trace.findLast(item => item.kind === 'actual_outcome');
    const observation = message.observation;
    rows.push({ kind: 'return', turn: message.sequence, ref: event?.observation_ref, matched: event?.matched,
      reason: event?.reason, owner: event?.family, levels: observation.levelsCompleted, acquired,
      packet: createHash('sha256').update(JSON.stringify(observation)).digest('hex') });
  }
  if (reply.ticket) {
    const t = reply.ticket, offer = snapshot.proposal, plan = offer.preview_packing_plan;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, id: t.id, ref: t.observationRef,
      owner: snapshot.lastDecision, action: t.actionRef, point: t.data,
      mode: plan.mode, chosen: plan.chosen, target: plan.target?.anchor, expected: plan.expected[t.actionIndex]?.anchor,
      selected: plan.model.selected, previewColor: plan.model.preview_color,
      movable: plan.model.pieces.filter(p => p.movable).map(p => p.id),
      refs: offer.question.hypothesis_refs,
      guard: snapshot.trace.findLast(item => item.kind === 'before_guard')?.reason });
  }
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
