import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { SIC_SP80_ENGINE_ROOT: root, SIC_SP80_RECEIPT: output } = process.env;
const load = f => import(pathToFileURL(resolve(root, 'src', f)));
const { CellPlacementMemory } = await load('logos-engine/v6-cell-placement.ts');
const { projectCellPatch, cellPatchChanges } = await load('logos-engine/v6-cell-patch-observation.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
let measured, pending;
const sessions = [];
for (const method of ['record', 'recordPacket']) {
  const fn = CellPlacementMemory.prototype[method];
  CellPlacementMemory.prototype[method] = function (...args) {
    const result = fn.apply(this, args);
    for (const e of result ?? []) measured.push({ method, kind: e.kind, models: e.models, refused: e.refused,
      before: e.detail?.before_ref, after: e.detail?.after_ref });
    return result;
  };
}
const handle = V6AgentService.prototype.handle;
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') { sessions.push([]); pending = null; }
  const plan = pending;
  measured = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const outcome = snapshot.trace.findLast(e => e.kind === 'actual_outcome');
    const cells = message.observation.frames.map(frame => {
      const field = projectCellPatch(frame, plan.field.geometry);
      return field && cellPatchChanges(plan.field, field)?.map(c => c.slice(0, 2));
    });
    rows.push({ kind: 'return', turn: message.sequence, ref: outcome?.observation_ref, matched: outcome?.matched,
      reason: outcome?.reason, cells, measured });
  }
  if (reply.ticket) {
    const p = snapshot.proposal, t = reply.ticket; pending = p.cell_placement_plan;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, ref: t.observationRef, id: t.id, level: t.level,
      owner: snapshot.lastDecision, offer: p.kind, point: t.data, cell: pending.point, field: pending.field.ref,
      reason: p.question.reason, expected: pending.expected_motif, model: pending.model, search: Boolean(pending.search),
      refs: p.question.hypothesis_refs, guard: snapshot.trace.findLast(e => e.kind === 'before_guard')?.admitted });
  }
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
