import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_GIGO_ENGINE_ROOT: root, SIC_GIGO_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { FieldServiceMemory } = await load('logos-engine/v6-field-service-access.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
let acquired, offers;
const record = FieldServiceMemory.prototype.record;
FieldServiceMemory.prototype.record = function (...args) {
  const result = record.apply(this, args);
  for (const e of result) acquired.push({ kind: e.kind, refs: e.evidence, pixels: e.changed_pixels,
    local: e.changed_inside_control, remote: e.changed_outside_control, official: e.official_progress,
    disposition: e.disposition, selection: e.selection_acquired, impossibility: e.impossibility_acquired });
  return result;
};
const nested = FieldServiceMemory.prototype.nestedQuestion;
FieldServiceMemory.prototype.nestedQuestion = function (...args) {
  const result = nested.apply(this, args);
  offers.push(!!result);
  return result;
};
const handle = V6AgentService.prototype.handle, sessions = [];
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  acquired = [];
  offers = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const o = message.observation, r = snapshot.trace.findLast(e => e.kind === 'actual_outcome');
    rows.push({ kind: 'return', turn: message.sequence, ref: r?.observation_ref, matched: r?.matched,
      reason: r?.reason, owner: r?.family, levels: o.levelsCompleted, acquired,
      packet: createHash('sha256').update(JSON.stringify(o)).digest('hex') });
  }
  if (reply.ticket) {
    const t = reply.ticket, p = snapshot.proposal, plan = p.nested_control_plan;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, id: t.id, ref: t.observationRef,
      owner: snapshot.lastDecision, offer: p.kind, action: t.actionRef, point: t.data,
      subquestion: p.field_subquestion, guard: snapshot.trace.findLast(e => e.kind === 'before_guard')?.reason,
      box: plan?.selected?.bbox, area: plan?.selected?.core_area, palette: plan?.selected?.core_palette,
      alternatives: plan?.alternative_enclosures?.map(e => e.core_area), expected: plan?.expected_effect, offers });
  } else {
    rows.push({ kind: reply.kind, turn: message.sequence, reason: reply.reason, offers });
  }
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
