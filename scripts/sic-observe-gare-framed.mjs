import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { SIC_GARE_ENGINE_ROOT: root, SIC_GARE_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
const { FramedTransfer } = await load('logos-engine/v6-framed-transfer.ts');
const sessions = [];
let measured = [];
const record = FramedTransfer.prototype.record;
FramedTransfer.prototype.record = async function (...args) {
  const result = await record.apply(this, args);
  for (const e of result?.events ?? []) {
    const r = e.source_result ?? e;
    measured.push({ changed: r.scene_changed, evidence: r.evidence, derived: r.derived?.map(x => ({
      claim: x.source_claim_ref, policy: x.derivation.policy
    })) });
  }
  return result;
};
const handle = V6AgentService.prototype.handle;
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  measured = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const r = snapshot.trace.findLast(e => e.kind === 'actual_outcome');
    rows.push({ kind: 'return', turn: message.sequence, family: r?.family, matched: r?.matched,
      reason: r?.reason, ref: r?.observation_ref, acquired: measured, frames: message.observation.frames.length });
  }
  if (reply.ticket) {
    const p = snapshot.proposal, t = reply.ticket, plan = p?.framed_transfer_plan;
    const guard = snapshot.trace.findLast(e => e.kind === 'before_guard');
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, ticket: t.id, ref: t.observationRef,
      owner: snapshot.lastDecision, entry: p.material_access_subquestion ?? p.field_subquestion ?? p.kind,
      action: t.actionRef, point: t.data, expected: p.steps?.[t.actionIndex]?.expected_after,
      projection: plan?.choice?.projection_ref, claims: plan?.choice?.projected?.premise_claim_refs,
      competing: plan?.choice?.competing_current_offers, guard: guard?.admitted, guardReason: guard?.reason });
  }
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
