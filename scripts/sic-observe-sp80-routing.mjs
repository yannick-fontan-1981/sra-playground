import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { SIC_SP80_ENGINE_ROOT: root, SIC_SP80_RECEIPT: output } = process.env;
const load = path => import(pathToFileURL(resolve(root, 'src', path)));
const { BranchRouting } = await load('logos-engine/v6-branch-routing.ts');
const { CellPlacementMemory } = await load('logos-engine/v6-cell-placement.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
const sessions = [];
let acquired, before;
for (const type of [BranchRouting, CellPlacementMemory]) {
  const record = type.prototype.record;
  type.prototype.record = function (...args) {
    const result = record.apply(this, args);
    for (const e of Array.isArray(result) ? result : result ? [result] : []) {
      acquired.push({ type: type.name, mode: e.mode, ref: e.ref, before: e.before, after: e.after,
        reason: e.reason, prior: e.detail?.before_ref, current: e.detail?.after_ref,
        modelCount: e.models && Object.keys(e.models).length, refused: e.refused });
    }
    return result;
  };
}
const handle = V6AgentService.prototype.handle;
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') { sessions.push([]); before = message.observation.frame; }
  acquired = [];
  const reply = await handle.call(this, message);
  const s = reply.snapshot, rows = sessions.at(-1);
  if (message.type === 'advance') {
    const r = s.trace.findLast(e => e.kind === 'actual_outcome');
    const received = message.observation.frame, changed = [];
    for (let y = 0; y < before.length; y++) for (let x = 0; x < before[y].length; x++) {
      if (before[y][x] !== received[y][x]) changed.push([x, y]);
    }
    rows.push({ kind: 'return', turn: message.sequence, ref: r?.observation_ref, matched: r?.matched,
      family: r?.family, reason: r?.reason, acquired, changedCount: changed.length,
      changed: changed.length <= 8 ? changed : undefined, frames: message.observation.frames.length });
    before = received;
  }
  if (reply.ticket) {
    const p = s.proposal, t = reply.ticket, step = p.steps?.[t.actionIndex], cell = p.cell_placement_plan;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, id: t.id, ref: t.observationRef,
      owner: s.lastDecision, offer: p.kind, action: t.actionRef, point: t.data, subquestion: p.material_access_subquestion ?? p.field_subquestion,
      mode: step?.mode, expected: step?.expected_after, model: cell?.model, motif: cell?.expected_motif,
      cell: cell?.point, geometry: cell?.field?.geometry, evidence: p.question?.hypothesis_refs,
      guard: s.trace.findLast(e => e.kind === 'before_guard')?.admitted });
  }
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
